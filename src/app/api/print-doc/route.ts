import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { verifySecurePrintToken } from "@/lib/print-token";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let type = searchParams.get("type"); // "challan" | "inward" | "purchase" | "dispatch" | "work"
    let id = searchParams.get("id");
    const token = searchParams.get("token");
    let isTokenValid = false;

    // If a secure token is passed, decode and verify it
    if (token) {
      const decoded = verifySecurePrintToken(token);
      if (!decoded) {
        return NextResponse.json({ error: "Invalid or tampered print token" }, { status: 400 });
      }
      type = decoded.type;
      id = decoded.id;
      isTokenValid = true;
    } else if (id && id.includes(".")) {
      // If the token was passed as the id parameter
      const decoded = verifySecurePrintToken(id);
      if (decoded) {
        type = decoded.type;
        id = decoded.id;
        isTokenValid = true;
      }
    }

    let authUser: any = null;
    if (!isTokenValid) {
      const auth = await authenticateRequest(req);
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      authUser = auth.user;
    }

    if (!type || !id) {
      return NextResponse.json({ error: "Document type and ID are required" }, { status: 400 });
    }

    // Role checks only apply to session-authenticated users (valid print token holders bypass session role gates)
    if (authUser) {
      const userRoleId = authUser.role_id;
      if (type === "purchase" && ![0, 1].includes(userRoleId)) {
        return NextResponse.json({ error: "Access denied: Purchase document is restricted to Admin and Manager" }, { status: 403 });
      }
      if (type === "quotation" && ![0, 1, 5].includes(userRoleId)) {
        return NextResponse.json({ error: "Access denied: Quotation document is restricted to Admin, Manager, and Sales" }, { status: 403 });
      }
      if (["challan", "inward", "dispatch"].includes(type) && ![0, 1, 2].includes(userRoleId)) {
        return NextResponse.json({ error: "Access denied: Logistics documents are restricted to Admin, Manager, and Supervisor" }, { status: 403 });
      }
    }

    // 1. Challan Document
    if (type === "challan") {
      const { data: challan, error: cErr } = await supabaseAdmin
        .from("challan")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (cErr || !challan) return NextResponse.json({ error: "Challan not found" }, { status: 404 });

      const [vendorRes, custRes, transRes, itemsRes] = await Promise.all([
        challan.vendorid
          ? supabaseAdmin
              .from("vendors")
              .select("id, vendor_name, mobile, mobile1, address, email, vendor_code, city, gstin, pan, bank_name, account_no, ifsc_code")
              .eq("id", challan.vendorid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        challan.customerid
          ? supabaseAdmin
              .from("customers")
              .select("id, customername")
              .eq("id", challan.customerid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        challan.vendortid
          ? supabaseAdmin
              .from("vendors")
              .select("id, vendor_name")
              .eq("id", challan.vendortid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from("challan_items")
          .select("*")
          .eq("challanid", challan.id),
      ]);

      const vendor = vendorRes.data ? { ...vendorRes.data, customername: vendorRes.data.vendor_name } : null;
      const customer = custRes.data;
      const transporter = transRes.data?.vendor_name || "";
      const items = itemsRes.data || [];

      const plateIds = items.map((it) => it.plateid).filter(Boolean);
      let subplates: any[] = [];
      if (plateIds.length > 0) {
        const { data: sps } = await supabaseAdmin
          .from("subplate")
          .select("id, platename, subprojectid, material, width, height, length")
          .in("id", plateIds);
        subplates = sps || [];
      }

      const plateMap = new Map(subplates.map((sp) => [sp.id, sp]));

      return NextResponse.json({
        docType: "OUTWARD JOB WORK CHALLAN",
        docNumber: challan.challanno,
        docDate: challan.chdate,
        party: vendor,
        customerName: customer?.customername || "",
        transporter,
        projectCode: challan.projectid,
        items: items.map((it, idx) => {
          const sp = plateMap.get(it.plateid);
          return {
            srNo: idx + 1,
            particulars: it.particulars || "Standard Jobwork",
            platename: sp?.platename || "Mould Plate",
            material: sp?.material || "",
            dimensions: sp
              ? `${sp.width}x${sp.height}x${sp.length}`
              : "",
            qty: it.qty || 1,
          };
        }),
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

      const [vendorRes, itemsRes] = await Promise.all([
        inward.vendorid
          ? supabaseAdmin
              .from("vendors")
              .select("id, vendor_name, mobile, mobile1, address, email, vendor_code, city, gstin, pan, bank_name, account_no, ifsc_code")
              .eq("id", inward.vendorid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from("inward_items")
          .select("*")
          .eq("inchallanid", inward.id),
      ]);

      const vendor = vendorRes.data ? { ...vendorRes.data, customername: vendorRes.data.vendor_name } : null;
      const items = itemsRes.data || [];

      return NextResponse.json({
        docType: "JOB WORK INWARD RECEIPT",
        docNumber: inward.inchallanno,
        docDate: inward.chdate,
        party: vendor,
        projectCode: inward.projectid,
        items: items.map((it, idx) => ({
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

      const [vendorRes, custVendorRes, custRes, itemsRes] = await Promise.all([
        purchase.vname
          ? supabaseAdmin
              .from("vendors")
              .select("id, vendor_name, mobile, mobile1, address, email, vendor_code, city, gstin, pan, bank_name, account_no, ifsc_code")
              .eq("id", purchase.vname)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        purchase.vname
          ? supabaseAdmin
              .from("customers")
              .select("id, customername, mobile, mobile1, address, email, city, gstin, pan")
              .eq("id", purchase.vname)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        purchase.cname
          ? supabaseAdmin
              .from("customers")
              .select("id, customername")
              .eq("id", purchase.cname)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from("purchase_items")
          .select("*")
          .eq("pid", purchase.id),
      ]);

      const vendor = vendorRes.data
        ? { ...vendorRes.data, customername: vendorRes.data.vendor_name }
        : custVendorRes.data
        ? { ...custVendorRes.data, vendor_name: custVendorRes.data.customername }
        : null;

      const items = itemsRes.data || [];
      const plateIds = items.map((it) => it.plateid).filter(Boolean);
      let subplates: any[] = [];
      if (plateIds.length > 0) {
        const { data: sps } = await supabaseAdmin
          .from("subplate")
          .select("id, platename, subprojectid, material, width, height, length, unit")
          .in("id", plateIds);
        subplates = sps || [];
      }
      const plateMap = new Map(subplates.map((sp) => [sp.id, sp]));

      return NextResponse.json({
        docType: "PURCHASE ORDER",
        docNumber: purchase.srno,
        docDate: purchase.odate,
        party: vendor,
        customerName: custRes.data?.customername || "",
        projectCode: purchase.projectid,
        items: items.map((it, idx) => {
          const sp = plateMap.get(it.plateid);
          return {
            srNo: idx + 1,
            plateid: it.plateid,
            platename: sp?.platename || `Subplate #${it.plateid}`,
            particulars: `${sp?.platename || "Subplate"} (${it.material || ""})`,
            material: it.material || (sp ? `${sp.width}x${sp.height}x${sp.length} ${sp.unit || "mm"}` : "—"),
            materialtype: it.materialtype || sp?.material || "MS-Bright",
            qty: it.qty || 1,
            rate: it.rate !== null && it.rate !== undefined && it.rate !== "" ? Number(it.rate) : null,
            hsn: it.hsn || "72284000",
          };
        }),
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

      const [custRes, transpRes, itemsRes] = await Promise.all([
        dispatch.customerid
          ? supabaseAdmin
              .from("customers")
              .select("id, customername, mobile, mobile1, address, city, email, gstin, pan, customer_code")
              .eq("id", dispatch.customerid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        dispatch.vendortid
          ? supabaseAdmin
              .from("vendors")
              .select("id, vendor_name")
              .eq("id", dispatch.vendortid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin
          .from("dispatch_items")
          .select("*")
          .eq("dispatchid", dispatch.id),
      ]);

      const customer = custRes.data;
      const transporter = transpRes.data;
      const items = itemsRes.data || [];

      // Enrich linked subplate details if present
      const plateIds = items.map((it: any) => it.plateid).filter(Boolean);
      let plateMap = new Map();
      if (plateIds.length > 0) {
        const { data: pData } = await supabaseAdmin
          .from("subplate")
          .select("id, platename, subprojectid, material")
          .in("id", plateIds);
        if (pData) {
          plateMap = new Map(pData.map((p) => [p.id, p]));
        }
      }

      return NextResponse.json({
        docType: "FINISHED MOULD DELIVERY CHALLAN",
        docNumber: dispatch.challanno,
        docDate: dispatch.chdate,
        party: customer,
        transporter: transporter?.vendor_name || "",
        invoiceNo: dispatch.invoiceno,
        vehicleNo: dispatch.vehicleno,
        deliveryType: dispatch.deliverytype,
        freightMode: dispatch.freightmode,
        noOfCases: dispatch.noofcases,
        projectCode: dispatch.projectid,
        items: items.map((it: any, idx: number) => {
          const sp = it.plateid ? plateMap.get(it.plateid) : null;
          const componentName = it.custom_plate_name || sp?.platename || "Mould Tooling Component";
          return {
            srNo: idx + 1,
            componentName,
            particulars: componentName,
            specifications: it.particulars || "",
            subprojectId: sp?.subprojectid || null,
            material: sp?.material || null,
            projectCode: it.project || dispatch.projectid || "",
            condition: it.condition || "NEW",
            work: it.work || "NEW MADE",
            qty: it.qty || 1,
          };
        }),
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

      const cleanSubplateId = String(worklog.subplateid || "").replace(/[(),.%]/g, "");

      const [custRes, opRes, scanRes, spRes] = await Promise.all([
        worklog.customerid
          ? supabaseAdmin
              .from("customers")
              .select("id, customername, mobile, mobile1, address, email")
              .eq("id", worklog.customerid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        worklog.userid
          ? supabaseAdmin
              .from("users")
              .select("id, name, username, usertype, usersubtype")
              .eq("id", worklog.userid)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        worklog.projectid
          ? supabaseAdmin
              .from("scan")
              .select("id, projectid, description, worktype, cname")
              .eq("projectid", worklog.projectid)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        cleanSubplateId
          ? supabaseAdmin
              .from("subplate")
              .select("id, platename, subprojectid, material, width, height, length, unit")
              .or(`id.eq.${Number(cleanSubplateId) || 0},subprojectid.eq.${cleanSubplateId || "none"}`)
              .limit(1)
          : Promise.resolve({ data: [] }),
      ]);

      const customer = custRes.data;
      const operator = opRes.data;
      const scan = scanRes.data;
      const subplate = spRes.data?.[0];

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

    // 6. Sample Project Order Document
    if (type === "sample") {
      const { data: sample, error: sErr } = await supabaseAdmin
        .from("scan")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (sErr || !sample) return NextResponse.json({ error: "Sample project not found" }, { status: 404 });

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, mobile1, address, email")
        .eq("id", Number(sample.cname))
        .single();

      return NextResponse.json({
        docType: "SAMPLE DEVELOPMENT JOB ORDER",
        docNumber: sample.projectid,
        docDate: sample.rdate || sample.cdate,
        party: customer,
        projectCode: sample.projectid,
        workType: sample.worktype || "Sample",
        items: [
          {
            srNo: 1,
            particulars: sample.description || "Sample Mould / Prototype Development",
            workDescription: sample.note || sample.subnote || "—",
            qty: 1,
          },
        ],
      });
    }

    // 7. Subplate Production Traveler Document
    if (type === "subplate") {
      const { data: subplate, error: spErr } = await supabaseAdmin
        .from("subplate")
        .select("*")
        .eq("id", Number(id))
        .single();

      if (spErr || !subplate) return NextResponse.json({ error: "Subplate record not found" }, { status: 404 });

      const { data: scan } = await supabaseAdmin
        .from("scan")
        .select("id, projectid, description, cname")
        .eq("id", Number(subplate.projectid))
        .maybeSingle();

      const { data: customer } = await supabaseAdmin
        .from("customers")
        .select("id, customername, mobile, address")
        .eq("id", Number(scan?.cname || 0))
        .maybeSingle();

      return NextResponse.json({
        docType: "SUBPLATE MANUFACTURING ROUTER",
        docNumber: subplate.subprojectid || `SP-${subplate.id}`,
        docDate: subplate.created_at ? String(subplate.created_at).slice(0, 10) : "",
        party: customer || { customername: "In-House" },
        projectCode: scan?.projectid || subplate.projectid,
        items: [
          {
            srNo: 1,
            particulars: `${subplate.platename || "Subplate"} (${subplate.material || "Steel"})`,
            dimensions: `${subplate.width || 0}x${subplate.height || 0}x${subplate.length || 0} ${subplate.unit || "mm"}`,
            material: subplate.material || "Tool Steel",
            location: subplate.location || "SM",
            qty: subplate.sqty || 1,
          },
        ],
      });
    }

    // 6. Quotation Document
    if (type === "quotation") {
      const { data: quote, error: qErr } = await supabaseAdmin
        .from("quotations")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (qErr || !quote) {
        return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
      }

      const { data: items } = await supabaseAdmin
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", id)
        .order("sr_no", { ascending: true });

      const fullQuote = {
        ...quote,
        items: items || [],
      };

      return NextResponse.json({
        id: quote.id,
        docType: "QUOTATION",
        docNumber: quote.quotation_no,
        docDate: quote.quotation_date,
        party: {
          id: quote.id,
          customername: quote.consignee_name,
          vendor_name: quote.consignee_name,
          address: quote.consignee_address,
          gstin: quote.consignee_gstin,
          state: quote.consignee_state,
          email: quote.consignee_email,
          mobile: quote.consignee_mobile,
        },
        quote: fullQuote,
        items: fullQuote.items,
      });
    }

    return NextResponse.json({ error: "Unknown document type" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Print error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
