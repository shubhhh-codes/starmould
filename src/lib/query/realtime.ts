"use client";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { browserPrincipal, onPrincipalChange, principalIsCurrent } from "@/lib/cache/principal";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query/keys";
import {
  ingestSubplateChange,
  scheduleCountsInvalidate,
} from "@/lib/realtime/subplate-sync";
import { getSharedBroadcastChannel, TAB_ID } from "@/lib/realtime/tab-channel";

/**
 * Broadcast an invalidation event across all open browser tabs/windows on the same device
 */
export function broadcastQueryInvalidation(queryKey: readonly unknown[]) {
  if (typeof window === "undefined") return;
  try {
    const bc = getSharedBroadcastChannel();
    bc?.postMessage({ type: "INVALIDATE", tabId: TAB_ID, queryKey });
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
    bc?.postMessage({ type: "PROJECT_DELETED", tabId: TAB_ID, id: ids[0], ids });
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
    bc?.postMessage({ type: "SCAN_CHANGED", tabId: TAB_ID });
  } catch {
    // Non-blocking fallback
  }
}

async function fetchRealtimeToken(signal?: AbortSignal): Promise<string | null> {
  const res = await fetch("/api/realtime/token", { signal });
  if (res.status === 401) {
    // Unauthenticated / expired session: cleanly return null without retrying
    return null;
  }
  if (!res.ok) {
    throw new Error(`Realtime token request failed with HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.token || null;
}

/**
 * useRealtimeManufacturingSync
 *
 * Establishes:
 * 1. Cross-tab synchronization via BroadcastChannel (instant zero-network tab sync)
 * 2. Authenticated, read-only Supabase Realtime WebSocket subscriptions scoped to role `app_realtime`:
 *    - scan (Mould Projects)
 *    - subplate (Subplate Master)
 *    - purchase & po_inward (Purchase Orders & Inward Gate Receipts)
 *    - challan (Job Work Outward Movement)
 *    - dispatch (Customer Shipments)
 *    - app_config (Dynamic Role Permissions)
 */
export function useRealtimeManufacturingSync(options?: { isAuthenticated?: boolean }) {
  const generation = useSyncExternalStore(onPrincipalChange, () => browserPrincipal().generation, () => 0);
  const queryClient = useQueryClient();
  const realtimeDisconnectedRef = useRef(false);
  const isAuthenticated = options?.isAuthenticated ?? true;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;
    const principal = browserPrincipal();
    if (!principal.key) return;

    let isMounted = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // 1. Cross-tab synchronization via BroadcastChannel
    const bc = getSharedBroadcastChannel();
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (!principalIsCurrent(principal)) return;
      if (event.data?.tabId === TAB_ID) return;

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
        const { kind, plate, id } = event.data;
        ingestSubplateChange(queryClient, { kind, plate, id, origin: "bc" });
      }
    };

    if (bc) {
      bc.addEventListener("message", handleBroadcastMessage);
    }

    // Gap recovery on tab visibility (>30s hidden) + Realtime token refresh
    let hiddenAt: number | null = null;
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null) {
        const elapsedMs = Date.now() - hiddenAt;
        hiddenAt = null;

        // Re-authenticate Realtime with fresh token on visibility return
        try {
          const freshToken = await fetchRealtimeToken();
          if (freshToken && isMounted) {
            await supabase.realtime.setAuth(freshToken);
          }
        } catch (err: any) {
          console.warn("[RealtimeSync] Visibility return token refresh failed:", err?.message || err);
        }

        if (elapsedMs > 30000) {
          window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          scheduleCountsInvalidate(queryClient);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 2. Authenticated Realtime Connection Setup
    const setupRealtime = async (attempt = 1) => {
      try {
        const token = await fetchRealtimeToken();
        if (!isMounted || !token) return;

        // Set authenticated read-only JWT on Supabase Realtime client
        await supabase.realtime.setAuth(token);
        if (!isMounted) return;

        // Schedule proactive token refresh at ~50 minutes (token valid for 60m)
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(async () => {
          try {
            const nextToken = await fetchRealtimeToken();
            if (nextToken && isMounted) {
              await supabase.realtime.setAuth(nextToken);
            }
          } catch (e: any) {
            console.warn("[RealtimeSync] Proactive token refresh failed:", e?.message || e);
          }
        }, 50 * 60 * 1000);

        // Subscribe to Realtime channel ONLY after setAuth succeeds
        if (!channel) {
          channel = supabase
            .channel("module-invalidation-sync")
            .on("postgres_changes", { event: "*", schema: "public", table: "module_invalidations" }, (payload) => {
              if (!principalIsCurrent(principal)) return;
              if ((payload.new as { module?: string }).module === "app_config") window.dispatchEvent(new Event("starmould:permissions-changed"));
              // Markers contain no records. Every refreshed response is authorized by its API.
              queryClient.invalidateQueries();
              window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
              scheduleCountsInvalidate(queryClient);
            })
            .subscribe((status, err) => {
              if (err) {
                console.warn("[RealtimeSync] Channel status notification:", status, err?.message || err);
              }
              if (status === "SUBSCRIBED") {
                if (realtimeDisconnectedRef.current) {
                  realtimeDisconnectedRef.current = false;
                  window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
                  queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
                  scheduleCountsInvalidate(queryClient);
                }
              } else if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
              ) {
                realtimeDisconnectedRef.current = true;
                if (channel) {
                  supabase.removeChannel(channel).catch(() => {});
                  channel = null;
                }
                if (isMounted && !retryTimer) {
                  retryTimer = setTimeout(() => {
                    retryTimer = null;
                    setupRealtime(1);
                  }, 3000);
                }
              }
            });
        }
      } catch (err: any) {
        console.warn(`[RealtimeSync] Realtime token attempt ${attempt} failed:`, err?.message || err);
        // Exponential backoff: 1s, 2s, 4s, up to 30s
        const backoff = Math.min(30000, 1000 * Math.pow(2, attempt - 1));
        if (isMounted) {
          retryTimer = setTimeout(() => setupRealtime(attempt + 1), backoff);
        }
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (bc) {
        bc.removeEventListener("message", handleBroadcastMessage);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient, isAuthenticated, generation]);
}

/**
 * RealtimeSyncListener
 * Headless component to mount the realtime sync hook inside QueryClientProvider context.
 */
export function RealtimeSyncListener({ isAuthenticated = true }: { isAuthenticated?: boolean }) {
  useRealtimeManufacturingSync({ isAuthenticated });
  return null;
}
