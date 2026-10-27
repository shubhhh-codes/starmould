"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";

const TAB_CHANNEL_NAME = "starmould_tabs_sync";

/**
 * Broadcast an invalidation event across all open browser tabs/windows
 */
export function broadcastQueryInvalidation(queryKey: readonly unknown[]) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const bc = new BroadcastChannel(TAB_CHANNEL_NAME);
    bc.postMessage({ type: "INVALIDATE", queryKey });
    bc.close();
  } catch {
    // Graceful fallback if BroadcastChannel fails or is blocked
  }
}

/**
 * useRealtimeManufacturingSync
 *
 * Establishes:
 * 1. Cross-tab synchronization via BroadcastChannel (instant zero-network tab sync)
 * 2. Lightweight Supabase Realtime WebSocket subscription for shop-floor updates
 */
export function useRealtimeManufacturingSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Cross-tab synchronization via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel(TAB_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event.data?.type === "INVALIDATE" && event.data.queryKey) {
            queryClient.invalidateQueries({ queryKey: event.data.queryKey });
          }
        };
      } catch (e) {
        console.warn("[BroadcastSync] Could not open channel:", e);
      }
    }

    // 2. Supabase Realtime WebSocket channel for database updates
    const channel = supabase
      .channel("manufacturing-floor-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_config",
        },
        () => {
          broadcastQueryInvalidation(["role_permissions"]);
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            try {
              const bc = new BroadcastChannel(TAB_CHANNEL_NAME);
              bc.postMessage({ type: "PERMISSIONS_UPDATED" });
              bc.close();
            } catch {}
          }
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("[RealtimeSync] Channel status:", status, err);
        }
      });

    return () => {
      if (bc) {
        bc.close();
      }
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
