"use client";

import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { CACHE_TIERS } from "@/lib/query/client";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";
import type { ScanProject, Customer, User } from "@/lib/supabase/types";
import {
  loadLocalProjectsStore,
  saveLocalProjectsStore,
  mergeDeltaScans,
  clearLocalProjectsStore,
} from "@/lib/cache/projects-local-store";
import {
  applySubplateToScans,
  applyScanUpdateToScans,
  setIdbCachedUsers,
  type SubplateChange,
} from "@/lib/realtime/subplate-sync";
import {
  subscribeSubplateChanges,
  subscribeScanUpdates,
  setCachedStreamUsers,
} from "@/lib/cache/projects-stream-store";
import { fetchJson } from "@/lib/query/fetch-json";

/* =========================================================================
   1. MOULD & SCANNING PROJECTS QUERIES & MUTATIONS
   ========================================================================= */

export interface ProjectsQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  customer?: string;
  worktype?: string;
  enabled?: boolean;
}

export function useProjectsQuery(params: ProjectsQueryParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 50;
  const status = params.status;
  const search = params.search;
  const customer = params.customer;
  const worktype = params.worktype;

  const query = useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize) searchParams.set("limit", String(params.pageSize));
      if (status && status !== "ALL") searchParams.set("status", status);
      if (search) searchParams.set("search", search);
      if (customer && customer !== "ALL") searchParams.set("customer", customer);
      if (worktype && worktype !== "ALL") searchParams.set("worktype", worktype);

      const qs = searchParams.toString();
      const url = `/api/scanning${qs ? `?${qs}` : ""}`;
      const data = await fetchJson<any>(url, { signal });

      return {
        scans: (data.scans || data.data || []) as ScanProject[],
        customers: (data.customers || []) as Customer[],
        users: (data.users || []) as User[],
        kpis: data.kpis || {},
        pagination: data.pagination || {
          page,
          pageSize,
          total: (data.scans || []).length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    },
    enabled: params.enabled !== false,
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Intelligent Prefetching: Only prefetch next page if explicitly paginating with moderate page size (< 100).
  // For bulk fetches (e.g. pageSize: 500 used on dashboard or for full lookups), do not prefetch page 2
  // since the user is browsing the client dataset and a 500-item prefetch transfers 1.7MB+ unnecessarily.
  const hasNextPage = query.data?.pagination?.hasNextPage;
  const shouldPrefetchNext = Boolean(hasNextPage && pageSize < 100 && params.enabled !== false);

  useEffect(() => {
    if (shouldPrefetchNext) {
      const nextPageParams: ProjectsQueryParams = {
        page: page + 1,
        pageSize,
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
        ...(customer ? { customer } : {}),
        ...(worktype ? { worktype } : {}),
      };

      queryClient.prefetchQuery({
        queryKey: queryKeys.projects.list(nextPageParams),
        queryFn: async ({ signal }) => {
          const searchParams = new URLSearchParams();
          searchParams.set("page", String(page + 1));
          searchParams.set("limit", String(pageSize));
          if (status && status !== "ALL") searchParams.set("status", status);
          if (search) searchParams.set("search", search);
          if (customer && customer !== "ALL") searchParams.set("customer", customer);
          if (worktype && worktype !== "ALL") searchParams.set("worktype", worktype);

          const data = await fetchJson<any>(`/api/scanning?${searchParams.toString()}`, { signal });
          return {
            scans: (data.scans || data.data || []) as ScanProject[],
            customers: (data.customers || []) as Customer[],
            users: (data.users || []) as User[],
            kpis: data.kpis || {},
            pagination: data.pagination,
          };
        },
        staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
      });
    }
  }, [shouldPrefetchNext, page, pageSize, status, search, customer, worktype, queryClient]);

  return query;
}

export interface ProgressiveProjectsStreamParams {
  initialChunkSize?: number; // default: 25
  streamChunkSize?: number; // default: 50
  status?: string;
  search?: string;
  customer?: string;
  worktype?: string;
  enabled?: boolean;
}

