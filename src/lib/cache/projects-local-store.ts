"use client";

import { get, set, del } from "idb-keyval";
import { browserPrincipal, principalIsCurrent } from "./principal";
import type { ScanProject, Customer, User } from "@/lib/supabase/types";

export const LOCAL_PROJECTS_KEY = "STARMOULD_PROJECTS_STORE_V6";

// Purge any legacy stores on initial script evaluation
if (typeof window !== "undefined") {
  try {
    del("STARMOULD_PROJECTS_STORE_V1").catch(() => {});
    del("STARMOULD_PROJECTS_STORE_V2").catch(() => {});
    del("STARMOULD_PROJECTS_STORE_V3").catch(() => {});
    del("STARMOULD_PROJECTS_STORE_V4").catch(() => {});
    del("STARMOULD_PROJECTS_STORE_V5").catch(() => {});
    del(LOCAL_PROJECTS_KEY).catch(() => {});
    del("STARMOULD_CACHE_V6_default").catch(() => {});
    del("STARMOULD_CACHE_V6_anon").catch(() => {});
  } catch {
    // Non-blocking cleanup
  }
}

export interface StoredProjectsState {
  scans: ScanProject[];
  lastSyncTime: string;
  customers: Customer[];
  users: User[];
  kpis: Record<string, any>;
  totalCount: number;
  isInitialComplete: boolean;
}

/**
 * Clear the local projects cache from IndexedDB (for cold-start testing).
 */
export async function clearLocalProjectsStore(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const principal = browserPrincipal();
    if (principal.key) await del(`${LOCAL_PROJECTS_KEY}:${principal.key}`);
    await del(LOCAL_PROJECTS_KEY);
    await del("STARMOULD_PROJECTS_STORE_V5");
    await del("STARMOULD_PROJECTS_STORE_V4");
    await del("STARMOULD_PROJECTS_STORE_V3");
    await del("STARMOULD_PROJECTS_STORE_V2");
    await del("STARMOULD_PROJECTS_STORE_V1");
  } catch (err) {
    console.warn("[LocalStore] Failed to clear projects store:", err);
  }
}

// Expose on window object for 1-click console testing: `window.clearMouldCache()`
if (typeof window !== "undefined") {
  (window as any).clearMouldCache = clearLocalProjectsStore;
}

/**
 * Load the cached project store directly from IndexedDB in 0ms.
 */
export async function loadLocalProjectsStore(): Promise<StoredProjectsState | null> {
  if (typeof window === "undefined") return null;
  try {
    const principal = browserPrincipal();
    if (!principal.key) return null;
    const data = await get<StoredProjectsState>(`${LOCAL_PROJECTS_KEY}:${principal.key}`);
    if (!principalIsCurrent(principal)) return null;
    if (data && Array.isArray(data.scans)) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn("[LocalStore] Failed to read cached projects:", err);
    return null;
  }
}

/**
 * Serialized write mutex and debounce queue for IndexedDB.
 * Guarantees that parallel asynchronous writes never race or overwrite newer snapshots with stale ones.
 */
let writeQueuePromise: Promise<void> = Promise.resolve();
let pendingStateToSave: StoredProjectsState | null = null;
let writeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingResolvers: (() => void)[] = [];

export function saveLocalProjectsStore(state: StoredProjectsState, principal: ReturnType<typeof browserPrincipal>): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (!principalIsCurrent(principal)) return Promise.resolve();
  pendingStateToSave = state;

  return new Promise<void>((resolve) => {
    pendingResolvers.push(resolve);

    if (writeDebounceTimer) {
      clearTimeout(writeDebounceTimer);
    }

    writeDebounceTimer = setTimeout(() => {
      writeDebounceTimer = null;
      const resolvers = pendingResolvers;
      pendingResolvers = [];

      writeQueuePromise = writeQueuePromise
        .then(async () => {
          if (!pendingStateToSave || !principalIsCurrent(principal)) return;
          const snapshot = pendingStateToSave;
          pendingStateToSave = null;
          const key = `${LOCAL_PROJECTS_KEY}:${principal.key}`;
          await set(key, snapshot);
          if (!principalIsCurrent(principal)) await del(key);
        })
        .then(() => {
          for (const res of resolvers) {
            try {
              res();
            } catch {}
          }
        })
        .catch((err) => {
          console.warn("[LocalStore] Failed to save projects cache:", err);
          for (const res of resolvers) {
            try {
              res();
            } catch {}
          }
        });
    }, 40);
  });
}

/**
 * Atomically mutate the cached scan list via the existing write queue.
 * Never does an unserialized load-then-save. Safe for concurrent callers.
 */
export function updateLocalProjectsStore(
  mutator: (scans: ScanProject[]) => ScanProject[]
): void {
  if (typeof window === "undefined") return;
  const principal = browserPrincipal();
  if (!principal.key) return;
  // Chain onto the existing write queue so reads and writes never race
  writeQueuePromise = writeQueuePromise.then(async () => {
    try {
      if (!principalIsCurrent(principal)) return;
      const key = `${LOCAL_PROJECTS_KEY}:${principal.key}`;
      const stored = await get<StoredProjectsState>(key);
      if (!principalIsCurrent(principal)) return;
      if (!stored || !Array.isArray(stored.scans)) return;
      const next = mutator(stored.scans);
      if (next === stored.scans) return; // nothing changed, skip write
      await set(key, { ...stored, scans: next });
      if (!principalIsCurrent(principal)) await del(key);
    } catch (err) {
      console.warn("[LocalStore] updateLocalProjectsStore failed:", err);
    }
  });
}

/**
 * Merge delta scans into an existing array of ScanProjects:
 * 1. Existing modified entries are updated in-place.
 * 2. Brand new entries are prepended at the top.
 * 3. All other cached records are 100% preserved without re-renders.
 */
export function mergeDeltaScans(
  current: ScanProject[],
  delta: ScanProject[]
): { merged: ScanProject[]; addedCount: number; updatedCount: number } {
  if (!delta || delta.length === 0) {
    return { merged: current, addedCount: 0, updatedCount: 0 };
  }

  const deltaMap = new Map<number | string, ScanProject>();
  for (const s of delta) {
    deltaMap.set(s.id, s);
  }

  let updatedCount = 0;
  const updatedExisting = current.map((item) => {
    if (deltaMap.has(item.id)) {
      const updated = deltaMap.get(item.id)!;
      deltaMap.delete(item.id);
      updatedCount++;
      return updated;
    }
    return item;
  });

  // Any remaining items in deltaMap are brand new records
  const brandNew = Array.from(deltaMap.values());
  const addedCount = brandNew.length;

  return {
    merged: [...brandNew, ...updatedExisting],
    addedCount,
    updatedCount,
  };
}
