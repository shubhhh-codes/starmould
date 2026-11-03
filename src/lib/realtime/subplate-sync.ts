"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { Subplate, ScanProject, User } from "@/lib/supabase/types";
import { queryKeys } from "@/lib/query/keys";
import { updateLocalProjectsStore } from "@/lib/cache/projects-local-store";
import {
  emitSubplateChange,
  getCachedStreamUsers,
} from "@/lib/cache/projects-stream-store";
import { computeSubplateDerivedMetrics } from "@/lib/realtime/derived-metrics";

export type SubplateChangeKind = "upsert" | "remove";
export type SubplateChangeOrigin = "local" | "ws" | "bc";

export interface SubplateChange {
  kind: SubplateChangeKind;
  plate?: Partial<Subplate>;
  id?: number;
  origin: SubplateChangeOrigin;
}

// ─── User name resolution mapping ────────────────────────────────────────────

export const USER_NAME_FIELDS = [
  { idKey: "design_by", nameKey: "design_by_name" },
  { idKey: "order_by", nameKey: "order_by_name" },
  { idKey: "received_workby", nameKey: "received_workby_name" },
  { idKey: "received_qcby", nameKey: "received_qcby_name" },
  { idKey: "vmc_workby", nameKey: "vmc_workby_name" },
  { idKey: "vmc_qcby", nameKey: "vmc_qcby_name" },
  { idKey: "drilltap_workby", nameKey: "drilltap_workby_name" },
  { idKey: "final_qcby", nameKey: "final_qcby_name" },
  { idKey: "packing_workby", nameKey: "packing_workby_name" },
] as const;

/**
 * Build a lookup map of users cached in the stream store or React Query.
 * Mirrors the server's userMap logic in src/app/api/subplate/route.ts.
 */
function resolveUserMap(queryClient: QueryClient): Map<number, { name?: string | null; initials?: string | null }> {
  const userMap = new Map<number, { name?: string | null; initials?: string | null }>();

  // 1. From progressive stream cached metadata
  const streamUsers = getCachedStreamUsers();
  for (const u of streamUsers) {
    if (u && u.id != null) {
      userMap.set(Number(u.id), u);
    }
  }

  // 2. From React Query cache
  const cachedUserQueries = queryClient.getQueriesData<any>({ queryKey: queryKeys.users.all() });
  for (const [, data] of cachedUserQueries) {
    const list = Array.isArray(data) ? data : data?.users;
    if (Array.isArray(list)) {
      for (const u of list) {
        if (u && u.id != null) {
          userMap.set(Number(u.id), u);
        }
      }
    }
  }

  return userMap;
}

/**
 * Enrich a raw subplate row from WebSocket with *_name fields from user cache.
 */
function enrichWsSubplate(plate: Partial<Subplate>, userMap: Map<number, { name?: string | null; initials?: string | null }>): Partial<Subplate> {
  const enriched = { ...plate };
  for (const { idKey, nameKey } of USER_NAME_FIELDS) {
    const userId = (plate as any)[idKey];
    if (userId != null && Number(userId) > 0) {
      const u = userMap.get(Number(userId));
      const resolved = u?.name || u?.initials || null;
      if (resolved) {
        (enriched as any)[nameKey] = resolved;
      }
    }
  }
  return enriched;
}

/**
 * Merge an incoming subplate into an existing subplate preserving *_name fields:
 * Never lets a raw row blank an existing *_name when the assigned ID did not change.
 */
function mergeSubplatesPreservingNames(existing: Subplate, incoming: Partial<Subplate>): Subplate {
  const merged: any = { ...existing, ...incoming };

  for (const { idKey, nameKey } of USER_NAME_FIELDS) {
    const existingName = (existing as any)[nameKey];
    const incomingName = (incoming as any)[nameKey];
    const existingId = (existing as any)[idKey];
    const incomingId = (incoming as any)[idKey];

    // If incoming doesn't supply a name, but the assigned user didn't change (or incoming didn't specify id), preserve existing name
    if (!incomingName && existingName) {
      if (incomingId === undefined || Number(incomingId) === Number(existingId)) {
        merged[nameKey] = existingName;
      }
    }
  }

  return merged as Subplate;
}

// ─── Counts invalidation debounce (150ms trailing debounce) ─────────────────

let countsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCountsInvalidate(queryClient: QueryClient): void {
  if (countsDebounceTimer !== null) {
    clearTimeout(countsDebounceTimer);
  }
  countsDebounceTimer = setTimeout(() => {
    countsDebounceTimer = null;
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
  }, 150);
}

// ─── Key matching helper ─────────────────────────────────────────────────────

/**
 * Derive the scan ID from a subplate row using the canonical linking key:
 *   plate.mold_id ?? Number(plate.projectid)
 * Returns null if missing or NaN.
 */
