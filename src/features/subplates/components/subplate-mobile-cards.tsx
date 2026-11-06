"use client";

import { SubplateMobileStage } from "./subplate-mobile-stage";
import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import { Trash2, Pencil } from "lucide-react";
import { formatSubplateDimensions } from "@/lib/weight-calculator";

type Props = Pick<SubplatePageContext,
  | "expandedRows"
  | "countCompletedStages"
  | "toggleRow"
  | "handleSubplateContextMenu"
  | "getRowHighlightClass"
  | "canEditSubplate"
  | "handleOpenEditModal"
  | "canDeleteSubplate"
  | "handleDeleteSubplate"
  | "allowedStages"
  | "currentUser"
  | "activeStaff"
  | "handleOpenCreatePOForPlate"
  | "router"
  | "handleStageStaffChange"
  | "isAdmin"
> & {
  group: SubplatePageContext["paginatedMouldGroups"][number];
};

export function SubplateMobileCards({
  group,
  expandedRows,
  countCompletedStages,
  toggleRow,
  handleSubplateContextMenu,
  getRowHighlightClass,
  canEditSubplate,
  handleOpenEditModal,
  canDeleteSubplate,
  handleDeleteSubplate,
  allowedStages,
  currentUser,
  activeStaff,
  handleOpenCreatePOForPlate,
  router,
  handleStageStaffChange,
  isAdmin,
}: Props) {
  return (
    <div className="block md:hidden p-3 space-y-2.5">
      {group.plates.map((row) => {
        const isRowExpanded = Boolean(expandedRows[row.id]);
        const completedCount = countCompletedStages(row);

        return (
          <div
            key={row.id}
            id={`m-row-${row.id}`}
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
                return;
              }
              toggleRow(row.id);
            }}
            onContextMenu={(e) => handleSubplateContextMenu(e, row)}
            className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5 text-xs shadow-2xs transition-all duration-200 cursor-pointer ${getRowHighlightClass(row.id)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="font-mono text-slate-400 text-[11px] shrink-0">#{row.id}</span>
                <span className="font-bold text-slate-900 break-words leading-tight">{row.platename}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <SubplateJobworkLocationBadge subplate={row} size="sm" />
                {canEditSubplate && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(row)}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                    title="Edit subplate"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDeleteSubplate && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSubplate(row.id, row.platename)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                    title="Delete subplate"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
              <div>
                <span className="text-slate-400">Subproject: </span>
                <span className="font-mono font-medium text-slate-700 truncate block">
                  {row.subprojectid || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Material: </span>
                <span className="font-medium text-slate-700 block">
                  {row.material || "MS-Bright"}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Dimensions: </span>
                <span className="font-mono font-medium text-slate-700 block">
                  {formatSubplateDimensions(row)}
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
                className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition cursor-pointer"
              >
                {isRowExpanded ? "Hide Studio" : "Open Studio"}
              </button>
            </div>

            {/* Mobile Expanded Stepper */}
            {isRowExpanded && (
              <div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
                {allowedStages.map((stage) => (
                  <SubplateMobileStage key={stage.key} stage={stage}
                    row={row}
                    currentUser={currentUser}
                    activeStaff={activeStaff}
                    handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
                    router={router}
                    handleStageStaffChange={handleStageStaffChange}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
