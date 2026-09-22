import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
}

const COOKIE_NAME = "sm_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "starmould-secure-production-secret-key-3fcb64b1-ee51";

/**
 * Signs a payload with HMAC-SHA256
 */
export function signSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Verifies a signed session token. Returns null if invalid or tampered.
 */
export function verifySessionToken(token: string): SessionUser | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
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
    return JSON.parse(jsonStr) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies session from NextRequest.
 * Queries Supabase database directly to ensure user is active and role has not been revoked.
 */
export async function authenticateRequest(
  req: NextRequest,
  allowedRoles?: number[]
): Promise<{ user: SessionUser } | { error: string; status: number }> {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) {
    return { error: "Authentication required", status: 401 };
  }

  const session = verifySessionToken(cookie.value);
  if (!session || !session.id) {
    return { error: "Invalid or expired session", status: 401 };
  }

  // Verify against database in real-time
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, name, email, username, role_id, usertype, usersubtype, initials, status")
    .eq("id", session.id)
    .is("deleted_at", null)
    .single();

  if (error || !user) {
    return { error: "User account not found or deactivated", status: 401 };
  }

  if (user.status !== null && user.status !== undefined && (String(user.status).toLowerCase() === "inactive" || String(user.status) === "0")) {
    return { error: "User account is inactive", status: 403 };
  }

  const roleId = user.role_id !== null && user.role_id !== undefined ? Number(user.role_id) : 4;

  const roleNames: Record<number, string> = {
    0: "Admin",
    1: "Manager",
    2: "Supervisor",
    3: "Designer",
    4: "Worker",
  };

  const freshUser: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role_id: roleId,
    role: roleNames[roleId] || "Worker",
    usertype: user.usertype,
    usersubtype: user.usersubtype,
    initials: user.initials,
  };

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(roleId)) {
      return { error: "Access denied: insufficient permissions", status: 403 };
    }
  }

  return { user: freshUser };
}
