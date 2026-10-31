import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedVendors, invalidateCache } from "@/lib/cache";

async function generateNextDispatchNo(offset = 0): Promise<string> {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const dd = String(nowIST.getDate()).padStart(2, "0");
  const mm = String(nowIST.getMonth() + 1).padStart(2, "0");
  const yyyy = String(nowIST.getFullYear());
  const todayPrefix = `SMDC${dd}${mm}${yyyy}`;

  const { count: todayCount } = await supabaseAdmin
    .from("dispatch")
    .select("id", { count: "exact", head: true })
    .like("challanno", `${todayPrefix}%`);

  const seq = String((todayCount ?? 0) + 1 + offset).padStart(3, "0");
  return `${todayPrefix}${seq}`;
}

// GET /api/dispatch - fetch dispatches, customers, subplates, scans (Roles 0, 1, 2)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 9], "nav_dispatch");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("action") === "next-number") {
      const nextNo = await generateNextDispatchNo();
      return NextResponse.json({ nextNumber: nextNo });
    }

    const limit = Number(searchParams.get("limit") || "100");

    // 1. Fetch dispatch headers and cached customers concurrently
    const [dRes, customers, vendors] = await Promise.all([
      supabaseAdmin
        .from("dispatch")
        .select("*")
        .order("id", { ascending: false })
        .limit(limit),
      getCachedCustomers(),
      getCachedVendors(),
    ]);

    if (dRes.error) {
      return NextResponse.json({ error: dRes.error.message }, { status: 500 });
    }

    const dispatches = dRes.data || [];
    const dIds = dispatches.map((d) => d.id);

    // 2. Fetch dispatch items
    let items: any[] = [];
    if (dIds.length > 0) {
      const itemsRes = await supabaseAdmin
        .from("dispatch_items")
        .select("*")
        .in("dispatchid", dIds)
        .limit(10000);
      if (itemsRes.error) {
        return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
      }
      items = itemsRes.data || [];
    }
    const custMap = new Map((customers || []).map((c: any) => [c.id, c.customername]));
    const vendMap = new Map((vendors || []).map((v: any) => [v.id, v.vendor_name]));

    // Query ONLY subplates referenced by the fetched items
    const itemPlateIds = Array.from(new Set(items.map((it) => it.plateid).filter(Boolean)));
    const { data: subplates } = itemPlateIds.length > 0
      ? await supabaseAdmin
          .from("subplate")
          .select("id, platename")
          .in("id", itemPlateIds.slice(0, 500))
      : { data: [] };

    const plateMap = new Map((subplates || []).map((sp) => [sp.id, sp.platename]));

    // 3. Enrich dispatches
    const enrichedDispatches = (dispatches || []).map((d) => {
      const dItems = items
        .filter((it) => it.dispatchid === d.id)
        .map((it) => ({
          ...it,
          platename: it.custom_plate_name || plateMap.get(it.plateid) || `Plate #${it.plateid}`,
          customername: custMap.get(it.customer) || `ID: ${it.customer}`,
        }));

      return {
        ...d,
        customername: custMap.get(d.customerid) || `Customer #${d.customerid}`,
        transportername: vendMap.get(d.vendortid) || `Transporter #${d.vendortid}`,
        items: dItems,
      };
    });

    const response = NextResponse.json({
      dispatches: enrichedDispatches,
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/dispatch - create dispatch challan and line items (Roles 0, 1, 2)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 9], "nav_dispatch");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      challanno,
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

    // Enforce rule: Only one delivery challan (dispatch) may be created per mould project
    if (projectid) {
      const trimmedProject = String(projectid).trim();
      const { data: existingDispatch } = await supabaseAdmin
        .from("dispatch")
        .select("id, challanno")
        .eq("status", "1")
        .eq("projectid", trimmedProject)
        .limit(1)
        .maybeSingle();

      if (existingDispatch) {
        return NextResponse.json(
          {
            error: `A delivery challan already exists for mould "${trimmedProject}" (${existingDispatch.challanno}). Only one final delivery dispatch is permitted per mould project.`,
          },
          { status: 400 }
        );
      }
    }

    let newDispatch: any = null;
    let dErr: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const finalChallanNo = challanno?.trim() || (await generateNextDispatchNo(attempt));

      const res = await supabaseAdmin
        .from("dispatch")
        .insert([
          {
            challanno: finalChallanNo,
            chdate: chdate || new Date().toISOString().slice(0, 10),
            customerid: Number(customerid),
            vendortid: vendortid ? Number(vendortid) : null,
            projectid: projectid || "",
            invoiceno: invoiceno?.trim() || "N/A",
            vehicleno: vehicleno?.trim() || "N/A",
            deliverytype: deliverytype || "Door Delivery",
            freightmode: freightmode || "To Pay",
            freightcharge: freightcharge?.trim() || "N/A",
            noofcases: noofcases || "1",
            status: "1",
            created_by: auth.user.name || "Admin",
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (!res.error) {
        newDispatch = res.data;
        dErr = null;
        break;
      }
      dErr = res.error;
      if (res.error.code !== "23505" && !res.error.message?.includes("unique constraint")) {
        break;
      }
    }

    if (dErr) {
      if (
        dErr.code === "23505" ||
        dErr.message?.includes("unique constraint") ||
        dErr.message?.includes("duplicate key")
      ) {
        return NextResponse.json(
          { error: "A dispatch with this invoice number already exists." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    // 2. Insert items
    const itemsToInsert = items.map((it: any) => ({
      dispatchid: newDispatch.id,
      plateid: it.plateid ? Number(it.plateid) : null,
      custom_plate_name: it.custom_plate_name || null,
      custom_plate_qty: it.custom_plate_qty ? Number(it.custom_plate_qty) : null,
      customer: it.customer && !isNaN(Number(it.customer)) ? Number(it.customer) : Number(customerid),
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

    // Automatically complete project status in scan register and update subplate locations to Customer
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    if (projectid) {
      const trimmedProject = String(projectid).trim();
      await supabaseAdmin
        .from("scan")
        .update({
          status: "completed",
          dispatchdate: todayDate,
          updated_at: nowIso,
        })
        .eq("projectid", trimmedProject);

      const dispatchedPlateIds = itemsToInsert
        .map((it: any) => Number(it.plateid))
        .filter(Boolean);

      if (dispatchedPlateIds.length > 0) {
        await supabaseAdmin
          .from("subplate")
          .update({
            location: "Customer",
            updated_at: nowIso,
          })
          .in("id", dispatchedPlateIds);
      } else {
        await supabaseAdmin
          .from("subplate")
          .update({
            location: "Customer",
            updated_at: nowIso,
          })
          .eq("projectid", trimmedProject);
      }
    }

    invalidateCache("api_counts_all");
    invalidateCache("scanning_default_");
    invalidateCache("subplate_default_");
    invalidateCache("shared_scans_lookup");
    invalidateCache("scanning_kpi_metrics_v2");

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
  const auth = await authenticateRequest(req, [0, 1, 2, 9], "nav_dispatch");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Dispatch ID required" }, { status: 400 });
    }

    const dispatchId = Number(id);

    // Fetch dispatch details before marking status = 0
    const { data: dispatchRecord } = await supabaseAdmin
      .from("dispatch")
      .select("id, projectid")
      .eq("id", dispatchId)
      .maybeSingle();

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("dispatch")
      .update({ status: "0", updated_at: now })
      .eq("id", dispatchId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (dispatchRecord?.projectid) {
      const trimmedProject = String(dispatchRecord.projectid).trim();
      await supabaseAdmin
        .from("scan")
        .update({ status: "registered", updated_at: now })
        .eq("projectid", trimmedProject);

      await supabaseAdmin
        .from("subplate")
        .update({ location: "SM", updated_at: now })
        .eq("projectid", trimmedProject);
    }

    invalidateCache("api_counts_all");
    invalidateCache("scanning_default_");
    invalidateCache("subplate_default_");
    invalidateCache("shared_scans_lookup");
    invalidateCache("scanning_kpi_metrics_v2");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
