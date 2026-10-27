export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, getCachedCustomers, getCachedUsers, invalidateCache } from "@/lib/cache";

// GET /api/scanning - Fetch scan projects, linked subplates, worklog hours, and KPIs
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, undefined, "nav_scanning");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");

    // =========================================================================
    // DELTA / INCREMENTAL SYNC HANDLER
    // If `since` is supplied, only fetch records updated/created after `since`.
    // Old records are strictly rendered from client cache without DB re-queries!
    // =========================================================================
    if (since) {
      // 1. Find all scan projects created or updated since `since`
      // 2. Also find scan projects whose subplates were updated since `since`
      // 3. Query all active scan IDs to enable 100% accurate deletion & truncate synchronization!
      const [updatedScansRes, updatedSubplatesRes, allScansCountRes] = await Promise.all([
        supabaseAdmin
          .from("scan")
          .select("id, projectid, description, worktype, customer_id, cname, status, scan_by, qc_by, modeldesign_by, rdate, cdate, scan_hr, model_hr, note, subnote, created_at, updated_at")
          .or(`updated_at.gt.${since},created_at.gt.${since}`)
          .order("id", { ascending: false })
          .limit(10000),
        supabaseAdmin
          .from("subplate")
          .select("mold_id, projectid")
          .or(`updated_at.gt.${since},created_at.gt.${since}`)
          .is("deleted_at", null)
          .limit(10000),
        supabaseAdmin
          .from("scan")
          .select("id", { count: "exact" })
          .order("id", { ascending: false })
          .range(0, 999),
      ]);

      // Bug #4 Fix: Evaluated AFTER query execution to prevent crack-in-time race conditions
      const serverTime = new Date().toISOString();

      const totalCount = allScansCountRes.count ?? 0;
      const activeIdSet = new Set<number>((allScansCountRes.data || []).map((r: any) => r.id));

      // PostgREST server clamps single queries to max-rows (1,000).
      // If totalCount > 1000, fetch remaining ID batches concurrently with stable ordering so activeIds is never truncated!
      if (totalCount > activeIdSet.size) {
        const numBatches = Math.ceil(totalCount / 1000);
        const batchPromises = [];
        for (let b = 1; b < numBatches; b++) {
          batchPromises.push(
            supabaseAdmin
              .from("scan")
              .select("id")
              .order("id", { ascending: false })
              .range(b * 1000, (b + 1) * 1000 - 1)
          );
        }
        const batchResults = await Promise.all(batchPromises);
        for (const bRes of batchResults) {
          if (bRes.data) {
            for (const r of bRes.data) {
              activeIdSet.add(r.id);
            }
          }
        }
      }
      const allActiveIds: number[] = Array.from(activeIdSet);

      // If database is completely empty (e.g. TRUNCATE), signal immediate purge
      if (totalCount === 0) {
        return NextResponse.json({
          status: "ok",
          isDelta: true,
          isTruncated: true,
          totalCount: 0,
          activeIds: [],
          deltaCount: 0,
          scans: [],
          serverTime,
        });
      }

      const scanIdSet = new Set<number>();
      for (const s of updatedScansRes.data || []) {
        scanIdSet.add(s.id);
      }
      for (const sp of updatedSubplatesRes.data || []) {
        const id = sp.mold_id || (Number(sp.projectid) || null);
        if (id) scanIdSet.add(id);
      }

      // If nothing has changed, return empty delta with active IDs for deletion sync
      if (scanIdSet.size === 0) {
        const deltaRes = NextResponse.json({
          status: "ok",
          isDelta: true,
          isTruncated: false,
          totalCount,
          activeIds: allActiveIds,
          deltaCount: 0,
          scans: [],
          serverTime,
        });
        deltaRes.headers.set("Cache-Control", "private, no-store, must-revalidate");
        return deltaRes;
      }

      // Fetch details only for the modified scans
      const deltaIds = Array.from(scanIdSet);
      let deltaScans = updatedScansRes.data || [];
      const missingIds = deltaIds.filter((id) => !deltaScans.some((s) => s.id === id));
      if (missingIds.length > 0) {
        const { data: missingScans } = await supabaseAdmin
          .from("scan")
          .select("id, projectid, description, worktype, customer_id, cname, status, scan_by, qc_by, modeldesign_by, rdate, cdate, scan_hr, model_hr, note, subnote, created_at, updated_at")
          .in("id", missingIds);
        if (missingScans) {
          deltaScans = [...deltaScans, ...missingScans];
        }
      }

      // Enrich only the delta scans
      const [customers, users, subplatesRes, worklogsRes] = await Promise.all([
        getCachedCustomers(),
        getCachedUsers(),
        supabaseAdmin
          .from("subplate")
          .select("id, platename, projectid, subprojectid, mold_id, mold_code, plate_category, material, location, shape, width, height, length, weight, unit, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby, design_at, packing_at")
          .or(`mold_id.in.(${deltaIds.join(",")}),projectid.in.(${deltaIds.join(",")})`)
          .order("id", { ascending: true })
          .is("deleted_at", null),
        supabaseAdmin
          .from("worklog")
          .select("scan_print_id, design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr")
          .in("scan_print_id", deltaIds),
      ]);

      const custMap = new Map();
      for (const c of customers || []) {
        custMap.set(c.id, c);
        custMap.set(String(c.id), c);
        custMap.set(Number(c.id), c);
      }
      const userMap = new Map();
      for (const u of users || []) {
        userMap.set(u.id, u);
        userMap.set(Number(u.id), u);
        userMap.set(String(u.id), u);
      }

      const subplateMap: Record<number, any[]> = {};
      for (const sp of subplatesRes.data || []) {
        const key = sp.mold_id || (Number(sp.projectid) || null);
        if (!key) continue;
        if (!subplateMap[key]) subplateMap[key] = [];
        subplateMap[key].push(sp);
      }

      const worklogMap: Record<number, { scan_hr: number; model_hr: number }> = {};
      for (const w of worklogsRes.data || []) {
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

      const enrichedDelta = deltaScans.map((s: any) => {
        const cust = custMap.get(s.customer_id) || custMap.get(s.cname) || custMap.get(Number(s.cname));
        const scanUser = userMap.get(Number(s.scan_by)) || userMap.get(s.scan_by);
        const qcUser = userMap.get(Number(s.qc_by)) || userMap.get(s.qc_by);
        const modelUser = userMap.get(Number(s.modeldesign_by)) || userMap.get(s.modeldesign_by);
        const sublist = subplateMap[s.id] || [];
        const hours = worklogMap[s.id] || { scan_hr: 0, model_hr: 0 };
        const completedCount = sublist.filter((sp: any) => sp.packing_workby && Number(sp.packing_workby) > 0).length;
        const totalPlates = sublist.length;
        const completionPct = totalPlates > 0 ? Math.round((completedCount / totalPlates) * 100) : 0;

        return {
          ...s,
          customername: cust?.customername || ((!s.cname || String(s.cname).trim() === "") ? "Unknown Customer" : isNaN(Number(s.cname)) ? s.cname : `Customer #${s.cname}`),
          customer_initials: cust?.initials || "",
          scan_by_name: scanUser?.initials || scanUser?.name || "—",
          qc_by_name: qcUser?.initials || qcUser?.name || "—",
          modeldesign_by_name: modelUser?.initials || modelUser?.name || "—",
          subplates: sublist,
          subplate_count: totalPlates,
          total_plates: totalPlates,
          completed_plates: completedCount,
          completion_percentage: completionPct,
          is_ready_for_dispatch: totalPlates > 0 && completedCount === totalPlates,
          calc_scan_hr: hours.scan_hr || s.scan_hr || 0,
          calc_model_hr: hours.model_hr || s.model_hr || 0,
        };
      });

      const deltaRes = NextResponse.json({
        status: "ok",
        isDelta: true,
        isTruncated: false,
        totalCount,
        activeIds: allActiveIds,
        deltaCount: enrichedDelta.length,
        scans: enrichedDelta,
        serverTime,
      });
      deltaRes.headers.set("Cache-Control", "private, no-store, must-revalidate");
      return deltaRes;
    }

    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "100");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const customer = searchParams.get("customer");
    const worktype = searchParams.get("worktype");

    let scanQuery = supabaseAdmin
      .from("scan")
      .select("id, projectid, description, worktype, customer_id, cname, status, scan_by, qc_by, modeldesign_by, rdate, cdate, scan_hr, model_hr, note, subnote, created_at, updated_at", { count: "exact" })
      .order("id", { ascending: false });

    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").map(Number).filter((id) => !isNaN(id) && id > 0);
      if (ids.length > 0) {
        scanQuery = scanQuery.in("id", ids);
      }
    }

    if (status && status !== "ALL") {
      scanQuery = scanQuery.eq("status", status);
    }
    if (worktype && worktype !== "ALL") {
      scanQuery = scanQuery.eq("worktype", worktype);
    }
    if (customer && customer !== "ALL" && customer.trim()) {
      const numericId = parseInt(customer, 10);
      if (!isNaN(numericId) && numericId > 0 && String(numericId) === customer.trim()) {
        scanQuery = scanQuery.or(`customer_id.eq.${numericId},cname.eq.${numericId}`);
      } else {
        scanQuery = scanQuery.eq("cname", customer.trim().slice(0, 200));
      }
    }
    if (search) {
      const safeSearch = search.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim().slice(0, 100);
      if (safeSearch) {
        scanQuery = scanQuery.or(`projectid.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      }
    }

    const offsetParam = searchParams.get("offset");
    const offset = offsetParam !== null && !isNaN(Number(offsetParam)) ? Math.max(0, Number(offsetParam)) : null;

    if (offset !== null) {
      scanQuery = scanQuery.range(offset, offset + limit - 1);
    } else if (page && page > 0) {
      const start = (page - 1) * limit;
      scanQuery = scanQuery.range(start, start + limit - 1);
    } else {
      scanQuery = scanQuery.limit(limit);
    }

    const isDefaultQuery = !search && (!status || status === "ALL") && (!worktype || worktype === "ALL") && (!customer || customer === "ALL");
    const cacheKey = isDefaultQuery ? `scanning_default_${limit}_p${page || 1}` : null;

    const executeFetch = async () => {
      // Step 1: Batch fetch scans, cached customers, cached users, and cached KPIs
      const [scansRes, customers, users, kpis] = await Promise.all([
        scanQuery,
        getCachedCustomers(),
        getCachedUsers(),
        getCached("scanning_kpi_metrics_v2", 300, async () => {
          const [
            totalScansRes,
            pendingScansRes,
            missingScannerRes,
            missingQCRes,
            missingDesignerRes,
          ] = await Promise.all([
            supabaseAdmin.from("scan").select("id", { count: "exact", head: true }),
            supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending"),
            supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending").or("scan_by.eq.0,scan_by.is.null"),
            supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending").or("qc_by.eq.0,qc_by.is.null"),
            supabaseAdmin.from("scan").select("id", { count: "exact", head: true }).eq("status", "pending").or("modeldesign_by.eq.0,modeldesign_by.is.null"),
          ]);
          return {
            totalScans: totalScansRes.count || 0,
            pendingScans: pendingScansRes.count || 0,
            missingScanner: missingScannerRes.count || 0,
            missingQC: missingQCRes.count || 0,
            missingDesigner: missingDesignerRes.count || 0,
            totalRevenue: 0,
          };
        }),
      ]);

      if (scansRes.error) {
        throw new Error(scansRes.error.message);
      }

      const scans = scansRes.data || [];
      const custMap = new Map<string | number, any>();
      for (const c of customers || []) {
        custMap.set(c.id, c);
        custMap.set(String(c.id), c);
        custMap.set(Number(c.id), c);
      }
      const userMap = new Map<string | number, any>();
      for (const u of users || []) {
        userMap.set(u.id, u);
        userMap.set(Number(u.id), u);
        userMap.set(String(u.id), u);
      }

      // Step 2: Batch fetch child subplates and worklogs for current scans concurrently
      const scanIds = scans.map((s: any) => s.id);

      const [subplatesRes, worklogsRes] = await Promise.all([
        scanIds.length > 0
          ? supabaseAdmin
              .from("subplate")
              .select("id, platename, projectid, subprojectid, mold_id, mold_code, plate_category, material, location, shape, width, height, length, weight, unit, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby, design_at, packing_at")
              .or(`mold_id.in.(${scanIds.join(",")}),projectid.in.(${scanIds.join(",")})`)
              .order("id", { ascending: true })
              .is("deleted_at", null)
          : Promise.resolve({ data: [] }),
        scanIds.length > 0
          ? supabaseAdmin
              .from("worklog")
              .select("scan_print_id, design_hr, program_hr, machine_hr, driltap_hr, qc_hr, work_hr")
              .in("scan_print_id", scanIds)
              .limit(10000)
          : Promise.resolve({ data: [] }),
      ]);

      const subplateMap: Record<number, any[]> = {};
      for (const sp of subplatesRes.data || []) {
        const key = sp.mold_id || (Number(sp.projectid) || null);
        if (!key) continue;
        if (!subplateMap[key]) subplateMap[key] = [];
        subplateMap[key].push(sp);

      }

      const worklogMap: Record<number, { scan_hr: number; model_hr: number }> = {};
      for (const w of worklogsRes.data || []) {
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

      const enriched = scans.map((s: any) => {
        const cust = custMap.get(s.customer_id) || custMap.get(s.cname) || custMap.get(Number(s.cname));
        const scanUser = userMap.get(Number(s.scan_by)) || userMap.get(s.scan_by);
        const qcUser = userMap.get(Number(s.qc_by)) || userMap.get(s.qc_by);
        const modelUser = userMap.get(Number(s.modeldesign_by)) || userMap.get(s.modeldesign_by);
        const sublist = subplateMap[s.id] || [];
        const hours = worklogMap[s.id] || { scan_hr: 0, model_hr: 0 };
        const completedCount = sublist.filter((sp: any) => sp.packing_workby && Number(sp.packing_workby) > 0).length;
        const totalPlates = sublist.length;
        const completionPct = totalPlates > 0 ? Math.round((completedCount / totalPlates) * 100) : 0;

        return {
          ...s,
          customername: cust?.customername || ((!s.cname || String(s.cname).trim() === "") ? "Unknown Customer" : isNaN(Number(s.cname)) ? s.cname : `Customer #${s.cname}`),
          customer_initials: cust?.initials || "",
          scan_by_name: scanUser?.initials || scanUser?.name || "—",
          qc_by_name: qcUser?.initials || qcUser?.name || "—",
          modeldesign_by_name: modelUser?.initials || modelUser?.name || "—",
          subplates: sublist,
          subplate_count: totalPlates,
          total_plates: totalPlates,
          completed_plates: completedCount,
          completion_percentage: completionPct,
          is_ready_for_dispatch: totalPlates > 0 && completedCount === totalPlates,
          calc_scan_hr: hours.scan_hr || s.scan_hr || 0,
          calc_model_hr: hours.model_hr || s.model_hr || 0,
        };
      });

      const totalCount = scansRes.count ?? enriched.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const currentPage = page || 1;

      return {
        scans: enriched,
        totalCount,
        totalPages,
        currentPage,
        limit,
        customers: customers || [],
        users: (users || []).filter((u: any) => String(u.status) === "1" || u.status === 1),
        kpis,
      };
    };

    const result = cacheKey ? await getCached(cacheKey, 30, executeFetch) : await executeFetch();

    const response = NextResponse.json({
      scans: result.scans,
      data: result.scans,
      pagination: {
        page: result.currentPage,
        pageSize: result.limit,
        total: result.totalCount,
        totalPages: result.totalPages,
        hasNextPage: result.currentPage < result.totalPages,
        hasPreviousPage: result.currentPage > 1,
      },
      customers: result.customers,
      users: result.users,
      kpis: result.kpis,
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/scanning - Create new Scanning project (matches ScanningController.php store)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "action_create_scanning_project");
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

    if (!cname || !description) {
      return NextResponse.json(
        { error: "Customer and Description are required" },
        { status: 400 }
      );
    }

    const VALID_WORKTYPES = [
      "Pulp Mould",
      "TF",
      "Rework",
      "Accessories",
      "Machine part",
      "Other",
    ];
    const finalWorktype =
      worktype && typeof worktype === "string" && worktype.trim()
        ? worktype.trim()
        : "Pulp Mould";

    const now = new Date().toISOString();

    // Atomic creation via PostgreSQL RPC with pg_advisory_xact_lock
    const { data: createdProject, error: rpcError } = await supabaseAdmin.rpc(
      "create_project_with_code",
      {
        p_cname: String(cname),
        p_description: description.trim(),
        p_worktype: finalWorktype,
        p_rdate: rdate || now.slice(0, 10),
        p_cdate: cdate || now.slice(0, 10),
        p_dispatchdate: cdate || now.slice(0, 10),
        p_note: note?.trim() || "",
        p_subnote: subnote?.trim() || "",
        p_created_by: auth.user?.id ? Number(auth.user.id) : null,
      }
    );

    if (rpcError) {
      if (
        rpcError.code === "23505" ||
        rpcError.message?.includes("unique constraint") ||
        rpcError.message?.includes("duplicate key")
      ) {
        return NextResponse.json(
          { error: "A mould project with this Project ID already exists." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    invalidateCache("scanning_default_");
    invalidateCache("subplate_default_");
    invalidateCache("shared_scans_lookup");
    invalidateCache("scanning_kpi_metrics_v2");
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");

    return NextResponse.json(
      {
        scan: createdProject,
        data: createdProject,
        project: createdProject,
        message: "Scanning project created successfully",
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/scanning - Update status, staff assignment, payment toggle, or metadata
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req, undefined, "action_edit_mould");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, field, value, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    // Commercial protection: only Admin and Manager can alter pricing and payment
    if (
      (field === "amount" || field === "payment" || (updates && ("amount" in updates || "payment" in updates))) &&
      auth.user.role_id > 1
    ) {
      return NextResponse.json(
        { error: "Access denied: only Admin and Manager can alter pricing or payment status" },
        { status: 403 }
      );
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (field && value !== undefined) {
      if (["status", "subnote", "note", "description", "cname"].includes(field)) {
        updatePayload[field] = value === "" || value === null ? null : String(value);
      } else if (field === "customer_id") {
        updatePayload[field] = value ? Number(value) : null;
      } else {
        updatePayload[field] =
          value === 0 || value === "0" || value === "" || value === null
            ? null
            : Number(value);
      }
    } else if (updates && typeof updates === "object") {
      Object.assign(updatePayload, updates);
    }

    // Enforce that non-admin users (e.g. Designers, Workers) can only assign tasks to themselves
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

    // Strip legacy dropped columns if passed
    delete updatePayload.amount;
    delete updatePayload.payment;
    delete updatePayload.scan_by_name;
    delete updatePayload.qc_by_name;
    delete updatePayload.modeldesign_by_name;
    delete updatePayload.customername;
    delete updatePayload.customer_name;
    delete updatePayload.subplates;

    const { data, error } = await supabaseAdmin
      .from("scan")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("duplicate key")
      ) {
        return NextResponse.json(
          { error: "A mould project with this Project ID already exists." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("scanning_default_");
    invalidateCache("subplate_default_");
    invalidateCache("shared_scans_lookup");
    invalidateCache("scanning_kpi_metrics_v2");
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");

    return NextResponse.json({ scan: data, message: "Updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/scanning - Delete scan project with subplate dependency protection
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, undefined, "action_delete_mould");
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

    // 1. Fetch project to ensure it exists and get details
    const { data: project, error: fetchErr } = await supabaseAdmin
      .from("scan")
      .select("id, projectid, cname")
      .eq("id", id)
      .single();

    if (fetchErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 2. Cascade Delete: Find all child subplates linked to this mould project
    const subplateOrFilters = [`mold_id.eq.${id}`, `projectid.eq.${id}`];
    if (project.projectid) {
      subplateOrFilters.push(`projectid.eq.${project.projectid}`);
      subplateOrFilters.push(`mold_code.eq.${project.projectid}`);
    }

    const { data: childSubplates } = await supabaseAdmin
      .from("subplate")
      .select("id")
      .or(subplateOrFilters.join(","));

    const subplateIds = (childSubplates || []).map((sp) => sp.id);

    // 3. Cascade Delete: Remove associated operator worklogs
    const worklogOrFilters = [`scan_print_id.eq.${id}`];
    if (project.projectid) {
      worklogOrFilters.push(`projectid.eq.${project.projectid}`);
    }
    if (subplateIds.length > 0) {
      worklogOrFilters.push(`subplateid.in.(${subplateIds.join(",")})`);
    }

    await supabaseAdmin
      .from("worklog")
      .delete()
      .or(worklogOrFilters.join(","));

    // 4. Cascade Delete: Remove child subplates
    if (subplateIds.length > 0) {
      await supabaseAdmin
        .from("subplate")
        .delete()
        .or(subplateOrFilters.join(","));
    }

    // 5. Delete mould project row from scan table
    const { error: deleteErr } = await supabaseAdmin
      .from("scan")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 6. Invalidate server-side caches
    invalidateCache("scanning_default_");
    invalidateCache("subplate_default_");
    invalidateCache("shared_scans_lookup");
    invalidateCache("scanning_kpi_metrics_v2");
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_kpi_counts");

    return NextResponse.json({
      success: true,
      message: `Project ${project.projectid || id} and ${subplateIds.length} subplates deleted successfully`,
      deletedSubplatesCount: subplateIds.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

