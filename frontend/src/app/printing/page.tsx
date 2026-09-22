"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Printer,
  Search,
  Plus,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  DollarSign,
  Shield,
  FileSpreadsheet,
  X,
  Scale,
  Send,
  Trash2,
  AlertCircle,
  Filter,
} from "lucide-react";
import type { PrintProject, Customer, User, GramCalc } from "@/lib/supabase/types";

// Dynamic Gram pricing calculation matching legacy PrintingController.php:170-183
// Authentic legacy query: where("lessthan", ">=", $gram)->where("graterthan", "<=", $gram)
// Authentic legacy formula: if ($fix != 0) { $amount = $fix; } else { $amount = $multiply * $gram; }
const calculateGramAmount = (
  grams: number,
  tiers: GramCalc[]
): { amount: number; matchedTier: GramCalc | null } => {
  if (!grams || grams <= 0 || tiers.length === 0) {
    return { amount: 0, matchedTier: null };
  }
  const matched = tiers.find(
    (t) => Number(t.lessthan) >= grams && Number(t.graterthan) <= grams
  );
  if (!matched) return { amount: 0, matchedTier: null };

  const fix = Number(matched.fix || 0);
  const multiply = Number(matched.multiply || 0);
  const amount = fix !== 0 ? fix : Math.round(multiply * grams);
  return { amount, matchedTier: matched };
};

