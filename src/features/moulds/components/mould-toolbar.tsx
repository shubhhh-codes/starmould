"use client";

import {
  Search,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  Trash2,
  X,
} from "lucide-react";
import { ERPSelect } from "@/components/ui/erp-select";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";
import { triggerFileExport } from "@/lib/exports/download";

type Props = Pick<
  MouldTableContext,
  | "searchInputRef"
  | "globalFilter"
  | "setGlobalFilter"
  | "selectedCustomer"
  | "setSelectedCustomer"
  | "dashboardCustomerOptions"
  | "selectedWorktype"
  | "setSelectedWorktype"
  | "dashboardWorktypeOptions"
  | "selectedCount"
  | "handleBatchMarkDone"
  | "canDeleteMould"
  | "handleBatchDelete"
  | "setRowSelection"
  | "data"
  | "table"
>;

export function MouldToolbar({
  searchInputRef,
  globalFilter,
  setGlobalFilter,
  selectedCustomer,
  setSelectedCustomer,
  dashboardCustomerOptions,
  selectedWorktype,
  setSelectedWorktype,
  dashboardWorktypeOptions,
  selectedCount,
  handleBatchMarkDone,
  canDeleteMould,
  handleBatchDelete,
  setRowSelection,
  data,
  table,
}: Props) {
  const handleExport = (format: "xlsx" | "pdf") => {
    const selectedRows = table ? table.getSelectedRowModel().rows : [];
    const isSelected = selectedRows.length > 0;

    triggerFileExport({
      dataset: "moulds",
      format,
      scope: isSelected ? "selected" : "filtered",
      selectedIds: isSelected ? selectedRows.map((r) => r.original.id) : undefined,
      filters: {
        customer: selectedCustomer,
        worktype: selectedWorktype,
      },
      search: globalFilter || undefined,
    });
  };

  return (
    <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
      {/* Left: Search input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          ref={searchInputRef}
          type="text"
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search mould code, customer, desc... (Ctrl+K)"
          className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder:text-slate-400 font-medium"
        />
        {globalFilter && (
          <button
            onClick={() => {
              setGlobalFilter("");
              searchInputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            title="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Middle & Right Filters & Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Customer select */}
        <div className="w-[180px]">
          <ERPSelect
            value={selectedCustomer}
            onChange={(val) => {
              setSelectedCustomer(val);
            }}
            options={dashboardCustomerOptions}
            placeholder="All Customers"
          />
        </div>

        {/* Worktype select */}
        <div className="w-[140px]">
          <ERPSelect
            value={selectedWorktype}
            onChange={(val) => {
              setSelectedWorktype(val);
            }}
            options={dashboardWorktypeOptions}
            placeholder="All Types"
          />
        </div>

        {/* Right: Bulk Actions & Export Buttons */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                {selectedCount} selected
              </span>

              <button
                onClick={handleBatchMarkDone}
                className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Mark selected as Completed"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark Completed</span>
              </button>

              {canDeleteMould && (
                <button
                  onClick={handleBatchDelete}
                  className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  title="Delete selected moulds"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}

              <button
                onClick={() => setRowSelection({})}
                className="h-8 flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                title="Deselect all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleExport("xlsx")}
            className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title={selectedCount > 0 ? `Export ${selectedCount} selected moulds to Excel (.xlsx)` : "Export filtered moulds to Excel (.xlsx)"}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title={selectedCount > 0 ? `Export ${selectedCount} selected moulds to PDF Report` : "Export filtered moulds to PDF Report"}
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
