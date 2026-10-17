"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { removeOldestQuery } from "@tanstack/react-query-persist-client";
import LZString from "lz-string";

export const CACHE_STORAGE_KEY = "STARMOULD_PERSISTED_QUERY_CACHE_V2";

/**
 * Creates a synchronous, compressed localStorage persister for TanStack Query.
 * Compresses data using LZ-String to reduce footprint by 70-85%, preventing
 * browser quota overflow while enabling instant 0ms rehydration on repeat visits.
 */
export function createCompressedPersister() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return createSyncStoragePersister({
      storage: window.localStorage,
      key: CACHE_STORAGE_KEY,
      throttleTime: 1200,
      serialize: (persistedClient) => {
        try {
          const json = JSON.stringify(persistedClient);
          return LZString.compressToUTF16(json);
        } catch (err) {
          console.warn("[Persister] Compression error, falling back:", err);
          return "";
        }
      },
      deserialize: (cachedString) => {
        if (!cachedString) return undefined as any;
        try {
          // Attempt LZ decompression
          const decompressed = LZString.decompressFromUTF16(cachedString);
          if (decompressed) {
            return JSON.parse(decompressed);
          }
          // Fallback if previously saved as raw uncompressed JSON
          return JSON.parse(cachedString);
        } catch (err) {
          console.warn("[Persister] Deserialization error, resetting cache key:", err);
          try {
            window.localStorage.removeItem(CACHE_STORAGE_KEY);
          } catch {
            // Ignore
          }
          return undefined as any;
        }
      },
      retry: removeOldestQuery,
    });
  } catch (err) {
    console.warn("[Persister] Failed to initialize persister:", err);
    return null;
  }
}
