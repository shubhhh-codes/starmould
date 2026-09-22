import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/gram - fetch all gram pricing rules from gram_calc (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("gram_calc")
      .select("*")
      .order("graterthan", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tiers: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/gram - create new gram pricing tier (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { graterthan, lessthan, fix, multiply } = body;

    const min = Number(graterthan ?? 0);
    const max = Number(lessthan ?? 0);
    const fixVal = Number(fix ?? 0);
    const mulVal = Number(multiply ?? 0);

    if (min > max) {
      return NextResponse.json({ error: "Min weight cannot be greater than max weight" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("gram_calc")
      .insert([
        {
          graterthan: min,
          lessthan: max,
          fix: fixVal,
          multiply: mulVal,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tier: data, message: "Gram pricing tier added successfully" }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/gram - update gram tier (Admin, Manager only)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, graterthan, lessthan, fix, multiply } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing tier id" }, { status: 400 });
    }

    const min = Number(graterthan ?? 0);
    const max = Number(lessthan ?? 0);
    const fixVal = Number(fix ?? 0);
    const mulVal = Number(multiply ?? 0);

    if (min > max) {
      return NextResponse.json({ error: "Min weight cannot be greater than max weight" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("gram_calc")
      .update({
        graterthan: min,
        lessthan: max,
        fix: fixVal,
        multiply: mulVal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tier: data, message: "Gram tier updated successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/gram - delete gram tier (Admin, Manager only)
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
      return NextResponse.json({ error: "Missing tier id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("gram_calc")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Gram tier deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
