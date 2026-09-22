import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// GET /api/worklog - Fetch worklogs with customer, user, scan, and subplate lookups + department statistics
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");
    const userid = searchParams.get("userid");
    const date = searchParams.get("date");
    const customerid = searchParams.get("customerid");
    const projectid = searchParams.get("projectid");

    let query = supabaseAdmin
      .from("worklog")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (userid && userid !== "ALL") {
      query = query.eq("userid", userid);
    }
    if (date) {
      query = query.eq("rdate", date);
    }
    if (customerid && customerid !== "ALL") {
      query = query.eq("customerid", customerid);
    }
    if (projectid && projectid !== "ALL") {
      query = query.eq("projectid", projectid);
    }

    const { data: worklogs, error: wErr } = await query;
    if (wErr) {
      return NextResponse.json({ error: wErr.message }, { status: 500 });
    }

    // Fetch customers lookup
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, customername, initials, usertype")
      .is("deleted_at", null);

    const custMap = new Map((customers || []).map((c) => [c.id, c]));

    // Fetch users lookup
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, username, initials, status, role")
      .is("deleted_at", null);

    const userMap = new Map((users || []).map((u) => [u.id, u]));

    // Fetch scans lookup
    const { data: scans } = await supabaseAdmin
      .from("scan")
      .select("id, projectid, description, worktype, cname")
      .order("id", { ascending: false })
      .limit(1000);

    const scanMap = new Map((scans || []).map((s) => [s.projectid, s]));

    // Fetch subplates lookup
    const { data: subplates } = await supabaseAdmin
      .from("subplate")
      .select("id, platename, subprojectid, projectid")
      .is("deleted_at", null)
      .limit(2000);

    const subMap = new Map((subplates || []).map((sp) => [sp.subprojectid, sp]));

    const enriched = (worklogs || []).map((w) => {
      const cust = custMap.get(w.customerid);
      const usr = userMap.get(w.userid);
      const scan = scanMap.get(w.projectid);
      const sub = subMap.get(w.subplateid);

      return {
        ...w,
        customername: cust?.customername || `Customer #${w.customerid}`,
        customer_initials: cust?.initials || "",
        workername: usr?.username || `User #${w.userid}`,
        worker_initials: usr?.initials || "—",
        mould_description: scan?.description || "",
        worktype: scan?.worktype || "Scanning",
        subplatename: sub?.platename || w.subplateid || "—",
      };
    });

    // Compute Department Totals across all fetched worklogs
    let totalDesignMinutes = 0;
    let totalProgramMinutes = 0;
    let totalMachineMinutes = 0;
    let totalDrillMinutes = 0;
    let totalQCMinutes = 0;
    let totalWorkMinutes = 0;

    for (const w of enriched) {
      totalDesignMinutes += Number(w.design_hr || 0) * 60;
      totalProgramMinutes += Number(w.program_hr || 0) * 60;
      totalMachineMinutes += Number(w.machine_hr || 0) * 60;
      totalDrillMinutes += Number(w.driltap_hr || 0) * 60;
      totalQCMinutes += Number(w.qc_hr || 0) * 60;

      const durationParts = String(w.work_hr || "0").split(":");
      if (durationParts.length >= 2) {
        totalWorkMinutes +=
          parseInt(durationParts[0], 10) * 60 + parseInt(durationParts[1], 10);
      } else {
        totalWorkMinutes += Number(w.work_hr || 0) * 60;
      }
    }

    return NextResponse.json({
      worklogs: enriched,
      customers: customers || [],
      users: (users || []).filter((u) => u.status === "1"),
      scans: scans || [],
      subplates: subplates || [],
      kpis: {
        totalEntries: enriched.length,
        totalWorkHours: (totalWorkMinutes / 60).toFixed(1),
        totalDesignHours: (totalDesignMinutes / 60).toFixed(1),
        totalProgramHours: (totalProgramMinutes / 60).toFixed(1),
        totalMachineHours: (totalMachineMinutes / 60).toFixed(1),
        totalDrillHours: (totalDrillMinutes / 60).toFixed(1),
        totalQCHours: (totalQCMinutes / 60).toFixed(1),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/worklog - Create new worklog entry (matches WorkController.php store)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      rdate,
      customerid,
      projectid,
      subplateid,
      workdescription,
      sdate,
      edate,
      starttime,
      endtime,
      work_hr,
      design_hr,
      program_hr,
      machine_hr,
      driltap_hr,
      qc_hr,
      userid,
    } = body;

    if (!customerid || !projectid) {
      return NextResponse.json(
        { error: "Customer and Project ID are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Link scan_print_id if scan exists
    const { data: matchedScan } = await supabaseAdmin
      .from("scan")
      .select("id")
      .eq("projectid", projectid)
      .limit(1)
      .single();

    const { data, error } = await supabaseAdmin
      .from("worklog")
      .insert([
        {
          scan_print_id: matchedScan?.id || null,
          customerid: Number(customerid),
          projectid: projectid.trim(),
          subplateid: subplateid?.trim() || null,
          workdescription: workdescription?.trim() || "",
          rdate: rdate || now.slice(0, 10),
          sdate: sdate || now.slice(0, 10),
          edate: edate || now.slice(0, 10),
          starttime: starttime || "09:00",
          endtime: endtime || "17:30",
          work_hr: work_hr || "08:30",
          design_hr: Number(design_hr) || 0,
          program_hr: Number(program_hr) || 0,
          machine_hr: Number(machine_hr) || 0,
          driltap_hr: Number(driltap_hr) || 0,
          qc_hr: Number(qc_hr) || 0,
          userid: userid ? Number(userid) : 1,
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
      { worklog: data, message: "Worklog created successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/worklog - Remove worklog entry
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Missing worklog id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("worklog").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Worklog deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
