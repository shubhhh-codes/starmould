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
  "/printing": [0, 1, 2],
  "/purchase": [0, 1, 2],
  "/purchase-inward": [0, 1, 2],
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files, api routes, and login
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname === "/login" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Get session cookie
  const sessionCookie = req.cookies.get("sm_session");
  let roleId = 0; // Default fallback for offline/direct intranet access

  if (sessionCookie?.value) {
    try {
      const user = JSON.parse(sessionCookie.value);
      roleId = Number(user.role_id ?? 0);
    } catch {
      roleId = 0;
    }
  }

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
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
