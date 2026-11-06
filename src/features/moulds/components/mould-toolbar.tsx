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
}: Props) {
  return (
    <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/60 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
      {/* Left: Search Input & Filter Dropdowns */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 sm:flex-1">
        {/* Search Input */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            suppressHydrationWarning
            value={globalFilter ?? ""}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search in table..."
            className="w-full pl-8 pr-8 py-2 sm:py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
          />
          {globalFilter ? (
            <button
              type="button"
              onClick={() => setGlobalFilter("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear search (Esc)"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-block text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
              /
            </kbd>
          )}
        </div>

        {/* Filters: 2-column on mobile, inline on desktop */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Customer Dropdown */}
          <div className="w-full sm:w-48 min-w-0">
            <ERPSelect
              value={selectedCustomer}
              onChange={(val) => setSelectedCustomer(String(val))}
              options={dashboardCustomerOptions}
              placeholder="All Customers"
              searchPlaceholder="Search customer..."
            />
          </div>

          {/* Work Type Dropdown */}
          <div className="w-full sm:w-40 min-w-0">
            <ERPSelect
              value={selectedWorktype}
              onChange={(val) => setSelectedWorktype(String(val))}
              options={dashboardWorktypeOptions}
              placeholder="All Work Types"
              showSearch={false}
            />
          </div>
        </div>
      </div>

      {/* Right: Bulk Actions & Export Buttons */}
      <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t border-slate-200/60 sm:border-0">
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 shadow-2xs font-medium">
              <span className="font-semibold text-blue-900 whitespace-nowrap">
                {selectedCount} selected
              </span>
              <span className="text-blue-300">|</span>
              <button
                type="button"
                onClick={handleBatchMarkDone}
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                title="Mark selected moulds as completed (M or Ctrl+Enter)"
              >
                <CheckCircle2 className="h-3 w-3 inline" />
                <span>Mark Completed</span>
                <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-blue-700 text-white font-bold ml-0.5">
                  M
                </kbd>
              </button>
              {canDeleteMould && (
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  title="Delete selected moulds (Delete key)"
                >
                  <Trash2 className="h-3 w-3 inline text-rose-600" />
                  <span>Delete</span>
                  <kbd className="hidden sm:inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-rose-100 text-rose-700 font-bold border border-rose-200 ml-0.5">
                    Del
                  </kbd>
                </button>
              )}
              <button
                type="button"
                onClick={() => setRowSelection({})}
                className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-blue-100 rounded transition-colors ml-0.5 cursor-pointer"
                title="Deselect all (Esc)"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const headers = [
                "ID",
                "Project ID",
                "Customer",
                "Description",
                "Received Date",
                "Committed Date",
                "Plates",
                "Amount",
                "Payment",
              ];
              const rows = data.map((d) => [
                d.id,
                `"${d.projectid}"`,
                `"${d.customername}"`,
                `"${(d.description || "").replace(/"/g, '""')}"`,
                d.rdate,
                d.cdate,
                d.total_plates || 0,
                d.amount || 0,
                d.payment === 1 ? "Paid" : "Unpaid",
              ]);
              const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute("download", `Mould_Projects_${new Date().toISOString().split("T")[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Download Excel/CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => window.print()}
            className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Print / Save PDF"
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
