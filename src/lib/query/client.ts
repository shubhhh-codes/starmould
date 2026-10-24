import { QueryClient } from "@tanstack/react-query";

/**
 * Cache Freshness Tier Configurations (in milliseconds)
 */
export const CACHE_TIERS = {
  // Tier A: Very stable reference data (materials, gram masters, dropdown lookups)
  STABLE: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours (persistent cache lifetime)
  },
  // Tier B: Moderately changing master records (customers, vendors, users directory)
  MODERATE: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000,
  },
  // Tier C: Operational pipeline (Live projects, subplates, worklogs, challans, dispatch)
  // 60s staleTime allows instantaneous SWR warm-cache renders while keeping data fresh
  OPERATIONAL: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchInterval: false as const, // Disabled constant polling to eliminate network thrashing
    refetchIntervalInBackground: false,
  },
  // Tier D: Sensitive & Dashboard Rollups (KPI counts, pipeline aggregation)
  DASHBOARD: {
    staleTime: 0, // Instant refresh on invalidation / task assignment
    gcTime: 24 * 60 * 60 * 1000,
  },
} as const;

/**
 * Creates a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchInterval: false,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
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
