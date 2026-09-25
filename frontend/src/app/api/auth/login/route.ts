import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { signSession, SessionUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username/email and password are required" }, { status: 400 });
    }

    const cleanUsername = username.trim();
    // Sanitize commas and parentheses to prevent PostgREST expression injection, while preserving dots, @, hyphens in email/username
    const safeUsername = cleanUsername.replace(/[(),]/g, "");

    // Query active user by username or email (case-insensitive)
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, name, email, username, role_id, usertype, usersubtype, initials, status, password_hash")
      .is("deleted_at", null)
      .or(`username.ilike.${safeUsername},email.ilike.${safeUsername}`);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const user = users?.[0];
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

    // Role definitions:
    // 0: Admin, 1: Manager, 2: Supervisor, 3: Designer, 4: Worker
    const roleId = user.role_id !== null && user.role_id !== undefined ? Number(user.role_id) : 4;
    const roleNames: Record<number, string> = {
      0: "Admin",
      1: "Manager",
      2: "Supervisor",
      3: "Designer",
      4: "Worker",
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
    };

    const signedToken = signSession(sessionUser);

    const res = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    // Set signed, HttpOnly, secure auth cookie
    res.cookies.set("sm_session", signedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
