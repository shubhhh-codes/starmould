import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

// Helper: Calculate amount from grams using dynamic gram_calc table
async function calculateGramAmount(gram: number): Promise<number> {
  if (!gram || gram <= 0) return 0;
  try {
    const { data: tiers } = await supabaseAdmin
      .from("gram_calc")
      .select("graterthan, lessthan, fix, multiply");

    for (const tier of tiers || []) {
      const min = Number(tier.graterthan);
      const max = Number(tier.lessthan);
      if (gram >= min && gram <= max) {
        const fix = Number(tier.fix || 0);
        const multiply = Number(tier.multiply || 0);
        if (fix > 0) return fix;
        if (multiply > 0) return multiply * gram;
      }
    }
  } catch {
    // fallback if table empty
  }
  return 0;
}

// GET /api/printing - Fetch 3D print orders, customer lookups, staff assignments, gram tiers, and KPIs (Roles 0, 1, 2)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("print")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data: printRows, error: pErr } = await query;
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    // Fetch customers lookup
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, customername, initials, usertype")
      .is("deleted_at", null);

    const custMap = new Map((customers || []).map((c) => [c.id, c]));

    // Fetch active users for staff dropdown
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, name, username, initials, status, role_id")
      .is("deleted_at", null);

    const userMap = new Map((users || []).map((u) => [u.id, u]));

    // Fetch gram calculation tiers for client-side simulator
    const { data: gramTiers } = await supabaseAdmin
      .from("gram_calc")
      .select("*")
      .order("graterthan", { ascending: true });

    const enriched = (printRows || []).map((p) => {
      const cust = custMap.get(p.cname);
      const printUser = userMap.get(Number(p.print_by));
      const qcUser = userMap.get(Number(p.qc_by));

      return {
        ...p,
        customername: cust?.customername || `Customer #${p.cname}`,
        customer_initials: cust?.initials || "",
        print_by_name: printUser?.name || printUser?.initials || printUser?.username || "—",
        qc_by_name: qcUser?.name || qcUser?.initials || qcUser?.username || "—",
      };
    });

    // Compute KPIs
    const totalPrints = (printRows || []).length;
    const pendingPrints = (printRows || []).filter((p) => p.status === "pending" || !p.status).length;
    const dispatchedPrints = (printRows || []).filter((p) => Number(p.dispatch) === 1).length;
    const totalRevenue = (printRows || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    );

    return NextResponse.json({
      prints: enriched,
      customers: customers || [],
      users: (users || []).filter((u) => String(u.status) === "1" || u.status === 1),
      gramTiers: gramTiers || [],
      kpis: {
        totalPrints,
        pendingPrints,
        dispatchedPrints,
        totalRevenue,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/printing - Create new 3D printing project (Roles 0, 1, 2)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      cname,
      description,
      gram,
      time,
      tdate,
      cdate,
      print_by,
      qc_by,
      manualAmount,
    } = body;

    if (!cname || !description) {
      return NextResponse.json(
        { error: "Customer and Description are required" },
        { status: 400 }
      );
    }

    const numGram = Number(gram) || 0;
    let calculatedAmount = await calculateGramAmount(numGram);
    if (calculatedAmount === 0 && manualAmount) {
      calculatedAmount = Number(manualAmount) || 0;
    }

    const now = new Date().toISOString();

    // Generate project code format: e.g. PRN-0001
    const { count } = await supabaseAdmin
      .from("print")
      .select("id", { count: "exact", head: true });

    const nextId = (count || 0) + 1;
    const projectid = `PRN-${String(nextId).padStart(4, "0")}`;

    const { data, error } = await supabaseAdmin
      .from("print")
      .insert([
        {
          projectid,
          cname: Number(cname),
          description: description.trim(),
          gram: numGram,
          hr: Number(time) || 0,
          tdate: tdate || now.slice(0, 10),
          cdate: cdate || now.slice(0, 10),
          print_by: print_by ? Number(print_by) : 0,
          qc_by: qc_by ? Number(qc_by) : 0,
          amount: calculatedAmount,
          ramount: 0,
          dispatch: 0,
          payment: 0,
          status: "pending",
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("api_counts_all");

    return NextResponse.json(
      { print: data, message: "Print project created successfully" },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/printing - Update dispatch, payment, staff assignment, or ramount (Roles 0, 1, 2)
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, field, value, updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing print id" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (field && value !== undefined) {
      if (["print_by", "qc_by"].includes(field)) {
        updatePayload[field] =
          value === 0 || value === "0" || value === "" || value === null
            ? null
            : Number(value);
      } else if (["cname", "gram", "dispatch", "payment", "hr", "pr_printhr", "amount", "ramount"].includes(field)) {
        updatePayload[field] =
          value === "" || value === null ? 0 : Number(value);
      } else {
        updatePayload[field] = value;
      }
      if (field === "gram") {
        updatePayload.amount = await calculateGramAmount(Number(value));
      }
    } else if (updates && typeof updates === "object") {
      Object.assign(updatePayload, updates);
      if (updates.gram) {
        updatePayload.amount = await calculateGramAmount(Number(updates.gram));
      }
    }

    const { data, error } = await supabaseAdmin
      .from("print")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("api_counts_all");

    return NextResponse.json({ print: data, message: "Updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/printing - Remove print project (Roles 0, 1, 2)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 2]);
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
      return NextResponse.json({ error: "Missing print id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("print").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("api_counts_all");

    return NextResponse.json({ success: true, message: "Print project deleted" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
