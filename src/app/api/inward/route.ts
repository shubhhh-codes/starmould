import { NextRequest, NextResponse } from "next/server";
import { createInventoryDocument } from "@/lib/inventory-documents";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, getCachedScansLookup, getCompletedProjectIds, invalidateCache } from "@/lib/cache";

// GET /api/inward - Fetch Job Work Inwards, items, pending return lists, and customer lookups (Roles 0, 1, 2)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 5, 7, 9], "nav_inward");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");
    const status = searchParams.get("status") || "1";

    // 1. Fetch Inwards
    let query = supabaseAdmin
      .from("inward")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: inwards, error: inErr } = await query;
    if (inErr) {
      return NextResponse.json({ error: inErr.message }, { status: 500 });
    }

    const challanIds = Array.from(new Set((inwards || []).map((i) => i.challanid).filter(Boolean)));
    const inwardIds = (inwards || []).map((i) => i.id);

    // 2. Fetch Customers, Vendors, Challans, Items, and Pending concurrently
    const [customers, vendors, challansRes, itemsRes, pendingChallansRes] = await Promise.all([
      getCachedCustomers(),
      getCachedVendors(),
      supabaseAdmin
        .from("challan")
        .select("id, challanno, chdate, vendorid, customerid, projectid")
        .in("id", challanIds.length > 0 ? challanIds : [0]),
      inwardIds.length > 0
        ? supabaseAdmin
            .from("inward_items")
            .select("*")
            .in("inchallanid", inwardIds.slice(0, 500))
            .limit(10000)
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("view_pending_inward_qty")
        .select("*")
        .gt("pending_qty", 0)
        .limit(500),
    ]);

    const custMap = new Map((customers || []).map((c: any) => [c.id, c]));
    const vendMap = new Map((vendors || []).map((v: any) => [v.id, v]));
    const challanMap = new Map((challansRes.data || []).map((c) => [c.id, c]));
    const rawItems = itemsRes.data || [];

    // Query ONLY subplates referenced by the fetched inward items
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
      if (!itemsMap[item.inchallanid]) itemsMap[item.inchallanid] = [];
      itemsMap[item.inchallanid].push(item);
    }

    const pendingChallans = pendingChallansRes.data || [];

    const enriched = (inwards || []).map((inw) => {
      const cust = custMap.get(inw.customerid);
      const vendor = vendMap.get(inw.vendorid);
      const transporter = vendMap.get(inw.vendortid);
      const ch = challanMap.get(inw.challanid);
      const inItems = itemsMap[inw.id] || [];

      const enrichedItems = inItems.map((it) => {
        const sp = subMap.get(it.plateid);
        return {
          ...it,
          platename: sp?.platename || it.particulars || "Plate",
          subprojectid: sp?.subprojectid || "",
          material: sp?.material || "",
        };
      });

      return {
        ...inw,
        challanno: ch?.challanno || `CH #${inw.challanid}`,
        customername: cust?.customername || `Customer #${inw.customerid}`,
        vendorname: vendor?.vendor_name || `Vendor #${inw.vendorid}`,
        transportername: transporter?.vendor_name || `Transporter #${inw.vendortid}`,
        items: enrichedItems,
        total_inward_qty: enrichedItems.reduce((sum, it) => sum + Number(it.inward_qty || 0), 0),
      };
    });

    const response = NextResponse.json({
      inwards: enriched,
      pendingChallans: pendingChallans || [],
      kpis: {
        totalInwards: enriched.length,
        totalPendingChallanItems: (pendingChallans || []).length,
      },
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/inward - Record new Job Work Inward against Challan (Roles 0, 1, 2)
export async function POST(req: NextRequest) {
  return createInventoryDocument(req, "jobwork-receipt");
}

// DELETE /api/inward - Cancel/invalidate inward record (Roles 0, 1, 2)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 5, 7, 9], "nav_inward");
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
      return NextResponse.json({ error: "Missing inward id" }, { status: 400 });
    }

    const inwardId = Number(id);

    // Fetch line items on this inward receipt before cancelling to validate stock availability
    const { data: inItems, error: itemsErr } = await supabaseAdmin
      .from("inward_items")
      .select("id, plateid, inward_qty, qty")
      .eq("inchallanid", inwardId);

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    const plateIds = Array.from(
      new Set((inItems || []).map((it: any) => Number(it.plateid)).filter(Boolean))
    );

    // Stock Validation Guard:
    // Ensure reverting this inward receipt does not cause Star Mould workshop stock to go negative.
    if (plateIds.length > 0) {
      const plateRevertQtyMap = new Map<number, number>();
      for (const it of inItems || []) {
        if (it.plateid) {
          const cur = plateRevertQtyMap.get(Number(it.plateid)) || 0;
          const q = Number(it.inward_qty ?? it.qty ?? 0);
          plateRevertQtyMap.set(Number(it.plateid), cur + q);
        }
      }

      const { data: balances, error: balErr } = await supabaseAdmin
        .from("view_subplate_jobwork_balance")
        .select("plateid, platename, available_sm_qty, outward_jobwork_qty, customer_dispatched_qty")
        .in("plateid", plateIds);

      if (balErr) {
        return NextResponse.json({ error: balErr.message }, { status: 500 });
      }

      const balMap = new Map((balances || []).map((b: any) => [Number(b.plateid), b]));

      for (const pid of plateIds) {
        const revertQty = plateRevertQtyMap.get(pid) || 0;
        const bal = balMap.get(pid);
        const availableSmQty = Number(bal?.available_sm_qty ?? 0);
        const dispatchedQty = Number(bal?.customer_dispatched_qty ?? 0);
        const jobworkQty = Number(bal?.outward_jobwork_qty ?? 0);
        const plateName = bal?.platename || `Plate #${pid}`;

        if (availableSmQty < revertQty) {
          const reasons: string[] = [];
          if (dispatchedQty > 0) reasons.push(`${dispatchedQty} pcs already dispatched to customer`);
          if (jobworkQty > 0) reasons.push(`${jobworkQty} pcs on job work`);
          const reasonStr = reasons.length > 0 ? ` (${reasons.join(", ")})` : "";
          return NextResponse.json(
            {
              error: `Cannot revert job work inward receipt: Subplate "${plateName}" requires reverting ${revertQty} pcs, but only ${availableSmQty} pcs are currently available in the Star Mould workshop${reasonStr}.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("inward")
      .update({ status: "0", updated_at: now })
      .eq("id", inwardId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recompute subplate locations based on remaining active jobwork balances
    if (plateIds.length > 0) {
      const { data: updatedBalances } = await supabaseAdmin
        .from("view_subplate_jobwork_balance")
        .select("plateid, available_sm_qty, active_vendor_initials, customer_dispatched_qty")
        .in("plateid", plateIds);

      for (const ub of updatedBalances || []) {
        const vendors = ub.active_vendor_initials;
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
          .update({ location: newLoc, updated_at: now })
          .eq("id", ub.plateid);
      }
    }

    invalidateCache("api_counts_all");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_default_");

    return NextResponse.json({ success: true, message: "Inward record cancelled successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
