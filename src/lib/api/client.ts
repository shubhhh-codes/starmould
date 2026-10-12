import type {
  Customer,
  User,
  ScanProject,
  Subplate,
  PurchaseOrder,
  Challan,
  Dispatch,
  Inward,
  Expense,
  PrintProject,
  GramCalc,
} from "@/lib/supabase/types";

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  [key: string]: unknown;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "/api") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers = new Headers(options.headers);

    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `HTTP Error ${res.status}`;
      try {
        const body = await res.json();
        if (body.error) errorMsg = body.error;
      } catch {
        // fallback to status text
        if (res.statusText) errorMsg = res.statusText;
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // --- Customers & Vendors ---
  public customers = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<{ data: Customer[]; customers?: Customer[]; pagination?: any }>(`/customers${query}`);
    },
    create: (data: Partial<Customer>) =>
      this.request<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number | string, data: Partial<Customer>) =>
      this.request<Customer>(`/customers?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number | string) =>
      this.request<{ success: boolean }>(`/customers?id=${id}`, {
        method: "DELETE",
      }),
  };

  // --- Users ---
  public users = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<{ data: User[]; users?: User[] }>(`/users${query}`);
    },
    create: (data: Partial<User>) =>
      this.request<User>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number | string, data: Partial<User>) =>
      this.request<User>(`/users?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number | string) =>
      this.request<{ success: boolean }>(`/users?id=${id}`, {
        method: "DELETE",
      }),
  };

  // --- Mould & Scanning ---
  public scanning = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<ScanProject>>(`/scanning${query}`);
    },
    create: (data: Partial<ScanProject>) =>
      this.request<ScanProject>("/scanning", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number | string, data: Partial<ScanProject>) =>
      this.request<ScanProject>(`/scanning?id=${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number | string) =>
      this.request<{ success: boolean }>(`/scanning?id=${id}`, {
        method: "DELETE",
      }),
  };

  // --- Subplates ---
  public subplates = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<Subplate>>(`/subplate${query}`);
    },
  };

  // --- Purchases ---
  public purchases = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<PurchaseOrder>>(`/purchases${query}`);
    },
  };

  // --- Challan ---
  public challan = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<Challan>>(`/challan${query}`);
    },
  };

  // --- Dispatches ---
  public dispatch = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<Dispatch>>(`/dispatch${query}`);
    },
  };

  // --- Expenses ---
  public expenses = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<Expense>>(`/expense${query}`);
    },
  };

  // --- Inward ---
  public inward = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<Inward>>(`/inward${query}`);
    },
  };

  // --- Gram Calculator ---
  public gram = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<GramCalc>>(`/gram${query}`);
    },
  };

  // --- Printing ---
  public printing = {
    list: (params?: Record<string, string | number | boolean | undefined>) => {
      const query = params ? `?${new URLSearchParams(
        Object.entries(params)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}` : "";
      return this.request<PaginatedResult<PrintProject>>(`/printing${query}`);
    },
  };
}

export const apiClient = new ApiClient();
