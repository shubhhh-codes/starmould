"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { Subplate, ScanProject, User } from "@/lib/supabase/types";
import { queryKeys } from "@/lib/query/keys";
import { updateLocalProjectsStore } from "@/lib/cache/projects-local-store";
import {
  emitSubplateChange,
  getCachedStreamUsers,
} from "@/lib/cache/projects-stream-store";
import { computeSubplateDerivedMetrics } from "@/lib/realtime/derived-metrics";
import { getSharedBroadcastChannel, TAB_ID } from "./tab-channel";

export type SubplateChangeKind = "upsert" | "remove";
export type SubplateChangeOrigin = "local" | "ws" | "bc";

export interface SubplateChange {
  kind: SubplateChangeKind;
  plate?: Partial<Subplate>;
  id?: number;
  origin: SubplateChangeOrigin;
}

// ─── User name resolution mapping ────────────────────────────────────────────

export const USER_NAME_FIELDS = [
  { idKey: "design_by", nameKey: "design_by_name" },
  { idKey: "order_by", nameKey: "order_by_name" },
  { idKey: "received_workby", nameKey: "received_workby_name" },
  { idKey: "received_qcby", nameKey: "received_qcby_name" },
  { idKey: "vmc_workby", nameKey: "vmc_workby_name" },
  { idKey: "vmc_qcby", nameKey: "vmc_qcby_name" },
  { idKey: "drilltap_workby", nameKey: "drilltap_workby_name" },
  { idKey: "final_qcby", nameKey: "final_qcby_name" },
  { idKey: "packing_workby", nameKey: "packing_workby_name" },
] as const;

/**
 * In-memory IDB users cache populated on hydration or local store loads.
 */
let idbCachedUsers: User[] = [];
export function setIdbCachedUsers(users: User[]): void {
  if (Array.isArray(users) && users.length > 0) {
    idbCachedUsers = users;
  }
}

/**
 * User lookup hierarchy for origin "ws":
 * 1. stream users (getCachedStreamUsers())
 * 2. .users inside any cached subplates.all() query data
 * 3. users.* queries in React Query
 * 4. IndexedDB StoredProjectsState.users (idbCachedUsers)
 */
function resolveUserMap(queryClient: QueryClient): Map<number, { name?: string | null; initials?: string | null }> {
  const userMap = new Map<number, { name?: string | null; initials?: string | null }>();

  // 1. Stream users
  const streamUsers = getCachedStreamUsers();
  for (const u of streamUsers) {
    if (u && u.id != null) userMap.set(Number(u.id), u);
  }

  // 2. .users inside any cached subplates queries
  const cachedSubplateQueries = queryClient.getQueriesData<any>({ queryKey: queryKeys.subplates.all() });
  for (const [, data] of cachedSubplateQueries) {
    if (data && Array.isArray(data.users)) {
      for (const u of data.users) {
        if (u && u.id != null && !userMap.has(Number(u.id))) {
          userMap.set(Number(u.id), u);
        }
      }
    }
  }

  // 3. users.* queries in React Query
  const cachedUserQueries = queryClient.getQueriesData<any>({ queryKey: queryKeys.users.all() });
  for (const [, data] of cachedUserQueries) {
    const list = Array.isArray(data) ? data : data?.users;
    if (Array.isArray(list)) {
      for (const u of list) {
        if (u && u.id != null && !userMap.has(Number(u.id))) {
          userMap.set(Number(u.id), u);
        }
      }
    }
  }

  // 4. IndexedDB cached users
  for (const u of idbCachedUsers) {
    if (u && u.id != null && !userMap.has(Number(u.id))) {
      userMap.set(Number(u.id), u);
    }
  }

  return userMap;
}

// ─── Debounces ───────────────────────────────────────────────────────────────

let countsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleCountsInvalidate(queryClient: QueryClient): void {
  if (countsDebounceTimer !== null) {
    clearTimeout(countsDebounceTimer);
  }
  countsDebounceTimer = setTimeout(() => {
    countsDebounceTimer = null;
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
  }, 150);
}

