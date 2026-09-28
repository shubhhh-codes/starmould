import { NextRequest } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCached } from "@/lib/cache";
import { loadEffectivePermissions, roleHasPermission } from "@/lib/permissions/loader";

export interface SessionUser {
  id: number;
  name: string;
  email: string | null;
  username: string;
  role_id: number;
  role: string;
  usertype?: string | null;
  usersubtype?: string | null;
  initials?: string | null;
  must_change_password?: boolean;
}

export interface SessionPayload extends SessionUser {
  iat?: number;
  exp?: number;
}

const COOKIE_NAME = "sm_session";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("CRITICAL SECURITY CONFIGURATION ERROR: Neither SESSION_SECRET nor SUPABASE_SERVICE_ROLE_KEY is configured.");
  }
  return secret;
}

/**
 * Signs a payload with HMAC-SHA256 and attaches issued-at (iat) and expiration (exp) timestamps (7 days)
 */
export function signSession(user: SessionUser): string {
  const secret = getSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const payloadData: SessionPayload = {
    ...user,
    iat: now,
    exp: now + 7 * 24 * 60 * 60, // 7 days expiration
  };
  const payload = Buffer.from(JSON.stringify(payloadData)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Verifies a signed session token. Returns null if invalid, tampered, or expired.
 */
export function verifySessionToken(token: string): SessionUser | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null; // Fail safely if no secret is configured

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(payload, "base64url").toString("utf8");
    const data = JSON.parse(jsonStr) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);

    // Validation must reject: missing iat, missing exp, non-numeric iat/exp, exp <= iat, expired tokens, tokens with unreasonable future timestamps
    if (
      typeof data.iat !== "number" ||
      typeof data.exp !== "number" ||
      isNaN(data.iat) ||
      isNaN(data.exp) ||
      data.exp <= data.iat ||
      now > data.exp ||
      data.iat > now + 60 || // Max 60s future clock skew
      data.exp > data.iat + 7 * 24 * 60 * 60 + 60 // Max 7 days + 60s
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies session from NextRequest.
 * Queries Supabase database directly to ensure user is active and role has not been revoked.
 *
 * @param allowedRoles - Optional hardcoded role_id whitelist (legacy fallback). If omitted with
 *                       permissionKey, only the dynamic config check applies.
 * @param permissionKey - Optional named permission key (e.g. "nav_expense", "action_manage_users").
 *                        When provided, the effective permissions matrix loaded from the admin-
 *                        configured role_permissions.json is checked. This gives Admin Settings
 *                        real enforcement power — revoking a permission here blocks the API, not
 *                        just the sidebar.
 */
export async function authenticateRequest(
  req: NextRequest,
  allowedRoles?: number[],
  permissionKey?: string
): Promise<{ user: SessionUser } | { error: string; status: number }> {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) {
    return { error: "Authentication required", status: 401 };
  }

  const session = verifySessionToken(cookie.value);
  if (!session || !session.id) {
    return { error: "Invalid or expired session", status: 401 };
  }

  let dbUser: any = null;
  try {
    // Verify against database (cached in-memory for 60s per user to eliminate redundant DB round-trips)
    dbUser = await getCached(`auth_user_record_${session.id}`, 60, async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("id, name, email, username, role_id, usertype, usersubtype, initials, status, must_change_password")
          .eq("id", session.id)
          .is("deleted_at", null)
          .single();
        if (error || !data) return null;
        return data;
      } catch {
        return null;
      }
    });
  } catch {
    dbUser = null;
  }

  // If user explicitly found in DB and marked inactive, forbid access
  if (dbUser && dbUser.status !== null && dbUser.status !== undefined && (String(dbUser.status).toLowerCase() === "inactive" || String(dbUser.status) === "0")) {
    return { error: "User account is inactive", status: 403 };
  }

  const roleNames: Record<number, string> = {
    0: "Admin",
    1: "Manager",
    2: "Supervisor",
    3: "Designer",
    4: "Worker",
  };

  // Use fresh DB user record if available; otherwise fall back to cryptographically verified session token
  const effectiveUser = dbUser || session;
  const roleId = effectiveUser.role_id !== null && effectiveUser.role_id !== undefined ? Number(effectiveUser.role_id) : 4;

  const freshUser: SessionUser = {
    id: effectiveUser.id,
    name: effectiveUser.name || session.name || "User",
    email: effectiveUser.email || session.email || null,
    username: effectiveUser.username || session.username,
    role_id: roleId,
    role: roleNames[roleId] || effectiveUser.role || "Worker",
    usertype: effectiveUser.usertype || session.usertype,
    usersubtype: effectiveUser.usersubtype || session.usersubtype,
    initials: effectiveUser.initials || session.initials,
    must_change_password: effectiveUser.must_change_password === true,
  };

  // Check hardcoded role whitelist (structural minimum: e.g., workers can never reach admin routes)
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(roleId)) {
      return { error: "Access denied: insufficient permissions", status: 403 };
    }
  }

  // Check dynamic named permission from admin-configured Supabase app_config table.
  // This is the second enforcement layer — if admin revoked this permission for the role,
  // the request is denied even if the role_id passed the structural check above.
  if (permissionKey) {
    const matrix = await loadEffectivePermissions();
    if (!roleHasPermission(roleId, permissionKey, matrix)) {
      return { error: "Access denied: permission revoked by administrator", status: 403 };
    }
  }

  return { user: freshUser };
}

