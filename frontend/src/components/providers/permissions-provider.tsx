"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  updateRoleConfig: (roleId: number, permissions: Record<string, boolean>, menuOrder: string[]) => Promise<boolean>;
  resetRolePermissions: (roleId?: number) => Promise<boolean>;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  matrix: DEFAULT_ROLE_PERMISSIONS,
  menuOrders: DEFAULT_ROLE_MENU_ORDERS,
  isLoading: false,
  isSaving: false,
  hasPermission: () => true,
  canAccessRoute: () => true,
  getRoleMenuOrder: () => [],
  updateRolePermissions: async () => false,
  updateRoleConfig: async () => false,
  resetRolePermissions: async () => false,
  refreshPermissions: async () => {},
});

// Mapping of route paths to corresponding navigation permission keys
const ROUTE_PERMISSION_MAP: Record<string, string> = {
  "/": "nav_dashboard",
  "/customer": "nav_vendor_transport", // fallback; specific query handled dynamically
  "/subplate": "nav_subplate",
  "/scanning": "nav_scanning",
  "/printing": "nav_printing",
  "/purchase": "nav_purchase",
  "/purchase-inward": "nav_purchase_inward",
  "/challan": "nav_challan",
  "/dispatch": "nav_dispatch",
  "/inward": "nav_inward",
  "/work": "nav_work",
  "/sample": "nav_sample",
  "/expense": "nav_expense",
  "/gram": "nav_gram",
  "/user": "nav_user_mgmt",
  "/report": "nav_reports",
  "/export": "nav_export",
  "/settings": "nav_settings", // Admin settings
};

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [matrix, setMatrix] = useState<RolePermissionsMatrix>(DEFAULT_ROLE_PERMISSIONS);
  const [menuOrders, setMenuOrders] = useState<RoleMenuOrders>(DEFAULT_ROLE_MENU_ORDERS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/permissions");
      if (res.ok) {
        const data = await res.json();
        if (data.permissions) {
          setMatrix(data.permissions);
        }
        if (data.menu_orders) {
          setMenuOrders(data.menu_orders);
        }
      }
    } catch (err) {
      console.error("Error fetching permissions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (permissionKey: string, customRoleId?: number): boolean => {
      const roleId = customRoleId !== undefined ? customRoleId : currentUser?.role_id ?? 4;
      if (roleId === 0) return true; // Admin has universal access
      const rolePerms = matrix[roleId];
      if (!rolePerms) return false;
      return rolePerms[permissionKey] ?? false;
    },
    [currentUser?.role_id, matrix]
  );

  const getRoleMenuOrder = useCallback(
    (roleId: number): string[] => {
      if (menuOrders[roleId] && menuOrders[roleId].length > 0) {
        return menuOrders[roleId];
      }
      return DEFAULT_ROLE_MENU_ORDERS[roleId] || DEFAULT_ROLE_MENU_ORDERS[0];
    },
    [menuOrders]
  );

  const canAccessRoute = useCallback(
    (pathname: string, customRoleId?: number): boolean => {
      const roleId = customRoleId !== undefined ? customRoleId : currentUser?.role_id ?? 4;
      if (roleId === 0) return true;

      // Special check for Customer Creator vs Vendor
      if (pathname.startsWith("/customer")) {
        const hasCustomerAccess = hasPermission("nav_customer_creator", roleId);
        const hasVendorAccess = hasPermission("nav_vendor_transport", roleId);
        return hasCustomerAccess || hasVendorAccess;
      }

      for (const [routePrefix, permKey] of Object.entries(ROUTE_PERMISSION_MAP)) {
        if (pathname === routePrefix || (routePrefix !== "/" && pathname.startsWith(routePrefix))) {
          return hasPermission(permKey, roleId);
        }
      }
      return true;
    },
    [currentUser?.role_id, hasPermission]
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
    ): Promise<boolean> => {
      if (roleId === 0) return false; // Safety lock for Admin
      try {
        setIsSaving(true);
        const res = await fetch("/api/settings/permissions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, permissions, menuOrder }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.permissions) {
            setMatrix(data.permissions);
          }
          if (data.menu_orders) {
            setMenuOrders(data.menu_orders);
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error updating role config:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const resetRolePermissions = useCallback(
    async (roleId?: number): Promise<boolean> => {
      try {
        setIsSaving(true);
        const res = await fetch("/api/settings/permissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.permissions) {
            setMatrix(data.permissions);
          }
          if (data.menu_orders) {
            setMenuOrders(data.menu_orders);
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error resetting permissions:", err);
        return false;
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

export function useRolePermissions() {
  return useContext(PermissionsContext);
}
