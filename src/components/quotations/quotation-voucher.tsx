"use client";

import React, { useRef } from "react";
import { Printer, Download, X } from "lucide-react";
import { Quotation } from "@/types/quotation";

export interface QuotationVoucherProps {
  quote: Quotation;
  onClose?: () => void;
  isModal?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
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
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
}

function formatINR(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0.00";
  return Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const QuotationVoucher: React.FC<QuotationVoucherProps> = ({
  quote,
  onClose,
  isModal = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const [isDownloading, setIsDownloading] = React.useState(false);

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
      // Fallback background iframe
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

  return (
    <div className={isModal ? "relative w-full max-w-5xl mx-auto bg-slate-100 p-2 sm:p-6 print:p-0 print:bg-white text-slate-900" : "relative w-[794px] min-w-[794px] mx-auto p-0 print:p-0 print:bg-white text-slate-900"}>
      {/* Top Action Bar (Modal only, hidden in standalone print page and physical print) */}
      {isModal && (
        <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-6 shadow-sm print:hidden">
          <div>
            <div className="text-xs text-slate-500 font-medium">Quotation Preview</div>
            <div className="text-base font-bold text-slate-800">{quote.quotation_no}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5-Page Printable Area */}
      <div ref={containerRef} id="quotation-printable-area" className="quotation-print-container flex flex-col gap-8 print:gap-0">
        
        {/* PAGE 1: COVER PAGE */}
        <div className="quotation-page bg-white shadow-md mx-auto print:shadow-none print:m-0 w-[794px] min-h-[1123px] overflow-hidden flex flex-col justify-between">
          <img
            src="/images/quotation-cover.jpg"
            alt="StarMould Quotation Cover"
            className="w-full h-full object-cover block"
          />
        </div>

        {/* PAGE 2: HEADER + CONSIGNEE + SUBJECT & REFERENCE */}
        <div className="quotation-page bg-white shadow-md mx-auto print:shadow-none print:m-0 w-[794px] min-h-[1123px] p-8 sm:p-12 print:p-8 flex flex-col justify-between">
          <div>
            {/* Company Header */}
            <div className="text-center mb-2">
              <div className="flex justify-center mb-1">
                <img src="/images/stpl-logo.png" alt="Star Mould" className="h-14 w-auto object-contain" />
              </div>
              <div className="text-[10px] font-bold text-slate-900 tracking-wider">SINCE 1995</div>
              <div className="text-[9.5px] font-semibold text-slate-700">(INDIA&apos;s First Pulp Mould Manufacturer)</div>
              <div className="text-[13px] font-black text-slate-900 tracking-wide mt-0.5">STARMOULD TECHNOLOGY PVT. LTD.</div>
              <div className="text-[9.5px] text-slate-600">G-705, Near Swaminarayan Restaurant, Road -5, G.I.D.C. Metoda, Rajkot - 360021 Gujarat. India</div>
              <div className="text-[9.5px] text-slate-600">Phone No :- 98256 69459, 95865 33750</div>
              <div className="text-[9.5px] text-slate-600">Email :- starmoulda@yahoo.in , info.starmould@yahoo.in</div>
              <div className="text-[9.5px] text-slate-600">Website :- www.starmould.in</div>
            </div>

            {/* GSTIN / PAN Bar */}
            <div className="border-[1.5px] border-black px-2 py-1 flex justify-between text-[10.5px] font-bold mb-1.5 mt-2">
              <div>GSTIN NO :- 24ABLCS1427Q1ZV</div>
              <div>PAN NO :- ABLCS1427Q</div>
            </div>

            {/* CIN / TAN Grid */}
            <div className="text-[10px] space-y-0.5 mb-2.5">
              <div className="flex gap-4">
                <div className="w-1/2"><strong>CIN NO</strong> :- U25910GJ2023PTC142461</div>
                <div className="w-1/2"><strong>TAN NO</strong> :- RKTS21097G</div>
              </div>
              <div><strong>Udhyam No</strong> :- UDYAM-GJ-20-0186249</div>
            </div>

            {/* Title */}
            <div className="text-center text-sm font-black tracking-widest underline uppercase my-2.5">
              QUOTATION
            </div>

            {/* Quote No & Date Bar */}
            <div className="border-[1.5px] border-black px-2 py-1 flex justify-between text-[11px] font-bold mb-3">
              <div>Quotation No :- {quote.quotation_no}</div>
              <div>Date :- {formatDate(quote.quotation_date)}</div>
            </div>

            {/* Consignee Section */}
            <div className="text-xs font-bold underline mb-2">Details Of Consignee :-</div>

            <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6 text-[10.5px] leading-relaxed">
              <div className="sm:w-[55%]">
                <div className="font-bold">M/S :-</div>
                <div className="font-bold text-[11.5px] text-slate-900">{quote.consignee_name}</div>
                <div className="whitespace-pre-line text-slate-700 mt-1">{quote.consignee_address}</div>
              </div>

              <div className="sm:w-[42%] space-y-1">
                <div className="flex">
                  <div className="w-24 font-bold">GSTIN No</div>
                  <div>:- {quote.consignee_gstin || "N/A"}</div>
                </div>
                <div className="flex">
                  <div className="w-24 font-bold">PAN No</div>
                  <div>:- {quote.consignee_pan || "N/A"}</div>
                </div>
                <div className="flex">
                  <div className="w-24 font-bold">Telephone No</div>
                  <div>:- {quote.consignee_phone || "N/A"}</div>
                </div>
                <div className="flex">
                  <div className="w-24 font-bold">State Code</div>
                  <div>:- {quote.state_code || "24 - Gujarat"}</div>
                </div>
              </div>
            </div>

            {/* Subject & Reference - completely hidden if empty, no mock fallback */}
            {(Boolean(quote.subject?.trim()) || Boolean(quote.reference?.trim())) && (
              <div className="border-t-[1.5px] border-b-[1.5px] border-black py-2.5 text-[10.5px] space-y-1">
                {quote.subject?.trim() && (
                  <div className="flex">
                    <div className="w-20 font-bold">Subject</div>
                    <div className="font-semibold">:- {quote.subject}</div>
                  </div>
                )}
                {quote.reference?.trim() && (
                  <div className="flex">
                    <div className="w-20 font-bold">Reference</div>
                    <div className="font-semibold">:- {quote.reference}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PAGE 3: PARTICULARS TABLE + BANK DETAILS + QUICK T&C + TOTALS & SIGNATURE */}
        <div className="quotation-page bg-white shadow-md mx-auto print:shadow-none print:m-0 w-[794px] min-h-[1123px] p-8 sm:p-12 print:p-8 flex flex-col justify-between">
          <div>
            {/* Company Header */}
            <div className="text-center mb-2">
              <div className="flex justify-center mb-1">
                <img src="/images/stpl-logo.png" alt="Star Mould" className="h-12 w-auto object-contain" />
              </div>
              <div className="text-[9.5px] font-bold text-slate-900 tracking-wider">SINCE 1995</div>
              <div className="text-[9px] font-semibold text-slate-700">(INDIA&apos;s First Pulp Mould Manufacturer)</div>
              <div className="text-[12.5px] font-black text-slate-900 tracking-wide">STARMOULD TECHNOLOGY PVT. LTD.</div>
              <div className="text-[9px] text-slate-600">G-705, Near Swaminarayan Restaurant, Road -5, G.I.D.C. Metoda, Rajkot - 360021 Gujarat. India</div>
              <div className="text-[9px] text-slate-600">Phone No :- 98256 69459, 95865 33750</div>
              <div className="text-[9px] text-slate-600">Email :- starmoulda@yahoo.in , info.starmould@yahoo.in | Website :- www.starmould.in</div>
            </div>

            {/* Quote No & Date Bar */}
            <div className="border-[1.5px] border-black px-2 py-1 flex justify-between text-[11px] font-bold mb-3">
              <div>Quotation No :- {quote.quotation_no}</div>
              <div>Date :- {formatDate(quote.quotation_date)}</div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse border border-black text-[10.5px] mb-3">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-black px-2 py-1.5 w-12 text-center font-bold">Sr. no.</th>
                  <th className="border border-black px-2 py-1.5 text-left font-bold">Product Description</th>
                  <th className="border border-black px-2 py-1.5 w-16 text-center font-bold">Qty</th>
                  <th className="border border-black px-2 py-1.5 w-24 text-right font-bold">Unit Price</th>
                  <th className="border border-black px-2 py-1.5 w-28 text-right font-bold">Total amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td className="border border-black px-2 py-2 text-center align-top">{idx + 1}</td>
                    <td className="border border-black px-2 py-2 whitespace-pre-line align-top font-medium">{it.product_description}</td>
                    <td className="border border-black px-2 py-2 text-center align-top">{it.qty}</td>
                    <td className="border border-black px-2 py-2 text-right align-top">₹ {formatINR(it.unit_price)}</td>
                    <td className="border border-black px-2 py-2 text-right align-top font-semibold">₹ {formatINR(it.total_amount)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="border border-black px-2 py-2 text-center">&nbsp;</td>
                    <td className="border border-black px-2 py-2">&nbsp;</td>
                    <td className="border border-black px-2 py-2">&nbsp;</td>
                    <td className="border border-black px-2 py-2">&nbsp;</td>
                    <td className="border border-black px-2 py-2">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom Split: Bank & Quick Terms | Totals & Stamp */}
            <div className="flex flex-col sm:flex-row gap-4 mt-3">
              {/* Left Column */}
              <div className="sm:w-[58%] text-[10px] space-y-2.5">
                <div>
                  <div className="font-bold underline text-[10.5px] mb-1">Bank Details :-</div>
                  <table className="w-full text-[10px] leading-snug">
                    <tbody>
                      <tr>
                        <td className="w-24 font-medium text-slate-800">Account No</td>
                        <td>:- {quote.bank_account_no || "5875819245"}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-slate-800">IFSC Code</td>
                        <td>:- {quote.bank_ifsc || "CBIN0281313"}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-slate-800">Bank Name</td>
                        <td>:- {quote.bank_name || "Central Bank Of India"}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-slate-800">Branch Name</td>
                        <td>:- {quote.bank_branch || "Saurashtra University Branch"}</td>
                      </tr>
                      <tr>
                        <td className="font-medium text-slate-800">Branch Address</td>
                        <td>:- {quote.bank_address || "Saurashtra University Campus, Rajkot"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div>
                  <div className="font-bold underline text-[10px] mb-1">Terms & Conditions :=</div>
                  <div className="space-y-1 text-[9.5px] leading-tight">
                    <div><strong>1. Price :-</strong> {quote.price_terms || "Ex-Works Rajkot, +18% GST Freight ,Transit Insurance At Actual."}</div>
                    <div><strong>2. Delivery Terms :-</strong> {quote.delivery_terms || "2 Days"}</div>
                    <div><strong>3. Payment Terms :-</strong> {quote.payment_terms || "100% advance before dispatch of goods."}</div>
                    <div><strong>4. Validity :-</strong> {quote.validity_terms || "10 DAYS"}</div>
                    <div><strong>5. Force Majeure :-</strong> {quote.force_majeure || "This Clause Is Applicable."}</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Totals & Signature */}
              <div className="sm:w-[42%]">
                <table className="w-full border-collapse border border-black text-[10.5px] mb-4">
                  <tbody>
                    <tr>
                      <td className="border border-black px-2.5 py-1 font-bold">Taxable Amount</td>
                      <td className="border border-black px-2.5 py-1 text-right font-bold">₹ {formatINR(quote.taxable_amount)}</td>
                    </tr>
                    {quote.tax_type === "exempt" ? (
                      <tr>
                        <td className="border border-black px-2.5 py-1 font-bold">Tax (GST Free)</td>
                        <td className="border border-black px-2.5 py-1 text-right font-bold">₹ 0.00</td>
                      </tr>
                    ) : (
                      <tr>
                        <td className="border border-black px-2.5 py-1 font-bold">GST (18%)</td>
                        <td className="border border-black px-2.5 py-1 text-right font-bold">
                          ₹ {formatINR(quote.igst_amount || ((quote.cgst_amount || 0) + (quote.sgst_amount || 0)) || Math.round(((quote.taxable_amount || 0) * 0.18) * 100) / 100)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-100">
                      <td className="border border-black px-2.5 py-1 font-bold text-[11px]">Grand Total</td>
                      <td className="border border-black px-2.5 py-1 text-right font-black text-[11.5px]">₹ {formatINR(quote.grand_total)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Signature Box */}
                <div className="text-center mt-3">
                  <div className="text-[10px] font-bold mb-1">Starmould Technology PVT. LTD.</div>
                  <div className="h-16 flex items-center justify-center">
                    {quote.include_digital_stamp ? (
                      <img src="/images/starmould-stamp.jpg" alt="Stamp" className="h-16 w-auto object-contain" />
                    ) : (
                      <div className="h-14"></div>
                    )}
                  </div>
                  <div className="inline-block border-t border-dashed border-slate-700 pt-1 text-[10px] font-bold min-w-[130px]">
                    Authorise Signatory
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 4: ANNEXURE - I (Part 1 - Points 1 to 12) */}
        <div className="quotation-page bg-white shadow-md mx-auto print:shadow-none print:m-0 w-[794px] min-h-[1123px] p-8 sm:p-12 print:p-8 flex flex-col justify-between">
          <div>
            {/* Company Header */}
            <div className="text-center mb-3">
              <div className="flex justify-center mb-1">
                <img src="/images/stpl-logo.png" alt="Star Mould" className="h-12 w-auto object-contain" />
              </div>
              <div className="text-[9.5px] font-bold text-slate-900 tracking-wider">SINCE 1995</div>
              <div className="text-[9px] font-semibold text-slate-700">(INDIA&apos;s First Pulp Mould Manufacturer)</div>
              <div className="text-[12.5px] font-black text-slate-900 tracking-wide">STARMOULD TECHNOLOGY PVT. LTD.</div>
              <div className="text-[9px] text-slate-600">G-705, Near Swaminarayan Restaurant, Road -5, G.I.D.C. Metoda, Rajkot - 360021 Gujarat. India</div>
              <div className="text-[9px] text-slate-600">Phone No :- 98256 69459, 95865 33750 | Email :- starmoulda@yahoo.in , info.starmould@yahoo.in</div>
              <div className="text-[9px] text-slate-600">Website :- www.starmould.in</div>
            </div>

            <div className="text-center font-black text-[13px] tracking-wide underline mb-0.5">ANNEXURE - I</div>
            <div className="text-center font-bold text-[11px] underline mb-3">Terms & Conditions</div>

            <table className="w-full border-collapse border border-black text-[9.5px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1.5 w-[34%] font-bold align-top">1. PRICE VALIDITY:</td>
                  <td className="border border-black p-1.5 w-[66%] leading-relaxed">This quotation is valid for 10 days from the date of issue. After the validity period, prices are subject to change without prior notice.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">2. PAYMENT TERMS:</td>
                  <td className="border border-black p-1.5 leading-relaxed">100% advance before dispatch of goods.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">3. TAXES:</td>
                  <td className="border border-black p-1.5 leading-relaxed">GST and all applicable government taxes will be charged extra as per prevailing rates at the time of billing.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">4. ORDER CONFIRMATION:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Orders will be treated as confirmed only after receipt of advance payment and a written purchase order or email confirmation from the customer.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">5. PRODUCTION & DELIVERY SCHEDULE:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Manufacturing will start only after confirmation and receipt of advance. Delivery timeline will be calculated from the confirmation date and is subject to availability of raw material and production capacity.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">6. TRANSPORTATION, LOADING & UNLOADING:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Transportation, packing, loading, unloading, and insurance are chargeable extra unless mentioned otherwise in writing. Risk transfers to the buyer once goods leave our premises.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">7. RAW MATERIAL PRICE FLUCTUATION:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Prices are based on current raw material rates. Any significant increase in raw material rates before production may result in price revision.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">8. DESIGN, DRAWING & SAMPLE APPROVAL:</td>
                  <td className="border border-black p-1.5 leading-relaxed">If applicable, all drawings, samples, specifications, and designs must be approved by the customer before production. Any changes after approval will attract additional charges and delivery time.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">9. INSPECTION & ACCEPTANCE:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Goods must be inspected immediately upon receipt. Any complaints regarding damage, defect, or shortage must be reported within 24–48 hours of delivery. No claims will be entertained thereafter.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">10. WARRANTY:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Warranty is applicable only against manufacturing defects, if specifically mentioned. Warranty does not cover damage due to misuse, mishandling, overloading, improper installation, external impact, or power fluctuations</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">11. REJECTION POLICY:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Rejection of goods after acceptance will not be entertained. Any rejection must be mutually agreed upon in writing and returned at the customer&apos;s cost.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">12. CANCELLATION POLICY:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Once manufacturing has started, the order cannot be cancelled under any circumstances. The advance amount shall be non-refundable.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGE 5: ANNEXURE - I (Part 2 - Points 13 to 23) + DUAL SIGNATURES */}
        <div className="quotation-page bg-white shadow-md mx-auto print:shadow-none print:m-0 w-[794px] min-h-[1123px] p-8 sm:p-12 print:p-8 flex flex-col justify-between">
          <div>
            <div className="h-2"></div>
            <table className="w-full border-collapse border border-black text-[9.5px]">
              <tbody>
                <tr>
                  <td className="border border-black p-1.5 w-[34%] font-bold align-top">13. NO RETURN / EXCHANGE:</td>
                  <td className="border border-black p-1.5 w-[66%] leading-relaxed">Manufactured and custom-made goods are not eligible for return or exchange.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">14. DELAY IN PAYMENT:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Any delay in payment beyond the agreed period will attract interest at 18% per annum, or as per industry standards</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">15. PACKAGING:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Standard packaging will be provided. Special packaging, if required, will be charged extra.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">16. QUANTITY VARIATION:</td>
                  <td className="border border-black p-1.5 leading-relaxed">A production variance of ±5% in quantity is considered acceptable and shall be billed accordingly.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">17. CONFIDENTIALITY:</td>
                  <td className="border border-black p-1.5 leading-relaxed">All drawings, designs, specifications, and pricing shared are confidential and shall not be disclosed to third parties.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">18. FORCE MAJEURE:</td>
                  <td className="border border-black p-1.5 leading-relaxed">We shall not be responsible for delays or non-performance due to events beyond our control including but not limited to natural disasters, fire, strike, government restrictions, or power failure</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">19. INTELLECTUAL PROPERTY :</td>
                  <td className="border border-black p-1.5 leading-relaxed">All designs, molds, tools, and development work created by us shall remain our intellectual property unless otherwise agreed in writing.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">20. LIABILITY LIMITATION:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Our liability is limited strictly to the value of the goods supplied. We are not liable for indirect, incidental, or consequential losses.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">21. GOVERNING LAW & JURISDICTION:</td>
                  <td className="border border-black p-1.5 leading-relaxed">All disputes shall be subject to the exclusive jurisdiction of the courts of Rajkot, Gujarat only.</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">22. ENTIRE AGREEMENT:</td>
                  <td className="border border-black p-1.5 leading-relaxed">This quotation along with these terms constitutes the entire understanding between both parties and overrides all previous discussions or agreements</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5 font-bold align-top">23. ACCEPTANCE:</td>
                  <td className="border border-black p-1.5 leading-relaxed">Placing an order against this quotation implies full acceptance of the above terms and conditions by the customer.</td>
                </tr>
              </tbody>
            </table>

            {/* Dual Signatures */}
            <div className="flex justify-between items-end mt-8 px-4">
              <div className="text-center w-52">
                <div className="text-[10.5px] font-bold underline mb-14">Receiver&apos;s Sign & Stamp</div>
                <div className="inline-block border-t border-dashed border-slate-700 pt-1 text-[10px] font-bold min-w-[130px]">
                  Authorise Signatory
                </div>
              </div>

              <div className="text-center w-52">
                <div className="text-[10.5px] font-bold mb-2">Starmould Technology PVT. LTD.</div>
                <div className="h-16 flex items-center justify-center">
                  {quote.include_digital_stamp ? (
                    <img src="/images/starmould-stamp.jpg" alt="Stamp" className="h-16 w-auto object-contain" />
                  ) : (
                    <div className="h-14"></div>
                  )}
                </div>
                <div className="inline-block border-t border-dashed border-slate-700 pt-1 text-[10px] font-bold min-w-[130px]">
                  Authorise Signatory
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .quotation-print-container {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .quotation-page {
            box-shadow: none !important;
            border: none !important;
            width: 210mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 10mm 15mm !important;
            overflow: hidden !important;
          }
        }
      `}</style>
    </div>
  );
};
