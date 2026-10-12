"use client";

import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export function useSmartPrefetch() {
  const queryClient = useQueryClient();

  const prefetchProjects = (params: any = {}) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.projects.list(params),
      queryFn: async () => {
        const res = await fetch("/api/scanning?limit=50");
        return res.json();
      },
      staleTime: 60 * 1000,
    });
  };

  const prefetchSubplates = (projectId?: string | number) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.subplates.list({ projectid: projectId ? String(projectId) : undefined }),
      queryFn: async () => {
        const url = projectId ? `/api/subplate?projectid=${projectId}` : "/api/subplate?limit=100";
        const res = await fetch(url);
        return res.json();
      },
      staleTime: 60 * 1000,
    });
  };

  const prefetchCustomers = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.customers.all(),
      queryFn: async () => {
        const res = await fetch("/api/customers");
        return res.json();
      },
      staleTime: 5 * 60 * 1000,
    });
  };

  const prefetchExpenses = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.expenses.all(),
      queryFn: async () => {
        const res = await fetch("/api/expense?limit=100");
        return res.json();
      },
      staleTime: 60 * 1000,
    });
  };

  return {
    prefetchProjects,
    prefetchSubplates,
    prefetchCustomers,
    prefetchExpenses,
  };
}
