import { QueryClient, keepPreviousData } from "@tanstack/react-query";

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
  OPERATIONAL: {
    staleTime: 60 * 1000,      // 60 seconds
    gcTime: 24 * 60 * 60 * 1000,
  },
  // Tier D: Sensitive & Dashboard Rollups (KPI counts, user session)
  DASHBOARD: {
    staleTime: 45 * 1000,      // 45 seconds
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
        staleTime: CACHE_TIERS.OPERATIONAL.staleTime,
        gcTime: CACHE_TIERS.OPERATIONAL.gcTime,
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
        placeholderData: keepPreviousData,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
