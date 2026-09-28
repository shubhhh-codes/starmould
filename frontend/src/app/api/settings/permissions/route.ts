import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { authenticateRequest } from "@/lib/auth";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_MENU_ORDERS } from "@/lib/permissions/defaults";
import { RolePermissionsMatrix, RoleMenuOrders } from "@/lib/permissions/types";

interface StoredConfig {
  permissions: RolePermissionsMatrix;
  menu_orders: RoleMenuOrders;
}

let cachedConfig: StoredConfig | null = null;

const STORAGE_FILE_PATH = path.join(process.cwd(), "src", "data", "role_permissions.json");

function loadStoredConfig(): StoredConfig {
  if (cachedConfig) return cachedConfig;

  try {
    if (fs.existsSync(STORAGE_FILE_PATH)) {
      const raw = fs.readFileSync(STORAGE_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const parsedPerms = parsed.permissions || (parsed[0] ? parsed : {});
        const parsedOrders = parsed.menu_orders || {};

        const mergedPerms: RolePermissionsMatrix = { ...DEFAULT_ROLE_PERMISSIONS };
        for (const [roleIdStr, perms] of Object.entries(parsedPerms)) {
          const rId = Number(roleIdStr);
          if (mergedPerms[rId]) {
            mergedPerms[rId] = {
              ...mergedPerms[rId],
              ...(perms as Record<string, boolean>),
            };
          }
        }
        mergedPerms[0] = { ...DEFAULT_ROLE_PERMISSIONS[0] };

        const mergedOrders: RoleMenuOrders = { ...DEFAULT_ROLE_MENU_ORDERS };
        for (const [roleIdStr, order] of Object.entries(parsedOrders)) {
          const rId = Number(roleIdStr);
          if (Array.isArray(order)) {
            mergedOrders[rId] = order;
          }
        }
        mergedOrders[0] = [...DEFAULT_ROLE_MENU_ORDERS[0]];

        cachedConfig = {
          permissions: mergedPerms,
          menu_orders: mergedOrders,
        };
        return cachedConfig;
      }
    }
  } catch (err) {
    console.error("Error reading stored role permissions config:", err);
  }

  cachedConfig = {
    permissions: { ...DEFAULT_ROLE_PERMISSIONS },
    menu_orders: { ...DEFAULT_ROLE_MENU_ORDERS },
  };
  return cachedConfig;
}

function saveStoredConfig(config: StoredConfig): void {
  try {
    const dir = path.dirname(STORAGE_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const safeConfig: StoredConfig = {
      permissions: {
        ...config.permissions,
        0: { ...DEFAULT_ROLE_PERMISSIONS[0] },
      },
      menu_orders: {
        ...config.menu_orders,
        0: [...DEFAULT_ROLE_MENU_ORDERS[0]],
      },
    };
    fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(safeConfig, null, 2), "utf-8");
    cachedConfig = safeConfig;
  } catch (err) {
    console.error("Error writing stored role permissions config:", err);
  }
}

// GET /api/settings/permissions - Retrieve current permissions & menu orders
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const config = loadStoredConfig();
  return NextResponse.json({
    success: true,
    permissions: config.permissions,
    menu_orders: config.menu_orders,
    userRoleId: auth.user.role_id,
    isAdmin: auth.user.role_id === 0,
  });
}

// PUT /api/settings/permissions - Update permissions & menu orders (Admin only)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0]); // Strictly Admin only
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { roleId, permissions, menuOrder, matrix, menuOrders } = body;

    const current = loadStoredConfig();
    const updatedPerms: RolePermissionsMatrix = { ...current.permissions };
    const updatedOrders: RoleMenuOrders = { ...current.menu_orders };

    if (matrix && typeof matrix === "object") {
      for (const [rStr, rPerms] of Object.entries(matrix)) {
        const rNum = Number(rStr);
        if (rNum !== 0 && updatedPerms[rNum]) {
          updatedPerms[rNum] = {
            ...updatedPerms[rNum],
            ...(rPerms as Record<string, boolean>),
          };
        }
      }
    }

    if (menuOrders && typeof menuOrders === "object") {
      for (const [rStr, rOrder] of Object.entries(menuOrders)) {
        const rNum = Number(rStr);
        if (rNum !== 0 && Array.isArray(rOrder)) {
          updatedOrders[rNum] = rOrder;
        }
      }
    }

    if (roleId !== undefined && roleId !== null) {
      const rNum = Number(roleId);
      if (rNum !== 0) {
        if (permissions && updatedPerms[rNum]) {
          updatedPerms[rNum] = {
            ...updatedPerms[rNum],
            ...permissions,
          };
        }
        if (Array.isArray(menuOrder)) {
          updatedOrders[rNum] = menuOrder;
        }
      }
    }

    const newConfig: StoredConfig = {
      permissions: updatedPerms,
      menu_orders: updatedOrders,
    };

    saveStoredConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: "Role menu structure & permissions saved successfully.",
      permissions: newConfig.permissions,
      menu_orders: newConfig.menu_orders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/settings/permissions - Reset permissions to factory defaults (Admin only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0]); // Strictly Admin only
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { roleId } = body;

    const current = loadStoredConfig();
    const updatedPerms: RolePermissionsMatrix = { ...current.permissions };
    const updatedOrders: RoleMenuOrders = { ...current.menu_orders };

    if (roleId !== undefined && roleId !== null) {
      const rNum = Number(roleId);
      if (DEFAULT_ROLE_PERMISSIONS[rNum]) {
        updatedPerms[rNum] = { ...DEFAULT_ROLE_PERMISSIONS[rNum] };
      }
      if (DEFAULT_ROLE_MENU_ORDERS[rNum]) {
        updatedOrders[rNum] = [...DEFAULT_ROLE_MENU_ORDERS[rNum]];
      }
    } else {
      for (const [rStr, defPerms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        updatedPerms[Number(rStr)] = { ...defPerms };
      }
      for (const [rStr, defOrders] of Object.entries(DEFAULT_ROLE_MENU_ORDERS)) {
        updatedOrders[Number(rStr)] = [...defOrders];
      }
    }

    const newConfig: StoredConfig = {
      permissions: updatedPerms,
      menu_orders: updatedOrders,
    };

    saveStoredConfig(newConfig);

    return NextResponse.json({
      success: true,
      message: "Role permissions & menu structure reset to factory defaults.",
      permissions: newConfig.permissions,
      menu_orders: newConfig.menu_orders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
