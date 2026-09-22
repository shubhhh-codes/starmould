import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

// GET /api/sample - Fetch Sample and Rework projects (Roles 0, 1, 2, 3)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const worktype = searchParams.get("worktype"); // "Sample" | "Rework" | null (all)

    let query = supabaseAdmin
      .from("scan")
      .select("*")
      .in("worktype", worktype ? [worktype] : ["Sample", "Rework"])
      .order("id", { ascending: false });

    const { data: scanRows, error: scanErr } = await query;
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

    // Fetch worklog hours aggregated per scan_print_id
    const scanIds = (scanRows || []).map((r) => r.id);
    let worklogMap: Record<number, { scan_hr: number; model_hr: number }> = {};

    if (scanIds.length > 0) {
      const { data: worklogs } = await supabaseAdmin
        .from("worklog")
        .select("scan_print_id, scan_hr, model_hr, rework_hr, qc_hr, insp_hr")
        .in("scan_print_id", scanIds.slice(0, 1000));

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

    const enriched = (scanRows || []).map((row) => {
      const cust = custMap.get(row.cname);
      const scanUser = userMap.get(row.scan_by);
      const qcUser = userMap.get(row.qc_by);
      const modelUser = userMap.get(row.modeldesign_by);
      const hours = worklogMap[row.id] || { scan_hr: 0, model_hr: 0 };

      return {
        ...row,
        customername: cust?.customername || `Customer #${row.cname}`,
        customer_initials: cust?.initials || "",
        scan_by_name: scanUser?.initials || scanUser?.username || "—",
        qc_by_name: qcUser?.initials || qcUser?.username || "—",
        modeldesign_by_name: modelUser?.initials || modelUser?.username || "—",
        calc_scan_hr: hours.scan_hr || row.scan_hr || 0,
        calc_model_hr: hours.model_hr || row.model_hr || 0,
      };
    });

    // Counts for KPIs
    const samplePending = enriched.filter((r) => r.worktype === "Sample" && r.status === "pending").length;
    const sampleTotal = enriched.filter((r) => r.worktype === "Sample").length;
    const reworkPending = enriched.filter((r) => r.worktype === "Rework" && r.status === "pending").length;
    const reworkTotal = enriched.filter((r) => r.worktype === "Rework").length;

    return NextResponse.json({
      projects: enriched,
      customers: customers || [],
      users: (users || []).filter((u) => u.status === "1"),
      kpis: {
        samplePending,
        sampleTotal,
        reworkPending,
        reworkTotal,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sample - Create new Sample / Rework entry (Roles 0, 1, 2, 3)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
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
      worktype,
      scan_by,
      qc_by,
      modeldesign_by,
      amount,
      note,
      subnote,
    } = body;

    if (!cname || !worktype) {
      return NextResponse.json(
        { error: "Customer and Work Type are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const prefix = worktype === "Sample" ? "SMP" : "RWK";
    const { count } = await supabaseAdmin
      .from("scan")
      .select("id", { count: "exact", head: true })
      .eq("worktype", worktype);

    const nextNum = (count || 0) + 1;
    const generatedProjectId = `${prefix}-${String(nextNum).padStart(4, "0")}`;

    const { data, error } = await supabaseAdmin
      .from("scan")
      .insert([
        {
          projectid: generatedProjectId,
          rdate: rdate || now.slice(0, 10),
          cdate: cdate || now.slice(0, 10),
          cname: Number(cname),
          description: description?.trim() || "",
          worktype: worktype || "Sample",
          scan_by: scan_by ? Number(scan_by) : null,
          qc_by: qc_by ? Number(qc_by) : null,
          modeldesign_by: modeldesign_by ? Number(modeldesign_by) : null,
          amount: Number(amount) || 0,
          status: "pending",
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
      { project: data, message: `${worktype} project created successfully` },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/sample - Update status, staff assignment, or details (Roles 0, 1, 2, 3)
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
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

    return NextResponse.json({ project: data, message: "Updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/sample - Remove project (Roles 0, 1, 2, 3)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
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

    return NextResponse.json({ success: true, message: "Deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
