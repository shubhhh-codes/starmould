import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/inward - Fetch Job Work Inwards, items, pending return lists, and customer lookups (Roles 0, 1, 2)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
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

    // 2. Fetch Customers lookup
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, customername, initials, usertype, mobile, mobile1")
      .is("deleted_at", null);

    const custMap = new Map((customers || []).map((c) => [c.id, c]));

    // 3. Fetch Linked Challans lookup
    const challanIds = Array.from(new Set((inwards || []).map((i) => i.challanid).filter(Boolean)));
    const { data: challans } = await supabaseAdmin
      .from("challan")
      .select("id, challanno, chdate, vendorid, customerid, projectid")
      .in("id", challanIds.length > 0 ? challanIds : [0]);

    const challanMap = new Map((challans || []).map((c) => [c.id, c]));

    // 4. Fetch Inward Items
    const inwardIds = (inwards || []).map((i) => i.id);
    let itemsMap: Record<number, any[]> = {};

    if (inwardIds.length > 0) {
      const { data: items } = await supabaseAdmin
        .from("inward_items")
        .select("*")
        .in("inchallanid", inwardIds.slice(0, 500));

      for (const item of items || []) {
        if (!itemsMap[item.inchallanid]) itemsMap[item.inchallanid] = [];
        itemsMap[item.inchallanid].push(item);
      }
    }

    // 5. Fetch Subplates lookup
    const { data: subplates } = await supabaseAdmin
      .from("subplate")
      .select("id, platename, subprojectid, projectid, material, location")
      .is("deleted_at", null)
      .limit(2000);

    const subMap = new Map((subplates || []).map((sp) => [sp.id, sp]));

    // 6. Query view_pending_inward_qty for challans with pending inward quantities
    const { data: pendingChallans } = await supabaseAdmin
      .from("view_pending_inward_qty")
      .select("*")
      .gt("pending_qty", 0)
      .limit(500);

    const enriched = (inwards || []).map((inw) => {
      const cust = custMap.get(inw.customerid);
      const vendor = custMap.get(inw.vendorid);
      const transporter = custMap.get(inw.vendortid);
      const ch = challanMap.get(inw.challanid);
      const rawItems = itemsMap[inw.id] || [];

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
        ...inw,
        challanno: ch?.challanno || `CH #${inw.challanid}`,
        customername: cust?.customername || `Customer #${inw.customerid}`,
        vendorname: vendor?.customername || `Vendor #${inw.vendorid}`,
        transportername: transporter?.customername || `Transporter #${inw.vendortid}`,
        items: enrichedItems,
        total_inward_qty: enrichedItems.reduce((sum, it) => sum + Number(it.inward_qty || 0), 0),
      };
    });

    return NextResponse.json({
      inwards: enriched,
      customers: customers || [],
      pendingChallans: pendingChallans || [],
      subplates: subplates || [],
      kpis: {
        totalInwards: enriched.length,
        totalPendingChallanItems: (pendingChallans || []).length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/inward - Record new Job Work Inward against Challan (Roles 0, 1, 2)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      challanid,
      inchallanno,
      customerid,
      vendorid,
      vendortid,
      projectid,
      chdate,
      items,
      created_by,
    } = body;

    if (!challanid || !vendorid) {
      return NextResponse.json(
        { error: "Outward Challan and Vendor are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Generate inward challan number if not provided (matching InwardController.php lines 494-498: SM/IW/xx)
    let finalInChallanNo = inchallanno?.trim();
    if (!finalInChallanNo) {
      const { count } = await supabaseAdmin
        .from("inward")
        .select("id", { count: "exact", head: true });
      const nextId = (count || 0) + 1;
      finalInChallanNo = nextId < 10 ? `SM/IW/0${nextId}` : `SM/IW/${nextId}`;
    }

    // 1. Insert parent Inward record
    const { data: inwardData, error: inErr } = await supabaseAdmin
      .from("inward")
      .insert([
        {
          challanid: Number(challanid),
          inchallanno: finalInChallanNo,
          customerid: customerid ? Number(customerid) : null,
          vendorid: Number(vendorid),
          vendortid: vendortid ? Number(vendortid) : Number(vendorid),
          projectid: projectid || "",
          subprojectid: 0,
          chdate: chdate || now.slice(0, 10),
          status: "1",
          created_at: now,
          created_by: created_by ? Number(created_by) : auth.user.id,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (inErr) {
      return NextResponse.json({ error: inErr.message }, { status: 500 });
    }

    // 2. Insert child items and update subplate location back to 'SM' (In-house)
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsToInsert = items.map((it: any) => ({
        challanid: Number(challanid),
        inchallanid: inwardData.id,
        plateid: it.plateid ? Number(it.plateid) : null,
        particulars: it.particulars || it.platename || "Mould Plate",
        customer: customerid ? Number(customerid) : null,
        project: it.project || projectid || "",
        qty: Number(it.qty) || 0,
        inward_qty: Number(it.inward_qty) || 0,
        pending_qty: Math.max(0, (Number(it.qty) || 0) - (Number(it.inward_qty) || 0)),
        created_at: now,
        updated_at: now,
      }));

      await supabaseAdmin.from("inward_items").insert(itemsToInsert);

      // Return subplates back to workshop location 'SM'
      const plateIds = items.map((it: any) => Number(it.plateid)).filter((id: number) => Boolean(id));
      if (plateIds.length > 0) {
        await supabaseAdmin
          .from("subplate")
          .update({ location: "SM", updated_at: now })
          .in("id", plateIds);
      }
    }

    return NextResponse.json(
      { inward: inwardData, message: "Job Work Inward recorded successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/inward - Cancel/invalidate inward record (Roles 0, 1, 2)
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
      return NextResponse.json({ error: "Missing inward id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("inward")
      .update({ status: "0", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Inward record cancelled successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