const targetedDebounces = new Map<number, ReturnType<typeof setTimeout>>();
export function scheduleTargetedProjectInvalidate(queryClient: QueryClient, scanKey: number): void {
  if (targetedDebounces.has(scanKey)) {
    clearTimeout(targetedDebounces.get(scanKey)!);
  }
  const timer = setTimeout(() => {
    targetedDebounces.delete(scanKey);
    queryClient.invalidateQueries({
      queryKey: queryKeys.subplates.byProject(scanKey),
    });
  }, 150);
  targetedDebounces.set(scanKey, timer);
}

let subplatesListDebounceTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSubplatesListInvalidate(queryClient: QueryClient): void {
  if (subplatesListDebounceTimer !== null) {
    clearTimeout(subplatesListDebounceTimer);
  }
  subplatesListDebounceTimer = setTimeout(() => {
    subplatesListDebounceTimer = null;
    queryClient.invalidateQueries({ queryKey: queryKeys.subplates.lists() });
  }, 1000);
}

// ─── Key matching helper ─────────────────────────────────────────────────────

/**
 * Derive the scan ID from a subplate row using the canonical linking key:
 *   plate.mold_id ?? Number(plate.projectid)
 * Returns null if missing or NaN.
 */
export function getScanIdFromPlate(plate: Partial<Subplate>): number | null {
  const raw = plate.mold_id != null ? plate.mold_id : plate.projectid != null ? Number(plate.projectid) : null;
  if (raw == null) return null;
  const num = Number(raw);
  if (isNaN(num) || num <= 0) return null;
  return num;
}

function isInHouse(location?: string | null): boolean {
  return location === "SM" || !location;
}

// ─── Pure apply function for progressive stream ─────────────────────────────

/**
 * Merge subplates with Requirement 4 name semantics:
 * If incoming id differs from cached id or is null, SET name to resolved name or null;
 * never keep the previous assignee's name.
 */
function mergePlateWithNames(
  cached: Subplate | undefined,
  incoming: Partial<Subplate>,
  userMap: Map<number, { name?: string | null; initials?: string | null }>,
  onUnresolved?: () => void
): Subplate {
  const merged: any = cached ? { ...cached, ...incoming } : { ...incoming };

  for (const { idKey, nameKey } of USER_NAME_FIELDS) {
    const hasIncomingId = idKey in incoming;
    const incomingId = (incoming as any)[idKey];
    const cachedId = cached ? (cached as any)[idKey] : undefined;

    if (hasIncomingId) {
      if (incomingId === null || incomingId === 0 || incomingId === "") {
        merged[idKey] = null;
        merged[nameKey] = null;
      } else if (cachedId === undefined || Number(incomingId) !== Number(cachedId)) {
        merged[idKey] = incomingId;
        const u = userMap.get(Number(incomingId));
        const resolved = (incoming as any)[nameKey] || u?.name || u?.initials || null;
        if (resolved) {
          merged[nameKey] = resolved;
        } else {
          merged[nameKey] = null;
          onUnresolved?.();
        }
      } else {
        // incomingId equals cachedId: preserve existing name unless incoming provides a non-empty name
        const incomingName = (incoming as any)[nameKey];
        if (incomingName) {
          merged[nameKey] = incomingName;
        } else if (cached && (cached as any)[nameKey]) {
          merged[nameKey] = (cached as any)[nameKey];
        }
      }
    } else if (cached && (cached as any)[nameKey]) {
      merged[nameKey] = (cached as any)[nameKey];
    }
  }

  return merged as Subplate;
}

