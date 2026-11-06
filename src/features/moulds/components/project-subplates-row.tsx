"use client";

import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import React, { useMemo } from "react";
import {
  Eye,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  Loader2,
  Pencil,
} from "lucide-react";
import type { ScanProject, Subplate, User } from "@/lib/supabase/types";
import { calculateSubplateWeight, formatSubplateDimensions } from "@/lib/weight-calculator";
import { useSubplatesByProjectQuery } from "@/lib/query/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import { getSubplateProgressInfo } from "@/lib/subplate-stages";

export function ProjectSubplatesRow({
  project,
  columnsCount,
  staff = [],
  onAddPlate,
  onOpenView,
  onEditPlate,
  onDeletePlate,
  onSubplateContextMenu,
}: {
  project: ScanProject;
  columnsCount: number;
  staff?: User[];
  onAddPlate: (p: ScanProject) => void;
  onOpenView: (p: ScanProject) => void;
  onEditPlate: (sp: Subplate, p: ScanProject) => void;
  onDeletePlate: (id: number, projectId?: number) => void;
  onSubplateContextMenu?: (e: React.MouseEvent, sp: Subplate, p: ScanProject) => void;
}) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();
  const canCreateSubplate = hasPermission("action_create_subplate");
  const canEditPlate = hasPermission("action_edit_subplate");
  const canDeletePlate = hasPermission("action_delete_subplate");

  // 1. Instant 0ms Resolution: check if project already has subplates in memory
  const preloadedPlates = useMemo(() => {
    return Array.isArray(project.subplates) && project.subplates.length > 0 ? project.subplates : null;
  }, [project.subplates]);

  // 2. On-Demand Single Lean Query: ONLY triggers if plates are not already preloaded
  const targetId = project.id || project.projectid || undefined;
  const platesQuery = useSubplatesByProjectQuery(targetId, {
    enabled: !preloadedPlates,
  });

  const plates = preloadedPlates || platesQuery.data || [];
  const isLoading = !preloadedPlates && platesQuery.isLoading;
  const isError = !preloadedPlates && platesQuery.isError;

  return (
    <tr className="bg-slate-50/70 border-y border-blue-100/80 animate-in fade-in duration-150">
      <td colSpan={columnsCount} className="p-0">
        <div className="p-4 sm:p-5 bg-gradient-to-b from-blue-50/40 via-slate-50/60 to-white space-y-3.5 border-l-4 border-blue-600">
          {/* Header inside detail workbench */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    Subplate Register: {project.projectid || `#${project.id}`}
                  </h4>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700">
                    {plates.length} Plates Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {project.description} • {project.customername || project.cname || "Customer"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canCreateSubplate && (
                <button
                  type="button"
                  onClick={() => onAddPlate(project)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add Subplate</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenView(project)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Full Studio Modal</span>
              </button>
            </div>
          </div>

          {/* Subplates Table / Grid */}
          {isLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading subplate specifications...</span>
            </div>
          ) : isError ? (
            <div className="py-6 px-4 text-center rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
              <p className="text-xs text-rose-600 font-medium">
                Failed to load subplates for this project.
              </p>
              <button
                type="button"
                onClick={() => {
                  platesQuery.refetch();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : plates.length === 0 ? (
            <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-white/70 space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                No subplates have been defined for this mould project yet.
              </p>
              {canCreateSubplate && (
                <button
                  type="button"
                  onClick={() => onAddPlate(project)}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Subplate</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Plate Name</th>
                    <th className="py-2.5 px-3">Subproject ID</th>
                    <th className="py-2.5 px-3">Dimensions</th>
                    <th className="py-2.5 px-3">Material</th>
                    <th className="py-2.5 px-3 text-center">Location</th>
                    <th className="py-2.5 px-3 text-right">Calc Weight</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plates.map((sp) => {
                    const dim = formatSubplateDimensions({
                      shape: sp.shape || "Plate",
                      length: sp.length ?? undefined,
                      width: sp.width ?? undefined,
                      height: sp.height ?? undefined,
                      unit: sp.unit || "mm",
                    });
                    return (
                      <tr
                        key={sp.id}
                        onContextMenu={(e) => onSubplateContextMenu?.(e, sp, project)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        title="Right-click for options (Assign to Me)..."
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sp.platename}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-blue-700">
                          {sp.subprojectid || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {dim}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {sp.material || "MS-Bright"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <SubplateJobworkLocationBadge subplate={sp} size="sm" />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {(() => {
                            if (sp.weight && Number(sp.weight) > 0) {
                              return `${Number(sp.weight).toFixed(3)} kg`;
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
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {sp.sqty || 1}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const progress = getSubplateProgressInfo(sp, staff);
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border font-bold ${progress.badgeStyle}`}
                                title={progress.subtext}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${progress.dotColor}`} />
                                <span>{progress.badgeLabel}</span>
                                {progress.assignee && (
                                  <span className="font-mono text-[9px] opacity-80 font-normal ml-0.5">
                                    ({progress.assignee})
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditPlate && (
                              <button
                                type="button"
                                onClick={() => onEditPlate(sp, project)}
                                title="Edit Subplate"
                                className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDeletePlate && (
                              <button
                                type="button"
                                onClick={() => onDeletePlate(sp.id, project.id)}
                                title="Delete Subplate"
                                className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
