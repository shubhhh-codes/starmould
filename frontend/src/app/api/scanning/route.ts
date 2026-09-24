import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, getCachedCustomers, getCachedUsers } from "@/lib/cache";

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

    let scanQuery = supabaseAdmin
      .from("scan")
      .select("id, projectid, description, worktype, cname, status, scan_by, qc_by, modeldesign_by, rdate, cdate, scan_hr, model_hr, amount, payment, note, subnote, created_at, updated_at")
      .or("worktype.is.null,worktype.not.in.(Sample,Rework)")
      .order("id", { ascending: false })
      .limit(limit);

    if (status && status !== "ALL") {
      scanQuery = scanQuery.eq("status", status);
    }

    // Step 1: Batch fetch scans, cached customers, cached users, and cached KPIs
    const [scansRes, customers, users, kpis] = await Promise.all([
      scanQuery,
      getCachedCustomers(),
      getCachedUsers(),
      getCached("scanning_kpi_metrics", 20, async () => {
        const [
          totalScansRes,
          pendingScansRes,
          missingScannerRes,
          missingQCRes,
          missingDesignerRes,
          allAmountsRes,
        ] = await Promise.all([
          supabaseAdmin.from("scan").select("id", { count: "exact", head: true }),
          supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending"),
          supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending").or("scan_by.eq.0,scan_by.is.null"),
          supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending").or("qc_by.eq.0,qc_by.is.null"),
          supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending").or("modeldesign_by.eq.0,modeldesign_by.is.null"),
          supabaseAdmin.from("scan").select("amount"),
        ]);
        const totalRevenue = (allAmountsRes.data || []).reduce(
          (sum: number, row: any) => sum + Number(row.amount || 0),
          0
        );
        return {
          totalScans: totalScansRes.count || 0,
          pendingScans: pendingScansRes.count || 0,
          missingScanner: missingScannerRes.count || 0,
          missingQC: missingQCRes.count || 0,
          missingDesigner: missingDesignerRes.count || 0,
          totalRevenue,
        };
      }),
    ]);

    if (scansRes.error) {
      return NextResponse.json({ error: scansRes.error.message }, { status: 500 });
    }

    const scans = scansRes.data || [];
    const custMap = new Map((customers || []).map((c: any) => [c.id, c]));
    const userMap = new Map((users || []).map((u: any) => [Number(u.id), u]));

    // Step 2: Batch fetch child subplates and worklogs for current scans concurrently
    const scanIds = scans.map((s: any) => s.id);

    const [subplatesRes, worklogsRes] = await Promise.all([
      scanIds.length > 0
        ? supabaseAdmin
            .from("subplate")
            .select("id, platename, projectid, subprojectid, material, location, sqty")
            .in("projectid", scanIds.slice(0, 300))
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
      scanIds.length > 0
        ? supabaseAdmin
            .from("worklog")
            .select("scan_print_id, scan_hr, model_hr, rework_hr, qc_hr, insp_hr")
            .in("scan_print_id", scanIds.slice(0, 300))
        : Promise.resolve({ data: [] }),
    ]);

    let subplateMap: Record<number, any[]> = {};
    for (const sp of subplatesRes.data || []) {
      if (!subplateMap[sp.projectid]) subplateMap[sp.projectid] = [];
      subplateMap[sp.projectid].push(sp);
    }

    let worklogMap: Record<number, { scan_hr: number; model_hr: number }> = {};
    for (const w of worklogsRes.data || []) {
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

    const enriched = scans.map((s: any) => {
      const cust = custMap.get(s.cname);
      const scanUser = userMap.get(Number(s.scan_by));
      const qcUser = userMap.get(Number(s.qc_by));
      const modelUser = userMap.get(Number(s.modeldesign_by));
      const sublist = subplateMap[s.id] || [];
      const hours = worklogMap[s.id] || { scan_hr: 0, model_hr: 0 };

      return {
        ...s,
        customername: cust?.customername || `Customer #${s.cname}`,
        customer_initials: cust?.initials || "",
        scan_by_name: scanUser?.initials || scanUser?.name || "—",
        qc_by_name: qcUser?.initials || qcUser?.name || "—",
        modeldesign_by_name: modelUser?.initials || modelUser?.name || "—",
        subplates: sublist,
        subplate_count: sublist.length,
        calc_scan_hr: hours.scan_hr || s.scan_hr || 0,
        calc_model_hr: hours.model_hr || s.model_hr || 0,
      };
    });

    const response = NextResponse.json({
      scans: enriched,
      customers: customers || [],
      users: (users || []).filter((u: any) => String(u.status) === "1" || u.status === 1),
      kpis,
    });
    response.headers.set("Cache-Control", "private, max-age=5, stale-while-revalidate=20");
    return response;
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

    // Auto-generate project code matching PHP: {maxId+1 padded 4}_{customerInitials}_{customerProjectCount+1 padded 3}
    const [{ count: custProjectsCount }, { data: maxRows }] = await Promise.all([
      supabaseAdmin
        .from("scan")
        .select("id", { count: "exact", head: true })
        .eq("cname", Number(cname)),
      supabaseAdmin
        .from("scan")
        .select("id")
        .order("id", { ascending: false })
        .limit(1),
    ]);

    const nextId = (maxRows?.[0]?.id || 0) + 1;
    const cidStr = String(nextId).padStart(4, "0");
    const custCountStr = String((custProjectsCount || 0) + 1).padStart(3, "0");
    const projectid = `${cidStr}_${initials}_${custCountStr}`;

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
      if (["status", "subnote", "note", "description"].includes(field)) {
        updatePayload[field] = value === "" || value === null ? null : String(value);
      } else {
        updatePayload[field] =
          value === 0 || value === "0" || value === "" || value === null
            ? null
            : Number(value);
      }
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

// DELETE /api/scanning - Soft-delete scan project (matches PHP status = 'completed')
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

    // Matches PHP ScanningController / ScanAdminController: soft delete by marking status = 'completed'
    const { error } = await supabaseAdmin
      .from("scan")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Project marked as completed successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
