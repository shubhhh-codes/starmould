"use client";
import { browserPrincipal, onPrincipalChange } from "@/lib/cache/principal";

export const TAB_CHANNEL_NAME = "starmould_tabs_sync";

/**
 * Unique ID per browser tab session.
 * Attached to all cross-tab messages to ignore self-echoes.
 */
export const TAB_ID: string =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let sharedBc: BroadcastChannel | null = null;
let channelPrincipal: string | null = null;
onPrincipalChange(() => {
  sharedBc?.close();
  sharedBc = null;
  channelPrincipal = null;
});

/**
 * Singleton BroadcastChannel instance shared across the entire tab.
 */
export function getSharedBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  const { key } = browserPrincipal();
  if (channelPrincipal !== key) {
    sharedBc?.close();
    sharedBc = null;
    channelPrincipal = key;
  }
  if (!key) return null;
  if (!sharedBc) {
    try {
      sharedBc = new BroadcastChannel(`${TAB_CHANNEL_NAME}:${key}`);
    } catch {
      return null;
    }
  }
  return sharedBc;
}
