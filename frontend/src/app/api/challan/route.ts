import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedScansLookup, invalidateCache } from "@/lib/cache";

// GET /api/challan - Fetch outward challans, child items, pending return status from view_pending_inward_qty, and lookups
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
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

    // 2. Fetch Customers, Challan Items, Subplates, and Pending Qtys in PARALLEL
    const [customers, itemsRes, subplatesRes, pendingRowsRes] = await Promise.all([
      getCachedCustomers(),
      challanIds.length > 0
        ? supabaseAdmin
            .from("challan_items")
            .select("*")
            .in("challanid", challanIds.slice(0, 500))
        : Promise.resolve({ data: [] }),
      supabaseAdmin
        .from("subplate")
        .select("id, platename, subprojectid, projectid, material, location")
        .is("deleted_at", null)
        .limit(2000),
      challanIds.length > 0
        ? supabaseAdmin
            .from("view_pending_inward_qty")
            .select("id, inward_qty, pending_qty")
            .in("id", challanIds.slice(0, 500))
        : Promise.resolve({ data: [] }),
    ]);

    const custMap = new Map((customers || []).map((c: any) => [c.id, c]));
    const subplates = subplatesRes.data || [];
    const subMap = new Map(subplates.map((sp: any) => [sp.id, sp]));

    const itemsMap: Record<number, any[]> = {};
    for (const item of itemsRes.data || []) {
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
      const vendor = custMap.get(c.vendorid);
      const transporter = custMap.get(c.vendortid);
      const rawItems = itemsMap[c.id] || [];
      const pendingInfo = pendingMap[c.id] || { inward_qty: 0, pending_qty: 0 };

      const enrichedItems = rawItems.map((it) => {
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
        vendorname: vendor?.customername || `Vendor #${c.vendorid}`,
        transportername: transporter?.customername || `Transporter #${c.vendortid}`,
        items: enrichedItems,
        total_qty: enrichedItems.reduce((sum, it) => sum + Number(it.qty || 0), 0),
        inward_qty: pendingInfo.inward_qty,
        pending_qty: pendingInfo.pending_qty,
      };
    });

    // Compute KPIs
    const { count: totalActive } = await supabaseAdmin
      .from("challan")
      .select("id", { count: "exact", head: true })
      .eq("status", "1");

    // 6. Fetch scans lookup for mould projects (cached)
    const scans = await getCachedScansLookup();

    const response = NextResponse.json({
      challans: enriched,
      customers: customers || [],
      subplates: subplates || [],
      scans: scans || [],
      kpis: {
        totalChallans: totalActive || 0,
        activeCount: enriched.length,
      },
    });
    response.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=20");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/challan - Create new outward challan with child items (matches ChallanController.php:store)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      challanno,
      customerid,
      vendorid,
      vendortid,
      projectid,
      chdate,
      items,
      created_by,
    } = body;

    if (!customerid || !vendorid) {
      return NextResponse.json(
        { error: "Customer and Vendor are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Generate challan number if not provided (matching ChallanController.php lines 823-825: SM/JW/xx)
    let finalChallanNo = challanno?.trim();
    if (!finalChallanNo) {
      const { count } = await supabaseAdmin
        .from("challan")
        .select("id", { count: "exact", head: true });
      const nextId = (count || 0) + 1;
      finalChallanNo = nextId < 10 ? `SM/JW/0${nextId}` : `SM/JW/${nextId}`;
    }

    // 1. Insert parent Challan
    const { data: challanData, error: cErr } = await supabaseAdmin
      .from("challan")
      .insert([
        {
          challanno: finalChallanNo,
          customerid: Number(customerid),
          vendorid: Number(vendorid),
          vendortid: vendortid ? Number(vendortid) : Number(vendorid),
          projectid: projectid || "",
          subprojectid: 0,
          chdate: chdate || now.slice(0, 10),
          status: "1",
          created_at: now,
          created_by: created_by || auth.user.name || "Admin",
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    // 2. Insert child items and update subplate location to vendor initials
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((it: any) => ({
        challanid: challanData.id,
        plateid: it.plateid ? Number(it.plateid) : null,
        particulars: it.particulars || it.platename || "Mould Plate",
        customer: Number(customerid),
        project: it.project || projectid || "",
        qty: Number(it.qty) || 1,
        created_at: now,
        updated_at: now,
      }));

      await supabaseAdmin.from("challan_items").insert(itemsToInsert);

      // Update subplate location matching PHP ChallanController:881-899
      const { data: vendorData } = await supabaseAdmin
        .from("customers")
        .select("initials, customername")
        .eq("id", Number(vendorid))
        .single();

      const vendorInitials = vendorData?.initials || vendorData?.customername || "Vendor";
      const plateIds = items.map((it: any) => Number(it.plateid)).filter((id: number) => Boolean(id));

      if (plateIds.length > 0) {
        const { data: plates } = await supabaseAdmin
          .from("subplate")
          .select("id, location")
          .in("id", plateIds);

        await Promise.all(
          (plates || []).map(async (sp: any) => {
            const rawLoc = sp.location || "SM";
            const parts = rawLoc.split(",").map((p: string) => p.trim()).filter(Boolean);
            const smFound = parts.includes("SM");
            const vendorFound = parts.includes(vendorInitials);

            let newLoc = vendorInitials;
            if (vendorInitials === "SM" || smFound || vendorFound) {
              newLoc = vendorInitials;
            } else {
              parts.push(vendorInitials);
              newLoc = parts.join(",");
            }

            return supabaseAdmin
              .from("subplate")
              .update({ location: newLoc, updated_at: now })
              .eq("id", sp.id);
          })
        );
      }
    }

    invalidateCache("api_counts_all");
    invalidateCache("subplates_worklog_lookup");

    return NextResponse.json(
      { challan: challanData, message: "Outward Challan created successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/challan - Invalidate/cancel outward challan (matches status = '0')
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
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

    // Set status to '0' (cancelled) matching legacy ChallanController
    const { error } = await supabaseAdmin
      .from("challan")
      .update({ status: "0", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("api_counts_all");
    invalidateCache("subplates_worklog_lookup");

    return NextResponse.json({ success: true, message: "Challan cancelled successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
