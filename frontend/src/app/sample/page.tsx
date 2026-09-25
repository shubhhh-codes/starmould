"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Sparkles,
  RotateCcw,
  Search,
  Plus,
  Calendar,
  Building2,
  UserCheck,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  X,
  Filter,
  Layers,
  ArrowRight,
  Trash2,
  Loader2,
} from "lucide-react";
import { KpiCardSkeleton, TableSkeletonRows } from "@/components/ui/skeleton";
import { StaffSelect } from "@/components/ui/staff-select";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { useSampleQuery, useCreateSampleMutation, useUpdateSampleMutation, useDeleteSampleMutation } from "@/lib/query/hooks";

export default function SampleReworkPage() {
  const { data, isLoading, error: fetchQueryError, refetch } = useSampleQuery();
  const createSampleMutation = useCreateSampleMutation();
  const updateSampleMutation = useUpdateSampleMutation();
  const deleteSampleMutation = useDeleteSampleMutation();

  const projects = data?.projects || [];
  const customers = data?.customers || [];
  const users = data?.users || [];
  const fetchError = fetchQueryError ? (fetchQueryError as Error).message : null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"Sample" | "Rework">("Sample");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    rdate: new Date().toISOString().split("T")[0],
    cdate: new Date().toISOString().split("T")[0],
    cname: "",
    description: "",
    worktype: "Sample" as "Sample" | "Rework",
    scan_by: "0",
    qc_by: "0",
    modeldesign_by: "0",
    amount: "0",
    note: "",
    subnote: "",
  });

  // Filtered by active tab (Sample vs Rework) (Source: SampleController.php:45, 37)
  const tabProjects = useMemo(() => {
    return projects.filter((p) => (p.worktype || "Sample") === activeTab);
  }, [projects, activeTab]);

  // Search & Filter
  const filteredProjects = useMemo(() => {
    return tabProjects.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        p.projectid?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.customername?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL" || p.status === statusFilter;

      const matchCustomer =
        customerFilter === "ALL" || String(p.cname) === customerFilter;

      return matchQuery && matchStatus && matchCustomer;
    });
  }, [tabProjects, searchQuery, statusFilter, customerFilter]);

  // KPI Calculations
  const totalCount = tabProjects.length;
  const pendingCount = tabProjects.filter((p) => p.status === "pending").length;
  const registeredCount = tabProjects.filter((p) => p.status === "registered").length;
  const completedCount = tabProjects.filter((p) => p.status === "completed").length;

  // Active workers for assignment (Source: SampleController.php:75, 93)
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [users]);

  // Handle Quick Status Change (Live API PATCH)
  const handleStatusChange = async (
    id: number,
    newStatus: "pending" | "registered" | "completed"
  ) => {
    try {
      await updateSampleMutation.mutateAsync({ id, field: "status", value: newStatus });
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
      await updateSampleMutation.mutateAsync({ id, field, value: userId });
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Delete Project (Live API DELETE)
  const handleDeleteProject = async (id: number, projectid?: string | null) => {
    if (!confirm(`Are you sure you want to delete ${activeTab} project "${projectid || `#${id}`}"?`)) {
      return;
    }
    try {
      await deleteSampleMutation.mutateAsync(id);
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Handle Add Form Submit (Live API POST)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.cname || !modalForm.description) return;

    try {
      setIsSubmitting(true);
      await createSampleMutation.mutateAsync(modalForm);
      setIsModalOpen(false);
      setModalForm({
        rdate: new Date().toISOString().split("T")[0],
        cdate: new Date().toISOString().split("T")[0],
        cname: "",
        description: "",
        worktype: activeTab,
        scan_by: "0",
        qc_by: "0",
        modeldesign_by: "0",
        amount: "0",
        note: "",
        subnote: "",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              {activeTab === "Sample" ? (
                <Sparkles className="w-7 h-7" />
              ) : (
                <RotateCcw className="w-7 h-7" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sample & Rework Tracking
              </h1>
              <p className="text-sm text-slate-500">
                Manage trial sample developments and client mould rework orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setModalForm({
                  ...modalForm,
                  worktype: activeTab,
                });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition shadow-sm shadow-purple-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add {activeTab} Order
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("Sample")}
            className={`flex items-center gap-2 px-6 py-3.5 font-bold text-sm border-b-2 transition ${
              activeTab === "Sample"
                ? "border-purple-600 text-purple-600 bg-purple-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Sample Projects (Trial Runs)
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
              {projects.filter((p) => (p.worktype || "Sample") === "Sample").length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("Rework")}
            className={`flex items-center gap-2 px-6 py-3.5 font-bold text-sm border-b-2 transition ${
              activeTab === "Rework"
                ? "border-purple-600 text-purple-600 bg-purple-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Rework Orders (Corrections)
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
              {projects.filter((p) => p.worktype === "Rework").length}
            </span>
          </button>
        </div>

        {/* KPI Cards */}
        {isLoading ? (
          <KpiCardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Total {activeTab} Orders
                </p>
                <p className="text-2xl font-black text-slate-900">{totalCount}</p>
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
                  {pendingCount}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Registered / In Progress
                </p>
                <p className="text-2xl font-black text-blue-600">
                  {registeredCount}
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Completed & Delivered
                </p>
                <p className="text-2xl font-black text-emerald-600">
                  {completedCount}
                </p>
              </div>
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
                placeholder="Search by project ID, description, customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
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
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full custom-scrollbar">
            <table className="w-full min-w-[1280px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-3.5 whitespace-nowrap">Mould Code</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap">Customer</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Work Type</th>
                  <th className="py-3.5 px-3.5">Description</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Rec. Date</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Committed Dt</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">SM Hr</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">USM Hr</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Scanner</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">QC By</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Model Design</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <TableSkeletonRows rows={8} columns={13} />
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No {activeTab.toLowerCase()} orders found.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-xs text-purple-600 whitespace-nowrap">
                        {row.projectid || `#${row.id}`}
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                        {row.customername || `Client #${row.cname}`}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/50">
                          {row.worktype || activeTab}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 max-w-xs truncate" title={row.description}>
                        {row.description || "—"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-xs">
                        {row.rdate || "—"}
                      </td>
                      <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-xs">
                        {row.cdate || "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {row.scan_hr ?? 0}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {row.model_hr ?? 0}
                      </td>

                      {/* Staff Assign: Scanner (Source: SampleController.php:74-88) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StaffSelect
                          value={row.scan_by}
                          onChange={(val) =>
                            handleStaffChange(row.id, "scan_by", val)
                          }
                          staff={activeStaff}
                          color="purple"
                          placeholder="Select"
                        />
                      </td>

                      {/* Staff Assign: QC (Source: SampleController.php:91-105) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StaffSelect
                          value={row.qc_by}
                          onChange={(val) =>
                            handleStaffChange(row.id, "qc_by", val)
                          }
                          staff={activeStaff}
                          color="purple"
                          placeholder="Select"
                        />
                      </td>

                      {/* Staff Assign: Model Design (Source: SampleController.php:109-123) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StaffSelect
                          value={row.modeldesign_by}
                          onChange={(val) =>
                            handleStaffChange(row.id, "modeldesign_by", val)
                          }
                          staff={activeStaff}
                          color="purple"
                          placeholder="Select"
                        />
                      </td>

                      {/* Status Selector */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={row.status}
                          onChange={(e) =>
                            handleStatusChange(
                              row.id,
                              e.target.value as any
                            )
                          }
                          className={`px-2 py-1 rounded-full text-xs font-semibold border ${
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
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(row.id, row.projectid)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete order"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {filteredProjects.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No {activeTab.toLowerCase()} orders found.
              </div>
            ) : (
              filteredProjects.map((row) => (
                <div
                  key={row.id}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-purple-600">
                        {row.projectid || `#${row.id}`}
                      </span>
                      <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200/50">
                        {row.worktype || activeTab}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={row.status}
                        onChange={(e) =>
                          handleStatusChange(
                            row.id,
                            e.target.value as any
                          )
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
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
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(row.id, row.projectid)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Delete order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {row.customername || `Client #${row.cname}`}
                    </span>
                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {row.description || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Dates:</span>
                      <span className="font-mono">
                        {row.rdate || "—"} → {row.cdate || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Hours (SM/USM):</span>
                      <span className="font-mono font-medium text-slate-800">
                        {row.scan_hr ?? 0}h / {row.model_hr ?? 0}h
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredProjects.length} {activeTab.toLowerCase()} orders</span>
            <span>All operations strictly synced with production work types</span>
          </div>
        </div>

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Create New ${modalForm.worktype} Order`}
          description="Record client sample development or mould rework"
          size="lg"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Order Type
                </label>
                <select
                  value={modalForm.worktype}
                  onChange={(e) =>
                    setModalForm({
                      ...modalForm,
                      worktype: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                >
                  <option value="Sample">Sample Order</option>
                  <option value="Rework">Rework Order</option>
                </select>
              </div>

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
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Order Description
              </label>
              <textarea
                required
                rows={2}
                placeholder="Describe sample component or rework requirements..."
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

            <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Delivery Date
                </label>
                <input
                  type="date"
                  required
                  value={modalForm.cdate}
                  onChange={(e) =>
                    setModalForm({ ...modalForm, cdate: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assign Scanner
                </label>
                <select
                  value={modalForm.scan_by}
                  onChange={(e) =>
                    setModalForm({
                      ...modalForm,
                      scan_by: e.target.value,
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="0">Unassigned</option>
                  {activeStaff.map((u) => (
                    <option
                      key={u.id}
                      value={String(u.id)}
                      title={`${u.name} (${u.initials || u.name}) ${
                        u.usertype ? `• ${u.usertype}` : ""
                      }`}
                    >
                      {u.initials ? `${u.initials} • ${u.name}` : u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assign QC
                </label>
                <select
                  value={modalForm.qc_by}
                  onChange={(e) =>
                    setModalForm({ ...modalForm, qc_by: e.target.value })
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="0">Unassigned</option>
                  {activeStaff.map((u) => (
                    <option
                      key={u.id}
                      value={String(u.id)}
                      title={`${u.name} (${u.initials || u.name}) ${
                        u.usertype ? `• ${u.usertype}` : ""
                      }`}
                    >
                      {u.initials ? `${u.initials} • ${u.name}` : u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Billed Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={modalForm.amount}
                  onChange={(e) =>
                    setModalForm({ ...modalForm, amount: e.target.value })
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-xl text-sm transition btn-interactive"
              >
                Cancel
              </button>
              <MotionButton
                type="submit"
                loading={isSubmitting}
                variant="primary"
                size="md"
              >
                Create Order
              </MotionButton>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
