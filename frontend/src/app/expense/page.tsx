"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Building2,
  Plus,
  Search,
  FileSpreadsheet,
  DollarSign,
  TrendingUp,
  CreditCard,
  X,
  AlertCircle,
  Filter,
  Edit2,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import type { Expense, Customer } from "@/lib/supabase/types";
import {
  KpiCardSkeleton,
  TableSkeletonRows,
  CardGridSkeleton,
} from "@/components/ui/skeleton";

export default function ExpensePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [kpis, setKpis] = useState({
    totalCredit: 0,
    totalDebit: 0,
    totalOutstanding: 0,
    currentBalance: 0,
    totalCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/expense");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load expenses");
      }
      setExpenses(data.expenses || []);
      setCustomers(data.accounts || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setFetchError(err.message || "Failed to load expenses");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchExpenses();
  }, []);

  // Modal State - Add
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    rdate: new Date().toISOString().split("T")[0],
    customerid: "",
    description: "",
    payment_type: "Debit" as "Credit" | "Debit",
    payment_mode: "Cash" as "Cash" | "Gpay" | "Check" | "NEFT",
    amount: "",
  });

  // Modal State - Edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({
    id: 0,
    rdate: "",
    customerid: "",
    description: "",
    payment_type: "Debit" as "Credit" | "Debit",
    payment_mode: "Cash" as "Cash" | "Gpay" | "Check" | "NEFT",
    amount: "",
    isLatest: false,
  });

  // Filter accounts where usertype = 'Other' (Source: ExpenseController.php:38)
  const accountOptions = useMemo(() => {
    return customers.filter((c) => c.usertype === "Other" || !c.usertype);
  }, [customers]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Search
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        e.description?.toLowerCase().includes(q) ||
        e.customername?.toLowerCase().includes(q) ||
        e.payment_mode?.toLowerCase().includes(q) ||
        String(e.amount).includes(q);

      // Account filter
      const matchAccount =
        accountFilter === "ALL" || String(e.customerid) === accountFilter;

      // Type filter
      const matchType =
        typeFilter === "ALL" || e.payment_type === typeFilter;

      // Date range filter
      let matchDate = true;
      if (startDate && e.rdate) matchDate = matchDate && e.rdate >= startDate;
      if (endDate && e.rdate) matchDate = matchDate && e.rdate <= endDate;

      return matchQuery && matchAccount && matchType && matchDate;
    });
  }, [expenses, searchQuery, accountFilter, typeFilter, startDate, endDate]);

  // KPI Calculations (Live DB & Filter-aware)
  const totalCredit = useMemo(() => {
    if (searchQuery || accountFilter !== "ALL" || typeFilter !== "ALL" || startDate || endDate) {
      return filteredExpenses
        .filter((e) => e.payment_type === "Credit")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    }
    return kpis.totalCredit;
  }, [filteredExpenses, kpis.totalCredit, searchQuery, accountFilter, typeFilter, startDate, endDate]);

  const totalDebit = useMemo(() => {
    if (searchQuery || accountFilter !== "ALL" || typeFilter !== "ALL" || startDate || endDate) {
      return filteredExpenses
        .filter((e) => e.payment_type === "Debit")
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    }
    return kpis.totalDebit;
  }, [filteredExpenses, kpis.totalDebit, searchQuery, accountFilter, typeFilter, startDate, endDate]);

  const currentBalance = useMemo(() => {
    if (searchQuery || accountFilter !== "ALL" || typeFilter !== "ALL" || startDate || endDate) {
      return filteredExpenses[0]?.balance ?? (totalCredit - totalDebit);
    }
    return kpis.currentBalance;
  }, [filteredExpenses, kpis.currentBalance, totalCredit, totalDebit, searchQuery, accountFilter, typeFilter, startDate, endDate]);

  const latestExpenseId = useMemo(() => {
    return expenses.length > 0 ? Math.max(...expenses.map((x) => x.id)) : 0;
  }, [expenses]);

  // Handle Add Expense Submit (Live API)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.amount || !modalForm.customerid) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modalForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create expense");

      await fetchExpenses();
      setIsModalOpen(false);
      setModalForm({
        rdate: new Date().toISOString().split("T")[0],
        customerid: "",
        description: "",
        payment_type: "Debit",
        payment_mode: "Cash",
        amount: "",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (expense: Expense) => {
    const isLatest = expense.id === latestExpenseId;
    setEditingExpense(expense);
    setEditForm({
      id: expense.id,
      rdate: expense.rdate,
      customerid: String(expense.customerid),
      description: expense.description || "",
      payment_type: expense.payment_type as "Credit" | "Debit",
      payment_mode: expense.payment_mode as any,
      amount: String(expense.amount),
      isLatest,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/expense", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update expense");

      await fetchExpenses();
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (id !== latestExpenseId) {
      alert("Only the latest expense entry can be deleted to maintain balance integrity.");
      return;
    }
    if (window.confirm("Do you really want to delete this latest expense entry?")) {
      try {
        const res = await fetch(`/api/expense?id=${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete expense");
        await fetchExpenses();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Date", "Account Name", "Description", "Mode", "Type", "Amount", "Balance"];
    const rows = filteredExpenses.map((e) => [
      e.id,
      e.rdate,
      `"${e.customername || "General"}"`,
      `"${e.description || ""}"`,
      e.payment_mode,
      e.payment_type,
      e.amount,
      e.balance,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Expenses_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-8 space-y-6 w-full max-w-[1700px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Expense & Financial Register
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Track credits, debits, cash drawer balances, and party accounts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl transition shadow-sm text-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export CSV
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Expense / Entry
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <KpiCardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Closing Balance
                </p>
                <p
                  className={`text-2xl font-black ${
                    currentBalance >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  ₹{currentBalance.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Credit (Inflow)
                </p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{totalCredit.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                <ArrowUpRight className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total Debit (Outflow)
                </p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  ₹{totalDebit.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Entries Recorded
                </p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {expenses.length.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 w-full flex-1 sm:w-auto sm:min-w-[320px]">
            {/* Search Input */}
            <div className="relative flex-1 w-full sm:w-auto sm:min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, account, mode, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Account Selector */}
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            >
              <option value="ALL">All Accounts ({accountOptions.length})</option>
              {accountOptions.map((acc) => (
                <option key={acc.id} value={String(acc.id)}>
                  {acc.customername}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
            >
              <option value="ALL">All Types</option>
              <option value="Credit">Credit Only</option>
              <option value="Debit">Debit Only</option>
            </select>
          </div>

          {/* Date Range Picker */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="text-xs font-semibold text-slate-400 uppercase">
              Date:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-blue-600 hover:underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full min-w-[1000px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4"># ID</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Account / Party</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Payment Mode</th>
                  <th className="py-3.5 px-4 text-center">Type</th>
                  <th className="py-3.5 px-4 text-right">Credit (₹)</th>
                  <th className="py-3.5 px-4 text-right">Debit (₹)</th>
                  <th className="py-3.5 px-4 text-right">Balance (₹)</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <TableSkeletonRows columns={10} rows={8} />
                ) : filteredExpenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No expense records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">
                        #{row.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                        {row.rdate || "—"}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {row.customername || "Other / Miscellaneous"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {row.description || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {row.payment_mode || "Cash"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            row.payment_type === "Credit"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                              : "bg-rose-50 text-rose-700 border border-rose-200/50"
                          }`}
                        >
                          {row.payment_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                        {row.payment_type === "Credit"
                          ? `₹${Number(row.amount).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold">
                        {row.payment_type === "Debit"
                          ? `₹${Number(row.amount).toLocaleString("en-IN")}`
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{Number(row.balance || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(row)}
                            title={
                              row.id === latestExpenseId
                                ? "Edit full entry"
                                : "Edit description only (historical)"
                            }
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {row.id === latestExpenseId ? (
                            <button
                              onClick={() => handleDelete(row.id)}
                              title="Delete latest entry"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              title="Historical entry cannot be deleted"
                              className="p-1.5 text-slate-200 cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <CardGridSkeleton count={4} />
            ) : filteredExpenses.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No expense records found matching your filters.
              </div>
            ) : (
              filteredExpenses.map((row) => {
                const isCredit = row.payment_type === "Credit";
                return (
                  <div
                    key={row.id}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-400 text-[11px]">#{row.id}</span>
                        <span className="font-medium text-slate-600">{row.rdate || "—"}</span>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isCredit
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {row.payment_type}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-slate-900 block">
                        {row.customername || "Other / Miscellaneous"}
                      </span>
                      <p className="text-[11px] text-slate-600 line-clamp-1">
                        {row.description || "—"}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] pt-1.5 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Credit:</span>
                        <span className="font-mono font-medium text-emerald-600">
                          {isCredit ? `₹${Number(row.amount).toLocaleString("en-IN")}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Debit:</span>
                        <span className="font-mono font-medium text-rose-600">
                          {!isCredit ? `₹${Number(row.amount).toLocaleString("en-IN")}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Balance:</span>
                        <span className="font-mono font-bold text-slate-900">
                          ₹{Number(row.balance || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {row.payment_mode || "Cash"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(row)}
                          className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center cursor-pointer"
                        >
                          Edit
                        </button>
                        {row.id === latestExpenseId && (
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredExpenses.length} entries</span>
            <span>All amounts formatted in INR (₹)</span>
          </div>
        </div>

        {/* Modal: Add Expense */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-xl border border-slate-200 w-full h-full sm:h-auto sm:max-w-lg max-h-screen sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Add Financial Entry
                    </h3>
                    <p className="text-xs text-slate-500">
                      Record an expense debit or cash credit
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Entry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={modalForm.rdate}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, rdate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Account Name
                    </label>
                    <select
                      required
                      value={modalForm.customerid}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          customerid: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Account</option>
                      {accountOptions.map((acc) => (
                        <option key={acc.id} value={String(acc.id)}>
                          {acc.customername}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Enter reason, item purchased, or purpose..."
                    value={modalForm.description}
                    onChange={(e) =>
                      setModalForm({
                        ...modalForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Entry Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm({
                            ...modalForm,
                            payment_type: "Debit",
                          })
                        }
                        className={`py-2 text-xs font-bold rounded-lg border transition ${
                          modalForm.payment_type === "Debit"
                            ? "bg-rose-50 border-rose-300 text-rose-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Debit (Outflow)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setModalForm({
                            ...modalForm,
                            payment_type: "Credit",
                          })
                        }
                        className={`py-2 text-xs font-bold rounded-lg border transition ${
                          modalForm.payment_type === "Credit"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Credit (Inflow)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      value={modalForm.payment_mode}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          payment_mode: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Gpay">Gpay</option>
                      <option value="Check">Check</option>
                      <option value="NEFT">NEFT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={modalForm.amount}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, amount: e.target.value })
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-xl text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm transition"
                  >
                    Save Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Expense (Strict rule from ExpenseController.php / index.blade.php) */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-xl border border-slate-200 w-full h-full sm:h-auto sm:max-w-lg max-h-screen sm:max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Edit Expense Entry #{editForm.id}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {editForm.isLatest
                        ? "Latest entry — full edit with balance reconciliation"
                        : "Historical entry — description edit only"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!editForm.isLatest ? (
                <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Balance Protection Rule:</strong> Because this is an earlier historical record, only the <strong>Description</strong> can be modified. Amount and payment types are locked to maintain running balance continuity.
                  </p>
                </div>
              ) : (
                <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-800">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong>Latest Entry:</strong> Changing the amount or type will automatically adjust the live closing balance.
                  </p>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Entry Date
                    </label>
                    <input
                      type="date"
                      disabled={!editForm.isLatest}
                      required
                      value={editForm.rdate}
                      onChange={(e) =>
                        setEditForm({ ...editForm, rdate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Account Name
                    </label>
                    <select
                      disabled={!editForm.isLatest}
                      required
                      value={editForm.customerid}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          customerid: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Account</option>
                      {accountOptions.map((acc) => (
                        <option key={acc.id} value={String(acc.id)}>
                          {acc.customername}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Description <span className="text-blue-600">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Enter updated description..."
                    value={editForm.description}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Entry Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!editForm.isLatest}
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            payment_type: "Debit",
                          })
                        }
                        className={`py-2 text-xs font-bold rounded-lg border transition ${
                          editForm.payment_type === "Debit"
                            ? "bg-rose-50 border-rose-300 text-rose-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Debit (Outflow)
                      </button>
                      <button
                        type="button"
                        disabled={!editForm.isLatest}
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            payment_type: "Credit",
                          })
                        }
                        className={`py-2 text-xs font-bold rounded-lg border transition ${
                          editForm.payment_type === "Credit"
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Credit (Inflow)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Payment Mode
                    </label>
                    <select
                      disabled={!editForm.isLatest}
                      value={editForm.payment_mode}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          payment_mode: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Gpay">Gpay</option>
                      <option value="Check">Check</option>
                      <option value="NEFT">NEFT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      disabled={!editForm.isLatest}
                      required
                      placeholder="0.00"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm({ ...editForm, amount: e.target.value })
                      }
                      className="w-full pl-8 pr-4 py-2.5 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-xl text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-sm shadow-sm transition"
                  >
                    Update Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
