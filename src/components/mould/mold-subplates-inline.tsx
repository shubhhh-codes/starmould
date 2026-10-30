"use client";

import React, { useState, useMemo } from "react";
import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import {
  Layers,
  Search,
  ExternalLink,
  MapPin,
  CheckCircle2,
  Clock,
  ChevronRight,
  PackageCheck,
  Tag,
  Boxes,
  Plus,
} from "lucide-react";
import type { Subplate, ScanProject } from "@/lib/supabase/types";
import { formatSubplateDimensions, calculateSubplateWeight } from "@/lib/weight-calculator";

interface MoldSubplatesInlineProps {
  project: ScanProject;
  subplates: Subplate[];
  onOpenDrawer?: () => void;
  onAddSubplate?: (project: ScanProject) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Core & Cavity Inserts": {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  "Base & Clamping Plates": {
    bg: "bg-slate-100",
    text: "text-slate-800",
    border: "border-slate-300",
  },
  "Ejection System": {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  "Slides & Lifters": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  "Guiding & Alignment": {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
  },
  "General Component": {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    border: "border-zinc-200",
  },
};

export function getSubplateCurrentStage(sp: Subplate): {
  step: number;
  name: string;
  badgeClass: string;
} {
  if (sp.packing_workby && Number(sp.packing_workby) > 0) {
    return {
      step: 9,
      name: "9. Packing Completed",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (sp.final_qcby && Number(sp.final_qcby) > 0) {
    return {
      step: 8,
      name: "8. Final QC",
      badgeClass: "bg-cyan-50 text-cyan-700 border-cyan-200",
    };
  }
  if (sp.drilltap_workby && Number(sp.drilltap_workby) > 0) {
    return {
      step: 7,
      name: "7. Drill & Tap",
      badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
    };
  }
  if (sp.vmc_qcby && Number(sp.vmc_qcby) > 0) {
    return {
      step: 6,
      name: "6. VMC QC",
      badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    };
  }
  if (sp.vmc_workby && Number(sp.vmc_workby) > 0) {
    return {
      step: 5,
      name: "5. VMC Work",
      badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
  }
  if (sp.received_qcby && Number(sp.received_qcby) > 0) {
    return {
      step: 4,
      name: "4. Programming",
      badgeClass: "bg-teal-50 text-teal-700 border-teal-200",
    };
  }
  if (sp.received_workby && Number(sp.received_workby) > 0) {
    return {
      step: 3,
      name: "3. Material Inward",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (sp.order_by && Number(sp.order_by) > 0) {
    return {
      step: 2,
      name: "2. Purchase",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  if (sp.design_by && Number(sp.design_by) > 0) {
    return {
      step: 1,
      name: "1. Design",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }
  return {
    step: 0,
    name: "0. Pending Design",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
  };
}

export function MoldSubplatesInline({
  project,
  subplates = [],
  onOpenDrawer,
  onAddSubplate,
}: MoldSubplatesInlineProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [subSearch, setSubSearch] = useState<string>("");

  // Calculate category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sp of subplates) {
      const cat = sp.plate_category || "General Component";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [subplates]);

  // Unique categories present in this mold's subplates
  const presentCategories = useMemo(() => {
    const defaultOrder = [
      "Core & Cavity Inserts",
      "Base & Clamping Plates",
      "Ejection System",
      "Slides & Lifters",
      "Guiding & Alignment",
      "General Component",
    ];
    return defaultOrder.filter((cat) => (categoryCounts[cat] || 0) > 0);
  }, [categoryCounts]);

  // Filter subplates
  const filteredSubplates = useMemo(() => {
    return subplates.filter((sp) => {
      const cat = sp.plate_category || "General Component";
      const matchesCategory =
        selectedCategory === "ALL" || cat === selectedCategory;

      const q = subSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        sp.platename.toLowerCase().includes(q) ||
        (sp.subprojectid && sp.subprojectid.toLowerCase().includes(q)) ||
        (sp.material && sp.material.toLowerCase().includes(q)) ||
        (sp.location && sp.location.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [subplates, selectedCategory, subSearch]);

  const completedCount = useMemo(() => {
    return subplates.filter(
      (sp) => sp.packing_workby && Number(sp.packing_workby) > 0
    ).length;
  }, [subplates]);

  const completionPct =
    subplates.length > 0
      ? Math.round((completedCount / subplates.length) * 100)
      : 0;

  return (
    <div className="bg-slate-50/90 border-y border-slate-200/90 px-4 py-4 sm:px-6 sm:py-5 space-y-4">
      {/* Mold Subplate Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm text-slate-900">
                {project.projectid || `#${project.id}`}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                • {project.description}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Total {subplates.length} plates ({completedCount} completed —{" "}
              {completionPct}%)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Real-time Progress Bar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Overall Progress:</span>
            <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  completionPct === 100 ? "bg-emerald-500" : "bg-blue-600"
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span
              className={`font-mono font-bold ${
                completionPct === 100 ? "text-emerald-700" : "text-slate-700"
              }`}
            >
              {completionPct}%
            </span>
          </div>

          {completionPct === 100 && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Ready for Dispatch
            </span>
          )}

          {onAddSubplate && (
            <button
              type="button"
              onClick={() => onAddSubplate(project)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Add new subplate to this mould"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subplate</span>
            </button>
          )}

          {onOpenDrawer && (
            <button
              type="button"
              onClick={onOpenDrawer}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Open full drawer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Drawer</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Pills & Quick Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
              selectedCategory === "ALL"
                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            All Plates ({subplates.length})
          </button>

          {presentCategories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const isSelected = selectedCategory === cat;
            const style = CATEGORY_STYLES[cat] || {
              bg: "bg-slate-50",
              text: "text-slate-700",
              border: "border-slate-200",
            };

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition border inline-flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : `${style.bg} ${style.text} ${style.border} hover:opacity-85`
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? "bg-white/20 text-white" : "bg-white/70"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Plate Search */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search plates..."
            value={subSearch}
            onChange={(e) => setSubSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Subplates Table */}
      {subplates.length === 0 ? (
        <div className="py-8 px-4 bg-white rounded-xl border border-dashed border-slate-300 text-center space-y-2.5 shadow-2xs">
          <Layers className="w-7 h-7 mx-auto text-slate-300 mb-1" />
          <p className="text-xs text-slate-600 font-medium">
            No subplates have been defined for this mould project yet.
          </p>
          {onAddSubplate && (
            <div>
              <button
                type="button"
                onClick={() => onAddSubplate(project)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add First Subplate</span>
              </button>
            </div>
          )}
        </div>
      ) : filteredSubplates.length === 0 ? (
        <div className="py-8 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
          <Layers className="w-6 h-6 mx-auto text-slate-300 mb-1.5" />
          <p className="font-medium">No subplates match the selected filter</p>
          <p className="text-slate-400 mt-0.5">
            Try switching category or clearing the search query.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Plate Name</th>
                  <th className="py-2.5 px-3">Plate Code</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Dimensions (L x W x H)</th>
                  <th className="py-2.5 px-3">Material</th>
                  <th className="py-2.5 px-3">Weight</th>
                  <th className="py-2.5 px-3">Qty</th>
                  <th className="py-2.5 px-3">Current Stage</th>
                  <th className="py-2.5 px-3">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubplates.map((sp, idx) => {
                  const dims = formatSubplateDimensions(sp);
                  const stage = getSubplateCurrentStage(sp);
                  const cat = sp.plate_category || "General Component";
                  const catStyle = CATEGORY_STYLES[cat] || {
                    bg: "bg-slate-50",
                    text: "text-slate-700",
                    border: "border-slate-200",
                  };
                  const isVendor = sp.location && sp.location !== "SM";

                  return (
                    <tr
                      key={sp.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {sp.platename}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-blue-600 font-medium whitespace-nowrap">
                        {sp.subprojectid || "—"}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                        >
                          {cat}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                        {dims}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {sp.material || "MS-Bright"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {(() => {
                        if (sp.weight && Number(sp.weight) > 0) {
                          return `${sp.weight} kg`;
                        }
                        const calc = calculateSubplateWeight({
                          shape: sp.shape || "Plate",
                          material: sp.material || "MS-Bright",
                          length: sp.length ?? undefined,
                          width: sp.width ?? undefined,
                          height: sp.height ?? undefined,
                          unit: sp.unit || "mm",
                          quantity: sp.sqty || 1,
                        });
                        return calc > 0 ? `${calc.toFixed(3)} kg` : "—";
                      })()}
                        </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {sp.sqty || 1}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-flex items-center gap-1 ${stage.badgeClass}`}
                        >
                          {stage.step === 9 ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          {stage.name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <SubplateJobworkLocationBadge subplate={sp} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
