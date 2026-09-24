"use client";

import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ScanProject } from "@/lib/supabase/types";

interface MouldProjectsTableProps {
  initialData?: ScanProject[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

const columnHelper = createColumnHelper<ScanProject>();

export function MouldProjectsTable({
  initialData = [],
  isLoading = false,
  onRefresh,
}: MouldProjectsTableProps) {
  const [data, setData] = useState<ScanProject[]>(initialData);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rdate", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("ALL");
  const [selectedWorktype, setSelectedWorktype] = useState<string>("ALL");
  const [rowSelection, setRowSelection] = useState({});

  // Sync when initialData changes
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Extract unique filters
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.customername) set.add(d.customername);
      else if (d.cname) set.add(d.cname);
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueWorktypes = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.worktype) set.add(d.worktype);
    });
    return Array.from(set).sort();
  }, [data]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (
        selectedCustomer !== "ALL" &&
        item.customername !== selectedCustomer &&
        item.cname !== selectedCustomer
      ) {
        return false;
      }
      if (selectedWorktype !== "ALL" && item.worktype !== selectedWorktype) {
        return false;
      }
      return true;
    });
  }, [data, selectedCustomer, selectedWorktype]);

  const columns = useMemo(
    () => [
      // Checkbox selection column for bulk actions
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
          />
        ),
      }),
      // Project Code / ID
      columnHelper.accessor("projectid", {
        header: "Project Code",
        cell: (info) => (
          <span className="font-mono font-semibold text-slate-800 text-[11px]">
            {info.getValue() || `P-${info.row.original.id}`}
          </span>
        ),
      }),
      // Received Date
      columnHelper.accessor("rdate", {
        header: "Received Dt",
        cell: (info) => (
          <span className="text-slate-600 text-xs font-medium">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      // Committed Date
      columnHelper.accessor("cdate", {
        header: "Committed Dt",
        cell: (info) => (
          <span className="text-slate-600 text-xs font-medium">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      // Customer Name
      columnHelper.accessor((row) => row.customername || row.cname, {
        id: "customer",
        header: "Customer",
        cell: (info) => (
          <div className="flex flex-col max-w-[180px]">
            <span className="font-semibold text-slate-900 text-xs truncate">
              {info.getValue() || "Unknown"}
            </span>
          </div>
        ),
      }),
      // Work Type
      columnHelper.accessor("worktype", {
        header: "Work Type",
        cell: (info) => {
          const val = info.getValue() || "Standard";
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
              {val}
            </span>
          );
        },
      }),
      // Description / Mould Name
      columnHelper.accessor("description", {
        header: "Mould / Part Name",
        cell: (info) => (
          <span className="font-medium text-slate-800 text-xs truncate max-w-[220px] block" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
      // Plates Progress / Subplate Counts
      columnHelper.display({
        id: "plates",
        header: "Plates Progress",
        cell: ({ row }) => {
          const completed = row.original.completed_plates || 0;
          const total = row.original.total_plates || 5;
          const percent = Math.min(100, Math.round((completed / (total || 1)) * 100));

          return (
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    percent === 100 ? "bg-emerald-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-600 min-w-[34px]">
                {completed}/{total}
              </span>
            </div>
          );
        },
      }),
      // Status Badge
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const status = info.getValue();
          let badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
          let icon = <Clock className="h-2.5 w-2.5" />;

          if (status === "completed") {
            badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
            icon = <CheckCircle2 className="h-2.5 w-2.5" />;
          } else if (status === "registered") {
            badgeClass = "bg-blue-50 text-blue-700 border-blue-200";
            icon = <AlertCircle className="h-2.5 w-2.5" />;
          }

          return (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}
            >
              {icon}
              <span className="capitalize">{status}</span>
            </span>
          );
        },
      }),
      // Row Actions
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <button
              title="View Subplates"
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              title="Add Subplate"
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={async () => {
                const item = row.original;
                if (!confirm(`Delete mould project "${item.projectid || `#${item.id}`}"?`)) return;
                try {
                  const res = await fetch(`/api/scanning?id=${item.id}`, { method: "DELETE" });
                  if (res.ok) {
                    setData((prev) => prev.filter((d) => d.id !== item.id));
                  } else {
                    const err = await res.json();
                    alert(err.error || "Failed to delete project");
                  }
                } catch (err) {
                  alert("Error deleting project");
                }
              }}
              title="Delete Mould"
              className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Action & Filter Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full flex-1 sm:w-auto sm:min-w-[280px]">
          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search in table..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Customer Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="h-3 w-3 text-slate-400" />
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Customers</option>
              {uniqueCustomers.map((cust) => (
                <option key={cust} value={cust}>
                  {cust}
                </option>
              ))}
            </select>
          </div>

          {/* Work Type Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <select
              value={selectedWorktype}
              onChange={(e) => setSelectedWorktype(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="ALL">All Work Types</option>
              {uniqueWorktypes.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>

        {/* Right: Bulk Actions & Export Buttons */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
              <span>{selectedCount} selected</span>
              <button
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
                  if (selectedRows.length === 0) return;
                  if (!confirm(`Mark ${selectedRows.length} selected moulds as Completed?`)) return;

                  try {
                    await Promise.all(
                      selectedRows.map((r) =>
                        fetch("/api/scanning", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: r.id, field: "status", value: "completed" }),
                        })
                      )
                    );
                    setData((prev) =>
                      prev.map((d) =>
                        selectedRows.some((s) => s.id === d.id) ? { ...d, status: "completed" } : d
                      )
                    );
                    setRowSelection({});
                  } catch (err) {
                    alert("Failed to update status");
                  }
                }}
                className="hover:underline text-[11px] font-semibold text-blue-800 cursor-pointer"
              >
                Mark Done
              </button>
              <span>•</span>
              <button
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
                  if (selectedRows.length === 0) return;
                  if (!confirm(`Delete ${selectedRows.length} selected moulds? This will mark them completed/soft-deleted.`)) return;

                  try {
                    await Promise.all(
                      selectedRows.map((r) =>
                        fetch(`/api/scanning?id=${r.id}`, {
                          method: "DELETE",
                        })
                      )
                    );
                    setData((prev) => prev.filter((d) => !selectedRows.some((s) => s.id === d.id)));
                    setRowSelection({});
                  } catch (err) {
                    alert("Failed to delete moulds");
                  }
                }}
                className="text-rose-600 hover:text-rose-700 text-[11px] cursor-pointer flex items-center gap-1"
                title="Delete selected moulds"
              >
                <Trash2 className="h-3.5 w-3.5 inline" />
                <span>Delete</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              const headers = [
                "ID",
                "Project ID",
                "Customer",
                "Description",
                "Received Date",
                "Committed Date",
                "Status",
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
                d.status,
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Download Excel/CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Print / Save PDF"
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Main Table Grid (Desktop: hidden below md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="erp-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={
                      header.column.getCanSort() ? "cursor-pointer select-none" : ""
                    }
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: " 🔼",
                        desc: " 🔽",
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400 text-xs"
                >
                  No moulds or projects match the selected filter.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={row.getIsSelected() ? "bg-blue-50/50" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card-List Fallback (block below md, hidden on md+) */}
      <div className="block md:hidden p-3 space-y-3">
        {table.getRowModel().rows.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No moulds or projects match the selected filter.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const m = row.original;
            return (
              <div
                key={row.id}
                className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-600">
                    {m.projectid}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      m.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {m.status}
                  </span>
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
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 px-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
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
    </div>
  );
}
