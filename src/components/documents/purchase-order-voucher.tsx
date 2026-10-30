"use client";

import React from "react";
import { Printer, X } from "lucide-react";

export interface POItem {
  id?: number;
  plateid: number;
  platename?: string;
  material?: string;
  materialtype?: string;
  qty: number;
  rate?: number | null;
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
  displayName: "Starmould Technology Private Limited",
  address1: "G 705, Near Swaminarayan Restaurant, Road-5, G.I.D.C. Metoda,",
  address2: "Rajkot-360 021. (Gujarat) INDIA.",
  cin: "U25910GJ2023PTC142461",
  gstin: "24ABLCS1427Q1ZV",
  pan: "ABLCS1427Q",
  mobile: "8238451671",
  email: "starmoulda@yahoo.in",
  website: "www.starmould.in",
} as const;

// ─── Exact colors from Purchase_Order_V23.pdf stream ─────────────────────────
const TEAL_PRIMARY = "#006181";
const GREY_LINE    = "#62676b";
const TEAL_LIGHT   = "#e5f1f6";
const TEAL_SECTION = "#cfe6ef";
const TEAL_BORDER  = "#a8d2de";
const TEXT_DARK    = "#1f2a30";
const TEXT_MUTED   = "#3d4a52";
const TEXT_LABEL   = "#4a575e";

