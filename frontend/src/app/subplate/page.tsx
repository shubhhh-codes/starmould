"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Layers,
  Search,
  Plus,
  Building2,
  MapPin,
  CheckCircle2,
  Clock,
  Compass,
  FileSpreadsheet,
  X,
  Filter,
  Package,
  Wrench,
  ShieldCheck,
  Tag,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCheck,
  CheckCheck,
} from "lucide-react";
import type { Subplate, ScanProject, User } from "@/lib/supabase/types";

// The 23 authentic materials extracted from resources/views/scanning/index.blade.php
const REAL_MATERIALS = [
  "Acralic",
  "Aluminium",
  "Brass",
  "C45",
  "Copper",
  "D-2",
  "Derlin",
  "EN8",
  "Gun Metal",
  "MS-Black",
  "MS-Bright",
  "Nylon",
  "O-ring",
  "Rubber",
  "Silver Bar",
  "Spring",
  "SS",
  "SS-202",
  "SS-304",
  "U-seal",
  "Wood",
  "Wooden Box",
  "WPS",
];

const SHAPES = ["Plate", "Round Bar"];

// 9 Production Stages configuration
export const STAGE_DEFINITIONS = [
  { key: "design_by", atKey: "design_at", nameKey: "design_by_name", short: "DES", label: "1. Design Order", step: 1, color: "blue" },
  { key: "order_by", atKey: "order_at", nameKey: "order_by_name", short: "ORD", label: "2. Mat. Order", step: 2, color: "amber" },
  { key: "received_workby", atKey: "received_work_at", nameKey: "received_workby_name", short: "REC", label: "3. Mat. Inward", step: 3, color: "emerald" },
  { key: "received_qcby", atKey: "received_qc_at", nameKey: "received_qcby_name", short: "RQC", label: "4. Inward QC", step: 4, color: "teal" },
  { key: "vmc_workby", atKey: "vmc_work_at", nameKey: "vmc_workby_name", short: "VMC", label: "5. VMC Work", step: 5, color: "indigo" },
  { key: "vmc_qcby", atKey: "vmc_qc_at", nameKey: "vmc_qcby_name", short: "VQC", label: "6. VMC QC", step: 6, color: "purple" },
  { key: "drilltap_workby", atKey: "drilltap_at", nameKey: "drilltap_workby_name", short: "D&T", label: "7. Drill & Tap", step: 7, color: "violet" },
  { key: "final_qcby", atKey: "final_qc_at", nameKey: "final_qcby_name", short: "FQC", label: "8. Final QC", step: 8, color: "cyan" },
  { key: "packing_workby", atKey: "packing_at", nameKey: "packing_workby_name", short: "PAK", label: "9. Packing", step: 9, color: "rose" },
] as const;

// Helper to format ISO timestamp to human-readable date/time
const formatTimestamp = (ts: string | null | undefined): string => {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
};

