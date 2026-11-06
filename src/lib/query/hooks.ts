"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { CACHE_TIERS } from "@/lib/query/client";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";
import type {
  ScanProject,
  Subplate,
  Customer,
  Vendor,
  User,
  PurchaseOrder,
  Challan,
  Dispatch,
  Inward,
  Expense,
  PurchaseInwardReceipt,
  ViewPoPendingInwardQty,
} from "@/lib/supabase/types";
import { fetchJson } from "./fetch-json";

export {
  useProjectsQuery,
  useProgressiveProjectsStream,
  useCreateProjectMutation,
  useNextProjectIdQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} from "@/features/moulds/queries/projects";
export type { ProjectsQueryParams, ProgressiveProjectsStreamParams, NextProjectIdPreview } from "@/features/moulds/queries/projects";
export {
  useSubplatesQuery,
  useSubplatesByProjectQuery,
  useCreateSubplateMutation,
  useUpdateSubplateMutation,
  useDeleteSubplateMutation,
} from "@/features/moulds/queries/subplates";
export type { SubplatesQueryParams } from "@/features/moulds/queries/subplates";
export type { PaginatedResponse } from "./types";

/* =========================================================================
   3. CUSTOMER & VENDOR QUERIES & MUTATIONS
   ========================================================================= */

export function useCustomersQuery(params: { usertype?: string; search?: string; page?: number; pageSize?: number; detail?: boolean; } = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.detail) searchParams.set("detail", "true");
      if (params.usertype && params.usertype !== "All") searchParams.set("usertype", params.usertype);
      if (params.search) searchParams.set("search", params.search);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize) searchParams.set("limit", String(params.pageSize));

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/customers${qs ? `?${qs}` : ""}`);
      return {
        customers: (data.customers || data.data || []) as Customer[],
        pagination: data.pagination,
      };
    },
    staleTime: CACHE_TIERS.MODERATE.staleTime,
    gcTime: CACHE_TIERS.MODERATE.gcTime,
  });
}

// Global Customer Dropdown hook (Strictly customers only)
export function useCustomerDropdownQuery(usertype: string = "Customer") {
  return useQuery({
    queryKey: queryKeys.customers.dropdown(usertype),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("limit", "2000");
      searchParams.set("usertype", usertype);
      const data = await fetchJson<any>(`/api/customers?${searchParams.toString()}`);
      return (data.customers || data.data || []) as Customer[];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useCreateCustomerMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateCustomerMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      broadcastQueryInvalidation(queryKeys.customers.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
    },
  });
}

export function useDeleteCustomerMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/customers?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   3b. VENDOR & TRANSPORTER QUERIES & MUTATIONS
   ========================================================================= */

export function useVendorsQuery(params: { vendor_type?: string; search?: string; page?: number; pageSize?: number; detail?: boolean; } = {}) {
  return useQuery({
    queryKey: queryKeys.vendors.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.detail) searchParams.set("detail", "true");
      if (params.vendor_type && params.vendor_type !== "All" && params.vendor_type !== "ALL") {
        searchParams.set("vendor_type", params.vendor_type);
      }
      if (params.search) searchParams.set("search", params.search);
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize) searchParams.set("limit", String(params.pageSize));

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/vendors${qs ? `?${qs}` : ""}`);
      return {
        vendors: (data.vendors || data.data || []) as Vendor[],
        pagination: data.pagination,
      };
    },
    staleTime: CACHE_TIERS.MODERATE.staleTime,
    gcTime: CACHE_TIERS.MODERATE.gcTime,
  });
}

export function useVendorDropdownQuery(vendor_type?: string) {
  return useQuery({
    queryKey: queryKeys.vendors.dropdown(vendor_type),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("limit", "2000");
      if (vendor_type && vendor_type !== "ALL" && vendor_type !== "All") {
        searchParams.set("vendor_type", vendor_type);
      }
      const data = await fetchJson<any>(`/api/vendors?${searchParams.toString()}`);
      return (data.vendors || data.data || []) as Vendor[];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useCreateVendorMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateVendorMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all() });
    },
  });
}

export function useDeleteVendorMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/vendors?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   4. USERS & STAFF QUERIES & MUTATIONS
   ========================================================================= */

