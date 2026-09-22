import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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
        .select("id, customername, mobile, mobile1, address, email")
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
        .select("id, customername, mobile, mobile1, address, email")
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
        .select("id, customername, mobile, mobile1, address, email")
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

    // 5. Work Log / Work Order Manufacturing Document (Derived from legacy work.printlist & worklog schema)
    if (type === "work") {
      const { data: worklog, error: wErr } = await supabaseAdmin
        .from("worklog")
        .select("id, scan_print_id, customerid, projectid, subplateid, work_hr, sdate, edate, starttime, endtime, workdescription, design_hr, program_hr, machine_hr, driltap_hr, qc_hr, userid, rdate, created_at")
        .eq("id", Number(id))
        .single();

      if (wErr || !worklog) {
        return NextResponse.json({ error: "Work Order record not found" }, { status: 404 });
      }

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, mobile1, address, email")
        .eq("id", worklog.customerid)
        .single();

      const { data: operator } = await supabaseAdmin
        .from("users")
        .select("id, name, username, usertype, usersubtype")
        .eq("id", worklog.userid)
        .single();

      const { data: scan } = await supabaseAdmin
        .from("scan")
        .select("id, projectid, description, worktype, cname")
        .eq("projectid", worklog.projectid)
        .limit(1)
        .maybeSingle();

      const { data: subplates } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, subprojectid, material, width, height, length, unit")
        .or(`id.eq.${Number(worklog.subplateid) || 0},subprojectid.eq.${worklog.subplateid}`)
        .limit(1);

      const subplate = subplates?.[0];

      return NextResponse.json({
        docType: "MANUFACTURING WORK ORDER & LOG",
        docNumber: `WO-${worklog.id} (${worklog.projectid || "N/A"})`,
        docDate: worklog.rdate || worklog.sdate,
        party: customer,
        operator: operator?.name || operator?.username || `User #${worklog.userid}`,
        projectCode: worklog.projectid,
        workType: scan?.worktype || "Machining",
        shiftTiming: {
          startDate: worklog.sdate,
          endDate: worklog.edate,
          startTime: worklog.starttime,
          endTime: worklog.endtime,
        },
        hoursBreakdown: {
          work_hr: worklog.work_hr || "00:00:00",
          design_hr: worklog.design_hr || 0,
          program_hr: worklog.program_hr || 0,
          machine_hr: worklog.machine_hr || 0,
          driltap_hr: worklog.driltap_hr || 0,
          qc_hr: worklog.qc_hr || 0,
        },
        items: [
          {
            srNo: 1,
            particulars: `${subplate?.platename || worklog.subplateid || "Mould Plate"} — ${worklog.workdescription || scan?.description || "Machining / Operation"}`,
            subplateId: subplate?.subprojectid || worklog.subplateid || "—",
            dimensions: subplate && subplate.width && subplate.height && subplate.length
              ? `${subplate.width}x${subplate.height}x${subplate.length} ${subplate.unit || "mm"}`
              : "—",
            material: subplate?.material || "Tool Steel",
            workDescription: worklog.workdescription || scan?.description || "—",
            work_hr: worklog.work_hr || "00:00:00",
            design_hr: worklog.design_hr || 0,
            program_hr: worklog.program_hr || 0,
            machine_hr: worklog.machine_hr || 0,
            driltap_hr: worklog.driltap_hr || 0,
            qc_hr: worklog.qc_hr || 0,
            qty: 1,
          },
        ],
      });
    }

    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Print error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