export function PurchaseOrderVoucher({
  po,
  vendor,
  onPrint,
  onClose,
  isModal = false,
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
    <div className="w-full flex justify-center bg-white print:p-0">
      {/* ── Poppins Font import directly from Google Fonts ────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
      />

      {/* ── Print styles ───────────────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .po-font-family {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          text-rendering: optimizeLegibility !important;
        }
        @media print {
          @page {
            size: 794px 1123px;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 794px !important;
            height: 1123px !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
          }
          body * {
            visibility: hidden !important;
          }
          #po-printable-area, #po-printable-area * {
            visibility: visible !important;
          }
          #po-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 794px !important;
            height: 1123px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden { display: none !important; }
        }
      `}} />

      {/* ── Top action bar (modal only) ────────────────────────────────────── */}
      {isModal && (
        <div className="flex items-center justify-between p-3 mb-4 bg-slate-100 border border-slate-200 rounded-xl print:hidden po-font-family w-[794px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Purchase Order:&nbsp;
              <span className="font-semibold text-slate-900">{po.srno}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
              style={{ backgroundColor: TEAL_PRIMARY }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print PO</span>
            </button>
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
          PRINTABLE SHEET (Exact A4 Geometry 794px x 1123px)
          ══════════════════════════════════════════════════════════════════ */}
      <div
        id="po-printable-area"
        className="w-[794px] min-h-[1123px] bg-white po-font-family relative flex flex-col justify-between"
        style={{
          width: "794px",
          color: TEXT_DARK,
        }}
      >
        <div>
          {/* ── TOP DECORATIVE STRIPES (Exact from PDF: Teal 9px, Grey 4px) ───── */}
          <div className="w-[794px]">
            <div style={{ height: "9px", width: "794px", backgroundColor: TEAL_PRIMARY }} />
            <div style={{ height: "4px", width: "794px", backgroundColor: GREY_LINE }} />
          </div>

          {/* ── MAIN CONTENT (Padded exactly as PDF: 42px left & right) ──────── */}
          <div className="px-[42px] pt-[24px]">

            {/* ──────────────────────────────────────────────────────────────────
                1. HEADER — Official Star Mould Logo (left) + "PURCHASE ORDER" (right)
                ────────────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-[24px]">
              {/* Logo extracted directly from the PDF */}
              <div className="w-[280px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/stpl-logo.png"
                  alt="Star Mould"
                  className="w-[260px] h-auto object-contain block"
                />
              </div>

              {/* Title with grey underline matching PDF exactly */}
              <div className="text-right">
                <div
                  className="text-[29px] font-extrabold tracking-[0.5px] leading-none mb-[8px]"
                  style={{ color: TEAL_PRIMARY }}
                >
                  PURCHASE ORDER
                </div>
                {/* Grey underline matching PDF: x=422, y=104, width=330px, height=5px */}
                <div
                  className="h-[5px] w-[330px] ml-auto"
                  style={{ backgroundColor: GREY_LINE }}
                />
                <div className="text-[9px] font-semibold tracking-wider uppercase mt-[6px]" style={{ color: GREY_LINE }}>
                  We Shape Your Ideas
                </div>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                2. TOP INFO BAR — PO Number | PO Date | Vendor Code
                ────────────────────────────────────────────────────────────────── */}
            <div
              className="w-[710px] h-[60px] rounded-[12px] border flex overflow-hidden mb-[24px]"
              style={{
                borderColor: TEAL_BORDER,
                backgroundColor: TEAL_LIGHT,
              }}
            >
              {[
                { label: "PO NUMBER",   value: po.srno },
                { label: "PO DATE",     value: formatDate(po.odate) },
                { label: "VENDOR CODE", value: vendorCode },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex-1 px-[22px] py-[9px] flex flex-col justify-center"
                >
                  <div
                    className="text-[8px] font-bold tracking-[0.5px] uppercase mb-[4px]"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    {label}
                  </div>
                  <div
                    className="text-[12.5px] font-normal"
                    style={{ color: "#33414a", fontWeight: 400 }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                3. PARTY SECTION — Vendor / Supplier  +  Buyer (Bill To)
                ────────────────────────────────────────────────────────────────── */}
            <div className="w-[710px] mb-[22px]">
              {/* Header bar */}
              <div className="flex h-[37px]" style={{ backgroundColor: TEAL_PRIMARY }}>
                <div className="flex-1 flex items-center px-[16px] text-white font-semibold text-[11px] tracking-[0.5px] uppercase" style={{ fontWeight: 600 }}>
                  VENDOR / SUPPLIER
                </div>
                <div className="flex-1 flex items-center px-[16px] text-white font-semibold text-[11px] tracking-[0.5px] uppercase" style={{ fontWeight: 600 }}>
                  BUYER (BILL TO)
                </div>
              </div>

              {/* Content Row */}
              <div className="flex bg-white">
                {/* LEFT — Vendor */}
                <div
                  className="flex-1 p-[12px_16px] text-[10px] leading-[1.5]"
                  style={{ color: TEXT_MUTED }}
                >
                  <div className="font-bold text-[11.5px] mb-[2px]" style={{ color: TEXT_DARK }}>
                    {vendorName}
                  </div>
                  <div>{vendorAddress}</div>
                  <div className="mt-[3px]">
                    <span className="font-bold" style={{ color: TEXT_DARK }}>GSTIN:</span> {vendorGst}
                    &nbsp;|&nbsp;
                    <span className="font-bold" style={{ color: TEXT_DARK }}>PAN:</span> {vendorPan}
                  </div>
                  <div>
                    <span className="font-bold" style={{ color: TEXT_DARK }}>Contact:</span> {vendorMobile}
                  </div>
                  <div>
                    <span className="font-bold" style={{ color: TEXT_DARK }}>Email:</span> {vendorEmail}
                  </div>
                </div>

                {/* RIGHT — Starmould as Buyer */}
                <div className="flex-1 p-[12px_16px] text-[10px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
                  <div className="font-bold text-[11.5px] mb-[2px]" style={{ color: TEXT_DARK }}>
                    {COMPANY.name}
                  </div>
                  <div>{COMPANY.address1}</div>
                  <div>{COMPANY.address2}</div>
                  <div className="mt-[3px]">
                    <span className="font-bold" style={{ color: TEXT_DARK }}>CIN No:</span> {COMPANY.cin}
                  </div>
                  <div>
                    <span className="font-bold" style={{ color: TEXT_DARK }}>GSTIN:</span> {COMPANY.gstin}
                    &nbsp;|&nbsp;
                    <span className="font-bold" style={{ color: TEXT_DARK }}>PAN:</span> {COMPANY.pan}
                  </div>
                  <div>
                    <span className="font-bold" style={{ color: TEXT_DARK }}>Mobile:</span> {COMPANY.mobile}
                  </div>
                  <div>
                    <span className="font-bold" style={{ color: TEXT_DARK }}>Email:</span> {COMPANY.email}
                  </div>
                </div>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                4. PARTICULARS TABLE
                ────────────────────────────────────────────────────────────────── */}
            <div>
              {/* Section label bar matching PDF: 42 393 710 33 re with #cfe6ef */}
              <div
                className="w-[710px] h-[33px] flex items-center px-[10px] font-semibold text-[11px] tracking-[0.5px] uppercase mb-[6px]"
                style={{ backgroundColor: TEAL_SECTION, color: TEAL_PRIMARY, fontWeight: 600 }}
              >
                PARTICULARS
              </div>

              <div
                className="w-[710px] border overflow-hidden mb-[16px]"
                style={{ borderColor: TEAL_BORDER }}
              >
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr
                      className="text-white"
                      style={{ backgroundColor: TEAL_PRIMARY }}
                    >
                      <th className="h-[39px] px-[8px] text-center w-[38px] border-r border-white/40 font-semibold text-[9.5px]" style={{ fontWeight: 600 }}>#</th>
                      <th className="h-[39px] px-[12px] text-center w-[312px] border-r border-white/40 font-semibold text-[9.5px]" style={{ fontWeight: 600 }}>Purchase Material</th>
                      <th className="h-[39px] px-[8px] text-center w-[62px] border-r border-white/40 font-semibold text-[9.5px]" style={{ fontWeight: 600 }}>Qty</th>
                      <th className="h-[39px] px-[8px] text-center w-[110px] border-r border-white/40 font-semibold text-[9.5px]" style={{ fontWeight: 600 }}>Material Type</th>
                      <th className="h-[39px] px-[8px] text-center w-[90px] border-r border-white/40 font-semibold text-[9.5px]" style={{ fontWeight: 600 }}>Mould</th>
                      <th className="h-[39px] px-[12px] text-center w-[96px] font-semibold text-[9.5px]" style={{ fontWeight: 600 }}>Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-[46px] text-center text-slate-400 italic">
                          No items found in this purchase order.
                        </td>
                      </tr>
                    ) : (
                      items.map((it: any, idx: number) => {
                        const qty     = Number(it.qty) || 1;
                        const rate    = it.rate !== undefined && it.rate !== null ? Number(it.rate) : null;
                        const name    = it.platename || it.name || `Subplate #${it.plateid}`;
                        const dims    = it.material || "";
                        const matType = it.materialtype || "—";

                        return (
                          <tr
                            key={idx}
                            style={{
                              backgroundColor: idx % 2 === 0 ? TEAL_LIGHT : "#ffffff",
                            }}
                          >
                            <td className="h-[46px] px-[8px] text-center border-t border-r" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                              {idx + 1}
                            </td>
                            <td className="h-[46px] px-[16px] text-left border-t border-r" style={{ borderColor: TEAL_BORDER }}>
                              <div className="text-[9.5px]" style={{ color: TEXT_MUTED }}>{name}</div>
                              {dims && dims !== "—" && (
                                <div className="text-[8.5px] mt-[2px]" style={{ color: GREY_LINE }}>{dims}</div>
                              )}
                            </td>
                            <td className="h-[46px] px-[8px] text-center border-t border-r" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                              {qty}
                            </td>
                            <td className="h-[46px] px-[8px] text-center border-t border-r" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                              {matType}
                            </td>
                            <td className="h-[46px] px-[8px] text-center border-t border-r" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                              {po.projectid || "—"}
                            </td>
                            <td className="h-[46px] px-[12px] text-center font-bold border-t" style={{ borderColor: TEAL_BORDER, color: TEAL_PRIMARY }}>
                              {rate !== null && rate > 0 ? `₹ ${rate.toLocaleString("en-IN")}` : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                5. TERMS & CONDITIONS
                ────────────────────────────────────────────────────────────────── */}
            <div className="w-[710px] mb-[16px]">
              {/* Header */}
              <div
                className="h-[37px] px-[16px] flex items-center text-white font-semibold text-[11px] tracking-[0.5px] uppercase"
                style={{ backgroundColor: TEAL_PRIMARY, fontWeight: 600 }}
              >
                TERMS &amp; CONDITIONS
              </div>
              {/* Clauses */}
              <div className="p-[10px_16px] space-y-[2px] text-[9.5px] leading-[1.6]" style={{ color: TEXT_MUTED }}>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>1. The above-mentioned prices are exclusive of GST.</span>
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>2. Delivery: </span>
                  Material must be delivered as per the delivery schedule agreed with the buyer.
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>3. Quality: </span>
                  Material must match the specifications, type, mould and quantity stated in this
                  purchase order. Defective or non-conforming material may be rejected.
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>4. Payment: </span>
                  Payment will be made as per the agreed payment terms after receipt and acceptance
                  of the material.
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>5. Documents: </span>
                  Please quote the PO number on all invoices, challans and correspondence.
                </p>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                6. FOOTER — Vendor Acceptance (left) + Authorized Signatory (right)
                ────────────────────────────────────────────────────────────────── */}
            <div
              className="w-[710px] h-[105px] rounded-[12px] border overflow-hidden p-[12px_20px] flex flex-col justify-between"
              style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_SECTION }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="font-bold text-[8.5px] tracking-[0.5px] uppercase"
                  style={{ color: TEAL_PRIMARY }}
                >
                  VENDOR ACCEPTANCE
                </span>
                <span
                  className="font-bold text-[8.5px] tracking-[0.5px] uppercase"
                  style={{ color: TEAL_PRIMARY }}
                >
                  FOR {COMPANY.name}
                </span>
              </div>

              <div className="flex items-end justify-between text-[9px]" style={{ color: TEXT_LABEL }}>
                <div className="flex gap-6">
                  <span>Name: [Name]&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date: [Date]</span>
                </div>
                <div className="font-semibold" style={{ color: TEXT_DARK }}>
                  Authorized Signatory
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── BOTTOM DECORATIVE FOOTER BAR (Matches Starmould Letterhead Design) ───── */}
        <div className="w-[794px] mt-auto">
          {/* Main Light Clean Footer Bar (Saves Carbon & Ink) */}
          <div
            className="w-[794px] px-[36px] py-[8px] flex items-center justify-between border-t"
            style={{ backgroundColor: TEAL_SECTION, borderColor: TEAL_BORDER }}
          >
            {/* Left side: Location Pin + Divider + Company Name & Full Address */}
            <div className="flex items-center gap-[10px]">
              <div className="shrink-0 flex items-center justify-center">
                <svg width="14" height="17" viewBox="0 0 24 24" fill="#006181">
                  <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                </svg>
              </div>
              <div className="w-[1px] h-[34px] shrink-0" style={{ backgroundColor: TEAL_BORDER }} />
              <div className="flex flex-col leading-[1.25]">
                <span className="text-[9.5px] font-bold tracking-tight text-[#006181]">{COMPANY.displayName}</span>
                <span className="text-[8px] text-slate-600 font-medium">{COMPANY.address1}</span>
                <span className="text-[8px] text-slate-600 font-medium">{COMPANY.address2}</span>
              </div>
            </div>

            {/* Right side: Mail & Web Icons + Divider + Email & Website */}
            <div className="flex items-center gap-[9px]">
              <div className="flex flex-col items-center justify-center gap-[5px] shrink-0">
                <svg width="12" height="10" viewBox="0 0 24 24" fill="none" stroke="#006181" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#006181" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <div className="w-[1px] h-[28px] shrink-0" style={{ backgroundColor: TEAL_BORDER }} />
              <div className="flex flex-col text-[#006181] leading-[1.3] text-[8.5px] font-semibold tracking-wide">
                <span>{COMPANY.email}</span>
                <span>{COMPANY.website}</span>
              </div>
            </div>
          </div>

          {/* Bottom white margin */}
          <div className="w-[794px] h-[14px] bg-white" />
        </div>

      </div>
    </div>
  );
}
