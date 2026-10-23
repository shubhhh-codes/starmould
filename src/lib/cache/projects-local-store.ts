"use client";

import { get, set, del } from "idb-keyval";
import type { ScanProject, Customer, User } from "@/lib/supabase/types";

export const LOCAL_PROJECTS_KEY = "STARMOULD_PROJECTS_STORE_V4";

// Purge any legacy stores on initial script evaluation
if (typeof window !== "undefined") {
  try {
    del("STARMOULD_PROJECTS_STORE_V1").catch(() => {});
    del("STARMOULD_PROJECTS_STORE_V2").catch(() => {});
    del("STARMOULD_PROJECTS_STORE_V3").catch(() => {});
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
    await del(LOCAL_PROJECTS_KEY);
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
    const data = await get<StoredProjectsState>(LOCAL_PROJECTS_KEY);
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
 * Persist the current projects state into IndexedDB asynchronously.
 */
export async function saveLocalProjectsStore(state: StoredProjectsState): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await set(LOCAL_PROJECTS_KEY, state);
  } catch (err) {
    console.warn("[LocalStore] Failed to save projects cache:", err);
  }
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
