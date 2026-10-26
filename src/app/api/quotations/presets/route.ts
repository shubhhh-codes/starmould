import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/quotations/presets - fetch terms & conditions presets
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("quotation_terms_presets")
      .select("*")
      .order("is_default", { ascending: false })
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ presets: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/quotations/presets - create new preset
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      title,
      price_terms,
      delivery_terms,
      payment_terms,
      validity_terms,
      force_majeure,
      is_default,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Preset title is required" }, { status: 400 });
    }

    // If setting as default, clear existing defaults first
    if (is_default) {
      await supabaseAdmin
        .from("quotation_terms_presets")
        .update({ is_default: false })
        .neq("id", 0);
    }

    const { data, error } = await supabaseAdmin
      .from("quotation_terms_presets")
      .insert({
        title: title.trim(),
        price_terms: price_terms || null,
        delivery_terms: delivery_terms || null,
        payment_terms: payment_terms || null,
        validity_terms: validity_terms || null,
        force_majeure: force_majeure || null,
        is_default: Boolean(is_default),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preset: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/quotations/presets - update existing preset
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      id,
      title,
      price_terms,
      delivery_terms,
      payment_terms,
      validity_terms,
      force_majeure,
      is_default,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Preset ID is required" }, { status: 400 });
    }

    if (is_default) {
      await supabaseAdmin
        .from("quotation_terms_presets")
        .update({ is_default: false })
        .neq("id", id);
    }

    const { data, error } = await supabaseAdmin
      .from("quotation_terms_presets")
      .update({
        title: title?.trim(),
        price_terms,
        delivery_terms,
        payment_terms,
        validity_terms,
        force_majeure,
        is_default: Boolean(is_default),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preset: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/quotations/presets - delete a preset
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Preset ID is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("quotation_terms_presets")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
