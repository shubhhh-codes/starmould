import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

// Helper to determine role_id based on usertype (matches UserController.php:81-95)
function getRoleIdFromUsertype(usertype: string): number {
  switch (usertype) {
    case "Admin":
      return 0;
    case "Manager":
      return 1;
    case "Supervisor":
      return 2;
    case "Designer":
      return 3;
    default:
      return 4; // Worker / User
  }
}

// GET /api/users - fetch users from Supabase users table with roles
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const checkInitial = searchParams.get("checkInitial");
    const checkUsername = searchParams.get("checkUsername");
    const excludeId = searchParams.get("excludeId");

    // Initials existence check (replicates UserController.php:256-262 checkinitial)
    if (checkInitial) {
      const clean = checkInitial.replace(/\s+/g, "").toUpperCase();
      let query = supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("initials", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }
      const { count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // Username existence check
    if (checkUsername) {
      const clean = checkUsername.trim();
      let query = supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("username", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }
      const { count, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // Fetch active users from users table
    const { data: users, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id, name, username, initials, email, usertype, usersubtype, role_id, status, created_at, updated_at")
      .is("deleted_at", null)
      .order("id", { ascending: true });

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    // Fetch roles table for enrichment
    const { data: roles } = await supabaseAdmin.from("roles").select("*").order("id", { ascending: true });

    return NextResponse.json({
      users: users || [],
      roles: roles || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/users - create user in Supabase (matches UserController.php:66-109 store / adduser)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { name, email, username, initials, usertype, usersubtype, status, role_id } = body;

    const cleanName = name?.trim();
    const cleanUsername = username?.trim();
    const cleanInitials = initials?.replace(/\s+/g, "").toUpperCase().slice(0, 5);

    if (!cleanName || !cleanUsername || !cleanInitials || !usertype) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Duplicate check for username
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .is("deleted_at", null)
      .ilike("username", cleanUsername)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json({ error: "Username already exists!" }, { status: 400 });
    }

    // Duplicate check for initials
    const { data: existingInit } = await supabaseAdmin
      .from("users")
      .select("id")
      .is("deleted_at", null)
      .ilike("initials", cleanInitials)
      .limit(1);

    if (existingInit && existingInit.length > 0) {
      return NextResponse.json({ error: "Initials already exist!" }, { status: 400 });
    }

    // Auto-derive subtype & role_id matching legacy UserController.php:75-95
    let finalSubtype = usersubtype || "Skilled MP";
    if (["Admin", "Manager", "Supervisor", "Designer"].includes(usertype)) {
      finalSubtype = "Skilled MP";
    }
    const finalRoleId = role_id !== undefined ? Number(role_id) : getRoleIdFromUsertype(usertype);

    const now = new Date().toISOString();
    const rawPassword = body.password || "password";
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert([
        {
          name: cleanName,
          email: email?.trim() || `${cleanUsername.toLowerCase()}@star.in`,
          username: cleanUsername,
          initials: cleanInitials,
          usertype,
          usersubtype: finalSubtype,
          role_id: finalRoleId,
          status: status !== undefined ? Number(status) : 1,
          password_hash: passwordHash,
          created_at: now,
          updated_at: now,
        },
      ])
      .select("id, name, username, initials, email, usertype, usersubtype, role_id, status, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("shared_users");
    invalidateCache("api_counts_all");

    return NextResponse.json({ user: data, message: "User added successfully." }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/users - update user in Supabase (matches UserController.php:161-240 updatedata / updateuser)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, name, email, username, initials, usertype, usersubtype, status, role_id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const cleanName = name?.trim();
    const cleanUsername = username?.trim();
    const cleanInitials = initials?.replace(/\s+/g, "").toUpperCase().slice(0, 5);

    // Duplicate check for username
    if (cleanUsername) {
      const { data: existingUser } = await supabaseAdmin
        .from("users")
        .select("id")
        .is("deleted_at", null)
        .neq("id", id)
        .ilike("username", cleanUsername)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        return NextResponse.json({ error: "Username already exists!" }, { status: 400 });
      }
    }

    const numId = Number(id);

    // Fetch existing user to check role and status transitions
    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("id, role_id, status")
      .eq("id", numId)
      .is("deleted_at", null)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let finalSubtype = usersubtype;
    if (usertype && ["Admin", "Manager", "Supervisor", "Designer"].includes(usertype)) {
      finalSubtype = "Skilled MP";
    }

    const newRoleId = usertype ? (role_id !== undefined ? Number(role_id) : getRoleIdFromUsertype(usertype)) : (role_id !== undefined ? Number(role_id) : undefined);
    const newStatus = status !== undefined ? Number(status) : undefined;

    // Self-admin protection: cannot deactivate or demote own Admin account
    if (numId === auth.user.id && Number(targetUser.role_id) === 0) {
      if (newStatus === 0) {
        return NextResponse.json({ error: "Cannot deactivate your own Administrator account" }, { status: 400 });
      }
      if (newRoleId !== undefined && newRoleId !== 0) {
        return NextResponse.json({ error: "Cannot demote your own Administrator account" }, { status: 400 });
      }
    }

    // Last-admin protection: cannot deactivate or demote the only active Administrator
    if (Number(targetUser.role_id) === 0 && (newStatus === 0 || (newRoleId !== undefined && newRoleId !== 0))) {
      const { count: adminCount } = await supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role_id", 0)
        .eq("status", 1)
        .is("deleted_at", null);

      if ((adminCount || 0) <= 1) {
        return NextResponse.json({ error: "Cannot deactivate or demote the only active Administrator" }, { status: 400 });
      }
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (cleanName) updatePayload.name = cleanName;
    if (cleanUsername) updatePayload.username = cleanUsername;
    if (cleanInitials) updatePayload.initials = cleanInitials;
    if (email) updatePayload.email = email.trim();
    if (usertype) updatePayload.usertype = usertype;
    if (newRoleId !== undefined) updatePayload.role_id = newRoleId;
    if (finalSubtype) updatePayload.usersubtype = finalSubtype;
    if (newStatus !== undefined) updatePayload.status = newStatus;

    const { data, error } = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      .eq("id", id)
      .select("id, name, username, initials, email, usertype, usersubtype, role_id, status, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("shared_users");
    invalidateCache("api_counts_all");

    return NextResponse.json({ user: data, message: "User updated successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/users - soft delete user (matches UserController.php:305-334 destroy / deleteuser)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const numId = Number(id);
    if (numId === auth.user.id) {
      return NextResponse.json({ error: "Cannot delete your own active account" }, { status: 400 });
    }

    // Check if user is the last admin
    const { data: targetUser } = await supabaseAdmin
      .from("users")
      .select("role_id")
      .eq("id", numId)
      .single();

    if (targetUser && Number(targetUser.role_id) === 0) {
      const { count: adminCount } = await supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role_id", 0)
        .is("deleted_at", null);

      if ((adminCount || 0) <= 1) {
        return NextResponse.json({ error: "Cannot delete the only active Administrator" }, { status: 400 });
      }
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("shared_users");
    invalidateCache("api_counts_all");

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
