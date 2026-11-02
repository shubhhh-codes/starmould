import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, invalidateCache } from "@/lib/cache";

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

    // 4. Downstream Dependency Checks
    if (plateIds.length > 0) {
      // A. Check Subplate Machining Status (Stages 4 & 5)
      const { data: plates, error: platesErr } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, vmc_workby, drilltap_workby, finish_workby")
        .in("id", plateIds);

      if (platesErr) {
        return NextResponse.json({ error: platesErr.message }, { status: 500 });
      }

      const plateMap = new Map((plates || []).map((p: any) => [p.id, p.platename]));

      for (const p of plates || []) {
        if (p.vmc_workby || p.drilltap_workby || p.finish_workby) {
          return NextResponse.json(
            {
              error: `Cannot revert inward receipt: Machining (VMC / Drill-Tap) has already commenced on subplate "${p.platename}". Reverting raw material would corrupt production tracking.`,
            },
            { status: 409 }
          );
        }
      }

      // B. Check Active Job Work Challans (Stage 6 outward movement)
      const { data: activeChallanItems, error: chErr } = await supabaseAdmin
        .from("challan_items")
        .select("id, plateid, qty, challan!inner(id, challanno, status)")
        .in("plateid", plateIds)
        .neq("challan.status", "0");

      if (chErr) {
        return NextResponse.json({ error: chErr.message }, { status: 500 });
      }

      if (activeChallanItems && activeChallanItems.length > 0) {
        const blocking = activeChallanItems[0];
        const plateName = plateMap.get(blocking.plateid) || `Plate #${blocking.plateid}`;
        const challanNo = (blocking.challan as any)?.challanno || "Job Work Challan";
        return NextResponse.json(
          {
            error: `Cannot revert inward receipt: Subplate "${plateName}" is already dispatched on Job Work Challan "${challanNo}". Please cancel or delete the Job Work Challan before reverting this inward.`,
          },
          { status: 409 }
        );
      }

      // C. Check Customer Dispatches (Final Stage 8 dispatch)
      const { data: activeDispatches, error: dispErr } = await supabaseAdmin
        .from("dispatch_items")
        .select("id, plateid, qty, dispatch!inner(id, challanno, status)")
        .in("plateid", plateIds)
        .neq("dispatch.status", "0");

      if (dispErr) {
        return NextResponse.json({ error: dispErr.message }, { status: 500 });
      }

      if (activeDispatches && activeDispatches.length > 0) {
        const blockingDisp = activeDispatches[0];
        const plateName = plateMap.get(blockingDisp.plateid) || `Plate #${blockingDisp.plateid}`;
        const dispatchNo = (blockingDisp.dispatch as any)?.challanno || "Dispatch Note";
        return NextResponse.json(
          {
            error: `Cannot revert inward receipt: Subplate "${plateName}" has already been dispatched to customer on "${dispatchNo}".`,
          },
          { status: 409 }
        );
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

    // 6. Reset Stage 3 (Material Inward) on affected subplates if no other inward receipt exists
    if (plateIds.length > 0) {
      const { data: remainingInwardRows } = await supabaseAdmin
        .from("purchase_inward_items")
        .select("plateid")
        .in("plateid", plateIds);

      const remainingPlateSet = new Set((remainingInwardRows || []).map((r: any) => r.plateid));
      const platesToReset = plateIds.filter((pid) => !remainingPlateSet.has(pid));

      if (platesToReset.length > 0) {
        await supabaseAdmin
          .from("subplate")
          .update({
            received_workby: null,
            received_work_at: null,
            received_qcby: null,
            received_qc_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", platesToReset);
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
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase_inward");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const pid = body.pid || body.poid;
    const cname = body.cname || body.customerid;
    const vname = body.vname || body.vendorid;
    const inpono = body.inpono;
    const projectid = body.projectid;
    const odate = body.odate;
    const items = body.items;

    if (!pid || !cname || !vname || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required receipt fields" }, { status: 400 });
    }

    const numPid = Number(pid);

    // Validate incoming inward quantities against remaining pending quantities from PO view
    const { data: poPendingList, error: pendingErr } = await supabaseAdmin
      .from("view_po_pending_inward_qty")
      .select("id, plateid, qty, inward_qty, pending_qty, platename")
      .eq("id", numPid);

    if (pendingErr) {
      return NextResponse.json({ error: pendingErr.message }, { status: 500 });
    }

    const pendingMap = new Map<number, any>();
    (poPendingList || []).forEach((row: any) => {
      const plateKey = Number(row.plateid);
      if (plateKey) pendingMap.set(plateKey, row);
    });

    for (const it of items) {
      const inQty = Number(it.inward_qty);
      if (isNaN(inQty) || inQty <= 0) {
        return NextResponse.json({ error: "Inward quantity must be a positive number greater than 0" }, { status: 400 });
      }

      const plateId = Number(it.plateid);
      if (plateId && pendingMap.has(plateId)) {
        const poLine = pendingMap.get(plateId);
        const pendingQty = Number(poLine.pending_qty) || 0;
        if (inQty > pendingQty) {
          const name = poLine.platename || it.imaterial || it.material || `Plate #${plateId}`;
          return NextResponse.json(
            {
              error: `Inward quantity (${inQty}) exceeds remaining pending quantity (${pendingQty}) on this PO for "${name}".`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Sequence SM/PR/xx with retry loop on collision (Issue #3)
    const { count } = await supabaseAdmin
      .from("po_inward")
      .select("*", { count: "exact", head: true });

    let receipt: any = null;
    let recErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const nextSeq = (count ?? 0) + 1 + attempt;
      const insrno = nextSeq < 10 ? `SM/PR/0${nextSeq}` : `SM/PR/${nextSeq}`;

      const res = await supabaseAdmin
        .from("po_inward")
        .insert([
          {
            pid,
            insrno,
            inpono: inpono || null,
            cname,
            vname,
            projectid,
            odate: odate || new Date().toISOString().slice(0, 10),
            status: "1",
            created_at: new Date().toISOString(),
            created_by: auth.user.id ? Number(auth.user.id) : null,
          },
        ])
        .select()
        .single();

      if (!res.error) {
        receipt = res.data;
        recErr = null;
        break;
      }
      recErr = res.error;
      if (res.error.code !== "23505" && !res.error.message?.includes("unique constraint")) {
        break;
      }
    }

    if (recErr) {
      return NextResponse.json({ error: recErr.message }, { status: 500 });
    }

    // 2. Insert inward line items
    const inwardItemsToInsert = items.map((it: any) => ({
      inpid: receipt.id,
      pid,
      plateid: it.plateid,
      material: it.material || "",
      imaterial: it.imaterial || it.material || "",
      materialtype: it.materialtype || "",
      qty: it.qty || 1,
      inward_qty: it.inward_qty || 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: createdInwardItems, error: itErr } = await supabaseAdmin
      .from("purchase_inward_items")
      .insert(inwardItemsToInsert)
      .select();

    if (itErr) {
      await supabaseAdmin.from("po_inward").delete().eq("id", receipt.id);
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    // Auto-sync subplates received_workby & received_work_at so programming queue updates
    const inwardPlateIds = inwardItemsToInsert.map((it: any) => it.plateid).filter(Boolean);
    if (inwardPlateIds.length > 0) {
      await supabaseAdmin
        .from("subplate")
        .update({
          received_workby: auth.user.id || 1,
          received_work_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", inwardPlateIds)
        .is("received_workby", null);
    }

    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("subplate_default_");

    return NextResponse.json({
      receipt: {
        ...receipt,
        items: createdInwardItems,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
