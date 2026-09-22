import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "challan" | "inward" | "purchase" | "dispatch" | "work"
    const id = searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ error: "Document type and ID are required" }, { status: 400 });
    }

    // 1. Challan Document
    if (type === "challan") {
      const { data: challan, error: cErr } = await supabaseAdmin
        .from("challan")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (cErr || !challan) return NextResponse.json({ error: "Challan not found" }, { status: 404 });

      const { data: vendor } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, address, gst")
        .eq("id", challan.vendorid)
        .single();

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, customername")
        .eq("id", challan.customerid)
        .single();

      const { data: items } = await supabaseAdmin
        .from("challan_items")
        .select("*")
        .eq("challanid", challan.id);

      const plateIds = (items || []).map((it) => it.plateid).filter(Boolean);
      const { data: subplates } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, subprojectid, material, width, height, length")
        .in("id", plateIds);

      const plateMap = new Map((subplates || []).map((sp) => [sp.id, sp]));

      return NextResponse.json({
        docType: "OUTWARD JOB WORK CHALLAN",
        docNumber: challan.challanno,
        docDate: challan.chdate,
        party: vendor,
        customerName: customer?.customername || "",
        projectCode: challan.projectid,
        items: (items || []).map((it, idx) => ({
          srNo: idx + 1,
          particulars: it.particulars || plateMap.get(it.plateid)?.platename || "Mould Plate",
          material: plateMap.get(it.plateid)?.material || "",
          dimensions: plateMap.get(it.plateid)
            ? `${plateMap.get(it.plateid)?.width}x${plateMap.get(it.plateid)?.height}x${plateMap.get(it.plateid)?.length}`
            : "",
          qty: it.qty || 1,
        })),
      });
    }

    // 2. Inward Document
    if (type === "inward") {
      const { data: inward, error: inErr } = await supabaseAdmin
        .from("inward")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (inErr || !inward) return NextResponse.json({ error: "Inward record not found" }, { status: 404 });

      const { data: vendor } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, address")
        .eq("id", inward.vendorid)
        .single();

      const { data: items } = await supabaseAdmin
        .from("inward_items")
        .select("*")
        .eq("inchallanid", inward.id);

      return NextResponse.json({
        docType: "JOB WORK INWARD RECEIPT",
        docNumber: inward.inchallanno,
        docDate: inward.chdate,
        party: vendor,
        projectCode: inward.projectid,
        items: (items || []).map((it, idx) => ({
          srNo: idx + 1,
          particulars: it.particulars || "Tooling Component",
          orderedQty: it.qty || 0,
          inwardQty: it.inward_qty || 0,
        })),
      });
    }

    // 3. Purchase Order Document
    if (type === "purchase") {
      const { data: purchase, error: pErr } = await supabaseAdmin
        .from("purchase")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (pErr || !purchase) return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });

      const { data: vendor } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, address, gst")
        .eq("id", purchase.vname)
        .single();

      const { data: items } = await supabaseAdmin
        .from("purchase_items")
        .select("*")
        .eq("pid", purchase.id);

      return NextResponse.json({
        docType: "RAW MATERIAL PURCHASE ORDER",
        docNumber: purchase.srno,
        docDate: purchase.odate,
        party: vendor,
        projectCode: purchase.projectid,
        items: (items || []).map((it, idx) => ({
          srNo: idx + 1,
          particulars: it.material || "Raw Material Plate",
          materialType: it.materialtype || "",
          qty: it.qty || 1,
        })),
      });
    }

    // 4. Dispatch Document
    if (type === "dispatch") {
      const { data: dispatch, error: dErr } = await supabaseAdmin
        .from("dispatch")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (dErr || !dispatch) return NextResponse.json({ error: "Dispatch record not found" }, { status: 404 });

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, address, gst")
        .eq("id", dispatch.customerid)
        .single();

      const { data: transporter } = await supabaseAdmin
        .from("customers")
        .select("id, customername")
        .eq("id", dispatch.vendortid)
        .single();

      const { data: items } = await supabaseAdmin
        .from("dispatch_items")
        .select("*")
        .eq("dispatchid", dispatch.id);

      return NextResponse.json({
        docType: "FINISHED MOULD DELIVERY CHALLAN",
        docNumber: dispatch.challanno,
        docDate: dispatch.chdate,
        party: customer,
        transporter: transporter?.customername || "",
        invoiceNo: dispatch.invoiceno,
        vehicleNo: dispatch.vehicleno,
        deliveryType: dispatch.deliverytype,
        freightMode: dispatch.freightmode,
        noOfCases: dispatch.noofcases,
        projectCode: dispatch.projectid,
        items: (items || []).map((it, idx) => ({
          srNo: idx + 1,
          particulars: it.custom_plate_name || it.particulars || "Mould Tooling Component",
          condition: it.condition || "NEW",
          work: it.work || "NEW MADE",
          qty: it.qty || 1,
        })),
      });
    }

    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Print error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
