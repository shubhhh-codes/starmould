"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { CACHE_TIERS } from "@/lib/query/client";
import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";
import type { ScanProject, Subplate, User } from "@/lib/supabase/types";
import { ingestSubplateChange } from "@/lib/realtime/subplate-sync";
import { fetchJson } from "@/lib/query/fetch-json";

/* =========================================================================
   2. SUBPLATE QUERIES & MUTATIONS
   ========================================================================= */

export interface SubplatesQueryParams {
  page?: number;
  pageSize?: number;
  projectid?: string | number;
  search?: string;
  material?: string;
  location?: string;
}

export function useSubplatesQuery(params: SubplatesQueryParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 1000;

  const query = useQuery({
    queryKey: queryKeys.subplates.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize) searchParams.set("limit", String(params.pageSize));
      if (params.projectid && params.projectid !== "ALL") searchParams.set("projectid", String(params.projectid));
      if (params.search) searchParams.set("search", params.search);
      if (params.material && params.material !== "ALL") searchParams.set("material", params.material);
      if (params.location && params.location !== "ALL") searchParams.set("location", params.location);

      const qs = searchParams.toString();
      const url = `/api/subplate${qs ? `?${qs}` : ""}`;
      const data = await fetchJson<any>(url);

      return {
        subplates: (data.subplates || data.data || []) as Subplate[],
        scans: (data.scans || []) as ScanProject[],
        users: (data.users || []) as User[],
        kpis: data.kpis || { totalCount: 0, inHouseCount: 0, vendorCount: 0 },
        pagination: data.pagination || {
          page,
          pageSize,
          total: (data.subplates || []).length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    },
    staleTime: 5 * 1000,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  return query;
}

export function useSubplatesByProjectQuery(
  projectId: number | string | undefined,
  options?: { enabled?: boolean; }
) {
  return useQuery({
    queryKey: queryKeys.subplates.byProject(projectId || "0"),
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetchJson<any>(`/api/subplate?projectid=${encodeURIComponent(projectId)}`);
      return (res.subplates || res.data || []) as Subplate[];
    },
    enabled: options?.enabled !== false && !!projectId && projectId !== "0",
    staleTime: 5 * 60 * 1000, // 5 minutes cache for on-demand lazy accordion rows
  });
}

export function useCreateSubplateMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/subplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: (resData, variables) => {
      if (!principalIsCurrent(principalSnapshot)) return;
      const serverPlate = resData?.subplate || resData?.data;
      if (serverPlate) {
        ingestSubplateChange(queryClient, {
          kind: "upsert",
          plate: serverPlate,
          origin: "local",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
        if (variables?.projectid) {
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.byProject(variables.projectid) });
        }
      }
    },
  });
}

export function useUpdateSubplateMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/subplate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.subplates.all() });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.subplates.all() });

      const patch = updated.updates || updated;
      queryClient.setQueriesData({ queryKey: queryKeys.subplates.all() }, (old: any) => {
        if (!old) return old;
        const updateList = (list: any[]) =>
          list.map((item) => (item.id === updated.id ? { ...item, ...patch } : item));
        if (Array.isArray(old)) return updateList(old);
        if (old.subplates) return { ...old, subplates: updateList(old.subplates) };
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
    onSuccess: (resData, variables) => {
      if (!principalIsCurrent(principalSnapshot)) return;
      const serverPlate = resData?.subplate || resData?.data;
      if (serverPlate) {
        ingestSubplateChange(queryClient, {
          kind: "upsert",
          plate: serverPlate,
          origin: "local",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
        if (variables?.projectid) {
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.byProject(variables.projectid) });
        }
      }
      // Invalidate purchases ONLY when order_by key is present (including null/0)
      const vars = variables?.updates ?? variables;
      if (vars && "order_by" in vars) {
        queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      }
    },
  });
}

export function useDeleteSubplateMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/subplate?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onMutate: async (deletedId) => {
      // Look up plate from cache before removal (Requirement 5)
      let cachedPlate: Partial<Subplate> | undefined;
      const subplateQueries = queryClient.getQueriesData<any>({ queryKey: queryKeys.subplates.all() });
      for (const [, data] of subplateQueries) {
        const list = Array.isArray(data) ? data : data?.subplates || data?.data;
        if (Array.isArray(list)) {
          const found = list.find((p: any) => p && p.id === deletedId);
          if (found) {
            cachedPlate = found;
            break;
          }
        }
      }

      await queryClient.cancelQueries({
        queryKey: queryKeys.subplates.all(),
        predicate: (query) => query.state.data !== undefined,
      });
      const previousData = queryClient.getQueriesData({ queryKey: queryKeys.subplates.all() });

      // Part 3 Fix: Optimistically filter from React Query caches only (no stream/IndexedDB/broadcast)
      queryClient.setQueriesData<any>(
        { queryKey: queryKeys.subplates.all() },
        (old: any) => {
          if (!old) return old;
          const filterList = (list: any[]) => list.filter((item) => item && item.id !== deletedId);
          if (Array.isArray(old)) return filterList(old);
          if (old.subplates) return { ...old, subplates: filterList(old.subplates) };
          if (old.data) return { ...old, data: filterList(old.data) };
          return old;
        }
      );

      return { previousData, cachedPlate };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previousData) {
        for (const [key, val] of context.previousData) {
          queryClient.setQueryData(key, val);
        }
      }
    },
    onSuccess: (_data, deletedId, context) => {
      if (!principalIsCurrent(principalSnapshot)) return;
      ingestSubplateChange(queryClient, {
        kind: "remove",
        plate: context?.cachedPlate,
        id: deletedId,
        origin: "local",
      });
    },
  });
}
