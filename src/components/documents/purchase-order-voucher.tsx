"use client";

import React from "react";
import { Printer, X, ExternalLink } from "lucide-react";

export interface POItem {
  id?: number;
  plateid: number;
  platename?: string;
  material?: string;
  materialtype?: string;
  qty: number;
  rate?: number;
  hsn?: string;
  discount?: number;
}

export interface PurchaseOrderVoucherProps {
  po: {
    id: number;
    srno: string;
    odate: string;
    vname: number;
    cname: number;
    projectid: string;
    created_by?: string | null;
    items?: any[];
  };
  vendor?: any;
  customerName?: string;
  onPrint?: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).formatToParts(d);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

// ─── Company constants (Starmould = Buyer) ────────────────────────────────────
const COMPANY = {
  name: "STARMOULD TECHNOLOGY PRIVATE LIMITED",
  address1: "G-705, Nr Swaminarayan Restaurant, Road-5,",
  address2: "Metoda G.I.D.C. Gate no-2, Rajkot, Gujarat - 360021",
  gstin: "24ABLCS1427Q1ZV",
  pan: "ABLCS1427Q",
  mobile: "8238451671",
  email: "info.starmould@yahoo.com",
} as const;

// ─── Primary teal color ────────────────────────────────────────────────────────
const PRIMARY = "#11627f";
const PRIMARY_LIGHT = "#e6f3f7";
const PRIMARY_BORDER = "#b8d9e6";

