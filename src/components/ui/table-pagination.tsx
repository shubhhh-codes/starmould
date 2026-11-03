"use client";

import React, { useEffect } from "react";

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  itemLabel?: string;
  subLabel?: React.ReactNode;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = false,
  itemLabel = "entries",
  subLabel,
  className = "",
}: TablePaginationProps) {
  // Validate and sanitize inputs against NaN, Infinity, negative values
  const safeTotalItems = Number.isFinite(totalItems) && totalItems > 0 ? Math.floor(totalItems) : 0;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 25;
  const totalPages = Math.max(1, Math.ceil(safeTotalItems / safePageSize));

  // Boundary correction: auto-clamp currentPage if dataset shrinks due to filtering
  useEffect(() => {
    if (!Number.isFinite(currentPage) || currentPage < 1) {
      onPageChange(1);
    } else if (currentPage > totalPages && totalPages > 0) {
      onPageChange(totalPages);
    }
  }, [currentPage, totalPages, onPageChange]);

  const safeCurrentPage = Number.isFinite(currentPage)
    ? Math.min(Math.max(1, Math.floor(currentPage)), totalPages)
    : 1;

  const startItem = safeTotalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize + 1;
  const endItem = Math.min(safeCurrentPage * safePageSize, safeTotalItems);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500 ${className}`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          Showing <span className="font-semibold text-slate-800">{startItem}</span> to{" "}
          <span className="font-semibold text-slate-800">{endItem}</span> of{" "}
          <span className="font-semibold text-slate-800">{safeTotalItems}</span> {itemLabel}
          {subLabel && <span className="ml-1 text-slate-400">{subLabel}</span>}
        </div>

        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-slate-400">Rows:</span>
            <select
              value={safePageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (Number.isFinite(newSize) && newSize > 0) {
                  onPageSizeChange(newSize);
                  onPageChange(1);
                }
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage <= 1}
          className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-700 cursor-pointer transition font-medium"
        >
          Previous
        </button>
        <span className="px-3 py-1 font-mono text-xs font-semibold text-slate-700">
          {safeCurrentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage >= totalPages}
          className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-700 cursor-pointer transition font-medium"
        >
          Next
        </button>
      </div>
    </div>
  );
}
