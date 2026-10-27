"use client";

import React from "react";
import {
  FileText,
  Printer,
  Download,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  Layers,
  IndianRupee,
  ExternalLink,
} from "lucide-react";
import { Quotation } from "@/types/quotation";
import { QuotationStatusBadge } from "@/components/quotations/quotation-status-badge";

export interface QuotationCardListProps {
  quotations: Quotation[];
  expandedRows: Set<number>;
  onToggleRow: (id: number) => void;
  onOpenVoucher: (quote: Quotation) => void;
  onDownloadPdf: (id: number, quoteNo?: string) => void;
  downloadingId?: number | null;
  onEdit?: (quote: Quotation) => void;
  onDelete?: (id: number) => void;
  onStatusChange?: (id: number, newStatus: string) => void;
  statusConfig: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
  >;
}

export function QuotationCardList({
  quotations,
  expandedRows,
  onToggleRow,
  onOpenVoucher,
  onDownloadPdf,
  downloadingId,
  onEdit,
  onDelete,
  onStatusChange,
  statusConfig,
}: QuotationCardListProps) {
  if (quotations.length === 0) {
    return (
      <div className="py-12 px-4 text-center bg-white rounded-2xl border border-slate-200">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-800">No Quotations Found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No quotes match your current filter or search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {quotations.map((q) => {
        const isExpanded = expandedRows.has(q.id);
        const statusCfg = statusConfig[q.status] || statusConfig.Draft;
        const StatusIcon = statusCfg?.icon || FileText;
        const itemCount = q.items?.length || 0;

        return (
          <div
            key={q.id}
            className="bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:shadow-sm transition-all duration-200 overflow-hidden"
          >
            {/* Top Bar: Quotation No, Status, Date */}
            <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => onOpenVoucher(q)}
                  className="inline-flex items-center gap-1.5 font-mono font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline transition cursor-pointer"
                  title="Open Quotation Voucher"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{q.quotation_no}</span>
                  <ExternalLink className="w-3 h-3 text-blue-500 opacity-70" />
                </button>

                <QuotationStatusBadge
                  quotationId={q.id}
                  status={q.status}
                  onStatusChange={(newStatus) => onStatusChange?.(q.id, newStatus)}
                  size="sm"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{q.quotation_date}</span>
              </div>
            </div>

            {/* Middle Section: Customer & Financials Grid */}
            <div className="p-3.5 sm:p-4 space-y-3">
              {/* Customer Info */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider mb-0.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Customer</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm leading-snug">
                    {q.consignee_name}
                  </div>
                  {q.consignee_gstin && (
                    <div className="mt-1">
                      <span className="font-mono text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md inline-block">
                        GST: {q.consignee_gstin}
                      </span>
                    </div>
                  )}
                </div>

                {/* Amount Badge */}
                <div className="text-right shrink-0 bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 min-w-[120px]">
                  <div className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">
                    Grand Total
                  </div>
                  <div className="font-mono font-black text-slate-900 text-sm sm:text-base mt-0.5">
                    ₹ {Number(q.grand_total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-500 mt-0.5">
                    Taxable: ₹ {Number(q.taxable_amount || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                {/* Left: View Items toggle */}
                <button
                  type="button"
                  onClick={() => onToggleRow(q.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {itemCount} {itemCount === 1 ? "Item" : "Items"}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {/* Right: Quick Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenVoucher(q)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition active:scale-95 cursor-pointer"
                    title="Open Voucher in new tab with Zoom & Drag canvas"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Voucher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownloadPdf(q.id, q.quotation_no)}
                    disabled={downloadingId === q.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Download 5-page PDF directly"
                  >
                    {downloadingId === q.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">PDF</span>
                  </button>

                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(q)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition active:scale-95 cursor-pointer"
                      title="Edit Quotation"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                  )}

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition active:scale-95 cursor-pointer"
                      title="Delete Quotation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible Line Items (Accordion) */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quotation Line Items</span>
                  </div>

                  {q.items && q.items.length > 0 ? (
                    <div className="space-y-2">
                      {q.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 text-xs space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-white border border-slate-200 font-bold text-[11px] text-slate-500 flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <div className="font-semibold text-slate-900 leading-snug whitespace-pre-line">
                                {it.product_description}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-slate-900">
                                ₹ {Number(it.total_amount).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/50">
                            <div>
                              Qty:{" "}
                              <span className="font-semibold text-slate-700">
                                {it.qty} {it.unit}
                              </span>
                            </div>
                            <div>
                              Rate:{" "}
                              <span className="font-mono font-semibold text-slate-700">
                                ₹ {Number(it.unit_price).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-3 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl">
                      No line items attached to this quotation.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
