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
        buster: "v5.0.0_live_realtime",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            const key0 = String(query.queryKey[0]);
            // Strictly exclude any operational or fast-changing manufacturing state
            if ([
              "projects",
              "subplates",
              "dashboard",
              "worklogs",
              "challans",
              "dispatch",
              "inward",
              "purchases",
              "expenses",
              "search",
              "counts"
            ].includes(key0)) {
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
