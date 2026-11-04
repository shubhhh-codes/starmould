import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { signSession, SessionUser } from "@/lib/auth";
import { consumeLoginBudget } from "@/lib/login-rate-limit";
import { serverLogger } from "@/lib/server-logger";
import { rolePermissionVersion } from "@/lib/permissions/version";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (typeof username !== "string" || typeof password !== "string" || !username || !password || username.length > 254 || password.length > 1024) {
      return NextResponse.json({ error: "Username/email and password are required" }, { status: 400 });
    }

    const cleanUsername = username.trim();
    // Sanitize wildcards (%, _) and PostgREST grammar breaks ((), ,)
    const safeUsername = cleanUsername.replace(/[%_(),]/g, "");

    // Query active user by username or email (case-insensitive)
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, username, role_id, usertype, usersubtype, initials, status, password_hash, must_change_password")
      .is("deleted_at", null)
      .or(`username.ilike.${safeUsername},email.ilike.${safeUsername}`);

    if (error) {
      serverLogger.error("Login user query failed in database", error.message, {
        route: "/api/auth/login",
        status: 500,
        payload: { username: safeUsername },
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const user = users?.[0];
    const budget = await consumeLoginBudget(req, user ? `user:${user.id}` : `login:${cleanUsername}`);
    if (!budget.allowed) return NextResponse.json({ error: budget.status === 503 ? "Login verification temporarily unavailable" : "Too many login attempts" }, {
      status: budget.status, headers: { "Retry-After": String(budget.retryAfter) },
    });
    if (!user) {
      return NextResponse.json(
        { error: "No account found with this username or email" },
        { status: 404 }
      );
    }

    if (user.status !== null && user.status !== undefined && (String(user.status).toLowerCase() === "inactive" || String(user.status) === "0")) {
      return NextResponse.json({ error: "User account is deactivated. Please contact administrator." }, { status: 403 });
    }

    // Verify bcrypt hash (strictly from database, 100% bcrypt.compare, zero backdoors or plaintext fallback)
    const storedHash = user.password_hash;

    if (!storedHash || (!storedHash.startsWith("$2y$") && !storedHash.startsWith("$2a$") && !storedHash.startsWith("$2b$"))) {
      return NextResponse.json({ error: "Account credentials misconfigured. Please reset password." }, { status: 401 });
    }

    // Laravel uses $2y$ prefix, which bcryptjs evaluates under $2a$ prefix
    const normalizedHash = storedHash.replace(/^\$2y\$/, "$2a$");
    const passwordMatches = await bcrypt.compare(password, normalizedHash);

    if (!passwordMatches) {
      return NextResponse.json({ error: "Incorrect password. Please try again." }, { status: 401 });
    }

    // Reset rate limiter on successful authentication
    // Successful logins do not reset shared IP or account guessing budgets.

    // Role definitions:
    // 0: Admin, 1: Manager, 2: Supervisor, 3: Designer, 4: Worker, 5: Purchase Incharge, 6: VMC, 7: QC, 9: Dispatch, 10: Programmer
    const roleId = user.role_id !== null && user.role_id !== undefined ? Number(user.role_id) : 4;
    const roleNames: Record<number, string> = {
      0: "Admin",
      1: "Manager",
      2: "Supervisor",
      3: "Designer",
      4: "Worker",
      5: "Purchase Incharge",
      6: "VMC Department",
      7: "Quality Checking (QC)",
      9: "Dispatch",
      10: "Programmer",
    };

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role_id: roleId,
      role: roleNames[roleId] || "Worker",
      usertype: user.usertype,
      usersubtype: user.usersubtype,
      initials: user.initials,
      must_change_password: user.must_change_password === true,
    };

    try { sessionUser.permissions_version = await rolePermissionVersion(roleId); } catch {
      return NextResponse.json({ error: "Permission verification temporarily unavailable" }, { status: 503 });
    }
    const signedToken = signSession(sessionUser);

    const res = NextResponse.json({
      success: true,
      user: sessionUser,
      must_change_password: sessionUser.must_change_password,
    });

    const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

    // Set signed, HttpOnly auth cookie
    res.cookies.set("sm_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err: unknown) {
    serverLogger.error("Uncaught exception in login handler", err, {
      route: "/api/auth/login",
      method: "POST",
      status: 500,
    });
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
