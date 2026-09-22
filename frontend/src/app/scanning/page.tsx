"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Scan,
  Search,
  Plus,
  Calendar,
  Building2,
  UserCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  Shield,
  Layers,
  ChevronRight,
  X,
  FileSpreadsheet,
  Eye,
  Filter,
} from "lucide-react";
import type { ScanProject, Customer, User, Subplate } from "@/lib/supabase/types";

export default function ScanningPage() {
  const [scans, setScans] = useState<ScanProject[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kpis, setKpis] = useState({
    totalScans: 0,
    pendingScans: 0,
    missingScanner: 0,
    missingQC: 0,
    missingDesigner: 0,
    totalRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Role Toggle: Worker vs Admin (Merged ScanningController + ScanAdminController)
  const [viewMode, setViewMode] = useState<"admin" | "worker">("admin");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");

  // Selected project for subplate drawer
  const [selectedProject, setSelectedProject] = useState<ScanProject | null>(null);

  // Add Project Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    rdate: new Date().toISOString().split("T")[0],
    cdate: new Date().toISOString().split("T")[0],
    cname: "",
    description: "",
    scan_by: "0",
    qc_by: "0",
    modeldesign_by: "0",
    amount: "0",
  });

  const fetchScans = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/scanning");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load scan projects");
      setScans(data.scans || []);
      setCustomers(data.customers || []);
      setUsers(data.users || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch scan projects");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchScans();
  }, []);

  // Filtered scans
  const filteredScans = useMemo(() => {
    return scans.filter((s) => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        s.projectid?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.cname?.toLowerCase().includes(q) ||
        s.customername?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL" || s.status === statusFilter;

      const matchCustomer =
        customerFilter === "ALL" || String(s.cname) === customerFilter;

      return matchQuery && matchStatus && matchCustomer;
    });
  }, [scans, searchQuery, statusFilter, customerFilter]);

  // KPI Calculations (Live DB KPIs & Filter-aware)
  const totalScans = kpis.totalScans || scans.length;
  const pendingScans = kpis.pendingScans || scans.filter((s) => s.status === "pending").length;
  const missingScanner = kpis.missingScanner || scans.filter(
    (s) => (s.scan_by === 0 || !s.scan_by) && s.status === "pending"
  ).length;
  const missingQC = kpis.missingQC || scans.filter(
    (s) => (s.qc_by === 0 || !s.qc_by) && s.status === "pending"
  ).length;
  const missingDesigner = kpis.missingDesigner || scans.filter(
    (s) => (s.modeldesign_by === 0 || !s.modeldesign_by) && s.status === "pending"
  ).length;
  const totalRevenue = kpis.totalRevenue || scans.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // Active staff
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1");
  }, [users]);

  // Handle Quick Payment Toggle (Admin Only) (Live API PATCH)
  const togglePayment = async (id: number) => {
    const current = scans.find((s) => s.id === id);
    if (!current) return;
    const newPayment = current.payment === 1 ? 0 : 1;
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field: "payment", value: newPayment }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update payment");
      }
      setScans((prev) =>
        prev.map((s) => (s.id === id ? { ...s, payment: newPayment } : s))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Quick Status Change (Live API PATCH)
  const handleStatusChange = async (
    id: number,
    newStatus: "pending" | "registered" | "completed"
  ) => {
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field: "status", value: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }
      setScans((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Staff Assignment Change (Live API PATCH - changestatusscan)
  const handleStaffChange = async (
    id: number,
    field: "scan_by" | "qc_by" | "modeldesign_by",
    userId: number
  ) => {
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field, value: userId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign staff");
      }
      setScans((prev) =>
        prev.map((s) => (s.id === id ? { ...s, [field]: userId } : s))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Inline Amount Update (Live API PATCH)
  const updateAmount = async (id: number, newAmount: number) => {
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field: "amount", value: newAmount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update amount");
      }
      setScans((prev) =>
        prev.map((s) => (s.id === id ? { ...s, amount: newAmount } : s))
      );
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Create Project Submit (Live API POST)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.cname || !modalForm.description) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/scanning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modalForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");

      await fetchScans();
      setIsModalOpen(false);
      setModalForm({
        rdate: new Date().toISOString().split("T")[0],
        cdate: new Date().toISOString().split("T")[0],
        cname: "",
        description: "",
        scan_by: "0",
        qc_by: "0",
        modeldesign_by: "0",
        amount: "0",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Linked subplates for selected project
  const projectSubplates = useMemo<Subplate[]>(() => {
    if (!selectedProject) return [];
    return (selectedProject as any).subplates || [];
  }, [selectedProject]);

  return (
    <AppLayout>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header with Merged Role-Based View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Scan className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Scanning & 3D Project Manager
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    viewMode === "admin"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  {viewMode === "admin" ? "Admin Controls" : "Worker View"}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Unified scanning pipeline, mould modeling, staff assignment, and billing status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("worker")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  viewMode === "worker"
                    ? "bg-white text-slate-900 shadow-sm"
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
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Scan Project
            </button>
          </div>
        </div>

        {/* Unassigned Work Alerts Banner (Admin Mode Only) */}
        {viewMode === "admin" && (missingScanner > 0 || missingQC > 0 || missingDesigner > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">
                  Pending Resource Allocations Detected
                </h4>
                <p className="text-xs text-amber-700">
                  {missingScanner} projects missing Scanner • {missingDesigner} missing Designer • {missingQC} missing QC Officer
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
              Attention Needed
            </span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Scan Projects
              </p>
              <p className="text-2xl font-black text-slate-900">
                {totalScans.toLocaleString()}
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
                {pendingScans.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Completed Moulds
              </p>
              <p className="text-2xl font-black text-emerald-600">
                {(totalScans - pendingScans).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Billed Pipeline
              </p>
              <p className="text-2xl font-black text-slate-900">
                ₹{totalRevenue.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search project ID, description, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="registered">Registered</option>
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
                  <option key={c.id} value={String(c.id)}>
                    {c.customername}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Project ID</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Rec. Date</th>
                  <th className="py-3.5 px-4">Target Date</th>
                  <th className="py-3.5 px-4">Scanner</th>
                  <th className="py-3.5 px-4">Designer</th>
                  <th className="py-3.5 px-4">QC Officer</th>
                  <th className="py-3.5 px-4">Status</th>
                  {viewMode === "admin" && (
                    <>
                      <th className="py-3.5 px-4 text-center">Payment</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                    </>
                  )}
                  <th className="py-3.5 px-4 text-center">Subplates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredScans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={viewMode === "admin" ? 12 : 10}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No scanning projects found.
                    </td>
                  </tr>
                ) : (
                  filteredScans.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-xs text-blue-600 whitespace-nowrap">
                        {row.projectid || `#${row.id}`}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {row.customername || `Client #${row.cname}`}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {row.description || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                        {row.rdate || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                        {row.cdate || "—"}
                      </td>

                      {/* Staff Assign: Scanner */}
                      <td className="py-3 px-4">
                        <select
                          value={row.scan_by || 0}
                          onChange={(e) =>
                            handleStaffChange(
                              row.id,
                              "scan_by",
                              Number(e.target.value)
                            )
                          }
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={0}>Select</option>
                          {activeStaff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.initials || u.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Staff Assign: Designer */}
                      <td className="py-3 px-4">
                        <select
                          value={row.modeldesign_by || 0}
                          onChange={(e) =>
                            handleStaffChange(
                              row.id,
                              "modeldesign_by",
                              Number(e.target.value)
                            )
                          }
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={0}>Select</option>
                          {activeStaff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.initials || u.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Staff Assign: QC Officer */}
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
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={0}>Select</option>
                          {activeStaff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.initials || u.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-4">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            handleStatusChange(
                              row.id,
                              e.target.value as any
                            )
                          }
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            row.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : row.status === "registered"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          <option value="pending">pending</option>
                          <option value="registered">registered</option>
                          <option value="completed">completed</option>
                        </select>
                      </td>

                      {/* Admin View Specific Columns */}
                      {viewMode === "admin" && (
                        <>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => togglePayment(row.id)}
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
                                defaultValue={row.amount || 0}
                                onBlur={(e) =>
                                  updateAmount(
                                    row.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </td>
                        </>
                      )}

                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedProject(row)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View subplates"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subplates Drawer */}
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-xl h-full shadow-2xl border-l border-slate-200 p-6 flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {selectedProject.projectid} Subplates
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedProject.description}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {projectSubplates.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    No subplates linked to this mould project yet.
                  </p>
                ) : (
                  projectSubplates.map((sp) => (
                    <div
                      key={sp.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-800">
                          {sp.platename}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {sp.location || "SM"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono">
                        {sp.length} × {sp.width} × {sp.height} {sp.unit} •{" "}
                        {sp.material} • Qty: {sp.sqty}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Create Scanning Project
                    </h3>
                    <p className="text-xs text-slate-500">
                      Initialize new mould workpiece scanning project
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Customer
                    </label>
                    <select
                      required
                      value={modalForm.cname}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, cname: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value="">Select Customer</option>
                      {customers
                        .filter((c) => c.usertype === "Customer")
                        .map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.customername}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Received Date
                    </label>
                    <input
                      type="date"
                      required
                      value={modalForm.rdate}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, rdate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mould Description
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="e.g. 8 Cavity Cap Mould Top Core Plate..."
                    value={modalForm.description}
                    onChange={(e) =>
                      setModalForm({
                        ...modalForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Target Date
                    </label>
                    <input
                      type="date"
                      required
                      value={modalForm.cdate}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, cdate: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Scanner Staff
                    </label>
                    <select
                      value={modalForm.scan_by}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, scan_by: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="0">Unassigned</option>
                      {activeStaff.map((u) => (
                        <option key={u.id} value={String(u.id)}>
                          {u.initials}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Billed (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={modalForm.amount}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, amount: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-sm"
                  >
                    Create Project
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
