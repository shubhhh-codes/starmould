import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

// GET /api/dispatch - fetch dispatches, customers, subplates, scans (Roles 0, 1, 2)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "100");

    // 1. Fetch dispatch headers
    const { data: dispatches, error: dErr } = await supabaseAdmin
      .from("dispatch")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    const dIds = (dispatches || []).map((d) => d.id);

    // 2. Fetch dispatch items
    const { data: items, error: itErr } = await supabaseAdmin
      .from("dispatch_items")
      .select("*")
      .in("dispatchid", dIds);

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    // 3. Lookups: customers, subplates, scans
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, customername, usertype, initials");

    const custMap = new Map((customers || []).map((c) => [c.id, c.customername]));

    const { data: subplates } = await supabaseAdmin
      .from("subplate")
      .select("id, platename, projectid, material, sqty, location")
      .limit(2000);

    const plateMap = new Map((subplates || []).map((sp) => [sp.id, sp.platename]));

    const { data: scans } = await supabaseAdmin
      .from("scan")
      .select("id, description, cname, status")
      .limit(1000);

    // 4. Enrich dispatches
    const enrichedDispatches = (dispatches || []).map((d) => {
      const dItems = (items || [])
        .filter((it) => it.dispatchid === d.id)
        .map((it) => ({
          ...it,
          platename: it.custom_plate_name || plateMap.get(it.plateid) || `Plate #${it.plateid}`,
          customername: custMap.get(it.customer) || `ID: ${it.customer}`,
        }));

      return {
        ...d,
        customername: custMap.get(d.customerid) || `Customer #${d.customerid}`,
        transportername: custMap.get(d.vendortid) || `Transporter #${d.vendortid}`,
        items: dItems,
      };
    });

    return NextResponse.json({
      dispatches: enrichedDispatches,
      customers: customers || [],
      subplates: subplates || [],
      scans: scans || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/dispatch - create dispatch challan and line items (Roles 0, 1, 2)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      chdate,
      customerid,
      vendortid,
      projectid,
      invoiceno,
      vehicleno,
      deliverytype,
      freightmode,
      freightcharge,
      noofcases,
      items,
    } = body;

    if (!customerid || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Sequence SM/DC/0001
    const { data: maxRows } = await supabaseAdmin
      .from("dispatch")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    const nextId = (maxRows?.[0]?.id ?? 0) + 1;
    const challanno = `SM/DC/${String(nextId).padStart(4, "0")}`;

    // 1. Insert header
    const { data: newDispatch, error: dErr } = await supabaseAdmin
      .from("dispatch")
      .insert([
        {
          challanno,
          chdate: chdate || new Date().toISOString().slice(0, 10),
          customerid: Number(customerid),
          vendortid: vendortid ? Number(vendortid) : Number(customerid),
          projectid: projectid || "",
          invoiceno: invoiceno || "N/A",
          vehicleno: vehicleno || "N/A",
          deliverytype: deliverytype || "Door Delivery",
          freightmode: freightmode || "To Pay",
          freightcharge: freightcharge || "N/A",
          noofcases: noofcases || "1",
          status: "1",
          created_by: auth.user.name || "Admin",
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    // 2. Insert items
    const itemsToInsert = items.map((it: any) => ({
      dispatchid: newDispatch.id,
      plateid: it.plateid ? Number(it.plateid) : null,
      custom_plate_name: it.custom_plate_name || null,
      custom_plate_qty: it.custom_plate_qty ? Number(it.custom_plate_qty) : null,
      customer: it.customer ? Number(it.customer) : Number(customerid),
      project: it.project || projectid || "",
      particulars: it.particulars || "",
      condition: it.condition || "",
      work: it.work || "",
      qty: it.qty ? Number(it.qty) : 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { data: createdItems, error: itErr } = await supabaseAdmin
      .from("dispatch_items")
      .insert(itemsToInsert)
      .select();

    if (itErr) {
      await supabaseAdmin.from("dispatch").delete().eq("id", newDispatch.id);
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    invalidateCache("api_counts_all");

    return NextResponse.json({
      dispatch: {
        ...newDispatch,
        items: createdItems,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/dispatch?id=123 - soft delete dispatch (Roles 0, 1, 2)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Dispatch ID required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("dispatch")
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
