import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req, [0, 1, 2], "action_edit_mould");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const trimmedId = decodeURIComponent(id).trim();
    const body = await req.json().catch(() => ({}));
    const { directClosePlateIds = [], closureReason = "Direct Archive", closureNotes = "" } = body;

    // 1. Fetch Project
    let projectQuery = supabaseAdmin.from("scan").select("id, projectid, status");
    if (!isNaN(Number(trimmedId))) {
      projectQuery = projectQuery.or(`id.eq.${trimmedId},projectid.eq.${trimmedId}`);
    } else {
      projectQuery = projectQuery.eq("projectid", trimmedId);
    }

    const { data: project, error: projErr } = await projectQuery.maybeSingle();
    if (projErr || !project) {
      return NextResponse.json({ error: "Mould project not found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    // 2. Update parent mould project to completed
    const { error: updateErr } = await supabaseAdmin
      .from("scan")
      .update({
        status: "completed",
        dispatchdate: todayDate,
        updated_at: nowIso,
      })
      .eq("id", project.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. If any undispatched plates are closed directly, update their closure metadata
    if (Array.isArray(directClosePlateIds) && directClosePlateIds.length > 0) {
      const formattedReason = closureNotes
        ? `${closureReason} - ${closureNotes}`
        : closureReason;

      await supabaseAdmin
        .from("subplate")
        .update({
          dispatch_status: "closed_without_challan",
          closure_reason: formattedReason,
          closed_at: nowIso,
          closed_by: auth.user?.id || 1,
          updated_at: nowIso,
        })
        .in("id", directClosePlateIds.map(Number));
    }

    return NextResponse.json({
      success: true,
      message: `Project ${project.projectid || project.id} moved to Project Register successfully`,
      projectId: project.id,
      completedDate: todayDate,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
