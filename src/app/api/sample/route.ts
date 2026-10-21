import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCachedCustomers, getCachedUsers, invalidateCache } from "@/lib/cache";

// GET /api/sample - Fetch Sample and Rework projects (Roles 0, 1, 2, 3)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_sample");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const worktype = searchParams.get("worktype"); // "Sample" | "Rework" | null (all)

    const query = supabaseAdmin
      .from("scan")
      .select("*")
      .in("worktype", worktype ? [worktype] : ["Sample", "Rework"])
      .order("id", { ascending: false });

    const [scanRes, customers, users] = await Promise.all([
      query,
      getCachedCustomers(),
      getCachedUsers(),
    ]);

    if (scanRes.error) {
      return NextResponse.json({ error: scanRes.error.message }, { status: 500 });
    }

    const scanRows = scanRes.data || [];

    const custMap = new Map<string | number, any>();
    for (const c of customers || []) {
      custMap.set(c.id, c);
      custMap.set(String(c.id), c);
      custMap.set(Number(c.id), c);
    }

    const userMap = new Map((users || []).map((u: any) => [Number(u.id), u]));

    // Fetch worklog hours aggregated per scan_print_id
    const scanIds = (scanRows || []).map((r) => r.id);
    const worklogMap: Record<number, { scan_hr: number; model_hr: number }> = {};

    if (scanIds.length > 0) {
      const { data: worklogs } = await supabaseAdmin
        .from("worklog")
        .select("scan_print_id, design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr")
        .in("scan_print_id", scanIds.slice(0, 1000));

      for (const w of worklogs || []) {
        if (!w.scan_print_id) continue;
        if (!worklogMap[w.scan_print_id]) {
          worklogMap[w.scan_print_id] = { scan_hr: 0, model_hr: 0 };
        }
        worklogMap[w.scan_print_id].scan_hr += Number(w.machine_hr || 0) + Number(w.driltap_hr || 0);
        worklogMap[w.scan_print_id].model_hr +=
          Number(w.design_hr || 0) +
          Number(w.program_hr || 0) +
          Number(w.qc_hr || 0);
      }
    }

    const enriched = (scanRows || []).map((row) => {
      const cust = custMap.get(row.cname) || custMap.get(Number(row.cname));
      const scanUser = userMap.get(Number(row.scan_by));
      const qcUser = userMap.get(Number(row.qc_by));
      const modelUser = userMap.get(Number(row.modeldesign_by));
      const hours = worklogMap[row.id] || { scan_hr: 0, model_hr: 0 };

      return {
        ...row,
        customername: cust?.customername || (isNaN(Number(row.cname)) ? row.cname : `Customer #${row.cname}`),
        customer_initials: cust?.initials || "",
        scan_by_name: scanUser?.name || scanUser?.initials || scanUser?.username || "—",
        qc_by_name: qcUser?.name || qcUser?.initials || qcUser?.username || "—",
        modeldesign_by_name: modelUser?.name || modelUser?.initials || modelUser?.username || "—",
        calc_scan_hr: hours.scan_hr || row.scan_hr || 0,
        calc_model_hr: hours.model_hr || row.model_hr || 0,
      };
    });

    // Counts for KPIs
    const samplePending = enriched.filter((r) => r.worktype === "Sample" && r.status === "pending").length;
    const sampleTotal = enriched.filter((r) => r.worktype === "Sample").length;
    const reworkPending = enriched.filter((r) => r.worktype === "Rework" && r.status === "pending").length;
    const reworkTotal = enriched.filter((r) => r.worktype === "Rework").length;

    const response = NextResponse.json({
      projects: enriched,
      customers: customers || [],
      users: (users || []).filter((u) => String(u.status) === "1" || u.status === 1),
      kpis: {
        samplePending,
        sampleTotal,
        reworkPending,
        reworkTotal,
      },
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sample - Create new Sample / Rework entry (Roles 0, 1, 2, 3)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_sample");
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

    const combinedSubnote = [
      subnote?.trim(),
      amount && Number(amount) > 0 ? `Billed Amount: ₹${amount}` : null
    ].filter(Boolean).join(" | ");

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
          status: "pending",
          note: note?.trim() || "",
          subnote: combinedSubnote,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("duplicate key")
      ) {
        return NextResponse.json(
          { error: `A project with code "${generatedProjectId}" already exists.` },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("shared_scans_lookup");
    invalidateCache("api_counts_all");

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
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_sample");
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
      updatePayload[field] =
        value === 0 || value === "0" || value === "" || value === null
          ? null
          : ["scan_by", "qc_by", "modeldesign_by"].includes(field)
          ? Number(value)
          : value;
    } else if (updates && typeof updates === "object") {
      Object.assign(updatePayload, updates);
    }
    delete updatePayload.amount;

    // Enforce that non-admin users can only assign tasks to themselves
    const isUserAdmin = auth.user.role_id === 0 || auth.user.role?.toLowerCase() === "admin";
    if (!isUserAdmin) {
      const staffFields = ["scan_by", "qc_by", "modeldesign_by"];
      for (const sf of staffFields) {
        if (sf in updatePayload) {
          const targetVal = updatePayload[sf];
          if (targetVal && Number(targetVal) !== Number(auth.user.id)) {
            return NextResponse.json(
              { error: "Permission denied: Non-admin users can only assign tasks to themselves." },
              { status: 403 }
            );
          }
        }
      }
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

    invalidateCache("shared_scans_lookup");
    invalidateCache("api_counts_all");

    return NextResponse.json({ project: data, message: "Updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/sample - Soft-delete project (Roles 0, 1, 2, 3)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_sample");
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

    // Soft delete by setting status = 'completed'
    const { error } = await supabaseAdmin
      .from("scan")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("shared_scans_lookup");
    invalidateCache("api_counts_all");

    return NextResponse.json({ success: true, message: "Project marked as completed successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
