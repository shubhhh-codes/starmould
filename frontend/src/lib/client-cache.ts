"use client";

// Client-side in-memory and sessionStorage lookup cache with TTL
const inMemoryCache = new Map<string, { data: any; expiresAt: number }>();

export async function fetchWithClientCache<T>(
  url: string,
  ttlSeconds: number = 120
): Promise<T> {
  const now = Date.now();

  // 1. Check in-memory map
  const mem = inMemoryCache.get(url);
  if (mem && mem.expiresAt > now) {
    return mem.data as T;
  }

  // 2. Check sessionStorage if available
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(`cache_${url}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt > now) {
          inMemoryCache.set(url, parsed);
          return parsed.data as T;
        }
      }
    } catch {
      // sessionStorage parse failure, proceed to fetch
    }
  }

  // 3. Fetch fresh data
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch from ${url}`);
  }
  const data = (await res.json()) as T;

  const entry = { data, expiresAt: now + ttlSeconds * 1000 };
  inMemoryCache.set(url, entry);

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(`cache_${url}`, JSON.stringify(entry));
    } catch {
      // Ignore quota exceeded errors
    }
  }

  return data;
}

export function invalidateClientCache(urlPrefix?: string): void {
  inMemoryCache.clear();
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      if (!urlPrefix) {
        Object.keys(window.sessionStorage).forEach((key) => {
          if (key.startsWith("cache_")) {
            window.sessionStorage.removeItem(key);
          }
        });
      } else {
        Object.keys(window.sessionStorage).forEach((key) => {
          if (key.startsWith(`cache_${urlPrefix}`)) {
            window.sessionStorage.removeItem(key);
          }
        });
      }
    } catch {
      // Ignore
    }
  }
}
