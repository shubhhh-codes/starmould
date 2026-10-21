import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, getCachedScansLookup, invalidateCache } from "@/lib/cache";

// GET /api/purchases - fetch POs with items and pending subplates (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_purchase");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "50");
    const includePlates = searchParams.get("includePlates") === "true";

    let poQuery = supabaseAdmin
      .from("purchase")
      .select("id, srno, purchaseid, pno, vname, cname, odate, projectid, idate, imaterial, status, created_at, created_by, updated_at", { count: "exact" })
      .order("id", { ascending: false });

    if (page && page > 0) {
      const start = (page - 1) * limit;
      poQuery = poQuery.range(start, start + limit - 1);
    } else {
      poQuery = poQuery.limit(limit);
    }

    // 1. Batch fetch recent purchases and subplates concurrently, using cached customers & scans
    const [posRes, customers, vendors, scans, subplatesRes] = await Promise.all([
      poQuery,
      getCachedCustomers(),
      getCachedVendors(),
      getCachedScansLookup(),
      includePlates
        ? supabaseAdmin
            .from("subplate")
            .select("id, platename, projectid, subprojectid, material, width, height, length, unit, sqty")
            .is("deleted_at", null)
            .limit(500)
        : Promise.resolve({ data: [] }),
    ]);

    if (posRes.error) {
      return NextResponse.json({ error: posRes.error.message }, { status: 500 });
    }

    const pos = posRes.data || [];
    const plates = subplatesRes.data || [];

    const custMap = new Map(customers.map((c) => [c.id, c.customername]));
    const vendMap = new Map((vendors || []).map((v) => [v.id, v.vendor_name]));
    const plateMap = new Map(plates.map((p) => [p.id, p.platename]));

    const pids = pos.map((p) => p.id);

    // 2. Fetch line items with explicit columns for these POs
    let items: any[] = [];
    if (pids.length > 0) {
      const { data: itemRows, error: itErr } = await supabaseAdmin
        .from("purchase_items")
        .select("id, pid, plateid, material, materialtype, qty, created_at, updated_at")
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
        vendorname: vendMap.get(po.vname) || `Vendor #${po.vname}`,
        customername: custMap.get(po.cname) || `Customer #${po.cname}`,
        items: poItems,
      };
    });

    const totalCount = posRes.count ?? enrichedPOs.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const currentPage = page || 1;

    const response = NextResponse.json({
      purchases: enrichedPOs,
      data: enrichedPOs,
      pagination: {
        page: currentPage,
        pageSize: limit,
        total: totalCount,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
      customers: customers,
      vendors: vendors,
      subplates: plates,
      scans: scans,
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/purchases - create new PO with line items (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_purchase");
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
          vname: Number(vname),
          cname: Number(cname),
          projectid: String(projectid),
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
      material: it.material || "",
      materialtype: it.materialtype || "",
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

    invalidateCache("api_counts_all");

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

// PUT /api/purchases - update existing PO and reconcile line items (Admin, Manager only)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_purchase");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, odate, vname, cname, projectid, items } = body;

    if (!id || !vname || !cname || !projectid || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Update purchase header
    const { data: updatedPO, error: poErr } = await supabaseAdmin
      .from("purchase")
      .update({
        odate: odate || new Date().toISOString().slice(0, 10),
        vname: Number(vname),
        cname: Number(cname),
        projectid: String(projectid),
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(id))
      .select()
      .single();

    if (poErr) {
      return NextResponse.json({ error: poErr.message }, { status: 500 });
    }

    // 2. Reconcile purchase line items
    const { data: existingItems } = await supabaseAdmin
      .from("purchase_items")
      .select("id")
      .eq("pid", Number(id));

    const existingIds = new Set((existingItems || []).map((it) => it.id));
    const submittedIds = new Set(items.map((it: any) => Number(it.id)).filter(Boolean));

    // Delete items removed from the PO
    const idsToDelete = [...existingIds].filter((exId) => !submittedIds.has(exId));
    if (idsToDelete.length > 0) {
      await supabaseAdmin.from("purchase_items").delete().in("id", idsToDelete);
    }

    // Update existing items or insert new items
    for (const it of items) {
      if (it.id && existingIds.has(Number(it.id))) {
        await supabaseAdmin
          .from("purchase_items")
          .update({
            plateid: Number(it.plateid),
            material: it.material || "",
            materialtype: it.materialtype || "",
            qty: Number(it.qty) || 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", Number(it.id));
      } else {
        await supabaseAdmin
          .from("purchase_items")
          .insert({
            pid: Number(id),
            plateid: Number(it.plateid),
            material: it.material || "",
            materialtype: it.materialtype || "",
            qty: Number(it.qty) || 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    }

    invalidateCache("api_counts_all");

    // Fetch refreshed line items
    const { data: finalItems } = await supabaseAdmin
      .from("purchase_items")
      .select("*")
      .eq("pid", Number(id));

    return NextResponse.json({
      purchase: {
        ...updatedPO,
        items: finalItems || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/purchases?id=123 - soft delete PO (Admin, Manager only)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_purchase");
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

    invalidateCache("api_counts_all");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
