"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useIsRestoring } from "@tanstack/react-query";
import { useExportCountsQuery } from "@/lib/query/hooks";
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
    Database,
    Download,
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
    const [isDownloadingSql, setIsDownloadingSql] = useState(false);
    const [isDownloadingJson, setIsDownloadingJson] = useState(false);
    const [backupMessage, setBackupMessage] = useState<string | null>(null);

    const isRestoring = useIsRestoring();
    const { data: countsData, isLoading: queryLoading, isFetching, refetch } = useExportCountsQuery();
    const counts = (countsData || {}) as Record<string, number>;
    const hasCounts = Object.keys(counts).length > 0 || (!!countsData && !queryLoading);
    const isLoadingCounts = isRestoring || (!hasCounts && queryLoading);

    const handleDownloadBackup = async (format: "sql" | "json") => {
        if (format === "sql") setIsDownloadingSql(true);
        else setIsDownloadingJson(true);

        try {
            const response = await fetch(`/api/backup?format=${format}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to generate backup");
            }

            const blob = await response.blob();
            const contentDisposition = response.headers.get("Content-Disposition");
            const istDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
            let filename = `starmould_backup_${istDateStr}_IST.${format}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setBackupMessage(`Backup ${filename} downloaded successfully!`);
            setTimeout(() => setBackupMessage(null), 3000);
        } catch (err: any) {
            console.error("Backup error:", err);
            alert(err.message || "Failed to download database backup.");
        } finally {
            if (format === "sql") setIsDownloadingSql(false);
            else setIsDownloadingJson(false);
        }
    };

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

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleDownloadBackup("sql")}
                            disabled={isDownloadingSql}
                            className="btn-interactive inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer disabled:opacity-60"
                        >
                            <Download className={`w-3.5 h-3.5 ${isDownloadingSql ? "animate-bounce" : ""}`} />
                            <span>{isDownloadingSql ? "Generating..." : "Download Backup (.sql)"}</span>
                        </button>

                        <button
                            onClick={() => refetch()}
                            disabled={isLoadingCounts || isFetching}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCw
                                suppressHydrationWarning
                                className={`w-3.5 h-3.5 text-slate-500 ${isFetching || isLoadingCounts ? "animate-spin text-blue-600" : ""}`}
                            />
                            <span>Refresh Counts</span>
                        </button>
                    </div>
                </div>

                {backupMessage && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{backupMessage}</span>
                    </div>
                )}

                {/* Database Backup & Disaster Recovery Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border border-slate-700/80 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
                        <div className="flex items-start gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                                <Database className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-bold text-white tracking-wide">
                                        Full Database Backup (Supabase SQL & JSON)
                                    </h2>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                                        Cloud & 1-Click Backup
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                                    Complete SQL dump of all 22 active tables with idempotent <code className="text-blue-300 font-mono text-[11px]">ON CONFLICT DO UPDATE</code> syntax. Edit in VS Code or paste directly into Supabase SQL Editor.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => handleDownloadBackup("sql")}
                                disabled={isDownloadingSql}
                                className="btn-interactive flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl transition shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-60"
                            >
                                <Download className={`w-3.5 h-3.5 ${isDownloadingSql ? "animate-bounce" : ""}`} />
                                <span>{isDownloadingSql ? "Generating SQL Dump..." : "Download SQL Backup (.sql)"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDownloadBackup("json")}
                                disabled={isDownloadingJson}
                                className="btn-interactive flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-60"
                            >
                                <Database className="w-3.5 h-3.5 text-slate-400" />
                                <span>{isDownloadingJson ? "Exporting JSON..." : "JSON Snapshot"}</span>
                            </button>
                        </div>
                    </div>
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
