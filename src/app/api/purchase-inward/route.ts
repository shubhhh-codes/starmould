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

// DELETE /api/purchase-inward?id=123 (Admin, Manager only)
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

    const { error: itErr } = await supabaseAdmin
      .from("purchase_inward_items")
      .delete()
      .eq("inpid", Number(id));

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin
      .from("po_inward")
      .delete()
      .eq("id", Number(id));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("subplate_default_");

    return NextResponse.json({ success: true });
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
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    // Auto-sync subplates received_workby & received_workat so programming queue updates
    const inwardPlateIds = inwardItemsToInsert.map((it: any) => it.plateid).filter(Boolean);
    if (inwardPlateIds.length > 0) {
      await supabaseAdmin
        .from("subplate")
        .update({
          received_workby: auth.user.id || 1,
          received_workat: new Date().toISOString(),
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
