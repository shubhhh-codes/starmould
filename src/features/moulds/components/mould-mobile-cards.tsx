"use client";

import {
  Eye,
  History,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "table"
  | "showSkeleton"
  | "longPress"
  | "handleOpenView"
  | "isAdmin"
  | "setTimelineProjectId"
  | "setIsTimelineOpen"
  | "canCreateSubplate"
  | "handleOpenAddPlate"
  | "canCreatePurchase"
  | "handleCreatePO"
  | "canDeleteMould"
  | "handleDeleteSingleProject"
>;

export function MouldMobileCards({
  table,
  showSkeleton,
  longPress,
  handleOpenView,
  isAdmin,
  setTimelineProjectId,
  setIsTimelineOpen,
  canCreateSubplate,
  handleOpenAddPlate,
  canCreatePurchase,
  handleCreatePO,
  canDeleteMould,
  handleDeleteSingleProject,
}: Props) {
  return (
    <div className="block md:hidden p-3 space-y-3">
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-medium">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Hold card 0.5s for options</span>
        </span>
        <span className="text-slate-400 font-mono">
          {table.getRowModel().rows.length} moulds
        </span>
      </div>

      {showSkeleton ? (
        <div className="py-8 text-center text-slate-400 text-xs animate-pulse">Loading moulds...</div>
      ) : table.getRowModel().rows.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          No moulds or projects match the selected filter.
        </div>
      ) : (
        table.getRowModel().rows.map((row) => {
          const m = row.original;
          return (
            <div
              key={row.id}
              {...longPress.getHandlers(m)}
              className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-2.5 text-xs shadow-xs select-none active:scale-[0.98] transition-all touch-manipulation hover:border-blue-300 relative"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all font-mono font-bold text-blue-600">
                  {m.projectid}
                </span>
                <div className="flex items-center gap-1.5">
                  {canCreateSubplate && (
                    <button
                      onClick={() => handleOpenAddPlate(m)}
                      title="Add Subplate"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  )}
                  {canCreatePurchase && (
                    <button
                      onClick={() => handleCreatePO(m)}
                      title="Create PO"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-amber-600 cursor-pointer"
                    >
                      <ShoppingCart className="h-3 w-3" />
                    </button>
                  )}
                  {canDeleteMould && (
                    <button
                      onClick={() => handleDeleteSingleProject(m)}
                      title="Delete Mould"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="font-medium text-slate-800 line-clamp-2">
                {m.description || "No description"}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400">Customer: </span>
                  <span className="font-medium text-slate-700 truncate block">
                    {m.customername || m.cname || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Worktype: </span>
                  <span className="font-medium text-slate-700 block">
                    {m.worktype || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">R-Date: </span>
                  <span className="font-medium text-slate-700 block">
                    {m.rdate ? formatDate(m.rdate) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Plates: </span>
                  <span className="font-medium text-slate-700 block">
                    {m.total_plates ?? 0}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenView(m)}
                    title="View Subplates"
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 cursor-pointer"
                  >
                    <Eye className="h-4 w-4 shrink-0" />
                    <span>View Subplates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimelineProjectId(m.projectid || m.id);
                      setIsTimelineOpen(true);
                    }}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <History className="h-4 w-4 shrink-0" />
                    <span>History</span>
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
