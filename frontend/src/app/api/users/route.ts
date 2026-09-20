import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/users - fetch users from Supabase profiles
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("mysql_id", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/users - create user in profiles
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, username, initials, usertype, usersubtype, role } = body;

    if (!name || !username || !initials || !usertype) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get max mysql_id to sequence new user
    const { data: maxRows } = await supabaseAdmin
      .from("profiles")
      .select("mysql_id")
      .order("mysql_id", { ascending: false })
      .limit(1);

    const nextId = (maxRows?.[0]?.mysql_id ?? 24) + 1;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .insert([
        {
          mysql_id: nextId,
          name,
          email: email || `${username.toLowerCase()}@star.in`,
          username,
          initials,
          usertype,
          usersubtype: usersubtype || "Skilled MP",
          role: role ?? 4,
          status: 1,
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ user: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
