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
import rawExpenses from "@/lib/mock-expenses.json";
import rawCustomers from "@/lib/mock-customers.json";
import type { Expense, Customer } from "@/lib/supabase/types";

export default function ExpensePage() {
  const [expenses, setExpenses] = useState<Expense[]>(rawExpenses as unknown as Expense[]);
  const [customers] = useState<Customer[]>(rawCustomers as unknown as Customer[]);

  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  // KPI Calculations (Source: ExpenseController.php:39-44)
  const totalCredit = useMemo(() => {
    return expenses
      .filter((e) => e.payment_type === "Credit")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const totalDebit = useMemo(() => {
    return expenses
      .filter((e) => e.payment_type === "Debit")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const currentBalance = useMemo(() => {
    // Current live balance is latest balance entry (Source: ExpenseController.php:44)
    if (expenses.length > 0) {
      return Number(expenses[0]?.balance ?? (totalCredit - totalDebit));
    }
    return totalCredit - totalDebit;
  }, [expenses, totalCredit, totalDebit]);

  const latestExpenseId = useMemo(() => {
    return expenses.length > 0 ? Math.max(...expenses.map((x) => x.id)) : 0;
  }, [expenses]);

  // Handle Add Expense Submit (Source: ExpenseController store)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.amount || !modalForm.customerid) return;

    const amt = parseFloat(modalForm.amount);
    const selectedAccount = customers.find(
      (c) => String(c.id) === modalForm.customerid
    );

    const newBalance =
      modalForm.payment_type === "Credit"
        ? currentBalance + amt
        : currentBalance - amt;

    const newEntry: Expense = {
      id: Math.max(...expenses.map((x) => x.id), 0) + 1,
      customerid: Number(modalForm.customerid),
      customername: selectedAccount?.customername || "General Account",
      description: modalForm.description,
      payment_mode: modalForm.payment_mode,
      payment_type: modalForm.payment_type,
      amount: amt,
      balance: newBalance,
      rdate: modalForm.rdate,
      created_at: new Date().toISOString(),
    };

    setExpenses([newEntry, ...expenses]);
    setIsModalOpen(false);
    setModalForm({
      rdate: new Date().toISOString().split("T")[0],
      customerid: "",
      description: "",
      payment_type: "Debit",
      payment_mode: "Cash",
      amount: "",
    });
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    if (!editForm.isLatest) {
      // Historical edit: Only description is updated (Source: ExpenseController.php / index.blade.php Editdata)
      setExpenses(
        expenses.map((item) =>
          item.id === editingExpense.id
            ? { ...item, description: editForm.description }
            : item
        )
      );
      setIsEditModalOpen(false);
      return;
    }

    // Latest entry edit: Full update & balance adjustment (Source: ExpenseController.php:467-481)
    const oldAmount = Number(editingExpense.amount || 0);
    const oldType = editingExpense.payment_type;
    const newAmt = parseFloat(editForm.amount) || 0;
    const newType = editForm.payment_type;
    let adjustedBalance = Number(editingExpense.balance || 0);

    if (oldType === "Credit" && newType === "Credit") {
      adjustedBalance = adjustedBalance - oldAmount + newAmt;
    } else if (oldType === "Credit" && newType === "Debit") {
      adjustedBalance = adjustedBalance - oldAmount - newAmt;
    } else if (oldType === "Debit" && newType === "Credit") {
      adjustedBalance = adjustedBalance + oldAmount + newAmt;
    } else if (oldType === "Debit" && newType === "Debit") {
      adjustedBalance = adjustedBalance + oldAmount - newAmt;
    }

    const selectedAccount = customers.find(
      (c) => String(c.id) === editForm.customerid
    );

    setExpenses(
      expenses.map((item) =>
        item.id === editingExpense.id
          ? {
              ...item,
              rdate: editForm.rdate,
              customerid: Number(editForm.customerid),
              customername: selectedAccount?.customername || item.customername,
              description: editForm.description,
              payment_type: newType,
              payment_mode: editForm.payment_mode,
              amount: newAmt,
              balance: adjustedBalance,
            }
          : item
      )
    );
    setIsEditModalOpen(false);
  };

  const handleDelete = (id: number) => {
    if (id !== latestExpenseId) {
      alert("Only the latest expense entry can be deleted to maintain balance integrity.");
      return;
    }
    if (window.confirm("Do you really want to delete this latest expense entry?")) {
      setExpenses(expenses.filter((e) => e.id !== id));
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
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Expense & Financial Register
              </h1>
              <p className="text-sm text-slate-500">
                Track credits, debits, cash drawer balances, and party accounts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-sm text-sm"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Closing Balance
              </p>
              <p
                className={`text-2xl font-black ${
                  currentBalance >= 0 ? "text-slate-900" : "text-rose-600"
                }`}
              >
                ₹{currentBalance.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Credit (Inflow)
              </p>
              <p className="text-2xl font-black text-emerald-600">
                ₹{totalCredit.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Debit (Outflow)
              </p>
              <p className="text-2xl font-black text-rose-600">
                ₹{totalDebit.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Entries Recorded
              </p>
              <p className="text-2xl font-black text-slate-900">
                {expenses.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
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
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.length === 0 ? (
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

          <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredExpenses.length} entries</span>
            <span>All amounts formatted in INR (₹)</span>
          </div>
        </div>

        {/* Modal: Add Expense */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
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
