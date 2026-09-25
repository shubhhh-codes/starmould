import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Role definitions:
// 0: Admin
// 1: Manager
// 2: Supervisor
// 3: Designer
// 4: Worker

const ROUTE_PERMISSIONS: Record<string, number[]> = {
  "/user": [0],
  "/expense": [0, 1],
  "/gram": [0, 1],
  "/customer": [0, 1],
  "/export": [0, 1],
  "/purchase": [0, 1], // Restricted to Admin/Manager per legacy topbar.blade.php:80
  "/purchase-inward": [0, 1], // Restricted to Admin/Manager
  "/printing": [0, 1, 2],
  "/challan": [0, 1, 2],
  "/dispatch": [0, 1, 2],
  "/inward": [0, 1, 2],
  "/report": [0, 1, 2],
  "/subplate": [0, 1, 2, 3],
  "/sample": [0, 1, 2, 3],
  "/scanning": [0, 1, 2, 3, 4],
  "/work": [0, 1, 2, 3, 4],
  "/": [0, 1, 2, 3, 4],
};

async function verifySessionTokenEdge(token: string): Promise<{ id: number; role_id: number; role: string } | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null; // Fail safely if no secret is configured

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Decode base64url signature
    let b64Sig = signature.replace(/-/g, "+").replace(/_/g, "/");
    while (b64Sig.length % 4) {
      b64Sig += "=";
    }
    const sigBytes = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(payload)
    );

    if (!isValid) return null;

    // Decode base64url payload
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonStr = atob(base64);
    const data = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);

    // Strict validation: reject missing iat, missing exp, non-numeric timestamps, exp <= iat, expired tokens, unreasonable future timestamps
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files, api routes, and favicon
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Get session cookie and cryptographically verify signature
  const sessionCookie = req.cookies.get("sm_session");
  const session = sessionCookie?.value ? await verifySessionTokenEdge(sessionCookie.value) : null;

  // If user is on /login
  if (pathname === "/login") {
    if (session && session.role_id !== undefined && session.role_id !== null) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Protected routes: redirect to login if no valid session
  if (!session || session.role_id === undefined || session.role_id === null) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const roleId = Number(session.role_id);

  // Check matching route permission
  for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === route || (route !== "/" && pathname.startsWith(route))) {
      if (!allowedRoles.includes(roleId)) {
        // Redirect unauthorized user to dashboard
        return NextResponse.redirect(new URL("/", req.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
