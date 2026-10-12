import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";
import { serverLogger } from "@/lib/server-logger";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    serverLogger.warn("POST /api/auth/change-password: Authentication failed", {
      status: auth.status,
      error: auth.error,
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    // Fetch user's stored password hash
    const { data: user, error: fetchErr } = await supabaseAdmin
      .from("users")
      .select("id, password_hash")
      .eq("id", auth.user.id)
      .single();

    if (fetchErr || !user) {
      return NextResponse.json({ error: "User record not found" }, { status: 404 });
    }

    const storedHash = user.password_hash;
    if (!storedHash) {
      return NextResponse.json(
        { error: "Account security error: No password hash found. Contact admin." },
        { status: 400 }
      );
    }

    // Laravel uses $2y$ prefix, which bcryptjs evaluates under $2a$ prefix
    const normalizedHash = storedHash.replace(/^\$2y\$/, "$2a$");
    const isCurrentValid = await bcrypt.compare(currentPassword, normalizedHash);

    if (!isCurrentValid) {
      return NextResponse.json(
        { error: "Incorrect current password" },
        { status: 400 }
      );
    }

    // Hash the new password with bcrypt
    const newHash = await bcrypt.hash(newPassword, 10);
    const now = new Date().toISOString();

    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({
        password_hash: newHash,
        must_change_password: false, // Reset forced reset flag
        updated_at: now,
      })
      .eq("id", auth.user.id);

    if (updateErr) {
      serverLogger.error("Failed to update password in database", updateErr.message, {
        route: "/api/auth/change-password",
        status: 500,
        userId: auth.user.id,
        username: auth.user.username,
      });
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Invalidate user auth cache so subsequent requests see must_change_password = false
    invalidateCache(`auth_user_record_${auth.user.id}`);
    invalidateCache("shared_users");

    serverLogger.info(`Password successfully changed for user ${auth.user.username} (ID: ${auth.user.id})`);

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err: unknown) {
    serverLogger.error("Uncaught exception in change-password handler", err, {
      route: "/api/auth/change-password",
      status: 500,
      userId: auth.user.id,
      username: auth.user.username,
    });
    const message = err instanceof Error ? err.message : "Failed to change password";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
