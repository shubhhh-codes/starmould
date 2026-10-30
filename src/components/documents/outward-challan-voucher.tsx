"use client";

import React from "react";
import { Printer, X } from "lucide-react";

export interface OutwardChallanItem {
  srNo?: number;
  particulars?: string;
  platename?: string;
  material?: string | null;
  dimensions?: string | null;
  qty?: number;
}

export interface OutwardChallanVoucherProps {
  challan: {
    id?: number;
    docNumber?: string;
    challanno?: string;
    docDate?: string;
    chdate?: string;
    party?: {
      id?: number;
      vendor_name?: string;
      customername?: string;
      vendor_code?: string;
      address?: string;
      city?: string;
      gstin?: string;
      pan?: string;
      mobile?: string;
      mobile1?: string;
      email?: string;
    } | null;
    customerName?: string;
    transporter?: string;
    projectCode?: string;
    items?: OutwardChallanItem[];
  };
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

// ─── Company Constants (Starmould = Consignor / Principal Manufacturer) ─────
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

// ─── Exact Color Palette from Star Mould Brand System ─────────────────────────
const TEAL_PRIMARY = "#006181";
const GREY_LINE    = "#62676b";
const TEAL_LIGHT   = "#e5f1f6";
const TEAL_SECTION = "#cfe6ef";
const TEAL_BORDER  = "#a8d2de";
const TEXT_DARK    = "#1f2a30";
const TEXT_MUTED   = "#3d4a52";
const TEXT_LABEL   = "#4a575e";

export function OutwardChallanVoucher({
  challan,
  onPrint,
  onClose,
  isModal = false,
}: OutwardChallanVoucherProps) {
  const items = challan.items || [];
  const challanNo = challan.docNumber || challan.challanno || "—";
  const challanDate = challan.docDate || challan.chdate;
  const vendor = challan.party;

  const vendorName = vendor?.vendor_name || vendor?.customername || "—";
  const vendorAddress = vendor?.address || (vendor?.city ? `${vendor.city}, Gujarat, India` : "—");
  const vendorGstin = vendor?.gstin || "—";
  const vendorPan = vendor?.pan || "—";
  const vendorMobile = vendor?.mobile || vendor?.mobile1 || "—";
  const vendorEmail = vendor?.email || "—";
  const vendorCode = vendor?.vendor_code || "—";

  const totalQuantity = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

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
      <style
        dangerouslySetInnerHTML={{
          __html: `
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
          #challan-printable-area, #challan-printable-area * {
            visibility: visible !important;
          }
          #challan-printable-area {
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
      `,
        }}
      />

      {/* ── Top Action Bar (Modal View Only) ─────────────────────────────────── */}
      {isModal && (
        <div className="flex items-center justify-between p-3 mb-4 bg-slate-100 border border-slate-200 rounded-xl print:hidden po-font-family w-[794px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Job Work Challan:&nbsp;
              <span className="font-semibold text-slate-900">{challanNo}</span>
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
              <span>Print Challan</span>
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
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
        id="challan-printable-area"
        className="w-[794px] min-h-[1123px] bg-white po-font-family relative flex flex-col justify-between"
        style={{
          width: "794px",
          color: TEXT_DARK,
        }}
      >
        <div>
          {/* ── TOP DECORATIVE STRIPES (Teal 9px, Grey 4px) ─────────────────── */}
          <div className="w-[794px]">
            <div style={{ height: "9px", width: "794px", backgroundColor: TEAL_PRIMARY }} />
            <div style={{ height: "4px", width: "794px", backgroundColor: GREY_LINE }} />
          </div>

          {/* ── MAIN CONTENT (Padded 42px left & right) ──────────────────────── */}
          <div className="px-[42px] pt-[24px]">

            {/* ──────────────────────────────────────────────────────────────────
                1. HEADER — Official Star Mould Logo (left) + "JOB WORK CHALLAN" (right)
                ────────────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-[22px]">
              {/* Logo */}
              <div className="w-[280px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/stpl-logo.png"
                  alt="Star Mould"
                  className="w-[260px] h-auto object-contain block"
                />
              </div>

              {/* Title with grey underline matching Brand PDF standard */}
              <div className="text-right">
                <div
                  className="text-[28px] font-extrabold tracking-[0.5px] leading-none mb-[8px]"
                  style={{ color: TEAL_PRIMARY }}
                >
                  JOB WORK CHALLAN
                </div>
                {/* Grey underline matching PDF standard */}
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
                2. TOP INFO BAR — Challan No | Date | Transporter | Mould Project
                ────────────────────────────────────────────────────────────────── */}
            <div
              className="w-[710px] h-[58px] rounded-[12px] border flex overflow-hidden mb-[16px]"
              style={{
                borderColor: TEAL_BORDER,
                backgroundColor: TEAL_LIGHT,
              }}
            >
              {[
                { label: "CHALLAN NUMBER", value: challanNo },
                { label: "CHALLAN DATE",   value: formatDate(challanDate) },
                { label: "TRANSPORTER",    value: challan.transporter || "Self / Hand to Hand" },
                { label: "MOULD PROJECT",  value: challan.projectCode || "Standard Project" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex-1 px-[18px] py-[8px] flex flex-col justify-center border-r last:border-r-0"
                  style={{ borderColor: TEAL_BORDER }}
                >
                  <div
                    className="text-[8px] font-bold tracking-[0.5px] uppercase mb-[3px]"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    {label}
                  </div>
                  <div
                    className="text-[12px] font-medium truncate"
                    style={{ color: "#33414a" }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                3. JOB WORK QUICK LOGISTICS BAR
                ────────────────────────────────────────────────────────────────── */}
            <div
              className="w-[710px] rounded-[8px] border px-[18px] py-[9px] mb-[18px] flex items-center justify-between text-[10px]"
              style={{
                borderColor: TEAL_BORDER,
                backgroundColor: "#ffffff",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[8.5px] uppercase tracking-wider" style={{ color: TEAL_PRIMARY }}>
                  Transporter:&nbsp;
                </span>
                <span className="font-semibold text-[11px]" style={{ color: TEXT_DARK }}>
                  {challan.transporter || "Self / Hand to Hand"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-[8.5px] uppercase tracking-wider" style={{ color: TEAL_PRIMARY }}>
                  Movement Purpose:&nbsp;
                </span>
                <span className="font-medium" style={{ color: TEXT_DARK }}>
                  Job Work / Subplate Processing
                </span>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                4. PARTY SECTION — Job Worker (Consignee) + Consignor (Starmould)
                ────────────────────────────────────────────────────────────────── */}
            <div className="w-[710px] mb-[20px]">
              {/* Header bar */}
              <div className="flex h-[36px]" style={{ backgroundColor: TEAL_PRIMARY }}>
                <div className="flex-1 flex items-center px-[16px] text-white font-semibold text-[10.5px] tracking-[0.5px] uppercase">
                  CONSIGNOR (ISSUED BY / PRINCIPAL)
                </div>
                <div className="flex-1 flex items-center px-[16px] text-white font-semibold text-[10.5px] tracking-[0.5px] uppercase">
                  JOB WORKER / PROCESSOR (CONSIGNEE)
                </div>
              </div>

              {/* Content Row */}
              <div className="flex bg-white border-x border-b" style={{ borderColor: TEAL_BORDER }}>
                {/* LEFT — Starmould as Consignor */}
                <div
                  className="flex-1 p-[12px_16px] text-[10px] leading-[1.5] border-r"
                  style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}
                >
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

                {/* RIGHT — Vendor / Job Worker */}
                <div className="flex-1 p-[12px_16px] text-[10px] leading-[1.5]" style={{ color: TEXT_MUTED }}>
                  <div className="font-bold text-[11.5px] mb-[2px]" style={{ color: TEXT_DARK }}>
                    {vendorName}
                  </div>
                  <div>{vendorAddress}</div>
                  {vendorCode && vendorCode !== "—" && (
                    <div className="text-[9px] font-mono text-slate-500">Vendor Code: {vendorCode}</div>
                  )}
                  <div className="mt-[3px]">
                    <span className="font-bold" style={{ color: TEXT_DARK }}>GSTIN:</span> {vendorGstin}
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
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                5. PARTICULARS TABLE (Goods Sent For Job Work)
                ────────────────────────────────────────────────────────────────── */}
            <div className="mb-[18px]">
              {/* Section label bar */}
              <div
                className="w-[710px] h-[32px] flex items-center justify-between px-[12px] font-semibold text-[10.5px] tracking-[0.5px] uppercase mb-[6px]"
                style={{ backgroundColor: TEAL_SECTION, color: TEAL_PRIMARY }}
              >
                <span>PARTICULARS &amp; SPECIFICATIONS OF GOODS SENT FOR JOB WORK</span>
                <span className="text-[9.5px] font-mono lowercase">
                  ({items.length} {items.length === 1 ? "item" : "items"})
                </span>
              </div>

              <div
                className="w-[710px] border overflow-hidden"
                style={{ borderColor: TEAL_BORDER }}
              >
                <table className="w-full border-collapse text-[9.5px]">
                  <thead>
                    <tr className="text-white" style={{ backgroundColor: TEAL_PRIMARY }}>
                      <th className="h-[36px] px-[8px] text-center w-[40px] border-r border-white/40 font-semibold text-[9.5px]">
                        #
                      </th>
                      <th className="h-[36px] px-[14px] text-left w-[360px] border-r border-white/40 font-semibold text-[9.5px]">
                        Component / Plate Description
                      </th>
                      <th className="h-[36px] px-[10px] text-left w-[230px] border-r border-white/40 font-semibold text-[9.5px]">
                        Job Work Particulars
                      </th>
                      <th className="h-[36px] px-[12px] text-center w-[80px] font-semibold text-[9.5px]">
                        Qty
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="h-[46px] text-center text-slate-400 italic">
                          No subplates or items specified in this outward challan.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const qty = Number(it.qty) || 1;
                        const plateName = it.platename || "Mould Plate";
                        const particulars = it.particulars || "Standard Machining / Job Work";

                        return (
                          <tr
                            key={idx}
                            style={{
                              backgroundColor: idx % 2 === 0 ? TEAL_LIGHT : "#ffffff",
                            }}
                          >
                            <td
                              className="h-[44px] px-[8px] text-center border-t border-r"
                              style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}
                            >
                              {idx + 1}
                            </td>
                            <td
                              className="h-[44px] px-[14px] text-left border-t border-r"
                              style={{ borderColor: TEAL_BORDER }}
                            >
                              <div className="font-semibold text-[10.5px]" style={{ color: TEXT_DARK }}>
                                {plateName}
                              </div>
                            </td>
                            <td
                              className="h-[44px] px-[10px] text-left font-medium border-t border-r text-[9.5px] whitespace-pre-line"
                              style={{ borderColor: TEAL_BORDER, color: TEXT_DARK }}
                            >
                              {particulars}
                            </td>
                            <td
                              className="h-[44px] px-[12px] text-center font-bold border-t text-[11px]"
                              style={{ borderColor: TEAL_BORDER, color: TEAL_PRIMARY }}
                            >
                              {qty}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {/* Total Row */}
                    <tr style={{ backgroundColor: "#e6f2f6", fontWeight: 700 }}>
                      <td
                        colSpan={3}
                        className="h-[34px] px-[16px] text-right uppercase tracking-wider text-[9.5px] border-t"
                        style={{ borderColor: TEAL_BORDER, color: TEAL_PRIMARY }}
                      >
                        Total Dispatched Quantity:
                      </td>
                      <td
                        className="h-[34px] px-[12px] text-center font-bold text-[12px] border-t"
                        style={{ borderColor: TEAL_BORDER, color: TEAL_PRIMARY }}
                      >
                        {totalQuantity}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                6. TERMS & CONDITIONS (Job Work Under GST Sec 143)
                ────────────────────────────────────────────────────────────────── */}
            <div className="w-[710px] mb-[18px]">
              {/* Header */}
              <div
                className="h-[34px] px-[16px] flex items-center text-white font-semibold text-[10.5px] tracking-[0.5px] uppercase"
                style={{ backgroundColor: TEAL_PRIMARY }}
              >
                DELIVERY &amp; JOB WORK TERMS &amp; CONDITIONS (SEC. 143 CGST ACT)
              </div>
              {/* Clauses */}
              <div
                className="p-[10px_16px] space-y-[2px] text-[9px] leading-[1.6] border-x border-b bg-white"
                style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}
              >
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>1. Nature of Movement: </span>
                  Goods dispatched under this challan are strictly for Job Work / Tooling Processing only and not intended for sale.
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>2. Statutory Rule: </span>
                  Issued in accordance with Section 143 of the CGST Act 2017 &amp; Rule 55 of CGST Rules for movement of goods sent for job work.
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>3. Return Obligation: </span>
                  The processed goods/components must be returned to the consignor within the statutory period of 1 year (or 3 years for capital mould tooling).
                </p>
                <p>
                  <span className="font-bold" style={{ color: TEXT_DARK }}>4. Verification &amp; Damage Claims: </span>
                  Please inspect the dimensions, weight, and condition upon receipt. Any defect or discrepancy must be reported within 24 hours.
                </p>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────────────
                7. SIGNATURES — Receiver's Acknowledgement + Starmould Signatory
                ────────────────────────────────────────────────────────────────── */}
            <div
              className="w-[710px] h-[98px] rounded-[12px] border overflow-hidden p-[10px_20px] flex flex-col justify-between"
              style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_SECTION }}
            >
              <div className="flex items-start justify-between">
                <span
                  className="font-bold text-[8.5px] tracking-[0.5px] uppercase"
                  style={{ color: TEAL_PRIMARY }}
                >
                  RECEIVER&apos;S / PROCESSOR&apos;S ACKNOWLEDGEMENT
                </span>
                <span
                  className="font-bold text-[8.5px] tracking-[0.5px] uppercase"
                  style={{ color: TEAL_PRIMARY }}
                >
                  FOR {COMPANY.name}
                </span>
              </div>

              <div className="flex items-end justify-between text-[9px]" style={{ color: TEXT_LABEL }}>
                <div className="flex gap-4">
                  <span>Received in Good Condition&nbsp;&nbsp;|&nbsp;&nbsp;Date: ________________</span>
                </div>
                <div className="font-semibold text-right" style={{ color: TEXT_DARK }}>
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
