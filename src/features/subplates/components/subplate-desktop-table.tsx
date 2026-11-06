"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { SubplateStageStudio } from "@/features/subplates/components/subplate-stage-studio";
import React from "react";
import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import {
  Trash2,
  ChevronRight,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { formatSubplateDimensions } from "@/lib/weight-calculator";
import { STAGE_DEFINITIONS, getSubplateProgressInfo } from "@/lib/subplate-stages";

type Props = Pick<SubplatePageContext,
  | "expandedRows"
  | "countCompletedStages"
  | "toggleRow"
  | "handleSubplateContextMenu"
  | "getRowHighlightClass"
  | "activeStaff"
  | "canEditSubplate"
  | "handleOpenEditModal"
  | "canDeleteSubplate"
  | "handleDeleteSubplate"
  | "allowedStages"
  | "isAdmin"
  | "currentUser"
  | "handleOpenCreatePOForPlate"
  | "router"
  | "handleStageStaffChange"
  | "scans"
> & {
  group: SubplatePageContext["paginatedMouldGroups"][number];
};

export function SubplateDesktopTable({
  group,
  expandedRows,
  countCompletedStages,
  toggleRow,
  handleSubplateContextMenu,
  getRowHighlightClass,
  activeStaff,
  canEditSubplate,
  handleOpenEditModal,
  canDeleteSubplate,
  handleDeleteSubplate,
  allowedStages,
  isAdmin,
  currentUser,
  handleOpenCreatePOForPlate,
  router,
  handleStageStaffChange,
  scans,
}: Props) {
  return (
    <div className="hidden md:block w-full overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50/60 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-2 w-8 text-center"></th>
            <th className="py-3 px-4 min-w-[210px]">Subplate Name</th>
            <th className="py-3 px-4 min-w-[200px]">Specs &amp; Material</th>
            <th className="py-3 px-2 text-center w-24">Location</th>
            <th className="py-3 px-4 min-w-[320px] w-full">Production Pipeline &amp; Status</th>
            <th className="py-3 px-3 text-right w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {group.plates.map((row) => {
            const isRowExpanded = Boolean(expandedRows[row.id]);
            const completedCount = countCompletedStages(row);

            return (
              <React.Fragment key={row.id}>
                {/* Main Subplate Row */}
                <tr
                  id={`row-${row.id}`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
                      return;
                    }
                    toggleRow(row.id);
                  }}
                  onContextMenu={(e) => handleSubplateContextMenu(e, row)}
                  className={`hover:bg-slate-50/90 transition-all duration-150 group cursor-pointer ${getRowHighlightClass(row.id)}`}
                  title="Click to expand Studio • Right-click for 'Assign to Me'"
                >
                  {/* Row Expand Toggle */}
                  <td className="py-3 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => toggleRow(row.id)}
                      className="p-1 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition cursor-pointer"
                      title={isRowExpanded ? "Hide stage studio" : "Expand stage studio"}
                    >
                      {isRowExpanded ? (
                        <ChevronDown className="w-4 h-4 text-cyan-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </td>

                  {/* Subplate Identification */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-[15px] leading-tight">
                        {row.platename}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
                        #{row.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {row.subprojectid ? (
                        <span className="font-mono text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 whitespace-nowrap">
                          {row.subprojectid}
                        </span>
                      ) : null}
                      {row.plate_category && (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/60 whitespace-nowrap">
                          {row.plate_category}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Specs, Dimensions & Material */}
                  <td className="py-3 px-4">
                    <div className="font-mono text-[14px] font-bold text-slate-900 whitespace-nowrap tracking-tight">
                      {formatSubplateDimensions(row)}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/90 whitespace-nowrap">
                        {row.material || "MS-Bright"}
                      </span>
                      <span className="text-slate-700 font-semibold whitespace-nowrap">
                        {row.sqty || 1} {Number(row.sqty) === 1 ? "pc" : "pcs"}
                      </span>
                      {row.shape && (
                        <span className="text-slate-400 text-xs whitespace-nowrap font-medium">
                          ({row.shape})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Location Badge */}
                  <td className="py-3 px-2 text-center whitespace-nowrap">
                    <SubplateJobworkLocationBadge subplate={row} size="sm" />
                  </td>

                  {/* Production Pipeline & Clean Status */}
                  <td className="py-3 px-4">
                    {(() => {
                      const progress = getSubplateProgressInfo(row, activeStaff);
                      return (
                        <div className="space-y-2">
                          {/* Status Header: Badge + Step count + Open Studio button */}
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                title={progress.subtext}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${progress.badgeStyle}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${progress.dotColor}`} />
                                <span>{progress.badgeLabel}</span>
                                {progress.assignee && (
                                  <span className="font-mono text-[10px] opacity-75 font-normal ml-0.5">
                                    ({progress.assignee})
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500">
                                {progress.completed}/9 Steps
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleRow(row.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${isRowExpanded
                                ? "bg-slate-200 text-slate-800 hover:bg-slate-300"
                                : "text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 font-bold"
                                }`}
                              title={isRowExpanded ? "Close stage studio" : "Open stage tracking studio"}
                            >
                              <span>{isRowExpanded ? "Hide Studio" : "Open Studio"}</span>
                              {isRowExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-700" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-blue-700" />
                              )}
                            </button>
                          </div>

                          {/* Sleek 9-Segment Micro-Stepper */}
                          <div className="flex items-center gap-1 w-full" title="Hover over a segment to see stage name">
                            {STAGE_DEFINITIONS.map((stage, idx) => {
                              const val = (row as any)[stage.key];
                              const isDone = Boolean(val && val !== 0);
                              const staffMember = activeStaff.find((u) => u.id === Number(val));
                              const name = (row as any)[stage.nameKey] || staffMember?.initials || staffMember?.name || "";
                              return (
                                <div
                                  key={stage.key}
                                  title={`Stage ${idx + 1}: ${stage.label.replace(/^\d+\.\s*/, "")}${isDone ? ` (Done: ${name || "Assigned"})` : " (Pending)"}`}
                                  className={`h-2 flex-1 rounded-sm transition-all cursor-pointer ${isDone
                                    ? "bg-blue-600 hover:bg-blue-700 shadow-2xs"
                                    : "bg-slate-200 hover:bg-slate-300"
                                    }`}
                                  onClick={() => toggleRow(row.id)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {canEditSubplate && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(row)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                          title="Edit subplate"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {canDeleteSubplate && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSubplate(row.id, row.platename)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete subplate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded 9-Stage Timeline Studio */}
                {isRowExpanded && (
                  <SubplateStageStudio
                    allowedStages={allowedStages}
                    row={row}
                    isAdmin={isAdmin}
                    completedCount={completedCount}
                    currentUser={currentUser}
                    activeStaff={activeStaff}
                    handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
                    router={router}
                    handleStageStaffChange={handleStageStaffChange}
                    scans={scans}
                  />
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
