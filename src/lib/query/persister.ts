"use client";

import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

export const CACHE_STORAGE_KEY_PREFIX = "STARMOULD_CACHE_V3";

/**
 * Creates an asynchronous, non-blocking IndexedDB persister for TanStack Query.
 * Stores native JS objects in IndexedDB via idb-keyval without main-thread
 * JSON.stringify or LZ-String compression bottlenecks, scoped by user identity.
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
        return await get<PersistedClient>(idbKey);
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
