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
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 24 * 60 * 60 * 1000,
  },
  // Tier C: Operational pipeline (Live projects, subplates, worklogs, challans, dispatch)
  // ZERO staleTime ensures immediate sync with live database on every mount or navigation
  OPERATIONAL: {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000, // 30s active-tab background polling fallback
    refetchIntervalInBackground: false,
  },
  // Tier D: Sensitive & Dashboard Rollups (KPI counts, user session)
  DASHBOARD: {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  },
} as const;

/**
 * Creates a configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchInterval: CACHE_TIERS.OPERATIONAL.refetchInterval,
        refetchIntervalInBackground: CACHE_TIERS.OPERATIONAL.refetchIntervalInBackground,
        refetchOnWindowFocus: true,
        refetchOnMount: "always",
        refetchOnReconnect: true,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
