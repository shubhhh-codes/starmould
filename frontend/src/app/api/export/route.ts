import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

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

      const headers = ["ID", "PO No", "Customer ID", "Vendor ID", "Project ID", "Order Date", "Status"];
      const rows = (pos || []).map((p) => [
        p.id,
        `"${p.srno || p.purchaseid || ""}"`,
        p.cname || "",
        p.vname || "",
        `"${p.projectid || ""}"`,
        p.odate || "",
        p.status || "",
      ]);
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
      const rows = (moulds || []).map((m) => [
        m.id,
        `"${m.projectid || ""}"`,
        m.cname || "",
        `"${(m.description || "").replace(/"/g, '""')}"`,
        `"${m.worktype || ""}"`,
        m.rdate || "",
        m.status || "",
      ]);
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
      const rows = (moulds || []).map((m) => [
        m.id,
        `"${m.projectid || ""}"`,
        m.cname || "",
        `"${(m.description || "").replace(/"/g, '""')}"`,
        `"${m.worktype || ""}"`,
        m.rdate || "",
        m.amount || 0,
        m.status || "",
      ]);
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
        p.id,
        `"${p.srno || ""}"`,
        `"${p.customername || ""}"`,
        `"${p.vendorname || ""}"`,
        `"${p.material || ""}"`,
        `"${p.materialtype || ""}"`,
        p.qty || 0,
        p.inward_qty || 0,
        p.pending_qty || 0,
        `"${(p.platename || "").replace(/"/g, '""')}"`,
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

      const headers = ["ID", "Challan No", "Vendor ID", "Transporter ID", "Date", "Status"];
      const rows = (challans || []).map((c) => [
        c.id,
        `"${c.challanno || ""}"`,
        c.vendorid || "",
        c.vendortid || "",
        c.chdate || "",
        c.status || "",
      ]);
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

      const headers = ["ID", "Dispatch Date", "Invoice No", "Customer ID", "Status"];
      const rows = (dispatches || []).map((d) => [
        d.id,
        d.dispatchdate || "",
        `"${d.invoiceno || ""}"`,
        d.customerid || "",
        d.status || "",
      ]);
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
        p.id,
        `"${p.challanno || ""}"`,
        `"${p.customername || ""}"`,
        `"${p.vendorname || ""}"`,
        `"${p.transportername || ""}"`,
        p.chdate || "",
        `"${(p.particulars || "").replace(/"/g, '""')}"`,
        p.qty || 0,
        p.inward_qty || 0,
        p.pending_qty || 0,
        `"${(p.platename || "").replace(/"/g, '""')}"`,
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
