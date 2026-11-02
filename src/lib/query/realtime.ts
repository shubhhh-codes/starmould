"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";

const TAB_CHANNEL_NAME = "starmould_tabs_sync";

let sharedBc: BroadcastChannel | null = null;
function getSharedBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  if (!sharedBc) {
    try {
      sharedBc = new BroadcastChannel(TAB_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return sharedBc;
}

/**
 * Broadcast an invalidation event across all open browser tabs/windows on the same device
 */
export function broadcastQueryInvalidation(queryKey: readonly unknown[]) {
  if (typeof window === "undefined") return;
  try {
    const bc = getSharedBroadcastChannel();
    bc?.postMessage({ type: "INVALIDATE", queryKey });
  } catch {
    // Graceful fallback if BroadcastChannel fails or is blocked
  }
}

/**
 * Broadcast an instant project deletion across tabs on the same device (single or bulk)
 */
export function broadcastProjectDeletion(idOrIds: number | string | (number | string)[]) {
  if (typeof window === "undefined") return;
  try {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    window.dispatchEvent(
      new CustomEvent("starmould:project-deleted", { detail: { id: ids[0], ids } })
    );
    const bc = getSharedBroadcastChannel();
    bc?.postMessage({ type: "PROJECT_DELETED", id: ids[0], ids });
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Broadcast project creation / synchronization across tabs on the same device
 */
export function broadcastProjectSync() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("starmould:project-synced"));
    const bc = getSharedBroadcastChannel();
    bc?.postMessage({ type: "PROJECT_SYNCED" });
  } catch {
    // Non-blocking fallback
  }
}

/**
 * useRealtimeManufacturingSync
 *
 * Establishes:
 * 1. Cross-tab synchronization via BroadcastChannel (instant zero-network tab sync)
 * 2. Enterprise Supabase Realtime WebSocket subscriptions across all operational tables:
 *    - scan (Mould Projects)
 *    - subplate (Subplate Master)
 *    - purchase & po_inward (Purchase Orders & Inward Gate Receipts)
 *    - challan (Job Work Outward Movement)
 *    - dispatch (Customer Shipments)
 *    - app_config (Dynamic Role Permissions)
 */
export function useRealtimeManufacturingSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Cross-tab synchronization via BroadcastChannel
    const bc = getSharedBroadcastChannel();
    if (bc) {
      bc.onmessage = (event) => {
        if (event.data?.type === "INVALIDATE" && event.data.queryKey) {
          queryClient.invalidateQueries({ queryKey: event.data.queryKey });
        } else if (event.data?.type === "PROJECT_DELETED") {
          const { id, ids } = event.data;
          window.dispatchEvent(
            new CustomEvent("starmould:project-deleted", { detail: { id, ids } })
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        } else if (event.data?.type === "PROJECT_SYNCED") {
          window.dispatchEvent(new CustomEvent("starmould:project-synced"));
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        } else if (event.data?.type === "PERMISSIONS_UPDATED") {
          queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
        }
      };
    }

    // 2. Supabase Realtime WebSocket channel for database-wide multi-device sync
    const channel = supabase
      .channel("manufacturing-floor-sync")
      // A. MOULD PROJECTS (SCAN TABLE)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scan",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any)?.id;
            if (deletedId !== undefined && deletedId !== null) {
              window.dispatchEvent(
                new CustomEvent("starmould:project-deleted", { detail: { id: deletedId } })
              );
              broadcastProjectDeletion(deletedId);
            } else {
              window.dispatchEvent(new CustomEvent("starmould:project-synced"));
            }
          } else {
            // INSERT or UPDATE
            window.dispatchEvent(new CustomEvent("starmould:project-synced"));
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      // B. SUBPLATES (MANUFACTURING LIFE-CYCLE)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subplate",
        },
        () => {
          window.dispatchEvent(new CustomEvent("starmould:project-synced"));
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      // C. PURCHASE ORDERS
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "purchase",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      // D. PURCHASE INWARD RECEIPTS
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "po_inward",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.purchaseInward.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      // E. JOB WORK CHALLANS
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "challan",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      // F. CUSTOMER DISPATCH
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dispatch",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        }
      )
      // G. ROLE PERMISSIONS CONFIG
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_config",
        },
        () => {
          broadcastQueryInvalidation(["role_permissions"]);
          getSharedBroadcastChannel()?.postMessage({ type: "PERMISSIONS_UPDATED" });
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn("[RealtimeSync] Channel status:", status, err);
        }
      });

    return () => {
      if (bc) {
        bc.onmessage = null;
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
