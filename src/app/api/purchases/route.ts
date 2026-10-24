import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, getCachedScansLookup, invalidateCache } from "@/lib/cache";

// GET /api/purchases - fetch POs with items and pending subplates (Admin, Manager, Purchase Incharge)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase");
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
      .select("id, srno, purchaseid, pno, vname, cname, customer_name, odate, projectid, idate, imaterial, status, created_at, created_by, updated_at", { count: "exact" })
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
            .select("id, platename, projectid, subprojectid, mold_id, mold_code, plate_category, material, shape, width, height, length, weight, unit, sqty")
            .is("deleted_at", null)
            .order("id", { ascending: false })
            .limit(2000)
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
        .select("id, pid, plateid, material, materialtype, qty, rate, created_at, updated_at")
        .in("pid", pids);

      if (itErr) {
        return NextResponse.json({ error: itErr.message }, { status: 500 });
      }
      items = itemRows || [];
    }

    // 3. Batch check which POs have inward receipts recorded and calculate inward vs pending quantities
    const inwardSet = new Set<number>();
    const poInwardStats = new Map<number, { ordered: number; inward: number; pending: number }>();

    if (pids.length > 0) {
      const [poInwardRes, poInwardItemsRes, pendingViewRes] = await Promise.all([
        supabaseAdmin
          .from("po_inward")
          .select("pid")
          .in("pid", pids)
          .neq("status", "0"),
        supabaseAdmin
          .from("purchase_inward_items")
          .select("pid")
          .in("pid", pids),
        supabaseAdmin
          .from("view_po_pending_inward_qty")
          .select("id, plateid, qty, inward_qty, pending_qty")
          .in("id", pids),
      ]);

      (poInwardRes.data || []).forEach((r: any) => {
        if (r.pid) inwardSet.add(Number(r.pid));
      });
      (poInwardItemsRes.data || []).forEach((r: any) => {
        if (r.pid) inwardSet.add(Number(r.pid));
      });

      (pendingViewRes.data || []).forEach((r: any) => {
        const poId = Number(r.id);
        const current = poInwardStats.get(poId) || { ordered: 0, inward: 0, pending: 0 };
        current.ordered += Number(r.qty) || 0;
        current.inward += Number(r.inward_qty) || 0;
        current.pending += Number(r.pending_qty) || 0;
        poInwardStats.set(poId, current);
      });
    }

    // Attach items, names and inward status to POs
    const enrichedPOs = pos.map((po) => {
      const poItems = items
        .filter((it) => it.pid === po.id)
        .map((it) => ({
          ...it,
          platename: plateMap.get(it.plateid) || `Plate #${it.plateid}`,
        }));

      const stats = poInwardStats.get(Number(po.id));
      const hasInward = inwardSet.has(Number(po.id));
      const totalOrdered = stats ? stats.ordered : poItems.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
      const totalInward = stats ? stats.inward : 0;
      const totalPending = stats ? stats.pending : totalOrdered;

      const isFullyReceived = Boolean(hasInward && totalInward > 0 && totalPending <= 0);
      const isPartiallyReceived = Boolean(hasInward && totalInward > 0 && totalPending > 0);
      const inwardStatus = isFullyReceived ? "completed" : isPartiallyReceived ? "partial" : "pending";

      return {
        ...po,
        vendorname: vendMap.get(po.vname) || `Vendor #${po.vname}`,
        customername: po.customer_name || custMap.get(po.cname) || `Customer #${po.cname}`,
        customer_name: po.customer_name || custMap.get(po.cname) || null,
        items: poItems,
        has_inward: hasInward,
        is_fully_received: isFullyReceived,
        is_partially_received: isPartiallyReceived,
        inward_status: inwardStatus,
        total_ordered_qty: totalOrdered,
        total_inward_qty: totalInward,
        total_pending_qty: totalPending,
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

// POST /api/purchases - create new PO with line items (Admin, Manager, Purchase Incharge)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { odate, vname, cname, projectid, items } = body;

    if (!vname || !cname || !projectid || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate remaining quantity limits against plate required quantity (sqty)
    const plateIds = (items || []).map((it: any) => Number(it.plateid)).filter(Boolean);
    if (plateIds.length > 0) {
      const [{ data: dbPlates }, { data: existingItems }] = await Promise.all([
        supabaseAdmin
          .from("subplate")
          .select("id, platename, sqty")
          .in("id", plateIds),
        supabaseAdmin
          .from("purchase_items")
          .select("plateid, qty, purchase:pid!inner(status)")
          .in("plateid", plateIds)
          .neq("purchase.status", "0"),
      ]);

      const existingMap = new Map<number, number>();
      (existingItems || []).forEach((row: any) => {
        const pid = Number(row.plateid);
        existingMap.set(pid, (existingMap.get(pid) || 0) + (Number(row.qty) || 0));
      });

      const plateReqMap = new Map((dbPlates || []).map((p: any) => [p.id, Number(p.sqty) || 1]));
      const plateNameMap = new Map((dbPlates || []).map((p: any) => [p.id, p.platename]));

      const reqTotalMap = new Map<number, number>();
      items.forEach((it: any) => {
        const pid = Number(it.plateid);
        reqTotalMap.set(pid, (reqTotalMap.get(pid) || 0) + (Number(it.qty) || 0));
      });

      for (const [pid, newQty] of reqTotalMap.entries()) {
        const totalReq = plateReqMap.get(pid) ?? 1;
        const alreadyOrdered = existingMap.get(pid) ?? 0;
        const remaining = Math.max(0, totalReq - alreadyOrdered);
        if (newQty > remaining) {
          const pName = plateNameMap.get(pid) || `Plate #${pid}`;
          return NextResponse.json(
            { error: `Order quantity (${newQty}) for "${pName}" exceeds remaining required quantity limit (${remaining}).` },
            { status: 400 }
          );
        }
      }
    }

    // ── PO Number: SMPO{DDMMYYYY}{NNN} — daily-scoped, resets each day (IST) ──
    const nowIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const dd = String(nowIST.getDate()).padStart(2, "0");
    const mm = String(nowIST.getMonth() + 1).padStart(2, "0");
    const yyyy = String(nowIST.getFullYear());
    const todayPrefix = `SMPO${dd}${mm}${yyyy}`; // e.g. "SMPO23102026"

    // Count POs already created today by matching the srno prefix (avoids IST/UTC conversion)
    const { count: todayCount } = await supabaseAdmin
      .from("purchase")
      .select("id", { count: "exact", head: true })
      .like("srno", `${todayPrefix}%`);

    const seq = String((todayCount ?? 0) + 1).padStart(3, "0");
    const srno = `${todayPrefix}${seq}`; // e.g. "SMPO23102026005"

    // purchaseid still increments globally (internal DB key, not displayed)
    const { data: maxRows } = await supabaseAdmin
      .from("purchase")
      .select("purchaseid")
      .order("purchaseid", { ascending: false })
      .limit(1);

    const nextPurchaseId = (maxRows?.[0]?.purchaseid ?? 1010) + 1;

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
          customer_name: (await supabaseAdmin.from("customers").select("customername").eq("id", Number(cname)).maybeSingle()).data?.customername || null,
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
      rate: it.rate !== undefined && it.rate !== null && it.rate !== "" ? Number(it.rate) : null,
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

    // Auto-sync subplates order_by & order_at so pipeline stage transitions cleanly
    const orderedPlateIds = lineItemsToInsert.map((it: { plateid: number }) => it.plateid).filter(Boolean);
    if (orderedPlateIds.length > 0) {
      await supabaseAdmin
        .from("subplate")
        .update({
          order_by: auth.user.id || 1,
          order_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", orderedPlateIds)
        .is("order_by", null);
    }

    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("subplate_default_");

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

// PUT /api/purchases - update existing PO and reconcile line items (Admin, Manager, Purchase Incharge)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, odate, vname, cname, projectid, items } = body;

    if (!id || !vname || !cname || !projectid || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Security Guard: PO cannot be edited once fully received
    const poId = Number(id);
    const { data: pendingRows } = await supabaseAdmin
      .from("view_po_pending_inward_qty")
      .select("qty, inward_qty, pending_qty")
      .eq("id", poId);

    if (pendingRows && pendingRows.length > 0) {
      const totalInward = pendingRows.reduce((sum, r) => sum + (Number(r.inward_qty) || 0), 0);
      const totalPending = pendingRows.reduce((sum, r) => sum + (Number(r.pending_qty) || 0), 0);
      if (totalInward > 0 && totalPending <= 0) {
        return NextResponse.json(
          { error: "This purchase order cannot be edited because all items have already been fully received at the workshop gate." },
          { status: 400 }
        );
      }
    }

    // Validate remaining quantity limits (excluding the PO being edited)
    const plateIds = (items || []).map((it: any) => Number(it.plateid)).filter(Boolean);
    if (plateIds.length > 0) {
      const [{ data: dbPlates }, { data: existingItems }] = await Promise.all([
        supabaseAdmin
          .from("subplate")
          .select("id, platename, sqty")
          .in("id", plateIds),
        supabaseAdmin
          .from("purchase_items")
          .select("plateid, qty, pid, purchase:pid!inner(status)")
          .in("plateid", plateIds)
          .neq("purchase.status", "0"),
      ]);

      const existingMap = new Map<number, number>();
      (existingItems || []).forEach((row: any) => {
        if (Number(row.pid) !== Number(id)) {
          const pid = Number(row.plateid);
          existingMap.set(pid, (existingMap.get(pid) || 0) + (Number(row.qty) || 0));
        }
      });

      const plateReqMap = new Map((dbPlates || []).map((p: any) => [p.id, Number(p.sqty) || 1]));
      const plateNameMap = new Map((dbPlates || []).map((p: any) => [p.id, p.platename]));

      const reqTotalMap = new Map<number, number>();
      items.forEach((it: any) => {
        const pid = Number(it.plateid);
        reqTotalMap.set(pid, (reqTotalMap.get(pid) || 0) + (Number(it.qty) || 0));
      });

      for (const [pid, newQty] of reqTotalMap.entries()) {
        const totalReq = plateReqMap.get(pid) ?? 1;
        const alreadyOrdered = existingMap.get(pid) ?? 0;
        const remaining = Math.max(0, totalReq - alreadyOrdered);
        if (newQty > remaining) {
          const pName = plateNameMap.get(pid) || `Plate #${pid}`;
          return NextResponse.json(
            { error: `Order quantity (${newQty}) for "${pName}" exceeds remaining required quantity limit (${remaining}).` },
            { status: 400 }
          );
        }
      }
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
      const parsedRate = it.rate !== undefined && it.rate !== null && it.rate !== "" ? Number(it.rate) : null;
      if (it.id && existingIds.has(Number(it.id))) {
        await supabaseAdmin
          .from("purchase_items")
          .update({
            plateid: Number(it.plateid),
            material: it.material || "",
            materialtype: it.materialtype || "",
            qty: Number(it.qty) || 1,
            rate: parsedRate,
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
            rate: parsedRate,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }
    }

    // Auto-sync subplates order_by & order_at for any newly added/updated plate lines
    const orderedPlateIds = (items || []).map((it: any) => Number(it.plateid)).filter(Boolean);
    if (orderedPlateIds.length > 0) {
      await supabaseAdmin
        .from("subplate")
        .update({
          order_by: auth.user.id || 1,
          order_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", orderedPlateIds)
        .is("order_by", null);
    }

    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("subplate_default_");

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

// DELETE /api/purchases?id=123 - soft delete PO (Admin, Manager, Purchase Incharge)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_purchase");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Purchase ID required" }, { status: 400 });
    }

    const poId = Number(id);

    // Security Guard: PO cannot be deleted if any material inward has already been recorded
    const [inwardRecRes, inwardItemsRes] = await Promise.all([
      supabaseAdmin
        .from("po_inward")
        .select("id", { count: "exact", head: true })
        .eq("pid", poId)
        .neq("status", "0"),
      supabaseAdmin
        .from("purchase_inward_items")
        .select("id", { count: "exact", head: true })
        .eq("pid", poId),
    ]);

    if ((inwardRecRes.count && inwardRecRes.count > 0) || (inwardItemsRes.count && inwardItemsRes.count > 0)) {
      return NextResponse.json(
        { error: "This purchase order cannot be deleted because material inward has already been recorded." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("purchase")
      .update({ status: "0", updated_at: new Date().toISOString() })
      .eq("id", poId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reset subplates order_by if no other active PO exists for them
    const { data: cancelledItems } = await supabaseAdmin
      .from("purchase_items")
      .select("plateid")
      .eq("pid", Number(id));

    if (cancelledItems && cancelledItems.length > 0) {
      const plateIds = cancelledItems.map((ci) => ci.plateid).filter(Boolean);
      for (const pid of plateIds) {
        const { data: otherActivePOs } = await supabaseAdmin
          .from("purchase_items")
          .select("id, purchase:pid!inner(status)")
          .eq("plateid", pid)
          .neq("purchase.status", "0")
          .limit(1);

        if (!otherActivePOs || otherActivePOs.length === 0) {
          await supabaseAdmin
            .from("subplate")
            .update({ order_by: null, order_at: null, updated_at: new Date().toISOString() })
            .eq("id", pid);
        }
      }
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
