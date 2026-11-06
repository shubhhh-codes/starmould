"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { SubplateMobileCards } from "@/features/subplates/components/subplate-mobile-cards";
import { SubplateDesktopTable } from "@/features/subplates/components/subplate-desktop-table";
import {
  Layers,
  Plus,
  Building2,
  ChevronDown,
} from "lucide-react";

type Props = Pick<SubplatePageContext,
  | "toggleMould"
  | "canCreateSubplate"
  | "handleOpenAddModal"
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
  isExpanded: boolean;
  percent: number;
};

export function SubplateMouldGroup({
  group,
  toggleMould,
  isExpanded,
  canCreateSubplate,
  handleOpenAddModal,
  percent,
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
    <div
      key={group.id}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-150"
    >
      {/* Mould Header Bar */}
      <div
        onClick={() => toggleMould(group.id)}
        className="bg-gradient-to-r from-slate-50/90 via-slate-50/70 to-white hover:bg-slate-100/70 border-b border-slate-200 cursor-pointer select-none transition-colors"
      >
        {/* Mobile Mould Header (< sm): Left-aligned, NO text cropping, fully structured */}
        <div className="block sm:hidden p-3.5 space-y-2.5">
          {/* Top Row: Chevron + Code + Worktype on Left, Status Pill on Right */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMould(group.id);
                }}
                className="p-1 -ml-1 text-slate-400 hover:text-blue-600 transition cursor-pointer shrink-0"
                title={isExpanded ? "Collapse mould group" : "Expand mould group"}
              >
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-0 text-blue-600" : "-rotate-90"
                    }`}
                />
              </button>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                {group.mouldCode}
              </span>
              {group.worktype && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  {group.worktype}
                </span>
              )}
            </div>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 whitespace-nowrap ${group.completedPlates === group.totalPlates && group.totalPlates > 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : group.completedPlates > 0
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
            >
              {group.completedPlates === group.totalPlates && group.totalPlates > 0
                ? "All Ready ✓"
                : `${group.completedPlates}/${group.totalPlates} Ready`}
            </span>
          </div>

          {/* Main Title & Customer: Full-width, NO crop, bold, properly left-aligned */}
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-sm leading-snug break-words">
              {group.mouldName || "Mould Project"}
            </h3>
            {group.customerName && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="break-words leading-tight">{group.customerName}</span>
              </div>
            )}
          </div>

          {/* Bottom Row: Subplates Count + Total Weight on Left, Add Plate Button on Right */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-700">
                {group.plates.length} {group.plates.length === 1 ? "Subplate" : "Subplates"}
              </span>
              {group.totalWeight > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>Total Wt: {group.totalWeight.toFixed(2)} kg</span>
                </>
              )}
            </div>

            {canCreateSubplate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const targetId = group.project?.id ? String(group.project.id) : (group.id !== "unassigned" ? group.id.replace("proj_", "") : "");
                  handleOpenAddModal(targetId);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Plate</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Mould Header (sm and above): Full ERP horizontal bar */}
        <div className="hidden sm:flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMould(group.id);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer shrink-0"
              title={isExpanded ? "Collapse mould group" : "Expand mould group"}
            >
              <ChevronDown
                className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-0 text-blue-600" : "-rotate-90"
                  }`}
              />
            </button>

            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60 shrink-0">
              <Layers className="w-4 h-4 text-blue-600" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/90 shrink-0">
                  {group.mouldCode}
                </span>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">
                  {group.mouldName || "Mould Project"}
                </h3>
                {group.worktype && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
                    {group.worktype}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                {group.customerName && (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{group.customerName}</span>
                  </span>
                )}
                {group.customerName && <span className="text-slate-300">•</span>}
                <span className="font-semibold text-slate-700 shrink-0">
                  {group.plates.length} {group.plates.length === 1 ? "Subplate" : "Subplates"}
                </span>
                {group.totalWeight > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="font-mono text-slate-600 font-medium whitespace-nowrap shrink-0">
                      Total Wt: {group.totalWeight.toFixed(2)} kg
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Progress Summary & Quick Add Subplate Action */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="text-right">
                <div className="font-bold text-slate-800 text-[11px]">
                  {group.completedPlates}/{group.totalPlates} Ready
                </div>
                <div className="text-[10px] text-slate-400">
                  {percent}% Complete
                </div>
              </div>
              <div className="w-20 sm:w-24 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300/60">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${group.completedPlates === group.totalPlates && group.totalPlates > 0
                    ? "bg-emerald-500"
                    : "bg-blue-600"
                    }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${group.completedPlates === group.totalPlates && group.totalPlates > 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : group.completedPlates > 0
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
              >
                {group.completedPlates === group.totalPlates && group.totalPlates > 0
                  ? "All Ready ✓"
                  : `${group.completedPlates}/${group.totalPlates} Ready`}
              </span>
            </div>

            {canCreateSubplate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const targetId = group.project?.id ? String(group.project.id) : (group.id !== "unassigned" ? group.id.replace("proj_", "") : "");
                  handleOpenAddModal(targetId);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
                title="Add a new subplate to this mould"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Plate</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Mould Subplates */}
      {isExpanded && (
        <div>
          {/* Desktop Subplates Table View */}
          <SubplateDesktopTable
            group={group}
            expandedRows={expandedRows}
            countCompletedStages={countCompletedStages}
            toggleRow={toggleRow}
            handleSubplateContextMenu={handleSubplateContextMenu}
            getRowHighlightClass={getRowHighlightClass}
            activeStaff={activeStaff}
            canEditSubplate={canEditSubplate}
            handleOpenEditModal={handleOpenEditModal}
            canDeleteSubplate={canDeleteSubplate}
            handleDeleteSubplate={handleDeleteSubplate}
            allowedStages={allowedStages}
            isAdmin={isAdmin}
            currentUser={currentUser}
            handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
            router={router}
            handleStageStaffChange={handleStageStaffChange}
            scans={scans}
          />

          {/* Mobile Subplates Card View */}
          <SubplateMobileCards
            group={group}
            expandedRows={expandedRows}
            countCompletedStages={countCompletedStages}
            toggleRow={toggleRow}
            handleSubplateContextMenu={handleSubplateContextMenu}
            getRowHighlightClass={getRowHighlightClass}
            canEditSubplate={canEditSubplate}
            handleOpenEditModal={handleOpenEditModal}
            canDeleteSubplate={canDeleteSubplate}
            handleDeleteSubplate={handleDeleteSubplate}
            allowedStages={allowedStages}
            currentUser={currentUser}
            activeStaff={activeStaff}
            handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
            router={router}
            handleStageStaffChange={handleStageStaffChange}
            isAdmin={isAdmin}
          />
        </div>
      )}
    </div>
  );
}