export default function SubplatePage() {
  const [subplates, setSubplates] = useState<Subplate[]>([]);
  const [scans, setScans] = useState<ScanProject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kpis, setKpis] = useState({
    totalCount: 0,
    inHouseCount: 0,
    vendorCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [materialFilter, setMaterialFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Modal State for Add / Edit Subplate
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    platename: "",
    projectid: "",
    subprojectid: "",
    shape: "Plate",
    width: "",
    height: "",
    length: "",
    weight: "",
    unit: "mm",
    material: "MS-Bright",
    sqty: "1",
    location: "SM",
  });

  const fetchSubplates = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/subplate");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load subplates");
      setSubplates(data.subplates || []);
      setScans(data.scans || []);
      setUsers(data.users || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setFetchError(err.message || "Failed to load subplates");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSubplates();
  }, []);

  // Toggle row expansion for detailed 9-stage stepper
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to count completed stages on a subplate
  const countCompletedStages = (sp: Subplate) => {
    let count = 0;
    if (sp.design_by) count++;
    if (sp.order_by) count++;
    if (sp.received_workby) count++;
    if (sp.received_qcby) count++;
    if (sp.vmc_workby) count++;
    if (sp.vmc_qcby) count++;
    if (sp.drilltap_workby) count++;
    if (sp.final_qcby) count++;
    if (sp.packing_workby) count++;
    return count;
  };

  // Active staff
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [users]);

  // Handle stage staff assignment change (Live API PATCH)
  const handleStageStaffChange = async (
    subplateId: number,
    field: string,
    userId: number
  ) => {
    const newUserId = userId === 0 ? null : userId;
    const now = newUserId ? new Date().toISOString() : null;
    const stageDef = STAGE_DEFINITIONS.find((s) => s.key === field);
    const atField = stageDef?.atKey;

    // Optimistic UI update
    setSubplates((prev) =>
      prev.map((sp) => {
        if (sp.id !== subplateId) return sp;
        const user = activeStaff.find((u) => u.id === newUserId);
        return {
          ...sp,
          [field]: newUserId,
          ...(atField ? { [atField]: now } : {}),
          ...(stageDef ? { [stageDef.nameKey]: user ? (user.name || user.initials) : "—" } : {}),
        };
      })
    );

    try {
      const res = await fetch("/api/subplate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subplateId,
          updates: {
            [field]: newUserId,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update stage assignment");
      }
    } catch (err: any) {
      alert("Stage Update Error: " + err.message);
      fetchSubplates();
    }
  };

  // Filter subplates
  const filteredSubplates = useMemo(() => {
    return subplates.filter((sp) => {
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !searchQuery ||
        sp.platename?.toLowerCase().includes(q) ||
        sp.subprojectid?.toLowerCase().includes(q) ||
        String(sp.projectid)?.toLowerCase().includes(q);

      const matchMaterial =
        materialFilter === "ALL" || sp.material === materialFilter;

      const matchLocation =
        locationFilter === "ALL" ||
        (locationFilter === "SM"
          ? sp.location === "SM" || !sp.location
          : sp.location !== "SM" && sp.location);

      const matchProject =
        projectFilter === "ALL" || String(sp.projectid) === projectFilter;

      let matchStage = true;
      if (stageFilter === "completed") {
        matchStage = countCompletedStages(sp) === 9;
      } else if (stageFilter === "pending") {
        matchStage = countCompletedStages(sp) < 9;
      } else if (stageFilter !== "ALL") {
        matchStage = Boolean((sp as any)[stageFilter]);
      }

      return matchQuery && matchMaterial && matchLocation && matchProject && matchStage;
    });
  }, [subplates, searchQuery, materialFilter, locationFilter, projectFilter, stageFilter]);

  const totalPages = Math.ceil(filteredSubplates.length / pageSize) || 1;
  const paginatedSubplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSubplates.slice(start, start + pageSize);
  }, [filteredSubplates, currentPage, pageSize]);

  // Handle Delete Subplate (Soft Delete)
  const handleDeleteSubplate = async (id: number, platename: string) => {
    if (!confirm(`Are you sure you want to delete subplate "${platename || `#${id}`}"? This will soft-delete the record.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/subplate?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete subplate");
      }
      setSubplates((prev) => prev.filter((sp) => sp.id !== id));
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // KPI Calculations
  const totalCount = kpis.totalCount || subplates.length;
  const inHouseCount = kpis.inHouseCount || subplates.filter(
    (sp) => sp.location === "SM" || !sp.location
  ).length;
  const vendorCount = kpis.vendorCount || subplates.filter(
    (sp) => sp.location && sp.location !== "SM"
  ).length;
  const uniqueProjects = new Set(subplates.map((sp) => sp.projectid)).size;

  // Handle Create Subplate (Live API POST)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.platename || !modalForm.projectid) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/subplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modalForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create subplate");

      await fetchSubplates();
      setIsModalOpen(false);
      setModalForm({
        platename: "",
        projectid: "",
        subprojectid: "",
        shape: "Plate",
        width: "",
        height: "",
        length: "",
        weight: "",
        unit: "mm",
        material: "MS-Bright",
        sqty: "1",
        location: "SM",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Plate Name",
      "Project ID",
      "Subproject ID",
      "Shape",
      "Dimensions (LxWxH)",
      "Material",
      "Qty",
      "Location",
    ];
    const rows = filteredSubplates.map((sp) => [
      sp.id,
      `"${sp.platename}"`,
      sp.projectid,
      sp.subprojectid || "",
      sp.shape || "Plate",
      `"${sp.length}x${sp.width}x${sp.height} ${sp.unit || "mm"}"`,
      sp.material || "",
      sp.sqty || 1,
      sp.location || "SM",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Subplates_${new Date().toISOString().split("T")[0]}.csv`);
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
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Subplate Master & Progression
              </h1>
              <p className="text-sm text-slate-500">
                Track workpiece dimensions, raw materials, location stages, and machining milestones
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
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl transition shadow-sm shadow-cyan-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Subplate
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Total Subplates
              </p>
              <p className="text-2xl font-black text-slate-900">
                {totalCount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                In-House (At Workshop 'SM')
              </p>
              <p className="text-2xl font-black text-emerald-600">
                {inHouseCount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                On Job Work (Vendor)
              </p>
              <p className="text-2xl font-black text-amber-600">
                {vendorCount.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Active Projects Linked
              </p>
              <p className="text-2xl font-black text-indigo-600">
                {uniqueProjects}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 w-full flex-1 sm:w-auto sm:min-w-[320px]">
            <div className="relative flex-1 w-full sm:w-auto sm:min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by plate name, subproject ID, project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
              />
            </div>

            {/* Material Selector */}
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
            >
              <option value="ALL">All Materials ({REAL_MATERIALS.length})</option>
              {REAL_MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Location Selector */}
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
            >
              <option value="ALL">All Locations</option>
              <option value="SM">In-House Only (SM)</option>
              <option value="VENDOR">At Vendor Only</option>
            </select>

            {/* 9-Stage Production Filter */}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
            >
              <option value="ALL">All Stages (9/9 Pipeline)</option>
              <option value="pending">In-Progress (&lt; 9 Stages Done)</option>
              <option value="completed">Completed (All 9 Stages Done)</option>
              <option value="design_by">1. Design Assigned</option>
              <option value="order_by">2. Mat. Order Assigned</option>
              <option value="received_workby">3. Mat. Inward Assigned</option>
              <option value="received_qcby">4. Inward QC Assigned</option>
              <option value="vmc_workby">5. VMC Machining Assigned</option>
              <option value="vmc_qcby">6. VMC QC Assigned</option>
              <option value="drilltap_workby">7. Drill &amp; Tap Assigned</option>
              <option value="final_qcby">8. Final QC Assigned</option>
              <option value="packing_workby">9. Packing Assigned</option>
            </select>
          </div>
        </div>

        {/* Subplates Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-3 w-10 text-center"></th>
                  <th className="py-3.5 px-3"># ID</th>
                  <th className="py-3.5 px-4">Plate Name</th>
                  <th className="py-3.5 px-3">Mould / Project</th>
                  <th className="py-3.5 px-3">Dimensions</th>
                  <th className="py-3.5 px-3">Material</th>
                  <th className="py-3.5 px-2 text-center">Qty</th>
                  <th className="py-3.5 px-3 text-center">Location</th>
                  <th className="py-3.5 px-4">9-Stage Production Tracking</th>
                  <th className="py-3.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-16 text-center text-slate-400 text-sm"
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
                        <span>Loading subplate master database records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSubplates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No subplates found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedSubplates.map((row) => {
                    const isExpanded = Boolean(expandedRows[row.id]);
                    const completedCount = countCompletedStages(row);

                    return (
                      <React.Fragment key={row.id}>
                        {/* Main Subplate Row */}
                        <tr className="hover:bg-slate-50/60 transition group">
                          {/* Row Expand Toggle */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleRow(row.id)}
                              className="p-1 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition cursor-pointer"
                              title="Toggle 9-Stage Details"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-cyan-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>

                          {/* ID */}
                          <td className="py-3 px-3 font-mono text-xs text-slate-400">
                            #{row.id}
                          </td>

                          {/* Plate Name */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{row.platename}</div>
                            {row.subprojectid && (
                              <div className="font-mono text-[10px] text-slate-400">
                                {row.subprojectid}
                              </div>
                            )}
                          </td>

                          {/* Mould Project */}
                          <td className="py-3 px-3">
                            <span className="font-mono text-xs text-indigo-600 font-semibold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                              {(row as any).mould_project_code || row.projectid || "—"}
                            </span>
                          </td>

                          {/* Dimensions */}
                          <td className="py-3 px-3 text-xs font-mono text-slate-700 whitespace-nowrap">
                            {row.length || 0} × {row.width || 0} × {row.height || 0}{" "}
                            {row.unit || "mm"}
                          </td>

                          {/* Material */}
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60 whitespace-nowrap">
                              {row.material || "MS-Bright"}
                            </span>
                          </td>

                          {/* Qty */}
                          <td className="py-3 px-2 text-center font-bold text-slate-800">
                            {row.sqty || 1}
                          </td>

                          {/* Location */}
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                row.location === "SM" || !row.location
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              <MapPin className="w-2.5 h-2.5" />
                              {row.location || "SM"}
                            </span>
                          </td>

                          {/* 9-Stage Production Tracking Column */}
                          <td className="py-3 px-4">
                            <div className="space-y-1.5 min-w-[340px]">
                              {/* Stage summary badge + Quick Expand */}
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    completedCount === 9
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                      : completedCount > 0
                                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                                      : "bg-slate-100 text-slate-600 border border-slate-200"
                                  }`}
                                >
                                  {completedCount === 9 ? (
                                    <CheckCheck className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Clock className="w-3 h-3 text-blue-600" />
                                  )}
                                  {completedCount}/9 Stages Assigned
                                </span>

                                <button
                                  type="button"
                                  onClick={() => toggleRow(row.id)}
                                  className="text-[11px] text-cyan-600 hover:text-cyan-800 font-medium hover:underline flex items-center gap-0.5"
                                >
                                  <span>{isExpanded ? "Hide Stages" : "Edit Stages"}</span>
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              {/* 9 Compact Stage Pills Chain */}
                              <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                                {STAGE_DEFINITIONS.map((stage) => {
                                  const val = (row as any)[stage.key];
                                  const name = (row as any)[stage.nameKey];
                                  const timestamp = (row as any)[stage.atKey];
                                  const isAssigned = Boolean(val && val !== 0);

                                  return (
                                    <div
                                      key={stage.key}
                                      className="relative group/pill"
                                      title={`${stage.label}: ${isAssigned ? `${name || "Assigned"} (${formatTimestamp(timestamp)})` : "Unassigned"}`}
                                    >
                                      <select
                                        value={val || 0}
                                        onChange={(e) =>
                                          handleStageStaffChange(
                                            row.id,
                                            stage.key,
                                            Number(e.target.value)
                                          )
                                        }
                                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition cursor-pointer appearance-none text-center ${
                                          isAssigned
                                            ? "bg-cyan-50 border-cyan-300 text-cyan-800 hover:bg-cyan-100 font-semibold"
                                            : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                                        }`}
                                      >
                                        <option value={0}>{stage.short}: —</option>
                                        {activeStaff.map((u) => (
                                          <option key={u.id} value={u.id}>
                                            {stage.short}: {u.initials || u.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleRow(row.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-cyan-600 bg-cyan-50 border border-cyan-200 rounded hover:bg-cyan-100 transition cursor-pointer"
                              >
                                {isExpanded ? "Close" : "Track"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubplate(row.id, row.platename)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete subplate"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded 9-Stage Timeline Stepper */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 dark:bg-slate-900/50">
                            <td colSpan={10} className="p-4 pl-12 border-y border-slate-200">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                                      <Layers className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-900">
                                        9-Stage Production Tracking for "{row.platename}"
                                      </h4>
                                      <p className="text-[11px] text-slate-500">
                                        Assign staff to each stage. Timestamp is automatically recorded on assignment.
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-slate-600">
                                      Progress: {completedCount}/9 Completed
                                    </span>
                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                      <div
                                        className="h-full bg-cyan-600 transition-all duration-300"
                                        style={{ width: `${(completedCount / 9) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* 9-Stage Cards Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2.5">
                                  {STAGE_DEFINITIONS.map((stage) => {
                                    const val = (row as any)[stage.key];
                                    const name = (row as any)[stage.nameKey];
                                    const timestamp = (row as any)[stage.atKey];
                                    const isAssigned = Boolean(val && val !== 0);

                                    return (
                                      <div
                                        key={stage.key}
                                        className={`p-2.5 rounded-xl border transition space-y-2 flex flex-col justify-between ${
                                          isAssigned
                                            ? "bg-cyan-50/50 border-cyan-200 shadow-2xs"
                                            : "bg-slate-50/60 border-slate-200"
                                        }`}
                                      >
                                        <div>
                                          {/* Step Header */}
                                          <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                              Stage {stage.step}
                                            </span>
                                            {isAssigned ? (
                                              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                                            ) : (
                                              <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                            )}
                                          </div>
                                          <div className="text-xs font-bold text-slate-800 leading-tight">
                                            {stage.label.replace(/^\d+\.\s*/, "")}
                                          </div>
                                        </div>

                                        {/* Staff Dropdown */}
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                                            Assigned Staff
                                          </label>
                                          <select
                                            value={val || 0}
                                            onChange={(e) =>
                                              handleStageStaffChange(
                                                row.id,
                                                stage.key,
                                                Number(e.target.value)
                                              )
                                            }
                                            className={`w-full px-2 py-1 text-xs rounded border transition focus:ring-1 focus:ring-cyan-500 cursor-pointer ${
                                              isAssigned
                                                ? "bg-white border-cyan-300 font-semibold text-slate-900"
                                                : "bg-white border-slate-200 text-slate-500"
                                            }`}
                                          >
                                            <option value={0}>Unassigned</option>
                                            {activeStaff.map((u) => (
                                              <option key={u.id} value={u.id}>
                                                {u.name || u.initials} ({u.initials})
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Timestamp Display */}
                                        <div className="pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                                          {isAssigned && timestamp ? (
                                            <div className="flex items-center gap-1 text-cyan-800 font-mono text-[9px]">
                                              <Clock className="w-2.5 h-2.5 shrink-0" />
                                              <span>{formatTimestamp(timestamp)}</span>
                                            </div>
                                          ) : isAssigned ? (
                                            <span className="text-cyan-700 text-[9px]">Assigned</span>
                                          ) : (
                                            <span className="text-slate-400 italic text-[9px]">Pending</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
                <span>Loading subplates...</span>
              </div>
            ) : filteredSubplates.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No subplates found matching your filter criteria.
              </div>
            ) : (
              paginatedSubplates.map((row) => {
                const isExpanded = Boolean(expandedRows[row.id]);
                const completedCount = countCompletedStages(row);

                return (
                  <div
                    key={row.id}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-400 text-[11px]">#{row.id}</span>
                        <span className="font-bold text-slate-900">{row.platename}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.location === "SM" || !row.location
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <MapPin className="w-2.5 h-2.5" />
                          {row.location || "SM"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubplate(row.id, row.platename)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Delete subplate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400">Project: </span>
                        <span className="font-mono font-medium text-indigo-600 truncate block">
                          {(row as any).mould_project_code || row.projectid || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Material: </span>
                        <span className="font-medium text-slate-700 block">
                          {row.material || "MS-Bright"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Dims: </span>
                        <span className="font-mono font-medium text-slate-700 block">
                          {row.length || 0}×{row.width || 0}×{row.height || 0} {row.unit || "mm"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Qty / Shape: </span>
                        <span className="font-medium text-slate-700 block">
                          {row.sqty || 1} ({row.shape || "Plate"})
                        </span>
                      </div>
                    </div>

                    {/* Mobile 9-Stage Progress Bar & Trigger */}
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700">
                        {completedCount}/9 Stages Done
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleRow(row.id)}
                        className="px-2.5 py-1 text-xs font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition"
                      >
                        {isExpanded ? "Hide Stages" : "Edit 9 Stages"}
                      </button>
                    </div>

                    {/* Mobile Expanded Stepper */}
                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                        {STAGE_DEFINITIONS.map((stage) => {
                          const val = (row as any)[stage.key];
                          const timestamp = (row as any)[stage.atKey];
                          const isAssigned = Boolean(val && val !== 0);

                          return (
                            <div
                              key={stage.key}
                              className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-slate-800 truncate">
                                  {stage.label}
                                </div>
                                {isAssigned && timestamp && (
                                  <div className="text-[9px] text-cyan-700 font-mono">
                                    {formatTimestamp(timestamp)}
                                  </div>
                                )}
                              </div>
                              <select
                                value={val || 0}
                                onChange={(e) =>
                                  handleStageStaffChange(
                                    row.id,
                                    stage.key,
                                    Number(e.target.value)
                                  )
                                }
                                className="px-2 py-1 text-xs rounded border border-slate-200 bg-slate-50 font-medium"
                              >
                                <option value={0}>Unassigned</option>
                                {activeStaff.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.initials || u.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {!isLoading && filteredSubplates.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-cyan-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>
                  per page • Showing {((currentPage - 1) * pageSize) + 1} to{" "}
                  {Math.min(currentPage * pageSize, filteredSubplates.length)} of {filteredSubplates.length} subplates
                </span>
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

          <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredSubplates.length} subplates</span>
            <span>All dimensions and material grades derived from factory inventory</span>
          </div>
        </div>

        {/* Modal: Add Subplate */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white sm:rounded-2xl shadow-xl border border-slate-200 w-full h-full sm:h-auto sm:max-w-lg overflow-y-auto max-h-screen sm:max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Add New Subplate
                    </h3>
                    <p className="text-xs text-slate-500">
                      Define workpiece specs and assign to mould project
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

              <form onSubmit={handleCreate} className="p-4 sm:p-6 space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Plate Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cavity Plate A"
                      value={modalForm.platename}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          platename: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mould / Project
                    </label>
                    <select
                      required
                      value={modalForm.projectid}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          projectid: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      <option value="">Select Project</option>
                      {scans.map((s) => (
                        <option key={s.id} value={s.projectid || String(s.id)}>
                          {s.projectid} - {s.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Shape
                    </label>
                    <select
                      value={modalForm.shape}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, shape: e.target.value })
                      }
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      {SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Material
                    </label>
                    <select
                      value={modalForm.material}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          material: e.target.value,
                        })
                      }
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    >
                      {REAL_MATERIALS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Quantity
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={modalForm.sqty}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, sqty: e.target.value })
                      }
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Length
                    </label>
                    <input
                      type="number"
                      placeholder="L (mm)"
                      value={modalForm.length}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, length: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Width
                    </label>
                    <input
                      type="number"
                      placeholder="W (mm)"
                      value={modalForm.width}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, width: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Height
                    </label>
                    <input
                      type="number"
                      placeholder="H (mm)"
                      value={modalForm.height}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, height: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Unit
                    </label>
                    <select
                      value={modalForm.unit}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, unit: e.target.value })
                      }
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                    >
                      <option value="mm">mm</option>
                      <option value="inch">inch</option>
                    </select>
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
                    className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-xl text-sm shadow-sm"
                  >
                    Save Subplate
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
