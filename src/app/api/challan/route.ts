import { NextRequest, NextResponse } from "next/server";
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

    // 2. Fetch Customers, Vendors, Challan Items, Pending Qtys, and KPI in PARALLEL
    const [customers, vendors, itemsRes, pendingRowsRes, kpiRes] = await Promise.all([
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
  const auth = await authenticateRequest(req, [0, 1, 2, 9], "nav_challan");
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

    // Enforce rule: Ek mould ka ek hi bar outward challan banna chahiye
    if (projectid) {
      const trimmedProject = String(projectid).trim();
      const { data: existingChallan } = await supabaseAdmin
        .from("challan")
        .select("id, challanno")
        .eq("status", "1")
        .eq("projectid", trimmedProject)
        .limit(1)
        .maybeSingle();

      if (existingChallan) {
        return NextResponse.json(
          {
            error: `Challan already exists for mould "${trimmedProject}" (${existingChallan.challanno}). Ek mould ka ek hi challan ban sakta hai.`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();

    // 1. Insert parent Challan with collision retry loop
    // ── Job Work Challan Number: SMJC{DDMMYYYY}{NNN} — daily-scoped, resets each day (IST) ──
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

    let challanData: any = null;
    let cErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      let finalChallanNo = challanno?.trim();
      if (!finalChallanNo) {
        const seq = String((todayCount ?? 0) + 1 + attempt).padStart(3, "0");
        finalChallanNo = `${todayPrefix}${seq}`;
      }

      const res = await supabaseAdmin
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

      if (!res.error) {
        challanData = res.data;
        cErr = null;
        break;
      }
      cErr = res.error;
      if (res.error.code !== "23505" && !res.error.message?.includes("unique constraint")) {
        break;
      }
    }

    if (cErr || !challanData) {
      return NextResponse.json({ error: cErr?.message || "Failed to create challan" }, { status: 500 });
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

      const { error: itemsErr } = await supabaseAdmin.from("challan_items").insert(itemsToInsert);
      if (itemsErr) {
        await supabaseAdmin.from("challan").delete().eq("id", challanData.id);
        return NextResponse.json({ error: `Failed to insert challan items: ${itemsErr.message}` }, { status: 500 });
      }

      // Update subplate location matching PHP ChallanController:881-899
      const { data: vendorData } = await supabaseAdmin
        .from("vendors")
        .select("initials, vendor_name")
        .eq("id", Number(vendorid))
        .maybeSingle();

      const vendorInitials = vendorData?.initials || vendorData?.vendor_name || "Vendor";
      const plateIds = items.map((it: any) => Number(it.plateid)).filter((id: number) => Boolean(id));

      if (plateIds.length > 0) {
        const { data: plates } = await supabaseAdmin
          .from("subplate")
          .select("id, location")
          .in("id", plateIds);

        const locMap = new Map<string, number[]>();
        for (const sp of plates || []) {
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

          if (!locMap.has(newLoc)) {
            locMap.set(newLoc, []);
          }
          locMap.get(newLoc)!.push(sp.id);
        }

        await Promise.all(
          Array.from(locMap.entries()).map(([loc, ids]) =>
            supabaseAdmin
              .from("subplate")
              .update({ location: loc, updated_at: now })
              .in("id", ids)
          )
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
