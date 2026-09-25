import { supabaseAdmin } from "@/lib/supabase/admin";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// In-memory cache for server-side route handlers with bounded size and in-flight promise coalescing
const MAX_CACHE_ENTRIES = 500;
const cache = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  // If a request for this key is already in-flight, reuse its promise (stampede protection)
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key) as Promise<T>;
  }

  const promise = (async () => {
    try {
      const fresh = await fetcher();
      // Evict oldest entries if cache reaches maximum limit
      if (cache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(key, {
        data: fresh,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return fresh;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    cache.clear();
    inFlightPromises.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(keyPrefix)) {
      cache.delete(k);
    }
  }
}

export const invalidateCachePrefix = invalidateCache;

// Shared Cached Fetchers for High-Frequency Static Reference Tables

export async function getCachedCustomers(): Promise<any[]> {
  return getCached("shared_customers", 60, async () => {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("id, customername, initials, usertype")
      .is("deleted_at", null);
    return data || [];
  });
}

export async function getCachedUsers(): Promise<any[]> {
  return getCached("shared_users", 60, async () => {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, name, username, initials, status, role_id")
      .is("deleted_at", null);
    return data || [];
  });
}

export async function getCachedScansLookup(): Promise<any[]> {
  return getCached("shared_scans_lookup", 30, async () => {
    const { data } = await supabaseAdmin
      .from("scan")
      .select("id, projectid, description, worktype, cname, status")
      .order("id", { ascending: false })
      .limit(1000);
    return data || [];
  });
}