export function PurchaseOrderVoucher({
  po,
  vendor,
  onPrint,
  onClose,
  isModal = true,
}: PurchaseOrderVoucherProps) {
  const items = po.items || [];

  // Resolve vendor fields
  const vendorName    = vendor?.vendor_name || vendor?.customername || "—";
  const vendorAddress = vendor?.address || (vendor?.city ? `${vendor.city}, Gujarat, India` : "—");
  const vendorGst     = vendor?.gstin  || "—";
  const vendorPan     = vendor?.pan    || "—";
  const vendorMobile  = vendor?.mobile || vendor?.mobile1 || "—";
  const vendorEmail   = vendor?.email  || "—";
  const vendorCode    = vendor?.vendor_code || "—";

  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  return (
    <div className="w-full bg-white text-slate-800 font-sans print:p-0">
      {/* ── Print styles ───────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          /* Hide browser header (URL/date/title) and footer */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide EVERYTHING on the website page by default when printing */
          body * {
            visibility: hidden !important;
          }
          /* Only make the Purchase Order printable sheet and its children visible */
          #po-printable-area, #po-printable-area * {
            visibility: visible !important;
          }
          /* Position the printable sheet cleanly at the very top of the printed page */
          #po-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm 12mm !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}} />

      {/* ── Top action bar (hidden when printing or when already on dedicated print page) ──────────────────────────── */}
      {isModal && (
        <div className="flex items-center justify-between p-3 mb-4 bg-slate-100 border border-slate-200 rounded-xl print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Purchase Order:&nbsp;
              <span className="font-mono text-slate-900">{po.srno}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
              style={{ backgroundColor: PRIMARY }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PO</span>
            </button>
            {/* Close (modal only) */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PRINTABLE SHEET
          ══════════════════════════════════════════════════════════════════ */}
      <div
        id="po-printable-area"
        className="p-6 sm:p-8 bg-white border border-slate-200 rounded-lg print:border-none print:p-0 text-[12px] leading-relaxed space-y-4"
      >

        {/* ──────────────────────────────────────────────────────────────────
            1. HEADER — Logo (left) + "PURCHASE ORDER" title (right)
            ────────────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          {/* Logo */}
          <img
            src="/images/stpl-logo.jpeg"
            alt="Starmould Technology Pvt. Ltd."
            className="h-16 w-auto object-contain"
          />
          {/* Title */}
          <div className="text-right">
            <h1
              className="text-3xl font-black tracking-wide leading-none"
              style={{ color: PRIMARY }}
            >
              PURCHASE ORDER
            </h1>
            {/* Teal underline rule */}
            <div
              className="mt-1.5 h-[3px] w-full rounded-full"
              style={{ backgroundColor: PRIMARY }}
            />
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            2. INFO BAR — PO Number | PO Date | Vendor Code
            ────────────────────────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-3 gap-px rounded-lg border overflow-hidden"
          style={{ borderColor: PRIMARY_BORDER, backgroundColor: PRIMARY_BORDER }}
        >
          {[
            { label: "PO Number",   value: po.srno },
            { label: "PO Date",     value: formatDate(po.odate) },
            { label: "Vendor Code", value: vendorCode },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="px-4 py-2.5"
              style={{ backgroundColor: PRIMARY_LIGHT }}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                style={{ color: PRIMARY }}
              >
                {label}
              </div>
              <div className="font-mono font-bold text-slate-900 text-[12px]">
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            3. PARTY SECTION — Vendor / Supplier  +  Buyer (Bill To)
            ────────────────────────────────────────────────────────────────── */}
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: PRIMARY_BORDER }}
        >
          {/* Header bar */}
          <div className="grid grid-cols-2">
            {["Vendor / Supplier", "Buyer (Bill To)"].map((label) => (
              <div
                key={label}
                className="px-4 py-2 text-white font-bold text-[11px] tracking-wider uppercase"
                style={{ backgroundColor: PRIMARY }}
              >
                {label}
              </div>
            ))}
          </div>
          {/* Content */}
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: PRIMARY_BORDER }}>
            {/* LEFT — Vendor */}
            <div className="p-4 space-y-0.5 text-[11px]">
              <div className="font-bold text-slate-900 text-[12px]">{vendorName}</div>
              <div className="text-slate-600">{vendorAddress}</div>
              <div className="text-slate-700 pt-0.5">
                <span className="font-semibold">GSTIN:</span>{" "}
                <span className="font-mono">{vendorGst}</span>
                &nbsp;|&nbsp;
                <span className="font-semibold">PAN:</span>{" "}
                <span className="font-mono">{vendorPan}</span>
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Contact:</span> {vendorMobile}
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Email:</span> {vendorEmail}
              </div>
            </div>
            {/* RIGHT — Starmould as Buyer */}
            <div className="p-4 space-y-0.5 text-[11px]">
              <div className="font-bold text-slate-900 text-[12px]">{COMPANY.name}</div>
              <div className="text-slate-600">{COMPANY.address1}</div>
              <div className="text-slate-600">{COMPANY.address2}</div>
              <div className="text-slate-700 pt-0.5">
                <span className="font-semibold">GSTIN:</span>{" "}
                <span className="font-mono">{COMPANY.gstin}</span>
                &nbsp;|&nbsp;
                <span className="font-semibold">PAN:</span>{" "}
                <span className="font-mono">{COMPANY.pan}</span>
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Mobile:</span> {COMPANY.mobile}
              </div>
              <div className="text-slate-700">
                <span className="font-semibold">Email:</span> {COMPANY.email}
              </div>
            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            4. PARTICULARS TABLE
            ────────────────────────────────────────────────────────────────── */}
        <div>
          {/* Section label */}
          <div
            className="px-4 py-2 text-[11px] font-bold tracking-wider uppercase mb-1"
            style={{ color: PRIMARY }}
          >
            Particulars
          </div>

          <div
            className="rounded-sm overflow-hidden border"
            style={{ borderColor: PRIMARY_BORDER }}
          >
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr
                  className="text-white font-bold uppercase text-[10px] tracking-wide"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <th className="py-2.5 px-3 text-center w-8">#</th>
                  <th className="py-2.5 px-3">Purchase Material</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-center">Material Type</th>
                  <th className="py-2.5 px-3 text-center">Mould</th>
                  <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                      No items found in this purchase order.
                    </td>
                  </tr>
                ) : (
                  items.map((it: any, idx: number) => {
                    const qty  = Number(it.qty) || 1;
                    const rate = Number(it.rate) || 0;
                    const name = it.platename || `Subplate #${it.plateid}`;
                    const dims = it.material || "—";
                    const matType = it.materialtype || "—";

                    return (
                      <tr
                        key={idx}
                        className="border-t"
                        style={{
                          borderColor: PRIMARY_BORDER,
                          backgroundColor: idx % 2 === 0 ? "#ffffff" : PRIMARY_LIGHT,
                        }}
                      >
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{name}</div>
                          {dims && dims !== "—" && (
                            <div className="text-[10px] text-slate-500 font-mono">{dims}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                          {qty}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700">
                          {matType}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                          {po.projectid || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {rate > 0 ? `₹ ${rate.toLocaleString("en-IN")}` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footnote */}
          <p className="mt-1.5 text-[10px] text-slate-500 italic">
            Rates are given for reference only, in Indian Rupees (₹).
          </p>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            5. TERMS & CONDITIONS
            ────────────────────────────────────────────────────────────────── */}
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: PRIMARY_BORDER }}
        >
          {/* Header */}
          <div
            className="px-4 py-2 text-white font-bold text-[11px] tracking-wider uppercase"
            style={{ backgroundColor: PRIMARY }}
          >
            Terms &amp; Conditions
          </div>
          {/* Clauses */}
          <div className="p-4 space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
            <p>
              <span className="font-bold text-slate-900">1. </span>
              <span className="font-bold text-slate-900">
                The above-mentioned prices are exclusive of GST.
              </span>
            </p>
            <p>
              <span className="font-bold text-slate-900">2. Delivery: </span>
              Material will be delivered as per the delivery schedule agreed with the buyer.
            </p>
            <p>
              <span className="font-bold text-slate-900">3. Quality: </span>
              Material must match the specifications, type, mould and quantity stated in this
              purchase order. Defective or non-conforming material may be rejected.
            </p>
            <p>
              <span className="font-bold text-slate-900">4. Payment: </span>
              Payment will be made as per the agreed payment terms after receipt and acceptance
              of the material.
            </p>
            <p>
              <span className="font-bold text-slate-900">5. Documents: </span>
              Please quote the PO number on all invoices, challans and correspondence.
            </p>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            6. FOOTER — Vendor Acceptance (left) + Authorized Signatory (right)
            ────────────────────────────────────────────────────────────────── */}
        <div
          className="rounded-lg overflow-hidden border"
          style={{ borderColor: PRIMARY_BORDER }}
        >
          <div className="grid grid-cols-2 divide-x" style={{ borderColor: PRIMARY_BORDER }}>
            {/* LEFT — Vendor Acceptance */}
            <div>
              <div
                className="px-4 py-2 text-white font-bold text-[10px] uppercase tracking-wider"
                style={{ backgroundColor: PRIMARY }}
              >
                Vendor Acceptance
              </div>
              {/* Stamp space */}
              <div className="h-16" />
              <div
                className="px-4 pb-3 text-[10px] text-slate-700 border-t flex gap-8"
                style={{ borderColor: PRIMARY_BORDER }}
              >
                <span>Name: ___________________</span>
                <span>Date: ___________________</span>
              </div>
            </div>

            {/* RIGHT — Company Signatory */}
            <div>
              <div
                className="px-4 py-2 text-white font-bold text-[10px] uppercase tracking-wider text-right"
                style={{ backgroundColor: PRIMARY }}
              >
                For {COMPANY.name}
              </div>
              {/* Signature space */}
              <div className="h-16" />
              <div
                className="px-4 pb-3 text-[10px] text-slate-700 border-t text-right"
                style={{ borderColor: PRIMARY_BORDER }}
              >
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
