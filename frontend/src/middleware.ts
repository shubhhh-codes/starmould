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

function parseSessionToken(token: string): { id: number; role_id: number; role: string } | null {
  if (!token || !token.includes(".")) return null;
  const [payload] = token.split(".");
  if (!payload) return null;
  try {
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
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

  // Get session cookie
  const sessionCookie = req.cookies.get("sm_session");
  const session = sessionCookie?.value ? parseSessionToken(sessionCookie.value) : null;

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
