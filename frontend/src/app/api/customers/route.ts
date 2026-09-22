import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/customers - fetch active customers/vendors from Supabase
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const usertype = searchParams.get("usertype");
    const checkInitial = searchParams.get("checkInitial");
    const checkUsername = searchParams.get("checkUsername");
    const excludeId = searchParams.get("excludeId");

    // 1. Initial existence check (replicates checkinitials in CustomerController.php:44-50)
    if (checkInitial) {
      const clean = checkInitial.replace(/\s+/g, "").toUpperCase();
      let query = supabaseAdmin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("initials", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // 2. Username existence check (replicates checkusername in CustomerController.php:29-43)
    if (checkUsername) {
      const clean = checkUsername.trim();
      let query = supabaseAdmin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("customername", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // 3. Main listing query (replicates CustomerModel::latest()->get() with SoftDeletes)
    let query = supabaseAdmin
      .from("customers")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: false });

    if (usertype && usertype !== "All") {
      query = query.eq("usertype", usertype);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/customers - create customer in Supabase (replicates store / addcustomer)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customername, mobile, mobile1, email, initials, address, usertype } = body;

    const cleanName = customername?.trim();
    const cleanInitials = initials?.replace(/\s+/g, "").toUpperCase().slice(0, 3);

    if (!cleanName) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (!cleanInitials) {
      return NextResponse.json({ error: "Initials are required (max 3 letters)" }, { status: 400 });
    }
    if (!usertype) {
      return NextResponse.json({ error: "Usertype is required" }, { status: 400 });
    }

    // Check duplicate initials against active records
    const { data: existingInitials } = await supabaseAdmin
      .from("customers")
      .select("id")
      .is("deleted_at", null)
      .ilike("initials", cleanInitials)
      .limit(1);

    if (existingInitials && existingInitials.length > 0) {
      return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
    }

    // Check duplicate name against active records
    const { data: existingName } = await supabaseAdmin
      .from("customers")
      .select("id")
      .is("deleted_at", null)
      .ilike("customername", cleanName)
      .limit(1);

    if (existingName && existingName.length > 0) {
      return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert([
        {
          customername: cleanName,
          initials: cleanInitials,
          mobile: mobile?.trim() || null,
          mobile1: mobile1?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
          usertype,
          created_at: now,
          updated_at: now,
          created_by: 0,
          updated_by: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data, message: "Data added successfully" }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/customers - update customer in Supabase (replicates updatecustomer / updatedata)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, customername, mobile, mobile1, email, address, usertype } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    const cleanName = customername?.trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    // Check duplicate name against other active records
    const { data: existingName } = await supabaseAdmin
      .from("customers")
      .select("id")
      .is("deleted_at", null)
      .neq("id", id)
      .ilike("customername", cleanName)
      .limit(1);

    if (existingName && existingName.length > 0) {
      return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      customername: cleanName,
      mobile: mobile?.trim() || null,
      mobile1: mobile1?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      updated_at: now,
    };

    if (usertype) {
      updatePayload.usertype = usertype;
    }

    const { data, error } = await supabaseAdmin
      .from("customers")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data, message: "Data updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/customers - soft-delete customer in Supabase (replicates deletecustomer / destroy)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    // Perform soft delete by setting deleted_at timestamp (replicates Eloquent SoftDeletes)
    const { error } = await supabaseAdmin
      .from("customers")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Customer deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
