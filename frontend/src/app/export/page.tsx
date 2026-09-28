"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
    FileDown,
    FileSpreadsheet,
    Layers,
    ShoppingCart,
    Truck,
    PackagePlus,
    ArrowUpRight,
    Briefcase,
    CheckCircle2,
    DownloadCloud,
    RefreshCw,
} from "lucide-react";
import { CardGridSkeleton } from "@/components/ui/skeleton";

export interface ExportDataset {
    id: string;
    method: string;
    title: string;
    filename: string;
    description: string;
    queryFilter: string;
    icon: React.ElementType;
    columns: string[];
}

// Standard ERP exports
export const exportDatasets: ExportDataset[] = [
    {
        id: "export",
        method: "Purchases",
        title: "Active Purchases",
        filename: "purchase.csv",
        description:
            "Purchase orders with customer and line items details where status is active.",
        queryFilter: "Active purchase orders with line items & vendor data",
        icon: ShoppingCart,
        columns: [
            "PO No",
            "Customer",
            "Vendor",
            "Order Date",
            "Material",
            "Type",
            "Qty",
            "Status",
        ],
    },
    {
        id: "exportmould",
        method: "Moulds",
        title: "Pending Mould Dashboard",
        filename: "dashboard.csv",
        description:
            "Active production moulds with associated subplate counts and completion tracking.",
        queryFilter: "Active production moulds excluding standalone samples",
        icon: Layers,
        columns: [
            "ID",
            "Project Code",
            "Customer",
            "Description",
            "Work Type",
            "RDate",
            "CDate",
            "Plates Count",
        ],
    },
    {
        id: "exportmouldreg",
        method: "Register",
        title: "Project Register",
        filename: "project_register.csv",
        description:
            "Full register of commercial mould projects and customer accounts.",
        queryFilter: "Registered moulds with customer billing and QC records",
        icon: Briefcase,
        columns: [
            "ID",
            "Project Code",
            "Customer",
            "Description",
            "Amount",
            "QC By",
            "Status",
        ],
    },
    {
        id: "exportpurchaserec",
        method: "Inward Pending",
        title: "Pending Purchase Receive",
        filename: "pending_purchase_receive.csv",
        description:
            "Purchase order inward records with remaining delivery balance.",
        queryFilter: "Pending line items where pending quantity > 0",
        icon: PackagePlus,
        columns: [
            "PO ID",
            "Customer",
            "Vendor",
            "Material",
            "Ordered Qty",
            "Inward Qty",
            "Pending Qty",
        ],
    },
    {
        id: "exportoutward",
        method: "Outward",
        title: "Outward Challan",
        filename: "outward.csv",
        description:
            "Outward delivery challans and external vendor movements.",
        queryFilter: "Active outward challan dispatches",
        icon: ArrowUpRight,
        columns: [
            "Challan ID",
            "Challan No",
            "Customer",
            "Vendor",
            "Transporter",
            "Date",
            "Items Qty",
        ],
    },
    {
        id: "exportdispatchchallan",
        method: "Dispatch",
        title: "Dispatch Challan",
        filename: "DispatchChallan.csv",
        description:
            "Final finished product dispatch notes and transport records.",
        queryFilter: "Dispatched mould orders with transporter details",
        icon: Truck,
        columns: [
            "ID",
            "Challan No",
            "Invoice No",
            "Customer",
            "Vehicle No",
            "Delivery Type",
            "Cases",
            "Status",
        ],
    },
    {
        id: "exportpendingoutward",
        method: "Job Work Pending",
        title: "Pending Outward (Inward Return)",
        filename: "pending_outward.csv",
        description:
            "Job work items awaiting receipt back from vendor.",
        queryFilter: "Dispatched plates where return balance > 0",
        icon: Layers,
        columns: [
            "Challan ID",
            "Challan No",
            "Customer",
            "Vendor",
            "Plate Name",
            "Sent Qty",
            "Received Qty",
            "Pending Qty",
        ],
    },
];

export default function ExportPage() {
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [isLoadingCounts, setIsLoadingCounts] = useState(true);

    const fetchCounts = async () => {
        try {
            setIsLoadingCounts(true);
            const res = await fetch("/api/export?type=counts");
            const data = await res.json();
            if (data.counts) {
                setCounts(data.counts);
            }
        } catch (e) {
            console.error("Failed to fetch export counts:", e);
        } finally {
            setIsLoadingCounts(false);
        }
    };

    useEffect(() => {
        fetchCounts();
    }, []);

    const handleExport = async (dataset: ExportDataset) => {
        setDownloadingId(dataset.id);
        try {
            const response = await fetch(`/api/export?type=${dataset.id}`);
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = dataset.filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setDownloadSuccess(dataset.id);
            setTimeout(() => setDownloadSuccess(null), 2500);
        } catch (err) {
            console.error("Export error:", err);
            alert("Failed to download export from database.");
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6 w-full">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                            <FileDown className="h-3.5 w-3.5 text-blue-600" />
                            <span>Reports & Exports</span>
                            <span>/</span>
                            <span className="text-slate-600">
                                Export Center
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            Data Exports
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                7 Standard Export Streams
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Download structured CSV data sheets for accounting, procurement, and shop-floor tracking.
                        </p>
                    </div>

                    <button
                        onClick={fetchCounts}
                        disabled={isLoadingCounts}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                    >
                        <RefreshCw
                            className={`w-3.5 h-3.5 text-slate-500 ${isLoadingCounts ? "animate-spin" : ""}`}
                        />
                        <span>Refresh Counts</span>
                    </button>
                </div>

                {/* Grid of the 7 Exact Exports */}
                {isLoadingCounts && Object.keys(counts).length === 0 ? (
                    <CardGridSkeleton count={6} />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {exportDatasets.map((dataset) => {
                            const Icon = dataset.icon;
                            const isDownloading = downloadingId === dataset.id;
                            const isSuccess = downloadSuccess === dataset.id;
                            const recordCount = counts[dataset.id];

                            return (
                                <div
                                    key={dataset.id}
                                    className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-3 mb-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                                                        {dataset.title}
                                                    </h3>
                                                    <span className="font-mono text-[10px] text-blue-600 font-medium">
                                                        {dataset.method}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                                                {isLoadingCounts
                                                    ? "..."
                                                    : `${recordCount ?? 0} rows`}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                                            {dataset.description}
                                        </p>

                                        {/* Scope info */}
                                        <div className="p-2 rounded bg-slate-50 border border-slate-100 mb-4">
                                            <div className="text-[10px] font-semibold text-slate-400 uppercase">
                                                Data Scope
                                            </div>
                                            <span className="text-[11px] text-slate-700 block mt-0.5 font-medium">
                                                {dataset.queryFilter}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Button */}
                                    <button
                                        onClick={() => handleExport(dataset)}
                                        disabled={isDownloading}
                                        className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                                            isSuccess
                                                ? "bg-emerald-600 text-white"
                                                : "bg-slate-900 hover:bg-slate-800 text-white"
                                        }`}
                                    >
                                        {isSuccess ? (
                                            <>
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                <span>Downloaded!</span>
                                            </>
                                        ) : isDownloading ? (
                                            <>
                                                <DownloadCloud className="h-3.5 w-3.5 animate-bounce" />
                                                <span>
                                                    Streaming {dataset.filename}
                                                    ...
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                                                <span>
                                                    Download {dataset.filename}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
