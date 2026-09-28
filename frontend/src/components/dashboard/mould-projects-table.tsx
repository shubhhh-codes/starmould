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
  X,
  Layers,
  Loader2,
  Building2,
  Calendar,
  Layers3,
  Calculator,
  Scale,
  Lock,
  ShieldCheck,
  Package,
  Compass,
  Wrench,
  Tag,
  MapPin,
  Minus,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ScanProject, Subplate } from "@/lib/supabase/types";
import { TableSkeletonRows } from "@/components/ui/skeleton";
import { Modal, Drawer } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import {
  calculateSubplateWeight,
  isHeightDisabled,
  getDimensionLabels,
  SUPPORTED_UNITS,
  SUPPORTED_SHAPES,
  MATERIAL_DENSITIES,
} from "@/lib/weight-calculator";
import { useSmartPrefetch } from "@/lib/query/prefetch";

const REAL_MATERIALS = [
  "MS-Bright",
  "C45",
  "EN8",
  "D-2",
  "Aluminium",
  "Brass",
  "Copper",
  "SS",
  "SS-202",
  "SS-304",
  "MS-Black",
  "Acralic",
  "Gun Metal",
  "Derlin",
  "Nylon",
  "O-ring",
  "Rubber",
  "Silver Bar",
  "Spring",
  "U-seal",
  "Wood",
  "Wooden Box",
  "WPS",
];

