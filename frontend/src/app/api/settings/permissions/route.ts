import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_MENU_ORDERS } from "@/lib/permissions/defaults";
import { RolePermissionsMatrix, RoleMenuOrders } from "@/lib/permissions/types";
import {
  loadEffectivePermissions,
  loadEffectiveMenuOrders,
  saveConfigToSupabase,
} from "@/lib/permissions/loader";

// GET /api/settings/permissions - Retrieve current permissions & menu orders
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const permissions = await loadEffectivePermissions();
  const menu_orders = await loadEffectiveMenuOrders();

  return NextResponse.json({
    success: true,
    permissions,
    menu_orders,
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

    const current_permissions = await loadEffectivePermissions();
    const current_orders = await loadEffectiveMenuOrders();

    const updatedPerms: RolePermissionsMatrix = { ...current_permissions };
    const updatedOrders: RoleMenuOrders = { ...current_orders };

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
          updatedOrders[rNum] = rOrder as string[];
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

    const saveResult = await saveConfigToSupabase({
      permissions: updatedPerms,
      menu_orders: updatedOrders,
    });

    if (!saveResult.success) {
      return NextResponse.json(
        { error: `Database save failed: ${saveResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Role menu structure & permissions saved successfully.",
      permissions: updatedPerms,
      menu_orders: updatedOrders,
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

    const current_permissions = await loadEffectivePermissions();
    const current_orders = await loadEffectiveMenuOrders();

    const updatedPerms: RolePermissionsMatrix = { ...current_permissions };
    const updatedOrders: RoleMenuOrders = { ...current_orders };

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

    const saveResult = await saveConfigToSupabase({
      permissions: updatedPerms,
      menu_orders: updatedOrders,
    });

    if (!saveResult.success) {
      return NextResponse.json(
        { error: `Database reset failed: ${saveResult.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Role permissions & menu structure reset to factory defaults.",
      permissions: updatedPerms,
      menu_orders: updatedOrders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
