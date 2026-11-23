import { hasCompletedManufacturing, isPurchaseOptional } from "@/lib/subplate-purchase";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";
import { startProjectRetentionCycle } from "@/lib/r2/retention";

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
    const closureReason = typeof body?.closureReason === "string" ? body.closureReason.trim() : "Direct Archive";
    const closureNotes = typeof body?.closureNotes === "string" ? body.closureNotes.trim() : "";
    if (!closureReason || closureReason.length > 200 || closureNotes.length > 2000 ||
        (closureReason === "Other / Custom Note" && !closureNotes)) {
      return NextResponse.json({ error: "Enter a valid closure reason and note." }, { status: 400 });
    }

    // 1. Fetch Project
    let projectQuery = supabaseAdmin.from("scan").select("id, projectid, status, worktype");
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
    const projectKey = project.projectid || String(project.id);
    const legacyLinks = `projectid.eq.${project.id},projectid.eq.${projectKey},mold_code.eq.${projectKey}`;
    const { data: subplates, error: platesError } = await supabaseAdmin
      .from("subplate")
      .select("id, platename, sqty, subplate_type, po_bypassed, location, dispatch_status, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby")
      .or(`mold_id.eq.${project.id},and(mold_id.is.null,or(${legacyLinks}))`)
      .is("deleted_at", null);

    if (platesError) return NextResponse.json({ error: "Could not verify project subplates." }, { status: 500 });

    const plateIds = (subplates || []).map((p: any) => p.id);
    const blockingErrors: string[] = [];
    let hasUndispatchedPlates = false;

    if (plateIds.length > 0) {
      const { data: jwBalances, error: balanceError } = await supabaseAdmin
        .from("view_subplate_jobwork_balance")
        .select("plateid, outward_jobwork_qty, active_vendors, has_po, po_ordered_qty, po_inward_qty, pending_po_inward_qty, customer_dispatched_qty")
        .in("plateid", plateIds);
      const balanceMap = new Map((jwBalances || []).map((balance) => [Number(balance.plateid), balance]));
      if (balanceError || plateIds.some((id) => !balanceMap.has(Number(id)))) {
        return NextResponse.json({ error: "Could not verify job-work and purchase balances." }, { status: 500 });
      }

      (subplates || []).forEach((p: any) => {
        const bal = balanceMap.get(Number(p.id));
        const totalQty = Number(p.sqty) || 1;
        const poOrdered = Number(bal?.po_ordered_qty ?? 0);
        const poInward = Number(bal?.po_inward_qty ?? 0);
        const pendingInward = Number(bal?.pending_po_inward_qty ?? (poOrdered > 0 ? Math.max(0, poOrdered - poInward) : 0));
        const dispatchedQty = Number(bal?.customer_dispatched_qty ?? 0);

        if (Number(bal?.outward_jobwork_qty) > 0) {
          blockingErrors.push(`Plate "${p.platename}": ${bal?.outward_jobwork_qty} pcs pending at ${bal?.active_vendors || "vendor"}. Record an Inward Challan before moving to Project Register.`);
          return;
        }

        // 1. HARD BLOCK: Pending Purchase Inward
        if (pendingInward > 0) {
          blockingErrors.push(`Plate "${p.platename}": Purchase Order is active, but material is pending inward (${pendingInward} of ${poOrdered} pcs pending). Please record Material Inward first.`);
          return;
        }

        // 2. HARD BLOCK: Partial Dispatch
        if (dispatchedQty > 0 && dispatchedQty < totalQty) {
          blockingErrors.push(`Plate "${p.platename}": Only ${dispatchedQty} of ${totalQty} pcs have been dispatched. Remaining ${totalQty - dispatchedQty} pcs must be completed and dispatched.`);
          return;
        }

        const isFullyDispatched = (dispatchedQty >= totalQty && totalQty > 0) ||
          ((p.location === "Customer" || p.dispatch_status === "dispatched") && pendingInward === 0 && (dispatchedQty === 0 || dispatchedQty >= totalQty));
        if (isFullyDispatched) return;
        hasUndispatchedPlates = true;

        const hasPO = Boolean(bal?.has_po || (!p.po_bypassed && Number(p.order_by) > 0));
        const hasInward = poInward > 0;
        // Check if shop floor work (Stage 4 to Stage 9) has started:
        const hasShopFloorStarted = Boolean(
          Number(p.received_qcby) > 0 ||
          Number(p.vmc_workby) > 0 ||
          Number(p.vmc_qcby) > 0 ||
          Number(p.drilltap_workby) > 0 ||
          Number(p.final_qcby) > 0 ||
          Number(p.packing_workby) > 0
        );

        if (!hasPO && !hasShopFloorStarted && !p.po_bypassed) {
          return;
        }

        if (hasPO && !hasInward) {
          blockingErrors.push(`Plate "${p.platename}": Purchase Order created but material has not been inwarded yet. Please record Material Inward first.`);
          return;
        }

        if (isPurchaseOptional(p, project.worktype) && hasCompletedManufacturing(p)) return;

        // If shop floor work has started (Stage 4 to Stage 9), HARD BLOCK until full packing and delivery
        if (hasShopFloorStarted || p.po_bypassed) {
          let stageName = "Manufacturing";
          if (Number(p.packing_workby) > 0) stageName = "Packing Done (Dispatch Pending)";
          else if (Number(p.final_qcby) > 0) stageName = "Final QC Done (Packing Pending)";
          else if (Number(p.drilltap_workby) > 0) stageName = "Drill & Tap Done";
          else if (Number(p.vmc_qcby) > 0) stageName = "VMC QC Done";
          else if (Number(p.vmc_workby) > 0) stageName = "VMC Machining Done";
          else if (Number(p.received_qcby) > 0) stageName = "Programming Work Started";

          blockingErrors.push(`Plate "${p.platename}": ${stageName}. ${isPurchaseOptional(p, project.worktype) ? "Complete Programming through Final Packing before closing." : "Complete all stages through Final Packing and Customer Delivery Challan."}`);
          return;
        }
      });
    }

    if (blockingErrors.length > 0) {
      return NextResponse.json(
        {
          error: blockingErrors[0],
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
        register_closure_reason: hasUndispatchedPlates ? closureReason : null,
        register_closure_notes: hasUndispatchedPlates ? closureNotes || null : null,
      })
      .eq("id", project.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: updateErr.code === "P0001" ? 409 : 500 });
    }

    // Start 30-day photo retention cycle (Requirement F08)
    try {
      await startProjectRetentionCycle(project.id, project.projectid || String(project.id));
    } catch (retentionErr) {
      console.warn("[ProjectClose] Failed to initiate photo retention cycle:", retentionErr);
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
