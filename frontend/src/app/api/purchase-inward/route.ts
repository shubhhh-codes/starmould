import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/purchase-inward - fetch open pending items directly from view_po_pending_inward_qty (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // 1. Query view_po_pending_inward_qty directly (single source of truth)
    const { data: viewData, error: viewErr } = await supabaseAdmin
      .from("view_po_pending_inward_qty")
      .select("*")
      .gt("pending_qty", 0)
      .order("id", { ascending: false });

    if (viewErr) {
      return NextResponse.json({ error: viewErr.message }, { status: 500 });
    }

    const pendingReceiveList = viewData || [];

    // 2. Fetch recent inward receipts history from po_inward
    const { data: receipts } = await supabaseAdmin
      .from("po_inward")
      .select("*")
      .order("id", { ascending: false })
      .limit(50);

    const receiptIds = (receipts || []).map((r) => r.id);
    const { data: receiptItems } = await supabaseAdmin
      .from("purchase_inward_items")
      .select("*")
      .in("inpid", receiptIds);

    const { data: customers } = await supabaseAdmin.from("customers").select("id, customername");
    const custMap = new Map((customers || []).map((c) => [c.id, c.customername]));

    const inPlateIds = Array.from(new Set((receiptItems || []).map((it) => it.plateid)));
    const { data: inSubplates } = await supabaseAdmin
      .from("subplate")
      .select("id, platename")
      .in("id", inPlateIds.slice(0, 500));
    const inPlateMap = new Map((inSubplates || []).map((sp) => [sp.id, sp.platename]));

    const enrichedReceipts = (receipts || []).map((r) => {
      const items = (receiptItems || [])
        .filter((it) => it.inpid === r.id)
        .map((it) => ({
          ...it,
          platename: inPlateMap.get(it.plateid) || `Plate #${it.plateid}`,
        }));

      return {
        ...r,
        vendorname: custMap.get(r.vname) || `Vendor #${r.vname}`,
        customername: custMap.get(r.cname) || `Customer #${r.cname}`,
        items,
      };
    });

    return NextResponse.json({
      source: "view_po_pending_inward_qty",
      pendingReceiveItems: pendingReceiveList,
      receipts: enrichedReceipts,
      customers: customers || [],
      subplates: inSubplates || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/purchase-inward?id=123 (Admin, Manager only)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/purchase-inward - record an inward receipt against a PO (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
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

    // Sequence SM/PR/xx (matching PurchaseInwardController.php:101-106)
    const { count } = await supabaseAdmin
      .from("po_inward")
      .select("*", { count: "exact", head: true });

    const nextSeq = (count ?? 0) + 1;
    const insrno = nextSeq < 10 ? `SM/PR/0${nextSeq}` : `SM/PR/${nextSeq}`;

    // 1. Insert inward header
    const { data: receipt, error: recErr } = await supabaseAdmin
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
