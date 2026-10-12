import { supabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_MENU_ORDERS } from "./defaults";
import { RolePermissionsMatrix, RoleMenuOrders } from "./types";
import { serverLogger } from "@/lib/server-logger";

const CONFIG_KEY_PERMISSIONS = "role_permissions";
const CONFIG_KEY_MENU_ORDERS = "role_menu_orders";

export interface StoredConfig {
  permissions: RolePermissionsMatrix;
  menu_orders: RoleMenuOrders;
}

let cachedPermissions: RolePermissionsMatrix | null = null;
let cachedMenuOrders: RoleMenuOrders | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Loads effective permissions by merging stored Supabase config with factory defaults.
 * Admin (role 0) is always full-access. Cached 30s in-process.
 */
export async function loadEffectivePermissions(): Promise<RolePermissionsMatrix> {
  const now = Date.now();
  if (cachedPermissions && now < cacheExpiresAt) {
    return cachedPermissions;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", CONFIG_KEY_PERMISSIONS)
      .single();

    if (!error && data?.value && typeof data.value === "object") {
      const stored = data.value as RolePermissionsMatrix;
      const merged: RolePermissionsMatrix = {};
      for (const [roleIdStr, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const roleId = Number(roleIdStr);
        merged[roleId] = { ...defaults, ...(stored[roleId] || {}) };
      }
      // Admin always full immutable access
      merged[0] = { ...DEFAULT_ROLE_PERMISSIONS[0] };
      // Non-admin roles never have nav_settings
      for (const rId of [1, 2, 3, 4]) {
        if (merged[rId]) merged[rId].nav_settings = false;
      }
      cachedPermissions = merged;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return merged;
    }
  } catch (err) {
    serverLogger.warn("Supabase permissions load error, falling back to defaults", err);
  }

  cachedPermissions = { ...DEFAULT_ROLE_PERMISSIONS };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedPermissions;
}

export async function loadEffectiveMenuOrders(): Promise<RoleMenuOrders> {
  const now = Date.now();
  if (cachedMenuOrders && now < cacheExpiresAt) {
    return cachedMenuOrders;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("app_config")
      .select("value")
      .eq("key", CONFIG_KEY_MENU_ORDERS)
      .single();

    if (!error && data?.value && typeof data.value === "object") {
      const stored = data.value as RoleMenuOrders;
      const merged: RoleMenuOrders = { ...DEFAULT_ROLE_MENU_ORDERS };
      for (const [roleIdStr, order] of Object.entries(stored)) {
        const roleId = Number(roleIdStr);
        if (Array.isArray(order)) merged[roleId] = order;
      }
      merged[0] = [...DEFAULT_ROLE_MENU_ORDERS[0]];
      // Non-admin roles never have nav_settings in menu orders
      for (const rId of [1, 2, 3, 4]) {
        if (Array.isArray(merged[rId])) {
          merged[rId] = merged[rId].filter((k) => k !== "nav_settings");
        }
      }
      cachedMenuOrders = merged;
      return merged;
    }
  } catch (err) {
    serverLogger.warn("Supabase menu orders load error, falling back to defaults", err);
  }

  cachedMenuOrders = { ...DEFAULT_ROLE_MENU_ORDERS };
  return cachedMenuOrders;
}

/**
 * Saves full permissions matrix and menu orders to Supabase app_config table.
 */
export async function saveConfigToSupabase(config: StoredConfig): Promise<{ success: boolean; error?: string }> {
  // Protect admin from being modified and sanitize non-admin roles
  const safePerms: RolePermissionsMatrix = {
    ...config.permissions,
    0: { ...DEFAULT_ROLE_PERMISSIONS[0] },
  };
  const safeOrders: RoleMenuOrders = {
    ...config.menu_orders,
    0: [...DEFAULT_ROLE_MENU_ORDERS[0]],
  };

  // Ensure nav_settings is strictly false and never in menu order for non-admin roles (1, 2, 3, 4)
  for (const rId of [1, 2, 3, 4]) {
    if (safePerms[rId]) {
      safePerms[rId].nav_settings = false;
    }
    if (Array.isArray(safeOrders[rId])) {
      safeOrders[rId] = safeOrders[rId].filter((k) => k !== "nav_settings");
    }
  }

  const [permRes, orderRes] = await Promise.all([
    supabaseAdmin.from("app_config").upsert(
      { key: CONFIG_KEY_PERMISSIONS, value: safePerms, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    ),
    supabaseAdmin.from("app_config").upsert(
      { key: CONFIG_KEY_MENU_ORDERS, value: safeOrders, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    ),
  ]);

  const errors = [permRes.error?.message, orderRes.error?.message].filter(Boolean);
  if (errors.length > 0) {
    const errorMsg = errors.join("; ");
    serverLogger.error("Supabase app_config upsert failed", errorMsg, {
      details: {
        permError: permRes.error,
        orderError: orderRes.error,
      },
    });
    return { success: false, error: errorMsg };
  }

  // Bust in-process cache immediately
  invalidatePermissionsCache();
  cachedPermissions = safePerms;
  cachedMenuOrders = safeOrders;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return { success: true };
}

export function invalidatePermissionsCache(): void {
  cachedPermissions = null;
  cachedMenuOrders = null;
  cacheExpiresAt = 0;
}

export function roleHasPermission(roleId: number, permissionKey: string, matrix?: RolePermissionsMatrix): boolean {
  if (roleId === 0) return true;
  const m = matrix ?? cachedPermissions ?? DEFAULT_ROLE_PERMISSIONS;
  return m[roleId]?.[permissionKey] === true;
}
