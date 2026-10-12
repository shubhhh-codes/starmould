import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCachePrefix } from "@/lib/cache";

// GET /api/expense - fetch expenses with customers lookup and summary KPIs (Admin, Manager only)
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_expense");
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

// POST /api/expense - create new expense entry (Admin, Manager only)
// Balance calculated by applying amount to previous latest entry balance (matches legacy ExpenseController:503-512)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_expense");
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

    // Fetch previous latest row balance
    const { data: latestRows } = await supabaseAdmin
      .from("expense")
      .select("id, balance")
      .order("id", { ascending: false })
      .limit(1);

    const prevBalance = Number(latestRows?.[0]?.balance ?? 0);
    const newBalance = payment_type === "Credit" ? prevBalance + numAmount : prevBalance - numAmount;

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
          balance: newBalance,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCachePrefix("counts:");
    return NextResponse.json({ expense: data, message: "Expense record created successfully." }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/expense - update expense entry (Admin, Manager only)
// Server-enforced ledger rule: amount/payment_type can ONLY be altered on the latest ledger row (matches legacy index.blade.php:201 / store:467-481)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_expense");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, rdate, customerid, description, payment_type, payment_mode, amount } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing expense id" }, { status: 400 });
    }

    const numId = Number(id);

    // Fetch existing target row
    const { data: targetRow, error: fetchErr } = await supabaseAdmin
      .from("expense")
      .select("*")
      .eq("id", numId)
      .single();

    if (fetchErr || !targetRow) {
      return NextResponse.json({ error: "Expense entry not found" }, { status: 404 });
    }

    // Check if this row is the latest entry
    const { data: maxRows } = await supabaseAdmin
      .from("expense")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    const isLatest = maxRows?.[0]?.id === numId;

    // If NOT the latest row, enforce immutability on financial numbers (amount / payment_type)
    if (!isLatest) {
      const isAmountChanged = amount !== undefined && Number(amount) !== Number(targetRow.amount);
      const isTypeChanged = payment_type !== undefined && payment_type !== targetRow.payment_type;

      if (isAmountChanged || isTypeChanged) {
        return NextResponse.json(
          { error: "Amount and payment type can only be modified on the latest ledger entry to preserve historical ledger integrity." },
          { status: 400 }
        );
      }
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (rdate) updatePayload.rdate = rdate;
    if (customerid !== undefined) updatePayload.customerid = customerid ? Number(customerid) : 0;
    if (description !== undefined) updatePayload.description = description.trim();
    if (payment_mode) updatePayload.payment_mode = payment_mode;

    if (isLatest) {
      const effectiveType = payment_type || targetRow.payment_type;
      const effectiveAmount = amount !== undefined ? Number(amount) : Number(targetRow.amount);

      if (payment_type) updatePayload.payment_type = payment_type;
      if (amount !== undefined) updatePayload.amount = effectiveAmount;

      // Calculate balance based on prior row (highest id < current id)
      const { data: priorRows } = await supabaseAdmin
        .from("expense")
        .select("balance")
        .lt("id", numId)
        .order("id", { ascending: false })
        .limit(1);

      const priorBalance = Number(priorRows?.[0]?.balance ?? 0);
      updatePayload.balance = effectiveType === "Credit"
        ? priorBalance + effectiveAmount
        : priorBalance - effectiveAmount;
    }

    const { data, error } = await supabaseAdmin
      .from("expense")
      .update(updatePayload)
      .eq("id", numId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCachePrefix("counts:");
    return NextResponse.json({ expense: data, message: "Expense updated successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/expense - delete expense entry (Admin, Manager only)
// Server-enforced ledger rule: ONLY the latest ledger entry can be deleted (matches legacy index.blade.php:201-210)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "nav_expense");
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

    const numId = Number(id);

    // Verify row is the latest entry
    const { data: maxRows } = await supabaseAdmin
      .from("expense")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);

    if (!maxRows || maxRows.length === 0) {
      return NextResponse.json({ error: "No expense entries found" }, { status: 404 });
    }

    if (maxRows[0].id !== numId) {
      return NextResponse.json(
        { error: "Only the latest ledger entry can be deleted to maintain immutable historical balance integrity." },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("expense")
      .delete()
      .eq("id", numId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCachePrefix("counts:");
    return NextResponse.json({ success: true, message: "Latest expense record deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
