/**
 * StarMould Centralized Query Key Factory
 *
 * Provides typed, hierarchical query keys for all server-state caching.
 * Ensures consistent cache partitioning by search, filters, sorting, and pagination.
 */

export const queryKeys = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  dashboard: {
    counts: () => ["dashboard", "counts"] as const,
    stats: (params?: Record<string, any>) => ["dashboard", "stats", params ?? {}] as const,
  },
  projects: {
    all: () => ["projects"] as const,
    lists: () => ["projects", "list"] as const,
    list: (params?: Record<string, any>) => ["projects", "list", params ?? {}] as const,
    detail: (id: number | string) => ["projects", "detail", String(id)] as const,
  },
  subplates: {
    all: () => ["subplates"] as const,
    lists: () => ["subplates", "list"] as const,
    list: (params?: Record<string, any>) => ["subplates", "list", params ?? {}] as const,
    byProject: (projectId: number | string) => ["subplates", "by-project", String(projectId)] as const,
    detail: (id: number | string) => ["subplates", "detail", String(id)] as const,
  },
  customers: {
    all: () => ["customers"] as const,
    lists: () => ["customers", "list"] as const,
    list: (params?: Record<string, any>) => ["customers", "list", params ?? {}] as const,
    dropdown: (usertype?: string) => ["customers", "dropdown", usertype || "ALL"] as const,
  },
  users: {
    all: () => ["users"] as const,
    lists: () => ["users", "list"] as const,
    list: (params?: Record<string, any>) => ["users", "list", params ?? {}] as const,
    dropdown: () => ["users", "dropdown"] as const,
  },
  purchases: {
    all: () => ["purchases"] as const,
    lists: () => ["purchases", "list"] as const,
    list: (params?: Record<string, any>) => ["purchases", "list", params ?? {}] as const,
    detail: (id: number | string) => ["purchases", "detail", String(id)] as const,
  },
  purchaseInward: {
    all: () => ["purchase-inward"] as const,
    lists: () => ["purchase-inward", "list"] as const,
    list: (params?: Record<string, any>) => ["purchase-inward", "list", params ?? {}] as const,
  },
  worklogs: {
    all: () => ["worklogs"] as const,
    lists: () => ["worklogs", "list"] as const,
    list: (params?: Record<string, any>) => ["worklogs", "list", params ?? {}] as const,
  },
  challans: {
    all: () => ["challans"] as const,
    lists: () => ["challans", "list"] as const,
    list: (params?: Record<string, any>) => ["challans", "list", params ?? {}] as const,
    detail: (id: number | string) => ["challans", "detail", String(id)] as const,
  },
  dispatch: {
    all: () => ["dispatch"] as const,
    lists: () => ["dispatch", "list"] as const,
    list: (params?: Record<string, any>) => ["dispatch", "list", params ?? {}] as const,
  },
  inward: {
    all: () => ["inward"] as const,
    lists: () => ["inward", "list"] as const,
    list: (params?: Record<string, any>) => ["inward", "list", params ?? {}] as const,
  },
  expenses: {
    all: () => ["expenses"] as const,
    lists: () => ["expenses", "list"] as const,
    list: (params?: Record<string, any>) => ["expenses", "list", params ?? {}] as const,
  },
  samples: {
    all: () => ["samples"] as const,
    lists: () => ["samples", "list"] as const,
    list: (params?: Record<string, any>) => ["samples", "list", params ?? {}] as const,
  },
  printing: {
    all: () => ["printing"] as const,
    lists: () => ["printing", "list"] as const,
    list: (params?: Record<string, any>) => ["printing", "list", params ?? {}] as const,
  },
  grams: {
    all: () => ["grams"] as const,
    list: (params?: Record<string, any>) => ["grams", "list", params ?? {}] as const,
  },
};