export function getScanIdFromPlate(plate: Partial<Subplate>): number | null {
  const raw = plate.mold_id != null ? plate.mold_id : plate.projectid != null ? Number(plate.projectid) : null;
  if (raw == null) return null;
  const num = Number(raw);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

// ─── Pure apply function for progressive stream ─────────────────────────────

/**
 * Immutably apply a subplate change to an array of ScanProject objects.
 * Uses lazy Map index to locate the single target project in O(1).
 * Recomputes subplate-derived metrics (total_plates, completion_percentage, etc.).
 * Returns the SAME array reference when nothing changed (enables React.memo bailout).
 */
export function applySubplateToScans(
  scans: ScanProject[],
  change: SubplateChange
): ScanProject[] {
  if (change.kind === "upsert") {
    const plate = change.plate;
    if (!plate || !plate.id) return scans;
    const scanId = getScanIdFromPlate(plate);
    if (scanId === null) return scans;

    // Build lazy map index
    const indexMap = new Map<number, number>();
    for (let i = 0; i < scans.length; i++) {
      indexMap.set(Number(scans[i].id), i);
    }

    const projectIdx = indexMap.get(scanId);
    if (projectIdx === undefined) return scans; // project not loaded yet

    const project = scans[projectIdx];
    const existingPlates: Subplate[] = project.subplates ?? [];
    const plateIdx = existingPlates.findIndex((p) => p.id === plate.id);

    let newPlates: Subplate[];
    if (plateIdx === -1) {
      // New plate in this project — append
      newPlates = [...existingPlates, plate as Subplate];
    } else {
      const cached = existingPlates[plateIdx];
      // Order guard: skip ONLY if cached row's updated_at is STRICTLY newer
      if (cached.updated_at && plate.updated_at) {
        const cachedTs = new Date(cached.updated_at).getTime();
        const incomingTs = new Date(plate.updated_at).getTime();
        if (cachedTs > incomingTs) return scans; // strictly newer: skip
      }

      // Merge preserving *_name fields so raw WS rows never blank existing names
      const merged = mergeSubplatesPreservingNames(cached, plate);
      newPlates = [...existingPlates];
      newPlates[plateIdx] = merged;
    }

    // Recompute derived project fields (total_plates, completion_percentage, etc.)
    const derived = computeSubplateDerivedMetrics(newPlates);
    const newProject: ScanProject = {
      ...project,
      subplates: newPlates,
      ...derived,
    };

    const next = [...scans];
    next[projectIdx] = newProject;
    return next;
  }

  if (change.kind === "remove") {
    const plateId = change.id ?? change.plate?.id;
    if (!plateId) return scans;

    let changed = false;
    const next = scans.map((project) => {
      if (!project.subplates || project.subplates.length === 0) return project;
      const filtered = project.subplates.filter((p) => p.id !== plateId);
      if (filtered.length === project.subplates.length) return project;
      changed = true;

      // Recompute derived project metrics after plate removal
      const derived = computeSubplateDerivedMetrics(filtered);
      return {
        ...project,
        subplates: filtered,
        ...derived,
      };
    });

    return changed ? next : scans;
  }

  return scans;
}

// ─── Pure apply function for scan scalar updates ────────────────────────────

/**
 * Scan UPDATE (Correction 5):
 * Merge only raw scalar columns into the cached project, keeping its subplates,
 * customername, customer_initials, scan_by_name, and all subplate-derived metrics untouched.
 */
export function applyScanUpdateToScans(
  scans: ScanProject[],
  rawScan: Partial<ScanProject>
): ScanProject[] {
  if (!rawScan || !rawScan.id) return scans;
  const scanId = Number(rawScan.id);
  const idx = scans.findIndex((s) => Number(s.id) === scanId);
  if (idx === -1) return scans;

  const existing = scans[idx];
  const merged: ScanProject = {
    ...existing,
    ...rawScan,
    // Preserve subplates array and all derived metrics
    subplates: existing.subplates,
    subplate_count: existing.subplate_count,
    total_plates: existing.total_plates,
    completed_plates: existing.completed_plates,
    completion_percentage: existing.completion_percentage,
    is_ready_for_dispatch: existing.is_ready_for_dispatch,
    // Preserve customer and user display names
    customername: existing.customername,
    customer_initials: existing.customer_initials,
    scan_by_name: existing.scan_by_name,
    qc_by_name: existing.qc_by_name,
    modeldesign_by_name: existing.modeldesign_by_name,
    // Preserve calculated hours
    calc_scan_hr: existing.calc_scan_hr,
    calc_model_hr: existing.calc_model_hr,
  };

  const next = [...scans];
  next[idx] = merged;
  return next;
}

// ─── BroadcastChannel for cross-tab sync ─────────────────────────────────────

const TAB_CHANNEL_NAME = "starmould_tabs_sync";
let sharedBc: BroadcastChannel | null = null;

function getBc(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  if (!sharedBc) {
    try {
      sharedBc = new BroadcastChannel(TAB_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return sharedBc;
}

// ─── Ingestion Entry Point ───────────────────────────────────────────────────

/**
 * The ONLY entry point for subplate changes.
 * Called by:
 * - Supabase Realtime WebSocket handler (origin: "ws")
 * - Cross-tab BroadcastChannel listener (origin: "bc")
 * - Client mutation onSuccess (origin: "local")
 */
export function ingestSubplateChange(
  queryClient: QueryClient,
  change: SubplateChange
): void {
  let { kind, plate, id, origin } = change;

  // Enrich raw WS rows with cached user names
  if (origin === "ws" && plate) {
    const userMap = resolveUserMap(queryClient);
    plate = enrichWsSubplate(plate, userMap);
  }

  const effectiveId = id ?? plate?.id;

  // Check key matching: mold_id ?? Number(projectid)
  if (kind === "upsert" && plate) {
    const scanKey = getScanIdFromPlate(plate);
    if (scanKey === null) {
      // Key is null or NaN: skip local patch and fall back to one coalesced syncDelta()
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
        scheduleCountsInvalidate(queryClient);
      }
      return;
    }
  }

  const effectiveChange: SubplateChange = {
    kind,
    plate,
    id: effectiveId,
    origin,
  };

  // 1. Sink 1: React Query caches via setQueriesData (cancelQueries first)
  queryClient.cancelQueries({ queryKey: queryKeys.subplates.all() });

  if (kind === "upsert" && plate && plate.id) {
    queryClient.setQueriesData<any>(
      { queryKey: queryKeys.subplates.all() },
      (old: any) => {
        if (!old) return old;
        const patchList = (list: Subplate[]) => {
          const idx = list.findIndex((p) => p.id === plate!.id);
          if (idx === -1) {
            return [plate as Subplate, ...list];
          }
          const cached = list[idx];
          // Order guard: skip ONLY if cached is strictly newer
          if (cached.updated_at && plate!.updated_at) {
            if (new Date(cached.updated_at).getTime() > new Date(plate!.updated_at).getTime()) {
              return list;
            }
          }
          const next = [...list];
          next[idx] = mergeSubplatesPreservingNames(cached, plate!);
          return next;
        };

        if (Array.isArray(old)) return patchList(old);
        if (old.subplates && Array.isArray(old.subplates)) {
          return { ...old, subplates: patchList(old.subplates) };
        }
        if (old.data && Array.isArray(old.data)) {
          return { ...old, data: patchList(old.data) };
        }
        return old;
      }
    );
  } else if (kind === "remove" && effectiveId) {
    queryClient.setQueriesData<any>(
      { queryKey: queryKeys.subplates.all() },
      (old: any) => {
        if (!old) return old;
        const filterList = (list: Subplate[]) => list.filter((p) => p.id !== effectiveId);
        if (Array.isArray(old)) return filterList(old);
        if (old.subplates && Array.isArray(old.subplates)) {
          return { ...old, subplates: filterList(old.subplates) };
        }
        if (old.data && Array.isArray(old.data)) {
          return { ...old, data: filterList(old.data) };
        }
        return old;
      }
    );
  }

  // Sink 1b: subplates.byProject(key)
  const scanKey = plate ? getScanIdFromPlate(plate) : null;
  if (scanKey !== null) {
    queryClient.cancelQueries({ queryKey: queryKeys.subplates.byProject(scanKey) });
    queryClient.setQueriesData<Subplate[] | null | undefined>(
      { queryKey: queryKeys.subplates.byProject(scanKey) },
      (old) => {
        if (!Array.isArray(old)) return old;
        if (kind === "upsert" && plate && plate.id) {
          const idx = old.findIndex((p) => p.id === plate!.id);
          if (idx === -1) return [...old, plate as Subplate];
          const cached = old[idx];
          if (cached.updated_at && plate!.updated_at) {
            if (new Date(cached.updated_at).getTime() > new Date(plate!.updated_at).getTime()) {
              return old;
            }
          }
          const next = [...old];
          next[idx] = mergeSubplatesPreservingNames(cached, plate!);
          return next;
        }
        if (kind === "remove" && effectiveId) {
          return old.filter((p) => p.id !== effectiveId);
        }
        return old;
      }
    );
  }

  // 2. Sink 2: Progressive projects stream (in-memory bridge)
  emitSubplateChange(effectiveChange);

  // 3. Sink 3: Local IndexedDB cache (serialized mutex queue)
  updateLocalProjectsStore((scans) => applySubplateToScans(scans, effectiveChange));

  // 4. Sink 4: Trailing debounced invalidation of dashboard counts (150ms)
  scheduleCountsInvalidate(queryClient);

  // 5. Cross-tab broadcast: ONLY origin "local" posts; "bc" and "ws" never rebroadcast
  if (origin === "local") {
    try {
      const bc = getBc();
      bc?.postMessage({
        type: "SUBPLATE_CHANGE",
        kind,
        plate,
        id: effectiveId,
      });
    } catch {
      // Non-blocking
    }
  }
}
