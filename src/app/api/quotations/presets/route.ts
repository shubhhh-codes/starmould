import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/quotations/presets - fetch modular terms presets
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    let query = supabaseAdmin
      .from("quotation_terms_presets")
      .select("id, term_type, title, content, is_default, created_at, updated_at");

    if (type) {
      query = query.eq("term_type", type);
    }

    const { data, error } = await query
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
    const { term_type = "price", title, content, is_default } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Preset title is required" }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Preset content text is required" }, { status: 400 });
    }

    // Clear defaults ONLY for this term_type if marking as default
    if (is_default) {
      await supabaseAdmin
        .from("quotation_terms_presets")
        .update({ is_default: false })
        .eq("term_type", term_type);
    }

    const { data, error } = await supabaseAdmin
      .from("quotation_terms_presets")
      .insert({
        term_type,
        title: title.trim(),
        content: content.trim(),
        is_default: Boolean(is_default),
        updated_at: new Date().toISOString(),
      })
      .select("id, term_type, title, content, is_default, created_at, updated_at")
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
    const { id, term_type, title, content, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: "Preset ID is required" }, { status: 400 });
    }

    const tType = term_type || "price";

    if (is_default) {
      await supabaseAdmin
        .from("quotation_terms_presets")
        .update({ is_default: false })
        .eq("term_type", tType)
        .neq("id", id);
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (term_type !== undefined) updatePayload.term_type = term_type;
    if (title !== undefined) updatePayload.title = title.trim();
    if (content !== undefined) updatePayload.content = content.trim();
    if (is_default !== undefined) updatePayload.is_default = Boolean(is_default);

    const { data, error } = await supabaseAdmin
      .from("quotation_terms_presets")
      .update(updatePayload)
      .eq("id", id)
      .select("id, term_type, title, content, is_default, created_at, updated_at")
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
