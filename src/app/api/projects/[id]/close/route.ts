import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

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

    // 2. Strict In-Progress Work Guard
    // If any plate has PO created without inward, or work started without packing/dispatch: BLOCK!
    const projKey = project.projectid || project.id;
    const { data: subplates } = await supabaseAdmin
      .from("subplate")
      .select("id, platename, location, dispatch_status, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby")
      .or(`projectid.eq.${projKey},mold_code.eq.${projKey},mold_id.eq.${project.id}`)
      .is("deleted_at", null);

    const plateIds = (subplates || []).map((p: any) => p.id);
    const orderedSet = new Set<number>();
    const inwardSet = new Set<number>();

    if (plateIds.length > 0) {
      const [{ data: poItems }, { data: inwItems }] = await Promise.all([
        supabaseAdmin
          .from("purchase_items")
          .select("plateid, purchase:pid!inner(status)")
          .in("plateid", plateIds)
          .neq("purchase.status", "0"),
        supabaseAdmin
          .from("purchase_inward_items")
          .select("plateid")
          .in("plateid", plateIds),
      ]);

      (poItems || []).forEach((it: any) => {
        if (it.plateid) orderedSet.add(Number(it.plateid));
      });
      (inwItems || []).forEach((it: any) => {
        if (it.plateid) inwardSet.add(Number(it.plateid));
      });
    }

    const blockingErrors: string[] = [];
    (subplates || []).forEach((p: any) => {
      const isDispatched = p.location === "Customer" || p.dispatch_status === "dispatched";
      const isPacked = Number(p.packing_workby) > 0;
      if (isDispatched || isPacked) return; // Done

      const hasPO = orderedSet.has(Number(p.id)) || Number(p.order_by) > 0;
      const hasInward = inwardSet.has(Number(p.id)) || Number(p.received_workby) > 0;
      const hasStartedProduction =
        hasInward ||
        Number(p.received_qcby) > 0 ||
        Number(p.vmc_workby) > 0 ||
        Number(p.vmc_qcby) > 0 ||
        Number(p.drilltap_workby) > 0 ||
        Number(p.final_qcby) > 0;

      if (!hasPO && !hasStartedProduction) {
        // Unpurchased plate: allowed to close without procurement
        return;
      }

      if (hasPO && !hasInward) {
        blockingErrors.push(`Plate "${p.platename}": Purchase Order bana hua hai lekin Inward nahi aaya hai. Pehle Inward receive karein.`);
        return;
      }

      if (hasStartedProduction && !isPacked && !isDispatched) {
        blockingErrors.push(`Plate "${p.platename}": Kaam in-progress hai. Is plate ko Final Packing ya Delivery Challan tak complete karein.`);
        return;
      }
    });

    if (blockingErrors.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot move mould to Project Register: Some plates have in-progress work that must be completed first.`,
          details: blockingErrors,
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    // 3. Update parent mould project to completed
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

    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("scanning_default_");
    invalidateCache("subplate_default_");
    invalidateCache("shared_scans_lookup");

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
