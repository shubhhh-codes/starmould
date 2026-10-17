"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import { CACHE_TIERS } from "./client";
import { useEffect } from "react";

// Fetch helper with error extraction
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Prefetch failed (${res.status})`);
  }
  return res.json();
}

/**
 * Enterprise Smart Prefetch Hook
 * Prefetches route datasets into the TanStack Query cache before navigation,
 * guaranteeing 0ms route transitions without skeleton screens.
 */
export function useSmartPrefetch() {
  const queryClient = useQueryClient();

  const prefetchProjects = (params: any = { pageSize: 500 }) => {
    const key = queryKeys.projects.list(params);
    if (queryClient.getQueryData(key)) return; // Already cached

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>(`/api/scanning?limit=${params.pageSize || 500}`);
        return {
          scans: data.scans || data.data || [],
          customers: data.customers || [],
          users: data.users || [],
          kpis: data.kpis || {},
          pagination: data.pagination,
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchSubplates = (params: any = {}) => {
    const key = queryKeys.subplates.list(params);
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const qs = params.projectid ? `?projectid=${encodeURIComponent(params.projectid)}` : "?limit=1000";
        const data = await fetchJson<any>(`/api/subplate${qs}`);
        return {
          subplates: data.subplates || data.data || [],
          scans: data.scans || [],
          users: data.users || [],
          kpis: data.kpis || { totalCount: 0, inHouseCount: 0, vendorCount: 0 },
          pagination: data.pagination,
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchCustomers = (params: any = { pageSize: 2000 }) => {
    const key = queryKeys.customers.list(params);
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/customers?limit=2000");
        return {
          customers: data.customers || data.data || [],
          pagination: data.pagination,
        };
      },
      staleTime: CACHE_TIERS.MODERATE.staleTime,
    });
  };

  const prefetchWorklogs = () => {
    const key = queryKeys.worklogs.list({});
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/worklog");
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
    });
  };

  const prefetchPurchases = () => {
    const key = queryKeys.purchases.list({ limit: 200, includePlates: true });
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/purchases?limit=200&includePlates=true");
        return {
          purchases: data.purchases || [],
          customers: data.customers || [],
          subplates: data.subplates || [],
          scans: data.scans || [],
          pagination: data.pagination,
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchChallans = () => {
    const key = queryKeys.challans.list({});
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/challan");
        return {
          challans: data.challans || [],
          customers: data.customers || [],
          subplates: data.subplates || [],
          scans: data.scans || [],
          kpis: data.kpis || {},
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchDispatch = () => {
    const key = queryKeys.dispatch.list({ limit: 200 });
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/dispatch?limit=200");
        return {
          dispatches: data.dispatches || [],
          customers: data.customers || [],
          subplates: data.subplates || [],
          scans: data.scans || [],
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchInward = () => {
    const key = queryKeys.inward.list({});
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/inward");
        return {
          inwards: data.inwards || [],
          pendingChallans: data.pendingChallans || [],
          customers: data.customers || [],
          subplates: data.subplates || [],
          kpis: data.kpis || {},
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchExpenses = () => {
    const key = queryKeys.expenses.list({});
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/expense");
        return {
          expenses: data.expenses || [],
          accounts: data.accounts || [],
          kpis: data.kpis || {},
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchSample = () => {
    const key = queryKeys.samples.list();
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/sample");
        return {
          projects: data.projects || [],
          customers: data.customers || [],
          users: data.users || [],
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchPrinting = () => {
    const key = queryKeys.printing.list();
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/printing");
        return {
          prints: data.prints || [],
          customers: data.customers || [],
          users: data.users || [],
          gramTiers: data.gramTiers || [],
          kpis: data.kpis || {},
        };
      },
      staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
    });
  };

  const prefetchUsers = () => {
    const key = queryKeys.users.list({});
    if (queryClient.getQueryData(key)) return;

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        const data = await fetchJson<any>("/api/users");
        return {
          users: data.users || [],
          roles: data.roles || [],
        };
      },
      staleTime: CACHE_TIERS.MODERATE.staleTime,
    });
  };

  /**
   * Universal route prefetch dispatcher
   */
  const prefetchRoute = (href: string) => {
    const cleanPath = href.split("?")[0];
    switch (cleanPath) {
      case "/":
      case "/scanning":
        prefetchProjects();
        break;
      case "/subplate":
        prefetchSubplates();
        break;
      case "/customers":
      case "/vendors":
        prefetchCustomers();
        break;
      case "/work":
        prefetchWorklogs();
        break;
      case "/purchase":
        prefetchPurchases();
        break;
      case "/challan":
        prefetchChallans();
        break;
      case "/dispatch":
        prefetchDispatch();
        break;
      case "/inward":
        prefetchInward();
        break;
      case "/expense":
        prefetchExpenses();
        break;
      case "/sample":
        prefetchSample();
        break;
      case "/printing":
        prefetchPrinting();
        break;
      case "/user":
      case "/settings":
        prefetchUsers();
        break;
      default:
        break;
    }
  };

  return {
    prefetchProjects,
    prefetchSubplates,
    prefetchCustomers,
    prefetchWorklogs,
    prefetchPurchases,
    prefetchChallans,
    prefetchDispatch,
    prefetchInward,
    prefetchExpenses,
    prefetchSample,
    prefetchPrinting,
    prefetchUsers,
    prefetchRoute,
  };
}

/**
 * Idle Background Warmup Hook
 * Warms up high-priority routes in the background when the main thread is idle
 */
export function useBackgroundPrefetchWarmup() {
  const { prefetchProjects, prefetchSubplates, prefetchCustomers, prefetchWorklogs } = useSmartPrefetch();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scheduleWarmup = (fn: () => void, delayMs: number) => {
      if ("requestIdleCallback" in window) {
        const handle = (window as any).requestIdleCallback(fn, { timeout: delayMs + 3000 });
        return () => (window as any).cancelIdleCallback(handle);
      } else {
        const timer = setTimeout(fn, delayMs);
        return () => clearTimeout(timer);
      }
    };

    // Stagger warmups so network and CPU aren't choked
    const cancel1 = scheduleWarmup(() => prefetchProjects(), 1500);
    const cancel2 = scheduleWarmup(() => prefetchSubplates(), 2800);
    const cancel3 = scheduleWarmup(() => prefetchCustomers(), 4200);
    const cancel4 = scheduleWarmup(() => prefetchWorklogs(), 5800);

    return () => {
      cancel1();
      cancel2();
      cancel3();
      cancel4();
    };
  }, [prefetchProjects, prefetchSubplates, prefetchCustomers, prefetchWorklogs]);
}