/**
 * Enterprise Local-First Progressive Streaming & Incremental Delta Sync Hook.
 *
 * 1. ZERO-MS WARM LOAD: Immediately hydrates all cached moulds from IndexedDB.
 * 2. INCREMENTAL REFRESH: Queries `/api/scanning?since=lastSyncTime`.
 *    - Database ONLY searches for records created/modified after lastSyncTime.
 *    - Old records are NEVER re-fetched or re-rendered from the database!
 *    - If 0 records changed: network payload is ~120 bytes, zero DB rows scanned.
 *    - If records changed: merges ONLY the delta into client cache and IndexedDB.
 * 3. COLD-START STREAMING: If client has 0 cached records, loads Chunk 1 (<0.3s)
 *    and streams remaining pages once in background into IndexedDB.
 */
export function useProgressiveProjectsStream(params: ProgressiveProjectsStreamParams = {}) {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  const initialChunkSize = params.initialChunkSize || 50;
  const status = params.status;
  const search = params.search;
  const customer = params.customer;
  const worktype = params.worktype;
  const enabled = params.enabled !== false;

  const [streamedScans, setStreamedScans] = React.useState<ScanProject[]>([]);
  const [lastSyncTime, setLastSyncTime] = React.useState<string | null>(null);
  const [hasHydratedLocal, setHasHydratedLocal] = React.useState(false);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [isSyncingDelta, setIsSyncingDelta] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);
  const [streamTrigger, setStreamTrigger] = React.useState(0);
  const [extraMetadata, setExtraMetadata] = React.useState<{
    customers: Customer[];
    users: User[];
    kpis: Record<string, any>;
  }>({ customers: [], users: [], kpis: {} });

  const streamedScansRef = React.useRef<ScanProject[]>(streamedScans);
  const totalCountRef = React.useRef(totalCount);
  const extraMetadataRef = React.useRef(extraMetadata);
  const lastSyncTimeRef = React.useRef<string | null>(lastSyncTime);

  React.useEffect(() => {
    streamedScansRef.current = streamedScans;
    totalCountRef.current = totalCount;
    extraMetadataRef.current = extraMetadata;
    lastSyncTimeRef.current = lastSyncTime;
    if (extraMetadata.users && extraMetadata.users.length > 0) {
      setCachedStreamUsers(extraMetadata.users);
    }
  }, [streamedScans, totalCount, extraMetadata, lastSyncTime]);

  const streamAbortControllerRef = React.useRef<AbortController | null>(null);
  const isFreshStreamingRef = React.useRef(false);

  // 1. PHASE 1: Immediate 0ms Hydration from IndexedDB
  React.useEffect(() => {
    let active = true;
    loadLocalProjectsStore().then((cached) => {
      if (!active || !principalIsCurrent(principalSnapshot)) return;
      if (cached && cached.scans && cached.scans.length > 0) {
        setStreamedScans(cached.scans);
        setLastSyncTime(cached.lastSyncTime || null);
        setTotalCount(cached.totalCount || cached.scans.length);
        if (cached.users && cached.users.length > 0) {
          setIdbCachedUsers(cached.users);
          setCachedStreamUsers(cached.users);
        }
        setExtraMetadata({
          customers: cached.customers || [],
          users: cached.users || [],
          kpis: cached.kpis || {},
        });
      }
      setHasHydratedLocal(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // 2. PHASE 2: Delta Sync Function (Calls API with `since=lastSyncTime`)
  // Only fetches modified / added records from database! Old records NEVER re-queried!
  const syncDelta = React.useCallback(
    async (sinceTime?: string | null) => {
      const effectiveSince = sinceTime || lastSyncTimeRef.current || "1970-01-01T00:00:00.000Z";

      try {
        setIsSyncingDelta(true);
        const url = `/api/scanning?since=${encodeURIComponent(effectiveSince)}`;
        const res = await fetchJson<any>(url, undefined, principalSnapshot);

        if (res && res.isDelta) {
          const deltaScans: ScanProject[] = res.scans || [];
          const newServerTime = res.serverTime || new Date().toISOString();

          // 1. Database is completely truncated or empty: immediate clean wipe!
          if (res.isTruncated || res.totalCount === 0) {
            setStreamedScans([]);
            streamedScansRef.current = [];
            setTotalCount(0);
            totalCountRef.current = 0;
            await clearLocalProjectsStore();
            setLastSyncTime(newServerTime);
            queryClient.removeQueries({ queryKey: queryKeys.projects.all() });
            return { deltaCount: 0, deltaScans: [] };
          }

          // 2. Active IDs returned from database: synchronize deletions and additions
          const activeIds: number[] | undefined = res.activeIds;
          // Safety guard: only prune if activeIds is fully populated (never prune on truncated ID list)
          const shouldPrune = Array.isArray(activeIds) && activeIds.length >= (res.totalCount ?? 0);
          const activeSet = shouldPrune ? new Set(activeIds.map(Number)) : null;

          const currentScans = streamedScansRef.current;
          // 1. Prune any records deleted from the database
          const remaining = activeSet ? currentScans.filter((item) => activeSet.has(Number(item.id))) : currentScans;
          // 2. Merge newly added or updated delta scans
          let { merged } = mergeDeltaScans(remaining, deltaScans);

          // 3. Gap Reconciliation: If database has more records than client cache (e.g. pasted CSV rows with historical timestamps, SQL imports)
          if (activeSet && res.totalCount !== undefined && merged.length < res.totalCount) {
            const existingIds = new Set(merged.map((s) => Number(s.id)));
            const missingIds = Array.from(activeSet).filter((id) => !existingIds.has(id));
            if (missingIds.length > 0) {
              try {
                for (let i = 0; i < missingIds.length; i += 200) {
                  const chunkIds = missingIds.slice(i, i + 200);
                  const gapRes = await fetchJson<any>(`/api/scanning?ids=${chunkIds.join(",")}`, undefined, principalSnapshot);
                  const gapScans: ScanProject[] = gapRes.scans || gapRes.data || [];
                  if (gapScans.length > 0) {
                    const gapResult = mergeDeltaScans(merged, gapScans);
                    merged = gapResult.merged;
                  }
                }
              } catch (gapErr) {
                console.warn("[DeltaGap] Failed to fetch missing IDs:", gapErr);
              }
            }
          }

          const newTotal = res.totalCount !== undefined ? res.totalCount : merged.length;
          streamedScansRef.current = merged;
          setStreamedScans(merged);
          setTotalCount(newTotal);
          totalCountRef.current = newTotal;

          await saveLocalProjectsStore({
            scans: merged,
            lastSyncTime: newServerTime,
            customers: extraMetadataRef.current.customers,
            users: extraMetadataRef.current.users,
            kpis: extraMetadataRef.current.kpis,
            totalCount: newTotal,
            isInitialComplete: merged.length >= newTotal,
          }, principalSnapshot);

          setLastSyncTime(newServerTime);
          return { deltaCount: deltaScans.length, deltaScans };
        }
      } catch (err: any) {
        console.warn("[DeltaSync] Incremental sync error:", err?.message || err);
      } finally {
        setIsSyncingDelta(false);
      }
      return null;
    },
    [queryClient]
  );

  // 3. PHASE 3: On mount after IndexedDB hydration:
  // If we already have cached scans, execute Delta Sync immediately (15ms, ~120 bytes)!
  React.useEffect(() => {
    if (!hasHydratedLocal || !enabled) return;

    if (streamedScans.length > 0 && lastSyncTime) {
      // Warm start: perform lightweight delta sync in background
      syncDelta(lastSyncTime);
    }
  }, [hasHydratedLocal, enabled]);

  // If cache was empty (cold start on a fresh browser), fetch Chunk 1
  const shouldFetchChunk1 = enabled && hasHydratedLocal && streamedScans.length === 0;
  const chunk1Query = useProjectsQuery({
    page: 1,
    pageSize: initialChunkSize,
    status,
    search,
    customer,
    worktype,
    enabled: shouldFetchChunk1,
  });

  React.useEffect(() => {
    if (shouldFetchChunk1 && chunk1Query.data) {
      const scans = (chunk1Query.data.scans || []) as ScanProject[];
      const total = chunk1Query.data.pagination?.total ?? scans.length;
      setStreamedScans(scans);
      streamedScansRef.current = scans;
      setTotalCount(total);
      totalCountRef.current = total;
      const meta = {
        customers: chunk1Query.data.customers || [],
        users: chunk1Query.data.users || [],
        kpis: chunk1Query.data.kpis || {},
      };
      setExtraMetadata(meta);

      const now = new Date().toISOString();
      setLastSyncTime(now);

      saveLocalProjectsStore({
        scans,
        lastSyncTime: now,
        customers: meta.customers,
        users: meta.users,
        kpis: meta.kpis,
        totalCount: total,
        isInitialComplete: scans.length >= total,
      }, principalSnapshot);
    }
  }, [shouldFetchChunk1, chunk1Query.data]);

  // Progressive background runner (runs if cache is not yet fully populated, e.g. on first cold run or delta gap)
  React.useEffect(() => {
    if (!enabled || !hasHydratedLocal || isFreshStreamingRef.current) return;
    if (totalCount <= initialChunkSize || streamedScansRef.current.length >= totalCount || totalCount === 0) {
      setIsStreaming(false);
      return;
    }

    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    let isMounted = true;
    setIsStreaming(true);

    const streamNextChunks = async () => {
      try {
        let currentAllScans = [...streamedScansRef.current];
        let loaded = currentAllScans.length;
        let dbOffset = loaded;
        while (loaded < totalCount && isMounted && !abortController.signal.aborted) {
          // Ultra-lean 50ms cooperative yield keeps UI silky smooth at 60fps
          await new Promise((r) => setTimeout(r, 50));
          if (!isMounted || abortController.signal.aborted) break;

          // Fast Progressive Ramp-Up Sizing:
          // 1. Initial 200 items: 100 each for fast initial table paint
          // 2. 200+ items: 500 each to complete all 1,460 moulds in just 2-3 requests
          const currentChunkLimit = loaded < 200 ? 100 : 500;

          const searchParams = new URLSearchParams();
          searchParams.set("offset", String(dbOffset));
          searchParams.set("limit", String(currentChunkLimit));

          const res = await fetchJson<any>(`/api/scanning?${searchParams.toString()}`, {
            signal: abortController.signal,
          }, principalSnapshot);

          if (!isMounted || abortController.signal.aborted) break;

          const newScans: ScanProject[] = res.scans || res.data || [];
          if (newScans.length === 0) break;

          const prevCount = currentAllScans.length;
          const map = new Map<number | string, ScanProject>();
          for (const s of currentAllScans) map.set(s.id, s);
          for (const s of newScans) map.set(s.id, s);
          currentAllScans = Array.from(map.values());
          loaded = currentAllScans.length;
          dbOffset += newScans.length;

          streamedScansRef.current = currentAllScans;
          setStreamedScans(currentAllScans);

          saveLocalProjectsStore({
            scans: currentAllScans,
            lastSyncTime: new Date().toISOString(),
            customers: extraMetadataRef.current.customers,
            users: extraMetadataRef.current.users,
            kpis: extraMetadataRef.current.kpis,
            totalCount,
            isInitialComplete: loaded >= totalCount,
          }, principalSnapshot);

          // Strict break conditions to prevent infinite loops:
          if (
            loaded >= totalCount ||
            newScans.length < currentChunkLimit ||
            dbOffset >= totalCount ||
            currentAllScans.length <= prevCount
          ) {
            break;
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("[ProgressiveStream] Idle stream:", err?.message || err);
        }
      } finally {
        if (isMounted) setIsStreaming(false);
      }
    };

    const timer = setTimeout(streamNextChunks, 50);
    return () => {
      isMounted = false;
      abortController.abort();
      clearTimeout(timer);
    };
  }, [
    enabled,
    hasHydratedLocal,
    totalCount,
    initialChunkSize,
    streamTrigger,
  ]);

  // 4. Manual Refetch / User Refresh Button:
  const refetch = React.useCallback(async () => {
    // 1. Try delta sync first
    const deltaResult = await syncDelta(lastSyncTimeRef.current || "1970-01-01T00:00:00.000Z");
    if (deltaResult && (deltaResult.deltaCount > 0 || streamedScansRef.current.length > 0)) {
      return deltaResult;
    }

    // 2. Direct clean fetch if delta sync produces no result or cache was empty
    try {
      const res = await fetchJson<any>(`/api/scanning?limit=${initialChunkSize}&offset=0&fresh=true`, undefined, principalSnapshot);
      if (res) {
        const scans = (res.scans || res.data || []) as ScanProject[];
        const total = res.pagination?.total ?? scans.length;
        setStreamedScans(scans);
        streamedScansRef.current = scans;
        setTotalCount(total);
        totalCountRef.current = total;
        const now = new Date().toISOString();
        setLastSyncTime(now);

        await saveLocalProjectsStore({
          scans,
          lastSyncTime: now,
          customers: res.customers || extraMetadataRef.current.customers,
          users: res.users || extraMetadataRef.current.users,
          kpis: res.kpis || extraMetadataRef.current.kpis,
          totalCount: total,
          isInitialComplete: scans.length >= total,
        }, principalSnapshot);

        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
        return res;
      }
    } catch (err) {
      console.warn("[ProgressiveStream] Refetch error:", err);
    }
    return null;
  }, [syncDelta, initialChunkSize, queryClient]);

  // Optimistic Instant Removal of a mould project (0ms UI lag)
  const removeProjectLocally = React.useCallback(
    async (id: number | string) => {
      const strId = String(id);
      const numId = Number(id);

      setStreamedScans((prev) => {
        const updated = prev.filter((p) => String(p.id) !== strId && Number(p.id) !== numId);
        streamedScansRef.current = updated;
        const newTotal = Math.max(0, (totalCountRef.current || prev.length) - 1);
        setTotalCount(newTotal);
        totalCountRef.current = newTotal;

        // IMPORTANT: Do NOT advance lastSyncTime here.
        // Advancing it before the API delete completes causes the next delta sync
        // (since=newTime) to miss the deletion — because the server's activeIds
        // list is queried after the new time and the deleted ID will simply not be
        // included, but the local pruning already happened. We preserve the existing
        // lastSyncTime so that if any subsequent refetch/delta-sync runs, it correctly
        // sees the deletion via activeIds comparison.
        saveLocalProjectsStore({
          scans: updated,
          lastSyncTime: lastSyncTimeRef.current ?? new Date().toISOString(), // keep existing sync time if available
          customers: extraMetadataRef.current.customers,
          users: extraMetadataRef.current.users,
          kpis: extraMetadataRef.current.kpis,
          totalCount: newTotal,
          isInitialComplete: true,
        }, principalSnapshot);
        return updated;
      });

      // Also prune from TanStack Query caches immediately
      queryClient.setQueriesData<any>({ queryKey: queryKeys.projects.all() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old.scans)) {
          const filtered = old.scans.filter((s: any) => String(s.id) !== strId && Number(s.id) !== numId);
          return {
            ...old,
            scans: filtered,
            pagination: old.pagination
              ? { ...old.pagination, total: Math.max(0, old.pagination.total - 1) }
              : old.pagination,
          };
        }
        return old;
      });
    },
    [queryClient]
  );

  // Optimistic Instant Removal of multiple mould projects (0ms UI lag)
  const removeProjectsLocally = React.useCallback(
    async (ids: (number | string)[]) => {
      const idSet = new Set(ids.map((id) => String(id)));
      const numSet = new Set(ids.map((id) => Number(id)));

      setStreamedScans((prev) => {
        const updated = prev.filter((p) => !idSet.has(String(p.id)) && !numSet.has(Number(p.id)));
        streamedScansRef.current = updated;
        const newTotal = Math.max(0, (totalCountRef.current || prev.length) - ids.length);
        setTotalCount(newTotal);
        totalCountRef.current = newTotal;

        saveLocalProjectsStore({
          scans: updated,
          lastSyncTime: lastSyncTimeRef.current ?? new Date().toISOString(),
          customers: extraMetadataRef.current.customers,
          users: extraMetadataRef.current.users,
          kpis: extraMetadataRef.current.kpis,
          totalCount: newTotal,
          isInitialComplete: true,
        }, principalSnapshot);
        return updated;
      });

      queryClient.setQueriesData<any>({ queryKey: queryKeys.projects.all() }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old.scans)) {
          const filtered = old.scans.filter((s: any) => !idSet.has(String(s.id)) && !numSet.has(Number(s.id)));
          return {
            ...old,
            scans: filtered,
            pagination: old.pagination
              ? { ...old.pagination, total: Math.max(0, old.pagination.total - ids.length) }
              : old.pagination,
          };
        }
        return old;
      });
    },
    [queryClient]
  );

  // Optimistic rollback in case API deletion fails
  const restoreProjectLocally = React.useCallback(
    async (project: ScanProject) => {
      setStreamedScans((prev) => {
        if (prev.some((p) => String(p.id) === String(project.id) || Number(p.id) === Number(project.id))) return prev;
        const updated = [project, ...prev];
        streamedScansRef.current = updated;
        const newTotal = (totalCountRef.current || prev.length) + 1;
        setTotalCount(newTotal);
        totalCountRef.current = newTotal;

        saveLocalProjectsStore({
          scans: updated,
          lastSyncTime: new Date().toISOString(),
          customers: extraMetadataRef.current.customers,
          users: extraMetadataRef.current.users,
          kpis: extraMetadataRef.current.kpis,
          totalCount: newTotal,
          isInitialComplete: true,
        }, principalSnapshot);
        return updated;
      });
    },
    []
  );

  // 5. Test Live Chunks Stream:
  // Explicitly wipes local cache and executes the live ramp-up chunk sequence on screen!
  const startFreshStream = React.useCallback(async () => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;
    isFreshStreamingRef.current = true;

    // 1. Wipe local IndexedDB cache completely
    await clearLocalProjectsStore();
    try {
      const { del } = await import("idb-keyval");
      await del("STARMOULD_PROJECTS_STORE_V2").catch(() => { });
      await del("STARMOULD_PROJECTS_STORE_V1").catch(() => { });
      await del("STARMOULD_CACHE_V6_default").catch(() => { });
      await del("STARMOULD_CACHE_V6_anon").catch(() => { });
    } catch { }

    queryClient.removeQueries({ queryKey: queryKeys.projects.all() });

    setStreamedScans([]);
    setTotalCount(0);
    setLastSyncTime(null);
    setIsStreaming(true);

    try {
      // Chunk 1: 50 items
      const res1 = await fetchJson<any>("/api/scanning?offset=0&limit=50", {
        signal: abortController.signal,
      }, principalSnapshot);
      const scans1: ScanProject[] = res1.scans || res1.data || [];
      const total = res1.pagination?.total || scans1.length;
      let currentAllScans: ScanProject[] = [...scans1];
      let loaded = scans1.length;

      setStreamedScans(currentAllScans);
      setTotalCount(total);
      setExtraMetadata({
        customers: res1.customers || [],
        users: res1.users || [],
        kpis: res1.kpis || {},
      });

      let dbOffset = loaded;
      while (loaded < total && !abortController.signal.aborted) {
        // Smooth visible pacing between chunks so user can clearly see each chunk update
        await new Promise((r) => setTimeout(r, 300));
        if (abortController.signal.aborted) break;

        // Progressive Ramp-Up Sizing:
        // Chunk 1 & 2: 100
        // Chunk 3+: 500
        const currentChunkLimit = loaded < 200 ? 100 : 500;

        const res = await fetchJson<any>(`/api/scanning?offset=${dbOffset}&limit=${currentChunkLimit}`, {
          signal: abortController.signal,
        }, principalSnapshot);
        if (abortController.signal.aborted) break;

        const newScans: ScanProject[] = res.scans || res.data || [];
        if (newScans.length === 0) break;

        const prevCount = currentAllScans.length;
        const map = new Map<number | string, ScanProject>();
        for (const s of currentAllScans) map.set(s.id, s);
        for (const s of newScans) map.set(s.id, s);
        currentAllScans = Array.from(map.values());
        loaded = currentAllScans.length;
        dbOffset += newScans.length;

        setStreamedScans(currentAllScans);

        saveLocalProjectsStore({
          scans: currentAllScans,
          lastSyncTime: new Date().toISOString(),
          customers: res1.customers || [],
          users: res1.users || [],
          kpis: res1.kpis || {},
          totalCount: total,
          isInitialComplete: loaded >= total,
        }, principalSnapshot);

        if (
          loaded >= total ||
          newScans.length < currentChunkLimit ||
          dbOffset >= total ||
          currentAllScans.length <= prevCount
        ) {
          break;
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("[StartFreshStream] Error during test stream:", err?.message || err);
      }
    } finally {
      isFreshStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, [queryClient]);

  // Bridge to Realtime Subplate Stream:
  // Subscribes to subplate changes in-memory, applies immutable update to streamed scans,
  // updates UI state immediately, and writes to IndexedDB preserving lastSyncTime.
  React.useEffect(() => {
    return subscribeSubplateChanges((change: SubplateChange) => {
      const next = applySubplateToScans(streamedScansRef.current, change);
      if (next === streamedScansRef.current) return;
      streamedScansRef.current = next;
      setStreamedScans([...next]);

      if (lastSyncTimeRef.current) {
        saveLocalProjectsStore({
          scans: next,
          lastSyncTime: lastSyncTimeRef.current,
          customers: extraMetadataRef.current.customers,
          users: extraMetadataRef.current.users,
          kpis: extraMetadataRef.current.kpis,
          totalCount: totalCountRef.current,
          isInitialComplete: next.length >= totalCountRef.current,
        }, principalSnapshot);
      }
    });
  }, []);

  // Bridge to Realtime Scan Scalar Updates (Correction 5):
  // Subscribes to raw scan UPDATE events, merges scalar columns while keeping subplates and derived metrics intact
  React.useEffect(() => {
    return subscribeScanUpdates((rawScan: Partial<ScanProject>) => {
      const next = applyScanUpdateToScans(streamedScansRef.current, rawScan);
      if (next === streamedScansRef.current) return;
      streamedScansRef.current = next;
      setStreamedScans([...next]);

      if (lastSyncTimeRef.current) {
        saveLocalProjectsStore({
          scans: next,
          lastSyncTime: lastSyncTimeRef.current,
          customers: extraMetadataRef.current.customers,
          users: extraMetadataRef.current.users,
          kpis: extraMetadataRef.current.kpis,
          totalCount: totalCountRef.current,
          isInitialComplete: next.length >= totalCountRef.current,
        }, principalSnapshot);
      }
    });
  }, []);

  // Coalesced Realtime Scan Changes (e.g. from Supabase Realtime or multi-tab events):
  // Since raw scan rows are not render-complete, coalesce scan changes with a 300ms trailing debounce
  // and run syncDelta once to fetch enriched project data.
  React.useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleScanChanged = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        syncDelta(lastSyncTimeRef.current || "1970-01-01T00:00:00.000Z");
      }, 300);
    };

    window.addEventListener("starmould:scan-changed", handleScanChanged);
    return () => {
      window.removeEventListener("starmould:scan-changed", handleScanChanged);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [syncDelta]);

  // Realtime Cross-Tab & Multi-Device Project Deletion Listeners:
  // Instantly prunes deleted projects from UI & IndexedDB without requiring manual page refresh!
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const onProjectDeleted = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ id?: number | string; ids?: (number | string)[]; }>;
      const id = customEvt.detail?.id;
      const ids = customEvt.detail?.ids;
      if (ids && Array.isArray(ids) && ids.length > 0) {
        removeProjectsLocally(ids);
      } else if (id !== undefined && id !== null) {
        removeProjectLocally(id);
      }
    };

    window.addEventListener("starmould:project-deleted", onProjectDeleted);

    return () => {
      window.removeEventListener("starmould:project-deleted", onProjectDeleted);
    };
  }, [removeProjectLocally, removeProjectsLocally]);

  const isLoading =
    streamedScans.length === 0 &&
    (chunk1Query.isLoading || chunk1Query.isPending || !hasHydratedLocal);

  return {
    scans: streamedScans,
    customers: extraMetadata.customers.length > 0 ? extraMetadata.customers : (chunk1Query.data?.customers || []),
    users: extraMetadata.users.length > 0 ? extraMetadata.users : (chunk1Query.data?.users || []),
    kpis: extraMetadata.kpis || chunk1Query.data?.kpis || {},
    isLoading,
    isInitialLoading: isLoading,
    isFetching: chunk1Query.isFetching || isStreaming || isSyncingDelta,
    isStreaming,
    isSyncingDelta,
    loadedCount: streamedScans.length,
    totalCount: Math.max(totalCount, streamedScans.length),
    progressPct: totalCount > 0 ? Math.min(100, Math.round((streamedScans.length / totalCount) * 100)) : 100,
    refetch,
    syncDelta,
    startFreshStream,
    removeProjectLocally,
    removeProjectsLocally,
    restoreProjectLocally,
    lastSyncTime,
  };
}

