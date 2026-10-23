"use client";

import React, { useState, useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createQueryClient } from "@/lib/query/client";
import { createIDBPersister } from "@/lib/query/persister";
import { getCachedSession } from "@/components/providers/auth-provider";
import { RealtimeSyncListener } from "@/lib/query/realtime";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  const persister = useMemo(() => {
    if (typeof window === "undefined") return null;
    const session = getCachedSession();
    const userSuffix = session?.id ? `${session.id}_${session.role_id ?? 0}` : "anon";
    return createIDBPersister(userSuffix);
  }, []);

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        <RealtimeSyncListener />
        {children}
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: "v7.0.0_purge_stale_projects",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key0 = String(query.queryKey[0] || "");
            const key1 = String(query.queryKey[1] || "");
            // Do NOT persist live operational projects list to TanStack persister!
            // Projects are progressively streamed & delta-synced by STARMOULD_PROJECTS_STORE_V4.
            // Persisting projects.list here creates a dual-cache conflict that revives deleted records.
            if (key0 === "projects") {
              return false;
            }
            // Only exclude transient modal preview IDs
            if (key1 === "preview-id") {
              return false;
            }
            return query.state.status === "success";
          },
        },
      }}
    >
      <RealtimeSyncListener />
      {children}
    </PersistQueryClientProvider>
  );
}
