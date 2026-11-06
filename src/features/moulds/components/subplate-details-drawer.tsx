"use client";

import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import {
  Plus,
  Trash2,
  Layers,
  Loader2,
  Pencil,
} from "lucide-react";
import { Drawer } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { formatSubplateDimensions } from "@/lib/weight-calculator";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "viewProject"
  | "setViewProject"
  | "viewSubplates"
  | "canCreateSubplate"
  | "handleOpenAddPlate"
  | "isLoadingSubplates"
  | "handleSubplateContextMenu"
  | "canEditSubplate"
  | "handleOpenEditPlate"
  | "canDeleteSubplate"
  | "handleDeleteSubplate"
>;

export function SubplateDetailsDrawer({
  viewProject,
  setViewProject,
  viewSubplates,
  canCreateSubplate,
  handleOpenAddPlate,
  isLoadingSubplates,
  handleSubplateContextMenu,
  canEditSubplate,
  handleOpenEditPlate,
  canDeleteSubplate,
  handleDeleteSubplate,
}: Props) {
  return (
    <Drawer
      isOpen={Boolean(viewProject)}
      onClose={() => setViewProject(null)}
      width="2xl"
      title={
        viewProject ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-all font-mono font-bold text-slate-900">
              {viewProject.projectid || `Project #${viewProject.id}`}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${viewProject.status === "completed"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
                }`}
            >
              {viewProject.status}
            </span>
          </div>
        ) : undefined
      }
      description={
        viewProject
          ? `${viewProject.customername || viewProject.cname || "Customer"} • ${viewProject.description || "No description"
          }`
          : undefined
      }
    >
      {viewProject && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500">
              {viewSubplates.length} Subplates Linked
            </span>
            {canCreateSubplate && (
              <MotionButton
                variant="primary"
                size="xs"
                onClick={() => handleOpenAddPlate(viewProject)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subplate</span>
              </MotionButton>
            )}
          </div>

          {isLoadingSubplates ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading subplates...</span>
            </div>
          ) : viewSubplates.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">No subplates registered yet</p>
              <p className="text-slate-400 mt-1">
                Click &quot;Add Subplate&quot; above to attach plates to this mould project.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {viewSubplates.map((sp) => (
                <div
                  key={sp.id}
                  onContextMenu={(e) => handleSubplateContextMenu(e, sp, viewProject)}
                  className="min-w-0 p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex flex-col gap-3 text-xs cursor-pointer"
                  title="Right-click for options (Assign to Me)..."
                >
                  <div className="min-w-0 space-y-2">
                    <span className="block break-words font-bold text-slate-800 text-sm [overflow-wrap:anywhere]">
                      {sp.platename}
                    </span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {sp.subprojectid && (
                        <span className="max-w-full break-all font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {sp.subprojectid}
                        </span>
                      )}
                      <span className="max-w-full break-words text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {sp.material || "MS-Bright"}
                      </span>
                      <SubplateJobworkLocationBadge subplate={sp} size="sm" />
                    </div>
                    <div className="text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                      <span>
                        {formatSubplateDimensions(sp)}
                      </span>
                      <span>•</span>
                      <span>Qty: {sp.sqty || 1}</span>
                      {sp.weight ? (
                        <>
                          <span>•</span>
                          <span>{sp.weight} kg</span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                      <span
                        title="Design"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.design_by ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        DES
                      </span>
                      <span
                        title="Material Order"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.order_by ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        ORD
                      </span>
                      <span
                        title="Material Inward"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.received_workby ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        REC
                      </span>
                      <span
                        title="VMC Machining"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.vmc_workby ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        VMC
                      </span>
                      <span
                        title="Drill & Tap"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.drilltap_workby ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        D&T
                      </span>
                      <span
                        title="Final QC"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.final_qcby ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        FQC
                      </span>
                      <span
                        title="Packing"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sp.packing_workby ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-400"
                          }`}
                      >
                        PAK
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canEditSubplate && (
                        <button
                          onClick={() => handleOpenEditPlate(sp, viewProject)}
                          title="Edit Subplate"
                          className="btn-interactive p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteSubplate && (
                        <button
                          onClick={() => handleDeleteSubplate(sp.id, viewProject.id)}
                          title="Delete Subplate"
                          className="btn-interactive p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
