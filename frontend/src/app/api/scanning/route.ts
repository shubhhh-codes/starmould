import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/scanning - Fetch scan projects, linked subplates, worklog hours, and KPIs
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("scan")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: scans, error: scanErr } = await query;
    if (scanErr) {
      return NextResponse.json({ error: scanErr.message }, { status: 500 });
    }

    // Fetch customers lookup
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, customername, initials")
      .is("deleted_at", null);

    const custMap = new Map((customers || []).map((c) => [c.id, c]));

    // Fetch active users for staff dropdown
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, username, initials, status, role_id")
      .is("deleted_at", null);

    const userMap = new Map((users || []).map((u) => [u.id, u]));

    // Fetch subplates linked to these scans
    const scanIds = (scans || []).map((s) => s.id);
    let subplateMap: Record<number, any[]> = {};

    if (scanIds.length > 0) {
      const { data: subplates } = await supabaseAdmin
        .from("subplate")
        .select("*")
        .in("projectid", scanIds.slice(0, 500))
        .is("deleted_at", null);

      for (const sp of subplates || []) {
        if (!subplateMap[sp.projectid]) subplateMap[sp.projectid] = [];
        subplateMap[sp.projectid].push(sp);
      }
    }

    // Fetch worklog hours aggregated per scan_print_id
    let worklogMap: Record<number, { scan_hr: number; model_hr: number }> = {};

    if (scanIds.length > 0) {
      const { data: worklogs } = await supabaseAdmin
        .from("worklog")
        .select("scan_print_id, scan_hr, model_hr, rework_hr, qc_hr, insp_hr")
        .in("scan_print_id", scanIds.slice(0, 500));

      for (const w of worklogs || []) {
        if (!w.scan_print_id) continue;
        if (!worklogMap[w.scan_print_id]) {
          worklogMap[w.scan_print_id] = { scan_hr: 0, model_hr: 0 };
        }
        worklogMap[w.scan_print_id].scan_hr += Number(w.scan_hr || 0);
        worklogMap[w.scan_print_id].model_hr +=
          Number(w.model_hr || 0) +
          Number(w.rework_hr || 0) +
          Number(w.qc_hr || 0) +
          Number(w.insp_hr || 0);
      }
    }

    const enriched = (scans || []).map((s) => {
      const cust = custMap.get(s.cname);
      const scanUser = userMap.get(s.scan_by);
      const qcUser = userMap.get(s.qc_by);
      const modelUser = userMap.get(s.modeldesign_by);
      const sublist = subplateMap[s.id] || [];
      const hours = worklogMap[s.id] || { scan_hr: 0, model_hr: 0 };

      return {
        ...s,
        customername: cust?.customername || `Customer #${s.cname}`,
        customer_initials: cust?.initials || "",
        scan_by_name: scanUser?.initials || "—",
        qc_by_name: qcUser?.initials || "—",
        modeldesign_by_name: modelUser?.initials || "—",
        subplates: sublist,
        subplate_count: sublist.length,
        calc_scan_hr: hours.scan_hr || s.scan_hr || 0,
        calc_model_hr: hours.model_hr || s.model_hr || 0,
      };
    });

    // Compute KPIs across all scans in table
    const { count: totalScans } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true });

    const { count: pendingScans } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: missingScanner } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or("scan_by.eq.0,scan_by.is.null");

    const { count: missingQC } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or("qc_by.eq.0,qc_by.is.null");

    const { count: missingDesigner } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or("modeldesign_by.eq.0,modeldesign_by.is.null");

    const { data: allAmounts } = await supabaseAdmin
      .from("scan")
      .select("amount");

    const totalRevenue = (allAmounts || []).reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

    return NextResponse.json({
      scans: enriched,
      customers: customers || [],
      users: (users || []).filter((u) => u.status === "1"),
      kpis: {
        totalScans: totalScans || 0,
        pendingScans: pendingScans || 0,
        missingScanner: missingScanner || 0,
        missingQC: missingQC || 0,
        missingDesigner: missingDesigner || 0,
        totalRevenue,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/scanning - Create new Scanning project (matches ScanningController.php store)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      rdate,
      cdate,
      cname,
      description,
      scan_by,
      qc_by,
      modeldesign_by,
      amount,
      note,
      subnote,
    } = body;

    if (!cname || !description) {
      return NextResponse.json(
        { error: "Customer and Description are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Fetch customer initials
    const { data: cust } = await supabaseAdmin
      .from("customers")
      .select("initials")
      .eq("id", Number(cname))
      .single();

    const initials = cust?.initials || "GEN";

    // Auto-generate project code: e.g. 0045_STM_001
    const { count } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true });

    const nextId = (count || 0) + 1;
    const projectid = `${String(nextId).padStart(4, "0")}_${initials}_001`;

    const { data, error } = await supabaseAdmin
      .from("scan")
      .insert([
        {
          projectid,
          rdate: rdate || now.slice(0, 10),
          cdate: cdate || now.slice(0, 10),
          dispatchdate: cdate || now.slice(0, 10),
          cname: Number(cname),
          description: description.trim(),
          worktype: "Scanning",
          scan_by: scan_by ? Number(scan_by) : null,
          qc_by: qc_by ? Number(qc_by) : null,
          modeldesign_by: modeldesign_by ? Number(modeldesign_by) : null,
          amount: Number(amount) || 0,
          status: "pending",
          payment: 0,
          mail_done: 0,
          note: note?.trim() || "",
          subnote: subnote?.trim() || "",
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { scan: data, message: "Scanning project created successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/scanning - Update status, staff assignment, payment toggle, or metadata
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, field, value, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (field && value !== undefined) {
      updatePayload[field] = value === "0" || value === "" ? null : value;
    } else if (updates && typeof updates === "object") {
      Object.assign(updatePayload, updates);
    }

    const { data, error } = await supabaseAdmin
      .from("scan")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ scan: data, message: "Updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/scanning - Remove scan project (Admin, Manager only: roles 0, 1)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
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
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("scan").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
