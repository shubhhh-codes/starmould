import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, getCachedScansLookup, getCachedUsers } from "@/lib/cache";

// GET /api/subplate - fetch subplates with project and staff lookups (Roles 0, 1, 2, 3)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");
    const projectid = searchParams.get("projectid");

    let subplateQuery = supabaseAdmin
      .from("subplate")
      .select("id, platename, projectid, subprojectid, material, location, width, height, length, unit, sqty, design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby, design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at, created_at, updated_at")
      .is("deleted_at", null)
      .order("id", { ascending: false })
      .limit(limit);

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
      return NextResponse.json({ error: subplatesRes.error.message }, { status: 500 });
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

    const response = NextResponse.json({
      subplates: enriched,
      scans: scans,
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

// POST /api/subplate - Create new subplate entry (Roles 0, 1, 2, 3)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
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

    if (!platename || !projectid) {
      return NextResponse.json(
        { error: "Plate name and Project ID are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const generatedSubprojectId =
      subprojectid?.trim() ||
      `${platename.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const { data, error } = await supabaseAdmin
      .from("subplate")
      .insert([
        {
          platename: platename.trim(),
          projectid: Number(projectid),
          subprojectid: generatedSubprojectId,
          shape: shape || "Plate",
          width: width ? Number(width) : null,
          height: height ? Number(height) : null,
          length: length ? Number(length) : null,
          weight: weight ? Number(weight) : null,
          unit: unit || "mm",
          material: material || "MS-Bright",
          sqty: sqty ? Number(sqty) : 1,
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
  const auth = await authenticateRequest(req, [0, 1, 2, 3]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing subplate id" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      ...(updates || body),
      updated_at: now,
    };
    delete updatePayload.id;

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
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subplate: data, message: "Subplate updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = PUT;

// DELETE /api/subplate - Soft delete subplate (Roles 0, 1, 2, 3)
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
      return NextResponse.json({ error: "Missing subplate id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("subplate")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Subplate deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
