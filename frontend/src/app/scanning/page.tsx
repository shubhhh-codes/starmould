"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  AlertTriangle,
  Layers,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  FileSpreadsheet,
  Eye,
  Filter,
  Trash2,
} from "lucide-react";
import type { ScanProject, Customer, User, Subplate } from "@/lib/supabase/types";
import { KpiCardSkeleton, TableSkeletonRows } from "@/components/ui/skeleton";
import { StaffSelect } from "@/components/ui/staff-select";
import { Modal, Drawer } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { useAuth } from "@/components/providers/auth-provider";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import {
  useProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} from "@/lib/query/hooks";

function ScanningPageContent() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");

  // Sync URL search query
  useEffect(() => {
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  // TanStack Query with Tier C Operational Caching & Prefetching
  const projectsQuery = useProjectsQuery({
    status: statusFilter,
    customer: customerFilter,
    search: searchQuery,
  });

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const scans = projectsQuery.data?.scans || [];
  const customers = (projectsQuery.data?.customers || []) as Customer[];
  const users = (projectsQuery.data?.users || []) as User[];
  const kpis = projectsQuery.data?.kpis || {
    totalScans: 0,
    pendingScans: 0,
    missingScanner: 0,
    missingQC: 0,
    missingDesigner: 0,
    totalRevenue: 0,
  };

  const isLoading = projectsQuery.isLoading;
  const isFetching = projectsQuery.isFetching;
  const fetchError = projectsQuery.error ? (projectsQuery.error as Error).message : null;

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

  const fetchScans = () => {
    projectsQuery.refetch();
  };

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

  // Pagination state & slice
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, customerFilter]);

  const totalPages = Math.ceil(filteredScans.length / pageSize) || 1;
  const paginatedScans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredScans.slice(start, start + pageSize);
  }, [filteredScans, currentPage, pageSize]);

  // Auto-scroll and highlight matching search row
  const { getRowHighlightClass } = useTableHighlight(filteredScans, pageSize, setCurrentPage);

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

  // Active staff
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [users]);

  // Handle Staff Assignment Change (Live API PATCH - changestatusscan)
  const handleStaffChange = async (
    id: number,
    field: "scan_by" | "qc_by" | "modeldesign_by",
    userId: number
  ) => {
    if (!isAdmin && userId !== 0 && currentUser?.id && Number(userId) !== Number(currentUser.id)) {
      alert("Permission denied: You can only assign tasks to yourself.");
      return;
    }
    try {
      await updateProjectMutation.mutateAsync({ id, field, value: userId });
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
      await createProjectMutation.mutateAsync(modalForm);
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
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Scan className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                New Mould List
              </h1>
              <p className="text-sm text-slate-500">
                Track and manage new mould projects, scanning pipeline, staff assignments, and production tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Mould Project
            </button>
          </div>
        </div>

        {/* Unassigned Work Alerts Banner */}
        {(missingScanner > 0 || missingQC > 0 || missingDesigner > 0) && (
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
        {isLoading ? (
          <KpiCardSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                .filter((c) => !c.deleted_at && c.usertype === "Customer")
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
            <table className="w-full min-w-[1260px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-3.5 whitespace-nowrap">Project ID</th>
                  <th className="py-3.5 px-3.5 whitespace-nowrap">Customer</th>
                  <th className="py-3.5 px-3.5">Description</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Rec. Date</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Target Date</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Scanner</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Designer</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">QC Officer</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">Subplates / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <TableSkeletonRows rows={8} columns={9} />
                ) : paginatedScans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No scanning projects found.
                    </td>
                  </tr>
                ) : (
                  paginatedScans.map((row) => (
                    <tr
                      key={row.id}
                      id={`row-${row.id}`}
                      className={`hover:bg-slate-50/60 transition-all duration-300 group ${getRowHighlightClass(row.id)}`}
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-xs text-blue-600 whitespace-nowrap">
                        {row.projectid || `#${row.id}`}
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-900 whitespace-nowrap">
                        {row.customername || `Client #${row.cname}`}
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

                      {/* Staff Assign: Scanner */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StaffSelect
                          value={row.scan_by}
                          onChange={(val) =>
                            handleStaffChange(row.id, "scan_by", val)
                          }
                          staff={activeStaff}
                          color="blue"
                          placeholder="Select"
                        />
                      </td>

                      {/* Staff Assign: Designer */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StaffSelect
                          value={row.modeldesign_by}
                          onChange={(val) =>
                            handleStaffChange(row.id, "modeldesign_by", val)
                          }
                          staff={activeStaff}
                          color="blue"
                          placeholder="Select"
                        />
                      </td>

                      {/* Staff Assign: QC Officer */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StaffSelect
                          value={row.qc_by}
                          onChange={(val) =>
                            handleStaffChange(row.id, "qc_by", val)
                          }
                          staff={activeStaff}
                          color="blue"
                          placeholder="Select"
                        />
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedProject(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View subplates"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete mould project "${row.projectid || `#${row.id}`}"? This will soft-delete the project.`)) return;
                              try {
                                await deleteProjectMutation.mutateAsync(row.id);
                              } catch (e: any) {
                                alert(e?.message || "Error deleting mould");
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete mould"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {!isLoading && filteredScans.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>per page • Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredScans.length)} of {filteredScans.length} moulds</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-slate-700">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Loading live moulds...</span>
              </div>
            ) : paginatedScans.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No scanning projects found.
              </div>
            ) : (
              paginatedScans.map((row) => (
                <div
                  key={row.id}
                  id={`m-row-${row.id}`}
                  className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs transition-all duration-300 ${getRowHighlightClass(row.id)}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-600">
                      {row.projectid || `#${row.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Delete mould project "${row.projectid || `#${row.id}`}"? This will soft-delete the project.`)) return;
                        try {
                          await deleteProjectMutation.mutateAsync(row.id);
                        } catch (e: any) {
                          alert(e?.message || "Error deleting mould");
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                      title="Delete mould"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-900 block">
                      {row.customername || `Customer #${row.cname}`}
                    </span>
                    <p className="text-[11px] text-slate-600 line-clamp-1">
                      {row.description || "—"}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Dates:</span>
                      <span className="font-mono">
                        {row.rdate || "—"} → {row.cdate || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                    <span className="text-slate-500 text-[11px]">
                      {row.total_plates ?? 0} subplates
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(row)}
                      className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Subplates Drawer (Physics-based slide-over) */}
        <Drawer
          isOpen={Boolean(selectedProject)}
          onClose={() => setSelectedProject(null)}
          width="xl"
          title={
            selectedProject ? (
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  {selectedProject.projectid} Subplates
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedProject.description}
                </p>
              </div>
            ) : undefined
          }
        >
          {selectedProject && (
            <div className="space-y-3">
              {projectSubplates.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">No subplates linked yet</p>
                  <p className="text-slate-400 mt-1">
                    Plates will appear here once attached to this project.
                  </p>
                </div>
              ) : (
                projectSubplates.map((sp) => (
                  <div
                    key={sp.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 hover:bg-white transition-colors"
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
          )}
        </Drawer>

        {/* Create Scanning Project Modal (Physics-based Spring Modal) */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          maxWidth="lg"
          title={
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Create New Mould Project
                </h3>
                <p className="text-xs text-slate-500">
                  Initialize new mould workpiece project and scanning pipeline
                </p>
              </div>
            </div>
          }
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all cursor-pointer"
                >
                  <option value="">Select Customer</option>
                  {customers
                    .filter((c) => !c.deleted_at && c.usertype === "Customer")
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.customername}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>

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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mould Description
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. 8 Cavity Cap Mould Top Core Plate..."
                value={modalForm.description}
                onChange={(e) =>
                  setModalForm({
                    ...modalForm,
                    description: e.target.value,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
              <MotionButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </MotionButton>
              <MotionButton
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                loadingText="Creating..."
                successText="Project Created!"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </MotionButton>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}

export default function ScanningPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6 space-y-4">
            <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
            <KpiCardSkeleton count={4} />
          </div>
        </AppLayout>
      }
    >
      <ScanningPageContent />
    </Suspense>
  );
}