export function applySubplateToScans(
  scans: ScanProject[],
  change: SubplateChange
): ScanProject[] {
  if (change.kind === "upsert") {
    const plate = change.plate;
    if (!plate || !plate.id) return scans;
    const scanId = getScanIdFromPlate(plate);
    if (scanId === null) return scans;

    const indexMap = new Map<number, number>();
    for (let i = 0; i < scans.length; i++) {
      indexMap.set(Number(scans[i].id), i);
    }

    const projectIdx = indexMap.get(scanId);
    if (projectIdx === undefined) return scans;

    const project = scans[projectIdx];
    const existingPlates: Subplate[] = project.subplates ?? [];
    const plateIdx = existingPlates.findIndex((p) => p.id === plate.id);

    let newPlates: Subplate[];
    if (plateIdx === -1) {
      newPlates = [...existingPlates, plate as Subplate];
    } else {
      const cached = existingPlates[plateIdx];
      // Requirement 3: Skip ONLY if cached row's updated_at is STRICTLY newer
      if (cached.updated_at && plate.updated_at) {
        const cachedTs = new Date(cached.updated_at).getTime();
        const incomingTs = new Date(plate.updated_at).getTime();
        if (cachedTs > incomingTs) return scans;
      }

      // Merge plate
      const emptyUserMap = new Map();
      const merged = mergePlateWithNames(cached, plate, emptyUserMap);
      newPlates = [...existingPlates];
      newPlates[plateIdx] = merged;
    }

    // Recompute derived project fields
    const derived = computeSubplateDerivedMetrics(newPlates);
    const newProject: ScanProject = {
      ...project,
      subplates: newPlates,
      ...derived,
    };

    const next = [...scans];
    next[projectIdx] = newProject;
    return next;
  }

  if (change.kind === "remove") {
    const plateId = change.id ?? change.plate?.id;
    if (!plateId) return scans;

    let changed = false;
    const next = scans.map((project) => {
      if (!project.subplates || project.subplates.length === 0) return project;
      const filtered = project.subplates.filter((p) => p.id !== plateId);
      if (filtered.length === project.subplates.length) return project;
      changed = true;

      const derived = computeSubplateDerivedMetrics(filtered);
      return {
        ...project,
        subplates: filtered,
        ...derived,
      };
    });

    return changed ? next : scans;
  }

  return scans;
}

// ─── Pure apply function for scan scalar updates ────────────────────────────

const SENSITIVE_SCAN_FIELDS: (keyof ScanProject)[] = [
  "cname",
  "scan_by",
  "qc_by",
  "modeldesign_by",
  "scan_hr",
  "model_hr",
  "sr_scanhr",
  "sr_modelhr",
  "status",
];

/**
 * Scan UPDATE (Requirement 8):
 * If ANY of cname, scan_by, qc_by, modeldesign_by, scan_hr, model_hr, sr_scanhr, sr_modelhr, status
 * differs from the cached project, do not merge locally; schedule one coalesced syncDelta instead.
 * Adds the same strictly-newer updated_at guard.
 */
export function applyScanUpdateToScans(
  scans: ScanProject[],
  rawScan: Partial<ScanProject>
): ScanProject[] {
  if (!rawScan || !rawScan.id) return scans;
  const scanId = Number(rawScan.id);
  const idx = scans.findIndex((s) => Number(s.id) === scanId);
  if (idx === -1) return scans;

  const existing = scans[idx];

  // Strictly newer updated_at guard
  if (existing.updated_at && rawScan.updated_at) {
    const cachedTs = new Date(existing.updated_at).getTime();
    const incomingTs = new Date(rawScan.updated_at).getTime();
    if (cachedTs > incomingTs) return scans;
  }

  // Check if any sensitive field changed
  const hasSensitiveChange = SENSITIVE_SCAN_FIELDS.some((field) => {
    return (rawScan as any)[field] !== undefined && (rawScan as any)[field] !== (existing as any)[field];
  });

  if (hasSensitiveChange) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
    }
    return scans;
  }

  // Merge pure scalars, keeping subplates & derived metrics untouched
  const merged: ScanProject = {
    ...existing,
    ...rawScan,
    subplates: existing.subplates,
    subplate_count: existing.subplate_count,
    total_plates: existing.total_plates,
    completed_plates: existing.completed_plates,
    completion_percentage: existing.completion_percentage,
    is_ready_for_dispatch: existing.is_ready_for_dispatch,
    customername: existing.customername,
    customer_initials: existing.customer_initials,
    scan_by_name: existing.scan_by_name,
    qc_by_name: existing.qc_by_name,
    modeldesign_by_name: existing.modeldesign_by_name,
    calc_scan_hr: existing.calc_scan_hr,
    calc_model_hr: existing.calc_model_hr,
  };

  const next = [...scans];
  next[idx] = merged;
  return next;
}

