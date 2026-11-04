"use client";

import React, { useState, useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createQueryClient } from "@/lib/query/client";
import { createIDBPersister } from "@/lib/query/persister";
import { getCachedSession } from "@/components/providers/auth-provider";

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
        buster: "v9.0.3_purge_customer_vendor_cache",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key0 = String(query.queryKey[0] || "");
            const key1 = String(query.queryKey[1] || "");
            // Do NOT persist live operational projects, purchases, subplates, or master dropdown lists!
            // Projects are progressively streamed & delta-synced by STARMOULD_PROJECTS_STORE_V4.
            // Persisting live operational records here creates a dual-cache conflict that revives deleted records.
            if (key0 === "projects" || key0 === "purchases" || key0 === "subplates" || key0 === "customers" || key0 === "vendors" || key0 === "users") {
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
      {children}
    </PersistQueryClientProvider>
  );
}