export function useUsersQuery(params: { search?: string; role_id?: number; } = {}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: async () => {
      const data = await fetchJson<any>("/api/users");
      return {
        users: (data.users || []) as User[],
        roles: data.roles || [],
      };
    },
    staleTime: CACHE_TIERS.MODERATE.staleTime,
    gcTime: CACHE_TIERS.MODERATE.gcTime,
  });
}

// Global Shared Staff Dropdown hook (Tier A caching)
export function useUserDropdownQuery() {
  return useQuery({
    queryKey: queryKeys.users.dropdown(),
    queryFn: async () => {
      const data = await fetchJson<any>("/api/users");
      const activeUsers = (data.users || []).filter(
        (u: any) => String(u.status) === "1" || u.status === 1
      );
      return activeUsers as User[];
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useCreateUserMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateUserMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}

export function useDeleteUserMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/users?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   5. DASHBOARD COUNTS & STATS
   ========================================================================= */

export function useDashboardCountsQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard.counts(),
    queryFn: async () => {
      const data = await fetchJson<any>(`/api/counts?fresh=true&_t=${Date.now()}`);
      const counts = data.counts || {};
      return {
        ...counts,
        counts,
        pipeline: data.pipeline || null,
      };
    },
    staleTime: 60 * 1000,
    gcTime: CACHE_TIERS.DASHBOARD.gcTime,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}

/* =========================================================================
   6. WORKLOG QUERIES & MUTATIONS
   ========================================================================= */

export function useWorklogsQuery(params: { userid?: string; date?: string; customerid?: string; projectid?: string; } = {}) {
  return useQuery({
    queryKey: queryKeys.worklogs.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.userid && params.userid !== "ALL") searchParams.set("userid", params.userid);
      if (params.date) searchParams.set("date", params.date);
      if (params.customerid && params.customerid !== "ALL") searchParams.set("customerid", params.customerid);
      if (params.projectid && params.projectid !== "ALL") searchParams.set("projectid", params.projectid);

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/worklog${qs ? `?${qs}` : ""}`);
      return {
        worklogs: data.worklogs || [],
        customers: data.customers || [],
        users: data.users || [],
        scans: data.scans || [],
        subplates: data.subplates || [],
        kpis: data.kpis || {},
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateWorklogMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.worklogs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteWorklogMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/worklog?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.worklogs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   7. PURCHASES & INWARD QUERIES
   ========================================================================= */

export function usePurchasesQuery(params: { page?: number; limit?: number; includePlates?: boolean; } = {}) {
  return useQuery({
    queryKey: queryKeys.purchases.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.limit) searchParams.set("limit", String(params.limit));
      if (params.includePlates) searchParams.set("includePlates", "true");

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/purchases${qs ? `?${qs}` : ""}`);
      return {
        purchases: (data.purchases || []) as PurchaseOrder[],
        customers: (data.customers || []) as Customer[],
        subplates: (data.subplates || []) as Subplate[],
        scans: (data.scans || []) as ScanProject[],
        pagination: data.pagination,
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreatePurchaseMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

export function useUpdatePurchaseMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/purchases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

export function useDeletePurchaseMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/purchases?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

/* =========================================================================
   8. CHALLAN QUERIES & MUTATIONS
   ========================================================================= */

export function useChallansQuery(params: { status?: string; limit?: number; } = {}) {
  return useQuery({
    queryKey: queryKeys.challans.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set("status", params.status);
      if (params.limit) searchParams.set("limit", String(params.limit));

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/challan${qs ? `?${qs}` : ""}`);
      return {
        challans: (data.challans || []) as Challan[],
        customers: (data.customers || []) as Customer[],
        subplates: (data.subplates || []) as Subplate[],
        scans: (data.scans || []) as ScanProject[],
        kpis: data.kpis || { totalChallans: 0, activeCount: 0 },
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateChallanMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/challan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteChallanMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/challan?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateChallanStatusMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: number; status: string; }) =>
      fetchJson<any>("/api/challan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
    },
  });
}

/* =========================================================================
   9. DISPATCH QUERIES & MUTATIONS
   ========================================================================= */

export function useDispatchQuery(params: { limit?: number; } = {}) {
  return useQuery({
    queryKey: queryKeys.dispatch.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.set("limit", String(params.limit));

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/dispatch${qs ? `?${qs}` : ""}`);
      return {
        dispatches: (data.dispatches || []) as Dispatch[],
        customers: (data.customers || []) as Customer[],
        subplates: (data.subplates || []) as Subplate[],
        scans: (data.scans || []) as ScanProject[],
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateDispatchMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.dispatch.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

export function useDeleteDispatchMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/dispatch?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.dispatch.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

/* =========================================================================
   10. INWARD QUERIES & MUTATIONS
   ========================================================================= */

export function useInwardQuery(params: { limit?: number; } = {}) {
  return useQuery({
    queryKey: queryKeys.inward.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.set("limit", String(params.limit));

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/inward${qs ? `?${qs}` : ""}`);
      return {
        inwards: (data.inwards || []) as Inward[],
        pendingChallans: data.pendingChallans || [],
        customers: (data.customers || []) as Customer[],
        subplates: (data.subplates || []) as Subplate[],
        kpis: data.kpis || { totalInwards: 0, totalPendingChallanItems: 0 },
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateInwardMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.inward.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteInwardMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/inward?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.inward.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   11. EXPENSE QUERIES & MUTATIONS
   ========================================================================= */

export function useExpensesQuery(params: { customerid?: string; payment_type?: string; startDate?: string; endDate?: string; } = {}) {
  return useQuery({
    queryKey: queryKeys.expenses.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.customerid && params.customerid !== "ALL") searchParams.set("customerid", params.customerid);
      if (params.payment_type && params.payment_type !== "ALL") searchParams.set("payment_type", params.payment_type);
      if (params.startDate) searchParams.set("startDate", params.startDate);
      if (params.endDate) searchParams.set("endDate", params.endDate);

      const qs = searchParams.toString();
      const data = await fetchJson<any>(`/api/expense${qs ? `?${qs}` : ""}`);
      return {
        expenses: (data.expenses || []) as Expense[],
        accounts: (data.accounts || []) as Customer[],
        kpis: data.kpis || {
          totalCredit: 0,
          totalDebit: 0,
          totalOutstanding: 0,
          currentBalance: 0,
          totalCount: 0,
        },
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreateExpenseMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateExpenseMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/expense", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
    },
  });
}

export function useDeleteExpenseMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/expense?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   12. PURCHASE INWARD QUERIES & MUTATIONS
   ========================================================================= */

export function usePurchaseInwardQuery() {
  return useQuery({
    queryKey: queryKeys.purchaseInward.list(),
    queryFn: async () => {
      const data = await fetchJson<any>("/api/purchase-inward");
      return {
        pendingReceiveItems: (data.pendingReceiveItems || []) as ViewPoPendingInwardQty[],
        receipts: (data.receipts || []) as PurchaseInwardReceipt[],
        customers: (data.customers || []) as Customer[],
        subplates: (data.subplates || []) as Subplate[],
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}

export function useCreatePurchaseInwardMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/purchase-inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseInward.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.purchaseInward.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

export function useDeletePurchaseInwardMutation() {
  const principalSnapshot = React.useMemo(() => browserPrincipal(), []);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/purchase-inward?id=${id}`, {
        method: "DELETE",
      }, principalSnapshot),
    onSuccess: () => {
      if (!principalIsCurrent(principalSnapshot)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseInward.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.purchaseInward.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
    },
  });
}

/* =========================================================================
   13. REPORT METRICS QUERIES
   ========================================================================= */

export interface ReportMetricsData {
  downtimeRecords: any[];
  totalWorklogs: number;
  workflowCounts: {
    pulpMould: number;
    tf: number;
    rework: number;
    machinePart: number;
    accessories: number;
    sample: number;
    other: number;
    totalProjects: number;
  };
  totalSubplates: number;
}

export function useReportMetricsQuery(year?: string) {
  return useQuery({
    queryKey: queryKeys.reports.summary({ year: year || "2023" }),
    queryFn: async () => {
      const url = year ? `/api/report?year=${encodeURIComponent(year)}` : "/api/report";
      const data = await fetchJson<ReportMetricsData>(url);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/* =========================================================================
   17. EXPORT COUNTS QUERY
   ========================================================================= */

export function useExportCountsQuery() {
  return useQuery({
    queryKey: queryKeys.exports.counts(),
    queryFn: async () => {
      const data = await fetchJson<any>("/api/export?type=counts");
      return data.counts || {};
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
}
