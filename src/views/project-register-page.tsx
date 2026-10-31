"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Archive,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Wrench,
  Building2,
  Box,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { MouldTimelineDrawer } from "@/components/mould/mould-timeline-drawer";
import { ConfirmDialog } from "@/components/ui/dialog";
import { appStore } from "@/lib/state/store";
import { useAuth } from "@/components/providers/auth-provider";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";

export function ProjectRegisterPage() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const isAdminOrManager = currentUser?.role_id === 0 || currentUser?.role_id === 1;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("ALL");
  const [selectedWorkType, setSelectedWorkType] = useState("ALL");

  // Selected project for timeline drawer
  const [timelineProjectId, setTimelineProjectId] = useState<string | number | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // Reopen confirm dialog state
  const [reopenProject, setReopenProject] = useState<any | null>(null);
  const [isReopening, setIsReopening] = useState(false);

  // Fetch completed / registered projects
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["project_register_completed"],
    queryFn: async () => {
      const res = await fetch("/api/scanning?limit=1000");
      if (!res.ok) throw new Error("Failed to fetch project register");
      const json = await res.json();
      const allScans = json.scans || [];
      // Filter for completed or registered
      const completed = allScans.filter(
        (s: any) =>
          String(s.status).toLowerCase() === "completed" ||
          String(s.status).toLowerCase() === "registered"
      );
      return {
        scans: completed,
        customers: json.customers || [],
        users: json.users || [],
      };
    },
    staleTime: 30_000,
  });

  const projects = data?.scans || [];
  const customers = data?.customers || [];

  // Filtered list
  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      if (selectedCustomer !== "ALL" && String(p.customer_id || p.cname) !== selectedCustomer) {
        return false;
      }
      if (selectedWorkType !== "ALL" && p.worktype !== selectedWorkType) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const code = (p.projectid || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const cust = (p.customername || "").toLowerCase();
      return code.includes(q) || desc.includes(q) || cust.includes(q);
    });
  }, [projects, selectedCustomer, selectedWorkType, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalPlates = 0;
    let totalDispatchedPlates = 0;
    let totalDirectClosedPlates = 0;
    let totalMachiningHours = 0;

    for (const p of filteredProjects) {
      totalMachiningHours += Number(p.scan_hr || 0);
      const sublist = p.subplates || [];
      totalPlates += sublist.length;
      for (const sp of sublist) {
        if (sp.location === "Customer" || sp.dispatch_status === "dispatched") {
          totalDispatchedPlates++;
        } else if (sp.dispatch_status === "closed_without_challan") {
          totalDirectClosedPlates++;
        }
      }
    }

    return {
      completedMouldsCount: filteredProjects.length,
      totalMachiningHours: Math.round(totalMachiningHours * 10) / 10,
      totalPlates,
      totalDispatchedPlates,
      totalDirectClosedPlates,
    };
  }, [filteredProjects]);

  // Handler to open timeline drawer
  const handleOpenTimeline = (project: any) => {
    setTimelineProjectId(project.projectid || project.id);
    setIsTimelineOpen(true);
  };

  // Handler to reopen mould (move back to active pipeline)
  const handleConfirmReopen = async () => {
    if (!reopenProject) return;
    setIsReopening(true);
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reopenProject.id,
          field: "status",
          value: "pending",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reopen project");
      }

      appStore.addToast({
        type: "success",
        message: `Project ${reopenProject.projectid || reopenProject.id} reopened to Active Pipeline`,
      });

      queryClient.invalidateQueries({ queryKey: ["project_register_completed"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(["project_register_completed"]);
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
      setReopenProject(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error reopening project";
      appStore.addToast({ type: "error", message: msg });
    } finally {
      setIsReopening(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredProjects.length === 0) return;
    const headers = [
      "Project Code",
      "Customer",
      "Work Type",
      "Description",
      "Received Date",
      "Dispatch Date",
      "Total Plates",
      "Dispatched Plates",
      "Direct Closed Plates",
      "Machine Hours",
    ];

    const rows = filteredProjects.map((p: any) => {
      const sublist = p.subplates || [];
      const dispCount = sublist.filter((sp: any) => sp.location === "Customer" || sp.dispatch_status === "dispatched").length;
      const closedCount = sublist.filter((sp: any) => sp.dispatch_status === "closed_without_challan").length;
      return [
        `"${p.projectid || p.id}"`,
        `"${p.customername || ""}"`,
        `"${p.worktype || ""}"`,
        `"${(p.description || "").replace(/"/g, '""')}"`,
        `"${p.rdate || ""}"`,
        `"${p.dispatchdate || ""}"`,
        sublist.length,
        dispCount,
        closedCount,
        p.scan_hr || 0,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `project_register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Manufacturing Execution
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-semibold text-blue-600">Project Register</span>
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Completed Mould Register
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Permanent historical archive of finished moulds, component lifecycles, and audit records
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isMounted && isFetching}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isMounted && isFetching ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed Moulds</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {metrics.completedMouldsCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Permanently archived</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Machining</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Wrench className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              {metrics.totalMachiningHours} <span className="text-xs font-normal text-slate-500">hours</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Logged operator time</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Dispatched Plates</span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {metrics.totalDispatchedPlates} <span className="text-xs font-normal text-slate-400">/ {metrics.totalPlates}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Delivered via Challan</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Direct Closures</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2">
              {metrics.totalDirectClosedPlates} <span className="text-xs font-normal text-slate-500">plates</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Archived without Challan</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search mould code, customer, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 text-slate-700"
            >
              <option value="ALL">All Customers ({customers.length})</option>
              {customers.map((c: any) => (
                <option key={c.id} value={String(c.id)}>
                  {c.initials ? `[${c.initials}] ` : ""}{c.customername}
                </option>
              ))}
            </select>

            <select
              value={selectedWorkType}
              onChange={(e) => setSelectedWorkType(e.target.value)}
              className="text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500 text-slate-700"
            >
              <option value="ALL">All Work Types</option>
              <option value="Pulp">Pulp</option>
              <option value="TF">TF</option>
              <option value="Plastic">Plastic</option>
              <option value="Blow Moulding">Blow Moulding</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Data Grid */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Project Code</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Work Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-3">Received Dt</th>
                  <th className="py-3 px-3">Dispatched Dt</th>
                  <th className="py-3 px-3 text-center">Plates</th>
                  <th className="py-3 px-3 text-center">Dispatch Coverage</th>
                  <th className="py-3 px-3 text-center">Machining Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!isMounted || isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                      <span>Loading completed mould register...</span>
                    </td>
                  </tr>
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-400">
                      <Archive className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-600">No completed moulds found</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Completed moulds will automatically appear here once dispatched or closed.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p: any) => {
                    const sublist = p.subplates || [];
                    const totalCount = sublist.length;
                    const dispCount = sublist.filter((sp: any) => sp.location === "Customer" || sp.dispatch_status === "dispatched").length;
                    const closedCount = sublist.filter((sp: any) => sp.dispatch_status === "closed_without_challan").length;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-blue-50/30 transition-colors group cursor-pointer"
                        onClick={() => handleOpenTimeline(p)}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 group-hover:underline">
                          {p.projectid || `#${p.id}`}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-800">
                          {p.customer_initials && (
                            <span className="font-bold text-slate-900 mr-1">
                              [{p.customer_initials}]
                            </span>
                          )}
                          <span className="text-slate-600 truncate max-w-[140px] inline-block align-middle">
                            {p.customername}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {p.worktype || "Tooling"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 truncate max-w-xs">
                          {p.description || "—"}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono">
                          {p.rdate || "—"}
                        </td>
                        <td className="py-3 px-3 text-emerald-700 font-mono font-semibold">
                          {p.dispatchdate || "—"}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">
                          {totalCount}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {dispCount === totalCount && totalCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {totalCount}/{totalCount} Dispatched
                            </span>
                          ) : closedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              {dispCount}/{totalCount} Disp • {closedCount} Direct
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Direct Closed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-blue-600">
                          {p.scan_hr ? `${p.scan_hr} hr` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenTimeline(p)}
                              title="View Lifecycle Timeline & History Dossier"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            {isAdminOrManager && (
                              <button
                                type="button"
                                onClick={() => setReopenProject(p)}
                                title="Reopen Mould to Active Pipeline"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mould Lifecycle Timeline Drawer */}
        <MouldTimelineDrawer
          projectId={timelineProjectId}
          isOpen={isTimelineOpen}
          onClose={() => setIsTimelineOpen(false)}
        />

        {/* Reopen Confirmation Dialog */}
        <ConfirmDialog
          isOpen={!!reopenProject}
          title="Reopen Mould Project?"
          description={
            reopenProject ? (
              <span>
                Are you sure you want to reopen project{" "}
                <strong className="text-slate-900">
                  {reopenProject.projectid || `#${reopenProject.id}`}
                </strong>{" "}
                back into the Active Pipeline? This will switch its status from Completed to Active.
              </span>
            ) : null
          }
          confirmLabel="Reopen to Active"
          cancelLabel="Cancel"
          isLoading={isReopening}
          onConfirm={handleConfirmReopen}
          onClose={() => setReopenProject(null)}
        />
      </div>
    </AppLayout>
  );
}
