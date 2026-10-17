"use client";

import React, { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createQueryClient } from "@/lib/query/client";
import { createCompressedPersister } from "@/lib/query/persister";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    const persister = createCompressedPersister();
    if (!persister) return;

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v2.1",
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          return (
            query.state.status === "success" &&
            query.state.data !== undefined &&
            query.state.data !== null
          );
        },
      },
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
