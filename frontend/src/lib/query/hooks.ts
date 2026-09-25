"use client";

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { CACHE_TIERS } from "./client";
import type {
  ScanProject,
  Subplate,
  Customer,
  User,
  PurchaseOrder,
  Challan,
  Dispatch,
  Inward,
  Expense,
  PrintProject,
  GramCalc,
} from "@/lib/supabase/types";

// Standard pagination response structure
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  customers?: Customer[];
  users?: User[];
  kpis?: Record<string, any>;
  [key: string]: any;
}

// Fetch helper with error extraction
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const json = await res.json();
      if (json.error) errorMsg = json.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

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
}

export function useProjectsQuery(params: ProjectsQueryParams = {}) {
  const queryClient = useQueryClient();
  const page = params.page || 1;
  const pageSize = params.pageSize || 50;

  const query = useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set("page", String(params.page));
      if (params.pageSize) searchParams.set("limit", String(params.pageSize));
      if (params.status && params.status !== "ALL") searchParams.set("status", params.status);
      if (params.search) searchParams.set("search", params.search);
      if (params.customer && params.customer !== "ALL") searchParams.set("customer", params.customer);
      if (params.worktype && params.worktype !== "ALL") searchParams.set("worktype", params.worktype);

      const qs = searchParams.toString();
      const url = `/api/scanning${qs ? `?${qs}` : ""}`;
      const data = await fetchJson<any>(url);

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
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
  });

  // Intelligent Prefetching: prefetch next page if it exists
  if (query.data?.pagination?.hasNextPage) {
    const nextPageParams = { ...params, page: page + 1 };
    queryClient.prefetchQuery({
      queryKey: queryKeys.projects.list(nextPageParams),
      queryFn: async () => {
        const searchParams = new URLSearchParams();
        searchParams.set("page", String(page + 1));
        searchParams.set("limit", String(pageSize));
        if (params.status && params.status !== "ALL") searchParams.set("status", params.status);
        if (params.search) searchParams.set("search", params.search);
        const data = await fetchJson<any>(`/api/scanning?${searchParams.toString()}`);
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

  return query;
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/scanning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: number; field: string; value: any }) =>
      fetchJson<any>("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/scanning?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

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
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
  });

  return query;
}

export function useSubplatesByProjectQuery(projectId: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.subplates.byProject(projectId || "0"),
    queryFn: async () => {
      if (!projectId) return [];
      const res = await fetchJson<any>(`/api/subplate?projectid=${encodeURIComponent(projectId)}`);
      return (res.subplates || res.data || []) as Subplate[];
    },
    enabled: !!projectId && projectId !== "0",
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
  });
}

export function useCreateSubplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/subplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      if (variables?.projectid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.subplates.byProject(variables.projectid) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateSubplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/subplate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      if (variables?.projectid) {
        queryClient.invalidateQueries({ queryKey: queryKeys.subplates.byProject(variables.projectid) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteSubplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/subplate?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   3. CUSTOMER & VENDOR QUERIES & MUTATIONS
   ========================================================================= */

export function useCustomersQuery(params: { usertype?: string; search?: string; page?: number; pageSize?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
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

// Global Shared Dropdown hook for Customers/Vendors (Tier A caching)
export function useCustomerDropdownQuery(usertype?: string) {
  return useQuery({
    queryKey: queryKeys.customers.dropdown(usertype),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (usertype && usertype !== "ALL") searchParams.set("usertype", usertype);
      const data = await fetchJson<any>(`/api/customers?${searchParams.toString()}`);
      return (data.customers || data.data || []) as Customer[];
    },
    staleTime: CACHE_TIERS.STABLE.staleTime,
    gcTime: CACHE_TIERS.STABLE.gcTime,
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
    },
  });
}

export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/customers?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   4. USERS & STAFF QUERIES & MUTATIONS
   ========================================================================= */

export function useUsersQuery(params: { search?: string; role_id?: number } = {}) {
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
    staleTime: CACHE_TIERS.STABLE.staleTime,
    gcTime: CACHE_TIERS.STABLE.gcTime,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/users?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
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
      const data = await fetchJson<any>("/api/counts");
      return data.counts || {};
    },
    staleTime: CACHE_TIERS.DASHBOARD.staleTime,
    gcTime: CACHE_TIERS.DASHBOARD.gcTime,
  });
}

/* =========================================================================
   6. WORKLOG QUERIES & MUTATIONS
   ========================================================================= */

export function useWorklogsQuery(params: { userid?: string; date?: string; customerid?: string; projectid?: string } = {}) {
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
  });
}

export function useCreateWorklogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.worklogs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteWorklogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/worklog?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.worklogs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   7. PURCHASES & INWARD QUERIES
   ========================================================================= */

export function usePurchasesQuery(params: { page?: number; limit?: number; includePlates?: boolean } = {}) {
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
  });
}

export function useCreatePurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeletePurchaseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/purchases?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   8. CHALLAN QUERIES & MUTATIONS
   ========================================================================= */

export function useChallansQuery(params: { status?: string; limit?: number } = {}) {
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
  });
}

export function useCreateChallanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/challan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteChallanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/challan?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateChallanStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { id: number; status: string }) =>
      fetchJson<any>("/api/challan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
    },
  });
}

/* =========================================================================
   9. DISPATCH QUERIES & MUTATIONS
   ========================================================================= */

export function useDispatchQuery(params: { limit?: number } = {}) {
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
  });
}

export function useCreateDispatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteDispatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/dispatch?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   10. INWARD QUERIES & MUTATIONS
   ========================================================================= */

export function useInwardQuery(params: { limit?: number } = {}) {
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
  });
}

export function useCreateInwardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inward.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useDeleteInwardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/inward?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
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

export function useExpensesQuery(params: { customerid?: string; payment_type?: string; startDate?: string; endDate?: string } = {}) {
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
  });
}

export function useCreateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/expense", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
    },
  });
}

export function useDeleteExpenseMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/expense?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   12. SAMPLE & REWORK QUERIES & MUTATIONS
   ========================================================================= */

export function useSampleQuery() {
  return useQuery({
    queryKey: queryKeys.samples.list(),
    queryFn: async () => {
      const data = await fetchJson<any>("/api/sample");
      return {
        projects: (data.projects || []) as ScanProject[],
        customers: (data.customers || []) as Customer[],
        users: (data.users || []) as User[],
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
  });
}

export function useCreateSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.samples.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdateSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/sample", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.samples.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
}

export function useDeleteSampleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/sample?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.samples.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

/* =========================================================================
   13. 3D PRINTING QUERIES & MUTATIONS
   ========================================================================= */

export function usePrintingQuery() {
  return useQuery({
    queryKey: queryKeys.printing.list(),
    queryFn: async () => {
      const data = await fetchJson<any>("/api/printing");
      return {
        prints: (data.prints || []) as PrintProject[],
        customers: (data.customers || []) as Customer[],
        users: (data.users || []) as User[],
        gramTiers: (data.gramTiers || []) as GramCalc[],
        kpis: data.kpis || {
          totalPrints: 0,
          pendingPrints: 0,
          dispatchedPrints: 0,
          totalRevenue: 0,
        },
      };
    },
    staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
  });
}

export function useCreatePrintingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/printing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.printing.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}

export function useUpdatePrintingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: any) =>
      fetchJson<any>("/api/printing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.printing.all() });
    },
  });
}

export function useDeletePrintingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson<any>(`/api/printing?id=${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.printing.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
    },
  });
}
