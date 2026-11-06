"use client";

import { SubplateStageCard } from "./subplate-stage-card";
import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import { Layers, Package, Sparkles } from "lucide-react";
import { STAGE_DEFINITIONS } from "@/lib/subplate-stages";
import type { Subplate } from "@/lib/supabase/types";

type Props = Pick<SubplatePageContext,
  | "allowedStages"
  | "isAdmin"
  | "currentUser"
  | "activeStaff"
  | "handleOpenCreatePOForPlate"
  | "router"
  | "handleStageStaffChange"
  | "scans"
> & {
  row: Subplate;
  completedCount: number;
};

export function SubplateStageStudio({
  allowedStages,
  row,
  isAdmin,
  completedCount,
  currentUser,
  activeStaff,
  handleOpenCreatePOForPlate,
  router,
  handleStageStaffChange,
  scans,
}: Props) {
  return (
    <tr className="bg-slate-50/90">
      <td colSpan={6} className="p-3 sm:p-4 border-y border-slate-200">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
          {/* Studio Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    {allowedStages.length === STAGE_DEFINITIONS.length
                      ? `9-Stage Production Tracking Studio for "${row.platename}"`
                      : `${allowedStages.map((s) => s.label.replace(/^\d+\.\s*/, "")).join(" & ")} Workstation for "${row.platename}"`}
                  </h4>
                  {allowedStages.length < STAGE_DEFINITIONS.length && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      Stage {allowedStages.map((s) => s.step).join(", ")} of 9
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAdmin
                    ? "Click any stage to assign or change staff. Timestamp is recorded automatically."
                    : "Review workpiece blueprint specifications and manage your active stage assignment."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <SubplateJobworkLocationBadge
                subplate={row}
                size="sm"
              />
              {isAdmin && (
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <span>Progress: {completedCount}/9 Completed</span>
                  <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300/60">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${(completedCount / 9) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Studio Main Body */}
          {(() => {
            const renderStageCard = (stage: (typeof STAGE_DEFINITIONS)[number], isRoleCard: boolean = false) => (
              <SubplateStageCard key={stage.key} stage={stage} isRoleCard={isRoleCard}
                row={row}
                currentUser={currentUser}
                activeStaff={activeStaff}
                handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
                router={router}
                handleStageStaffChange={handleStageStaffChange}
                isAdmin={isAdmin}
              />
            );

            {/* Non-Admin Focused Role Workstation: NO other departments' tasks or assign systems */ }
            if (allowedStages.length < STAGE_DEFINITIONS.length) {
              const currentMold = scans.find(
                (s) =>
                  String(s.id) === String(row.projectid) ||
                  String((s as any).mold_code) === String(row.mold_code) ||
                  String((s as any).projectid) === String(row.projectid)
              );
              const customerName = currentMold?.customername || currentMold?.cname || (row as any).customer_name || "";

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Left Column: Dedicated Role Action & Assignment Card */}
                  <div className={`space-y-3 ${allowedStages.length === 1 ? "lg:col-span-5 xl:col-span-4" : "lg:col-span-6 xl:col-span-5"}`}>
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="flex items-center gap-1.5 font-bold text-blue-700">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>Your Assigned Stage{allowedStages.length > 1 ? "s" : ""}</span>
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Active Department Task
                      </span>
                    </div>

                    <div className={`grid gap-3 ${allowedStages.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
                      {allowedStages.map((stage) => renderStageCard(stage, true))}
                    </div>

                    {/* Simple Next-Stage Handoff Note */}
                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs space-y-1">
                      <span className="font-bold text-blue-800 flex items-center gap-1.5 text-[11px]">
                        <span>&rarr; Downstream Handoff</span>
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Once your stage is complete, this plate will automatically transition to the subsequent manufacturing department.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Workpiece Engineering Blueprint & Technical Specifications */}
                  <div className={`${allowedStages.length === 1 ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-6 xl:col-span-7"} bg-slate-50/70 rounded-xl border border-slate-200/90 p-4 space-y-4 shadow-2xs flex flex-col justify-between`}>
                    <div className="space-y-3.5">
                      {/* Blueprint Title Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-700 shadow-2xs">
                            <Package className="w-4 h-4 text-slate-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {row.platename}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/80">
                                {row.subprojectid}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Engineering Workpiece Specifications
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
                          ID #{row.id}
                        </span>
                      </div>

                      {/* 4-Pill Specs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Dimensions</span>
                          <span className="font-bold text-slate-900 text-xs truncate block mt-0.5">
                            {row.length && row.width ? `${row.length} × ${row.width}${row.height ? ` × ${row.height}` : ""} mm` : "Custom Dimensions"}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Length × Width × Height</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Material</span>
                          <span className="font-bold text-amber-700 text-xs truncate block mt-0.5">
                            {row.material || "Unspecified"}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">{row.shape || "Plate Shape"}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Quantity</span>
                          <span className="font-bold text-slate-900 text-xs truncate block mt-0.5">
                            {row.sqty || 1} pc{(Number(row.sqty) || 1) > 1 ? "s" : ""}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Component Qty</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase block">Calculated Weight</span>
                          <span className="font-bold text-slate-900 text-xs truncate block font-mono mt-0.5">
                            {row.weight ? `${Number(row.weight).toFixed(3)} kg` : "—"}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Net Component Weight</span>
                        </div>
                      </div>
                    </div>

                    {/* Mould / Project Reference Banner */}
                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Mould Project</div>
                        <div className="font-bold text-slate-800 text-xs">{row.mold_code || row.projectid} {customerName ? `• ${customerName}` : ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Plate Category</div>
                        <div className="font-semibold text-slate-700 text-xs">{row.plate_category || "General Component"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            {/* Full 9-Stage Cards Grid (Admin / Manager Only) */ }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
                {STAGE_DEFINITIONS.map((stage) => renderStageCard(stage, false))}
              </div>
            );
          })()}
        </div>
      </td>
    </tr>
  );
}
