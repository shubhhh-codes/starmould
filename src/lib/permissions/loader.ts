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
const CACHE_TTL_MS = 60_000; // 60 seconds warm in-process cache (invalidated on every admin save)

/**
 * Loads both effective permissions and menu orders in a single batched query with 60s memory caching.
 */
export async function loadEffectiveConfig(): Promise<{ permissions: RolePermissionsMatrix; menu_orders: RoleMenuOrders }> {
  const now = Date.now();
  if (cachedPermissions && cachedMenuOrders && now < cacheExpiresAt) {
    return { permissions: cachedPermissions, menu_orders: cachedMenuOrders };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("app_config")
      .select("key, value")
      .in("key", [CONFIG_KEY_PERMISSIONS, CONFIG_KEY_MENU_ORDERS]);

    if (!error && Array.isArray(data)) {
      const configMap = new Map(data.map((row: any) => [row.key, row.value]));
      const storedPerms = (configMap.get(CONFIG_KEY_PERMISSIONS) || {}) as RolePermissionsMatrix;
      const storedOrders = (configMap.get(CONFIG_KEY_MENU_ORDERS) || {}) as RoleMenuOrders;

      // 1. Merge permissions
      const mergedPerms: RolePermissionsMatrix = {};
      for (const [roleIdStr, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        const roleId = Number(roleIdStr);
        mergedPerms[roleId] = { ...defaults, ...(storedPerms[roleId] || {}) };
      }
      mergedPerms[0] = { ...DEFAULT_ROLE_PERMISSIONS[0] };
      for (const rId of Object.keys(mergedPerms).map(Number).filter((id) => id !== 0)) {
        if (mergedPerms[rId]) mergedPerms[rId].nav_settings = false;
      }

      // 2. Merge menu orders
      const mergedOrders: RoleMenuOrders = { ...DEFAULT_ROLE_MENU_ORDERS };
      for (const [roleIdStr, order] of Object.entries(storedOrders)) {
        const roleId = Number(roleIdStr);
        if (Array.isArray(order) && order.length > 0) mergedOrders[roleId] = order;
      }
      const storedAdminOrder = storedOrders[0] || (storedOrders as any)["0"];
      if (Array.isArray(storedAdminOrder) && storedAdminOrder.length > 0) {
        const existingKeys = new Set(storedAdminOrder);
        const missingKeys = DEFAULT_ROLE_MENU_ORDERS[0].filter((k) => !existingKeys.has(k));
        mergedOrders[0] = [...storedAdminOrder, ...missingKeys];
      } else {
        mergedOrders[0] = [...DEFAULT_ROLE_MENU_ORDERS[0]];
      }
      for (const rId of Object.keys(mergedOrders).map(Number).filter((id) => id !== 0)) {
        if (Array.isArray(mergedOrders[rId])) {
          mergedOrders[rId] = mergedOrders[rId].filter((k) => k !== "nav_settings");
        }
      }

      cachedPermissions = mergedPerms;
      cachedMenuOrders = mergedOrders;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return { permissions: mergedPerms, menu_orders: mergedOrders };
    }
  } catch (err) {
    serverLogger.warn("Supabase config load error, falling back to defaults", err);
  }

  cachedPermissions = { ...DEFAULT_ROLE_PERMISSIONS };
  cachedMenuOrders = { ...DEFAULT_ROLE_MENU_ORDERS };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return { permissions: cachedPermissions, menu_orders: cachedMenuOrders };
}

/**
 * Loads effective permissions by merging stored Supabase config with factory defaults.
 * Admin (role 0) is always full-access. Cached 60s in-process.
 */
export async function loadEffectivePermissions(): Promise<RolePermissionsMatrix> {
  const config = await loadEffectiveConfig();
  return config.permissions;
}

export async function loadEffectiveMenuOrders(): Promise<RoleMenuOrders> {
  const config = await loadEffectiveConfig();
  return config.menu_orders;
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

  const rawAdminOrder = config.menu_orders?.[0] || (config.menu_orders as any)?.["0"];
  const safeAdminOrder = Array.isArray(rawAdminOrder) && rawAdminOrder.length > 0
    ? rawAdminOrder
    : [...DEFAULT_ROLE_MENU_ORDERS[0]];

  const safeOrders: RoleMenuOrders = {
    ...config.menu_orders,
    0: safeAdminOrder,
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
