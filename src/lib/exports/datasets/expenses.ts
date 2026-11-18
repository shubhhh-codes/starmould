import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";

interface BuildExpensesOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildExpensesDataset(
  options: BuildExpensesOptions
): Promise<ExportDatasetResult> {
  const { filters = {}, search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",        header: "Sr. No",       type: "number",   width: 8,  center: true },
    { key: "rdate",        header: "Date",         type: "date",     width: 14, center: true },
    { key: "account_name", header: "Account Name", type: "string",   width: 26, center: true },
    { key: "description",  header: "Description",  type: "string",   width: 34 }, // Left aligned
    { key: "payment_mode", header: "Mode",         type: "string",   width: 14, center: true },
    { key: "payment_type", header: "Type",         type: "string",   width: 14, center: true },
    { key: "amount",       header: "Amount",       type: "currency", width: 16 },
    { key: "balance",      header: "Balance",      type: "currency", width: 16 },
  ];

  let query = supabaseAdmin
    .from("expense")
    .select("id, rdate, customerid, description, payment_mode, payment_type, amount, balance, created_at")
    .order("id", { ascending: false })
    .limit(maxRows + 1);

  if (filters.customerId) {
    query = query.eq("customerid", filters.customerId);
  }

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const [expensesRes, accountsRes] = await Promise.all([
    query,
    supabaseAdmin
      .from("customers")
      .select("id, customername")
      .is("deleted_at", null)
      .limit(10000),
  ]);

  if (expensesRes.error) throw new Error(`Failed to query expenses: ${expensesRes.error.message}`);

  const custMap = new Map<number, string>();
  for (const c of accountsRes.data || []) {
    custMap.set(c.id, c.customername || "");
  }

  const allExpenses = expensesRes.data || [];
  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allExpenses.map((e) => {
    const accountName = custMap.get(e.customerid) || (e.customerid ? `Account #${e.customerid}` : "General");
    return {
      id: e.id,
      rdate: e.rdate ? String(e.rdate).split("T")[0] : "",
      account_name: accountName,
      description: e.description || "",
      payment_mode: e.payment_mode || "",
      payment_type: e.payment_type || "",
      amount: e.amount != null ? Number(e.amount) : 0,
      balance: e.balance != null ? Number(e.balance) : 0,
    };
  });

  const filtered = formatted.filter((e) => {
    if (!queryStr) return true;
    return (
      e.account_name.toLowerCase().includes(queryStr) ||
      e.description.toLowerCase().includes(queryStr) ||
      e.payment_mode.toLowerCase().includes(queryStr) ||
      e.payment_type.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((e, idx) => ({
    sr_no: idx + 1,
    ...e,
  }));

  const filtersApplied: Record<string, string> = {};
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "Expense & Financial Register",
    subtitle: "Complete transaction log of credits, debits, petty cash, and party ledgers",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
