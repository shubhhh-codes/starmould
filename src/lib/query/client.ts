import { QueryClient } from "@tanstack/react-query";

/**
 * Cache Freshness Tier Configurations (in milliseconds)
 */
export const CACHE_TIERS = {
  // Tier A: Very stable reference data (materials, gram masters, dropdown lookups)
  STABLE: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,    // 30 minutes
  },
  // Tier B: Moderately changing master records (customers, vendors, users directory)
  MODERATE: {
    staleTime: 2 * 60 * 1000,  // 2 minutes
    gcTime: 15 * 60 * 1000,    // 15 minutes
  },
  // Tier C: Operational pipeline (Live projects, subplates, worklogs, challans, dispatch)
  OPERATIONAL: {
    staleTime: 30 * 1000,      // 30 seconds
    gcTime: 10 * 60 * 1000,    // 10 minutes
  },
  // Tier D: Sensitive & Dashboard Rollups (KPI counts, user session)
  DASHBOARD: {
    staleTime: 15 * 1000,      // 15 seconds
    gcTime: 5 * 60 * 1000,     // 5 minutes
  },
} as const;

/**
 * Creates a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
        gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
