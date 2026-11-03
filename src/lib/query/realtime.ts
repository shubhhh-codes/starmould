"use client";

import { useEffect, useRef } from "react";
import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";
import {
  ingestSubplateChange,
  scheduleCountsInvalidate,
  applyScanUpdateToScans,
} from "@/lib/realtime/subplate-sync";
import { emitScanUpdate } from "@/lib/cache/projects-stream-store";
import { updateLocalProjectsStore } from "@/lib/cache/projects-local-store";
import type { Subplate, ScanProject } from "@/lib/supabase/types";

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
 * Broadcast project scan change / synchronization across tabs on the same device
 */
export function broadcastProjectSync() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
    const bc = getSharedBroadcastChannel();
    bc?.postMessage({ type: "SCAN_CHANGED" });
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
  const realtimeDisconnectedRef = useRef(false);

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
          scheduleCountsInvalidate(queryClient);
        } else if (event.data?.type === "SCAN_CHANGED" || event.data?.type === "PROJECT_SYNCED") {
          window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
          scheduleCountsInvalidate(queryClient);
        } else if (event.data?.type === "PERMISSIONS_UPDATED") {
          queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
        } else if (event.data?.type === "SUBPLATE_CHANGE") {
          // Received from another tab that originated the change locally
          const { kind, plate, id } = event.data;
          ingestSubplateChange(queryClient, { kind, plate, id, origin: "bc" });
        }
      };
    }

    // Gap recovery on tab visibility (>30s hidden)
    let hiddenAt: number | null = null;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const elapsedMs = Date.now() - hiddenAt;
        hiddenAt = null;
        if (elapsedMs > 30000) {
          window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          scheduleCountsInvalidate(queryClient);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

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
            }
            scheduleCountsInvalidate(queryClient);
          } else if (payload.eventType === "UPDATE") {
            // Scan UPDATE (Correction 5): merge scalar columns, keep subplates and derived metrics untouched
            const updatedScan = payload.new as Partial<ScanProject>;
            emitScanUpdate(updatedScan);
            updateLocalProjectsStore((scans) => applyScanUpdateToScans(scans, updatedScan));
            scheduleCountsInvalidate(queryClient);
          } else {
            // INSERT: raw scan row is not render-complete (missing subplates[], customername, etc.)
            // Emit event so the stream hook can coalesce and call syncDelta() once.
            window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
            scheduleCountsInvalidate(queryClient);
          }
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
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              ingestSubplateChange(queryClient, {
                kind: "remove",
                id: Number(deletedId),
                origin: "ws",
              });
            }
          } else {
            // INSERT or UPDATE — payload.new is the full row (REPLICA IDENTITY FULL)
            const plate = payload.new as Subplate;
            ingestSubplateChange(queryClient, {
              kind: "upsert",
              plate,
              origin: "ws",
            });
          }
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
          scheduleCountsInvalidate(queryClient);
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
          scheduleCountsInvalidate(queryClient);
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
          scheduleCountsInvalidate(queryClient);
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
          scheduleCountsInvalidate(queryClient);
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
        if (status === "SUBSCRIBED") {
          // Channel (re)connected — run gap recovery if we were previously disconnected
          if (realtimeDisconnectedRef.current) {
            realtimeDisconnectedRef.current = false;
            // 1. Trigger a delta sync to catch any missed scan/subplate changes
            window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
            // 2. Invalidate subplates.all() to catch any missed subplate events
            queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
            // 3. Schedule counts invalidate
            scheduleCountsInvalidate(queryClient);
          }
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          realtimeDisconnectedRef.current = true;
        }
      });

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
