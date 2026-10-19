"use client";

import React, { useState, useEffect, useMemo } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createQueryClient } from "@/lib/query/client";
import { createIDBPersister } from "@/lib/query/persister";
import { getCachedSession } from "@/components/providers/auth-provider";
import { RealtimeSyncListener } from "@/lib/query/realtime";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const persister = useMemo(() => {
    if (typeof window === "undefined" || !isMounted) return null;
    const session = getCachedSession();
    const userSuffix = session?.id ? `${session.id}_${session.role_id ?? 0}` : "anon";
    return createIDBPersister(userSuffix);
  }, [isMounted]);

  // During SSR and initial client hydration, render with standard QueryClientProvider
  // to prevent hydration mismatch against empty SSR cache.
  // Once mounted, PersistQueryClientProvider restores IndexedDB cache smoothly.
  if (!isMounted || !persister) {
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
        buster: "v3.0.0",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            return (
              query.state.status === "success" &&
              query.queryKey[0] !== "worklogs" &&
              query.queryKey[0] !== "search"
            );
          },
        },
      }}
    >
      <RealtimeSyncListener />
      {children}
    </PersistQueryClientProvider>
  );
}
