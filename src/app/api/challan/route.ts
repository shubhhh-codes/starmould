import { NextRequest, NextResponse } from "next/server";
import { createInventoryDocument } from "@/lib/inventory-documents";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, invalidateCache } from "@/lib/cache";

async function generateNextChallanNo(offset = 0): Promise<string> {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const dd = String(nowIST.getDate()).padStart(2, "0");
  const mm = String(nowIST.getMonth() + 1).padStart(2, "0");
  const yyyy = String(nowIST.getFullYear());
  const todayPrefix = `SMJC${dd}${mm}${yyyy}`;

  const { count: todayCount } = await supabaseAdmin
    .from("challan")
    .select("id", { count: "exact", head: true })
    .or(`challanno.like.${todayPrefix}%,challanno.like.SMJW${dd}${mm}${yyyy}%,challanno.like.SMJV${dd}${mm}${yyyy}%`);

  const seq = String((todayCount ?? 0) + 1 + offset).padStart(3, "0");
  return `${todayPrefix}${seq}`;
}

// GET /api/challan - Fetch outward challans, child items, pending return status from view_pending_inward_qty, and lookups
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 9], "nav_challan");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("action") === "next-number") {
      const nextNo = await generateNextChallanNo();
      return NextResponse.json({ nextNumber: nextNo });
    }

    const limit = Number(searchParams.get("limit") || "1000");
    const status = searchParams.get("status") || "1";

    // 1. Fetch Challans
    let query = supabaseAdmin
      .from("challan")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: challans, error: cErr } = await query;
    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const challanIds = (challans || []).map((c) => c.id);

    // 2. Fetch Customers, Vendors, Challan Items, Pending Qtys, KPI, and Scans in PARALLEL
    const [customers, vendors, itemsRes, pendingRowsRes, kpiRes, scansRes] = await Promise.all([
      getCachedCustomers(),
      getCachedVendors(),
      challanIds.length > 0
        ? supabaseAdmin
            .from("challan_items")
            .select("*")
            .in("challanid", challanIds.slice(0, 500))
            .limit(10000)
        : Promise.resolve({ data: [] }),
      challanIds.length > 0
        ? supabaseAdmin
            .from("view_pending_inward_qty")
            .select("id, inward_qty, pending_qty")
            .in("id", challanIds.slice(0, 500))
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("challan")
        .select("id", { count: "exact", head: true })
        .eq("status", "1"),
      supabaseAdmin
        .from("scan")
        .select("id, projectid, description, worktype, customer_id, cname, status")
        .order("id", { ascending: false })
        .limit(5000),
    ]);

    const custMap = new Map((customers || []).map((c: any) => [c.id, c]));
    const vendMap = new Map((vendors || []).map((v: any) => [v.id, v]));
    const rawItems = itemsRes.data || [];

    // Query ONLY specific subplates referenced by the fetched challan items
    const itemPlateIds = Array.from(new Set(rawItems.map((it: any) => it.plateid).filter(Boolean)));
    const { data: subplates } = itemPlateIds.length > 0
      ? await supabaseAdmin
          .from("subplate")
          .select("id, platename, subprojectid, material")
          .in("id", itemPlateIds.slice(0, 500))
      : { data: [] };

    const subMap = new Map((subplates || []).map((sp: any) => [sp.id, sp]));

    const itemsMap: Record<number, any[]> = {};
    for (const item of rawItems) {
      if (!itemsMap[item.challanid]) itemsMap[item.challanid] = [];
      itemsMap[item.challanid].push(item);
    }

    const pendingMap: Record<number, { inward_qty: number; pending_qty: number }> = {};
    for (const pr of pendingRowsRes.data || []) {
      if (!pendingMap[pr.id]) {
        pendingMap[pr.id] = { inward_qty: 0, pending_qty: 0 };
      }
      pendingMap[pr.id].inward_qty += Number(pr.inward_qty || 0);
      pendingMap[pr.id].pending_qty += Number(pr.pending_qty || 0);
    }

    const enriched = (challans || []).map((c) => {
      const cust = custMap.get(c.customerid);
      const vendor = vendMap.get(c.vendorid);
      const transporter = vendMap.get(c.vendortid);
      const cItems = itemsMap[c.id] || [];
      const pendingInfo = pendingMap[c.id] || { inward_qty: 0, pending_qty: 0 };

      const enrichedItems = cItems.map((it) => {
        const sp = subMap.get(it.plateid);
        return {
          ...it,
          platename: sp?.platename || it.particulars || "Plate",
          subprojectid: sp?.subprojectid || "",
          material: sp?.material || "",
        };
      });

      return {
        ...c,
        customername: cust?.customername || `Customer #${c.customerid}`,
        vendorname: vendor?.vendor_name || `Vendor #${c.vendorid}`,
        transportername: transporter?.vendor_name || `Transporter #${c.vendortid}`,
        items: enrichedItems,
        total_qty: enrichedItems.reduce((sum, it) => sum + Number(it.qty || 0), 0),
        inward_qty: pendingInfo.inward_qty,
        pending_qty: pendingInfo.pending_qty,
      };
    });

    const response = NextResponse.json({
      challans: enriched,
      scans: scansRes.data || [],
      kpis: {
        totalChallans: kpiRes.count || 0,
        activeCount: enriched.length,
      },
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/challan - Create new outward challan with child items (matches ChallanController.php:store)
export async function POST(req: NextRequest) {
  return createInventoryDocument(req, "challan");
}

// DELETE /api/challan - Invalidate/cancel outward challan (matches status = '0')
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 9], "nav_challan");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Missing challan id" }, { status: 400 });
    }

    const challanId = Number(id);

    // Guard: Prevent cancelling outward challan if inward receipts have already been recorded against it
    const { data: activeInwards, error: inwErr } = await supabaseAdmin
      .from("inward_items")
      .select("id, inchallanid, inward:inchallanid!inner(id, inchallanno, status)")
      .eq("challanid", challanId)
      .neq("inward.status", "0")
      .limit(1);

    if (inwErr) {
      return NextResponse.json({ error: inwErr.message }, { status: 500 });
    }

    if (activeInwards && activeInwards.length > 0) {
      const inwardRecord: any = activeInwards[0];
      const inNo = inwardRecord?.inward?.inchallanno || "active inward receipt";
      return NextResponse.json(
        {
          error: `Cannot cancel this outward challan because inward receipt (${inNo}) has already been recorded against it. Cancel the inward receipt first.`,
        },
        { status: 400 }
      );
    }

    // Fetch plate IDs on this challan so we can recompute locations after cancellation
    const { data: cItems } = await supabaseAdmin
      .from("challan_items")
      .select("plateid")
      .eq("challanid", challanId);

    const plateIds = Array.from(
      new Set((cItems || []).map((ci: any) => Number(ci.plateid)).filter(Boolean))
    );

    // Set status to '0' (cancelled) matching legacy ChallanController
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("challan")
      .update({ status: "0", updated_at: now })
      .eq("id", challanId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recompute subplate locations based on remaining active jobwork balances
    if (plateIds.length > 0) {
      const { data: updatedBalances } = await supabaseAdmin
        .from("view_subplate_jobwork_balance")
        .select("plateid, available_sm_qty, active_vendor_initials")
        .in("plateid", plateIds);

      for (const ub of updatedBalances || []) {
        const vendors = ub.active_vendor_initials;
        let newLoc = "SM";
        if (ub.available_sm_qty > 0 && vendors) {
          newLoc = `SM, ${vendors}`;
        } else if (vendors) {
          newLoc = vendors;
        }
        await supabaseAdmin
          .from("subplate")
          .update({ location: newLoc, updated_at: now })
          .eq("id", ub.plateid);
      }
    }

    invalidateCache("api_counts_all");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_default_");

    return NextResponse.json({ success: true, message: "Challan cancelled successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
