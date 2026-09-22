import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/subplate - fetch subplates with project and staff lookups
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");
    const projectid = searchParams.get("projectid");

    let query = supabaseAdmin
      .from("subplate")
      .select("*")
      .is("deleted_at", null)
      .order("id", { ascending: false })
      .limit(limit);

    if (projectid && projectid !== "ALL") {
      query = query.eq("projectid", projectid);
    }

    const { data: subplates, error: spErr } = await query;
    if (spErr) {
      return NextResponse.json({ error: spErr.message }, { status: 500 });
    }

    // Fetch scans lookup
    const { data: scans } = await supabaseAdmin
      .from("scan")
      .select("id, projectid, description, cname")
      .order("id", { ascending: false })
      .limit(1000);

    const scanMap = new Map((scans || []).map((s) => [s.id, s]));

    // Fetch active users for staff assignment lookup
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, username, initials, status, role_id")
      .is("deleted_at", null);

    const userMap = new Map((users || []).map((u) => [u.id, u]));

    const enriched = (subplates || []).map((sp) => {
      const scan = scanMap.get(sp.projectid);
      return {
        ...sp,
        mould_project_code: scan?.projectid || `Project #${sp.projectid}`,
        mould_description: scan?.description || "",
        design_by_name: userMap.get(sp.design_by)?.initials || "—",
        vmc_workby_name: userMap.get(sp.vmc_workby)?.initials || "—",
        final_qcby_name: userMap.get(sp.final_qcby)?.initials || "—",
        packing_workby_name: userMap.get(sp.packing_workby)?.initials || "—",
      };
    });

    // Counts for KPIs
    const { count: totalActive } = await supabaseAdmin
      .from("subplate")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);

    const { count: inHouseCount } = await supabaseAdmin
      .from("subplate")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .or("location.eq.SM,location.is.null");

    const { count: vendorCount } = await supabaseAdmin
      .from("subplate")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .neq("location", "SM")
      .not("location", "is", null);

    return NextResponse.json({
      subplates: enriched,
      scans: scans || [],
      users: (users || []).filter((u) => u.status === "1"),
      kpis: {
        totalCount: totalActive || 0,
        inHouseCount: inHouseCount || 0,
        vendorCount: vendorCount || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/subplate - Create new subplate entry
export async function POST(req: NextRequest) {
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

// PUT /api/subplate - Update subplate
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing subplate id" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      ...(updates || body),
      updated_at: new Date().toISOString(),
    };
    delete updatePayload.id;

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

// DELETE /api/subplate - Soft delete subplate
export async function DELETE(req: NextRequest) {
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
