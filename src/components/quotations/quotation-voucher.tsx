"use client";

import React, { useRef, useState } from "react";
import { Printer, Download, X } from "lucide-react";
import { Quotation, QuotationItem } from "@/types/quotation";
import { calculateGST, formatINRTwoDecimals } from "@/lib/gst-calculation";
import { amountInWords } from "@/lib/number-to-words";

export interface QuotationVoucherProps {
  quote: Quotation;
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

// ─── Company constants ─────────────────────────────────────────────────────────
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

// ─── Colors ───────────────────────────────────────────────────────────────────
const TEAL_PRIMARY = "#006181";
const GREY_LINE    = "#62676b";
const TEAL_LIGHT   = "#f3f9fb";
const TEAL_BORDER  = "#bcd8e0";
const TEXT_DARK    = "#1f2a30";
const TEXT_MUTED   = "#3d4a52";
const TEXT_LABEL   = "#4a575e";

// ─── Annexure Detailed Manufacturer Terms (23 Clauses Split Across 2 Pages) ───
const ANNEXURE_TERMS_PART1 = [
  { no: 1, title: "PRICE VALIDITY", text: "This quotation is valid for 30 days from the date of issue. After the validity period, prices are subject to change without prior notice." },
  { no: 2, title: "PAYMENT TERMS", text: "50% advance payment is mandatory along with order confirmation. The remaining 50% balance must be cleared before dispatch/delivery of goods. Failure to make payment on time may delay delivery." },
  { no: 3, title: "TAXES", text: "GST and all applicable government taxes will be charged extra as per prevailing rates at the time of billing." },
  { no: 4, title: "ORDER CONFIRMATION", text: "Orders will be treated as confirmed only after receipt of advance payment and a written purchase order or email confirmation from the customer." },
  { no: 5, title: "PRODUCTION & DELIVERY SCHEDULE", text: "Manufacturing will start only after confirmation and receipt of advance. Delivery timeline will be calculated from the confirmation date and is subject to availability of raw material and production capacity." },
  { no: 6, title: "TRANSPORTATION, LOADING & UNLOADING", text: "Transportation, packing, loading, unloading, and insurance are chargeable extra unless mentioned otherwise in writing. Risk transfers to the buyer once goods leave our premises." },
  { no: 7, title: "RAW MATERIAL PRICE FLUCTUATION", text: "Prices are based on current raw material rates. Any significant increase in raw material prices before production may result in price revision." },
  { no: 8, title: "DESIGN, DRAWING & SAMPLE APPROVAL", text: "If applicable, all drawings, samples, specifications, and designs must be approved by the customer before production. Any changes after approval will attract additional charges and delivery time." },
  { no: 9, title: "INSPECTION & ACCEPTANCE", text: "Goods must be inspected immediately upon receipt. Any complaints regarding damage, defect, or shortage must be reported within 24–48 hours of delivery. No claims will be entertained thereafter." },
  { no: 10, title: "WARRANTY", text: "Warranty is applicable only against manufacturing defects, if specifically mentioned. Warranty does not cover damage due to misuse, mishandling, overloading, improper installation, external impact, or power fluctuations." },
  { no: 11, title: "REJECTION POLICY", text: "Rejection of goods after acceptance will not be entertained. Any rejection must be mutually agreed upon in writing and returned at the customer's cost." },
  { no: 12, title: "CANCELLATION POLICY", text: "Once manufacturing has started, the order cannot be cancelled under any circumstances. The advance amount shall be non-refundable." },
];

const ANNEXURE_TERMS_PART2 = [
  { no: 13, title: "NO RETURN / EXCHANGE", text: "Manufactured and custom-made goods are not eligible for return or exchange." },
  { no: 14, title: "DELAY IN PAYMENT", text: "Any delay in payment beyond the agreed period will attract interest at 18% per annum, or as per industry standards." },
  { no: 15, title: "PACKAGING", text: "Standard packaging will be provided. Special packaging, if required, will be charged extra." },
  { no: 16, title: "QUANTITY VARIATION", text: "A production variance of ±5% in quantity is considered acceptable and shall be billed accordingly." },
  { no: 17, title: "CONFIDENTIALITY", text: "All drawings, designs, specifications, and pricing shared are confidential and shall not be disclosed to third parties." },
  { no: 18, title: "FORCE MAJEURE", text: "We shall not be responsible for delays or non-performance due to events beyond our control including but not limited to natural disasters, fire, strike, government restrictions, or power failure." },
  { no: 19, title: "INTELLECTUAL PROPERTY", text: "All designs, molds, tools, and development work created by us shall remain our intellectual property unless otherwise agreed in writing." },
  { no: 20, title: "LIABILITY LIMITATION", text: "Our liability is limited strictly to the value of the goods supplied. We are not liable for indirect, incidental, or consequential losses." },
  { no: 21, title: "GOVERNING LAW & JURISDICTION", text: "All disputes shall be subject to the exclusive jurisdiction of the courts of Rajkot, Gujarat only." },
  { no: 22, title: "ENTIRE AGREEMENT", text: "This quotation along with these terms constitutes the entire understanding between both parties and overrides all previous discussions or agreements." },
  { no: 23, title: "ACCEPTANCE", text: "Placing an order against this quotation implies full acceptance of the above terms and conditions by the customer." },
];

export const QuotationVoucher: React.FC<QuotationVoucherProps> = ({
  quote,
  onClose,
  isModal = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      const res = await fetch(`/api/download-quotation-pdf?id=${quote.id}`);
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const fileName = `${quote.quotation_no || `Quotation_${quote.id}`}.pdf`;
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
      console.error("PDF download error:", err);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/api/download-quotation-pdf?id=${quote.id}`;
      document.body.appendChild(iframe);
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 30000);
    } finally {
      setIsDownloading(false);
    }
  };

  const items = quote.items || [];
  const discountVal = Number(quote.discount_amount) || 0;

  const {
    subtotalAmount,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    grandTotal,
  } = calculateGST(
    items.map((it) => ({
      qty: it.qty,
      unit_price: it.unit_price,
      total_amount: it.total_amount,
    })),
    quote.tax_type || "gst_18",
    quote.tax_type === "exempt" ? 0 : 18,
    discountVal
  );

  const inWords = amountInWords(grandTotal);
  const isIntraState = !quote.consignee_gstin || quote.consignee_gstin.trim().startsWith("24");
  const isExempt = quote.tax_type === "exempt";

  const customerCode = quote.customer_code || "—";
  const consigneeName = quote.consignee_name || "—";
  const consigneeAddress = quote.consignee_address || "—";
  const consigneeGstin = quote.consignee_gstin || "—";
  const consigneePan = quote.consignee_pan || "—";
  const consigneePhone = quote.consignee_phone || "—";
  const consigneeEmail = quote.consignee_email || "—";

  const bankName = quote.bank_name || "Central Bank Of India";
  const bankAccountNo = quote.bank_account_no || "5875819245";
  const bankIfsc = quote.bank_ifsc || "CBIN0281313";
  const bankBranch = quote.bank_branch || "Saurashtra University Branch";

  const activeTerms = [
    { label: "Price & GST", content: quote.price_terms },
    { label: "Delivery Terms", content: quote.delivery_terms },
    { label: "Payment Terms", content: quote.payment_terms },
    { label: "Validity", content: quote.validity_terms },
    { label: "Order Confirmation", content: quote.order_confirmation },
    { label: "Warranty", content: quote.warranty_terms },
    { label: "Jurisdiction", content: quote.jurisdiction_terms },
    { label: "Force Majeure", content: quote.force_majeure },
  ].filter((t) => Boolean(t.content && t.content.trim()));

  // ── Multi-page determination: Cover page + Quotation content + Annexure-I ──
  // Page 1: Official Corporate Cover Page
  // Page 2: Commercial Quotation (Items, Totals & GST)
  // Page 3: Bank Details, Summary Terms & Dual Signatures
  // Page 4: Annexure-I Detailed Manufacturer Terms (Part 1: Clauses 1 to 12)
  // Page 5: Annexure-I Detailed Manufacturer Terms (Part 2: Clauses 13 to 23 + Acceptance)
  const hasPage3 = true;
  const totalPages = 5;

  const renderAnnexureTable = (termsList: typeof ANNEXURE_TERMS_PART1) => (
    <div className="w-[710px] border overflow-hidden rounded-[4px]" style={{ borderColor: TEAL_BORDER }}>
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr className="text-white" style={{ backgroundColor: TEAL_PRIMARY }}>
            <th className="h-[28px] px-[12px] text-left w-[215px] border-r border-white/40 font-semibold text-[10px] uppercase tracking-wider">
              Clause / Subject
            </th>
            <th className="h-[28px] px-[14px] text-left w-[495px] font-semibold text-[10px] uppercase tracking-wider">
              Terms &amp; Conditions Details
            </th>
          </tr>
        </thead>
        <tbody>
          {termsList.map((item, idx) => (
            <tr
              key={item.no}
              style={{
                backgroundColor: idx % 2 === 0 ? TEAL_LIGHT : "#ffffff",
              }}
            >
              <td
                className="py-[6px] px-[12px] text-left border-t border-r align-top font-bold text-[10px]"
                style={{ borderColor: TEAL_BORDER, color: TEXT_DARK }}
              >
                {item.no}. {item.title}:
              </td>
              <td
                className="py-[6px] px-[14px] text-left border-t align-top text-[9.5px] leading-[1.5]"
                style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}
              >
                {item.text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderParticularsTable = (tableItems: QuotationItem[]) => (
    <div className="w-[710px] border overflow-hidden mb-[14px]" style={{ borderColor: TEAL_BORDER }}>
      <table className="w-full border-collapse text-[9.5px]">
        <thead>
          <tr className="text-white" style={{ backgroundColor: TEAL_PRIMARY }}>
            <th className="h-[34px] px-[8px] text-center w-[38px] border-r border-white/40 font-semibold text-[9.5px]">#</th>
            <th className="h-[34px] px-[12px] text-left w-[312px] border-r border-white/40 font-semibold text-[9.5px]">Product / Particulars</th>
            <th className="h-[34px] px-[8px] text-center w-[50px] border-r border-white/40 font-semibold text-[9.5px]">Qty</th>
            <th className="h-[34px] px-[8px] text-center w-[50px] border-r border-white/40 font-semibold text-[9.5px]">Unit</th>
            <th className="h-[34px] px-[12px] text-right w-[120px] border-r border-white/40 font-semibold text-[9.5px]">Unit Price (₹)</th>
            <th className="h-[34px] px-[12px] text-right w-[140px] font-semibold text-[9.5px]">Total Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {tableItems.length === 0 ? (
            <tr>
              <td colSpan={6} className="h-[42px] text-center text-slate-400 italic">
                No items found in this quotation.
              </td>
            </tr>
          ) : (
            tableItems.map((it, idx) => {
              const qty = Number(it.qty) || 1;
              const unit = it.unit || "Nos";
              const price = Number(it.unit_price) || 0;
              const total =
                it.total_amount !== undefined && it.total_amount !== null
                  ? Number(it.total_amount)
                  : Math.round(qty * price * 100) / 100;

              return (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: idx % 2 === 0 ? TEAL_LIGHT : "#ffffff",
                  }}
                >
                  <td className="h-[34px] px-[8px] text-center border-t border-r" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                    {idx + 1}
                  </td>
                  <td className="h-[34px] px-[12px] text-left border-t border-r" style={{ borderColor: TEAL_BORDER }}>
                    <div className="text-[9.5px] font-medium whitespace-pre-line" style={{ color: TEXT_DARK }}>
                      {it.product_description}
                    </div>
                  </td>
                  <td className="h-[34px] px-[8px] text-center border-t border-r tabular-nums font-medium" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                    {qty}
                  </td>
                  <td className="h-[34px] px-[8px] text-center border-t border-r" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                    {unit}
                  </td>
                  <td className="h-[34px] px-[12px] text-right border-t border-r tabular-nums" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                    ₹ {formatINRTwoDecimals(price)}
                  </td>
                  <td className="h-[34px] px-[12px] text-right tabular-nums font-semibold border-t" style={{ borderColor: TEAL_BORDER, color: TEAL_PRIMARY }}>
                    ₹ {formatINRTwoDecimals(total)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const renderFooter = (pageNo: number) => (
    <div className="w-[794px] mt-auto">
      <div
        className="w-[794px] px-[36px] py-[7px] flex items-center justify-between text-white"
        style={{ backgroundColor: "#1b2537" }}
      >
        <div className="flex items-center gap-[10px]">
          <div className="shrink-0 flex items-center justify-center">
            <svg width="13" height="16" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
            </svg>
          </div>
          <div className="w-[1px] h-[32px] bg-white/40 shrink-0" />
          <div className="flex flex-col text-white leading-[1.25]">
            <span className="text-[9px] font-bold tracking-tight">{COMPANY.displayName}</span>
            <span className="text-[7.5px] text-white/90">{COMPANY.address1} {COMPANY.address2}</span>
          </div>
        </div>

        <div className="flex items-center gap-[9px]">
          <div className="text-[8.5px] font-semibold text-white/85 border border-white/30 rounded px-2 py-0.5">
            Page {pageNo} of {totalPages}
          </div>
          <div className="w-[1px] h-[26px] bg-white/40 shrink-0" />
          <div className="flex flex-col text-white leading-[1.3] text-[8px] font-semibold tracking-wide">
            <span>{COMPANY.email}</span>
            <span>{COMPANY.website}</span>
          </div>
        </div>
      </div>

      <div className="w-[794px] h-[10px] bg-white" />
    </div>
  );

  return (
    <div className="w-full flex justify-center bg-transparent print:p-0">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .quote-font-family {
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
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
          }
          body * {
            visibility: hidden !important;
          }
          #quotation-printable-area, #quotation-printable-area * {
            visibility: visible !important;
          }
          #quotation-printable-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 794px !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
          }
          .a4-page-sheet {
            page-break-after: always !important;
            break-after: page !important;
            height: 1123px !important;
            min-height: 1123px !important;
            max-height: 1123px !important;
            overflow: hidden !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .a4-page-sheet:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
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

      {/* Top action bar (Modal only) */}
      {isModal && (
        <div className="flex items-center justify-between p-3 mb-4 bg-slate-100 border border-slate-200 rounded-xl print:hidden quote-font-family w-[794px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">
              Quotation:&nbsp;
              <span className="font-semibold text-slate-900">{quote.quotation_no}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-white text-xs font-semibold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
              style={{ backgroundColor: TEAL_PRIMARY }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
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
          PRINTABLE AREA (STRICT A4 GEOMETRY: 794px x 1123px PER PAGE)
          ══════════════════════════════════════════════════════════════════ */}
      <div
        ref={containerRef}
        id="quotation-printable-area"
        className="flex flex-col gap-0 print:gap-0 quote-font-family"
        style={{ color: TEXT_DARK }}
      >
        {/* ── PAGE 1: OFFICIAL COVER PAGE (EXACT A4 794px x 1123px) ─────────── */}
        <div
          className="a4-page-sheet w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px] bg-white overflow-hidden shadow-2xl border border-slate-300/80 rounded-sm print:shadow-none print:border-none print:rounded-none"
          style={{ width: "794px", height: "1123px" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/quotation-cover.jpg"
            alt="StarMould Quotation Cover"
            className="w-[794px] h-[1123px] object-cover block"
          />
        </div>

        {/* ── Visual Page Divider: Page 1 -> Page 2 ── */}
        <div className="w-[794px] py-6 flex items-center justify-center gap-3 select-none print:hidden">
          <div className="flex-1 h-px bg-slate-400/50" />
          <div className="flex items-center gap-2 px-3.5 py-1 bg-slate-100 rounded-full border border-slate-300 shadow-xs text-slate-700">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL_PRIMARY }} />
            <span className="text-[10.5px] font-bold tracking-wider uppercase font-mono">
              Page Break • Page 2 of {totalPages}
            </span>
          </div>
          <div className="flex-1 h-px bg-slate-400/50" />
        </div>

        {/* ── PAGE 2: COMMERCIAL QUOTATION (EXACT A4 794px x 1123px) ─────────── */}
        <div
          className="a4-page-sheet w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px] bg-white relative flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-300/80 rounded-sm print:shadow-none print:border-none print:rounded-none"
          style={{ width: "794px", height: "1123px" }}
        >
          <div>
            {/* Top stripes */}
            <div className="w-[794px]">
              <div style={{ height: "8px", width: "794px", backgroundColor: TEAL_PRIMARY }} />
              <div style={{ height: "4px", width: "794px", backgroundColor: GREY_LINE }} />
            </div>

            <div className="px-[42px] pt-[20px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-[28px]">
                <div className="w-[260px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/stpl-logo.png"
                    alt="Star Mould"
                    className="w-[240px] h-auto object-contain block"
                  />
                </div>

                <div className="text-right">
                  <div
                    className="text-[26px] font-extrabold tracking-[0.5px] leading-none mb-[6px]"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    QUOTATION
                  </div>
                  <div
                    className="h-[4px] w-[200px] ml-auto"
                    style={{ backgroundColor: GREY_LINE }}
                  />
                </div>
              </div>

              {/* Top Info Bar */}
              <div
                className="w-[710px] h-[48px] rounded-[10px] border flex overflow-hidden mb-[16px]"
                style={{
                  borderColor: TEAL_BORDER,
                  backgroundColor: TEAL_LIGHT,
                }}
              >
                {[
                  { label: "QUOTATION NO.",   value: quote.quotation_no || "—" },
                  { label: "QUOTATION DATE", value: formatDate(quote.quotation_date) },
                  { label: "CUSTOMER CODE",  value: customerCode },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex-1 px-[18px] py-[6px] flex flex-col justify-center"
                  >
                    <div
                      className="text-[8px] font-bold tracking-[0.5px] uppercase mb-[2px]"
                      style={{ color: TEAL_PRIMARY }}
                    >
                      {label}
                    </div>
                    <div
                      className="text-[12px] font-medium"
                      style={{ color: "#33414a" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Party Section */}
              <div className="w-[710px] mb-[16px]">
                <div className="flex h-[30px]" style={{ backgroundColor: TEAL_PRIMARY }}>
                  <div
                    className="flex-1 flex items-center px-[14px] text-white font-semibold text-[10px] tracking-[0.5px] uppercase"
                    style={{ fontWeight: 600 }}
                  >
                    FROM / SUPPLIER
                  </div>
                  <div
                    className="flex-1 flex items-center px-[14px] text-white font-semibold text-[10px] tracking-[0.5px] uppercase"
                    style={{ fontWeight: 600 }}
                  >
                    CUSTOMER (QUOTATION TO)
                  </div>
                </div>

                <div className="flex bg-white">
                  <div
                    className="flex-1 p-[10px_14px] text-[9.5px] leading-[1.45]"
                    style={{ color: TEXT_MUTED }}
                  >
                    <div className="font-bold text-[11px] mb-[2px]" style={{ color: TEXT_DARK }}>
                      {COMPANY.name}
                    </div>
                    <div>{COMPANY.address1}</div>
                    <div>{COMPANY.address2}</div>
                    <div className="mt-[2px]">
                      <span className="bold-label">CIN No:</span> {COMPANY.cin}
                    </div>
                    <div>
                      <span className="bold-label">GSTIN:</span> {COMPANY.gstin} | <span className="bold-label">PAN:</span> {COMPANY.pan}
                    </div>
                    <div>
                      <span className="bold-label">Mobile:</span> {COMPANY.mobile} | <span className="bold-label">Email:</span> {COMPANY.email}
                    </div>
                  </div>

                  <div
                    className="flex-1 p-[10px_14px] text-[9.5px] leading-[1.45]"
                    style={{ color: TEXT_MUTED }}
                  >
                    <div className="font-bold text-[11px] mb-[2px]" style={{ color: TEXT_DARK }}>
                      {consigneeName}
                    </div>
                    <div className="whitespace-pre-line">{consigneeAddress}</div>
                    <div className="mt-[2px]">
                      <span className="bold-label">GSTIN:</span> {consigneeGstin} | <span className="bold-label">PAN:</span> {consigneePan}
                    </div>
                    <div>
                      <span className="bold-label">Contact:</span> {consigneePhone} | <span className="bold-label">Email:</span> {consigneeEmail}
                    </div>
                  </div>
                </div>

                {(Boolean(quote.subject?.trim()) || Boolean(quote.reference?.trim())) && (
                  <div
                    className="border-t px-[14px] py-[6px] text-[9px] space-y-1"
                    style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_LIGHT }}
                  >
                    {quote.subject?.trim() && (
                      <div className="flex">
                        <div className="w-[85px] font-bold" style={{ color: TEXT_DARK }}>Subject:</div>
                        <div className="font-medium" style={{ color: TEXT_MUTED }}>{quote.subject}</div>
                      </div>
                    )}
                    {quote.reference?.trim() && (
                      <div className="flex">
                        <div className="w-[85px] font-bold" style={{ color: TEXT_DARK }}>Reference:</div>
                        <div className="font-medium" style={{ color: TEXT_MUTED }}>{quote.reference}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Particulars Table */}
              <div
                className="w-[710px] h-[28px] flex items-center px-[10px] font-semibold text-[10px] tracking-[0.5px] uppercase mb-[6px]"
                style={{ backgroundColor: "#e6f2f6", color: TEAL_PRIMARY, fontWeight: 600 }}
              >
                PARTICULARS
              </div>

              {renderParticularsTable(items)}

              {/* Totals Block & Words */}
              <div className="w-[710px] flex items-start justify-between gap-4 mb-[14px]">
                <div
                  className="w-[370px] rounded-[10px] border p-[10px_14px]"
                  style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_LIGHT }}
                >
                  <div className="text-[8px] font-bold uppercase tracking-[0.5px] mb-1" style={{ color: TEAL_PRIMARY }}>
                    Amount in Words
                  </div>
                  <div className="text-[9.5px] font-semibold italic leading-[1.4]" style={{ color: TEXT_DARK }}>
                    Rupees {inWords} Only
                  </div>
                </div>

                <div
                  className="w-[320px] rounded-[10px] border overflow-hidden text-[9.5px]"
                  style={{ borderColor: TEAL_BORDER }}
                >
                  <div className="p-[6px_14px] flex justify-between border-b" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                    <span>Taxable Amount</span>
                    <span className="tabular-nums font-semibold" style={{ color: TEXT_DARK }}>
                      ₹ {formatINRTwoDecimals(taxableAmount)}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="p-[6px_14px] flex justify-between border-b" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                      <span>Discount</span>
                      <span className="tabular-nums font-semibold text-rose-600">
                        -₹ {formatINRTwoDecimals(discountAmount)}
                      </span>
                    </div>
                  )}

                  {isExempt ? (
                    <div className="p-[6px_14px] flex justify-between border-b" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                      <span>Tax (GST Free)</span>
                      <span className="tabular-nums font-semibold text-emerald-600">₹ 0.00</span>
                    </div>
                  ) : isIntraState ? (
                    <>
                      <div className="p-[6px_14px] flex justify-between border-b" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                        <span>CGST (9%)</span>
                        <span className="tabular-nums font-semibold" style={{ color: TEXT_DARK }}>
                          ₹ {formatINRTwoDecimals(cgstAmount)}
                        </span>
                      </div>
                      <div className="p-[6px_14px] flex justify-between border-b" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                        <span>SGST (9%)</span>
                        <span className="tabular-nums font-semibold" style={{ color: TEXT_DARK }}>
                          ₹ {formatINRTwoDecimals(sgstAmount)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-[6px_14px] flex justify-between border-b" style={{ borderColor: TEAL_BORDER, color: TEXT_MUTED }}>
                      <span>IGST (18%)</span>
                      <span className="tabular-nums font-semibold" style={{ color: TEXT_DARK }}>
                        ₹ {formatINRTwoDecimals(igstAmount)}
                      </span>
                    </div>
                  )}

                  <div
                    className="p-[8px_14px] flex justify-between font-bold text-[11px]"
                    style={{ backgroundColor: TEAL_LIGHT, color: TEAL_PRIMARY }}
                  >
                    <span className="tracking-[0.5px] uppercase">GRAND TOTAL</span>
                    <span className="tabular-nums text-[11.5px]">₹ {formatINRTwoDecimals(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Turn-over notice to Page 3 */}
              <div className="w-[710px] mt-[18px] p-[10px_16px] border border-dashed rounded-[8px] bg-slate-50 flex justify-between items-center text-[9px] text-slate-500" style={{ borderColor: TEAL_BORDER }}>
                <span>Please refer to <strong>Page 3</strong> for Bank Remittance &amp; Signatures, and <strong>Pages 4–5</strong> for Annexure-I Terms.</span>
                <span className="font-semibold" style={{ color: TEAL_PRIMARY }}>Turn Over &rarr;</span>
              </div>
            </div>
          </div>

          {renderFooter(2)}
        </div>

        {/* ── Visual Page Divider: Page 2 -> Page 3 ── */}
        <div className="w-[794px] py-6 flex items-center justify-center gap-3 select-none print:hidden">
          <div className="flex-1 h-px bg-slate-400/50" />
          <div className="flex items-center gap-2 px-3.5 py-1 bg-slate-100 rounded-full border border-slate-300 shadow-xs text-slate-700">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL_PRIMARY }} />
            <span className="text-[10.5px] font-bold tracking-wider uppercase font-mono">
              Page Break • Page 3 of {totalPages} • Terms &amp; Authorization
            </span>
          </div>
          <div className="flex-1 h-px bg-slate-400/50" />
        </div>

        {/* ── PAGE 3: BANK DETAILS, TERMS & CONDITIONS, DUAL SIGNATURES ───────── */}
        {hasPage3 && (
          <div
            className="a4-page-sheet w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px] bg-white relative flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-300/80 rounded-sm print:shadow-none print:border-none print:rounded-none"
            style={{ width: "794px", height: "1123px" }}
          >
            <div>
              {/* Top stripes */}
              <div className="w-[794px]">
                <div style={{ height: "8px", width: "794px", backgroundColor: TEAL_PRIMARY }} />
                <div style={{ height: "4px", width: "794px", backgroundColor: GREY_LINE }} />
              </div>

              <div className="px-[42px] pt-[20px]">
                {/* Page 3 Header (Matches Page 2 scale and branding) */}
                <div className="flex items-center justify-between mb-[28px]">
                  <div className="w-[260px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/stpl-logo.png"
                      alt="Star Mould"
                      className="w-[240px] h-auto object-contain block"
                    />
                  </div>

                  <div className="text-right">
                    <div
                      className="text-[22px] font-extrabold tracking-[0.5px] leading-none mb-[6px]"
                      style={{ color: TEAL_PRIMARY }}
                    >
                      TERMS &amp; AUTHORIZATION
                    </div>
                    <div
                      className="h-[4px] w-[310px] ml-auto mb-[6px]"
                      style={{ backgroundColor: GREY_LINE }}
                    />
                  </div>
                </div>

                {/* Bank Details */}
                <div className="w-[710px] mb-[20px]">
                  <div
                    className="h-[32px] px-[14px] flex items-center text-white font-bold text-[10.5px] tracking-[0.5px] uppercase"
                    style={{ backgroundColor: TEAL_PRIMARY }}
                  >
                    BANK DETAILS FOR REMITTANCE
                  </div>
                  <div
                    className="border border-t-0 p-[12px_18px] flex justify-between text-[11px]"
                    style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_LIGHT }}
                  >
                    <div className="flex-1">
                      <span className="font-bold block text-[9px] uppercase tracking-wider mb-1" style={{ color: TEAL_PRIMARY }}>
                        Bank Name
                      </span>
                      <span className="font-semibold" style={{ color: TEXT_DARK }}>{bankName}</span>
                    </div>
                    <div className="flex-1">
                      <span className="font-bold block text-[9px] uppercase tracking-wider mb-1" style={{ color: TEAL_PRIMARY }}>
                        Account Number
                      </span>
                      <span className="tabular-nums font-semibold tracking-wider" style={{ color: TEXT_DARK }}>{bankAccountNo}</span>
                    </div>
                    <div className="flex-1">
                      <span className="font-bold block text-[9px] uppercase tracking-wider mb-1" style={{ color: TEAL_PRIMARY }}>
                        IFSC Code
                      </span>
                      <span className="tabular-nums font-semibold tracking-wider" style={{ color: TEXT_DARK }}>{bankIfsc}</span>
                    </div>
                    <div className="flex-1">
                      <span className="font-bold block text-[9px] uppercase tracking-wider mb-1" style={{ color: TEAL_PRIMARY }}>
                        Branch &amp; City
                      </span>
                      <span className="font-semibold" style={{ color: TEXT_DARK }}>{bankBranch}</span>
                    </div>
                  </div>
                </div>

                {/* Terms & Conditions */}
                {activeTerms.length > 0 && (
                  <div className="w-[710px] mb-[20px]">
                    <div
                      className="h-[32px] px-[14px] flex items-center text-white font-bold text-[10.5px] tracking-[0.5px] uppercase"
                      style={{ backgroundColor: TEAL_PRIMARY }}
                    >
                      COMMERCIAL TERMS &amp; CONDITIONS
                    </div>
                    <div
                      className="border border-t-0 p-[10px_18px] space-y-[2px]"
                      style={{ borderColor: TEAL_BORDER, backgroundColor: "#ffffff" }}
                    >
                      {activeTerms.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-4 py-[6px] border-b border-slate-100 last:border-b-0 leading-[1.5]"
                        >
                          <div className="w-[160px] shrink-0 font-bold text-[10.5px]" style={{ color: TEXT_DARK }}>
                            {idx + 1}. {t.label}
                          </div>
                          <div className="flex-1 whitespace-pre-line text-[10.5px]" style={{ color: TEXT_MUTED }}>
                            {t.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes Strip */}
                <div
                  className="w-[710px] rounded-[8px] border px-[16px] py-[10px] mb-[20px] text-[10px] leading-[1.5]"
                  style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_LIGHT, color: TEXT_MUTED }}
                >
                  <span className="font-bold" style={{ color: TEAL_PRIMARY }}>SPECIAL NOTES:&nbsp;</span>
                  <span>Goods once manufactured / dispatched will not be accepted back or cancelled without prior mutual written consent. Payment delayed beyond agreed due date shall attract interest @ 18% per annum.</span>
                </div>

                {/* Dual Signatures */}
                <div
                  className="w-[710px] min-h-[185px] rounded-[10px] border overflow-hidden p-[20px_26px_22px_26px] grid grid-cols-2 gap-8 mb-[20px] bg-white relative"
                  style={{ borderColor: TEAL_BORDER }}
                >
                  {/* Left: Customer Acceptance */}
                  <div className="flex flex-col justify-between h-full min-h-[145px]">
                    <span
                      className="font-bold text-[10px] tracking-[0.5px] uppercase"
                      style={{ color: TEAL_PRIMARY }}
                    >
                      CUSTOMER ACCEPTANCE &amp; CONFIRMATION
                    </span>

                    {/* Open blank space for customer stamp & signature */}
                    <div className="h-[75px]" />

                    <div className="space-y-1.5 text-[9.5px]" style={{ color: TEXT_LABEL }}>
                      <div>Authorized Signature: __________________________</div>
                      <div>Name &amp; Designation: &nbsp;__________________________</div>
                      <div>Date: __________________________</div>
                    </div>
                  </div>

                  {/* Right: StarMould Authorization */}
                  <div className="flex flex-col justify-between items-end h-full min-h-[145px]">
                    <span
                      className="font-bold text-[10px] tracking-[0.5px] uppercase text-right"
                      style={{ color: TEAL_PRIMARY }}
                    >
                      FOR {COMPANY.name}
                    </span>

                    <div className="flex flex-col items-center justify-end w-[200px] relative">
                      {quote.include_digital_stamp !== false && (
                        <div className="mb-[6px] pointer-events-none opacity-90 z-10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/images/starmould-stamp.png"
                            alt="Authorized Stamp"
                            width={76}
                            height={76}
                            style={{ width: "76px", height: "76px", maxWidth: "76px", maxHeight: "76px", objectFit: "contain" }}
                            className="block mx-auto"
                          />
                        </div>
                      )}
                      <div
                        className="font-bold text-[10px] pt-1.5 pb-0.5 border-t border-slate-300 w-full text-center z-20"
                        style={{ color: TEXT_DARK }}
                      >
                        Authorized Signatory
                      </div>
                    </div>
                  </div>
                </div>

                {/* Turn-over notice to Annexure-I */}
                <div className="w-[710px] p-[8px_16px] border border-dashed rounded-[8px] bg-slate-50 flex justify-between items-center text-[9px] text-slate-500" style={{ borderColor: TEAL_BORDER }}>
                  <span>Please refer to <strong>Pages 4 &amp; 5</strong> for Annexure-I: Detailed Manufacturer Terms &amp; Conditions (Clauses 1 to 23).</span>
                  <span className="font-semibold" style={{ color: TEAL_PRIMARY }}>Annexure-I Next &rarr;</span>
                </div>
              </div>
            </div>

            {renderFooter(3)}
          </div>
        )}

        {/* ── Visual Page Divider: Page 3 -> Page 4 ── */}
        <div className="w-[794px] py-6 flex items-center justify-center gap-3 select-none print:hidden">
          <div className="flex-1 h-px bg-slate-400/50" />
          <div className="flex items-center gap-2 px-3.5 py-1 bg-slate-100 rounded-full border border-slate-300 shadow-xs text-slate-700">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL_PRIMARY }} />
            <span className="text-[10.5px] font-bold tracking-wider uppercase font-mono">
              Page Break • Page 4 of 5 • Annexure - I (Part 1)
            </span>
          </div>
          <div className="flex-1 h-px bg-slate-400/50" />
        </div>

        {/* ── PAGE 4: ANNEXURE - I PART 1 (CLAUSES 1 TO 12) ─────────── */}
        <div
          className="a4-page-sheet w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px] bg-white relative flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-300/80 rounded-sm print:shadow-none print:border-none print:rounded-none"
          style={{ width: "794px", height: "1123px" }}
        >
          <div>
            {/* Top stripes */}
            <div className="w-[794px]">
              <div style={{ height: "8px", width: "794px", backgroundColor: TEAL_PRIMARY }} />
              <div style={{ height: "4px", width: "794px", backgroundColor: GREY_LINE }} />
            </div>

            <div className="px-[42px] pt-[20px]">
              {/* Page 4 Header */}
              <div className="flex items-center justify-between mb-[20px]">
                <div className="w-[260px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/stpl-logo.png"
                    alt="Star Mould"
                    className="w-[240px] h-auto object-contain block"
                  />
                </div>

                <div className="text-right">
                  <div
                    className="text-[22px] font-extrabold tracking-[0.5px] leading-none mb-[6px]"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    ANNEXURE - I
                  </div>
                  <div
                    className="h-[4px] w-[175px] ml-auto mb-[6px]"
                    style={{ backgroundColor: GREY_LINE }}
                  />
                  <div className="text-[9.5px] text-slate-500 font-medium">
                    Terms &amp; Conditions &bull; Quotation: <strong>{quote.quotation_no || "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Title Ribbon */}
              <div
                className="w-[710px] h-[28px] px-[12px] flex items-center justify-between text-white font-bold text-[10px] tracking-[0.5px] uppercase mb-[10px]"
                style={{ backgroundColor: TEAL_PRIMARY }}
              >
                <span>DETAILED TERMS &amp; CONDITIONS – MANUFACTURER</span>
                <span className="text-[9px] font-normal text-white/85">Part 1 (Clauses 1 to 12)</span>
              </div>

              {/* Annexure Table (Part 1: Clauses 1 to 12) */}
              {renderAnnexureTable(ANNEXURE_TERMS_PART1)}

              {/* Bottom turn-over notice */}
              <div className="w-[710px] mt-[14px] p-[8px_16px] border border-dashed rounded-[8px] bg-slate-50 flex justify-between items-center text-[9px] text-slate-500" style={{ borderColor: TEAL_BORDER }}>
                <span>Continued on <strong>Page 5</strong> for Clauses 13 to 23 and Customer Final Acceptance.</span>
                <span className="font-semibold" style={{ color: TEAL_PRIMARY }}>Continued &rarr;</span>
              </div>
            </div>
          </div>

          {renderFooter(4)}
        </div>

        {/* ── Visual Page Divider: Page 4 -> Page 5 ── */}
        <div className="w-[794px] py-6 flex items-center justify-center gap-3 select-none print:hidden">
          <div className="flex-1 h-px bg-slate-400/50" />
          <div className="flex items-center gap-2 px-3.5 py-1 bg-slate-100 rounded-full border border-slate-300 shadow-xs text-slate-700">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TEAL_PRIMARY }} />
            <span className="text-[10.5px] font-bold tracking-wider uppercase font-mono">
              Page Break • Page 5 of 5 • Annexure - I (Part 2)
            </span>
          </div>
          <div className="flex-1 h-px bg-slate-400/50" />
        </div>

        {/* ── PAGE 5: ANNEXURE - I PART 2 (CLAUSES 13 TO 23 + ACCEPTANCE) ─────────── */}
        <div
          className="a4-page-sheet w-[794px] h-[1123px] min-h-[1123px] max-h-[1123px] bg-white relative flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-300/80 rounded-sm print:shadow-none print:border-none print:rounded-none"
          style={{ width: "794px", height: "1123px" }}
        >
          <div>
            {/* Top stripes */}
            <div className="w-[794px]">
              <div style={{ height: "8px", width: "794px", backgroundColor: TEAL_PRIMARY }} />
              <div style={{ height: "4px", width: "794px", backgroundColor: GREY_LINE }} />
            </div>

            <div className="px-[42px] pt-[20px]">
              {/* Page 5 Header */}
              <div className="flex items-center justify-between mb-[20px]">
                <div className="w-[260px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/stpl-logo.png"
                    alt="Star Mould"
                    className="w-[240px] h-auto object-contain block"
                  />
                </div>

                <div className="text-right">
                  <div
                    className="text-[22px] font-extrabold tracking-[0.5px] leading-none mb-[6px]"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    ANNEXURE - I
                  </div>
                  <div
                    className="h-[4px] w-[175px] ml-auto mb-[6px]"
                    style={{ backgroundColor: GREY_LINE }}
                  />
                  <div className="text-[9.5px] text-slate-500 font-medium">
                    Terms &amp; Conditions &bull; Quotation: <strong>{quote.quotation_no || "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Title Ribbon */}
              <div
                className="w-[710px] h-[26px] px-[12px] flex items-center justify-between text-white font-bold text-[9.5px] tracking-[0.5px] uppercase mb-[8px]"
                style={{ backgroundColor: TEAL_PRIMARY }}
              >
                <span>DETAILED TERMS &amp; CONDITIONS – MANUFACTURER</span>
                <span className="text-[9px] font-normal text-white/85">Part 2 (Clauses 13 to 23)</span>
              </div>

              {/* Annexure Table (Part 2: Clauses 13 to 23) */}
              {renderAnnexureTable(ANNEXURE_TERMS_PART2)}

              {/* Special Notes Strip */}
              <div
                className="w-[710px] mt-[10px] mb-[10px] rounded-[8px] border px-[14px] py-[6px] text-[9px] leading-[1.45]"
                style={{ borderColor: TEAL_BORDER, backgroundColor: TEAL_LIGHT, color: TEXT_MUTED }}
              >
                <span className="font-bold" style={{ color: TEAL_PRIMARY }}>SPECIAL NOTES:&nbsp;</span>
                <span>Goods once manufactured / dispatched will not be accepted back or cancelled without prior mutual written consent. Payment delayed beyond agreed due date shall attract interest @ 18% per annum.</span>
              </div>

              {/* Dual Signatures */}
              <div
                className="w-[710px] min-h-[145px] rounded-[10px] border overflow-hidden p-[14px_22px_14px_22px] grid grid-cols-2 gap-8 bg-white relative"
                style={{ borderColor: TEAL_BORDER }}
              >
                {/* Left: Customer Acceptance */}
                <div className="flex flex-col justify-between h-full min-h-[120px]">
                  <span
                    className="font-bold text-[9.5px] tracking-[0.5px] uppercase"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    CUSTOMER ACCEPTANCE &amp; CONFIRMATION
                  </span>

                  {/* Open blank space for customer stamp & signature */}
                  <div className="h-[52px]" />

                  <div className="space-y-1 text-[9px]" style={{ color: TEXT_LABEL }}>
                    <div>Authorized Signature: __________________________</div>
                    <div>Name &amp; Designation: &nbsp;__________________________</div>
                    <div>Date: __________________________</div>
                  </div>
                </div>

                {/* Right: StarMould Authorization */}
                <div className="flex flex-col justify-between items-end h-full min-h-[120px]">
                  <span
                    className="font-bold text-[9.5px] tracking-[0.5px] uppercase text-right"
                    style={{ color: TEAL_PRIMARY }}
                  >
                    FOR {COMPANY.name}
                  </span>

                  <div className="flex flex-col items-center justify-end w-[200px] relative">
                    {quote.include_digital_stamp !== false && (
                      <div className="mb-[6px] pointer-events-none opacity-90 z-10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/images/starmould-stamp.png"
                          alt="Authorized Stamp"
                          width={76}
                          height={76}
                          style={{ width: "76px", height: "76px", maxWidth: "76px", maxHeight: "76px", objectFit: "contain" }}
                          className="block mx-auto"
                        />
                      </div>
                    )}
                    <div
                      className="font-bold text-[10px] pt-1 pb-0.5 border-t border-slate-300 w-full text-center z-20"
                      style={{ color: TEXT_DARK }}
                    >
                      Authorized Signatory
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {renderFooter(5)}
        </div>
      </div>
    </div>
  );
};