const SHAPES = SUPPORTED_SHAPES;

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

  // View Subplates Modal State
  const [viewProject, setViewProject] = useState<ScanProject | null>(null);
  const [viewSubplates, setViewSubplates] = useState<Subplate[]>([]);
  const [isLoadingSubplates, setIsLoadingSubplates] = useState(false);

  // Add Subplate Modal State
  const [addPlateProject, setAddPlateProject] = useState<ScanProject | null>(null);
  const [isSubmittingPlate, setIsSubmittingPlate] = useState(false);
  const [plateForm, setPlateForm] = useState({
    platename: "",
    subprojectid: "",
    material: "MS-Bright",
    shape: "Plate",
    length: "",
    width: "",
    height: "",
    weight: "",
    unit: "mm",
    sqty: "1",
    location: "SM",
  });

  // Handlers for View & Add Plate Modals
  const fetchSubplatesForProject = async (project: ScanProject) => {
    setIsLoadingSubplates(true);
    try {
      // First try querying with numeric ID
      const res = await fetch(`/api/subplate?projectid=${project.id}`);
      const json = await res.json();
      let plates = json.subplates || [];

      // If no subplates found and projectid string exists, try projectid
      if (plates.length === 0 && project.projectid) {
        const altRes = await fetch(`/api/subplate?projectid=${encodeURIComponent(project.projectid)}`);
        const altJson = await altRes.json();
        if (altJson.subplates && altJson.subplates.length > 0) {
          plates = altJson.subplates;
        }
      }
      setViewSubplates(plates);
    } catch (err) {
      console.error("Failed to load subplates:", err);
      setViewSubplates([]);
    } finally {
      setIsLoadingSubplates(false);
    }
  };

  const handleOpenView = (project: ScanProject) => {
    setViewProject(project);
    fetchSubplatesForProject(project);
  };

  const handleOpenAddPlate = (project: ScanProject) => {
    setAddPlateProject(project);
    const count = (project.total_plates || 0) + 1;
    setPlateForm({
      platename: `Plate ${count}`,
      subprojectid: project.projectid ? `${project.projectid}_${String(count).padStart(3, "0")}` : "",
      material: "MS-Bright",
      shape: "Plate",
      length: "",
      width: "",
      height: "",
      weight: "",
      unit: "mm",
      sqty: "1",
      location: "SM",
    });
  };

  // Dynamic dimension labels and shape constraints for Add Plate modal
  const plateDimLabels = useMemo(
    () => getDimensionLabels(plateForm.shape, plateForm.unit || "mm"),
    [plateForm.shape, plateForm.unit]
  );
  const plateHeightDisabled = useMemo(
    () => isHeightDisabled(plateForm.shape),
    [plateForm.shape]
  );

  // Dynamic auto-calculation of subplate weight based on geometry, density, unit and quantity
  const recalculatePlateWeight = (form: typeof plateForm) => {
    const calculated = calculateSubplateWeight({
      shape: form.shape,
      material: form.material,
      length: form.length,
      width: form.width,
      height: form.height,
      unit: form.unit,
      quantity: form.sqty,
    });
    return calculated > 0 ? calculated.toFixed(3) : "";
  };

  // Strict numeric validation and keyboard filters for Add Plate modal
  const handleStepPlateQty = (delta: number) => {
    const current = parseInt(plateForm.sqty || '1', 10) || 1;
    const next = Math.max(1, current + delta);
    const updated = { ...plateForm, sqty: String(next) };
    updated.weight = recalculatePlateWeight(updated);
    setPlateForm(updated);
  };

  const handlePlateQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9]/g, "");
    const updated = { ...plateForm, sqty: clean };
    updated.weight = recalculatePlateWeight(updated);
    setPlateForm(updated);
  };

  const handleNumericPlateDimension = (field: "length" | "width" | "height", rawVal: string) => {
    let clean = rawVal.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    handleDimensionChange(field, clean);
  };

  const blockInvalidNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const blockInvalidIntegerKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) {
      e.preventDefault();
    }
  };

  // Auto calculate subplate weight dynamically based on geometry, material density and units
  const handleDimensionChange = (field: string, value: string) => {
    const updated = { ...plateForm, [field]: value };
    if (field === "shape" && isHeightDisabled(value)) {
      updated.height = "";
    }
    updated.weight = recalculatePlateWeight(updated);
    setPlateForm(updated);
  };

  const handleSubmitPlate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPlateProject || !plateForm.platename) return;

    try {
      setIsSubmittingPlate(true);
      const res = await fetch("/api/subplate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plateForm,
          projectid: addPlateProject.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create subplate");
      }

      // If view modal is open for this same project, refresh its subplates
      if (viewProject && viewProject.id === addPlateProject.id) {
        await fetchSubplatesForProject(viewProject);
      }

      setAddPlateProject(null);
      onRefresh?.();
    } catch (err: any) {
      alert("Error adding subplate: " + err.message);
    } finally {
      setIsSubmittingPlate(false);
    }
  };

  const handleDeleteSubplate = async (subplateId: number) => {
    if (!confirm("Delete this subplate?")) return;
    try {
      const res = await fetch(`/api/subplate?id=${subplateId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setViewSubplates((prev) => prev.filter((p) => p.id !== subplateId));
        onRefresh?.();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete subplate");
      }
    } catch (err) {
      alert("Error deleting subplate");
    }
  };

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
      // Row Actions
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleOpenView(row.original)}
              title="View Subplates"
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleOpenAddPlate(row.original)}
              title="Add Subplate"
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
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
                    onRefresh?.();
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
            {isLoading ? (
              <TableSkeletonRows rows={8} columns={columns.length} />
            ) : table.getRowModel().rows.length === 0 ? (
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenView(m)}
                      title="View Subplates"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleOpenAddPlate(m)}
                      title="Add Subplate"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete mould project "${m.projectid || `#${m.id}`}"?`)) return;
                        try {
                          const res = await fetch(`/api/scanning?id=${m.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setData((prev) => prev.filter((d) => d.id !== m.id));
                            onRefresh?.();
                          } else {
                            const err = await res.json();
                            alert(err.error || "Failed to delete project");
                          }
                        } catch (err) {
                          alert("Error deleting project");
                        }
                      }}
                      title="Delete Mould"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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

      {/* View Subplates Drawer (Linear-style slide-over) */}
      <Drawer
        isOpen={Boolean(viewProject)}
        onClose={() => setViewProject(null)}
        width="2xl"
        title={
          viewProject ? (
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900">
                {viewProject.projectid || `Project #${viewProject.id}`}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  viewProject.status === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {viewProject.status}
              </span>
            </div>
          ) : undefined
        }
        description={
          viewProject
            ? `${viewProject.customername || viewProject.cname || "Customer"} • ${
                viewProject.description || "No description"
              }`
            : undefined
        }
      >
        {viewProject && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                {viewSubplates.length} Subplates Linked
              </span>
              <MotionButton
                variant="primary"
                size="xs"
                onClick={() => handleOpenAddPlate(viewProject)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Subplate</span>
              </MotionButton>
            </div>

            {isLoadingSubplates ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Loading subplates...</span>
              </div>
            ) : viewSubplates.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-medium text-slate-600">No subplates registered yet</p>
                <p className="text-slate-400 mt-1">
                  Click &quot;Add Subplate&quot; above to attach plates to this mould project.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {viewSubplates.map((sp) => (
                  <div
                    key={sp.id}
                    className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">
                          {sp.platename}
                        </span>
                        {sp.subprojectid && (
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {sp.subprojectid}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {sp.material || "MS-Bright"}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {sp.location || "SM"}
                        </span>
                      </div>
                      <div className="text-slate-500 flex flex-wrap items-center gap-3 font-mono text-[11px]">
                        <span>
                          {sp.length ?? "—"} × {sp.width ?? "—"} × {sp.height ?? "—"} {sp.unit || "mm"}
                        </span>
                        <span>•</span>
                        <span>Qty: {sp.sqty || 1}</span>
                        {sp.weight ? (
                          <>
                            <span>•</span>
                            <span>{sp.weight} kg</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span
                          title="Design"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.design_by ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          DES
                        </span>
                        <span
                          title="Material Order"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.order_by ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          ORD
                        </span>
                        <span
                          title="Material Inward"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.received_workby ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          REC
                        </span>
                        <span
                          title="VMC Machining"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.vmc_workby ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          VMC
                        </span>
                        <span
                          title="Drill & Tap"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.drilltap_workby ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          D&T
                        </span>
                        <span
                          title="Final QC"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.final_qcby ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          FQC
                        </span>
                        <span
                          title="Packing"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.packing_workby ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          PAK
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteSubplate(sp.id)}
                        title="Delete Subplate"
                        className="btn-interactive p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Add Subplate Modal */}
      <Modal
        isOpen={Boolean(addPlateProject)}
        onClose={() => setAddPlateProject(null)}
        maxWidth="xl"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                Add Subplate Workpiece
              </h3>
              <p className="text-xs text-slate-500">
                {addPlateProject
                  ? ("Attach workpiece plate to Mould " + (addPlateProject.projectid || ("#" + addPlateProject.id)))
                  : "Define workpiece dimensions, material and route to shopfloor"}
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmitPlate} className="space-y-4">
          {/* Group 1: Plate Identification & Auto Subproject Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Plate Name</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cavity Plate A"
                value={plateForm.platename}
                onChange={(e) =>
                  setPlateForm({ ...plateForm, platename: e.target.value })
                }
                className="w-full h-10 px-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Subproject / Mould Code</span>
              </label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={plateForm.subprojectid || (addPlateProject ? addPlateProject.projectid : "") || ""}
                className="w-full h-10 px-3.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 select-none cursor-not-allowed shadow-xs"
              />
            </div>
          </div>

          {/* Group 2: Material Grade & Geometry Specifications */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Shape (4 cols) */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Shape</span>
                </label>
                <select
                  value={plateForm.shape}
                  onChange={(e) => handleDimensionChange("shape", e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
                >
                  {SHAPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Material (5 cols) */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <span>Material</span>
                  </span>
                  <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200/60">
                    {MATERIAL_DENSITIES[plateForm.material] || 7.81} g/cm³
                  </span>
                </label>
                <select
                  value={plateForm.material}
                  onChange={(e) => handleDimensionChange("material", e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
                >
                  {REAL_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity with Aligned Stepper (3 cols) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Quantity</span>
                </label>
                <div className="h-10 flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleStepPlateQty(-1)}
                    disabled={Number(plateForm.sqty || 1) <= 1}
                    className="h-full px-2.5 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
                    title="Decrease Quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="1"
                    value={plateForm.sqty}
                    onKeyDown={blockInvalidIntegerKeys}
                    onChange={handlePlateQtyChange}
                    className="h-full w-full text-center font-bold text-xs text-slate-900 focus:outline-none bg-transparent"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleStepPlateQty(1)}
                    className="h-full px-2.5 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                    title="Increase Quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Dimensions Sub-grid */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Dimensions & Unit
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {plateForm.shape === "Round Bar"
                    ? "Length × Diameter"
                    : "Length × Width × Height / Thickness"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={plateDimLabels.length}
                      value={plateForm.length}
                      onKeyDown={blockInvalidNumberKeys}
                      onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                      className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                      L
                    </span>
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={plateDimLabels.widthPlaceholder}
                      value={plateForm.width}
                      onKeyDown={blockInvalidNumberKeys}
                      onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                      className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                      W
                    </span>
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={plateDimLabels.heightPlaceholder}
                      value={plateForm.height}
                      disabled={plateHeightDisabled}
                      onKeyDown={blockInvalidNumberKeys}
                      onChange={(e) => handleNumericPlateDimension("height", e.target.value)}
                      className={"w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 " + (
                        plateHeightDisabled
                          ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                          : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                      )}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                      {plateHeightDisabled ? "—" : "H"}
                    </span>
                  </div>
                </div>
                <div>
                  <select
                    value={plateForm.unit || "mm"}
                    onChange={(e) => handleDimensionChange("unit", e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
                  >
                    {SUPPORTED_UNITS.map((u) => (
                      <option key={u} value={u}>
                        Unit: {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Group 3: Weight Engineering Readout & Production Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
            {/* Hero Calculated Weight Display (7 cols) */}
            <div className="sm:col-span-7 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3.5 text-white flex flex-col justify-between shadow-md relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-blue-400" />
                  <span>Theoretical Weight</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                  {Number(plateForm.sqty) > 1
                    ? ("Total (" + plateForm.sqty + " pcs)")
                    : "Auto"}
                </span>
              </div>

              <div className="flex items-baseline gap-2 relative z-10">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {plateForm.weight || "0.000"}
                </span>
                <span className="text-sm font-bold text-slate-400">kg</span>
                {Number(plateForm.sqty) > 1 && Boolean(plateForm.weight) && (
                  <span className="ml-auto text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                    {(Number(plateForm.weight) / Number(plateForm.sqty)).toFixed(3)} kg / pc
                  </span>
                )}
              </div>

              {Number(plateForm.sqty) > 1 && Boolean(plateForm.weight) ? (
                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 flex items-center justify-between relative z-10 font-mono">
                  <span>
                    {plateForm.sqty} pcs × {(Number(plateForm.weight) / Number(plateForm.sqty)).toFixed(3)} kg
                  </span>
                  <span className="text-slate-300 font-sans font-semibold">Total Batch Wt</span>
                </div>
              ) : (
                <div className="mt-1 text-[10px] text-slate-400 relative z-10">
                  Based on {plateForm.material} density @ {MATERIAL_DENSITIES[plateForm.material] || 7.81} g/cm³
                </div>
              )}
            </div>

            {/* Production Location Card (5 cols) */}
            <div className="sm:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col justify-between">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Production Routing</span>
                </label>
                <select
                  value={plateForm.location}
                  onChange={(e) => setPlateForm({ ...plateForm, location: e.target.value })}
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
                >
                  <option value="SM">SM — In-House Production</option>
                  <option value="Vendor">Vendor — Outward Jobwork</option>
                </select>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
                <span
                  className={"w-2 h-2 rounded-full shrink-0 " + (
                    plateForm.location === "SM"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  )}
                />
                <span>
                  {plateForm.location === "SM"
                    ? "Routed to in-house VMC / Milling"
                    : "Requires outward delivery challan"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions with Perfect Baseline Alignment */}
          <div className="pt-3 sm:pt-4 mt-1 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
            <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Strict numeric validation & 9-stage tracking enabled</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto sm:ml-auto">
              <MotionButton
                type="button"
                variant="outline"
                onClick={() => setAddPlateProject(null)}
                className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </MotionButton>
              <MotionButton
                type="submit"
                variant="primary"
                disabled={isSubmittingPlate || !plateForm.platename}
                isLoading={isSubmittingPlate}
                loadingText="Adding Plate..."
                successText="Plate Added!"
                className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Subplate</span>
              </MotionButton>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

