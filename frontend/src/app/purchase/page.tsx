"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShoppingCart,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Printer,
  Trash2,
  Calendar,
  Building2,
  Layers,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  PackagePlus,
  ArrowUpRight,
  Filter,
} from "lucide-react";
import type { PurchaseOrder, PurchaseItem, Subplate, Customer, ScanProject } from "@/lib/supabase/types";
import { TableSkeletonRows } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { usePurchasesQuery, useCreatePurchaseMutation, useDeletePurchaseMutation } from "@/lib/query/hooks";

export default function PurchasePage() {
  const { data, isLoading } = usePurchasesQuery({ limit: 200, includePlates: true });
  const createPurchaseMutation = useCreatePurchaseMutation();
  const deletePurchaseMutation = useDeletePurchaseMutation();

  const purchases = (data?.purchases || []) as PurchaseOrder[];
  const subplates = (data?.subplates || []) as Subplate[];
  const customers = (data?.customers || []) as Customer[];
  const scans = (data?.scans || []) as ScanProject[];
  const [extraSubplates, setExtraSubplates] = useState<Subplate[]>([]);

  const allSubplates = useMemo(() => {
    const map = new Map<number, Subplate>();
    subplates.forEach((s) => map.set(s.id, s));
    extraSubplates.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [subplates, extraSubplates]);

  // Navigation Tabs: All Purchase Orders vs. Pending Purchase (needing PO)
  const [activeTab, setActiveTab] = useState<"orders" | "pending_plates">("orders");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMould, setSelectedMould] = useState("");
  const [formData, setFormData] = useState<{
    odate: string;
    vname: number | "";
    cname: number | "";
    projectid: string;
    items: {
      plateid: number | "";
      material: string;
      materialtype: string;
      qty: number;
    }[];
  }>({
    odate: new Date().toISOString().slice(0, 10),
    vname: "",
    cname: "",
    projectid: "",
    items: [
      { plateid: "", material: "", materialtype: "", qty: 1 },
    ],
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  // Filtered vendor and customer lists matching legacy query
  // Source: PurchaseController.php index() lines 27-33: usertype='Vendor', usertype='Customer'
  const vendors = useMemo(
    () => customers.filter((c) => c.usertype === "Vendor"),
    [customers]
  );
  const clients = useMemo(
    () => customers.filter((c) => c.usertype === "Customer"),
    [customers]
  );

  // Available moulds for the selected customer in Add modal
  // Source: CustomerController.php:136 (getprojectswork):
  // ScanningModel::where("cname", $request->cid)->where('status','<>','completed')->where('status','<>','registered')->get();
  const availableMoulds = useMemo(() => {
    if (!formData.cname) return [];
    return scans.filter(
      (s) =>
        String(s.cname) === String(formData.cname) &&
        s.status !== "completed"
    );
  }, [scans, formData.cname]);

  // Selected scan for subplate resolution
  const selectedScan = useMemo(() => {
    if (!formData.projectid) return null;
    return scans.find(
      (s) => s.projectid === formData.projectid || String(s.id) === formData.projectid
    );
  }, [scans, formData.projectid]);

  // Subplates matching the selected mould in Add modal
  // Source: CustomerController.php:294-297 (getprojectsubplates):
  // ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')->where('scan.projectid', $request->projectid)
  const platesForSelectedProject = useMemo(() => {
    if (!formData.projectid) return [];
    const scanIdStr = selectedScan ? String(selectedScan.id) : "";
    return allSubplates.filter(
      (sp) =>
        (scanIdStr && String(sp.projectid) === scanIdStr) ||
        String(sp.projectid) === formData.projectid ||
        (sp.subprojectid && sp.subprojectid.includes(formData.projectid))
    );
  }, [allSubplates, formData.projectid, selectedScan]);

  // Dynamically load subplates for chosen mould if not present in client cache
  React.useEffect(() => {
    if (!formData.projectid) return;
    const scan = selectedScan || scans.find((s) => s.projectid === formData.projectid || String(s.id) === formData.projectid);
    const lookupId = scan ? scan.id : formData.projectid;
    
    fetch(`/api/subplate?projectid=${lookupId}&limit=500`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subplates && data.subplates.length > 0) {
          setExtraSubplates((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const fresh = data.subplates.filter((p: Subplate) => !existing.has(p.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
      })
      .catch((err) => console.error("Error loading mould subplates in Purchase:", err));
  }, [formData.projectid, selectedScan, scans]);

  // Distinct projects available from scans & purchases for table filters
  const availableProjects = useMemo(() => {
    const set = new Set<string>();
    scans.forEach((s) => {
      if (s.projectid) set.add(s.projectid);
    });
    purchases.forEach((p) => {
      if (p.projectid) set.add(p.projectid);
    });
    return Array.from(set);
  }, [scans, purchases]);

  // Pending Purchase List Logic
  // Source: PurchaseController.php lines 332-335:
  // SubplateModel::leftJoin('view_po_pending_inward_qty', 'subplate.id', '=', 'view_po_pending_inward_qty.plateid')
  // ->whereNull('view_po_pending_inward_qty.plateid')
  const pendingPlates = useMemo(() => {
    // Collect all plate IDs already referenced in any active purchase_items
    const orderedPlateIds = new Set<number>();
    purchases.forEach((p) => {
      if (String(p.status) !== "0" && (p as any).status !== 0 && p.items) {
        p.items.forEach((item: PurchaseItem) => orderedPlateIds.add(item.plateid));
      }
    });
    return allSubplates.filter((sp) => !orderedPlateIds.has(sp.id));
  }, [allSubplates, purchases]);

  // Toggle row expansion for child items
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper names lookup
  const getCustomerName = (id: number) => {
    const found = customers.find((c) => c.id === id);
    return found ? found.customername : `ID: ${id}`;
  };

  // Filtered PO records
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (String(p.status) === "0" || (p as any).status === 0) return false; // Soft deleted
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const vendorName = getCustomerName(p.vname).toLowerCase();
      const clientName = getCustomerName(p.cname).toLowerCase();
      return (
        p.srno.toLowerCase().includes(q) ||
        p.projectid.toLowerCase().includes(q) ||
        vendorName.includes(q) ||
        clientName.includes(q) ||
        (p.created_by && p.created_by.toLowerCase().includes(q))
      );
    });
  }, [purchases, searchQuery]);

  // Filtered Pending Plates
  const filteredPendingPlates = useMemo(() => {
    return pendingPlates.filter((sp) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        sp.platename.toLowerCase().includes(q) ||
        sp.projectid.toLowerCase().includes(q) ||
        (sp.material && sp.material.toLowerCase().includes(q))
      );
    });
  }, [pendingPlates, searchQuery]);

  // Pagination
  const totalPages =
    activeTab === "orders"
      ? Math.ceil(filteredPurchases.length / pageSize) || 1
      : Math.ceil(filteredPendingPlates.length / pageSize) || 1;

  const paginatedPurchases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, currentPage, pageSize]);

  const paginatedPendingPlates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPendingPlates.slice(start, start + pageSize);
  }, [filteredPendingPlates, currentPage, pageSize]);

  // Add line item row to PO
  const handleAddPlateRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { plateid: "", material: "", materialtype: "", qty: 1 },
      ],
    }));
  };

  // Remove line item row
  const handleRemovePlateRow = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Update specific item field
  const handleUpdateItem = (
    index: number,
    field: "plateid" | "material" | "materialtype" | "qty",
    value: string | number
  ) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  // Select plate handler: auto-populates readonly materialtype & prefilled dimensions
  // Matching purchase/index.blade.php lines 810-845 (updatedata function: $("#materialtype").val(data.material))
  const handleSelectPlate = (index: number, plateId: number | "") => {
    if (plateId === "") {
      setFormData((prev) => {
        const updated = [...prev.items];
        updated[index] = { ...updated[index], plateid: "", material: "", materialtype: "", qty: 1 };
        return { ...prev, items: updated };
      });
      return;
    }
    const foundPlate = allSubplates.find((sp: Subplate) => sp.id === Number(plateId));
    setFormData((prev) => {
      const updated = [...prev.items];
      if (foundPlate) {
        const dims = [
          foundPlate.width ?? "",
          foundPlate.height ?? "",
          foundPlate.length ?? "",
        ].filter(Boolean).join(" x ") + (foundPlate.unit ? ` ${foundPlate.unit}` : " mm");

        updated[index] = {
          ...updated[index],
          plateid: foundPlate.id,
          // Readonly materialtype auto-populated from linked subplate material
          // Matching purchase/index.blade.php:822: $("#materialtype").val(data.material)
          materialtype: foundPlate.material || "",
          material: dims,
          qty: foundPlate.sqty || 1,
        };
      } else {
        updated[index] = { ...updated[index], plateid: Number(plateId) };
      }
      return { ...prev, items: updated };
    });
  };

  // Open modal for creating PO
  const handleOpenAddModal = (presetPlate?: Subplate) => {
    let defaultMould = "";
    let defaultCustomer: number | "" = "";
    if (presetPlate) {
      const matchingScan = scans.find(
        (s) => String(s.id) === String(presetPlate.projectid) || s.projectid === presetPlate.projectid
      );
      defaultMould = matchingScan?.projectid || presetPlate.projectid || "";
      defaultCustomer = matchingScan && matchingScan.cname ? Number(matchingScan.cname) : "";
    }

    const presetDims = presetPlate
      ? [
          presetPlate.width ?? "",
          presetPlate.height ?? "",
          presetPlate.length ?? "",
        ].filter(Boolean).join(" x ") + (presetPlate.unit ? ` ${presetPlate.unit}` : " mm")
      : "";

    setFormData({
      odate: new Date().toISOString().slice(0, 10),
      vname: "",
      cname: defaultCustomer,
      projectid: defaultMould,
      items: presetPlate
        ? [
            {
              plateid: presetPlate.id,
              material: presetDims,
              materialtype: presetPlate.material || "",
              qty: presetPlate.sqty || 1,
            },
          ]
        : [
            {
              plateid: "",
              material: "",
              materialtype: "",
              qty: 1,
            },
          ],
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit Purchase Order (Source: PurchaseController.php store() lines 403-561)
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vname) {
      setFormError("Please select a supplier/vendor.");
      return;
    }
    if (!formData.cname) {
      setFormError("Please select a customer.");
      return;
    }
    if (!formData.projectid) {
      setFormError("Please select a mould project.");
      return;
    }
    if (formData.items.some((it) => !it.plateid || it.qty <= 0)) {
      setFormError("All line items must have a selected plate and quantity greater than 0.");
      return;
    }

    try {
      await createPurchaseMutation.mutateAsync({
        odate: formData.odate,
        vname: Number(formData.vname),
        cname: Number(formData.cname),
        projectid: formData.projectid,
        items: formData.items,
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error creating PO";
      setFormError(message);
    }
  };

  // Handle Soft Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePurchaseMutation.mutateAsync(deleteTarget.id);
    } catch (err) {
      console.error("Failed to delete PO:", err);
    } finally {
      setDeleteTarget(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "PO No.",
      "Order Date",
      "Supplier",
      "Customer",
      "Mould",
      "Created By",
      "Total Items",
    ];
    const rows = filteredPurchases.map((p) => [
      `"${p.srno}"`,
      `"${p.odate}"`,
      `"${getCustomerName(p.vname).replace(/"/g, '""')}"`,
      `"${getCustomerName(p.cname).replace(/"/g, '""')}"`,
      `"${p.projectid}"`,
      `"${p.created_by}"`,
      p.items ? p.items.length : 0,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `starmould_purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
              <span>Procurement</span>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-300">Purchase Orders</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Purchase Management
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                `purchase` & `purchase_items`
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Raw material procurement, multi-item plate orders & pending vendor pipeline
            </p>
          </div>

          {/* Quick link to Pending Receive against POs */}
          <Link
            href="/purchase-inward"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition shadow-sm"
          >
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            <span>Go to Pending Receive (Inward)</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>

        {/* Top Control Bar: Tabs & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("orders");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "orders"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
              <span>Purchase Order Register</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {filteredPurchases.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("pending_plates");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "pending_plates"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending Purchase (Plates Needing PO)</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                {pendingPlates.length}
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              title="Export POs to CSV matching legacy export()"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={() => handleOpenAddModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Purchase PO</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Pagination controls */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={
                  activeTab === "orders"
                    ? "Search PO no, supplier, customer, mould project..."
                    : "Search plate name, mould, dimensions, material..."
                }
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none dark:text-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PURCHASE ORDER REGISTER (with expandable multi-item rows)          */}
        {/* ========================================================================= */}
        {activeTab === "orders" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-[4%] text-center"></th>
                    <th className="py-3 px-4 w-[11%]">PO. No.</th>
                    <th className="py-3 px-3 w-[10%]">Order Date</th>
                    <th className="py-3 px-4 w-[20%]">Supplier Name</th>
                    <th className="py-3 px-4 w-[20%]">Customer Name</th>
                    <th className="py-3 px-4 w-[15%]">Mould Project</th>
                    <th className="py-3 px-3 w-[10%]">Created By</th>
                    <th className="py-3 px-4 w-[10%] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {isLoading ? (
                    <TableSkeletonRows rows={8} columns={8} />
                  ) : paginatedPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No purchase orders found.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedPurchases.map((po) => {
                      const isExpanded = Boolean(expandedRows[po.id]);
                      const vendorName = getCustomerName(po.vname);
                      const clientName = getCustomerName(po.cname);
                      const itemCount = po.items ? po.items.length : 0;

                      return (
                        <React.Fragment key={po.id}>
                          {/* Main PO Row */}
                          <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            {/* Details Control toggle icon */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => toggleRow(po.id)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                                title="Expand line items"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </td>

                            {/* PO No. */}
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-[12px] text-blue-700 dark:text-blue-400">
                                {po.srno}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {itemCount} {itemCount === 1 ? "plate" : "plates"}
                              </div>
                            </td>

                            {/* Order Date */}
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-mono">{po.odate}</span>
                              </div>
                            </td>

                            {/* Supplier Name */}
                            <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                <span className="truncate max-w-[200px]" title={vendorName}>
                                  {vendorName}
                                </span>
                              </div>
                            </td>

                            {/* Customer Name */}
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                              <span className="truncate max-w-[200px] block" title={clientName}>
                                {clientName}
                              </span>
                            </td>

                            {/* Mould Project */}
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {po.projectid}
                              </span>
                            </td>

                            {/* Created By */}
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                              {po.created_by || "Admin"}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => toggleRow(po.id)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-50 dark:hover:bg-blue-950/60 transition"
                                >
                                  {isExpanded ? "Hide" : "View"}
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(po)}
                                  className="px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                                  title="Delete Purchase Order"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Child Table: Line Items (replicates purchaseitems format(d)) */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-950/50">
                              <td colSpan={8} className="p-4 pl-12 border-y border-slate-200 dark:border-slate-800">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-inner">
                                  <div className="px-4 py-2 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    <span className="flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                                      Line Items for {po.srno}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-normal">
                                      {itemCount} subplates ordered
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto w-full">
                                    <table className="w-full text-xs text-left">
                                      <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                          <th className="py-2 px-4">Plate Name</th>
                                          <th className="py-2 px-4">Material / Dimensions</th>
                                          <th className="py-2 px-4">Material Type</th>
                                          <th className="py-2 px-4 text-center">Ordered Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {po.items && po.items.length > 0 ? (
                                          po.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50">
                                              <td className="py-2 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                {item.platename || `Plate #${item.plateid}`}
                                              </td>
                                              <td className="py-2 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                {item.material || "—"}
                                              </td>
                                              <td className="py-2 px-4 text-slate-600 dark:text-slate-400">
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                  {item.materialtype}
                                                </span>
                                              </td>
                                              <td className="py-2 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                                                {item.qty}
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                                              No line items attached to this order.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-List Fallback (< md) */}
            <div className="block md:hidden p-3 space-y-3">
              {paginatedPurchases.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No purchase orders found.
                </div>
              ) : (
                paginatedPurchases.map((po) => {
                  const isExpanded = Boolean(expandedRows[po.id]);
                  const vendorName = getCustomerName(po.vname);
                  const clientName = getCustomerName(po.cname);
                  const itemCount = po.items ? po.items.length : 0;

                  return (
                    <div
                      key={po.id}
                      className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {po.srno}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">
                            {po.odate}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded font-mono font-semibold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {po.projectid}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Supplier:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                            {vendorName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Customer:</span>
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                            {clientName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500">
                          {itemCount} {itemCount === 1 ? "subplate" : "subplates"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRow(po.id)}
                            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 transition flex items-center justify-center cursor-pointer"
                          >
                            {isExpanded ? "Hide Items" : "View Items"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(po)}
                            className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 transition flex items-center justify-center cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Mobile Expanded Items */}
                      {isExpanded && po.items && po.items.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                          {po.items.map((it) => (
                            <div
                              key={it.id}
                              className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                                  {it.platename || `Plate #${it.plateid}`}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {it.material || "—"} ({it.materialtype})
                                </span>
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Qty: {it.qty}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredPurchases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, filteredPurchases.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredPurchases.length}
                </span>{" "}
                purchase orders
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-mono text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PENDING PURCHASE LIST (Plates from registered moulds needing PO)    */}
        {/* Source: pendingpurchaselist.blade.php & PurchaseController::getPurchaseData*/}
        {/* ========================================================================= */}
        {activeTab === "pending_plates" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Plates registered in scanning master that have not yet been assigned to a Purchase Order.
                </span>
              </div>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                {pendingPlates.length} Plates Awaiting Procurement
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-[22%]">Plate Name</th>
                    <th className="py-3 px-4 w-[16%]">Mould Project</th>
                    <th className="py-3 px-3 w-[10%] text-center">Length (mm)</th>
                    <th className="py-3 px-3 w-[10%] text-center">Width (mm)</th>
                    <th className="py-3 px-3 w-[10%] text-center">Height (mm)</th>
                    <th className="py-3 px-4 w-[14%]">Material</th>
                    <th className="py-3 px-3 w-[8%] text-center">Qty</th>
                    <th className="py-3 px-4 w-[10%] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {isLoading ? (
                    <TableSkeletonRows rows={8} columns={8} />
                  ) : paginatedPendingPlates.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                        <p>All registered subplates currently have active purchase orders raised!</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedPendingPlates.map((sp) => (
                      <tr key={sp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {sp.platename}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {sp.projectid}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                          {sp.length ?? "—"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                          {sp.width ?? "—"}
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                          {sp.height ?? "—"}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {sp.material || "Steel/Alu"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {sp.sqty}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenAddModal(sp)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-sm"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Create PO</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredPendingPlates.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, filteredPendingPlates.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredPendingPlates.length}
                </span>{" "}
                pending plates
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-mono text-xs">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD PURCHASE PO MODAL (Multi-item entry replicating purchaseitems UX)      */}
        {/* Source: purchase/index.blade.php lines 76-161 & PurchaseController::store */}
        {/* ========================================================================= */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Create Raw Material Purchase Order"
          description="Source: purchase.store (Header + Multiple purchase_items lines)"
          size="xl"
        >
          <form onSubmit={handleSubmitPO} className="space-y-5 text-xs">
                {formError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Header Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Order Date */}
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Order Date <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        required
                        value={formData.odate}
                        onChange={(e) => setFormData((p) => ({ ...p, odate: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Supplier Name */}
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Supplier Name (vname) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.vname}
                      onChange={(e) => setFormData((p) => ({ ...p, vname: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                    >
                      <option value="" disabled>Select Supplier / Vendor</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.customername} ({v.initials})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Customer Name (cname) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.cname}
                      onChange={(e) => {
                        const newCid = e.target.value ? Number(e.target.value) : "";
                        setFormData((p) => ({
                          ...p,
                          cname: newCid,
                          projectid: "",
                          items: [{ plateid: "", material: "", materialtype: "", qty: 1 }],
                        }));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                    >
                      <option value="" disabled>Select Customer</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customername} ({c.initials})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mould Name (projectid) */}
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mould Name (projectid) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.projectid}
                      onChange={(e) => {
                        const newProj = e.target.value;
                        setFormData((p) => ({
                          ...p,
                          projectid: newProj,
                          // Reset plate selection for newly selected mould
                          items: p.items.map((it) => ({ ...it, plateid: "" })),
                        }));
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                    >
                      <option value="" disabled>
                        {!formData.cname
                          ? "Select Customer First"
                          : availableMoulds.length === 0
                          ? "No active moulds found for this customer"
                          : "Select Mould Project"}
                      </option>
                      {availableMoulds.map((s) => (
                        <option key={s.id} value={s.projectid || ""}>
                          {s.projectid} {s.description ? `— ${s.description}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dynamic Line Items Section (Multi-Item Repeater) */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>PO Subplate Line Items</span>
                      <span className="text-slate-400 font-normal">
                        ({formData.items.length} {formData.items.length === 1 ? "line" : "lines"})
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddPlateRow}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Plate Line</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[11px] font-bold text-slate-500">
                            #0{idx + 1}
                          </span>
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePlateRow(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                          {/* Plate Selector */}
                          <div className="sm:col-span-4">
                            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                              Subplate <span className="text-rose-500">*</span>
                            </label>
                            <select
                              required
                              value={item.plateid}
                              onChange={(e) =>
                                handleSelectPlate(idx, e.target.value ? Number(e.target.value) : "")
                              }
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white text-xs"
                            >
                              <option value="" disabled>
                                {!formData.projectid
                                  ? "Select Mould first"
                                  : platesForSelectedProject.length === 0
                                  ? "No plates found for this mould"
                                  : "Select Subplate"}
                              </option>
                              {platesForSelectedProject.map((sp) => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.platename} (qty: {sp.sqty})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Material Type (READONLY - Auto-populated from linked subplate's material) */}
                          {/* Source: purchase/index.blade.php:822: name="materialtype[]" readonly */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                              Material Type <span className="text-[10px] text-slate-400 font-normal">(Readonly)</span>
                            </label>
                            <input
                              type="text"
                              readOnly
                              value={item.materialtype}
                              placeholder="Auto from plate"
                              className="w-full px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs cursor-not-allowed font-medium select-none"
                              title="Material type is read-only and auto-populated from the selected subplate (purchase/index.blade.php:822)"
                            />
                          </div>

                          {/* Dimensions / Required Material */}
                          {/* Source: purchase/index.blade.php:828: name="material[]" */}
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                              Required Material / Dims
                            </label>
                            <input
                              type="text"
                              value={item.material}
                              onChange={(e) => handleUpdateItem(idx, "material", e.target.value)}
                              placeholder="e.g. 955 x 955 x 65 mm"
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white text-xs"
                            />
                          </div>

                          {/* Remaining Qty (sqty) - Readonly display */}
                          {/* Source: purchase/index.blade.php:844: id="sqty" disabled */}
                          <div className="sm:col-span-1">
                            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium text-center">
                              Rem. Qty
                            </label>
                            <input
                              type="text"
                              disabled
                              value={
                                item.plateid
                                  ? subplates.find((sp) => sp.id === item.plateid)?.sqty ?? "—"
                                  : "—"
                              }
                              className="w-full px-2 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 text-xs cursor-not-allowed font-mono text-center"
                              title="Remaining quantity to order"
                            />
                          </div>

                          {/* Order Qty (qty) */}
                          {/* Source: purchase/index.blade.php:834: name="qty[]" */}
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                              Order Qty <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={item.qty}
                              onChange={(e) =>
                                handleUpdateItem(idx, "qty", Number(e.target.value))
                              }
                              className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none dark:text-white text-xs text-center font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition btn-interactive"
                  >
                    Cancel
                  </button>
                  <MotionButton
                    type="submit"
                    loading={createPurchaseMutation.isPending}
                    variant="primary"
                    size="sm"
                  >
                    Submit Purchase Order
                  </MotionButton>
                </div>
              </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Confirm Purchase Order Deletion"
          description="Source: PurchaseController.php destroy() (status = '0')"
          size="sm"
        >
          {deleteTarget && (
            <div className="text-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Confirm Purchase Order Deletion
                  </h4>
                  <p className="text-slate-500">
                    This action will soft-delete the order
                  </p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Do you really want to delete Purchase Order{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  &quot;{deleteTarget.srno}&quot;
                </span>{" "}
                for mould {deleteTarget.projectid}? This will soft-delete the order.
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition btn-interactive"
                >
                  Cancel
                </button>
                <MotionButton
                  type="button"
                  onClick={handleConfirmDelete}
                  loading={deletePurchaseMutation.isPending}
                  variant="danger"
                  size="sm"
                >
                  Yes, Delete PO
                </MotionButton>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}
