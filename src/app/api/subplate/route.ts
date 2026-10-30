import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, getCachedUsers, invalidateCache } from "@/lib/cache";
import { calculateSubplateWeight } from "@/lib/weight-calculator";

function inferPlateCategory(platename: string): string {
  const p = platename.toLowerCase();
  if (/(core|cavity|kvt|insert|injetor|injector|forming|punch|parting|plug|cutting|blade|trimming)/i.test(p)) {
    return "Core & Cavity Inserts";
  }
  if (/(top|bottom|bottam|clamp|base|hotpress|press|spacer|bolster|support|mount|heater)/i.test(p)) {
    return "Base & Clamping Plates";
  }
  if (/(eject|ejection|pusher|return|knockout)/i.test(p)) {
    return "Ejection System";
  }
  if (/(slide|lifter|wedge|heel|cam)/i.test(p)) {
    return "Slides & Lifters";
  }
  if (/(guide|pillar|bush|dowel|interlock|wear|locating|lock|shaft|saft|kayda)/i.test(p)) {
    return "Guiding & Alignment";
  }
  return "General Component";
}


// GET /api/subplate - fetch subplates with project and staff lookups (Roles 0, 1, 2, 3)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3, 6, 7, 9, 10], "nav_subplate");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const projectid = searchParams.get("projectid");

    // 1. ULTRA-FAST ON-DEMAND PATH: When querying for a specific project's subplates (accordion / modal)
    // Runs a lean index scan without heavy COUNT(*) table scans or unnecessary metadata overhead (<50ms).
    if (projectid && projectid !== "ALL") {
      const safeProjectId = projectid.replace(/[(),%]/g, "").trim();
      let leanQuery = supabaseAdmin
        .from("subplate")
        .select("id, platename, projectid, subprojectid, mold_id, mold_code, plate_category, material, location, shape, width, height, length, weight, unit, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby, design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at, created_at, updated_at")
        .is("deleted_at", null)
        .order("id", { ascending: true });

      if (/^\d+$/.test(safeProjectId)) {
        leanQuery = leanQuery.or(`mold_id.eq.${safeProjectId},projectid.eq.${safeProjectId}`);
      } else {
        leanQuery = leanQuery.or(`mold_code.eq.${safeProjectId},subprojectid.ilike.${safeProjectId}%`);
      }

      const { data: plates, error: pError } = await leanQuery;
      if (pError) {
        return NextResponse.json({ error: pError.message }, { status: 500 });
      }

      const plateList = plates || [];
      const plateIds = plateList.map((p) => p.id);
      const orderedMap: Record<number, number> = {};
      const platePOsMap = new Map<number, Array<{
        po_id: number;
        po_srno: string;
        qty: number;
        created_by?: string | null;
        created_at?: string | null;
      }>>();

      if (plateIds.length > 0) {
        const { data: orderedRows } = await supabaseAdmin
          .from("purchase_items")
          .select("plateid, qty, purchase:pid!inner(id, srno, status, created_by, created_at)")
          .in("plateid", plateIds)
          .neq("purchase.status", "0");

        if (orderedRows) {
          orderedRows.forEach((row: any) => {
            const pid = Number(row.plateid);
            const q = Number(row.qty) || 0;
            orderedMap[pid] = (orderedMap[pid] || 0) + q;
            const poData = Array.isArray(row.purchase) ? row.purchase[0] : row.purchase;
            if (poData) {
              const existingList = platePOsMap.get(pid) || [];
              existingList.push({
                po_id: poData.id,
                po_srno: poData.srno || "",
                qty: q,
                created_by: poData.created_by || null,
                created_at: poData.created_at || null,
              });
              platePOsMap.set(pid, existingList);
            }
          });
        }
      }

      const dbUsers = await getCachedUsers();
      const userMap = new Map((dbUsers || []).map((u: any) => [u.id, u]));

      const enrichedPlates = plateList.map((p) => {
        const ordered = orderedMap[p.id] || 0;
        const total = Number(p.sqty) || 1;
        const remaining = Math.max(0, total - ordered);
        const linkedPOs = platePOsMap.get(p.id) || [];
        const hasPO = linkedPOs.length > 0;
        const latestPO = linkedPOs[linkedPOs.length - 1] || null;
        const poStatus: 'UNORDERED' | 'PARTIAL' | 'FULLY_ORDERED' =
          ordered >= total ? 'FULLY_ORDERED' : ordered > 0 ? 'PARTIAL' : 'UNORDERED';

        return {
          ...p,
          ordered_qty: ordered,
          remaining_qty: remaining,
          has_active_po: hasPO,
          po_srno: latestPO?.po_srno || null,
          po_id: latestPO?.po_id || null,
          po_status: poStatus,
          linked_pos: linkedPOs,
          design_by_name: userMap.get(Number(p.design_by))?.name || userMap.get(Number(p.design_by))?.initials || null,
          order_by_name: userMap.get(Number(p.order_by))?.name || userMap.get(Number(p.order_by))?.initials || null,
          received_workby_name: userMap.get(Number(p.received_workby))?.name || userMap.get(Number(p.received_workby))?.initials || null,
          received_qcby_name: userMap.get(Number(p.received_qcby))?.name || userMap.get(Number(p.received_qcby))?.initials || null,
          vmc_workby_name: userMap.get(Number(p.vmc_workby))?.name || userMap.get(Number(p.vmc_workby))?.initials || null,
          vmc_qcby_name: userMap.get(Number(p.vmc_qcby))?.name || userMap.get(Number(p.vmc_qcby))?.initials || null,
          drilltap_workby_name: userMap.get(Number(p.drilltap_workby))?.name || userMap.get(Number(p.drilltap_workby))?.initials || null,
          final_qcby_name: userMap.get(Number(p.final_qcby))?.name || userMap.get(Number(p.final_qcby))?.initials || null,
          packing_workby_name: userMap.get(Number(p.packing_workby))?.name || userMap.get(Number(p.packing_workby))?.initials || null,
        };
      });

      const leanRes = NextResponse.json({ subplates: enrichedPlates });
      leanRes.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      return leanRes;
    }

    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "1000");
    const search = searchParams.get("search")?.trim();
    const material = searchParams.get("material");
    const location = searchParams.get("location");
    const category = searchParams.get("category");

    let subplateQuery = supabaseAdmin
      .from("subplate")
      .select("id, platename, projectid, subprojectid, mold_id, mold_code, plate_category, material, location, shape, width, height, length, weight, unit, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby, design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at, created_at, updated_at", { count: "exact" })
      .is("deleted_at", null)
      .order("id", { ascending: false });

    if (material && material !== "ALL") {
      subplateQuery = subplateQuery.eq("material", material);
    }
    if (location && location !== "ALL") {
      subplateQuery = subplateQuery.eq("location", location);
    }
    if (category && category !== "ALL") {
      subplateQuery = subplateQuery.eq("plate_category", category);
    }
    if (search) {
      const safeSearch = search.replace(/[(),%]/g, "").trim();
      if (safeSearch) {
        subplateQuery = subplateQuery.or(`platename.ilike.%${safeSearch}%,subprojectid.ilike.%${safeSearch}%`);
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
      // Batch subplates query with cached scans and users
      const [subplatesRes, scans, users] = await Promise.all([
        subplateQuery,
        getCached("shared_scans_lookup", 30, async () => {
          const res = await supabaseAdmin
            .from("scan")
            .select("id, projectid, description, worktype, cname, customer_id, status")
            .order("id", { ascending: false })
            .limit(1000);
          return res.data || [];
        }),
        getCachedUsers(),
      ]);

      if (subplatesRes.error) {
        throw new Error(subplatesRes.error.message);
      }

      const subplates = subplatesRes.data || [];
      const scanMap = new Map((scans || []).map((s: any) => [s.id, s]));
      const userMap = new Map((users || []).map((u: any) => [u.id, u]));

      // Fetch active PO status & quantities for plates
      const plateIds = subplates.map((sp: any) => sp.id);
      const orderedMap: Record<number, number> = {};
      const platePOsMap = new Map<number, Array<{
        po_id: number;
        po_srno: string;
        qty: number;
        created_by?: string | null;
        created_at?: string | null;
      }>>();

      if (plateIds.length > 0) {
        const { data: orderedRows } = await supabaseAdmin
          .from("purchase_items")
          .select("plateid, qty, purchase:pid!inner(id, srno, status, created_by, created_at)")
          .in("plateid", plateIds)
          .neq("purchase.status", "0");

        if (orderedRows) {
          orderedRows.forEach((row: any) => {
            const pid = Number(row.plateid);
            const q = Number(row.qty) || 0;
            orderedMap[pid] = (orderedMap[pid] || 0) + q;
            const poData = Array.isArray(row.purchase) ? row.purchase[0] : row.purchase;
            if (poData) {
              const existingList = platePOsMap.get(pid) || [];
              existingList.push({
                po_id: poData.id,
                po_srno: poData.srno || "",
                qty: q,
                created_by: poData.created_by || null,
                created_at: poData.created_at || null,
              });
              platePOsMap.set(pid, existingList);
            }
          });
        }
      }

      let inHouseCount = 0;
      let vendorCount = 0;
      for (const sp of subplates) {
        if (sp.location === "SM" || !sp.location) inHouseCount++;
        else vendorCount++;
      }
      const kpis = {
        totalCount: subplatesRes.count ?? subplates.length,
        inHouseCount,
        vendorCount,
      };

      const enriched = subplates.map((sp: any) => {
        const scan = scanMap.get(sp.projectid);
        const ordered = orderedMap[sp.id] || 0;
        const total = Number(sp.sqty) || 1;
        const remaining = Math.max(0, total - ordered);
        const linkedPOs = platePOsMap.get(sp.id) || [];
        const hasPO = linkedPOs.length > 0;
        const latestPO = linkedPOs[linkedPOs.length - 1] || null;
        const poStatus: 'UNORDERED' | 'PARTIAL' | 'FULLY_ORDERED' =
          ordered >= total ? 'FULLY_ORDERED' : ordered > 0 ? 'PARTIAL' : 'UNORDERED';

        return {
          ...sp,
          ordered_qty: ordered,
          remaining_qty: remaining,
          has_active_po: hasPO,
          po_srno: latestPO?.po_srno || null,
          po_id: latestPO?.po_id || null,
          po_status: poStatus,
          linked_pos: linkedPOs,
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

    const result = cacheKey ? await getCached(cacheKey, 30, executeFetch) : await executeFetch();

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
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/subplate - Create new subplate entry (Roles 0, 1, 2, 3)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3, 6, 7, 9, 10], "action_create_subplate");
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
      .from("scan")
      .select("id, projectid")
      .eq("id", numProjectId)
      .maybeSingle();

    if (scanErr || !scanProject) {
      return NextResponse.json(
        { error: `Associated Mould Project #${numProjectId} does not exist.` },
        { status: 400 }
      );
    }

    // 3. Optional Dimensions Validation
    const normShape = (shape || "Plate").trim();
    const normShapeLower = normShape.toLowerCase();
    const isRound = normShapeLower === "round" || normShapeLower === "round bar";

    const hasLength = length !== undefined && length !== null && String(length).trim() !== "";
    const hasWidth = width !== undefined && width !== null && String(width).trim() !== "";
    const hasHeight = height !== undefined && height !== null && String(height).trim() !== "";

    const numLength = hasLength ? Number(length) : null;
    const numWidth = hasWidth ? Number(width) : null;
    const numHeight = isRound ? null : (hasHeight ? Number(height) : null);
    const numQty = Math.max(1, parseInt(String(sqty || 1), 10) || 1);

    if (numLength !== null && (isNaN(numLength) || numLength < 0)) {
      return NextResponse.json(
        { error: "Invalid length: Length must be a valid number if provided." },
        { status: 400 }
      );
    }

    if (numWidth !== null && (isNaN(numWidth) || numWidth < 0)) {
      return NextResponse.json(
        {
          error: isRound
            ? "Invalid Outer Diameter: OD must be a valid number if provided."
            : "Invalid width: Width must be a valid number if provided.",
        },
        { status: 400 }
      );
    }

    if (!isRound && numHeight !== null && (isNaN(numHeight) || numHeight < 0)) {
      return NextResponse.json(
        { error: "Invalid thickness/height: Height must be a valid number if provided." },
        { status: 400 }
      );
    }

    if (isNaN(numQty) || numQty < 1) {
      return NextResponse.json(
        { error: "Quantity must be an integer of 1 or greater." },
        { status: 400 }
      );
    }

    // 4. Ensure weight is computed if dimensions are provided
    let finalWeight = Number(weight) || 0;
    if (finalWeight <= 0 && numLength !== null && numWidth !== null && (isRound || numHeight !== null)) {
      finalWeight = calculateSubplateWeight({
        shape: normShape,
        material: material || "MS-Bright",
        length: numLength,
        width: numWidth,
        height: isRound ? 0 : (numHeight || 0),
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

    const determinedCategory = (
      body.plate_category ||
      body.category ||
      inferPlateCategory(cleanPlateName)
    ).trim();

    const { data, error } = await supabaseAdmin
      .from("subplate")
      .insert([
        {
          platename: cleanPlateName,
          projectid: numProjectId,
          mold_id: numProjectId,
          mold_code: scanProject.projectid || null,
          plate_category: determinedCategory,
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
    invalidateCache("api_pipeline_stage_counts");

    return NextResponse.json(
      { subplate: data, message: "Subplate created successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT/PATCH /api/subplate - Update subplate (Staff & Admin roles)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "action_edit_subplate");
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
      if (/^\d+$/.test(updatePayload.projectid)) {
        updatePayload.mold_id = Number(updatePayload.projectid);
        const { data: scanRow } = await supabaseAdmin
          .from("scan")
          .select("projectid")
          .eq("id", updatePayload.mold_id)
          .maybeSingle();
        if (scanRow) updatePayload.mold_code = scanRow.projectid;
      }
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
      if (updatePayload.plate_category === undefined && updatePayload.category === undefined) {
        updatePayload.plate_category = inferPlateCategory(cleanName);
      }
    }

    if (updatePayload.length !== undefined) {
      if (updatePayload.length === null || updatePayload.length === "" || updatePayload.length === 0) {
        updatePayload.length = null;
      } else {
        const l = Number(updatePayload.length);
        if (isNaN(l) || l < 0) {
          return NextResponse.json({ error: "Length must be a valid number." }, { status: 400 });
        }
        updatePayload.length = l;
      }
    }

    if (updatePayload.width !== undefined) {
      if (updatePayload.width === null || updatePayload.width === "" || updatePayload.width === 0) {
        updatePayload.width = null;
      } else {
        const w = Number(updatePayload.width);
        if (isNaN(w) || w < 0) {
          return NextResponse.json({ error: "Width/OD must be a valid number." }, { status: 400 });
        }
        updatePayload.width = w;
      }
    }

    if (updatePayload.height !== undefined) {
      const isRound = String(updatePayload.shape || "").toLowerCase().includes("round");
      if (isRound || updatePayload.height === null || updatePayload.height === "" || updatePayload.height === 0) {
        updatePayload.height = null;
      } else {
        const h = Number(updatePayload.height);
        if (isNaN(h) || h < 0) {
          return NextResponse.json({ error: "Height/Thickness must be a valid number." }, { status: 400 });
        }
        updatePayload.height = h;
      }
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

    // Strict business rule: Stage 2 (order_by) cannot be manually assigned or modified from Subplate/Dashboard.
    // It is strictly governed by the Purchase Order (PO) lifecycle:
    // 1) Must generate a PO to auto-assign it to the creator.
    // 2) Once a PO is active, it is locked.
    if ("order_by" in updatePayload) {
      const { data: activePOs } = await supabaseAdmin
        .from("purchase_items")
        .select("pid, purchase:pid!inner(id, srno, status)")
        .eq("plateid", subplateId)
        .neq("purchase.status", "0")
        .limit(1);

      const hasActivePO = activePOs && activePOs.length > 0;
      if (!hasActivePO) {
        return NextResponse.json(
          {
            error: "Purchase stage cannot be assigned manually. A Purchase Order (PO) must be generated for this subplate first.",
            code: "PO_REQUIRED",
          },
          { status: 400 }
        );
      } else {
        const activePoRecord: any = activePOs[0];
        const poSrno = activePoRecord?.purchase?.srno || activePoRecord?.purchase?.[0]?.srno || "PO";
        return NextResponse.json(
          {
            error: `Purchase stage is locked by Purchase Order (#${poSrno}). It cannot be manually changed or unassigned.`,
            code: "PO_LOCKED",
          },
          { status: 400 }
        );
      }
    }

    // Enforce that non-admin users (e.g. Designers, Workers) can only assign tasks to themselves, and strictly for their department's stages
    const isUserAdmin = auth.user.role_id === 0 || auth.user.role?.toLowerCase() === "admin";
    if (!isUserAdmin && auth.user.role_id !== 1) {
      const userRoleId = Number(auth.user.role_id);
      const userRoleName = (auth.user.role || "").toLowerCase();

      const allowedKeys = new Set<string>();
      if (userRoleId === 3 || userRoleName.includes("designer")) {
        allowedKeys.add("design_by");
      } else if (userRoleId === 5 || userRoleName.includes("purchase")) {
        allowedKeys.add("order_by");
      } else if (userRoleId === 10 || userRoleName.includes("programmer")) {
        allowedKeys.add("received_qcby");
      } else if (userRoleId === 6 || userRoleName.includes("vmc")) {
        allowedKeys.add("vmc_workby");
      } else if (userRoleId === 7 || userRoleName.includes("qc") || userRoleName.includes("quality")) {
        allowedKeys.add("vmc_qcby");
        allowedKeys.add("final_qcby");
      } else if (userRoleId === 9 || userRoleName.includes("dispatch")) {
        allowedKeys.add("packing_workby");
      } else if (userRoleId === 4 || userRoleName.includes("worker") || userRoleName.includes("operator")) {
        allowedKeys.add("drilltap_workby");
        allowedKeys.add("received_workby");
      }

      for (const byField of Object.keys(stageTimestampMap)) {
        if (byField in updatePayload) {
          if (!allowedKeys.has(byField)) {
            return NextResponse.json(
              { error: `Permission denied: Your role (${auth.user.role || "Staff"}) is not authorized to assign this stage.` },
              { status: 403 }
            );
          }
          const targetUserId = updatePayload[byField];
          // Non-admin users cannot unassign once assigned
          if (targetUserId === null || targetUserId === 0 || targetUserId === "" || targetUserId === undefined) {
            return NextResponse.json(
              { error: "Permission denied: Once assigned, only Administrators can unassign or reassign a production stage." },
              { status: 403 }
            );
          }
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

    // Strip any non-column properties (such as virtual *_name fields or client enrichment data)
    const nonColumnKeys = [
      "id",
      "updates",
      "field",
      "value",
      "design_by_name",
      "order_by_name",
      "received_workby_name",
      "received_qcby_name",
      "vmc_workby_name",
      "vmc_qcby_name",
      "drilltap_workby_name",
      "final_qcby_name",
      "packing_workby_name",
      "customername",
      "customer_name",
      "project_desc",
      "project_cname",
      "cname",
      "staff_name",
    ];
    for (const key of nonColumnKeys) {
      delete updatePayload[key];
    }
    for (const key of Object.keys(updatePayload)) {
      if (key.endsWith("_name") || key.endsWith("_by_name")) {
        delete updatePayload[key];
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

    const { data: updatedUsers } = await supabaseAdmin
      .from("users")
      .select("id, name, initials, role_id, status");
    const userMap = new Map((updatedUsers || []).map((u: any) => [u.id, u]));

    const enrichedData = {
      ...data,
      design_by_name: userMap.get(Number(data.design_by))?.name || userMap.get(Number(data.design_by))?.initials || null,
      order_by_name: userMap.get(Number(data.order_by))?.name || userMap.get(Number(data.order_by))?.initials || null,
      received_workby_name: userMap.get(Number(data.received_workby))?.name || userMap.get(Number(data.received_workby))?.initials || null,
      received_qcby_name: userMap.get(Number(data.received_qcby))?.name || userMap.get(Number(data.received_qcby))?.initials || null,
      vmc_workby_name: userMap.get(Number(data.vmc_workby))?.name || userMap.get(Number(data.vmc_workby))?.initials || null,
      vmc_qcby_name: userMap.get(Number(data.vmc_qcby))?.name || userMap.get(Number(data.vmc_qcby))?.initials || null,
      drilltap_workby_name: userMap.get(Number(data.drilltap_workby))?.name || userMap.get(Number(data.drilltap_workby))?.initials || null,
      final_qcby_name: userMap.get(Number(data.final_qcby))?.name || userMap.get(Number(data.final_qcby))?.initials || null,
      packing_workby_name: userMap.get(Number(data.packing_workby))?.name || userMap.get(Number(data.packing_workby))?.initials || null,
    };

    invalidateCache("subplate_default_");
    invalidateCache("scanning_default_");
    invalidateCache("subplates_worklog_lookup");
    invalidateCache("subplate_kpi_counts");
    invalidateCache("api_counts_all");
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("shared_scans_lookup");

    return NextResponse.json({ subplate: enrichedData, message: "Subplate updated successfully in database" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = PUT;

// DELETE /api/subplate - Hard delete subplate from database (Roles 0, 1, 2, 3)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3, 6, 7, 9, 10], "action_delete_subplate");
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

    // Bug #5 Fix: Cascade delete any child worklogs before deleting the subplate to prevent orphan records
    await supabaseAdmin
      .from("worklog")
      .delete()
      .or(`subplateid.eq.${subplateId},subplateid.eq.${String(subplateId)}`);

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
    invalidateCache("api_pipeline_stage_counts");
    invalidateCache("shared_scans_lookup");

    return NextResponse.json({ success: true, message: "Subplate permanently deleted from database" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
