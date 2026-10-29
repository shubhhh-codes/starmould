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
  email: "info.starmould@yahoo.com",
  website: "www.starmould.in",
} as const;

// ─── Exact Color Palette from Star Mould Brand System ─────────────────────────
const TEAL_PRIMARY = "#006181";
const GREY_LINE    = "#62676b";
const TEAL_LIGHT   = "#f3f9fb";
const TEAL_BORDER  = "#bcd8e0";
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
  const challanDate = formatDate(challan.docDate || challan.chdate);
  const vendor = challan.party;
  const vendorName = vendor?.vendor_name || vendor?.customername || "—";
  const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);

  return (
    <div
      id="outward-challan-voucher"
      className="bg-white text-slate-800 font-sans print:p-0 mx-auto"
      style={{
        width: "794px",
        minWidth: "794px",
        maxWidth: "794px",
        boxSizing: "border-box",
        backgroundColor: "#ffffff",
        color: TEXT_DARK,
        position: "relative",
      }}
    >
      {/* ── Modal Floating Action Bar (hidden in print) ── */}
      {isModal && (
        <div className="flex items-center justify-between p-3 bg-slate-900 text-white rounded-t-xl print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wide">
              OUTWARD JOB WORK CHALLAN: {challanNo}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#006181] hover:bg-[#0d4f68] text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Printable Page Content ── */}
      <div
        id="challan-printable-area"
        className="p-8 print:p-6 space-y-4"
        style={{ boxSizing: "border-box" }}
      >
        {/* Document Header / Letterhead */}
        <div
          className="pb-3 border-b-2"
          style={{ borderColor: TEAL_PRIMARY }}
        >
          <div className="flex items-start justify-between">
            {/* Left: Star Mould Brand Identity */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-extrabold text-xl tracking-tight uppercase"
                  style={{ color: TEAL_PRIMARY, letterSpacing: "0.02em" }}
                >
                  {COMPANY.name}
                </span>
              </div>
              <p className="text-[11px] leading-tight text-slate-600">
                {COMPANY.address1} {COMPANY.address2}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium pt-0.5">
                <span>Phone: <strong className="text-slate-700">{COMPANY.mobile}</strong></span>
                <span>•</span>
                <span>Email: <strong className="text-slate-700">{COMPANY.email}</strong></span>
                <span>•</span>
                <span>Web: <strong className="text-slate-700">{COMPANY.website}</strong></span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-600 pt-0.5 font-mono">
                <span>GSTIN: <strong className="text-slate-900">{COMPANY.gstin}</strong></span>
                <span>•</span>
                <span>PAN: <strong className="text-slate-900">{COMPANY.pan}</strong></span>
                <span>•</span>
                <span>CIN: <strong className="text-slate-900">{COMPANY.cin}</strong></span>
              </div>
            </div>

            {/* Right: Document Classification Banner */}
            <div className="text-right shrink-0">
              <div
                className="inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider text-white"
                style={{ backgroundColor: TEAL_PRIMARY }}
              >
                OUTWARD JOB WORK CHALLAN
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                DELIVERY / JOB WORK CHALLAN
              </p>
              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300 mt-1">
                ORIGINAL FOR PROCESSOR
              </span>
            </div>
          </div>
        </div>

        {/* ── Metadata Grid: Consignor vs Vendor & Challan Specifics ── */}
        <div
          className="grid grid-cols-2 gap-0 border rounded-lg overflow-hidden text-xs"
          style={{ borderColor: TEAL_BORDER }}
        >
          {/* Left: Vendor / Job Worker Details */}
          <div
            className="p-3 border-r space-y-1"
            style={{ borderColor: TEAL_BORDER, backgroundColor: "#fafcfd" }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wider block"
              style={{ color: TEXT_LABEL }}
            >
              Consignee / Job Worker (Vendor)
            </span>
            <p className="font-bold text-sm text-slate-900 leading-snug">
              {vendorName}
            </p>
            {vendor?.vendor_code && (
              <span className="text-[10px] font-mono text-slate-500 block">
                Vendor Code: {vendor.vendor_code}
              </span>
            )}
            {vendor?.address && (
              <p className="text-[11px] text-slate-600 leading-tight">
                {vendor.address}{vendor.city ? `, ${vendor.city}` : ""}
              </p>
            )}
            <div className="pt-1 text-[11px] text-slate-600 space-y-0.5 font-medium">
              {(vendor?.mobile || vendor?.mobile1) && (
                <p>
                  Contact: <span className="text-slate-900">{vendor.mobile}{vendor.mobile1 ? ` / ${vendor.mobile1}` : ""}</span>
                </p>
              )}
              {vendor?.email && (
                <p>
                  Email: <span className="text-slate-900">{vendor.email}</span>
                </p>
              )}
              {vendor?.gstin && (
                <p className="font-mono text-[10px]">
                  GSTIN: <span className="font-bold text-slate-900">{vendor.gstin}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right: Challan Meta Details */}
          <div className="p-3 space-y-1.5" style={{ backgroundColor: "#ffffff" }}>
            <span
              className="text-[10px] font-bold uppercase tracking-wider block"
              style={{ color: TEXT_LABEL }}
            >
              Challan Specifications
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-[10px] text-slate-500 block">Challan No:</span>
                <span className="font-mono font-bold text-sm text-slate-900 block">
                  {challanNo}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Challan Date:</span>
                <span className="font-medium text-slate-900 block">
                  {challanDate}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Mould Project:</span>
                <span className="font-mono font-bold text-slate-900 block">
                  {challan.projectCode || "—"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Customer Name:</span>
                <span className="font-medium text-slate-800 block truncate">
                  {challan.customerName || "—"}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-100">
                <span className="text-[10px] text-slate-500 block">Transporter / Delivery Mode:</span>
                <span className="font-medium text-slate-800 block">
                  {challan.transporter || "Self / Hand Delivery"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Subplates / Tooling Table ── */}
        <div className="border rounded-lg overflow-hidden" style={{ borderColor: TEAL_BORDER }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr
                className="text-left font-bold uppercase tracking-wider"
                style={{ backgroundColor: TEAL_LIGHT, color: TEAL_PRIMARY, borderBottom: `2px solid ${TEAL_BORDER}` }}
              >
                <th className="py-2.5 px-3 text-center w-10">Sr</th>
                <th className="py-2.5 px-3">Subplate Name</th>
                <th className="py-2.5 px-3">Material</th>
                <th className="py-2.5 px-3">Dimensions (WxHxL mm)</th>
                <th className="py-2.5 px-3">Particulars / Job Work Scope</th>
                <th className="py-2.5 px-3 text-right w-16">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No subplate line items recorded in this challan.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/50 transition-colors"
                    style={{ backgroundColor: idx % 2 === 1 ? "#fafcfd" : "#ffffff" }}
                  >
                    <td className="py-2 px-3 text-center font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {it.platename || "Mould Plate"}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-medium">
                      {it.material || "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-700 font-mono text-[11px]">
                      {it.dimensions || "—"}
                    </td>
                    <td className="py-2 px-3 text-slate-800">
                      <span className="font-semibold text-slate-900 block">
                        {it.particulars || "Standard Jobwork"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {it.qty ?? 1}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Summary Footer */}
            <tfoot>
              <tr
                className="font-bold border-t-2"
                style={{ borderColor: TEAL_PRIMARY, backgroundColor: TEAL_LIGHT }}
              >
                <td colSpan={5} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-700">
                  Total Items: <span className="font-mono text-slate-900 mr-4">{items.length}</span> Total Quantity:
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-sm font-extrabold" style={{ color: TEAL_PRIMARY }}>
                  {totalQty}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── Terms & Declarations ── */}
        <div
          className="p-3 border rounded-lg text-[10px] space-y-1"
          style={{ borderColor: "#e2e8f0", backgroundColor: "#f8fafc" }}
        >
          <span className="font-bold uppercase tracking-wider text-slate-700 block text-[10px]">
            Job Work Conditions & Declarations:
          </span>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600 leading-normal">
            <li>
              Goods dispatched under this challan are strictly for job work / manufacturing processing and are returnable upon completion.
            </li>
            <li>
              Ownership and proprietary rights of all moulds, subplates, and drawings remain exclusively with Star Mould Technology Pvt. Ltd.
            </li>
            <li>
              The consignee / processor must verify plate specifications, materials, and quantities immediately upon receipt.
            </li>
            <li>
              Subject to Rajkot jurisdiction.
            </li>
          </ol>
        </div>

        {/* ── Signature Blocks ── */}
        <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
          {/* Receiver / Processor Signature */}
          <div className="space-y-12">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Receiver&apos;s Signature &amp; Stamp
            </span>
            <div className="border-t border-slate-300 pt-1.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>Received by (Signature)</span>
              <span>Date: _____ / _____ / 202___</span>
            </div>
          </div>

          {/* Consignor Signature */}
          <div className="space-y-12 text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: TEAL_PRIMARY }}>
              For, STARMOULD TECHNOLOGY PRIVATE LIMITED
            </span>
            <div className="border-t border-slate-300 pt-1.5 flex items-center justify-end text-[10px] text-slate-500">
              <span>Authorized Signatory</span>
            </div>
          </div>
        </div>

        {/* Page Footer */}
        <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-medium">
          Computer generated Outward Jobwork Challan • Starmould Technology Private Limited ERP
        </div>
      </div>
    </div>
  );
}
