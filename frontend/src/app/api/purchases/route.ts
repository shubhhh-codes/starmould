import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedScansLookup } from "@/lib/cache";

// GET /api/purchases - fetch POs with items and pending subplates (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "100");
    const includePlates = searchParams.get("includePlates") === "true";

    // 1. Batch fetch recent purchases and subplates concurrently, using cached customers & scans
    const [posRes, customers, scans, subplatesRes] = await Promise.all([
      supabaseAdmin
        .from("purchase")
        .select("*")
        .order("id", { ascending: false })
        .limit(limit),
      getCachedCustomers(),
      getCachedScansLookup(),
      includePlates
        ? supabaseAdmin
            .from("subplate")
            .select("id, platename, projectid, subprojectid, material, width, height, length, unit, sqty")
            .is("deleted_at", null)
            .limit(1000)
        : Promise.resolve({ data: [] }),
    ]);

    if (posRes.error) {
      return NextResponse.json({ error: posRes.error.message }, { status: 500 });
    }

    const pos = posRes.data || [];
    const plates = subplatesRes.data || [];

    const custMap = new Map(customers.map((c) => [c.id, c.customername]));
    const plateMap = new Map(plates.map((p) => [p.id, p.platename]));

    const pids = pos.map((p) => p.id);

    // 2. Fetch line items with explicit columns for these POs
    let items: any[] = [];
    if (pids.length > 0) {
      const { data: itemRows, error: itErr } = await supabaseAdmin
        .from("purchase_items")
        .select("*")
        .in("pid", pids);

      if (itErr) {
        return NextResponse.json({ error: itErr.message }, { status: 500 });
      }
      items = itemRows || [];
    }

    // Attach items and names to POs
    const enrichedPOs = pos.map((po) => {
      const poItems = items
        .filter((it) => it.pid === po.id)
        .map((it) => ({
          ...it,
          platename: plateMap.get(it.plateid) || `Plate #${it.plateid}`,
        }));

      return {
        ...po,
        vendorname: custMap.get(po.vname) || `Vendor #${po.vname}`,
        customername: custMap.get(po.cname) || `Customer #${po.cname}`,
        items: poItems,
      };
    });

    const response = NextResponse.json({
      purchases: enrichedPOs,
      customers: customers,
      subplates: plates,
      scans: scans,
    });
    response.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=20");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/purchases - create new PO with line items (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { odate, vname, cname, projectid, items } = body;

    if (!vname || !cname || !projectid || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Determine next PO number
    const { data: maxRows } = await supabaseAdmin
      .from("purchase")
      .select("purchaseid")
      .order("purchaseid", { ascending: false })
      .limit(1);

    const nextPurchaseId = (maxRows?.[0]?.purchaseid ?? 1010) + 1;
    const srno = `PO-${nextPurchaseId}`;

    // 1. Insert header
    const { data: newPO, error: poErr } = await supabaseAdmin
      .from("purchase")
      .insert([
        {
          purchaseid: nextPurchaseId,
          srno,
          odate: odate || new Date().toISOString().slice(0, 10),
          vname,
          cname,
          projectid,
          status: "1",
          created_by: auth.user.name || "Admin",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (poErr) {
      return NextResponse.json({ error: poErr.message }, { status: 500 });
    }

    // 2. Insert line items
    const lineItemsToInsert = items.map((it: any) => ({
      pid: newPO.id,
      plateid: Number(it.plateid),
      material: it.material,
      materialtype: it.materialtype,
      qty: Number(it.qty) || 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: createdItems, error: itErr } = await supabaseAdmin
      .from("purchase_items")
      .insert(lineItemsToInsert)
      .select();

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    return NextResponse.json({
      purchase: {
        ...newPO,
        items: createdItems,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/purchases?id=123 - soft delete PO (Admin, Manager only)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Purchase ID required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("purchase")
      .update({ status: "0", updated_at: new Date().toISOString() })
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