export function useCreateProjectMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/scanning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

export interface NextProjectIdPreview {
  nextId: number;
  cidStr: string;
  initials: string | null;
  custCountStr: string | null;
  projectid: string | null;
  previewCode: string | null;
  isComplete: boolean;
}

export function useNextProjectIdQuery(
  customerId?: string | number | null,
  initials?: string | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.projects.nextIdPreview(customerId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (customerId) params.set("customerId", String(customerId));
      if (initials) params.set("initials", initials);
      const qs = params.toString();
      return fetchJson<NextProjectIdPreview>(
        `/api/scanning/preview-id${qs ? `?${qs}` : ""}`
      );
    },
    enabled,
    staleTime: 5000,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateProjectMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: number; field: string; value: any; }) =>
      fetchJson<any>("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all() });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.projects.all() });

      queryClient.setQueriesData({ queryKey: queryKeys.projects.all() }, (old: any) => {
        if (!old) return old;
        const updateList = (list: any[]) =>
          list.map((item) =>
            item.id === updated.id ? { ...item, [updated.field]: updated.value } : item
          );
        if (Array.isArray(old)) return updateList(old);
        if (old.scans) return { ...old, scans: updateList(old.scans) };
        if (old.data) return { ...old, data: updateList(old.data) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _updated, context: any) => {
      if (context?.previousData) {
        for (const [key, val] of context.previousData) {
          queryClient.setQueryData(key, val);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

export function useDeleteProjectMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arg: number | { id: number; force?: boolean; }) => {
      const id = typeof arg === "number" ? arg : arg.id;
      const force = typeof arg === "number" ? false : Boolean(arg.force);
      return fetchJson<any>(`/api/scanning?id=${id}${force ? "&force=true" : ""}`, {
        method: "DELETE",
      }, principalSnapshot);
    },
    onMutate: async (arg) => {
      const deletedId = typeof arg === "number" ? arg : arg.id;
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all() });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.projects.all() });

      queryClient.setQueriesData({ queryKey: queryKeys.projects.all() }, (old: any) => {
        if (!old) return old;
        const filterList = (list: any[]) => list.filter((item) => item.id !== deletedId);
        if (Array.isArray(old)) return filterList(old);
        if (old.scans) return { ...old, scans: filterList(old.scans) };
        if (old.data) return { ...old, data: filterList(old.data) };
        return old;
      });

      return { previousData };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previousData) {
        for (const [key, val] of context.previousData) {
          queryClient.setQueryData(key, val);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.challans.all());
      broadcastQueryInvalidation(queryKeys.dispatch.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}
