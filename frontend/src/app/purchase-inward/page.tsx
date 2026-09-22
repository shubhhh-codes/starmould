"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  PackagePlus,
  Search,
  Calendar,
  Building2,
  Layers,
  CheckCircle2,
  Clock,
  Printer,
  FileSpreadsheet,
  X,
  AlertCircle,
  ArrowDownLeft,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import type {
  PurchaseOrder,
  PurchaseInwardReceipt,
  Customer,
  Subplate,
  ViewPoPendingInwardQty,
} from "@/lib/supabase/types";

export default function PurchaseInwardPage() {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [poInwards, setPoInwards] = useState<PurchaseInwardReceipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subplates, setSubplates] = useState<Subplate[]>([]);
  const [livePendingItems, setLivePendingItems] = useState<ViewPoPendingInwardQty[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Live Supabase fetch for pending inward items and inward receipts
  const fetchInwardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/purchase-inward");
      const data = await res.json();
      if (data.pendingReceiveItems) {
        setLivePendingItems(data.pendingReceiveItems);
      }
      if (data.receipts) {
        setPoInwards(data.receipts);
      }
      if (data.customers) {
        setCustomers(data.customers);
      }
      if (data.subplates) {
        setSubplates(data.subplates);
      }
    } catch (err) {
      console.error("Failed to load live purchase inward from Supabase:", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchInwardData();
  }, []);

  // Navigation Tabs: Pending Receive vs. Received Inward History
  const [activeTab, setActiveTab] = useState<"pending_receive" | "inward_history">("pending_receive");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedInwardRows, setExpandedInwardRows] = useState<Record<number, boolean>>({});

  // Receive Modal State (Source: purchaselist.blade.php lines 92-180)
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedPendingPO, setSelectedPendingPO] = useState<ViewPoPendingInwardQty | null>(null);
  const [receiveForm, setReceiveForm] = useState<{
    odate: string; // Receive Date
    inpono: string; // Vendor Delivery Note / Invoice No
    receiveQtys: Record<number, number>; // plateid -> receiving qty
  }>({
    odate: new Date().toISOString().slice(0, 10),
    inpono: "",
    receiveQtys: {},
  });

  const [receiveError, setReceiveError] = useState<string | null>(null);

  // Customer & Vendor name lookups
  const getCustomerName = (id: number) => {
    const found = customers.find((c) => c.id === id);
    return found ? found.customername : `ID: ${id}`;
  };

  const getSubplateName = (id: number) => {
    const found = subplates.find((sp) => sp.id === id);
    return found ? found.platename : `Plate #${id}`;
  };

  // Replicate Phase 1 view: public.view_po_pending_inward_qty
  // Source: supabase/migrations/001_init.sql lines 612-640 & ViewPurchaseModel.php
  // SELECT p.id, (SELECT customername...), pi.plateid, pi.qty, COALESCE(vpi.inward_qty, 0),
  // (COALESCE(pi.qty, 0) - COALESCE(vpi.inward_qty, 0)) AS pending_qty ...
  const viewPoPendingInwardList = useMemo<ViewPoPendingInwardQty[]>(() => {
    const list: ViewPoPendingInwardQty[] = [];

    // Calculate total inward_qty received per (purchase_id, plateid)
    const inwardMap: Record<string, number> = {};
    poInwards.forEach((inw) => {
      if (inw.items) {
        inw.items.forEach((item) => {
          const key = `${inw.pid}_${item.plateid}`;
          inwardMap[key] = (inwardMap[key] || 0) + (item.inward_qty || 0);
        });
      }
    });

    purchases.forEach((po) => {
      if (po.status !== "0" && po.items) {
        po.items.forEach((item) => {
          const key = `${po.id}_${item.plateid}`;
          const receivedQty = inwardMap[key] || 0;
          const pendingQty = Math.max(item.qty - receivedQty, 0);

          list.push({
            id: po.id,
            srno: po.srno,
            pno: po.pno,
            vname: po.vname,
            vendorname: getCustomerName(po.vname),
            cname: po.cname,
            customername: getCustomerName(po.cname),
            projectid: po.projectid,
            description: `${item.materialtype} plate for mould ${po.projectid}`,
            odate: po.odate,
            plateid: item.plateid,
            platename: item.platename || getSubplateName(item.plateid),
            material: item.material,
            materialtype: item.materialtype,
            qty: item.qty,
            inward_qty: receivedQty,
            pending_qty: pendingQty,
          });
        });
      }
    });

    return list;
  }, [purchases, poInwards, customers, subplates]);

  // Tab 1: Pending Receive Records where pending_qty != 0
  // Source: PurchaseController.php getPData() lines 201: ViewPurchaseModel::where('pending_qty', '!=', 0)
  const pendingReceiveItems = useMemo(() => {
    if (livePendingItems !== null && livePendingItems.length > 0) {
      return livePendingItems;
    }
    return viewPoPendingInwardList.filter((item) => item.pending_qty > 0);
  }, [livePendingItems, viewPoPendingInwardList]);

  // Tab 2: Fully Received / Inward History where pending_qty == 0 or inward receipts
  // Source: PurchaseController.php getPRData() lines 267: ViewPurchaseModel::where('pending_qty', '==', 0)
  const receivedItems = useMemo(() => {
    return viewPoPendingInwardList.filter((item) => item.inward_qty > 0 && item.pending_qty === 0);
  }, [viewPoPendingInwardList]);

  // Search filter
  const filteredPendingItems = useMemo(() => {
    if (!searchQuery.trim()) return pendingReceiveItems;
    const q = searchQuery.toLowerCase();
    return pendingReceiveItems.filter(
      (item) =>
        item.srno.toLowerCase().includes(q) ||
        item.projectid.toLowerCase().includes(q) ||
        item.vendorname.toLowerCase().includes(q) ||
        item.customername.toLowerCase().includes(q) ||
        item.platename.toLowerCase().includes(q) ||
        item.materialtype.toLowerCase().includes(q)
    );
  }, [pendingReceiveItems, searchQuery]);

  const filteredInwardReceipts = useMemo(() => {
    if (!searchQuery.trim()) return poInwards;
    const q = searchQuery.toLowerCase();
    return poInwards.filter(
      (inw) =>
        inw.insrno.toLowerCase().includes(q) ||
        (inw.inpono && inw.inpono.toLowerCase().includes(q)) ||
        inw.projectid.toLowerCase().includes(q) ||
        getCustomerName(inw.vname).toLowerCase().includes(q)
    );
  }, [poInwards, searchQuery]);

  // Pagination
  const totalPages =
    activeTab === "pending_receive"
      ? Math.ceil(filteredPendingItems.length / pageSize) || 1
      : Math.ceil(filteredInwardReceipts.length / pageSize) || 1;

  const paginatedPendingItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPendingItems.slice(start, start + pageSize);
  }, [filteredPendingItems, currentPage, pageSize]);

  const paginatedInwardReceipts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInwardReceipts.slice(start, start + pageSize);
  }, [filteredInwardReceipts, currentPage, pageSize]);

  // Open Receive Modal for a pending item
  const handleOpenReceiveModal = (item: ViewPoPendingInwardQty) => {
    setSelectedPendingPO(item);
    setReceiveForm({
      odate: new Date().toISOString().slice(0, 10),
      inpono: `DC-${Math.floor(1000 + Math.random() * 9000)}`,
      receiveQtys: { [item.plateid]: item.pending_qty },
    });
    setReceiveError(null);
    setIsReceiveModalOpen(true);
  };

  // Submit Inward Receipt
  // Source: PurchaseInwardController.php store() lines 91-140
  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendingPO) return;

    const receivingQty = Number(receiveForm.receiveQtys[selectedPendingPO.plateid] || 0);
    if (receivingQty <= 0) {
      setReceiveError("Receiving quantity must be at least 1.");
      return;
    }
    if (receivingQty > selectedPendingPO.pending_qty) {
      setReceiveError(`Receiving quantity cannot exceed pending quantity (${selectedPendingPO.pending_qty}).`);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/purchase-inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid: selectedPendingPO.id,
          inpono: receiveForm.inpono.trim() || null,
          cname: selectedPendingPO.cname,
          vname: selectedPendingPO.vname,
          projectid: selectedPendingPO.projectid,
          odate: receiveForm.odate,
          items: [
            {
              plateid: selectedPendingPO.plateid,
              material: selectedPendingPO.material,
              imaterial: selectedPendingPO.material,
              materialtype: selectedPendingPO.materialtype,
              qty: selectedPendingPO.qty,
              inward_qty: receivingQty,
            },
          ],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setReceiveError(data.error || "Failed to record receipt");
        return;
      }

      setIsReceiveModalOpen(false);
      await fetchInwardData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error saving receipt";
      setReceiveError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle inward receipt child expansion
  const toggleInwardRow = (id: number) => {
    setExpandedInwardRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "PO No.",
      "Order Date",
      "Supplier",
      "Customer",
      "Mould",
      "Plate Name",
      "Material Type",
      "Ordered Qty",
      "Received Qty",
      "Pending Qty",
    ];
    const rows = filteredPendingItems.map((it) => [
      `"${it.srno}"`,
      `"${it.odate}"`,
      `"${it.vendorname.replace(/"/g, '""')}"`,
      `"${it.customername.replace(/"/g, '""')}"`,
      `"${it.projectid}"`,
      `"${it.platename.replace(/"/g, '""')}"`,
      `"${it.materialtype}"`,
      it.qty,
      it.inward_qty,
      it.pending_qty,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute(
      "download",
      `starmould_pending_receive_${new Date().toISOString().slice(0, 10)}.csv`
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
              <PackagePlus className="h-3.5 w-3.5 text-emerald-600" />
              <span>Procurement</span>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-300">Receiving Pipeline</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Purchase Inward & Pending Receive
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                `view_po_pending_inward_qty`
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Receiving goods against active raw material purchase orders (What is still owed from vendor)
            </p>
          </div>

          <Link
            href="/purchase"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition shadow-sm"
          >
            <ShoppingCart className="w-4 h-4 text-blue-600" />
            <span>View All Purchase Orders</span>
          </Link>
        </div>

        {/* Top Control Bar: Tabs & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Main Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            <button
              onClick={() => {
                setActiveTab("pending_receive");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "pending_receive"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pending Receive (Owed from Vendor)</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                {pendingReceiveItems.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("inward_history");
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === "inward_history"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/80 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Inward Receipt Log (`po_inward`)</span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                {poInwards.length}
              </span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              title="Export pending receive records to CSV (exportpurchaserec)"
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
          </div>
        </div>

        {/* Toolbar: Search & Pagination */}
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
                  activeTab === "pending_receive"
                    ? "Search PO number, supplier, customer, mould, plate..."
                    : "Search receipt number (SM/PR/xx), vendor, delivery note..."
                }
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
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
        {/* TAB 1: PENDING RECEIVE (ViewPurchaseModel::where('pending_qty', '!=', 0)) */}
        {/* ========================================================================= */}
        {activeTab === "pending_receive" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-[10%]">PO. No.</th>
                    <th className="py-3 px-3 w-[10%]">Order Date</th>
                    <th className="py-3 px-4 w-[13%]">Mould</th>
                    <th className="py-3 px-4 w-[17%]">Plate Name</th>
                    <th className="py-3 px-4 w-[16%]">Supplier Name</th>
                    <th className="py-3 px-4 w-[16%]">Customer Name</th>
                    <th className="py-3 px-3 w-[8%] text-center">Pending Qty</th>
                    <th className="py-3 px-4 w-[10%] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedPendingItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                        <p>No open purchase orders with pending quantities. All materials received!</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedPendingItems.map((item, idx) => (
                      <tr
                        key={`${item.id}_${item.plateid}_${idx}`}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* PO No. */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[12px] text-blue-700 dark:text-blue-400">
                            {item.srno}
                          </span>
                        </td>

                        {/* Order Date */}
                        <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                          {item.odate}
                        </td>

                        {/* Mould */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.projectid}
                          </span>
                        </td>

                        {/* Plate Name & Spec */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.platename}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.materialtype} · {item.material}
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span className="truncate max-w-[170px]" title={item.vendorname}>
                              {item.vendorname}
                            </span>
                          </div>
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          <span className="truncate max-w-[170px] block" title={item.customername}>
                            {item.customername}
                          </span>
                        </td>

                        {/* Pending Qty */}
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            {item.pending_qty} / {item.qty}
                          </span>
                        </td>

                        {/* Action: Receive button */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenReceiveModal(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition active:scale-95"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Receive</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-List Fallback (< md) */}
            <div className="block md:hidden p-3 space-y-3">
              {paginatedPendingItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No open purchase orders with pending quantities.
                </div>
              ) : (
                paginatedPendingItems.map((item, idx) => (
                  <div
                    key={`${item.id}_${item.plateid}_${idx}`}
                    className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                        {item.srno}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {item.odate}
                      </span>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {item.platename || `Plate #${item.plateid}`}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Mould: {item.projectid} {item.materialtype ? `(${item.materialtype})` : ""}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Supplier:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {item.vendorname || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Customer:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                          {item.customername || "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        Pending Qty: {item.pending_qty}
                      </span>
                      <button
                        onClick={() => handleOpenReceiveModal(item)}
                        className="min-h-[40px] px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/60 transition flex items-center justify-center cursor-pointer"
                      >
                        Receive
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredPendingItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, filteredPendingItems.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredPendingItems.length}
                </span>{" "}
                items pending receipt
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
        {/* TAB 2: INWARD LOG (`po_inward` receipts)                                  */}
        {/* Source: purchaseitems.blade.php & PurchaseInwardController::store         */}
        {/* ========================================================================= */}
        {activeTab === "inward_history" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 w-[4%] text-center"></th>
                    <th className="py-3 px-4 w-[12%]">Inward No. (insrno)</th>
                    <th className="py-3 px-3 w-[12%]">Delivery Note (inpono)</th>
                    <th className="py-3 px-3 w-[10%]">Receive Date</th>
                    <th className="py-3 px-4 w-[16%]">Mould Project</th>
                    <th className="py-3 px-4 w-[22%]">Supplier Name</th>
                    <th className="py-3 px-4 w-[20%]">Customer Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {paginatedInwardReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <PackagePlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No purchase inward receipts recorded yet.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedInwardReceipts.map((inw) => {
                      const isExpanded = Boolean(expandedInwardRows[inw.id]);
                      const vendorName = getCustomerName(inw.vname);
                      const clientName = getCustomerName(inw.cname);

                      return (
                        <React.Fragment key={inw.id}>
                          <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => toggleInwardRow(inw.id)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            </td>

                            <td className="py-3 px-4 font-mono font-bold text-[12px] text-emerald-700 dark:text-emerald-400">
                              {inw.insrno}
                            </td>

                            <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                              {inw.inpono || "—"}
                            </td>

                            <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                              {inw.odate}
                            </td>

                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {inw.projectid}
                              </span>
                            </td>

                            <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                              {vendorName}
                            </td>

                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                              {clientName}
                            </td>
                          </tr>

                          {/* Expanded items for this inward receipt */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-950/50">
                              <td colSpan={7} className="p-4 pl-12 border-y border-slate-200 dark:border-slate-800">
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                  <div className="px-4 py-2 bg-slate-100/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Received Items for {inw.insrno}
                                  </div>
                                  <div className="overflow-x-auto w-full">
                                    <table className="w-full text-xs text-left">
                                      <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                          <th className="py-2 px-4">Plate Name</th>
                                          <th className="py-2 px-4">Dimensions / Material</th>
                                          <th className="py-2 px-4">Material Type</th>
                                          <th className="py-2 px-4 text-center">Inward Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {inw.items && inw.items.length > 0 ? (
                                          inw.items.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                              <td className="py-2 px-4 font-semibold text-slate-800 dark:text-slate-200">
                                                {it.platename || getSubplateName(it.plateid)}
                                              </td>
                                              <td className="py-2 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                {it.imaterial || it.material || "—"}
                                              </td>
                                              <td className="py-2 px-4">
                                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                  {it.materialtype}
                                                </span>
                                              </td>
                                              <td className="py-2 px-4 text-center font-bold text-emerald-700 dark:text-emerald-400">
                                                +{it.inward_qty}
                                              </td>
                                            </tr>
                                          ))
                                        ) : (
                                          <tr>
                                            <td colSpan={4} className="py-3 text-center text-slate-400 text-xs">
                                              No line items.
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

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Showing{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredInwardReceipts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, filteredInwardReceipts.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredInwardReceipts.length}
                </span>{" "}
                receipts
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
        {/* RECEIVE PURCHASE MODAL                                                    */}
        {/* Source: purchaselist.blade.php lines 92-180 & PurchaseInwardController    */}
        {/* ========================================================================= */}
        {isReceiveModalOpen && selectedPendingPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span>Receive Purchase Material (Inward)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Source: purchaselist.blade.php / PurchaseInwardController::store
                  </p>
                </div>
                <button
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitReceive} className="p-6 space-y-4 text-xs">
                {receiveError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{receiveError}</span>
                  </div>
                )}

                {/* Today's Receive Date */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Receive Date (odate) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={receiveForm.odate}
                      onChange={(e) =>
                        setReceiveForm((p) => ({ ...p, odate: e.target.value }))
                      }
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white"
                    />
                  </div>
                </div>

                {/* Readonly PO Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      PO Reference
                    </span>
                    <div className="font-mono font-bold text-blue-700 dark:text-blue-400">
                      {selectedPendingPO.srno}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Mould Project
                    </span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {selectedPendingPO.projectid}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Supplier Name
                    </span>
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {selectedPendingPO.vendorname}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Customer Name
                    </span>
                    <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                      {selectedPendingPO.customername}
                    </div>
                  </div>
                </div>

                {/* Delivery Note / Inward Challan No (inpono) */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Vendor Delivery Note / Challan No (inpono) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={receiveForm.inpono}
                    onChange={(e) =>
                      setReceiveForm((p) => ({ ...p, inpono: e.target.value }))
                    }
                    placeholder="e.g. DC-7741 or Supplier Invoice #"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:text-white font-mono"
                  />
                </div>

                {/* Plate Receiving Quantity Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    Material Item Receiving
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {selectedPendingPO.platename}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {selectedPendingPO.materialtype} · {selectedPendingPO.material}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                          Ordered / Still Pending
                        </span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {selectedPendingPO.qty} ord /{" "}
                          <span className="text-amber-600 dark:text-amber-400">
                            {selectedPendingPO.pending_qty} pend
                          </span>
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                      <label className="font-medium text-slate-700 dark:text-slate-300">
                        Quantity Receiving Now (inward_qty):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={selectedPendingPO.pending_qty}
                        required
                        value={
                          receiveForm.receiveQtys[selectedPendingPO.plateid] ??
                          selectedPendingPO.pending_qty
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setReceiveForm((p) => ({
                            ...p,
                            receiveQtys: {
                              ...p.receiveQtys,
                              [selectedPendingPO.plateid]: val,
                            },
                          }));
                        }}
                        className="w-24 px-3 py-1.5 font-bold font-mono text-center text-sm bg-slate-50 dark:bg-slate-950 border border-emerald-400 dark:border-emerald-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm"
                  >
                    Confirm Inward Receipt
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
