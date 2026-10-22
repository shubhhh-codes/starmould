"use client";

import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

export const CACHE_STORAGE_KEY_PREFIX = "STARMOULD_CACHE_V5";

// Purge any legacy V3 or V4 cache keys on initial script evaluation
if (typeof window !== "undefined") {
  try {
    del("STARMOULD_CACHE_V3_default").catch(() => {});
    del("STARMOULD_CACHE_V3_anon").catch(() => {});
    del("STARMOULD_CACHE_V3_2_2").catch(() => {});
    del("STARMOULD_CACHE_V3_2_0").catch(() => {});
    del("STARMOULD_CACHE_V4_default").catch(() => {});
    del("STARMOULD_CACHE_V4_anon").catch(() => {});
    del("STARMOULD_CACHE_V4_2_2").catch(() => {});
    del("STARMOULD_CACHE_V4_2_0").catch(() => {});
  } catch {
    // Non-blocking cleanup
  }
}

/**
 * Creates an asynchronous, non-blocking IndexedDB persister for TanStack Query.
 * Stores native JS objects in IndexedDB via idb-keyval without main-thread
 * JSON.stringify or LZ-String compression bottlenecks, scoped by user identity.
 *
 * NOTE: Live operational data (projects, subplates, etc.) is strictly prevented
 * from ever being restored from IndexedDB to guarantee fresh DB state on refresh.
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

        // Strictly purge any operational manufacturing queries from being restored
        const excludedPrefixes = [
          "projects",
          "subplates",
          "dashboard",
          "worklogs",
          "challans",
          "dispatch",
          "inward",
          "purchases",
          "expenses",
          "search",
          "counts",
        ];

        client.clientState.queries = client.clientState.queries.filter((q) => {
          const key0 = String(q.queryKey?.[0] || "");
          return !excludedPrefixes.includes(key0);
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
