"use client";

import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

export const CACHE_STORAGE_KEY_PREFIX = "STARMOULD_CACHE_V6";

// Purge any legacy V3, V4, or V5 cache keys on initial script evaluation
if (typeof window !== "undefined") {
  try {
    del("STARMOULD_CACHE_V3_default").catch(() => {});
    del("STARMOULD_CACHE_V3_anon").catch(() => {});
    del("STARMOULD_CACHE_V4_default").catch(() => {});
    del("STARMOULD_CACHE_V4_anon").catch(() => {});
    del("STARMOULD_CACHE_V5_default").catch(() => {});
    del("STARMOULD_CACHE_V5_anon").catch(() => {});
  } catch {
    // Non-blocking cleanup
  }
}

/**
 * Creates an asynchronous, non-blocking IndexedDB persister for TanStack Query.
 * Stores native JS objects in IndexedDB via idb-keyval without main-thread
 * JSON.stringify bottlenecks, scoped by user identity.
 *
 * Enables 0ms warm-cache rendering on page load & tab switches with background SWR sync.
 */
export function createIDBPersister(userKeySuffix: string = "default"): Persister | null {
  if (typeof window === "undefined") {
    return null;
  }

  const idbKey = `${CACHE_STORAGE_KEY_PREFIX}_${userKeySuffix}`;

  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(idbKey, client);
      } catch (err) {
        console.warn("[IDBPersister] Failed to persist cache:", err);
      }
    },
    restoreClient: async () => {
      try {
        const client = await get<PersistedClient>(idbKey);
        if (!client || !client.clientState?.queries) return client;

        // Exclude only transient query keys from restoration (e.g. preview-id, transient search)
        const excludedKeys = new Set(["preview-id"]);

        client.clientState.queries = client.clientState.queries.filter((q) => {
          const key1 = String(q.queryKey?.[1] || "");
          return !excludedKeys.has(key1);
        });

        return client;
      } catch (err) {
        console.warn("[IDBPersister] Failed to restore cache:", err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del(idbKey);
      } catch (err) {
        console.warn("[IDBPersister] Failed to remove cache:", err);
      }
    },
  };
}
