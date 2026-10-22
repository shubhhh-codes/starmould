"use client";

import React from "react";
import { Printer, X, Building2, Phone, Mail, ShieldCheck, FileText } from "lucide-react";

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

// Convert amount to Indian currency words
function numberToIndianWords(num: number): string {
  if (!num || num === 0) return "Zero rupees only";
  const a = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"
  ];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " hundred" + (n % 100 !== 0 ? " and " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " thousand" + (n % 1000 !== 0 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " lakh" + (n % 100000 !== 0 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " crore" + (n % 10000000 !== 0 ? " " + inWords(n % 10000000) : "");
  }

  const rounded = Math.round(num);
  const words = inWords(rounded);
  return (words.charAt(0).toUpperCase() + words.slice(1) + " rupees only").trim();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(d);
    const day = parts.find((p) => p.type === "day")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

export function PurchaseOrderVoucher({
  po,
  vendor,
  customerName = "",
  onPrint,
  onClose,
  isModal = true,
}: PurchaseOrderVoucherProps) {
  const items = po.items || [];
  
  // Calculate item pricing & taxes
  const processedItems = items.map((it, idx) => {
    const qty = Number(it.qty) || 1;
    // Default estimated rate if none provided (or 0)
    const rate = Number(it.rate) || 0;
    const discount = Number(it.discount) || 0;
    const amount = rate > 0 ? (rate * qty) - discount : 0;
    const gstPercent = 18; // Standard GST for fabricated steel / tools
    const tax = amount > 0 ? (amount * gstPercent) / 100 : 0;
    const total = amount + tax;

    return {
      srNo: idx + 1,
      name: it.platename || `Subplate #${it.plateid}`,
      dimensions: it.material || "—",
      materialType: it.materialtype || "MS-Bright",
      hsnCode: it.hsn || "72284000",
      qty,
      rate,
      discount,
      amount,
      gstPercent,
      tax,
      total,
    };
  });

  const totalQty = processedItems.reduce((acc, curr) => acc + curr.qty, 0);
  const totalAmount = processedItems.reduce((acc, curr) => acc + curr.amount, 0);
  const totalTax = processedItems.reduce((acc, curr) => acc + curr.tax, 0);
  const grandTotal = totalAmount + totalTax;

  const vendorName = vendor?.vendor_name || vendor?.customername || "Authorized Supplier";
  const vendorAddress = vendor?.address || (vendor?.city ? `${vendor.city}, Gujarat, India` : "Industrial Area, Rajkot, Gujarat");
  const vendorGst = vendor?.gstin || "24AFPFS7402A1Z7";
  const vendorPan = vendor?.pan || "AFPFS7402A";
  const vendorMobile = vendor?.mobile || vendor?.mobile1 || "8000035580";

  // Delivery / Expiry date (10 days after odate)
  const deliveryDate = (() => {
    try {
      const d = new Date(po.odate || new Date());
      d.setDate(d.getDate() + 10);
      return formatDate(d.toISOString());
    } catch {
      return "10-Nov-2026";
    }
  })();

  const handlePrint = () => {
    if (onPrint) onPrint();
    else window.print();
  };

  return (
    <div className="w-full bg-white text-slate-800 font-sans print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}} />
      {/* Top Action Bar (hidden during print) */}
      <div className="flex items-center justify-between p-3 mb-4 bg-slate-100 border border-slate-200 rounded-xl print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#82b426]" />
          <span className="text-xs font-semibold text-slate-700">
            Purchase Order: <span className="font-mono text-slate-900">{po.srno}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#82b426] hover:bg-[#729e21] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PO</span>
          </button>
          {isModal && onClose && (
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

      {/* Main Printable Sheet (matching APS / Sunvine Invoice format) */}
      <div className="p-6 sm:p-8 bg-white border border-slate-200 rounded-lg print:border-none print:p-0 space-y-6 text-[12px] leading-relaxed">
        {/* =========================================================================
            1. TOP HEADER (Logo, Metadata & Olive-Green Badge)
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200">
          {/* Logo / Company Brand */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl flex items-center justify-center text-white font-black text-2xl shadow-sm tracking-tighter border-2 border-[#82b426]">
              SM
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                STARMOULD
              </h1>
              <p className="text-[10px] font-semibold tracking-wider uppercase text-slate-500">
                Technology Pvt. Ltd.
              </p>
              <p className="text-[9px] text-[#82b426] font-bold">
                Mould Tooling & Precision Engineering
              </p>
            </div>
          </div>

          {/* Center Metadata Key-Values */}
          <div className="text-[11px] text-slate-700 font-medium space-y-0.5">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-slate-500 w-36">Purchase Order # :</span>
              <span className="font-bold text-slate-900 font-mono">{po.srno}</span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-slate-500 w-36">Purchase Order Date :</span>
              <span className="font-semibold text-slate-900">{formatDate(po.odate)}</span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-slate-500 w-36">Expected Delivery :</span>
              <span className="font-semibold text-slate-900">{deliveryDate}</span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-slate-500 w-36">PO Ref No :</span>
              <span className="font-bold font-mono text-[#82b426]">{po.projectid || "PRJ-SM"}</span>
            </div>
          </div>

          {/* Right Green Badge Banner */}
          <div className="sm:text-right w-full sm:w-auto">
            <div className="bg-[#82b426] text-white px-6 py-2.5 rounded font-black text-sm tracking-wider uppercase inline-block shadow-xs">
              PURCHASE ORDER
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. THREE-COLUMN CARDS (Company Details, Bill To, Ship To)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Company Details */}
          <div className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-lg space-y-1 text-[11px]">
            <div className="border-b border-[#82b426] pb-1 mb-2 font-bold text-slate-900 flex items-center justify-between">
              <span>Company Details</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#82b426]" />
            </div>
            <div className="font-bold text-slate-900 text-xs">
              STARMOULD TECHNOLOGY PVT. LTD.
            </div>
            <div className="text-slate-600">
              Plot G-705, Road-5, GIDC Lodhika, Metoda,
            </div>
            <div className="text-slate-600">
              Rajkot, Gujarat, 360021 India
            </div>
            <div className="pt-1">
              <span className="font-semibold text-slate-700">GSTIN: </span>
              <span className="font-mono font-bold text-slate-900">24ABLCS1427Q1ZV</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">PAN NO: </span>
              <span className="font-mono text-slate-900">AALCS1427Q</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Mobile: </span>
              <span className="text-slate-900">+91 82384 51671</span>
            </div>
          </div>

          {/* Card 2: Bill To / Supplier */}
          <div className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-lg space-y-1 text-[11px]">
            <div className="border-b border-[#82b426] pb-1 mb-2 font-bold text-slate-900 flex items-center justify-between">
              <span>Bill To (Supplier)</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#82b426]" />
            </div>
            <div className="font-bold text-slate-900 text-xs uppercase">
              {vendorName}
            </div>
            <div className="text-slate-600">
              {vendorAddress}
            </div>
            <div className="pt-1">
              <span className="font-semibold text-slate-700">GSTIN: </span>
              <span className="font-mono font-bold text-slate-900">{vendorGst}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">PAN NO: </span>
              <span className="font-mono text-slate-900">{vendorPan}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Mobile: </span>
              <span className="text-slate-900">{vendorMobile}</span>
            </div>
          </div>

          {/* Card 3: Ship To (Works Location) */}
          <div className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-lg space-y-1 text-[11px]">
            <div className="border-b border-[#82b426] pb-1 mb-2 font-bold text-slate-900 flex items-center justify-between">
              <span>Ship To (Plant Works)</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#82b426]" />
            </div>
            <div className="font-bold text-slate-900 text-xs">
              STARMOULD WORKS / METODA PLANT
            </div>
            <div className="text-slate-600">
              Plot G-705, Road-5, GIDC Lodhika, Metoda,
            </div>
            <div className="text-slate-600">
              Rajkot, Gujarat, 360021 India
            </div>
            <div className="pt-1">
              <span className="font-semibold text-slate-700">GSTIN: </span>
              <span className="font-mono font-bold text-slate-900">24ABLCS1427Q1ZV</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Destination: </span>
              <span className="text-slate-900">Raw Material Store</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">Contact: </span>
              <span className="text-slate-900">+91 82384 51671</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. LINE ITEMS TABLE (Dark Navy Header, Clean Bordered Rows)
            ========================================================================= */}
        <div className="overflow-x-auto border border-slate-300 rounded-sm">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#203a5c] text-white font-bold uppercase text-[10px] tracking-wide">
                <th className="py-2.5 px-3 text-center w-8">#</th>
                <th className="py-2.5 px-3">Items / Subplate</th>
                <th className="py-2.5 px-3">HSN Code</th>
                <th className="py-2.5 px-3 text-center">Qty</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">Discount</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3 text-center">GST</th>
                <th className="py-2.5 px-3 text-right">TAX</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {processedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-4 text-center text-slate-400">
                    No plate items found in this purchase order.
                  </td>
                </tr>
              ) : (
                processedItems.map((it) => (
                  <tr key={it.srNo} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                      {it.srNo}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{it.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {it.dimensions} &bull; <span className="font-semibold text-slate-700">{it.materialType}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {it.hsnCode}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900">
                      {it.qty} Nos
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {it.rate > 0 ? it.rate.toLocaleString("en-IN") : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      ₹ 0
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {it.amount > 0 ? `₹ ${it.amount.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                      {it.gstPercent}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {it.tax > 0 ? `₹ ${it.tax.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {it.total > 0 ? `₹ ${it.total.toLocaleString("en-IN")}` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Summary Subtotal */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                <td colSpan={3} className="py-2 px-3 text-right uppercase text-[10px] tracking-wider text-slate-600">
                  Total
                </td>
                <td className="py-2 px-3 text-center font-mono text-xs">
                  {totalQty}
                </td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-500">
                  ₹ 0
                </td>
                <td className="py-2 px-3 text-right font-mono text-[11px]">
                  {totalAmount > 0 ? `₹ ${totalAmount.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right font-mono text-[11px]">
                  {totalTax > 0 ? `₹ ${totalTax.toLocaleString("en-IN")}` : "—"}
                </td>
                <td className="py-2 px-3 text-right font-mono text-[11px]">
                  {grandTotal > 0 ? `₹ ${grandTotal.toLocaleString("en-IN")}` : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* =========================================================================
            4. TOTALS & GRAND TOTAL SUMMARY (Right-Aligned Block)
            ========================================================================= */}
        <div className="flex flex-col items-end space-y-1.5 pt-2">
          <div className="w-full sm:w-80 space-y-1 text-[11px] text-slate-700">
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span className="text-slate-500">TCS</span>
              <span className="font-mono">₹ 0</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-100">
              <span className="text-slate-500">Round Off</span>
              <span className="font-mono">₹ 0</span>
            </div>
            {/* Grand Total Navy Banner */}
            <div className="flex justify-between items-center bg-[#203a5c] text-white p-2.5 rounded font-bold text-sm shadow-xs">
              <span>Grand Total</span>
              <span className="font-mono text-base">
                {grandTotal > 0 ? `₹ ${grandTotal.toLocaleString("en-IN")}` : `Total Qty: ${totalQty} Nos`}
              </span>
            </div>
            {/* In Words */}
            <div className="text-right text-[10px] text-slate-500 italic pt-0.5">
              {grandTotal > 0 ? `(${numberToIndianWords(grandTotal)})` : `(${totalQty} plates ordered for mould ${po.projectid})`}
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. TAX SUMMARY TABLE
            ========================================================================= */}
        <div className="space-y-2 pt-2">
          <div className="font-bold text-slate-800 text-[11px]">
            &mdash; Tax Summary
          </div>
          <div className="overflow-x-auto border border-slate-300 rounded-sm">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#203a5c] text-white font-bold uppercase text-[10px] tracking-wide">
                  <th className="py-2 px-3 text-center w-8">#</th>
                  <th className="py-2 px-3">HSN/SAC</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-center">IGST(%)</th>
                  <th className="py-2 px-3 text-right">IGST</th>
                  <th className="py-2 px-3 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {processedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-2 text-center text-slate-400">
                      No tax records.
                    </td>
                  </tr>
                ) : (
                  processedItems.map((it) => (
                    <tr key={it.srNo}>
                      <td className="py-1.5 px-3 text-center font-mono text-slate-500">{it.srNo}</td>
                      <td className="py-1.5 px-3 font-mono">{it.hsnCode}</td>
                      <td className="py-1.5 px-3 text-right font-mono">
                        {it.amount > 0 ? `₹ ${it.amount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono">{it.gstPercent}%</td>
                      <td className="py-1.5 px-3 text-right font-mono">
                        {it.tax > 0 ? `₹ ${it.tax.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono">
                        {it.tax > 0 ? `₹ ${it.tax.toLocaleString("en-IN")}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t border-slate-300 font-bold text-slate-900">
                  <td colSpan={2} className="py-2 px-3 text-right uppercase text-[10px]">Total</td>
                  <td className="py-2 px-3 text-right font-mono">
                    {totalAmount > 0 ? `₹ ${totalAmount.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3 text-right font-mono">
                    {totalTax > 0 ? `₹ ${totalTax.toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {totalTax > 0 ? `₹ ${totalTax.toLocaleString("en-IN")}` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* =========================================================================
            6. BANK DETAILS
            ========================================================================= */}
        <div className="space-y-1.5 pt-2">
          <div className="font-bold text-slate-800 text-[11px]">
            &mdash; Bank Details
          </div>
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] font-medium text-slate-700 flex flex-wrap items-center gap-x-6 gap-y-1">
            <div>
              <span className="font-bold text-slate-900">Name:</span> Australian Premium Solar India Limited / Starmould Technology Pvt Ltd
            </div>
            <div>
              <span className="font-bold text-slate-900">Bank:</span> HDFC Bank
            </div>
            <div>
              <span className="font-bold text-slate-900">IFSC:</span> <span className="font-mono">HDFC0000960</span>
            </div>
            <div>
              <span className="font-bold text-slate-900">A/C:</span> <span className="font-mono font-bold">50200001226815</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            7. TERMS & CONDITIONS
            ========================================================================= */}
        <div className="space-y-1.5 pt-2">
          <div className="font-bold text-slate-800 text-[11px]">
            &mdash; Terms &amp; Conditions
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700 leading-relaxed pl-1">
            <li>
              <span className="font-bold text-slate-900">Payments : </span>
              20% Advance On PO And 80% Before Dispatch / Upon Material Inward Inspection.
            </li>
            <li>
              <span className="font-bold text-slate-900">Delivery : </span>
              3 To 4 Weeks from PO release date.
            </li>
            <li>
              <span className="font-bold text-slate-900">Warranty : </span>
              Warranty Will Not Be Applicable In Case Of Mishandling, Any Modification / Alteration, Physical Damage Due To Any Natural Or Un-natural Circumstances. Insurance Can Be Arranged On Request Bound By Customer.
            </li>
            <li>
              <span className="font-bold text-slate-900">Freight : </span>
              Freight Extra as actuals.
            </li>
            <li>
              <span className="font-bold text-slate-900">Transport : </span>
              The material should be picked up / delivered within 20 days from the date of quotation.
            </li>
          </ol>
        </div>

        {/* =========================================================================
            8. SIGNATURE BLOCK (Page Footer)
            ========================================================================= */}
        <div className="pt-10 flex justify-between items-end border-t border-slate-300">
          <div className="text-[10px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-700">STARMOULD TECHNOLOGY PVT. LTD.</p>
            <p>Nr. Metoda GIDC, Road-5, Rajkot - 360021, Gujarat</p>
            <p>GSTIN: 24ABLCS1427Q1ZV</p>
          </div>
          <div className="text-right space-y-12">
            <div className="text-xs font-bold text-slate-900">
              For, AUSTRALIAN PREMIUM SOLAR (INDIA) LTD / STARMOULD
            </div>
            <div className="flex items-center justify-end gap-12 text-[10px] font-semibold text-slate-600">
              <span className="border-t border-slate-400 pt-1 px-8">Authorized Signatory</span>
              <span className="border-t border-slate-400 pt-1 px-4">Date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
