"use client";

import { filterMoulds } from "../model/filter-moulds";
import type { RowSelectionState } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
} from "@tanstack/react-table";
import {
  ChevronDown,
  Eye,
  Clock,
  Plus,
  ShoppingCart,
  Trash2,
  Building2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { type ERPSelectOption } from "@/components/ui/erp-select";
import type { ScanProject } from "@/lib/supabase/types";
import type { Dispatch, SetStateAction } from "react";

type Options = {
  data: ScanProject[];
  selectedCustomer: string;
  selectedWorktype: string;
  expandedRowId: string | number | null;
  toggleRowExpand: (project: ScanProject) => void;
  setTimelineProjectId: Dispatch<SetStateAction<string | number | null>>;
  setIsTimelineOpen: Dispatch<SetStateAction<boolean>>;
  isAdmin: boolean;
  handleOpenView: (project: ScanProject) => void;
  canCreateSubplate: boolean;
  handleOpenAddPlate: (project: ScanProject) => void;
  canCreatePurchase: boolean;
  handleCreatePO: (project: ScanProject) => void;
  canDeleteMould: boolean;
  handleDeleteSingleProject: (project: ScanProject) => void;
  sorting: SortingState;
  globalFilter: string;
  rowSelection: RowSelectionState;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
  setSorting: Dispatch<SetStateAction<SortingState>>;
  setGlobalFilter: Dispatch<SetStateAction<string>>;
};

const columnHelper = createColumnHelper<ScanProject>();

export function useMouldTableModel({
  data,
  selectedCustomer,
  selectedWorktype,
  expandedRowId,
  toggleRowExpand,
  setTimelineProjectId,
  setIsTimelineOpen,
  isAdmin,
  handleOpenView,
  canCreateSubplate,
  handleOpenAddPlate,
  canCreatePurchase,
  handleCreatePO,
  canDeleteMould,
  handleDeleteSingleProject,
  sorting,
  globalFilter,
  rowSelection,
  setRowSelection,
  setSorting,
  setGlobalFilter,
}: Options) {

  // Extract unique filters
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.cname) set.add(d.cname);
      else if (d.customername) set.add(d.customername);
    });
    return Array.from(set).sort();
  }, [data]);

  const dashboardCustomerOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Customers (${uniqueCustomers.length})` },
    ...uniqueCustomers.map((cust) => ({ value: cust, label: cust })),
  ], [uniqueCustomers]);

  const uniqueWorktypes = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.worktype) set.add(d.worktype);
    });
    return Array.from(set).sort();
  }, [data]);

  const dashboardWorktypeOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Work Types (${uniqueWorktypes.length})` },
    ...uniqueWorktypes.map((wt) => ({ value: wt, label: wt })),
  ], [uniqueWorktypes]);

  // Filtered dataset
  const filteredData = useMemo(() => filterMoulds(data, selectedCustomer, selectedWorktype), [data, selectedCustomer, selectedWorktype]);

  const columns = useMemo(
    () => [
      // Checkbox selection column for bulk actions
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              suppressHydrationWarning
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
              onClick={(e) => e.stopPropagation()}
              title="Select all moulds (Ctrl+A)"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-blue-600 transition"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              suppressHydrationWarning
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              onClick={(e) => e.stopPropagation()}
              title="Select all moulds (Ctrl+A)"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-blue-600 transition"
            />
          </div>
        ),
      }),
      // Project Code / ID
      columnHelper.accessor("projectid", {
        header: "Project Code",
        cell: (info) => {
          const isExpanded = expandedRowId !== null && String(expandedRowId) === String(info.row.original.id);
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRowExpand(info.row.original);
                }}
                className={`p-1 rounded-md transition cursor-pointer ${isExpanded
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-slate-200/70 text-slate-400 hover:text-slate-700"
                  }`}
                title={isExpanded ? "Collapse Subplates" : "Expand Subplates Inline"}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180 text-blue-600" : "-rotate-90"
                    }`}
                />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTimelineProjectId(info.row.original.projectid || info.row.original.id);
                  setIsTimelineOpen(true);
                }}
                className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline text-xs cursor-pointer text-left"
                title="View GitHub-style Lifecycle Timeline & History"
              >
                {info.getValue() || `P-${info.row.original.id}`}
              </button>
            </div>
          );
        },
      }),
      // Received Date
      columnHelper.accessor("rdate", {
        header: "Received Dt",
        cell: (info) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatDate(info.getValue())}</span>
          </div>
        ),
      }),
      // Committed Date
      columnHelper.accessor("cdate", {
        header: "Committed Dt",
        cell: (info) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatDate(info.getValue())}</span>
          </div>
        ),
      }),
      // Customer Name
      columnHelper.accessor((row) => row.cname || row.customername, {
        id: "customer",
        header: "Customer",
        cell: (info) => (
          <div className="flex items-center gap-1.5 min-w-[140px] max-w-[200px]">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900 text-xs truncate" title={info.getValue()}>
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
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              {val}
            </span>
          );
        },
      }),
      // Description / Mould Name
      columnHelper.accessor("description", {
        header: "Mould / Part Name",
        cell: (info) => (
          <span className="font-medium text-slate-800 text-xs truncate max-w-[240px] block" title={info.getValue()}>
            {info.getValue() || "—"}
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
          const isDone = percent === 100 && total > 0;
          const subplates = row.original.subplates || [];
          const jwPlates = subplates.filter((sp) => {
            const outQty = Number(sp.jobwork_balance?.outward_jobwork_qty) || 0;
            if (outQty > 0) return true;
            const loc = (sp.location || "").trim().toLowerCase();
            if (!loc || loc === "sm" || loc === "in-house" || loc === "in house" || loc === "customer") {
              return false;
            }
            return true;
          });

          const totalPieces = subplates.reduce((sum, sp) => sum + (Number(sp.sqty) || 1), 0);
          const dispatchedPieces = subplates.reduce((sum, sp) => sum + (Number((sp.jobwork_balance as any)?.customer_dispatched_qty) || 0), 0);

          const fullyDispatchedPlates = subplates.filter((sp) => {
            const total = Number(sp.sqty) || 1;
            const dispQty = Number((sp.jobwork_balance as any)?.customer_dispatched_qty) || 0;
            if (dispQty >= total && total > 0) return true;
            const loc = (sp.location || "").trim().toLowerCase();
            return (loc === "customer" || sp.dispatch_status === "dispatched") && (dispQty === 0 || dispQty >= total);
          });

          const partialDispatchedPlates = subplates.filter((sp) => {
            const total = Number(sp.sqty) || 1;
            const dispQty = Number((sp.jobwork_balance as any)?.customer_dispatched_qty) || 0;
            return (dispQty > 0 && dispQty < total) || sp.dispatch_status === "partial";
          });

          return (
            <div className="flex flex-col gap-1 min-w-[130px]">
              <div className="flex items-center gap-2.5">
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isDone ? "bg-emerald-500" : "bg-blue-600"
                      }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold font-mono text-slate-700 min-w-[34px]">
                  {completed}/{total}
                </span>
              </div>
              {jwPlates.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold" title={`${jwPlates.length} subplate(s) currently out on Job Work`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>{jwPlates.length} {jwPlates.length === 1 ? "plate" : "plates"} on Job Work</span>
                </div>
              )}
              {fullyDispatchedPlates.length > 0 && jwPlates.length === 0 && (
                <div className="flex items-center gap-1 text-[10px] text-blue-700 font-semibold" title={`${fullyDispatchedPlates.length} subplate(s) fully dispatched to Customer`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                  <span>{fullyDispatchedPlates.length} {fullyDispatchedPlates.length === 1 ? "plate" : "plates"} Dispatched</span>
                </div>
              )}
              {partialDispatchedPlates.length > 0 && fullyDispatchedPlates.length === 0 && jwPlates.length === 0 && (
                <div className="flex items-center gap-1 text-[10px] text-amber-800 font-semibold" title={`Partial delivery: ${dispatchedPieces} of ${totalPieces} pieces dispatched to Customer`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span>Partial Dispatch ({dispatchedPieces}/{totalPieces} pcs)</span>
                </div>
              )}
            </div>
          );
        },
      }),
      // Row Actions
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setTimelineProjectId(row.original.projectid || row.original.id);
                  setIsTimelineOpen(true);
                }}
                title="View Lifecycle Timeline"
                className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenView(row.original)}
              title="View Subplates & Stages"
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <Eye className="h-4 w-4" />
            </button>
            {canCreateSubplate && (
              <button
                type="button"
                onClick={() => handleOpenAddPlate(row.original)}
                title="Add Subplate"
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {canCreatePurchase && (
              <button
                type="button"
                onClick={() => handleCreatePO(row.original)}
                title="Create Purchase Order"
                className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
            )}
            {canDeleteMould && (
              <button
                type="button"
                onClick={() => handleDeleteSingleProject(row.original)}
                title="Delete Mould"
                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      }),
    ],
    [canCreateSubplate, canCreatePurchase, canDeleteMould]
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
  return {
    table,
    selectedCount,
    dashboardCustomerOptions,
    dashboardWorktypeOptions,
    columns,
    filteredData,
  };
}
