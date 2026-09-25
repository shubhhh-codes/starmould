import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers } from "@/lib/cache";

/**
 * RFC 4180 compliant CSV cell formatter with CWE-1236 Formula Injection sanitization
 */
function formatCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Prevent spreadsheet formula execution by prepending a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function formatDate(d: any): string {
  if (!d) return "";
  const str = String(d).slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // one of the 7 exact methods

    // Also support getting live record counts for all 7 exports
    if (!type || type === "counts") {
      const [
        { count: countPurchase },
        { count: countMould },
        { count: countMouldReg },
        { count: countPurchaseRec },
        { count: countOutward },
        { count: countDispatch },
        { count: countPendingOutward },
      ] = await Promise.all([
        supabaseAdmin.from("purchase").select("*", { count: "exact", head: true }).eq("status", "1"),
        supabaseAdmin.from("scan").select("*", { count: "exact", head: true }).neq("worktype", "Sample").eq("status", "pending"),
        supabaseAdmin.from("scan").select("*", { count: "exact", head: true }).neq("worktype", "Sample").eq("status", "registered"),
        supabaseAdmin.from("view_po_pending_inward_qty").select("*", { count: "exact", head: true }).neq("pending_qty", 0),
        supabaseAdmin.from("challan").select("*", { count: "exact", head: true }).eq("status", "1"),
        supabaseAdmin.from("dispatch").select("*", { count: "exact", head: true }).eq("status", "1"),
        supabaseAdmin.from("view_pending_inward_qty").select("*", { count: "exact", head: true }).neq("pending_qty", 0),
      ]);

      return NextResponse.json({
        counts: {
          export: countPurchase || 0,
          exportmould: countMould || 0,
          exportmouldreg: countMouldReg || 0,
          exportpurchaserec: countPurchaseRec || 0,
          exportoutward: countOutward || 0,
          exportdispatchchallan: countDispatch || 0,
          exportpendingoutward: countPendingOutward || 0,
        },
      });
    }

    const customers = await getCachedCustomers();
    const custMap = new Map((customers || []).map((c: any) => [c.id, c]));

    let csvContent = "";
    let filename = "export.csv";

    // 1. export() -> purchase.xlsx
    if (type === "export") {
      filename = "purchase.csv";
      const { data: pos } = await supabaseAdmin
        .from("purchase")
        .select("*")
        .eq("status", "1")
        .order("id", { ascending: false });

      const headers = ["ID", "PO No", "Customer", "Vendor", "Project ID", "Order Date", "Status"];
      const rows = (pos || []).map((p) => {
        const cust = custMap.get(Number(p.cname));
        const vend = custMap.get(Number(p.vname));
        return [
          formatCsvCell(p.id),
          formatCsvCell(p.srno || p.purchaseid || ""),
          formatCsvCell(cust?.customername || p.cname || ""),
          formatCsvCell(vend?.customername || p.vname || ""),
          formatCsvCell(p.projectid || ""),
          formatCsvCell(formatDate(p.odate)),
          formatCsvCell(p.status === "1" ? "Active" : "Inactive"),
        ];
      });
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // 2. exportmould() -> dashboard.xlsx
    else if (type === "exportmould") {
      filename = "dashboard.csv";
      const { data: moulds } = await supabaseAdmin
        .from("scan")
        .select("*")
        .neq("worktype", "Sample")
        .eq("status", "pending")
        .order("id", { ascending: false });

      const headers = ["ID", "Project Code", "Customer", "Description", "Work Type", "RDate", "Status"];
      const rows = (moulds || []).map((m) => {
        const cust = custMap.get(Number(m.cname));
        return [
          formatCsvCell(m.id),
          formatCsvCell(m.projectid || ""),
          formatCsvCell(cust?.customername || m.cname || ""),
          formatCsvCell(m.description || ""),
          formatCsvCell(m.worktype || "Scanning"),
          formatCsvCell(formatDate(m.rdate)),
          formatCsvCell(m.status || ""),
        ];
      });
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // 3. exportmouldreg() -> project register.xlsx
    else if (type === "exportmouldreg") {
      filename = "project_register.csv";
      const { data: moulds } = await supabaseAdmin
        .from("scan")
        .select("*")
        .neq("worktype", "Sample")
        .eq("status", "registered")
        .order("id", { ascending: false });

      const headers = ["ID", "Project Code", "Customer", "Description", "Work Type", "RDate", "Amount", "Status"];
      const rows = (moulds || []).map((m) => {
        const cust = custMap.get(Number(m.cname));
        return [
          formatCsvCell(m.id),
          formatCsvCell(m.projectid || ""),
          formatCsvCell(cust?.customername || m.cname || ""),
          formatCsvCell(m.description || ""),
          formatCsvCell(m.worktype || "Scanning"),
          formatCsvCell(formatDate(m.rdate)),
          formatCsvCell(m.amount || 0),
          formatCsvCell(m.status || ""),
        ];
      });
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // 4. exportpurchaserec() -> pending purchase receive.xlsx (view_po_pending_inward_qty)
    else if (type === "exportpurchaserec") {
      filename = "pending_purchase_receive.csv";
      const { data: poInwards } = await supabaseAdmin
        .from("view_po_pending_inward_qty")
        .select("*")
        .neq("pending_qty", 0)
        .order("id", { ascending: false });

      const headers = ["ID", "PO No", "Customer", "Vendor", "Material", "Type", "Ordered Qty", "Inward Qty", "Pending Qty", "Plate Name"];
      const rows = (poInwards || []).map((p) => [
        formatCsvCell(p.id),
        formatCsvCell(p.srno || ""),
        formatCsvCell(p.customername || ""),
        formatCsvCell(p.vendorname || ""),
        formatCsvCell(p.material || ""),
        formatCsvCell(p.materialtype || ""),
        formatCsvCell(p.qty || 0),
        formatCsvCell(p.inward_qty || 0),
        formatCsvCell(p.pending_qty || 0),
        formatCsvCell(p.platename || ""),
      ]);
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // 5. exportoutward() -> outward.xlsx
    else if (type === "exportoutward") {
      filename = "outward.csv";
      const { data: challans } = await supabaseAdmin
        .from("challan")
        .select("*")
        .eq("status", "1")
        .order("id", { ascending: false });

      const headers = ["ID", "Challan No", "Vendor", "Transporter", "Date", "Status"];
      const rows = (challans || []).map((c) => {
        const vend = custMap.get(Number(c.vendorid));
        const trans = custMap.get(Number(c.vendortid));
        return [
          formatCsvCell(c.id),
          formatCsvCell(c.challanno || ""),
          formatCsvCell(vend?.customername || c.vendorid || ""),
          formatCsvCell(trans?.customername || c.vendortid || ""),
          formatCsvCell(formatDate(c.chdate)),
          formatCsvCell(c.status === "1" ? "Active" : "Inactive"),
        ];
      });
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // 6. exportdispatchchallan() -> DispatchChallan.xlsx
    else if (type === "exportdispatchchallan") {
      filename = "DispatchChallan.csv";
      const { data: dispatches } = await supabaseAdmin
        .from("dispatch")
        .select("*")
        .eq("status", "1")
        .order("id", { ascending: false });

      const headers = ["ID", "Dispatch Date", "Invoice No", "Customer", "Status"];
      const rows = (dispatches || []).map((d) => {
        const cust = custMap.get(Number(d.customerid));
        return [
          formatCsvCell(d.id),
          formatCsvCell(formatDate(d.chdate)),
          formatCsvCell(d.invoiceno || ""),
          formatCsvCell(cust?.customername || d.customerid || ""),
          formatCsvCell(d.status === "1" ? "Active" : "Inactive"),
        ];
      });
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    // 7. exportpendingoutward() -> pending outward.xlsx (view_pending_inward_qty)
    else if (type === "exportpendingoutward") {
      filename = "pending_outward.csv";
      const { data: pending } = await supabaseAdmin
        .from("view_pending_inward_qty")
        .select("*")
        .neq("pending_qty", 0)
        .order("id", { ascending: false });

      const headers = ["ID", "Challan No", "Customer", "Vendor", "Transporter", "Date", "Particulars", "Qty", "Inward Qty", "Pending Qty", "Plate Name"];
      const rows = (pending || []).map((p) => [
        formatCsvCell(p.id),
        formatCsvCell(p.challanno || ""),
        formatCsvCell(p.customername || ""),
        formatCsvCell(p.vendorname || ""),
        formatCsvCell(p.transportername || ""),
        formatCsvCell(formatDate(p.chdate)),
        formatCsvCell(p.particulars || ""),
        formatCsvCell(p.qty || 0),
        formatCsvCell(p.inward_qty || 0),
        formatCsvCell(p.pending_qty || 0),
        formatCsvCell(p.platename || ""),
      ]);
      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
