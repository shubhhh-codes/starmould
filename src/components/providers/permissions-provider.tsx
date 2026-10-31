"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_MENU_ORDERS } from "@/lib/permissions/defaults";
import { RolePermissionsMatrix, RoleMenuOrders } from "@/lib/permissions/types";

interface PermissionsContextType {
  matrix: RolePermissionsMatrix;
  menuOrders: RoleMenuOrders;
  isLoading: boolean;
  isSaving: boolean;
  hasPermission: (permissionKey: string, customRoleId?: number) => boolean;
  canAccessRoute: (pathname: string, customRoleId?: number) => boolean;
  getRoleMenuOrder: (roleId: number) => string[];
  updateRolePermissions: (roleId: number, permissions: Record<string, boolean>) => Promise<boolean>;
  updateRoleConfig: (roleId: number, permissions: Record<string, boolean>, menuOrder: string[]) => Promise<{ success: boolean; error?: string }>;
  resetRolePermissions: (roleId?: number) => Promise<{ success: boolean; error?: string }>;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

// Mapping of route paths to corresponding navigation permission keys
const ROUTE_PERMISSION_MAP: Record<string, string> = {
  "/": "nav_dashboard",
  "/customers": "nav_customer_creator",
  "/vendors": "nav_vendor_transport",
  "/subplate": "nav_subplate",
  "/scanning": "nav_scanning",
  "/purchase": "nav_purchase",
  "/purchase-inward": "nav_purchase_inward",
  "/challan": "nav_challan",
  "/dispatch": "nav_dispatch",
  "/inward": "nav_inward",
  "/work": "nav_work",
  "/expense": "nav_expense",
  "/user": "nav_user_mgmt",
  "/report": "nav_reports",
  "/export": "nav_export",
  "/settings": "nav_settings", // Admin settings
  "/quotation": "nav_quotation",
  "/project-register": "nav_project_register",
};

const PERMS_CACHE_KEY = "starmould_role_perms_cache_v2";
const ORDERS_CACHE_KEY = "starmould_role_orders_cache_v2";

function getCachedPerms(): { matrix: RolePermissionsMatrix; menuOrders: RoleMenuOrders } | null {
  if (typeof window === "undefined") return null;
  try {
    const rawMatrix = localStorage.getItem(PERMS_CACHE_KEY);
    const rawOrders = localStorage.getItem(ORDERS_CACHE_KEY);
    if (rawMatrix) {
      return {
        matrix: JSON.parse(rawMatrix),
        menuOrders: rawOrders ? JSON.parse(rawOrders) : DEFAULT_ROLE_MENU_ORDERS,
      };
    }
  } catch {
    // Ignore
  }
  return null;
}

import { getCachedSession } from "./auth-provider";

export function PermissionsProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: any;
}) {
  const { currentUser: authUser } = useAuth();
  const activeUser = authUser || initialUser;

  // Initialize matrix and menuOrders synchronously from cache if present
  const [matrix, setMatrix] = useState<RolePermissionsMatrix>(() => {
    const cached = getCachedPerms();
    return cached?.matrix || DEFAULT_ROLE_PERMISSIONS;
  });
  const [menuOrders, setMenuOrders] = useState<RoleMenuOrders>(() => {
    const cached = getCachedPerms();
    return cached?.menuOrders || DEFAULT_ROLE_MENU_ORDERS;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchPermissions = useCallback(async () => {
    try {
      // Strictly bypass all browser/proxy disk caches on every request
      const res = await fetch(`/api/settings/permissions?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.permissions) {
          setMatrix(data.permissions);
          try {
            localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify(data.permissions));
          } catch {}
        }
        if (data.menu_orders) {
          setMenuOrders(data.menu_orders);
          try {
            localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(data.menu_orders));
          } catch {}
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Permissions fetch deferred (waiting for server):", err instanceof Error ? err.message : err);
      } else {
        console.error("Error fetching permissions:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const pathname = usePathname();

  useEffect(() => {
    const cached = getCachedPerms();
    if (cached) {
      setMatrix(cached.matrix);
      setMenuOrders(cached.menuOrders);
    }
    // Do not fetch permissions on unauthenticated views like /login
    if (pathname === "/login") return;
    if (!activeUser && !getCachedSession()) return;
    fetchPermissions();
  }, [fetchPermissions, activeUser, pathname]);

  // Real-time synchronization across browser tabs, windows, and tab visibility
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Storage event across tabs in the same browser
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PERMS_CACHE_KEY && e.newValue) {
        try {
          setMatrix(JSON.parse(e.newValue));
        } catch {}
      }
      if (e.key === ORDERS_CACHE_KEY && e.newValue) {
        try {
          setMenuOrders(JSON.parse(e.newValue));
        } catch {}
      }
    };
    window.addEventListener("storage", handleStorage);

    // 2. Tab focus / visibility change: immediately re-verify live permissions
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchPermissions();
      }
    };
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    // 3. Instant BroadcastChannel sync
    let bc: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("starmould_tabs_sync");
        bc.onmessage = (event) => {
          if (
            event.data?.type === "PERMISSIONS_UPDATED" ||
            (event.data?.type === "INVALIDATE" && Array.isArray(event.data?.queryKey) && event.data.queryKey.includes("role_permissions"))
          ) {
            fetchPermissions();
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (bc) bc.close();
    };
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permissionKey: string, customRoleId?: number): boolean => {
      let roleId = customRoleId !== undefined ? customRoleId : activeUser?.role_id;
      if (roleId === undefined && typeof window !== "undefined") {
        const cached = getCachedSession();
        if (cached && cached.role_id !== undefined) {
          roleId = cached.role_id;
        }
      }
      if (roleId === 0) return true; // Admin has universal access
      if (roleId === undefined) return false;
      // Role & Permissions (nav_settings) is strictly Admin only
      if (permissionKey === "nav_settings") return false;
      const rolePerms = matrix[roleId];
      if (!rolePerms) return false;
      return rolePerms[permissionKey] ?? false;
    },
    [activeUser?.role_id, matrix]
  );

  const getRoleMenuOrder = useCallback(
    (roleId: number): string[] => {
      const order = menuOrders[roleId];
      if (order && order.length > 0) {
        const defaultOrder = DEFAULT_ROLE_MENU_ORDERS[roleId] || DEFAULT_ROLE_MENU_ORDERS[0];
        const existingKeys = new Set(order);
        const missingKeys = defaultOrder.filter((k) => !existingKeys.has(k));
        if (missingKeys.length === 0) return order;
        const enriched = [...order];
        for (const mk of missingKeys) {
          const scanIdx = enriched.indexOf("nav_scanning");
          if (scanIdx !== -1) {
            enriched.splice(scanIdx + 1, 0, mk);
          } else {
            enriched.push(mk);
          }
        }
        return enriched;
      }
      return DEFAULT_ROLE_MENU_ORDERS[roleId] || DEFAULT_ROLE_MENU_ORDERS[0];
    },
    [menuOrders]
  );

  const canAccessRoute = useCallback(
    (pathname: string, customRoleId?: number): boolean => {
      let roleId = customRoleId !== undefined ? customRoleId : activeUser?.role_id;
      if (roleId === undefined && typeof window !== "undefined") {
        const cached = getCachedSession();
        if (cached && cached.role_id !== undefined) {
          roleId = cached.role_id;
        }
      }
      if (roleId === 0) return true;
      if (roleId === undefined) return false;

      // Settings is strictly Admin only
      if (pathname.startsWith("/settings")) return false;

      if (pathname.startsWith("/customers")) {
        return hasPermission("nav_customer_creator", roleId);
      }
      if (pathname.startsWith("/vendors")) {
        return hasPermission("nav_vendor_transport", roleId);
      }

      for (const [routePrefix, permKey] of Object.entries(ROUTE_PERMISSION_MAP)) {
        if (pathname === routePrefix || (routePrefix !== "/" && pathname.startsWith(routePrefix))) {
          return hasPermission(permKey, roleId);
        }
      }
      return true;
    },
    [activeUser?.role_id, hasPermission]
  );

  const updateRolePermissions = useCallback(
    async (roleId: number, permissions: Record<string, boolean>): Promise<boolean> => {
      if (roleId === 0) return false; // Safety lock for Admin
      try {
        setIsSaving(true);
        const res = await fetch("/api/settings/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, permissions }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.permissions) {
            setMatrix(data.permissions);
          }
          if (data.menu_orders) {
            setMenuOrders(data.menu_orders);
          }
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            try {
              const bc = new BroadcastChannel("starmould_tabs_sync");
              bc.postMessage({ type: "PERMISSIONS_UPDATED" });
              bc.close();
            } catch {}
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error updating permissions:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const updateRoleConfig = useCallback(
    async (
      roleId: number,
      permissions: Record<string, boolean>,
      menuOrder: string[]
    ): Promise<{ success: boolean; error?: string }> => {
      // For Admin (roleId === 0), permissions remain locked to 100% full access, but menuOrder can be customized
      const permissionsToSend = roleId === 0 ? DEFAULT_ROLE_PERMISSIONS[0] : permissions;
      try {
        setIsSaving(true);
        const res = await fetch("/api/settings/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, permissions: permissionsToSend, menuOrder }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data.permissions) {
            setMatrix(data.permissions);
            try { localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify(data.permissions)); } catch {}
          }
          if (data.menu_orders) {
            setMenuOrders(data.menu_orders);
            try { localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(data.menu_orders)); } catch {}
          }
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            try {
              const bc = new BroadcastChannel("starmould_tabs_sync");
              bc.postMessage({ type: "PERMISSIONS_UPDATED" });
              bc.close();
            } catch {}
          }
          return { success: true };
        }
        const errorMsg = data.error || `HTTP ${res.status}: ${res.statusText || "Failed to save configuration"}`;
        console.error(`[Permissions Error] Failed to update role ${roleId}:`, errorMsg);
        return { success: false, error: errorMsg };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Network request failed";
        console.error("Error updating role config:", err);
        return { success: false, error: errorMsg };
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const resetRolePermissions = useCallback(
    async (roleId?: number): Promise<{ success: boolean; error?: string }> => {
      try {
        setIsSaving(true);
        const res = await fetch("/api/settings/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          if (data.permissions) {
            setMatrix(data.permissions);
            try { localStorage.setItem(PERMS_CACHE_KEY, JSON.stringify(data.permissions)); } catch {}
          }
          if (data.menu_orders) {
            setMenuOrders(data.menu_orders);
            try { localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(data.menu_orders)); } catch {}
          }
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            try {
              const bc = new BroadcastChannel("starmould_tabs_sync");
              bc.postMessage({ type: "PERMISSIONS_UPDATED" });
              bc.close();
            } catch {}
          }
          return { success: true };
        }
        const errorMsg = data.error || `HTTP ${res.status}: Failed to reset permissions`;
        console.error("[Permissions Error] Failed to reset role permissions:", errorMsg);
        return { success: false, error: errorMsg };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Network request failed";
        console.error("Error resetting permissions:", err);
        return { success: false, error: errorMsg };
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  return (
    <PermissionsContext.Provider
      value={{
        matrix,
        menuOrders,
        isLoading,
        isSaving,
        hasPermission,
        canAccessRoute,
        getRoleMenuOrder,
        updateRolePermissions,
        updateRoleConfig,
        resetRolePermissions,
        refreshPermissions: fetchPermissions,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function useRolePermissions(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("useRolePermissions must be used within a PermissionsProvider");
  }
  return context;
}
