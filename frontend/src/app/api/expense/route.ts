import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCachePrefix } from "@/lib/cache";

// GET /api/expense - fetch expenses with customers lookup and summary KPIs (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "1000");

    // 1. Fetch expenses
    const { data: expenses, error: eErr } = await supabaseAdmin
      .from("expense")
      .select("*")
      .order("id", { ascending: false })
      .limit(limit);

    if (eErr) {
      return NextResponse.json({ error: eErr.message }, { status: 500 });
    }

    // 2. Fetch customers where usertype = 'Other' (Accounts)
    const { data: accounts } = await supabaseAdmin
      .from("customers")
      .select("id, customername, usertype, initials")
      .is("deleted_at", null);

    const custMap = new Map((accounts || []).map((c) => [c.id, c.customername]));

    const enrichedExpenses = (expenses || []).map((e) => ({
      ...e,
      customername: custMap.get(e.customerid) || `Account #${e.customerid}`,
    }));

    // Calculate totals across all records
    const { data: allExpenses } = await supabaseAdmin
      .from("expense")
      .select("payment_type, amount");

    let totalCredit = 0;
    let totalDebit = 0;
    let totalOutstanding = 0;

    for (const exp of allExpenses || []) {
      const amt = Number(exp.amount) || 0;
      if (exp.payment_type === "Credit") totalCredit += amt;
      else if (exp.payment_type === "Debit") totalDebit += amt;
      else if (exp.payment_type === "Outstanding") totalOutstanding += amt;
    }

    const latestBalance = expenses?.[0]?.balance ?? (totalCredit - totalDebit);

    return NextResponse.json({
      expenses: enrichedExpenses,
      accounts: (accounts || []).filter((c) => c.usertype === "Other" || !c.usertype),
      kpis: {
        totalCredit,
        totalDebit,
        totalOutstanding,
        currentBalance: latestBalance,
        totalCount: (allExpenses || []).length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper to recalculate running balances across all records deterministically
async function recalculateExpenseBalances(): Promise<number> {
  const { data: rows } = await supabaseAdmin
    .from("expense")
    .select("id, payment_type, amount, balance")
    .order("id", { ascending: true });

  if (!rows || rows.length === 0) return 0;

  let runningBalance = 0;
  const updates: Array<{ id: number; balance: number }> = [];

  for (const r of rows) {
    const amt = Number(r.amount) || 0;
    if (r.payment_type === "Credit") {
      runningBalance += amt;
    } else if (r.payment_type === "Debit") {
      runningBalance -= amt;
    }
    if (r.balance !== runningBalance) {
      updates.push({ id: r.id, balance: runningBalance });
    }
  }

  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        supabaseAdmin.from("expense").update({ balance: u.balance }).eq("id", u.id)
      )
    );
  }

  return runningBalance;
}

// POST /api/expense - create new expense entry (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { rdate, customerid, description, payment_type, payment_mode, amount } = body;

    const numAmount = Number(amount);
    if (!payment_type || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Missing or invalid required fields (payment_type and positive amount are required)" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("expense")
      .insert([
        {
          rdate: rdate || now.slice(0, 10),
          customerid: customerid ? Number(customerid) : 0,
          description: description?.trim() || "expense",
          payment_type: payment_type || "Debit",
          payment_mode: payment_mode || "Cash",
          amount: numAmount,
          balance: 0, // Computed by recalculateExpenseBalances below
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deterministically update rolling balance for this and all subsequent rows
    await recalculateExpenseBalances();

    // Fetch updated row with accurate balance
    const { data: updatedRow } = await supabaseAdmin
      .from("expense")
      .select("*")
      .eq("id", data.id)
      .single();

    invalidateCachePrefix("counts:");
    return NextResponse.json({ expense: updatedRow || data, message: "Expense record created successfully." }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/expense - update expense entry (Admin, Manager only)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, rdate, customerid, description, payment_type, payment_mode, amount } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing expense id" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (rdate) updatePayload.rdate = rdate;
    if (customerid !== undefined) updatePayload.customerid = customerid ? Number(customerid) : 0;
    if (description !== undefined) updatePayload.description = description.trim();
    if (payment_type) updatePayload.payment_type = payment_type;
    if (payment_mode) updatePayload.payment_mode = payment_mode;
    if (amount !== undefined) updatePayload.amount = Number(amount);

    const { data, error } = await supabaseAdmin
      .from("expense")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deterministically recalculate all downstream balances
    await recalculateExpenseBalances();

    const { data: updatedRow } = await supabaseAdmin
      .from("expense")
      .select("*")
      .eq("id", id)
      .single();

    invalidateCachePrefix("counts:");
    return NextResponse.json({ expense: updatedRow || data, message: "Expense updated successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/expense - delete expense entry (Admin, Manager only)
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
      return NextResponse.json({ error: "Missing expense id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("expense")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate remaining balances deterministically
    await recalculateExpenseBalances();

    invalidateCachePrefix("counts:");
    return NextResponse.json({ success: true, message: "Expense record deleted and balances adjusted." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
