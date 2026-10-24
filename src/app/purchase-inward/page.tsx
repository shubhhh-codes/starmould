"use client";

import React, { useState, useMemo, useEffect } from "react";
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
    LayoutGrid,
    List,
    Scale,
    Boxes,
    PackageCheck,
    Maximize2,
    Minimize2,
    Plus,
    RefreshCw,
    Filter,
} from "lucide-react";
import type {
    PurchaseOrder,
    PurchaseInwardReceipt,
    Customer,
    Subplate,
    ViewPoPendingInwardQty,
} from "@/lib/supabase/types";
import { TableSkeletonRows } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import {
    usePurchaseInwardQuery,
    useCreatePurchaseInwardMutation,
    useCustomerDropdownQuery,
    useVendorDropdownQuery,
} from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { calculateSubplateWeight } from "@/lib/weight-calculator";

export default function PurchaseInwardPage() {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const isRestoring = useIsRestoring();
    const queryClient = useQueryClient();
    const { data: inwardData, isLoading: queryLoading, isFetching, refetch } = usePurchaseInwardQuery();
    const createInwardMutation = useCreatePurchaseInwardMutation();
    const { data: customerData = [] } = useCustomerDropdownQuery("Customer");
    const { data: vendorData = [] } = useVendorDropdownQuery("Supplier");

    const purchases: PurchaseOrder[] = [];
    const poInwards = inwardData?.receipts || [];
    const customers = (customerData.length > 0 ? customerData : inwardData?.customers) || [];
    const subplates = inwardData?.subplates || [];
    const livePendingItems = inwardData?.pendingReceiveItems || null;
    const hasLoadedData =
        poInwards.length > 0 ||
        (livePendingItems && livePendingItems.length > 0) ||
        (!!inwardData && !queryLoading);
    const isLoading = isRestoring || (!hasLoadedData && queryLoading);

    // Navigation Tabs: Pending Receive vs. Received Inward History
    const [activeTab, setActiveTab] = useState<"pending_receive" | "inward_history">("pending_receive");

    // View mode for Pending Receive: By Mould (Grouped) vs Flat Table
    const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
    const [collapsedMoulds, setCollapsedMoulds] = useState<Record<string, boolean>>({});

    // Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [mouldFilter, setMouldFilter] = useState<string>("ALL");
    const [vendorFilter, setVendorFilter] = useState<string>("ALL");
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedInwardRows, setExpandedInwardRows] = useState<Record<number, boolean>>({});

    // Receive Modal State (Supports single item or batch receive for a mould)
    const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
    const [selectedReceiveItems, setSelectedReceiveItems] = useState<ViewPoPendingInwardQty[]>([]);
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

    // Fast subplate lookup map
    const subplateMap = useMemo(() => {
        const map = new Map<number, Subplate>();
        subplates.forEach((sp) => map.set(sp.id, sp));
        return map;
    }, [subplates]);

    // Customer & Vendor name lookups
    const getCustomerName = (id: number) => {
        const found = customers.find((c) => c.id === id);
        return found ? found.customername : `ID: ${id}`;
    };

    const getVendorName = (id: number) => {
        const found = vendorData.find((v) => v.id === id);
        return found ? found.vendor_name : `Vendor #${id}`;
    };

    const getSubplateName = (id: number) => {
        const found = subplateMap.get(id);
        return found ? found.platename : `Plate #${id}`;
    };

    // Calculate item weight in kg
    const getItemWeightKg = (item: ViewPoPendingInwardQty, subplate?: Subplate): number => {
        if (subplate?.weight && Number(subplate.weight) > 0) {
            return Number(subplate.weight);
        }
        if (subplate?.width && subplate?.length) {
            return calculateSubplateWeight({
                shape: subplate.shape || "Rectangle",
                material: item.materialtype || subplate.material || "MS-Bright",
                width: subplate.width,
                height: subplate.height || 0,
                length: subplate.length,
                unit: subplate.unit || "mm",
                quantity: 1,
            });
        }
        return 0;
    };

    // Pending Receive Records
    const pendingReceiveItems = useMemo(() => {
        if (livePendingItems !== null && livePendingItems.length > 0) {
            return livePendingItems;
        }
        return [];
    }, [livePendingItems]);

    // Filter options for dropdowns
    const availableMoulds = useMemo(() => {
        const set = new Set<string>();
        pendingReceiveItems.forEach((it) => {
            if (it.projectid) set.add(it.projectid);
        });
        return Array.from(set).sort();
    }, [pendingReceiveItems]);

    const availableVendors = useMemo(() => {
        const set = new Set<string>();
        pendingReceiveItems.forEach((it) => {
            if (it.vendorname) set.add(it.vendorname);
        });
        return Array.from(set).sort();
    }, [pendingReceiveItems]);

    // Filtered pending items based on search & active dropdowns
    const filteredPendingItems = useMemo(() => {
        return pendingReceiveItems.filter((item) => {
            if (mouldFilter !== "ALL" && item.projectid !== mouldFilter) return false;
            if (vendorFilter !== "ALL" && item.vendorname !== vendorFilter) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (item.srno && item.srno.toLowerCase().includes(q)) ||
                (item.projectid && item.projectid.toLowerCase().includes(q)) ||
                (item.vendorname && item.vendorname.toLowerCase().includes(q)) ||
                (item.customername && item.customername.toLowerCase().includes(q)) ||
                (item.platename && item.platename.toLowerCase().includes(q)) ||
                (item.materialtype && item.materialtype.toLowerCase().includes(q)) ||
                (item.material && item.material.toLowerCase().includes(q))
            );
        });
    }, [pendingReceiveItems, mouldFilter, vendorFilter, searchQuery]);

    // GROUPED BY MOULD for Pending Receive
    const pendingByMould = useMemo(() => {
        const groups: Record<
            string,
            {
                mouldCode: string;
                customerName: string;
                items: ViewPoPendingInwardQty[];
                totalOrderedUnits: number;
                totalReceivedUnits: number;
                totalPendingUnits: number;
                totalWeightKg: number;
                vendors: string[];
                poNumbers: string[];
                orderDates: string[];
            }
        > = {};

        filteredPendingItems.forEach((item) => {
            const code = item.projectid || "UNASSIGNED";
            if (!groups[code]) {
                groups[code] = {
                    mouldCode: code,
                    customerName: item.customername || "Unknown Customer",
                    items: [],
                    totalOrderedUnits: 0,
                    totalReceivedUnits: 0,
                    totalPendingUnits: 0,
                    totalWeightKg: 0,
                    vendors: [],
                    poNumbers: [],
                    orderDates: [],
                };
            }
            groups[code].items.push(item);
            groups[code].totalOrderedUnits += Number(item.qty) || 0;
            groups[code].totalReceivedUnits += Number(item.inward_qty) || 0;
            groups[code].totalPendingUnits += Number(item.pending_qty) || 0;

            const sp = subplateMap.get(item.plateid);
            const singleW = getItemWeightKg(item, sp);
            groups[code].totalWeightKg += singleW * (Number(item.pending_qty) || 1);

            if (item.vendorname && !groups[code].vendors.includes(item.vendorname)) {
                groups[code].vendors.push(item.vendorname);
            }
            if (item.srno && !groups[code].poNumbers.includes(item.srno)) {
                groups[code].poNumbers.push(item.srno);
            }
            if (item.odate && !groups[code].orderDates.includes(item.odate)) {
                groups[code].orderDates.push(item.odate);
            }
        });

        return Object.values(groups);
    }, [filteredPendingItems, subplateMap]);

    // Top Level Summary Metrics for Pending Receive
    const pendingMetrics = useMemo(() => {
        let mouldsSet = new Set<string>();
        let totalItems = 0;
        let totalPendingPcs = 0;
        let totalWeightKg = 0;

        filteredPendingItems.forEach((it) => {
            if (it.projectid) mouldsSet.add(it.projectid);
            totalItems += 1;
            totalPendingPcs += Number(it.pending_qty) || 0;
            const sp = subplateMap.get(it.plateid);
            totalWeightKg += getItemWeightKg(it, sp) * (Number(it.pending_qty) || 1);
        });

        return {
            mouldsCount: mouldsSet.size,
            platesCount: totalItems,
            pendingPcs: totalPendingPcs,
            weightKg: totalWeightKg,
            weightTons: totalWeightKg / 1000,
        };
    }, [filteredPendingItems, subplateMap]);

    // Filtered Inward Receipts for Tab 2
    const filteredInwardReceipts = useMemo(() => {
        if (!searchQuery.trim()) return poInwards;
        const q = searchQuery.toLowerCase();
        return poInwards.filter(
            (inw) =>
                inw.insrno.toLowerCase().includes(q) ||
                (inw.inpono && inw.inpono.toLowerCase().includes(q)) ||
                inw.projectid.toLowerCase().includes(q) ||
                getVendorName(inw.vname).toLowerCase().includes(q),
        );
    }, [poInwards, searchQuery]);

    // Pagination for Flat Table
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

    // Accordion Toggle
    const toggleCollapseMould = (mouldCode: string) => {
        setCollapsedMoulds((prev) => ({
            ...prev,
            [mouldCode]: !prev[mouldCode],
        }));
    };

    const handleExpandAll = () => {
        setCollapsedMoulds({});
    };

    const handleCollapseAll = () => {
        const all: Record<string, boolean> = {};
        pendingByMould.forEach((g) => {
            all[g.mouldCode] = true;
        });
        setCollapsedMoulds(all);
    };

    // Open Receive Modal for a single plate
    const handleOpenReceiveModal = (item: ViewPoPendingInwardQty) => {
        setSelectedReceiveItems([item]);
        setReceiveForm({
            odate: new Date().toISOString().slice(0, 10),
            inpono: "",
            receiveQtys: { [item.plateid]: item.pending_qty },
        });
        setReceiveError(null);
        setIsReceiveModalOpen(true);
    };

    // Open Receive Modal for an entire mould group
    const handleOpenMouldBatchReceive = (items: ViewPoPendingInwardQty[]) => {
        if (!items || items.length === 0) return;
        setSelectedReceiveItems(items);
        const qtys: Record<number, number> = {};
        items.forEach((it) => {
            qtys[it.plateid] = it.pending_qty;
        });
        setReceiveForm({
            odate: new Date().toISOString().slice(0, 10),
            inpono: "",
            receiveQtys: qtys,
        });
        setReceiveError(null);
        setIsReceiveModalOpen(true);
    };

    // Wheel quantity adjustment
    const handleQtyWheel = (
        e: React.WheelEvent<HTMLInputElement>,
        plateid: number,
        maxQty: number,
    ) => {
        e.preventDefault();
        const current = Number(receiveForm.receiveQtys[plateid] ?? maxQty);
        if (e.deltaY < 0) {
            if (current < maxQty) {
                setReceiveForm((prev) => ({
                    ...prev,
                    receiveQtys: { ...prev.receiveQtys, [plateid]: current + 1 },
                }));
            }
        } else if (e.deltaY > 0) {
            if (current > 1) {
                setReceiveForm((prev) => ({
                    ...prev,
                    receiveQtys: { ...prev.receiveQtys, [plateid]: current - 1 },
                }));
            }
        }
    };

    // Submit Inward Receipt (Single item or multi-item batch)
    const handleSubmitReceive = async (e: React.FormEvent) => {
        e.preventDefault();
        if (createInwardMutation.isPending) return;
        if (selectedReceiveItems.length === 0) return;

        if (!receiveForm.inpono.trim()) {
            setReceiveError("Delivery Note / Vendor Challan No (inpono) is required.");
            return;
        }

        // Validate quantities
        for (const item of selectedReceiveItems) {
            const qty = Number(receiveForm.receiveQtys[item.plateid] || 0);
            if (qty <= 0) {
                setReceiveError(`Receiving quantity for "${item.platename}" must be at least 1.`);
                return;
            }
            if (qty > item.pending_qty) {
                setReceiveError(
                    `Receiving quantity for "${item.platename}" cannot exceed pending quantity (${item.pending_qty}).`,
                );
                return;
            }
        }

        try {
            // Group by purchase order id (pid) so each PO gets an inward receipt
            const poGroups: Record<number, ViewPoPendingInwardQty[]> = {};
            selectedReceiveItems.forEach((it) => {
                if (!poGroups[it.id]) poGroups[it.id] = [];
                poGroups[it.id].push(it);
            });

            for (const [poIdStr, groupItems] of Object.entries(poGroups)) {
                const first = groupItems[0];
                await createInwardMutation.mutateAsync({
                    pid: Number(poIdStr),
                    inpono: receiveForm.inpono.trim() || null,
                    cname: first.cname,
                    vname: first.vname,
                    projectid: first.projectid,
                    odate: receiveForm.odate,
                    items: groupItems.map((it) => ({
                        plateid: it.plateid,
                        material: it.material,
                        imaterial: it.material,
                        materialtype: it.materialtype,
                        qty: it.qty,
                        inward_qty: Number(receiveForm.receiveQtys[it.plateid] || it.pending_qty),
                    })),
                });
            }

            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseInward.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
            queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
            setIsReceiveModalOpen(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Error saving receipt";
            setReceiveError(message);
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
            `starmould_pending_receive_${new Date().toISOString().slice(0, 10)}.csv`,
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
                            <span className="text-slate-600">Receiving Pipeline</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            Purchase Inward & Material Gate Receipt
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Receiving raw steel & plates against active purchase orders (Grouped by Mould project)
                        </p>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isMounted && isFetching}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                            title="Refresh inward records from server"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isMounted && isFetching ? "animate-spin text-blue-600" : ""}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                            title="Export pending receive records to CSV"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                            <span>Print</span>
                        </button>
                    </div>
                </div>

                {/* Top Control Bar: Tabs */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Main Navigation Tabs */}
                    <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
                        <button
                            onClick={() => {
                                setActiveTab("pending_receive");
                                setCurrentPage(1);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === "pending_receive"
                                    ? "bg-white text-slate-900 shadow-2xs font-semibold border border-slate-200/80"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Receive</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-50 text-amber-700 font-bold border border-amber-200/60">
                                {pendingReceiveItems.length}
                            </span>
                        </button>

                        <button
                            onClick={() => {
                                setActiveTab("inward_history");
                                setCurrentPage(1);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === "inward_history"
                                    ? "bg-white text-slate-900 shadow-2xs font-semibold border border-slate-200/80"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Inward Receipt Log</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/60">
                                {poInwards.length}
                            </span>
                        </button>
                    </div>

                    {/* View Switcher for Tab 1 (By Mould vs Flat Table) */}
                    {activeTab === "pending_receive" && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("grouped")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === "grouped"
                                            ? "bg-white text-emerald-700 shadow-2xs font-bold"
                                            : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span>By Mould</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("flat")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition ${viewMode === "flat"
                                            ? "bg-white text-emerald-700 shadow-2xs font-bold"
                                            : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    <List className="w-3.5 h-3.5" />
                                    <span>Flat Table</span>
                                </button>
                            </div>

                            {/* Expand / Collapse All for Grouped View */}
                            {viewMode === "grouped" && pendingByMould.length > 0 && (
                                <div className="hidden sm:flex items-center gap-1 text-xs">
                                    <button
                                        type="button"
                                        onClick={handleExpandAll}
                                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
                                        title="Expand all mould cards"
                                    >
                                        <Maximize2 className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                                        <span>Expand All</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCollapseAll}
                                        className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
                                        title="Collapse all mould cards"
                                    >
                                        <Minimize2 className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                                        <span>Collapse All</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ========================================================================= */}
                {/* TAB 1: PENDING RECEIVE (Grouped by Mould / Flat Table) */}
                {/* ========================================================================= */}
                {activeTab === "pending_receive" && (
                    <div className="space-y-4">
                        {/* 1. TOP METRICS STRIP */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span className="font-medium">Moulds Pending</span>
                                    <Boxes className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 font-mono">
                                    {pendingMetrics.mouldsCount}
                                </div>
                                <span className="text-[10px] text-slate-400">Active mould projects</span>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span className="font-medium">Pending Plates</span>
                                    <PackagePlus className="w-4 h-4 text-amber-500" />
                                </div>
                                <div className="text-xl font-bold text-amber-700 font-mono">
                                    {pendingMetrics.platesCount}
                                </div>
                                <span className="text-[10px] text-slate-400">Total plate line items</span>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span className="font-medium">Pending Units</span>
                                    <Layers className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="text-xl font-bold text-emerald-700 font-mono">
                                    {pendingMetrics.pendingPcs}{" "}
                                    <span className="text-xs font-normal text-slate-500">pcs</span>
                                </div>
                                <span className="text-[10px] text-slate-400">Owed pieces from vendors</span>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                    <span className="font-medium">Estimated Weight</span>
                                    <Scale className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 font-mono truncate">
                                    {pendingMetrics.weightKg >= 1000
                                        ? `${pendingMetrics.weightTons.toFixed(2)} T`
                                        : `${pendingMetrics.weightKg.toFixed(1)} kg`}
                                </div>
                                <span className="text-[10px] text-slate-400">
                                    ~{pendingMetrics.weightKg.toFixed(0)} kg theoretical
                                </span>
                            </div>
                        </div>

                        {/* 2. TOOLBAR: Search & Filters */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                {/* Search Bar */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        placeholder="Search PO no., mould, plate, supplier, customer..."
                                        className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Dropdown Filters & Rows Per Page */}
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {/* Mould Filter */}
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="text-slate-500 hidden sm:inline">Mould:</span>
                                        <select
                                            value={mouldFilter}
                                            onChange={(e) => {
                                                setMouldFilter(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono"
                                        >
                                            <option value="ALL">All Moulds ({availableMoulds.length})</option>
                                            {availableMoulds.map((m) => (
                                                <option key={m} value={m}>
                                                    {m}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Supplier Filter */}
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="text-slate-500 hidden sm:inline">Supplier:</span>
                                        <select
                                            value={vendorFilter}
                                            onChange={(e) => {
                                                setVendorFilter(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                                        >
                                            <option value="ALL">All Suppliers ({availableVendors.length})</option>
                                            {availableVendors.map((v) => (
                                                <option key={v} value={v}>
                                                    {v}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Rows per page for flat table */}
                                    {viewMode === "flat" && (
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <span className="text-slate-500">Rows:</span>
                                            <select
                                                value={pageSize}
                                                onChange={(e) => {
                                                    setPageSize(Number(e.target.value));
                                                    setCurrentPage(1);
                                                }}
                                                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                                            >
                                                <option value={10}>10</option>
                                                <option value={25}>25</option>
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Reset Filters button */}
                                    {(mouldFilter !== "ALL" || vendorFilter !== "ALL" || searchQuery) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery("");
                                                setMouldFilter("ALL");
                                                setVendorFilter("ALL");
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                            title="Clear active filters"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 3. VIEW MODE A: GROUPED BY MOULD (Recommended UX) */}
                        {viewMode === "grouped" && (
                            <div className="space-y-4">
                                {isLoading ? (
                                    <div className="space-y-4">
                                        {[1, 2, 3].map((cardIdx) => (
                                            <div
                                                key={cardIdx}
                                                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                                            >
                                                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between animate-pulse">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-6 w-28 bg-slate-200 rounded-md" />
                                                        <div className="h-5 w-36 bg-slate-200 rounded" />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-7 w-24 bg-slate-200 rounded-lg" />
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <tbody className="divide-y divide-slate-100">
                                                            <TableSkeletonRows rows={2} columns={7} />
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : pendingByMould.length === 0 ? (
                                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-60" />
                                        <h3 className="text-sm font-semibold text-slate-800 mb-1">
                                            No Pending Materials Owed
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                                            {searchQuery || mouldFilter !== "ALL" || vendorFilter !== "ALL"
                                                ? "No pending receipts match your active filters. Try resetting search or filter selections."
                                                : "All purchased raw materials and plates have been received and inwarded at the gate!"}
                                        </p>
                                    </div>
                                ) : (
                                    pendingByMould.map((group) => {
                                        const isCollapsed = Boolean(collapsedMoulds[group.mouldCode]);

                                        return (
                                            <div
                                                key={group.mouldCode}
                                                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs transition-all hover:border-slate-300"
                                            >
                                                {/* Mould Card Header */}
                                                <div className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                    {/* Left: Mould Identification & Customer */}
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {/* Mould Code Badge */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-bold text-sm text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                                                                Mould #{group.mouldCode}
                                                            </span>
                                                        </div>

                                                        {/* Customer Name & Reference Pills */}
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="font-semibold text-xs text-slate-800 truncate"
                                                                    title={group.customerName}
                                                                >
                                                                    {group.customerName}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                                                {group.vendors.length > 0 && (
                                                                    <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                                        <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                                                        {group.vendors.join(", ")}
                                                                    </span>
                                                                )}
                                                                {group.poNumbers.length > 0 && (
                                                                    <span className="inline-flex items-center gap-1 font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                                                                        <ShoppingCart className="w-2.5 h-2.5 text-blue-500" />
                                                                        {group.poNumbers.join(", ")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: Quick Stats & Batch Inward Action */}
                                                    <div className="flex items-center justify-between md:justify-end gap-2.5">
                                                        {/* Stats Badges */}
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                                                                {group.items.length} Plates ({group.totalPendingUnits} pcs pending)
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-semibold flex items-center gap-1">
                                                                <Scale className="w-3 h-3 text-emerald-600" />
                                                                ~{group.totalWeightKg.toFixed(1)} kg
                                                            </span>
                                                        </div>

                                                        {/* Batch Inward All for this Mould */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenMouldBatchReceive(group.items)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition active:scale-95 shrink-0"
                                                            title={`Receive inward for all ${group.items.length} pending plates of Mould ${group.mouldCode}`}
                                                        >
                                                            <ArrowDownLeft className="w-3.5 h-3.5" />
                                                            <span>Inward Mould ({group.items.length})</span>
                                                        </button>

                                                        {/* Accordion Collapse/Expand Chevron */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCollapseMould(group.mouldCode)}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
                                                            title={isCollapsed ? "Expand Plates" : "Collapse Plates"}
                                                        >
                                                            <ChevronDown
                                                                className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0 text-emerald-600"
                                                                    }`}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Mould Card Body: Plates Table */}
                                                {!isCollapsed && (
                                                    <div className="overflow-x-auto custom-scrollbar">
                                                        <table className="w-full text-xs text-left min-w-[900px]">
                                                            <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                                                                <tr>
                                                                    <th className="py-2.5 px-4 w-[16%]">PO Reference</th>
                                                                    <th className="py-2.5 px-4 w-[28%]">Plate Name & Material Specs</th>
                                                                    <th className="py-2.5 px-4 w-[20%]">Supplier</th>
                                                                    <th className="py-2.5 px-4 w-[14%] text-center">Ordered / Received</th>
                                                                    <th className="py-2.5 px-4 w-[12%] text-center">Pending Qty</th>
                                                                    <th className="py-2.5 px-4 w-[10%] text-right">Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {group.items.map((item, idx) => {
                                                                    const sp = subplateMap.get(item.plateid);
                                                                    const singleWeight = getItemWeightKg(item, sp);

                                                                    return (
                                                                        <tr
                                                                            key={`${item.id}_${item.plateid}_${idx}`}
                                                                            className="hover:bg-slate-50/80 transition-colors"
                                                                        >
                                                                            {/* PO Reference */}
                                                                            <td className="py-3 px-4">
                                                                                <div className="font-mono font-bold text-blue-700">
                                                                                    {item.srno || `PO #${item.id}`}
                                                                                </div>
                                                                                <div className="text-[11px] text-slate-400">
                                                                                    {item.odate || "—"}
                                                                                </div>
                                                                            </td>

                                                                            {/* Plate Name & Material Specs */}
                                                                            <td className="py-3 px-4">
                                                                                <div className="font-semibold text-slate-900 text-xs">
                                                                                    {item.platename || `Plate #${item.plateid}`}
                                                                                </div>
                                                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                                    {item.materialtype && (
                                                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                                                            {item.materialtype}
                                                                                        </span>
                                                                                    )}
                                                                                    <span className="font-mono text-[11px] text-slate-600">
                                                                                        {item.material || "—"}
                                                                                    </span>
                                                                                    {singleWeight > 0 && (
                                                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                                                            (~{singleWeight.toFixed(2)} kg/pc)
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>

                                                                            {/* Supplier */}
                                                                            <td className="py-3 px-4">
                                                                                <div className="font-medium text-slate-800 truncate max-w-[180px]">
                                                                                    {item.vendorname || "—"}
                                                                                </div>
                                                                            </td>

                                                                            {/* Ordered vs Received Qty */}
                                                                            <td className="py-3 px-4 text-center">
                                                                                <div className="font-mono text-slate-700 font-medium">
                                                                                    <span className="text-emerald-700 font-bold">
                                                                                        {item.inward_qty || 0}
                                                                                    </span>{" "}
                                                                                    / {item.qty}
                                                                                </div>
                                                                                <div className="w-16 mx-auto bg-slate-200 rounded-full h-1 overflow-hidden mt-1">
                                                                                    <div
                                                                                        className="bg-emerald-500 h-full rounded-full transition-all"
                                                                                        style={{
                                                                                            width: `${Math.min(
                                                                                                100,
                                                                                                Math.round(
                                                                                                    ((item.inward_qty || 0) /
                                                                                                        (item.qty || 1)) *
                                                                                                    100,
                                                                                                ),
                                                                                            )}%`,
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </td>

                                                                            {/* Pending Qty */}
                                                                            <td className="py-3 px-4 text-center">
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200">
                                                                                    {item.pending_qty} pcs
                                                                                </span>
                                                                            </td>

                                                                            {/* Action: Receive */}
                                                                            <td className="py-3 px-4 text-right">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleOpenReceiveModal(item)}
                                                                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition active:scale-95 shadow-2xs cursor-pointer"
                                                                                    title={`Receive material for ${item.platename}`}
                                                                                >
                                                                                    <ArrowDownLeft className="w-3.5 h-3.5" />
                                                                                    <span>Receive</span>
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* 4. VIEW MODE B: FLAT TABLE (Across all moulds) */}
                        {viewMode === "flat" && (
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[1100px] text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="py-3 px-4 w-[11%]">PO. No.</th>
                                                <th className="py-3 px-3 w-[10%]">Order Date</th>
                                                <th className="py-3 px-4 w-[13%]">Mould</th>
                                                <th className="py-3 px-4 w-[18%]">Plate Name</th>
                                                <th className="py-3 px-4 w-[16%]">Supplier Name</th>
                                                <th className="py-3 px-4 w-[14%]">Customer Name</th>
                                                <th className="py-3 px-3 w-[8%] text-center">Pending Qty</th>
                                                <th className="py-3 px-4 w-[10%] text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {isLoading ? (
                                                <TableSkeletonRows rows={8} columns={8} />
                                            ) : paginatedPendingItems.length === 0 ? (
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
                                                        className="hover:bg-slate-50/70 transition-colors"
                                                    >
                                                        <td className="py-3 px-4 font-mono font-bold text-blue-700">
                                                            {item.srno || `PO #${item.id}`}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-slate-600">
                                                            {item.odate || "—"}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                                                {item.projectid}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-semibold text-slate-800">
                                                                {item.platename || `Plate #${item.plateid}`}
                                                            </div>
                                                            <div className="font-mono text-[11px] text-slate-500">
                                                                {item.materialtype ? `${item.materialtype} · ` : ""}
                                                                {item.material}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-slate-800">
                                                            {item.vendorname || "—"}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600 truncate max-w-[140px]">
                                                            {item.customername || "—"}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200">
                                                                {item.pending_qty} / {item.qty}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenReceiveModal(item)}
                                                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition active:scale-95 shadow-2xs"
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

                                {/* Pagination for Flat Table */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                                    <div>
                                        Showing{" "}
                                        <span className="font-semibold text-slate-800">
                                            {filteredPendingItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                        </span>{" "}
                                        to{" "}
                                        <span className="font-semibold text-slate-800">
                                            {Math.min(currentPage * pageSize, filteredPendingItems.length)}
                                        </span>{" "}
                                        of{" "}
                                        <span className="font-semibold text-slate-800">
                                            {filteredPendingItems.length}
                                        </span>{" "}
                                        items pending receipt
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-3 py-1 font-mono text-xs">
                                            {currentPage} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: INWARD LOG (`po_inward` receipts) */}
                {/* ========================================================================= */}
                {activeTab === "inward_history" && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[1000px] text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="py-3 px-3 w-[4%] text-center"></th>
                                        <th className="py-3 px-4 w-[12%]">Inward No.</th>
                                        <th className="py-3 px-3 w-[12%]">Delivery No.</th>
                                        <th className="py-3 px-3 w-[10%]">Receive Date</th>
                                        <th className="py-3 px-4 w-[14%]">Mould Project</th>
                                        <th className="py-3 px-4 w-[24%]">Supplier Name</th>
                                        <th className="py-3 px-4 w-[24%]">Customer Name</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <TableSkeletonRows rows={8} columns={7} />
                                    ) : paginatedInwardReceipts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                <PackagePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p>No historical purchase inward records found.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedInwardReceipts.map((inw) => {
                                            const isExpanded = Boolean(expandedInwardRows[inw.id]);
                                            const vendorName = getVendorName(inw.vname);
                                            const clientName = inw.customername || getCustomerName(inw.cname);

                                            return (
                                                <React.Fragment key={inw.id}>
                                                    <tr
                                                        onClick={() => toggleInwardRow(inw.id)}
                                                        className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isExpanded ? "bg-slate-50/50" : ""
                                                            }`}
                                                    >
                                                        <td className="py-3 px-3 text-center">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleInwardRow(inw.id);
                                                                }}
                                                                className="p-1 rounded text-slate-400 hover:text-slate-700"
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-4 h-4 text-emerald-600" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td className="py-3 px-4 font-mono font-bold text-[12px] text-emerald-700">
                                                            {inw.insrno}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-slate-700">
                                                            {inw.inpono || "—"}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-slate-700">
                                                            {inw.odate}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                                                {inw.projectid}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-medium text-slate-800">
                                                            {vendorName}
                                                        </td>
                                                        <td className="py-3 px-4 text-slate-600">
                                                            {clientName}
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Items for this inward receipt */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/90">
                                                            <td colSpan={7} className="p-4 pl-12 border-y border-slate-200">
                                                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                                    <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 text-xs font-semibold text-slate-700">
                                                                        Received Items for {inw.insrno}
                                                                    </div>
                                                                    <div className="overflow-x-auto w-full">
                                                                        <table className="w-full text-xs text-left">
                                                                            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                                                                <tr>
                                                                                    <th className="py-2 px-4">Plate Name</th>
                                                                                    <th className="py-2 px-4">Dimensions / Material</th>
                                                                                    <th className="py-2 px-4">Material Type</th>
                                                                                    <th className="py-2 px-4 text-center">Inward Qty</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100">
                                                                                {inw.items && inw.items.length > 0 ? (
                                                                                    inw.items.map((it, idx) => (
                                                                                        <tr key={idx} className="hover:bg-slate-50/50">
                                                                                            <td className="py-2 px-4 font-semibold text-slate-800">
                                                                                                {it.platename || getSubplateName(it.plateid)}
                                                                                            </td>
                                                                                            <td className="py-2 px-4 font-mono text-[11px] text-slate-600">
                                                                                                {it.imaterial || it.material || "—"}
                                                                                            </td>
                                                                                            <td className="py-2 px-4">
                                                                                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                                                                                                    {it.materialtype}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2 px-4 text-center font-bold text-emerald-700">
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

                        {/* Pagination for History */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                            <div>
                                Showing{" "}
                                <span className="font-semibold text-slate-800">
                                    {filteredInwardReceipts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                </span>{" "}
                                to{" "}
                                <span className="font-semibold text-slate-800">
                                    {Math.min(currentPage * pageSize, filteredInwardReceipts.length)}
                                </span>{" "}
                                of{" "}
                                <span className="font-semibold text-slate-800">
                                    {filteredInwardReceipts.length}
                                </span>{" "}
                                receipts
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 font-mono text-xs">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* RECEIVE PURCHASE MATERIAL MODAL (Responsive, Neat & Clean Architecture) */}
                {/* ========================================================================= */}
                <Modal
                    isOpen={isReceiveModalOpen && selectedReceiveItems.length > 0}
                    onClose={() => setIsReceiveModalOpen(false)}
                    title={
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0">
                                <PackagePlus className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                                        {selectedReceiveItems.length > 1
                                            ? `Batch Inward (${selectedReceiveItems.length} Plates)`
                                            : "Material Inward Receipt"}
                                    </span>
                                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                                        Mould #{selectedReceiveItems[0]?.projectid}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 font-normal mt-0.5 truncate">
                                    Record incoming raw materials at gate and update workshop inventory
                                </p>
                            </div>
                        </div>
                    }
                    size="2xl"
                >
                    {selectedReceiveItems.length > 0 && (() => {
                        let totalReceivingUnits = 0;
                        let totalPendingUnits = 0;
                        let totalWeightKg = 0;

                        selectedReceiveItems.forEach((it) => {
                            const q = Number(receiveForm.receiveQtys[it.plateid] ?? it.pending_qty);
                            totalReceivingUnits += q;
                            totalPendingUnits += it.pending_qty;
                            const sp = subplateMap.get(it.plateid);
                            totalWeightKg += getItemWeightKg(it, sp) * q;
                        });

                        return (
                            <form onSubmit={handleSubmitReceive} className="space-y-4 text-xs">
                                {receiveError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 flex items-center gap-2 text-xs animate-in fade-in">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <span>{receiveError}</span>
                                    </div>
                                )}

                                {/* 1. DELIVERY INFORMATION CARD */}
                                <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 sm:p-4 space-y-3">
                                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span>1. Inward Reference & Delivery Details</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        {/* Receive Date */}
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1 text-xs">
                                                Receive Date <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                <input
                                                    type="date"
                                                    required
                                                    value={receiveForm.odate}
                                                    onChange={(e) =>
                                                        setReceiveForm((p) => ({
                                                            ...p,
                                                            odate: e.target.value,
                                                        }))
                                                    }
                                                    className="w-full pl-9 pr-3 h-10 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                                                />
                                            </div>
                                        </div>

                                        {/* Delivery Note / Challan No */}
                                        <div>
                                            <label className="block font-medium text-slate-700 mb-1 text-xs">
                                                Vendor Delivery Challan / Invoice No <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                autoFocus
                                                value={receiveForm.inpono}
                                                onChange={(e) =>
                                                    setReceiveForm((p) => ({
                                                        ...p,
                                                        inpono: e.target.value,
                                                    }))
                                                }
                                                placeholder="e.g. DC-10492 or Supplier Invoice #"
                                                className="w-full px-3 h-10 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* 2. ORDER & SUPPLIER CONTEXT BANNER */}
                                <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                                                Mould Code
                                            </span>
                                            <span className="font-mono font-bold text-slate-900 text-xs">
                                                {selectedReceiveItems[0].projectid}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                                                PO Reference
                                            </span>
                                            <span className="font-mono font-bold text-blue-700 text-xs truncate block" title={Array.from(new Set(selectedReceiveItems.map((it) => it.srno))).join(", ")}>
                                                {Array.from(new Set(selectedReceiveItems.map((it) => it.srno))).join(", ")}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                                                Supplier
                                            </span>
                                            <span className="font-medium text-slate-800 text-xs truncate block" title={selectedReceiveItems[0].vendorname || "—"}>
                                                {selectedReceiveItems[0].vendorname || "—"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                                                Customer
                                            </span>
                                            <span className="font-medium text-slate-800 text-xs truncate block" title={selectedReceiveItems[0].customername || "—"}>
                                                {selectedReceiveItems[0].customername || "—"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. PLATES RECEIVING WORKSPACE */}
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                                    {/* Section Header */}
                                    <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 text-xs">
                                                2. Plates to Inward
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                                {selectedReceiveItems.length} Plates
                                            </span>
                                        </div>

                                        {/* Quick Action: Fill All Remaining */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allMax: Record<number, number> = {};
                                                selectedReceiveItems.forEach((it) => {
                                                    allMax[it.plateid] = it.pending_qty;
                                                });
                                                setReceiveForm((prev) => ({
                                                    ...prev,
                                                    receiveQtys: allMax,
                                                }));
                                            }}
                                            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline transition"
                                        >
                                            Reset / Fill All Max Pending
                                        </button>
                                    </div>

                                    {/* Plates List */}
                                    <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {selectedReceiveItems.map((item) => {
                                            const currentVal =
                                                receiveForm.receiveQtys[item.plateid] ?? item.pending_qty;
                                            const sp = subplateMap.get(item.plateid);
                                            const singleW = getItemWeightKg(item, sp);

                                            return (
                                                <div
                                                    key={item.plateid}
                                                    className="p-3 sm:p-3.5 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                                >
                                                    {/* Left: Plate Name & Specs */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-900 text-xs sm:text-sm">
                                                                {item.platename || `Plate #${item.plateid}`}
                                                            </span>
                                                            {item.materialtype && (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                                    {item.materialtype}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                                                            <span>Dimensions: {item.material || "—"}</span>
                                                            {singleW > 0 && (
                                                                <span className="text-slate-400">
                                                                    • ~{singleW.toFixed(2)} kg/pc
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right: Quantities & Controls */}
                                                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                                                        {/* Status Pill */}
                                                        <div className="text-left sm:text-right text-[11px]">
                                                            <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-tight">
                                                                Owed / Pending
                                                            </span>
                                                            <span className="font-mono text-slate-700 font-medium">
                                                                {item.qty} ord /{" "}
                                                                <span className="font-bold text-amber-700">
                                                                    {item.pending_qty} pend
                                                                </span>
                                                            </span>
                                                        </div>

                                                        {/* Stepper Control */}
                                                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const val = Number(currentVal || 1);
                                                                    if (val > 1) {
                                                                        setReceiveForm((prev) => ({
                                                                            ...prev,
                                                                            receiveQtys: {
                                                                                ...prev.receiveQtys,
                                                                                [item.plateid]: val - 1,
                                                                            },
                                                                        }));
                                                                    }
                                                                }}
                                                                disabled={currentVal <= 1}
                                                                className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm shadow-2xs transition active:scale-95"
                                                                title="Decrease quantity"
                                                            >
                                                                -
                                                            </button>

                                                            <input
                                                                type="number"
                                                                min={1}
                                                                max={item.pending_qty}
                                                                required
                                                                value={currentVal === 0 ? "" : currentVal}
                                                                onWheel={(e) =>
                                                                    handleQtyWheel(e, item.plateid, item.pending_qty)
                                                                }
                                                                onChange={(e) => {
                                                                    const valStr = e.target.value;
                                                                    if (valStr === "") {
                                                                        setReceiveForm((prev) => ({
                                                                            ...prev,
                                                                            receiveQtys: {
                                                                                ...prev.receiveQtys,
                                                                                [item.plateid]: 0,
                                                                            },
                                                                        }));
                                                                        return;
                                                                    }
                                                                    const num = parseInt(valStr.replace(/\D/g, ""), 10);
                                                                    if (isNaN(num)) return;
                                                                    const clamped = Math.min(
                                                                        Math.max(1, num),
                                                                        item.pending_qty,
                                                                    );
                                                                    setReceiveForm((prev) => ({
                                                                        ...prev,
                                                                        receiveQtys: {
                                                                            ...prev.receiveQtys,
                                                                            [item.plateid]: clamped,
                                                                        },
                                                                    }));
                                                                }}
                                                                className="w-14 h-7 font-bold font-mono text-center text-xs bg-white border border-emerald-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                            />

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const val = Number(currentVal || 0);
                                                                    if (val < item.pending_qty) {
                                                                        setReceiveForm((prev) => ({
                                                                            ...prev,
                                                                            receiveQtys: {
                                                                                ...prev.receiveQtys,
                                                                                [item.plateid]: val + 1,
                                                                            },
                                                                        }));
                                                                    }
                                                                }}
                                                                disabled={currentVal >= item.pending_qty}
                                                                className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm shadow-2xs transition active:scale-95"
                                                                title="Increase quantity"
                                                            >
                                                                +
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setReceiveForm((prev) => ({
                                                                        ...prev,
                                                                        receiveQtys: {
                                                                            ...prev.receiveQtys,
                                                                            [item.plateid]: item.pending_qty,
                                                                        },
                                                                    }));
                                                                }}
                                                                className="px-1.5 h-7 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[10px] font-bold hover:bg-emerald-100 transition active:scale-95 ml-0.5"
                                                                title="Set to max pending quantity"
                                                            >
                                                                Max
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 4. MODAL FOOTER */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                                    {/* Left: Summary Counter */}
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-500">Inwarding:</span>
                                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            {totalReceivingUnits} of {totalPendingUnits} pcs
                                        </span>
                                        {totalWeightKg > 0 && (
                                            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                                                (~{totalWeightKg.toFixed(1)} kg)
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsReceiveModalOpen(false)}
                                            className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition text-xs font-semibold cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <MotionButton
                                            type="submit"
                                            loading={createInwardMutation.isPending}
                                            variant="primary"
                                            size="sm"
                                            className="px-5 py-2 font-semibold text-xs rounded-xl shadow-2xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                        >
                                            Confirm Inward Receipt ({totalReceivingUnits} pcs)
                                        </MotionButton>
                                    </div>
                                </div>
                            </form>
                        );
                    })()}
                </Modal>
            </div>
        </AppLayout>
    );
}
