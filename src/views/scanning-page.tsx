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
  ChevronDown,
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
import { ERPSelect, type ERPSelectOption } from "@/components/ui/erp-select";
import { Modal, Drawer } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useIsRestoring } from "@tanstack/react-query";
import {
  useProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} from "@/lib/query/hooks";
import { formatSubplateDimensions } from "@/lib/weight-calculator";
import { NewMouldModal } from "@/components/mould/new-mould-modal";
import { MoldSubplatesInline } from "@/components/mould/mold-subplates-inline";
import { CreateSubplateModal } from "@/components/subplate/create-subplate-modal";

export function getWorkTypeBadgeStyle(worktype?: string | null): string {
  switch (worktype) {
    case "Pulp Mould":
      return "bg-blue-50 text-blue-700 border border-blue-200/80";
    case "TF":
      return "bg-amber-50 text-amber-700 border border-amber-200/80";
    case "Rework":
      return "bg-rose-50 text-rose-700 border border-rose-200/80";
    case "Accessories":
      return "bg-purple-50 text-purple-700 border border-purple-200/80";
    case "Machine part":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200/80";
    case "Other":
      return "bg-indigo-50 text-indigo-700 border border-indigo-200/80";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}

function ScanningPageContent() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();
  const canCreateProject = hasPermission("action_create_scanning_project");
  const canCreateSubplate = hasPermission("action_create_subplate");
  const canEditMould = hasPermission("action_edit_mould");
  const canDeleteMould = hasPermission("action_delete_mould");
  const canAdvanceStage = hasPermission("action_advance_pipeline");
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

  const [addSubplateProject, setAddSubplateProject] = useState<ScanProject | null>(null);
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [worktypeFilter, setWorktypeFilter] = useState("ALL");

  // Sync URL search query
  useEffect(() => {
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  // TanStack Query with Tier C Operational Caching & Prefetching
  const projectsQuery = useProjectsQuery({ pageSize: 500 });

  const createProjectMutation = useCreateProjectMutation();
  const updateProjectMutation = useUpdateProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();

  const scans = projectsQuery.data?.scans || [];
  const customers = (projectsQuery.data?.customers || []) as Customer[];

  const statusFilterOptions: ERPSelectOption[] = [
    { value: "ALL", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "registered", label: "Registered" },
    { value: "completed", label: "Completed" },
  ];

  const worktypeFilterOptions: ERPSelectOption[] = [
    { value: "ALL", label: "All Work Types" },
    { value: "Pulp Mould", label: "Pulp Mould" },
    { value: "TF", label: "TF" },
    { value: "Rework", label: "Rework" },
    { value: "Accessories", label: "Accessories" },
    { value: "Machine part", label: "Machine part" },
    { value: "Other", label: "Other" },
  ];

  const customerFilterOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: "All Customers" },
    ...customers
      .filter((c) => !c.deleted_at && c.usertype === "Customer")
      .map((c) => ({
        value: String(c.id),
        label: c.customername,
      })),
  ], [customers]);
  const users = (projectsQuery.data?.users || []) as User[];
  const kpis = projectsQuery.data?.kpis || {
    totalScans: 0,
    pendingScans: 0,
    missingScanner: 0,
    missingQC: 0,
    missingDesigner: 0,
    totalRevenue: 0,
  };

  const isRestoring = useIsRestoring();
  const hasLoadedData = scans.length > 0 || (projectsQuery.isSuccess && !projectsQuery.isFetching);
  const isLoading = isRestoring || (!hasLoadedData && (projectsQuery.isLoading || projectsQuery.isPending));
  const isFetching = projectsQuery.isFetching;
  const fetchError = projectsQuery.error ? (projectsQuery.error as Error).message : null;

  // Selected project for subplate drawer
  const [selectedProject, setSelectedProject] = useState<ScanProject | null>(null);

  // Expanded inline accordion states for each Mold
  const [expandedMolds, setExpandedMolds] = useState<Record<number, boolean>>({});

  const toggleExpandMold = (moldId: number) => {
    setExpandedMolds((prev) => ({
      ...prev,
      [moldId]: !prev[moldId],
    }));
  };

  // Add Project Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        s.customername?.toLowerCase().includes(q) ||
        s.worktype?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "ALL" || s.status === statusFilter;

      const selectedCust = customerFilter !== "ALL" ? customers.find((c) => String(c.id) === customerFilter) : null;
      const selectedCustName = selectedCust?.customername?.toLowerCase().trim();
      const matchCustomer =
        customerFilter === "ALL" ||
        (s.customer_id && String(s.customer_id) === customerFilter) ||
        String(s.cname) === customerFilter ||
        (selectedCustName && s.cname && String(s.cname).toLowerCase().trim() === selectedCustName) ||
        (selectedCustName && s.customername && String(s.customername).toLowerCase().trim() === selectedCustName);

      const matchWorktype =
        worktypeFilter === "ALL" || s.worktype === worktypeFilter;

      return matchQuery && matchStatus && matchCustomer && matchWorktype;
    });
  }, [scans, searchQuery, statusFilter, customerFilter, worktypeFilter]);

  // Pagination state & slice
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, customerFilter, worktypeFilter]);

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

  // Linked subplates for selected project
  const projectSubplates = useMemo<Subplate[]>(() => {
    if (!selectedProject) return [];
    return selectedProject.subplates || [];
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
                Track and manage new mould projects, scanning pipeline, inline subplates hierarchy, and completion status
              </p>
            </div>
          </div>

          {canCreateProject && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-sm shadow-blue-500/20 text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Mould Project
              </button>
            </div>
          )}
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

            <div className="w-36 min-w-0">
              <ERPSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(String(val))}
                options={statusFilterOptions}
                placeholder="Status"
                showSearch={false}
              />
            </div>

            <div className="w-40 min-w-0">
              <ERPSelect
                value={worktypeFilter}
                onChange={(val) => setWorktypeFilter(String(val))}
                options={worktypeFilterOptions}
                placeholder="Work Type"
                showSearch={false}
              />
            </div>

            <div className="w-56 min-w-0">
              <ERPSelect
                value={customerFilter}
                onChange={(val) => setCustomerFilter(String(val))}
                options={customerFilterOptions}
                placeholder="All Customers"
                searchPlaceholder="Search customers..."
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full custom-scrollbar">
            <table className="w-full min-w-[960px] text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="w-10 py-3.5 px-2 text-center"></th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Project ID</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Customer</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Work Type</th>
                  <th className="py-3.5 px-3.5">Description</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Rec. Date</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Target Date</th>
                  <th className="py-3.5 px-3 text-center whitespace-nowrap">Subplates / Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <TableSkeletonRows rows={8} columns={8} />
                ) : paginatedScans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No scanning projects found.
                    </td>
                  </tr>
                ) : (
                  paginatedScans.map((row) => {
                    const isExpanded = Boolean(expandedMolds[row.id]);
                    const completedPlates = row.completed_plates ?? 0;
                    const totalPlates = row.total_plates ?? (row.subplates?.length ?? 0);
                    const pct = row.completion_percentage ?? (totalPlates > 0 ? Math.round((completedPlates / totalPlates) * 100) : 0);
                    const isReady = totalPlates > 0 && completedPlates === totalPlates;

                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          id={`row-${row.id}`}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("button, a, input, select")) return;
                            toggleExpandMold(row.id);
                          }}
                          className={`hover:bg-slate-50/60 transition-all duration-300 group cursor-pointer select-none ${
                            isExpanded ? "bg-slate-50/80" : ""
                          } ${getRowHighlightClass(row.id)}`}
                        >
                          {/* Inline Accordion Expand Button */}
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleExpandMold(row.id)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                isExpanded
                                  ? "text-blue-600 bg-blue-100/80"
                                  : "text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              }`}
                              title={isExpanded ? "Collapse subplates" : "Expand subplates inline"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* Project ID */}
                          <td className="py-3 px-3 font-mono font-bold text-xs whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleExpandMold(row.id)}
                              className="text-blue-600 hover:underline hover:text-blue-700 cursor-pointer"
                              title="Click to toggle subplates"
                            >
                              {row.projectid || `#${row.id}`}
                            </button>
                          </td>

                          {/* Customer */}
                          <td className="py-3 px-3 font-medium text-slate-900 whitespace-nowrap">
                            {row.customername || `Client #${row.cname}`}
                          </td>

                          {/* Work Type */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${getWorkTypeBadgeStyle(
                                row.worktype
                              )}`}
                            >
                              {row.worktype || "Pulp Mould"}
                            </span>
                          </td>

                          {/* Description */}
                          <td className="py-3 px-3.5 text-slate-600 max-w-xs truncate" title={row.description}>
                            {row.description || "—"}
                          </td>

                          {/* Receive Date */}
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-xs">
                            {row.rdate || "—"}
                          </td>

                          {/* Completion / Target Date */}
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap text-xs">
                            {row.cdate || "—"}
                          </td>

                          {/* Subplates Progress & Actions */}
                          <td className="py-3 px-3.5">
                            <div className="flex items-center justify-between gap-3">
                              {/* Progress bar and plates count */}
                              <div className="flex flex-col gap-1 min-w-[105px]">
                                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                                  <span>
                                    {completedPlates}/{totalPlates} plates
                                  </span>
                                  <span className="font-bold text-slate-700">
                                    {pct}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      isReady ? "bg-emerald-500" : "bg-blue-600"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => toggleExpandMold(row.id)}
                                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                                    isExpanded
                                      ? "text-blue-600 bg-blue-100 font-bold"
                                      : "text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                  }`}
                                  title={isExpanded ? "Collapse inline subplates" : "Expand inline subplates"}
                                >
                                  <Layers className="w-4 h-4" />
                                </button>
                                {canCreateSubplate && (
                                  <button
                                    type="button"
                                    onClick={() => setAddSubplateProject(row)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                    title="Add Subplate to this mould"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                )}
                                {canDeleteMould && (
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
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Inline Expandable Subplates Accordion */}
                        {isExpanded && (
                          <tr key={`subplates-${row.id}`} className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={8} className="p-0">
                              <MoldSubplatesInline
                                project={row}
                                subplates={row.subplates || []}
                                onOpenDrawer={() => setSelectedProject(row)}
                                onAddSubplate={canCreateSubplate ? (proj) => setAddSubplateProject(proj) : undefined}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
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
              paginatedScans.map((row) => {
                const isExpanded = Boolean(expandedMolds[row.id]);
                const completedPlates = row.completed_plates ?? 0;
                const totalPlates = row.total_plates ?? (row.subplates?.length ?? 0);
                const pct = row.completion_percentage ?? (totalPlates > 0 ? Math.round((completedPlates / totalPlates) * 100) : 0);
                const isReady = totalPlates > 0 && completedPlates === totalPlates;

                return (
                  <div
                    key={row.id}
                    id={`m-row-${row.id}`}
                    className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs transition-all duration-300 ${getRowHighlightClass(row.id)}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-blue-600">
                          {row.projectid || `#${row.id}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${getWorkTypeBadgeStyle(
                            row.worktype
                          )}`}
                        >
                          {row.worktype || "Pulp Mould"}
                        </span>
                      </div>
                      {canDeleteMould && (
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
                      )}
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

                    {/* Mobile Progress Bar */}
                    <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">
                          {completedPlates}/{totalPlates} plates completed
                        </span>
                        <span className={`font-bold ${isReady ? "text-emerald-700" : "text-slate-700"}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isReady ? "bg-emerald-500" : "bg-blue-600"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => toggleExpandMold(row.id)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Layers className="w-4 h-4" />
                        {isExpanded ? "Hide Subplates" : "Inline Subplates"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedProject(row)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        Full Details
                      </button>
                    </div>

                    {/* Mobile Inline Subplates */}
                    {isExpanded && (
                      <div className="pt-2 border-t border-slate-200">
                        <MoldSubplatesInline
                          project={row}
                          subplates={row.subplates || []}
                          onOpenDrawer={() => setSelectedProject(row)}
                          onAddSubplate={canCreateSubplate ? (proj) => setAddSubplateProject(proj) : undefined}
                        />
                      </div>
                    )}
                  </div>
                );
              })
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
              <div className="flex items-center justify-between w-full pr-8">
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-mono">
                    {selectedProject.projectid} Subplates
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedProject.description}
                  </p>
                </div>
                {canCreateSubplate && (
                  <button
                    type="button"
                    onClick={() => setAddSubplateProject(selectedProject)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Subplate</span>
                  </button>
                )}
              </div>
            ) : undefined
          }
        >
          {selectedProject && (
            <div className="space-y-3">
              {projectSubplates.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">No subplates linked yet</p>
                  <p className="text-slate-400">
                    No subplates have been defined for this mould project yet.
                  </p>
                  {canCreateSubplate && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setAddSubplateProject(selectedProject)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add First Subplate</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                projectSubplates.map((sp) => {
                  const dims = formatSubplateDimensions(sp);
                  return (
                    <div
                      key={sp.id}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-800">
                            {sp.platename}
                          </span>
                          {sp.plate_category && (
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                              {sp.plate_category}
                            </span>
                          )}
                          {sp.shape && (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                              {sp.shape}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {sp.location || "SM"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700">{dims}</span>
                        <span>•</span>
                        <span>{sp.material || "MS-Bright"}</span>
                        <span>•</span>
                        <span>Qty: {sp.sqty || 1}</span>
                        {sp.weight ? (
                          <>
                            <span>•</span>
                            <span>{sp.weight} kg</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </Drawer>

        {/* Create Scanning Project Modal (NewMouldModal with Work Types & Searchable Customer Select) */}
        {canCreateProject && (
          <NewMouldModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => setIsModalOpen(false)}
            customers={customers}
          />
        )}

        {/* Add Subplate Modal */}
        <CreateSubplateModal
          isOpen={Boolean(addSubplateProject)}
          project={addSubplateProject}
          onClose={() => setAddSubplateProject(null)}
          onSuccess={() => {
            projectsQuery.refetch();
          }}
        />
      </div>
    </AppLayout>
  );
}

export function ScanningPage() {
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
