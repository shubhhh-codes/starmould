import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/customers - fetch all customers/vendors from Supabase
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const usertype = searchParams.get("usertype");

    let query = supabaseAdmin
      .from("customers")
      .select("*")
      .order("id", { ascending: false });

    if (usertype && usertype !== "All") {
      query = query.eq("usertype", usertype);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/customers - create customer in Supabase
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customername, mobile, mobile1, email, initials, address, usertype } = body;

    if (!customername || !initials || !usertype) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert([
        {
          customername,
          mobile: mobile || null,
          mobile1: mobile1 || null,
          email: email || null,
          initials,
          address: address || null,
          usertype,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/customers - update customer in Supabase
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, customername, mobile, mobile1, email, initials, address, usertype } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({
        customername,
        mobile: mobile || null,
        mobile1: mobile1 || null,
        email: email || null,
        address: address || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/customers - delete customer in Supabase
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("customers").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
