import type { Customer, User } from "@/lib/supabase/types";

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  customers?: Customer[];
  users?: User[];
  kpis?: Record<string, any>;
  [key: string]: any;
}
