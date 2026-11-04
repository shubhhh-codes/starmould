"use client";

import type { SubplateChange } from "@/lib/realtime/subplate-sync";
import type { ScanProject, User } from "@/lib/supabase/types";

type SubplateListener = (change: SubplateChange) => void;
type ScanListener = (rawScan: Partial<ScanProject>) => void;

const subplateListeners = new Set<SubplateListener>();
const scanListeners = new Set<ScanListener>();
let cachedUsers: User[] = [];

// ─── Subplate change stream ──────────────────────────────────────────────────

export function subscribeSubplateChanges(fn: SubplateListener): () => void {
  subplateListeners.add(fn);
  return () => subplateListeners.delete(fn);
}

export function emitSubplateChange(change: SubplateChange): void {
  for (const fn of subplateListeners) {
    try {
      fn(change);
    } catch {
      // Silently ignore listener errors
    }
  }
}

// ─── Scan scalar update stream ───────────────────────────────────────────────

export function subscribeScanUpdates(fn: ScanListener): () => void {
  scanListeners.add(fn);
  return () => scanListeners.delete(fn);
}

export function emitScanUpdate(rawScan: Partial<ScanProject>): void {
  for (const fn of scanListeners) {
    try {
      fn(rawScan);
    } catch {
      // Silently ignore listener errors
    }
  }
}

// ─── Cached users registry for instant client-side enrichment ───────────────

export function setCachedStreamUsers(users: User[]): void {
  if (Array.isArray(users) && users.length > 0) {
    cachedUsers = users;
  }
}

export function getCachedStreamUsers(): User[] {
  return cachedUsers;
}

export function clearStreamState() {
  cachedUsers = [];
}