// ─── Ingestion Entry Point ───────────────────────────────────────────────────

/**
 * THE ONLY entry point for subplate changes.
 * Called by:
 * - Supabase Realtime WebSocket handler (origin: "ws")
 * - Cross-tab BroadcastChannel listener (origin: "bc")
 * - Client mutation onSuccess (origin: "local")
 */
export function ingestSubplateChange(
  queryClient: QueryClient,
  change: SubplateChange
): void {
  const { kind, plate, id, origin } = change;
  const effectiveId = id ?? plate?.id;
  const scanKey = plate ? getScanIdFromPlate(plate) : null;

  // Requirement 2: Cancel queries only where query.state.data !== undefined
  queryClient.cancelQueries({
    queryKey: queryKeys.subplates.all(),
    predicate: (query) => query.state.data !== undefined,
  });

  const userMap = resolveUserMap(queryClient);
  let hasUnresolvedUser = false;
  const onUnresolved = () => {
    hasUnresolvedUser = true;
  };

  let isStructuralChange = false;

  // Iterate all cached subplate queries
  const cachedQueries = queryClient.getQueryCache().findAll({
    queryKey: queryKeys.subplates.all(),
    predicate: (query) => query.state.data !== undefined,
  });

  for (const query of cachedQueries) {
    const qKey = query.queryKey;
    const oldData: any = query.state.data;
    if (!oldData) continue;

    const isByProject = qKey[1] === "by-project";
    const targetProjectParam = isByProject ? String(qKey[2]) : null;

    const isListQuery = qKey[1] === "list";
    const listParams = isListQuery && typeof qKey[2] === "object" ? (qKey[2] as any) : {};
    const hasFilter = Boolean(
      listParams.search ||
      (listParams.material && listParams.material !== "ALL") ||
      (listParams.location && listParams.location !== "ALL")
    );
    const listProjectFilter = listParams.projectid && listParams.projectid !== "ALL" ? String(listParams.projectid) : null;

    queryClient.setQueryData(qKey, (current: any) => {
      if (!current) return current;

      const getList = (): Subplate[] | null => {
        if (Array.isArray(current)) return current;
        if (Array.isArray(current.subplates)) return current.subplates;
        if (Array.isArray(current.data)) return current.data;
        return null;
      };

      const setList = (newList: Subplate[], kpisModifier?: (k: any) => any): any => {
        if (Array.isArray(current)) return newList;
        const res = { ...current };
        if (Array.isArray(current.subplates)) res.subplates = newList;
        if (Array.isArray(current.data)) res.data = newList;
        if (res.kpis && kpisModifier) {
          res.kpis = kpisModifier(res.kpis);
        }
        return res;
      };

      const list = getList();
      if (!list) return current;

      if (kind === "upsert" && plate && plate.id) {
        const idx = list.findIndex((p) => p.id === plate.id);

        if (idx === -1) {
          // INSERT SCOPE (Requirement 3):
          // INSERT must go ONLY into:
          // (a) subplates.byProject(scanKey) if cached
          // (b) list queries whose key params are unfiltered or whose projectid equals scanKey
          let canInsert = false;
          if (isByProject) {
            canInsert = scanKey !== null && targetProjectParam === String(scanKey);
          } else if (isListQuery) {
            if (!hasFilter) {
              if (listProjectFilter === null || (scanKey !== null && listProjectFilter === String(scanKey))) {
                canInsert = true;
              }
            }
          } else {
            // Raw unfiltered subplates query
            canInsert = true;
          }

          if (!canInsert) return current;

          isStructuralChange = true;
          const mergedNew = mergePlateWithNames(undefined, plate, userMap, onUnresolved);
          const nextList = [mergedNew, ...list];

          // Requirement 9: Adjust KPIs on INSERT
          return setList(nextList, (kpis) => ({
            ...kpis,
            totalCount: (kpis.totalCount ?? list.length) + 1,
            inHouseCount: (kpis.inHouseCount ?? 0) + (isInHouse(plate.location) ? 1 : 0),
            vendorCount: (kpis.vendorCount ?? 0) + (isInHouse(plate.location) ? 0 : 1),
          }));
        }

        // UPDATE SCOPE:
        // May patch a matching id in every cached subplates.* query
        const cached = list[idx];
        if (cached.updated_at && plate.updated_at) {
          const cachedTs = new Date(cached.updated_at).getTime();
          const incomingTs = new Date(plate.updated_at).getTime();
          if (cachedTs > incomingTs) return current; // strictly newer: skip
        }

        // Check if location changed
        const locChanged = plate.location !== undefined && plate.location !== cached.location;
        if (locChanged) isStructuralChange = true;

        const merged = mergePlateWithNames(cached, plate, userMap, onUnresolved);
        const nextList = [...list];
        nextList[idx] = merged;

        if (locChanged) {
          return setList(nextList, (kpis) => {
            const wasInHouse = isInHouse(cached.location);
            const nowInHouse = isInHouse(plate.location);
            if (wasInHouse === nowInHouse) return kpis;
            return {
              ...kpis,
              inHouseCount: Math.max(0, (kpis.inHouseCount ?? 0) + (nowInHouse ? 1 : -1)),
              vendorCount: Math.max(0, (kpis.vendorCount ?? 0) + (nowInHouse ? -1 : 1)),
            };
          });
        }

        return setList(nextList);
      }

      if (kind === "remove" && effectiveId) {
        // Requirement 5: Derive scanKey from plate and remove from subplates.byProject(scanKey).
        // If no scanKey derived, remove id from every cached by-project query.
        if (isByProject && scanKey !== null && targetProjectParam !== String(scanKey)) {
          return current;
        }

        const idx = list.findIndex((p) => p.id === effectiveId);
        if (idx === -1) return current;

        isStructuralChange = true;
        const deletedPlate = list[idx];
        const nextList = list.filter((p) => p.id !== effectiveId);

        // Requirement 9: Adjust KPIs on DELETE
        return setList(nextList, (kpis) => ({
          ...kpis,
          totalCount: Math.max(0, (kpis.totalCount ?? list.length) - 1),
          inHouseCount: Math.max(0, (kpis.inHouseCount ?? 0) - (isInHouse(deletedPlate.location) ? 1 : 0)),
          vendorCount: Math.max(0, (kpis.vendorCount ?? 0) - (isInHouse(deletedPlate.location) ? 0 : 1)),
        }));
      }

      return current;
    });
  }

  // Requirement 4: If an id was non-null and unresolved, schedule ONE targeted invalidate
  if (hasUnresolvedUser && scanKey !== null) {
    scheduleTargetedProjectInvalidate(queryClient, scanKey);
  }

  // Requirement 9: On structural events (INSERT / DELETE / location change), schedule 1s trailing debounce
  if (isStructuralChange) {
    scheduleSubplatesListInvalidate(queryClient);
  }

  // Requirement 6: Null scan key
  // Still patched the React Query caches above by plate id.
  // If scanKey is null, skip only stream/IndexedDB patch and schedule coalesced scan-changed.
  if (kind === "upsert" && scanKey === null) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("starmould:scan-changed"));
      scheduleCountsInvalidate(queryClient);
    }
    return;
  }

  // Progressive stream & IndexedDB patches
  const effectiveChange: SubplateChange = {
    kind,
    plate,
    id: effectiveId,
    origin,
  };

  emitSubplateChange(effectiveChange);
  updateLocalProjectsStore((scans) => applySubplateToScans(scans, effectiveChange));
  scheduleCountsInvalidate(queryClient);

  // Requirement 7: BroadcastChannel using shared singleton and TAB_ID
  if (origin === "local") {
    try {
      const bc = getSharedBroadcastChannel();
      bc?.postMessage({
        type: "SUBPLATE_CHANGE",
        tabId: TAB_ID,
        kind,
        plate,
        id: effectiveId,
      });
    } catch {
      // Non-blocking
    }
  }
}
