import { NextRequest, NextResponse } from "next/server";
import { createInventoryDocument } from "@/lib/inventory-documents";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, getCachedScansLookup, getCompletedProjectIds, invalidateCache } from "@/lib/cache";

// GET /api/purchase-inward - fetch open pending items directly from view_po_pending_inward_qty (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase_inward");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // 1. Concurrently query pending inward qty view, recent po_inward receipts, and cached customers
    const [viewRes, receiptsRes, customers, vendors] = await Promise.all([
      supabaseAdmin
        .from("view_po_pending_inward_qty")
        .select("*")
        .gt("pending_qty", 0)
        .order("id", { ascending: false }),
      supabaseAdmin
        .from("po_inward")
        .select("*")
        .order("id", { ascending: false })
        .limit(50),
      getCachedCustomers(),
      getCachedVendors(),
    ]);

    if (viewRes.error) {
      return NextResponse.json({ error: viewRes.error.message }, { status: 500 });
    }

    const pendingReceiveList = viewRes.data || [];
    const receipts = receiptsRes.data || [];

    const receiptIds = receipts.map((r) => r.id);
    let receiptItems: any[] = [];

    if (receiptIds.length > 0) {
      const { data: rItems } = await supabaseAdmin
        .from("purchase_inward_items")
        .select("*")
        .in("inpid", receiptIds)
        .limit(10000);
      receiptItems = rItems || [];
    }

    // Collect all plate IDs from both pending items and receipt items
    const allPlateIds = Array.from(
      new Set([
        ...pendingReceiveList.map((it: any) => it.plateid),
        ...receiptItems.map((it: any) => it.plateid),
      ].filter(Boolean))
    );

    let allSubplates: any[] = [];
    if (allPlateIds.length > 0) {
      const { data: sps } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, shape, width, height, length, weight, unit, material, plate_category")
        .in("id", allPlateIds.slice(0, 1000));
      allSubplates = sps || [];
    }

    const custMap = new Map((customers || []).map((c) => [c.id, c.customername]));
    const vendMap = new Map((vendors || []).map((v) => [v.id, v.vendor_name]));
    const inPlateMap = new Map(allSubplates.map((sp) => [sp.id, sp.platename]));

    const enrichedReceipts = receipts.map((r) => {
      const items = receiptItems
        .filter((it) => it.inpid === r.id)
        .map((it) => ({
          ...it,
          platename: inPlateMap.get(it.plateid) || `Plate #${it.plateid}`,
        }));

      return {
        ...r,
        vendorname: vendMap.get(r.vname) || `Vendor #${r.vname}`,
        customername: custMap.get(r.cname) || `Customer #${r.cname}`,
        items,
      };
    });

    const response = NextResponse.json({
      source: "view_po_pending_inward_qty",
      pendingReceiveItems: pendingReceiveList,
      receipts: enrichedReceipts,
      customers: customers || [],
      vendors: vendors || [],
      subplates: allSubplates,
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/purchase-inward?id=123 (Dual-Tier Role & 20-min Grace Timer + Downstream Guard)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase_inward");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Receipt ID required" }, { status: 400 });
    }

    const numId = Number(id);

    // 1. Fetch target inward receipt
    const { data: receipt, error: recFetchErr } = await supabaseAdmin
      .from("po_inward")
      .select("*")
      .eq("id", numId)
      .single();

    if (recFetchErr || !receipt) {
      return NextResponse.json({ error: "Inward receipt not found" }, { status: 404 });
    }

    // 2. Permission and Grace Timer Verification
    const roleId = Number(auth.user.role_id);
    const roleName = (auth.user.role || "").toLowerCase();
    const isAdminOrSuper = roleId === 0 || roleId === 1 || roleName === "admin" || roleName === "superadmin";

    if (!isAdminOrSuper) {
      // Must be creator
      if (receipt.created_by && Number(receipt.created_by) !== Number(auth.user.id)) {
        return NextResponse.json(
          { error: "You are not authorized to revert this inward receipt. Only the creator or an Administrator can revert it." },
          { status: 403 }
        );
      }
      // Check 20-minute window
      const createdAtTime = new Date(receipt.created_at).getTime();
      const elapsedMinutes = (Date.now() - createdAtTime) / (60 * 1000);
      if (elapsedMinutes > 20) {
        return NextResponse.json(
          {
            error: `The 20-minute undo window has expired (${Math.floor(elapsedMinutes)} minutes have passed). Please contact an Administrator to revert this inward.`,
          },
          { status: 403 }
        );
      }
    }

    // 3. Fetch line items for this inward receipt
    const { data: inwardItems, error: itemsErr } = await supabaseAdmin
      .from("purchase_inward_items")
      .select("id, plateid, qty, inward_qty")
      .eq("inpid", numId);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    const plateIds = Array.from(new Set((inwardItems || []).map((it: any) => it.plateid).filter(Boolean)));

    // 4. Downstream Dependency & Inventory Balance Checks
    if (plateIds.length > 0) {
      // Calculate total revert quantity per plate in this receipt
      const plateRevertQtyMap = new Map<number, number>();
      for (const it of inwardItems || []) {
        if (it.plateid) {
          const current = plateRevertQtyMap.get(it.plateid) || 0;
          const qty = Number(it.inward_qty ?? it.qty ?? 0);
          plateRevertQtyMap.set(it.plateid, current + qty);
        }
      }

      // Fetch subplates and physical balances concurrently
      const [platesRes, balRes] = await Promise.all([
        supabaseAdmin
          .from("subplate")
          .select("id, platename, received_qcby, vmc_workby, drilltap_workby, final_qcby, packing_workby")
          .in("id", plateIds),
        supabaseAdmin
          .from("view_subplate_jobwork_balance")
          .select("plateid, platename, available_sm_qty, outward_jobwork_qty, customer_dispatched_qty, po_inward_qty")
          .in("plateid", plateIds),
      ]);

      if (platesRes.error) {
        return NextResponse.json({ error: platesRes.error.message }, { status: 500 });
      }
      if (balRes.error) {
        return NextResponse.json({ error: balRes.error.message }, { status: 500 });
      }

      const plates = platesRes.data || [];
      const plateMap = new Map(plates.map((p: any) => [p.id, p.platename]));
      const balMap = new Map((balRes.data || []).map((b: any) => [b.plateid, b]));

      for (const pid of plateIds) {
        const revertQty = plateRevertQtyMap.get(pid) || 0;
        const bal = balMap.get(pid);
        const availableSmQty = Number(bal?.available_sm_qty ?? 0);
        const dispatchedQty = Number(bal?.customer_dispatched_qty ?? 0);
        const jobworkQty = Number(bal?.outward_jobwork_qty ?? 0);
        const totalInwardQty = Number(bal?.po_inward_qty ?? 0);
        const plateName = bal?.platename || plateMap.get(pid) || `Plate #${pid}`;

        // A. Stock availability guard:
        // You cannot revert more pieces than are physically available in the workshop.
        // If pieces were already dispatched or sent to external job work, reverting would cause negative inventory.
        if (availableSmQty < revertQty) {
          const reasons: string[] = [];
          if (dispatchedQty > 0) reasons.push(`${dispatchedQty} pcs already dispatched to customer`);
          if (jobworkQty > 0) reasons.push(`${jobworkQty} pcs on job work`);
          const reasonStr = reasons.length > 0 ? ` (${reasons.join(", ")})` : "";
          return NextResponse.json(
            {
              error: `Cannot revert inward receipt: Subplate "${plateName}" requires reverting ${revertQty} pcs, but only ${availableSmQty} pcs are currently available in the Star Mould workshop${reasonStr}.`,
            },
            { status: 409 }
          );
        }

        // B. Downstream production guard:
        // If downstream production (VMC, Drill/Tap, QC, Packing) has commenced and reverting this receipt leaves 0 raw material:
        const p = plates.find((pl: any) => pl.id === pid);
        const remainingAfterRevert = Math.max(0, totalInwardQty - revertQty);
        if (
          remainingAfterRevert === 0 &&
          p &&
          (p.received_qcby || p.vmc_workby || p.drilltap_workby || p.final_qcby || p.packing_workby)
        ) {
          return NextResponse.json(
            {
              error: `Cannot revert inward receipt: Downstream production (Machining / QC) has already commenced on subplate "${plateName}". Inwarded raw material cannot be completely removed while downstream stages are active.`,
            },
            { status: 409 }
          );
        }
      }
    }

    // 5. Execution: Delete receipt items and po_inward receipt
    const { error: itErr } = await supabaseAdmin
      .from("purchase_inward_items")
      .delete()
      .eq("inpid", numId);

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    const { error: delErr } = await supabaseAdmin
      .from("po_inward")
      .delete()
      .eq("id", numId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // 6. Reset or update Stage 3 (Material Inward) and location on affected subplates
    if (plateIds.length > 0) {
      const { data: remainingInwardRows } = await supabaseAdmin
        .from("purchase_inward_items")
        .select("plateid")
        .in("plateid", plateIds);

      const remainingPlateSet = new Set((remainingInwardRows || []).map((r: any) => r.plateid));
      const platesToReset = plateIds.filter((pid) => !remainingPlateSet.has(pid));
      const platesRemaining = plateIds.filter((pid) => remainingPlateSet.has(pid));

      if (platesToReset.length > 0) {
        await supabaseAdmin
          .from("subplate")
          .update({
            received_workby: null,
            received_work_at: null,
            received_qcby: null,
            received_qc_at: null,
            location: "Raw Stock",
            updated_at: new Date().toISOString(),
          })
          .in("id", platesToReset);
      }

      if (platesRemaining.length > 0) {
        const { data: updatedBalances } = await supabaseAdmin
          .from("view_subplate_jobwork_balance")
          .select("plateid, available_sm_qty, outward_jobwork_qty, customer_dispatched_qty, active_vendor_initials")
          .in("plateid", platesRemaining);

        for (const ub of updatedBalances || []) {
          let newLoc = "In-House";
          if (ub.active_vendor_initials && ub.available_sm_qty > 0) {
            newLoc = `SM, ${ub.active_vendor_initials}`;
          } else if (ub.active_vendor_initials) {
            newLoc = ub.active_vendor_initials;
          } else if (ub.customer_dispatched_qty > 0 && ub.available_sm_qty === 0) {
            newLoc = "Customer";
          }
          await supabaseAdmin
            .from("subplate")
            .update({ location: newLoc, updated_at: new Date().toISOString() })
            .eq("id", ub.plateid);
        }
      }
    }

    // 7. Invalidate caches
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("subplate_default_");
    invalidateCache("po_pending_inward");

    return NextResponse.json({
      success: true,
      message: `Purchase Inward receipt ${receipt.insrno} reverted successfully.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/purchase-inward - record an inward receipt against a PO (Admin, Manager only)
export async function POST(req: NextRequest) {
  return createInventoryDocument(req, "purchase-receipt");
}
