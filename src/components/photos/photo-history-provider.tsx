"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { principalFetch } from "@/lib/query/principal-fetch";
import { browserPrincipal, principalIsCurrent } from "@/lib/cache/principal";
import { photoHistoryKey, type PhotoHistoryScope, type PhotoHistorySummary } from "@/lib/photos/history-types";
import { queryKeys } from "@/lib/query/keys";
import { PhotoHistoryDialog } from "./photo-history-dialog";

interface SummaryResult { summaries: { key: string; summary: PhotoHistorySummary }[]; denied: string[] }
const Context = createContext<{
  register: (scope: PhotoHistoryScope) => () => void;
  open: (scope: PhotoHistoryScope) => void;
  summaries: Map<string, PhotoHistorySummary>;
  denied: Set<string>;
  error: boolean;
} | null>(null);
export function usePhotoHistory() { return useContext(Context); }

export function PhotoHistoryProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const principal = browserPrincipal();
  const queryClient = useQueryClient();
  const registry = useRef(new Map<string, { scope: PhotoHistoryScope; count: number }>());
  const [revision, setRevision] = useState(0);
  const [scopes, setScopes] = useState<PhotoHistoryScope[]>([]);
  const [selected, setSelected] = useState<PhotoHistoryScope | null>(null);
  const [overrides, setOverrides] = useState(new Map<string, PhotoHistorySummary>());
  const register = useCallback((scope: PhotoHistoryScope) => {
    const key = photoHistoryKey(scope);
    const old = registry.current.get(key);
    registry.current.set(key, { scope, count: (old?.count || 0) + 1 });
    setRevision(v => v + 1);
    return () => {
      const entry = registry.current.get(key);
      if (entry && entry.count > 1) entry.count--; else registry.current.delete(key);
      setRevision(v => v + 1);
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setScopes([...registry.current.values()].map(v => v.scope).sort((a, b) => photoHistoryKey(a).localeCompare(photoHistoryKey(b)))), 60);
    return () => clearTimeout(timer);
  }, [revision]);
  const query = useQuery({
    queryKey: queryKeys.photoHistory.summary(principal.key, scopes.map(photoHistoryKey)),
    enabled: !!currentUser && !!principal.key && scopes.length > 0,
    staleTime: 0, gcTime: 30000, retry: 1, meta: { persist: false },
    queryFn: async ({ signal }): Promise<SummaryResult> => {
      const result: SummaryResult = { summaries: [], denied: [] };
      for (let start = 0; start < scopes.length; start += 100) {
        const response = await principalFetch("/api/photos/history/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scopes: scopes.slice(start, start + 100) }), signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Photo counts unavailable");
        if (!principalIsCurrent(principal)) throw new DOMException("Session changed", "AbortError");
        result.summaries.push(...data.summaries); result.denied.push(...data.denied);
      }
      return result;
    },
  });
  useEffect(() => { setOverrides(new Map()); }, [query.dataUpdatedAt]);
  useEffect(() => {
    const refresh = () => { setOverrides(new Map()); void queryClient.invalidateQueries({ queryKey: queryKeys.photoHistory.all() }); };
    window.addEventListener("starmould:photo-history-changed", refresh);
    return () => window.removeEventListener("starmould:photo-history-changed", refresh);
  }, [queryClient]);
  const summaries = useMemo(() => new Map([...(query.data?.summaries || []).map(v => [v.key, v.summary] as const), ...overrides]), [query.data, overrides]);
  return <Context.Provider value={{ register, open: setSelected, summaries, denied: new Set(query.data?.denied || []), error: query.isError }}>
    {children}
    {selected && <PhotoHistoryDialog key={photoHistoryKey(selected)} scope={selected} onClose={() => setSelected(null)} onSummary={page => setOverrides(previous => new Map(previous).set(photoHistoryKey(selected), page.summary))} />}
  </Context.Provider>;
}
