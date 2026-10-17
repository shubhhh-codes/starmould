import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, getCachedScansLookup, getCachedUsers, invalidateCache } from "@/lib/cache";
import { calculateSubplateWeight } from "@/lib/weight-calculator";

// GET /api/subplate - fetch subplates with project and staff lookups (Roles 0, 1, 2, 3)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_subplate");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "1000");
    const projectid = searchParams.get("projectid");
    const search = searchParams.get("search")?.trim();
    const material = searchParams.get("material");
    const location = searchParams.get("location");

    let subplateQuery = supabaseAdmin
      .from("subplate")
      .select("id, platename, projectid, subprojectid, material, location, shape, width, height, length, weight, unit, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby, design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at, created_at, updated_at", { count: "exact" })
      .is("deleted_at", null)
      .order("id", { ascending: false });

    if (material && material !== "ALL") {
      subplateQuery = subplateQuery.eq("material", material);
    }
    if (location && location !== "ALL") {
      subplateQuery = subplateQuery.eq("location", location);
    }
    if (search) {
      subplateQuery = subplateQuery.or(`platename.ilike.%${search}%,subprojectid.ilike.%${search}%`);
    }

    if (projectid && projectid !== "ALL") {
      if (/^\d+$/.test(projectid)) {
        subplateQuery = subplateQuery.eq("projectid", projectid);
      } else {
        const { data: matchedScan } = await supabaseAdmin
          .from("scan")
          .select("id")
          .eq("projectid", projectid)
          .maybeSingle();
        if (matchedScan) {
          subplateQuery = subplateQuery.or(`projectid.eq.${matchedScan.id},subprojectid.ilike.${projectid}%`);
        } else {
          subplateQuery = subplateQuery.ilike("subprojectid", `${projectid}%`);
        }
      }
    }

    if (page && page > 0) {
      const start = (page - 1) * limit;
      subplateQuery = subplateQuery.range(start, start + limit - 1);
    } else {
      subplateQuery = subplateQuery.limit(limit);
    }

    const isDefaultQuery = !search && (!material || material === "ALL") && (!location || location === "ALL") && (!projectid || projectid === "ALL") && (!page || page === 1);
    const cacheKey = isDefaultQuery ? `subplate_default_${limit}` : null;

    const executeFetch = async () => {
      // Batch subplates query with cached scans, users, and KPI counts
      const [subplatesRes, scans, users, kpis] = await Promise.all([
        subplateQuery,
        getCachedScansLookup(),
        getCachedUsers(),
        getCached("subplate_kpi_counts", 30, async () => {
          const [totalActiveRes, inHouseRes, vendorRes] = await Promise.all([
            supabaseAdmin
              .from("subplate")
              .select("id", { count: "exact", head: true })
              .is("deleted_at", null),
            supabaseAdmin
              .from("subplate")
              .select("id", { count: "exact", head: true })
              .is("deleted_at", null)
              .or("location.eq.SM,location.is.null"),
            supabaseAdmin
              .from("subplate")
              .select("id", { count: "exact", head: true })
              .is("deleted_at", null)
              .neq("location", "SM")
              .not("location", "is", null),
          ]);
          return {
            totalCount: totalActiveRes.count || 0,
            inHouseCount: inHouseRes.count || 0,
            vendorCount: vendorRes.count || 0,
          };
        }),
      ]);

      if (subplatesRes.error) {
        throw new Error(subplatesRes.error.message);
      }

      const subplates = subplatesRes.data || [];
      const scanMap = new Map((scans || []).map((s: any) => [s.id, s]));
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));

      const enriched = subplates.map((sp: any) => {
        const scan = scanMap.get(sp.projectid);
        return {
          ...sp,
          mould_project_code: scan?.projectid || `Project #${sp.projectid}`,
          mould_description: scan?.description || "",
          design_by_name: userMap.get(Number(sp.design_by))?.name || userMap.get(Number(sp.design_by))?.initials || "—",
          order_by_name: userMap.get(Number(sp.order_by))?.name || userMap.get(Number(sp.order_by))?.initials || "—",
          received_workby_name: userMap.get(Number(sp.received_workby))?.name || userMap.get(Number(sp.received_workby))?.initials || "—",
          received_qcby_name: userMap.get(Number(sp.received_qcby))?.name || userMap.get(Number(sp.received_qcby))?.initials || "—",
          vmc_workby_name: userMap.get(Number(sp.vmc_workby))?.name || userMap.get(Number(sp.vmc_workby))?.initials || "—",
          vmc_qcby_name: userMap.get(Number(sp.vmc_qcby))?.name || userMap.get(Number(sp.vmc_qcby))?.initials || "—",
          drilltap_workby_name: userMap.get(Number(sp.drilltap_workby))?.name || userMap.get(Number(sp.drilltap_workby))?.initials || "—",
          final_qcby_name: userMap.get(Number(sp.final_qcby))?.name || userMap.get(Number(sp.final_qcby))?.initials || "—",
          packing_workby_name: userMap.get(Number(sp.packing_workby))?.name || userMap.get(Number(sp.packing_workby))?.initials || "—",
        };
      });

      const totalCount = subplatesRes.count ?? enriched.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const currentPage = page || 1;

      return {
        subplates: enriched,
        totalCount,
        totalPages,
        currentPage,
        limit,
        scans,
        users: (users || []).filter((u: any) => String(u.status) === "1" || u.status === 1),
        kpis,
      };
    };

    const result = cacheKey ? await getCached(cacheKey, 20, executeFetch) : await executeFetch();

    const response = NextResponse.json({
      subplates: result.subplates,
      data: result.subplates,
      pagination: {
        page: result.currentPage,
        pageSize: result.limit,
        total: result.totalCount,
        totalPages: result.totalPages,
        hasNextPage: result.currentPage < result.totalPages,
        hasPreviousPage: result.currentPage > 1,
      },
      scans: result.scans,
      users: result.users,
      kpis: result.kpis,
    });
    response.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=60");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/subplate - Create new subplate entry (Roles 0, 1, 2, 3)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_subplate");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      platename,
      projectid,
      subprojectid,
      shape,
      width,
      height,
      length,
      weight,
      unit,
      material,
      sqty,
      location,
      design_by,
      vmc_workby,
    } = body;

    // 1. Strict Plate Name Validation
    const cleanPlateName = typeof platename === "string" ? platename.trim() : "";
    if (!cleanPlateName || cleanPlateName.length < 1) {
      return NextResponse.json(
        { error: "Plate name is required and cannot be empty." },
        { status: 400 }
      );
    }

    // 2. Strict Project ID Validation & Existence Check
    const numProjectId = Number(projectid);
    if (!projectid || isNaN(numProjectId) || numProjectId <= 0) {
      return NextResponse.json(
        { error: "A valid positive Mould Project ID is required." },
        { status: 400 }
      );
    }

    const { data: scanProject, error: scanErr } = await supabaseAdmin
      .from("scans")
      .select("id, projectid")
      .eq("id", numProjectId)
      .is("deleted_at", null)
      .maybeSingle();

    if (scanErr || !scanProject) {
      return NextResponse.json(
        { error: `Associated Mould Project #${numProjectId} does not exist or has been deleted.` },
        { status: 400 }
      );
    }

    // 3. Strict Dimensions Validation
    const normShape = (shape || "Plate").trim();
    const normShapeLower = normShape.toLowerCase();
    const isRound = normShapeLower === "round" || normShapeLower === "round bar";
    const numLength = Number(length);
    const numWidth = Number(width);
    const numHeight = Number(height);
    const numQty = parseInt(String(sqty || 1), 10);

    if (isNaN(numLength) || numLength <= 0) {
      return NextResponse.json(
        { error: "Invalid length: Length must be a number greater than 0." },
        { status: 400 }
      );
    }

    if (isNaN(numWidth) || numWidth <= 0) {
      return NextResponse.json(
        {
          error: isRound
            ? "Invalid Outer Diameter: OD must be a number greater than 0."
            : "Invalid width: Width must be a number greater than 0.",
        },
        { status: 400 }
      );
    }

    if (!isRound && (isNaN(numHeight) || numHeight <= 0)) {
      return NextResponse.json(
        { error: "Invalid thickness/height: Height must be a number greater than 0 for plates." },
        { status: 400 }
      );
    }

    if (isNaN(numQty) || numQty < 1) {
      return NextResponse.json(
        { error: "Quantity must be an integer of 1 or greater." },
        { status: 400 }
      );
    }

    // 4. Ensure weight is accurately computed if missing or zero
    let finalWeight = Number(weight) || 0;
    if (finalWeight <= 0) {
      finalWeight = calculateSubplateWeight({
        shape: normShape,
        material: material || "MS-Bright",
        length: numLength,
        width: numWidth,
        height: isRound ? 0 : numHeight,
        unit: unit || "mm",
        quantity: numQty,
      });
    }

    // 5. Clean subprojectid
    let cleanSubprojectId = typeof subprojectid === "string" ? subprojectid.trim() : "";
    if (!cleanSubprojectId) {
      const { count } = await supabaseAdmin
        .from("subplate")
        .select("id", { count: "exact", head: true })
        .eq("projectid", numProjectId)
        .is("deleted_at", null);
      const nextIndex = (count || 0) + 1;
      const baseCode = scanProject.projectid || `PRJ${numProjectId}`;
      cleanSubprojectId = `${baseCode}_${String(nextIndex).padStart(3, "0")}`;
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("subplate")
      .insert([
        {
          platename: cleanPlateName,
          projectid: numProjectId,
          subprojectid: cleanSubprojectId,
          shape: normShape,
          width: numWidth,
          height: isRound ? null : numHeight,
          length: numLength,
          weight: finalWeight > 0 ? finalWeight : null,
          unit: unit || "mm",
          material: material || "MS-Bright",
          sqty: numQty,
          location: location || "SM",
          design_by: design_by ? Number(design_by) : null,
          vmc_workby: vmc_workby ? Number(vmc_workby) : null,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("subplate_default_");
    invalidateCache("scanning_default_");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_kpi_counts");
    invalidateCache("api_counts_all");

    return NextResponse.json(
      { subplate: data, message: "Subplate created successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT/PATCH /api/subplate - Update subplate (Roles 0, 1, 2, 3)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_subplate");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, updates } = body;

    const subplateId = Number(id);
    if (!id || isNaN(subplateId) || subplateId <= 0) {
      return NextResponse.json({ error: "Missing or invalid subplate id" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      ...(updates || body),
      updated_at: now,
    };
    delete updatePayload.id;
    delete updatePayload.updates;

    if (updatePayload.projectid !== undefined && updatePayload.projectid !== null) {
      updatePayload.projectid = String(updatePayload.projectid);
    }

    if (body.field && body.value !== undefined) {
      updatePayload[body.field] =
        body.value === 0 || body.value === "0" || body.value === "" || body.value === null
          ? null
          : body.value;
      delete updatePayload.field;
      delete updatePayload.value;
    }

    // Strict validation for updated fields
    if (updatePayload.platename !== undefined) {
      const cleanName = String(updatePayload.platename || "").trim();
      if (!cleanName) {
        return NextResponse.json({ error: "Plate name cannot be empty." }, { status: 400 });
      }
      updatePayload.platename = cleanName;
    }

    if (updatePayload.length !== undefined) {
      const l = Number(updatePayload.length);
      if (isNaN(l) || l <= 0) {
        return NextResponse.json({ error: "Length must be greater than 0." }, { status: 400 });
      }
      updatePayload.length = l;
    }

    if (updatePayload.width !== undefined) {
      const w = Number(updatePayload.width);
      if (isNaN(w) || w <= 0) {
        return NextResponse.json({ error: "Width/OD must be greater than 0." }, { status: 400 });
      }
      updatePayload.width = w;
    }

    if (updatePayload.height !== undefined && updatePayload.height !== null) {
      const h = Number(updatePayload.height);
      const isRound = String(updatePayload.shape || "").toLowerCase().includes("round");
      if (!isRound && (isNaN(h) || h <= 0)) {
        return NextResponse.json({ error: "Height/Thickness must be greater than 0." }, { status: 400 });
      }
      updatePayload.height = isRound ? null : h;
    }

    if (updatePayload.sqty !== undefined) {
      const q = parseInt(String(updatePayload.sqty), 10);
      if (isNaN(q) || q < 1) {
        return NextResponse.json({ error: "Quantity must be an integer of 1 or greater." }, { status: 400 });
      }
      updatePayload.sqty = q;
    }

    // Auto-calculate weight if length and width are updated and weight is zero/missing
    if (
      updatePayload.length !== undefined &&
      updatePayload.width !== undefined &&
      (!updatePayload.weight || Number(updatePayload.weight) <= 0)
    ) {
      const calc = calculateSubplateWeight({
        shape: updatePayload.shape || "Plate",
        material: updatePayload.material || "MS-Bright",
        length: updatePayload.length,
        width: updatePayload.width,
        height: updatePayload.height,
        unit: updatePayload.unit || "mm",
        quantity: updatePayload.sqty || 1,
      });
      if (calc > 0) {
        updatePayload.weight = calc;
      }
    }

    // Auto-set per-stage timestamp when the corresponding *_by assignment is set/changed
    const stageTimestampMap: Record<string, string> = {
      design_by: "design_at",
      order_by: "order_at",
      received_workby: "received_work_at",
      received_qcby: "received_qc_at",
      vmc_workby: "vmc_work_at",
      vmc_qcby: "vmc_qc_at",
      drilltap_workby: "drilltap_at",
      final_qcby: "final_qc_at",
      packing_workby: "packing_at",
    };

    // Enforce that non-admin users (e.g. Designers, Workers) can only assign tasks to themselves
    const isUserAdmin = auth.user.role_id === 0 || auth.user.role?.toLowerCase() === "admin";
    if (!isUserAdmin) {
      for (const byField of Object.keys(stageTimestampMap)) {
        if (byField in updatePayload) {
          const targetUserId = updatePayload[byField];
          if (targetUserId && Number(targetUserId) !== Number(auth.user.id)) {
            return NextResponse.json(
              { error: "Permission denied: Non-admin users can only assign tasks to themselves." },
              { status: 403 }
            );
          }
        }
      }
    }

    for (const [byField, atField] of Object.entries(stageTimestampMap)) {
      if (byField in updatePayload) {
        const val = updatePayload[byField];
        if (val && Number(val) > 0) {
          if (!updatePayload[atField]) {
            updatePayload[atField] = now;
          }
        } else if (val === null || val === 0 || val === "") {
          updatePayload[atField] = null;
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("subplate")
      .update(updatePayload)
      .eq("id", subplateId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("subplate_default_");
    invalidateCache("scanning_default_");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_kpi_counts");
    invalidateCache("api_counts_all");
    invalidateCache("shared_scans_lookup");

    return NextResponse.json({ subplate: data, message: "Subplate updated successfully in database" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = PUT;

// DELETE /api/subplate - Hard delete subplate from database (Roles 0, 1, 2, 3)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3], "nav_subplate");
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

    const subplateId = Number(id);
    if (!id || isNaN(subplateId) || subplateId <= 0) {
      return NextResponse.json({ error: "Missing or invalid subplate id" }, { status: 400 });
    }

    // Permanently hard delete the subplate directly from the database table
    const { error } = await supabaseAdmin
      .from("subplate")
      .delete()
      .eq("id", subplateId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("subplate_default_");
    invalidateCache("scanning_default_");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_kpi_counts");
    invalidateCache("api_counts_all");
    invalidateCache("shared_scans_lookup");

    return NextResponse.json({ success: true, message: "Subplate permanently deleted from database" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
