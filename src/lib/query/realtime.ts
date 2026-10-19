"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";

/**
 * useRealtimeManufacturingSync
 *
 * Establishes a lightweight Supabase Realtime WebSocket subscription for
 * high-velocity shop-floor manufacturing updates (subplate stages, scan projects).
 *
 * When updates occur, it triggers targeted TanStack Query cache invalidations,
 * ensuring multi-user state synchronization across active screens without full-page reloads.
 */
export function useRealtimeManufacturingSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const channel = supabase
      .channel("manufacturing-floor-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subplate",
        },
        () => {
          // Targeted invalidation: refresh subplates and dashboard counts
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scan",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("[RealtimeSync] Channel status:", status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/**
 * RealtimeSyncListener
 * Headless component to mount the realtime sync hook inside QueryClientProvider context.
 */
export function RealtimeSyncListener() {
  useRealtimeManufacturingSync();
  return null;
}
