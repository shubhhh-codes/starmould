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
} from "lucide-react";
import rawSubplates from "@/lib/mock-subplates.json";
import rawScans from "@/lib/mock-scans.json";
import rawUsers from "@/lib/mock-users.json";
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

export default function SubplatePage() {
  const [subplates, setSubplates] = useState<Subplate[]>(
    rawSubplates as unknown as Subplate[]
  );
  const [scans] = useState<ScanProject[]>(rawScans as unknown as ScanProject[]);
  const [users] = useState<User[]>(rawUsers as unknown as User[]);

  const [searchQuery, setSearchQuery] = useState("");
  const [materialFilter, setMaterialFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");

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

      return matchQuery && matchMaterial && matchLocation && matchProject;
    });
  }, [subplates, searchQuery, materialFilter, locationFilter, projectFilter]);

  // KPI Calculations
  const totalCount = subplates.length;
  const inHouseCount = subplates.filter(
    (sp) => sp.location === "SM" || !sp.location
  ).length;
  const vendorCount = subplates.filter(
    (sp) => sp.location && sp.location !== "SM"
  ).length;
  const uniqueProjects = new Set(subplates.map((sp) => sp.projectid)).size;

  // Active staff
  const activeStaff = useMemo(() => {
    return users.filter((u) => Number(u.status) === 1);
  }, [users]);

  // Handle Create Subplate
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.platename || !modalForm.projectid) return;

    const newId = Math.max(...subplates.map((s) => s.id), 0) + 1;
    const subProjId =
      modalForm.subprojectid || `${modalForm.projectid}_${String(newId).padStart(3, "0")}`;

    const newPlate: Subplate = {
      id: newId,
      platename: modalForm.platename,
      projectid: String(modalForm.projectid),
      subprojectid: subProjId,
      shape: modalForm.shape,
      width: parseFloat(modalForm.width) || 0,
      height: parseFloat(modalForm.height) || 0,
      length: parseFloat(modalForm.length) || 0,
      weight: parseFloat(modalForm.weight) || 0,
      unit: modalForm.unit,
      material: modalForm.material,
      sqty: parseInt(modalForm.sqty, 10) || 1,
      location: modalForm.location || "SM",
      photo: null,
      design_by: null,
      order_by: null,
      received_workby: null,
      received_qcby: null,
      vmc_workby: null,
      vmc_qcby: null,
      drilltap_workby: null,
      final_qcby: null,
      packing_workby: null,
      packing_photo: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSubplates([newPlate, ...subplates]);
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
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[320px]">
            <div className="relative flex-1 min-w-[240px]">
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
          </div>
        </div>

        {/* Subplates Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4"># ID</th>
                  <th className="py-3.5 px-4">Plate Name</th>
                  <th className="py-3.5 px-4">Mould / Project</th>
                  <th className="py-3.5 px-4">Subproject ID</th>
                  <th className="py-3.5 px-4">Shape</th>
                  <th className="py-3.5 px-4">Dimensions (L × W × H)</th>
                  <th className="py-3.5 px-4">Material</th>
                  <th className="py-3.5 px-4 text-center">Qty</th>
                  <th className="py-3.5 px-4 text-center">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubplates.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="py-12 text-center text-slate-400 text-sm"
                    >
                      No subplates found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSubplates.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-slate-400">
                        #{row.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {row.platename}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-indigo-600">
                        {row.projectid || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">
                        {row.subprojectid || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {row.shape || "Plate"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                        {row.length || 0} × {row.width || 0} × {row.height || 0}{" "}
                        {row.unit || "mm"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/60">
                          {row.material || "MS-Bright"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {row.sqty || 1}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            row.location === "SM" || !row.location
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <MapPin className="w-3 h-3" />
                          {row.location || "SM"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>Showing {filteredSubplates.length} subplates</span>
            <span>All dimensions and material grades derived from factory inventory</span>
          </div>
        </div>

        {/* Modal: Add Subplate */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
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

              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-3 gap-3">
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

                <div className="grid grid-cols-4 gap-3">
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
