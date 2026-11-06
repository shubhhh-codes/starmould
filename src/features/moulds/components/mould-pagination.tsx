"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "table"
  | "filteredData"
>;

export function MouldPagination({
  table,
  filteredData,
}: Props) {
  return (
    <div className="p-3 px-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
      <div className="flex items-center gap-1.5">
        <span>Rows per page:</span>
        <select
          value={table.getState().pagination.pageSize}
          suppressHydrationWarning
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="px-2 py-1 rounded bg-white border border-slate-300 text-xs font-medium focus:outline-none"
        >
          {[10, 15, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="text-slate-400 ml-2">
          Showing {table.getRowModel().rows.length} of {filteredData.length} records
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-2 text-slate-700 font-semibold">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount() || 1}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          disabled={!table.getCanNextPage()}
          className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
