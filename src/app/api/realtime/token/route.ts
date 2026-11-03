export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateRequest } from "@/lib/auth";

/**
 * GET /api/realtime/token
 * Generates an authenticated, read-only JWT scoped to role "app_realtime"
 * for the Supabase Realtime WebSocket client.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server configuration error: SUPABASE_JWT_SECRET not configured" },
      { status: 500 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600; // 1 hour token expiration

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      role: "app_realtime",
      aud: "authenticated",
      sub: String(auth.user.id),
      role_id: auth.user.role_id,
      iat: now,
      exp: expiresAt,
    })
  ).toString("base64url");

  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const token = `${header}.${payload}.${sig}`;

  const res = NextResponse.json({
    token,
    expiresAt: expiresAt * 1000,
  });

  res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return res;
}
