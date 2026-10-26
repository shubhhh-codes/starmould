"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  FileText,
  Plus,
  Search,
  Printer,
  Download,
  Edit2,
  Trash2,
  Settings,
  Eye,
  RefreshCw,
  Building2,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Quotation } from "@/types/quotation";
import { QuotationModal } from "@/components/quotations/quotation-modal";
import { QuotationVoucher } from "@/components/quotations/quotation-voucher";
import { QuotationCardList } from "@/components/quotations/quotation-card-list";
import { QuotationStatusBadge } from "@/components/quotations/quotation-status-badge";
import { TermsPresetModal } from "@/components/quotations/terms-preset-modal";
import { TableSkeletonRows } from "@/components/ui/skeleton";

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  Draft: {
    label: "Draft",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    icon: Clock,
  },
  Sent: {
    label: "Sent",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Send,
  },
  Accepted: {
    label: "Accepted",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  Rejected: {
    label: "Rejected",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: XCircle,
  },
  Expired: {
    label: "Expired",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: AlertCircle,
  },
};

function QuotationPageContent() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const fetchQuotations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (activeTab && activeTab !== "All") params.set("status", activeTab);
      params.set("page", String(currentPage));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/quotations?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.quotations) {
        setQuotations(data.quotations);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeTab, currentPage, pageSize]);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this quotation?")) return;
    try {
      const res = await fetch(`/api/quotations?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchQuotations();
      }
    } catch (err) {
      console.error("Failed to delete quotation:", err);
    }
  };

  // Initiate PDF download directly on the same working tab without opening any new tab
  const handleDownloadPDF = async (id: number, quoteNo?: string) => {
    try {
      setDownloadingId(id);
      const res = await fetch(`/api/download-quotation-pdf?id=${id}`);
      if (!res.ok) {
        throw new Error("Failed to download PDF");
      }
      const blob = await res.blob();
      const fileName = `${quoteNo || `Quotation_${id}`}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Direct PDF download error:", err);
      // Fallback iframe triggers download without opening a new browser tab
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/api/download-quotation-pdf?id=${id}`;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 30000);
    } finally {
      setDownloadingId(null);
    }
  };

  // Immediate in-line status update sync
  const handleStatusUpdate = (id: number, newStatus: string) => {
    setQuotations((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: newStatus as Quotation["status"] } : q))
    );
  };

  // Open Quotation Voucher directly in new tab with secure print token (exact same UX as Purchase Order)
  const handleOpenVoucherTab = async (quote: Quotation) => {
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const res = await fetch("/api/print-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quotation", id: String(quote.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        const targetUrl = data.url || `/print/quotation/${quote.id}`;
        if (win) {
          win.location.href = targetUrl;
        } else {
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        const fallbackUrl = `/print/quotation/${quote.id}`;
        if (win) {
          win.location.href = fallbackUrl;
        } else {
          window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      const fallbackUrl = `/print/quotation/${quote.id}`;
      if (win) {
        win.location.href = fallbackUrl;
      } else {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  // Status counts
  const counts = useMemo(() => {
    const map: Record<string, number> = { All: pagination.total || quotations.length };
    quotations.forEach((q) => {
      map[q.status] = (map[q.status] || 0) + 1;
    });
    return map;
  }, [quotations, pagination.total]);

  // previewQuotation ESC listener
  useEffect(() => {
    if (!previewQuotation) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewQuotation(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewQuotation]);

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {/* Module Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>Sales & Marketing</span>
              <span>/</span>
              <span className="text-slate-600">Quotations</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Quotation Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Create, review, and print official 5-page customer quotations with Annexure-I terms & bank details
            </p>
          </div>
        </div>

        {/* Top Action Bar & Stat Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
            {(["All", "Draft", "Sent", "Accepted", "Rejected", "Expired"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const count = counts[tab] ?? (tab === "All" ? pagination.total : 0);
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/80"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{tab === "All" ? "All Quotes" : tab}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      isActive
                        ? "bg-slate-100 text-slate-800"
                        : "bg-slate-200/60 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchQuotations}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs disabled:opacity-50 cursor-pointer"
              title="Refresh quotations data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPresetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Terms Presets</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingQuotation(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Quotation</span>
            </button>
          </div>
        </div>

        {/* Search & Page Size Toolbar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
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
                placeholder="Search quotation no, customer name, subject..."
                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quotations Table (Desktop) & Responsive Cards (Tablet & Mobile) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          {loading ? (
            <>
              {/* Desktop Table Skeleton */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3 w-8"></th>
                      <th className="py-3 px-4">Quotation No</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Items</th>
                      <th className="py-3 px-4 text-right">Taxable (₹)</th>
                      <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <TableSkeletonRows rows={6} columns={10} />
                  </tbody>
                </table>
              </div>

              {/* Tablet & Mobile Card Skeleton */}
              <div className="block xl:hidden p-3.5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-pulse space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-32 bg-slate-200 rounded" />
                      <div className="h-4 w-16 bg-slate-200 rounded-full" />
                    </div>
                    <div className="h-4 w-48 bg-slate-200 rounded" />
                    <div className="h-8 bg-slate-200 rounded-xl" />
                  </div>
                ))}
              </div>
            </>
          ) : quotations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Quotations Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No quotes match the current filters. Click &quot;New Quotation&quot; above to issue a quotation.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View (>= 1280px) */}
              <div className="hidden xl:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-8"></th>
                    <th className="py-3 px-4">Quotation No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-center">Items</th>
                    <th className="py-3 px-4 text-right">Taxable (₹)</th>
                    <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotations.map((q) => {
                    const isExpanded = expandedRows.has(q.id);
                    const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.Draft;
                    const StatusIcon = statusCfg.icon;

                    return (
                      <React.Fragment key={q.id}>
                        <tr
                          onClick={() => toggleRow(q.id)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-3 text-slate-400 text-center">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                          <td
                            className="py-3 px-4 font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVoucherTab(q);
                            }}
                            title="Open Quotation Voucher"
                          >
                            {q.quotation_no}
                          </td>
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {q.quotation_date}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-800">{q.consignee_name}</div>
                            {q.consignee_gstin && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                GST: {q.consignee_gstin}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-[200px] truncate">
                            {q.subject || "-"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                              {q.items?.length || 0}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">
                            ₹ {Number(q.taxable_amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 text-sm">
                            ₹ {Number(q.grand_total || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <QuotationStatusBadge
                              quotationId={q.id}
                              status={q.status}
                              onStatusChange={(newStatus) => handleStatusUpdate(q.id, newStatus)}
                            />
                          </td>
                          <td
                            className="py-3 px-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenVoucherTab(q)}
                                className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                                title="Open Quotation Voucher"
                              >
                                <Printer className="w-3 h-3" />
                                <span>Voucher</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenVoucherTab(q)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                                title="View & Print Voucher"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadPDF(q.id, q.quotation_no)}
                                disabled={downloadingId === q.id}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer disabled:opacity-50"
                                title="Download 5-Page PDF directly"
                              >
                                {downloadingId === q.id ? (
                                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuotation(q);
                                  setIsCreateOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                                title="Edit Quotation"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(q.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Delete Quotation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Line Items Preview */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 border-b border-slate-200">
                            <td colSpan={10} className="p-4 pl-12">
                              <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                  Quotation Items
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-500 border-b border-slate-100 text-[11px]">
                                      <th className="py-1 text-left w-10">#</th>
                                      <th className="py-1 text-left">Description / Particulars</th>
                                      <th className="py-1 text-center w-16">Qty</th>
                                      <th className="py-1 text-center w-20">Unit</th>
                                      <th className="py-1 text-right w-24">Rate (₹)</th>
                                      <th className="py-1 text-right w-28">Amount (₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {q.items?.map((it, idx) => (
                                      <tr key={idx} className="hover:bg-slate-50/50">
                                        <td className="py-1.5 text-slate-400">{idx + 1}</td>
                                        <td className="py-1.5 font-medium text-slate-800 whitespace-pre-line">
                                          {it.product_description}
                                        </td>
                                        <td className="py-1.5 text-center">{it.qty}</td>
                                        <td className="py-1.5 text-center text-slate-500">{it.unit}</td>
                                        <td className="py-1.5 text-right font-mono">
                                          ₹ {Number(it.unit_price).toLocaleString("en-IN")}
                                        </td>
                                        <td className="py-1.5 text-right font-mono font-semibold text-slate-900">
                                          ₹ {Number(it.total_amount).toLocaleString("en-IN")}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tablet & Mobile Card List View (< 1280px) - ZERO Horizontal Scroll */}
            <div className="block xl:hidden p-3 sm:p-4 bg-slate-50/40">
              <QuotationCardList
                quotations={quotations}
                expandedRows={expandedRows}
                onToggleRow={toggleRow}
                onOpenVoucher={handleOpenVoucherTab}
                onDownloadPdf={handleDownloadPDF}
                downloadingId={downloadingId}
                onEdit={(q) => {
                  setEditingQuotation(q);
                  setIsCreateOpen(true);
                }}
                onDelete={handleDelete}
                onStatusChange={handleStatusUpdate}
                statusConfig={STATUS_CONFIG}
              />
            </div>
          </>
        )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center p-3.5 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Showing page {currentPage} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= pagination.totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create / Edit Modal */}
        <QuotationModal
          isOpen={isCreateOpen}
          initialQuotation={editingQuotation}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingQuotation(null);
          }}
          onSuccess={fetchQuotations}
        />

        {/* Preset Modal */}
        <TermsPresetModal
          isOpen={isPresetModalOpen}
          onClose={() => setIsPresetModalOpen(false)}
        />

        {/* Full Voucher Preview Modal */}
        {previewQuotation && (
          <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewQuotation(null);
          }}
        >
            <div className="bg-slate-100 rounded-2xl w-full max-w-5xl max-h-[96vh] overflow-y-auto p-2 sm:p-4 relative">
              <QuotationVoucher
                quote={previewQuotation}
                onClose={() => setPreviewQuotation(null)}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6 space-y-4">
            <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
            <TableSkeletonRows rows={8} columns={7} />
          </div>
        </AppLayout>
      }
    >
      <QuotationPageContent />
    </Suspense>
  );
}
