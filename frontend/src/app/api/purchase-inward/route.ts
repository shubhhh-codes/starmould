import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/purchase-inward - fetch open pending items directly from view_po_pending_inward_qty
export async function GET(req: NextRequest) {
  try {
    // 1. Query view_po_pending_inward_qty directly (single source of truth)
    const { data: viewData, error: viewErr } = await supabaseAdmin
      .from("view_po_pending_inward_qty")
      .select("*")
      .gt("pending_qty", 0)
      .order("id", { ascending: false });

    let pendingReceiveList: any[] = [];

    if (!viewErr && viewData) {
      pendingReceiveList = viewData;
    } else {
      // Fallback if view has not yet been run in SQL editor
      const { data: pos } = await supabaseAdmin
        .from("purchase")
        .select("*")
        .eq("status", "1")
        .order("id", { ascending: false })
        .limit(100);

      const pids = (pos || []).map((p) => p.id);
      const { data: poItems } = await supabaseAdmin.from("purchase_items").select("*").in("pid", pids);
      const { data: inwardItems } = await supabaseAdmin.from("purchase_inward_items").select("*").in("pid", pids);
      const { data: customers } = await supabaseAdmin.from("customers").select("id, customername");
      const custMap = new Map((customers || []).map((c) => [c.id, c.customername]));

      const plateIds = Array.from(new Set((poItems || []).map((it) => it.plateid)));
      const { data: subplates } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, projectid, material")
        .in("id", plateIds.slice(0, 500));
      const plateMap = new Map((subplates || []).map((sp) => [sp.id, sp.platename]));

      const receivedMap = new Map<string, number>();
      for (const inItem of inwardItems || []) {
        const key = `${inItem.pid}_${inItem.plateid}`;
        receivedMap.set(key, (receivedMap.get(key) || 0) + (Number(inItem.inward_qty) || 0));
      }

      const poMap = new Map((pos || []).map((p) => [p.id, p]));
      for (const item of poItems || []) {
        const po = poMap.get(item.pid);
        if (!po) continue;
        const key = `${item.pid}_${item.plateid}`;
        const receivedQty = receivedMap.get(key) || 0;
        const orderedQty = Number(item.qty) || 0;
        const pendingQty = Math.max(0, orderedQty - receivedQty);

        if (pendingQty > 0) {
          pendingReceiveList.push({
            id: item.id,
            poid: po.id,
            srno: po.srno,
            pno: po.pno,
            vname: po.vname,
            vendorname: custMap.get(po.vname) || `Vendor #${po.vname}`,
            cname: po.cname,
            customername: custMap.get(po.cname) || `Customer #${po.cname}`,
            projectid: po.projectid,
            odate: po.odate,
            plateid: item.plateid,
            platename: plateMap.get(item.plateid) || `Plate #${item.plateid}`,
            material: item.material,
            materialtype: item.materialtype,
            qty: orderedQty,
            inward_qty: receivedQty,
            pending_qty: pendingQty,
          });
        }
      }
    }

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
      source: !viewErr ? "view_po_pending_inward_qty" : "fallback_join",
      pendingReceiveItems: pendingReceiveList,
      receipts: enrichedReceipts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/purchase-inward - record an inward receipt against a PO
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pid, inpono, cname, vname, projectid, odate, items } = body;

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