export default function PrintingPage() {
  const [prints, setPrints] = useState<PrintProject[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [gramTiers, setGramTiers] = useState<GramCalc[]>([]);
  const [kpis, setKpis] = useState({
    totalPrints: 0,
    pendingPrints: 0,
    dispatchedPrints: 0,
    totalRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Role Toggle: Worker (Floor) vs Admin View (Merged PrintingController + PrintAdminController)
  const [viewMode, setViewMode] = useState<"worker" | "admin">("worker");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");

  // Add Print Job Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    cname: "",
    tdate: new Date().toISOString().split("T")[0],
    cdate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    gram: "",
    hr: "",
    customAmount: "",
    description: "",
  });

  const fetchPrints = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/printing");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load prints");
      setPrints(data.prints || []);
      setCustomers(data.customers || []);
      setUsers(data.users || []);
      setGramTiers(data.gramTiers || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch print projects");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPrints();
  }, []);

  // Filter active staff for assignment
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1");
  }, [users]);

  // Filtered prints
  const filteredPrints = useMemo(() => {
    return prints.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        p.projectid?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        String(p.cname)?.toLowerCase().includes(q) ||
        (p as any).customername?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL" || p.status === statusFilter;

      const matchCustomer =
        customerFilter === "ALL" || String(p.cname) === customerFilter;

      return matchQuery && matchStatus && matchCustomer;
    });
  }, [prints, searchQuery, statusFilter, customerFilter]);

  // Live price preview for modal form
  const previewAmount = useMemo(() => {
    const g = parseFloat(modalForm.gram) || 0;
    return calculateGramAmount(g, gramTiers);
  }, [modalForm.gram, gramTiers]);

  // KPIs
  const totalJobs = kpis.totalPrints || prints.length;
  const pendingJobs = kpis.pendingPrints || prints.filter((p) => p.status === "pending" || !p.status).length;
  const dispatchedJobs = kpis.dispatchedPrints || prints.filter((p) => Number(p.dispatch) === 1).length;
  const totalRevenue = kpis.totalRevenue || prints.reduce(
    (sum, p) => sum + Number(p.ramount > 0 ? p.ramount : p.amount || 0),
    0
  );

  // Handle Staff Assignment Change (Live API PATCH)
  const handleStaffChange = async (
    id: number,
    field: "print_by" | "qc_by",
    userId: number
  ) => {
    try {
      const res = await fetch("/api/printing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field, value: userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign staff");
      }
      setPrints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: userId } : p))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Dispatch Checkbox Toggle (Live API PATCH)
  const handleDispatchToggle = async (id: number) => {
    const target = prints.find((p) => p.id === id);
    if (!target) return;
    const nextDispatch = Number(target.dispatch) === 1 ? 0 : 1;
    const nextStatus = nextDispatch === 1 ? "registered" : "pending";

    try {
      const res = await fetch("/api/printing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          updates: { dispatch: nextDispatch, status: nextStatus },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update dispatch");
      }
      setPrints((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, dispatch: nextDispatch, status: nextStatus }
            : p
        )
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Admin Inline Real Amount Edit (Live API PATCH)
  const handleRamountChange = async (id: number, val: number) => {
    try {
      const res = await fetch("/api/printing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field: "ramount", value: val }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update received amount");
      }
      setPrints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ramount: val } : p))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Admin Payment Status Toggle (Live API PATCH)
  const handlePaymentToggle = async (id: number) => {
    const target = prints.find((p) => p.id === id);
    if (!target) return;
    const nextPayment = Number(target.payment) === 1 ? 0 : 1;

    try {
      const res = await fetch("/api/printing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field: "payment", value: nextPayment }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update payment");
      }
      setPrints((prev) =>
        prev.map((p) => (p.id === id ? { ...p, payment: nextPayment } : p))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Admin Delete Print Job (Live API DELETE)
  const handleDelete = async (id: number) => {
    if (window.confirm("Do you really want to delete this 3D print job?")) {
      try {
        const res = await fetch(`/api/printing?id=${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to delete print job");
        }
        setPrints((prev) => prev.filter((p) => p.id !== id));
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    }
  };

  // Handle Create Print Job (Live API POST)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.cname || !modalForm.description) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/printing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...modalForm,
          manualAmount: modalForm.customAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create print job");

      await fetchPrints();
      setIsModalOpen(false);
      setModalForm({
        cname: "",
        tdate: new Date().toISOString().split("T")[0],
        cdate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
        gram: "",
        hr: "",
        customAmount: "",
        description: "",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Project ID",
      "Customer",
      "Description",
      "Rec Date",
      "Commit Date",
      "Grams",
      "Hours",
      "Est Amount",
      "Actual Amount",
      "Payment",
      "Dispatch",
      "Status",
    ];
    const rows = filteredPrints.map((p) => [
      p.id,
      p.projectid,
      `"${p.cname}"`,
      `"${p.description}"`,
      p.tdate,
      p.cdate,
      p.gram,
      p.hr,
      p.amount,
      p.ramount,
      p.payment === 1 ? "Paid" : "Unpaid",
      p.dispatch === 1 ? "Dispatched" : "Pending",
      p.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Prints_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header with View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  3D Printing Job Manager
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    viewMode === "admin"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-teal-100 text-teal-800"
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  {viewMode === "admin" ? "Admin Controls" : "Floor / Worker View"}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Track resin prototyping, gram consumption, worker assignments, and dispatch status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("worker")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  viewMode === "worker"
                    ? "bg-white text-slate-900 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Floor View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("admin")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  viewMode === "admin"
                    ? "bg-white text-purple-700 shadow-sm font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Admin View
              </button>
            </div>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-sm text-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition shadow-sm shadow-teal-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Print Job
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Print Orders
              </p>
              <p className="text-2xl font-black text-slate-900">
                {totalJobs.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pending Execution
              </p>
              <p className="text-2xl font-black text-amber-600">
                {pendingJobs.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Dispatched
              </p>
              <p className="text-2xl font-black text-emerald-600">
                {dispatchedJobs.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Pipeline Value
              </p>
              <p className="text-2xl font-black text-slate-900">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* Gram Pricing Tiers Status Banner (Source: gram_calc) */}
        {gramTiers.length === 0 ? (
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-amber-900">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold flex items-center gap-2">
                  <span>Gram Pricing Master (`gram_calc`)</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/70 font-semibold text-amber-800">
                    0 Tiers Loaded (Empty Database)
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  No pricing tiers are configured yet in the database. New jobs will use manual pricing until tiers are added in the Gram module.
                </p>
              </div>
            </div>
            <a
              href="/gram"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs transition shadow-sm shrink-0"
            >
              Configure Gram Tiers in /gram →
            </a>
          </div>
        ) : (
          <div className="bg-teal-50/70 border border-teal-200/60 rounded-2xl p-4 text-xs text-teal-900">
            <div className="font-bold mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-teal-600" />
              <span>Active Gram Pricing Tiers (`gram_calc`):</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gramTiers.map((t) => (
                <span
                  key={t.id}
                  className="px-2.5 py-1 bg-white border border-teal-200 rounded-lg font-mono text-slate-700"
                >
                  {t.graterthan}g–{t.lessthan}g: {Number(t.fix) > 0 ? `₹${t.fix} Fixed` : `₹${t.multiply}/g`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 w-full flex-1 sm:w-auto sm:min-w-[300px]">
            <div className="relative flex-1 w-full sm:w-auto sm:min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search project ID, description, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="registered">Registered / Dispatched</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium max-w-xs truncate"
            >
              <option value="ALL">All Customers</option>
              {customers
                .filter((c) => c.usertype === "Customer")
                .map((c) => (
                  <option key={c.id} value={c.customername}>
                    {c.customername}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Project ID</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Rec. Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Committed Dt</th>
                  <th className="py-3.5 px-4 text-right">Grams</th>
                  <th className="py-3.5 px-4 text-right">Hours</th>
                  <th className="py-3.5 px-4">Print By</th>
                  <th className="py-3.5 px-4">QC By</th>
                  <th className="py-3.5 px-4 text-center">Dispatch</th>
                  {viewMode === "admin" && (
                    <>
                      <th className="py-3.5 px-4 text-center">Payment</th>
                      <th className="py-3.5 px-4 text-right">Actual (₹)</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrints.length === 0 ? (
                  <tr>
                    <td
                      colSpan={viewMode === "admin" ? 13 : 10}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No 3D print orders found.
                    </td>
                  </tr>
                ) : (
                  filteredPrints.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-xs text-teal-600 whitespace-nowrap">
                        {row.projectid || `#${row.id}`}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {row.cname}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {row.description || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                        {row.tdate || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                        {row.cdate || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 text-xs">
                        {row.gram}g
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-600">
                        {row.hr}h
                      </td>

                      {/* Print Operator Select */}
                      <td className="py-3 px-4">
                        <select
                          value={row.print_by || 0}
                          onChange={(e) =>
                            handleStaffChange(
                              row.id,
                              "print_by",
                              Number(e.target.value)
                            )
                          }
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-teal-500"
                        >
                          <option value={0}>Select</option>
                          {activeStaff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.initials || u.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* QC Officer Select */}
                      <td className="py-3 px-4">
                        <select
                          value={row.qc_by || 0}
                          onChange={(e) =>
                            handleStaffChange(
                              row.id,
                              "qc_by",
                              Number(e.target.value)
                            )
                          }
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-teal-500"
                        >
                          <option value={0}>Select</option>
                          {activeStaff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.initials || u.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Dispatch Checkbox (Source: PrintingController.php:117) */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={row.dispatch === 1}
                          onChange={() => handleDispatchToggle(row.id)}
                          className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer"
                        />
                      </td>

                      {/* Admin View Specific Columns */}
                      {viewMode === "admin" && (
                        <>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handlePaymentToggle(row.id)}
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition ${
                                row.payment === 1
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : "bg-rose-50 text-rose-700 border-rose-300"
                              }`}
                            >
                              {row.payment === 1 ? "Paid" : "Unpaid"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <span className="text-xs text-slate-400 font-bold">₹</span>
                              <input
                                type="number"
                                defaultValue={row.ramount || row.amount || 0}
                                onBlur={(e) =>
                                  handleRamountChange(
                                    row.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete print job"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {filteredPrints.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No 3D printing orders found.
              </div>
            ) : (
              filteredPrints.map((row) => (
                <div
                  key={row.id}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-teal-600">
                      {row.projectid || `#${row.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDispatchToggle(row.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        row.dispatch === 1
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {row.dispatch === 1 ? "Dispatched" : "Pending"}
                    </button>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {row.cname}
                    </span>
                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {row.description || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Grams / Hours:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {row.gram ?? 0}g / {row.hr ?? 0}h
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Dates:</span>
                      <span className="font-mono">
                        {row.tdate || "—"} → {row.cdate || "—"}
                      </span>
                    </div>
                  </div>

                  {viewMode === "admin" && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="font-mono font-bold text-slate-900">
                        ₹{(row.ramount || row.amount || 0).toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal: New Print Job */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-50 text-teal-600 rounded-lg">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Create 3D Print Order
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pricing auto-calculated via Gram rules (PrintingController.php:170)
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

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={modalForm.cname}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, cname: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select Customer</option>
                    {customers
                      .filter((c) => c.usertype === "Customer")
                      .map((c) => (
                        <option key={c.id} value={c.customername}>
                          {c.customername}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Received Date (tdate)
                    </label>
                    <input
                      type="date"
                      required
                      value={modalForm.tdate}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, tdate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Committed Date (cdate)
                    </label>
                    <input
                      type="date"
                      required
                      value={modalForm.cdate}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, cdate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Resin Weight (Grams) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        required
                        placeholder="e.g. 450"
                        value={modalForm.gram}
                        onChange={(e) =>
                          setModalForm({ ...modalForm, gram: e.target.value })
                        }
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        g
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Machine Time (Hours)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        placeholder="e.g. 8.5"
                        value={modalForm.hr}
                        onChange={(e) =>
                          setModalForm({ ...modalForm, hr: e.target.value })
                        }
                        className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gram Calculation Live Preview / Fallback Card */}
                {previewAmount.matchedTier ? (
                  <div className="p-4 bg-teal-50/70 border border-teal-200/60 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-teal-800 text-xs">
                      <Scale className="w-4 h-4 text-teal-600" />
                      <span>
                        Auto-calculated Price ({previewAmount.matchedTier.graterthan}g–{previewAmount.matchedTier.lessthan}g):
                      </span>
                    </div>
                    <span className="font-mono text-lg font-black text-teal-700">
                      ₹{previewAmount.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">
                          {gramTiers.length === 0
                            ? "No Gram Tiers Configured:"
                            : "No Matching Tier Found:"}
                        </span>{" "}
                        {gramTiers.length === 0
                          ? "Database gram_calc has 0 rows. Please specify the job amount manually, or configure tier rules in /gram."
                          : `No tier covers ${modalForm.gram || 0}g. Enter job amount manually below:`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Job Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        required={!previewAmount.matchedTier}
                        placeholder="e.g. 500"
                        value={modalForm.customAmount}
                        onChange={(e) =>
                          setModalForm({ ...modalForm, customAmount: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Job / Prototype Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter prototype details, cavity part name, or resin type..."
                    value={modalForm.description}
                    onChange={(e) =>
                      setModalForm({ ...modalForm, description: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
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
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-sm shadow-sm transition"
                  >
                    Create Print Order
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
