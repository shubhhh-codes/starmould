import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { verifySecurePrintToken } from "@/lib/print-token";
import { escapeHtml } from "@/lib/utils";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { calculateGST, formatINRTwoDecimals } from "@/lib/gst-calculation";
import { amountInWords } from "@/lib/number-to-words";
import type { QuotationItem } from "@/types/quotation";

function findChromePath(): string {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(/*turbopackIgnore: true*/ c)) return c;
  }
  return "chrome";
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    let id = searchParams.get("id");
    let isTokenValid = false;

    if (token) {
      const decoded = verifySecurePrintToken(token);
      if (decoded) {
        id = decoded.id;
        isTokenValid = true;
      }
    } else if (id && id.includes(".")) {
      const decoded = verifySecurePrintToken(id);
      if (decoded) {
        id = decoded.id;
        isTokenValid = true;
      }
    }

    if (!isTokenValid) {
      const auth = await authenticateRequest(req);
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Quotation ID is required" }, { status: 400 });
    }

    // Fetch quotation record
    const { data: quote, error: qErr } = await supabaseAdmin
      .from("quotations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (qErr || !quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }

    // Fetch customer code
    let customerCode = "—";
    if (quote.customer_id) {
      const { data: cust } = await supabaseAdmin
        .from("customers")
        .select("customer_code, initials, customername")
        .eq("id", quote.customer_id)
        .maybeSingle();

      if (cust) {
        customerCode =
          cust.customer_code ||
          cust.initials ||
          (cust.customername
            ? cust.customername
                .trim()
                .split(/\s+/)
                .map((w: string) => w[0]?.toUpperCase())
                .filter(Boolean)
                .slice(0, 4)
                .join("")
            : "—");
      }
    } else if (quote.consignee_name) {
      customerCode =
        quote.consignee_name
          .trim()
          .split(/\s+/)
          .map((w: string) => w[0]?.toUpperCase())
          .filter(Boolean)
          .slice(0, 4)
          .join("") || "—";
    }

    // Fetch line items
    const { data: items } = await supabaseAdmin
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", id)
      .order("sr_no", { ascending: true });

    const quoteItems = items || [];
    const discountVal = Number(quote.discount_amount) || 0;

    // Financial calculations
    const {
      subtotalAmount,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      grandTotal,
    } = calculateGST(
      quoteItems.map((it) => ({
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

    // Read Cover as Base64
    let coverDataUrl = "";
    try {
      const coverPath = path.join(process.cwd(), "public", "images", "quotation-cover.jpg");
      if (fs.existsSync(coverPath)) {
        const coverBuf = fs.readFileSync(coverPath);
        coverDataUrl = `data:image/jpeg;base64,${coverBuf.toString("base64")}`;
      }
    } catch {}

    // Read Logo as Base64
    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "images", "stpl-logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuf = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
      }
    } catch {}

    // Read Stamp as Base64 (Transparent PNG)
    let stampDataUrl = "";
    try {
      const stampPath = path.join(process.cwd(), "public", "images", "starmould-stamp.png");
      if (fs.existsSync(stampPath)) {
        const stampBuf = fs.readFileSync(stampPath);
        stampDataUrl = `data:image/png;base64,${stampBuf.toString("base64")}`;
      } else {
        const fallbackPath = path.join(process.cwd(), "public", "images", "starmould-stamp.jpg");
        if (fs.existsSync(fallbackPath)) {
          const stampBuf = fs.readFileSync(fallbackPath);
          stampDataUrl = `data:image/jpeg;base64,${stampBuf.toString("base64")}`;
        }
      }
    } catch {}

    const consigneeName = escapeHtml(quote.consignee_name || "—");
    const consigneeAddress = escapeHtml(quote.consignee_address || "—");
    const consigneeGstin = escapeHtml(quote.consignee_gstin || "—");
    const consigneePan = escapeHtml(quote.consignee_pan || "—");
    const consigneePhone = escapeHtml(quote.consignee_phone || "—");
    const consigneeEmail = escapeHtml(quote.consignee_email || "—");
    customerCode = escapeHtml(customerCode);
    const quotationNo = escapeHtml(quote.quotation_no || "—");
    const quotationDate = escapeHtml(formatDate(quote.quotation_date));

    const bankName = escapeHtml(quote.bank_name || "Central Bank Of India");
    const bankAccountNo = escapeHtml(quote.bank_account_no || "5875819245");
    const bankIfsc = escapeHtml(quote.bank_ifsc || "CBIN0281313");
    const bankBranch = escapeHtml(quote.bank_branch || "Saurashtra University Branch");

    const activeTerms = [
      { label: "Price & GST", content: quote.price_terms },
      { label: "Delivery Terms", content: quote.delivery_terms },
      { label: "Payment Terms", content: quote.payment_terms },
      { label: "Validity", content: quote.validity_terms },
      { label: "Order Confirmation", content: quote.order_confirmation },
      { label: "Warranty", content: quote.warranty_terms },
      { label: "Jurisdiction", content: quote.jurisdiction_terms },
      { label: "Force Majeure", content: quote.force_majeure },
    ]
      .filter((t) => Boolean(t.content && t.content.trim()))
      .map((t) => ({ label: escapeHtml(t.label), content: escapeHtml(t.content) }));

    // ── Annexure Detailed Manufacturer Terms (23 Clauses Split Across 2 Pages) ──
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

    const renderAnnexureHtml = (termsList: typeof ANNEXURE_TERMS_PART1) => {
      const rows = termsList
        .map(
          (item, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? "#f3f9fb" : "#ffffff"};">
              <td class="annexure-td-title">${item.no}. ${item.title}:</td>
              <td class="annexure-td-desc">${item.text}</td>
            </tr>
          `
        )
        .join("");

      return `
        <table class="annexure-table">
          <thead>
            <tr>
              <th class="annexure-th" style="width: 215px; border-right: 1px solid rgba(255,255,255,0.4);">Clause / Subject</th>
              <th class="annexure-th" style="width: 495px;">Terms &amp; Conditions Details</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    // ── Multi-page determination: Cover page + Commercial Quotation + Bank/Terms + Annexure-I (2 Pages) ──
    const hasPage3 = true;

    const calculateItemHeight = (it: QuotationItem): number => {
      const base = 34; // base single-line row
      const title = (it.product_name || it.product_description || "").trim();
      const titleLines = Math.max(1, Math.ceil(title.length / 42));
      const titleExtra = (titleLines - 1) * 14;

      const desc = (it.description || "").trim();
      if (!desc) return base + titleExtra;

      const descLines = desc.split("\n").reduce((acc: number, line: string) => {
        return acc + Math.max(1, Math.ceil(line.length / 55));
      }, 0);

      // 12px cell padding (py-[6px]) + title (14px) + gap (2px) + descLines * 12px
      const calculated = 12 + 14 + titleExtra + 2 + descLines * 12;
      return Math.max(base, calculated);
    };

    interface QuotationItemChunk {
      items: QuotationItem[];
      startIdx: number;
      isLast: boolean;
    }

    const paginateQuotationItems = (
      itemList: QuotationItem[]
    ): QuotationItemChunk[] => {
      if (!itemList || itemList.length === 0) {
        return [{ items: [], startIdx: 0, isLast: true }];
      }

      const p1MaxWithTotals = 515;
      const p1MaxWithoutTotals = 645;
      const contMaxWithTotals = 640;
      const contMaxWithoutTotals = 760;

      const totalHeight = itemList.reduce((sum, it) => sum + calculateItemHeight(it), 0);

      if (totalHeight <= p1MaxWithTotals) {
        return [{ items: itemList, startIdx: 0, isLast: true }];
      }

      const chunks: QuotationItemChunk[] = [];
      let currentChunk: QuotationItem[] = [];
      let currentH = 0;
      let isFirstPage = true;
      let runningIdx = 0;

      for (let i = 0; i < itemList.length; i++) {
        const item = itemList[i];
        const itemH = calculateItemHeight(item);
        const maxWithoutTotals = isFirstPage ? p1MaxWithoutTotals : contMaxWithoutTotals;

        if (currentChunk.length === 0 || currentH + itemH <= maxWithoutTotals) {
          currentChunk.push(item);
          currentH += itemH;
        } else {
          chunks.push({
            items: currentChunk,
            startIdx: runningIdx,
            isLast: false,
          });
          runningIdx += currentChunk.length;
          currentChunk = [item];
          currentH = itemH;
          isFirstPage = false;
        }
      }

      if (currentChunk.length > 0) {
        const maxWithTotals = isFirstPage ? p1MaxWithTotals : contMaxWithTotals;
        if (currentH > maxWithTotals && currentChunk.length > 1) {
          const remainingItems = [...currentChunk];
          const pageItems: QuotationItem[] = [];
          let pageH = 0;

          while (remainingItems.length > 1) {
            const nextItem = remainingItems[0];
            const nextH = calculateItemHeight(nextItem);
            if (pageH + nextH <= (isFirstPage ? p1MaxWithoutTotals : contMaxWithoutTotals)) {
              pageItems.push(remainingItems.shift()!);
              pageH += nextH;
            } else {
              break;
            }
          }

          chunks.push({
            items: pageItems,
            startIdx: runningIdx,
            isLast: false,
          });
          runningIdx += pageItems.length;

          chunks.push({
            items: remainingItems,
            startIdx: runningIdx,
            isLast: true,
          });
        } else {
          chunks.push({
            items: currentChunk,
            startIdx: runningIdx,
            isLast: true,
          });
        }
      }

      return chunks;
    };

    const itemChunks = paginateQuotationItems(quoteItems);
    const itemPagesCount = itemChunks.length;
    const bankPageNo = 1 + itemPagesCount + 1;
    const annexure1PageNo = bankPageNo + 1;
    const annexure2PageNo = bankPageNo + 2;
    const totalPages = annexure2PageNo;

    const renderParticularsTableHtml = (tableItems: QuotationItem[], startIdx = 0) => {
      const rows = tableItems.length === 0 ? `
        <tr>
          <td colspan="6" style="text-align: center; color: #94a3b8; font-style: italic; height: 42px;">
            No items found in this quotation.
          </td>
        </tr>
      ` : tableItems.map((it, idx) => {
        const itemNumber = startIdx + idx + 1;
        const qty = Number(it.qty) || 1;
        const unit = it.unit || "Nos";
        const price = Number(it.unit_price) || 0;
        const total = it.total_amount !== undefined && it.total_amount !== null
          ? Number(it.total_amount)
          : Math.round(qty * price * 100) / 100;
        const rowClass = idx % 2 === 0 ? "row-even" : "row-odd";

        return `
          <tr class="${rowClass}">
            <td class="td-center" style="color: #4a575e;">${itemNumber}</td>
            <td class="td-left" style="padding: 6px 12px;">
              <div style="color: #1f2a30; font-weight: 700; font-size: 10px;">${escapeHtml(it.product_name || it.product_description || "—")}</div>
              ${it.description ? `
                <div style="color: #64748b; font-size: 8.5px; font-weight: 400; white-space: pre-line; line-height: 1.35; margin-top: 2px;">
                  ${escapeHtml(it.description)}
                </div>
              ` : ""}
            </td>
            <td class="td-center" style="font-variant-numeric: tabular-nums; color: #3d4a52;">${qty}</td>
            <td class="td-center" style="color: #3d4a52;">${escapeHtml(unit)}</td>
            <td class="td-right" style="font-variant-numeric: tabular-nums; color: #3d4a52;">₹ ${formatINRTwoDecimals(price)}</td>
            <td class="td-right" style="font-variant-numeric: tabular-nums; font-weight: 600; color: #006181;">₹ ${formatINRTwoDecimals(total)}</td>
          </tr>
        `;
      }).join("");

      return `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 38px; text-align: center;">#</th>
                <th style="width: 312px; text-align: left; padding: 0 12px;">Product / Particulars</th>
                <th style="width: 50px; text-align: center;">Qty</th>
                <th style="width: 50px; text-align: center;">Unit</th>
                <th style="width: 120px; text-align: right; padding: 0 12px;">Unit Price (₹)</th>
                <th style="width: 140px; text-align: right; padding: 0 12px;">Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    };

    const renderTotalsHtml = () => `
      <div class="totals-row">
        <div style="width: 370px; display: flex; flex-direction: column; gap: 8px;">
          <div class="words-box" style="width: 100%;">
            <div class="words-label">Amount in Words</div>
            <div class="words-text">Rupees ${inWords} Only</div>
          </div>

          ${(quote.notes && quote.notes.trim()) ? `
            <div style="width: 100%; max-height: 85px; overflow: hidden; border: 1px solid #bcd8e0; border-radius: 10px; background-color: #ffffff; padding: 7px 12px;">
              <div style="font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #006181; margin-bottom: 2px;">
                Special Note / Remarks
              </div>
              <div style="font-size: 8.5px; font-weight: 400; color: #3d4a52; line-height: 1.35; white-space: pre-line; word-break: break-word;">
                ${escapeHtml(quote.notes.slice(0, 240))}
              </div>
            </div>
          ` : ""}
        </div>

        <div class="totals-card">
          <div class="calc-line">
            <span>Taxable Amount</span>
            <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #1f2a30;">₹ ${formatINRTwoDecimals(taxableAmount)}</span>
          </div>
          ${discountAmount > 0 ? `
            <div class="calc-line">
              <span>Discount</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #e11d48;">-₹ ${formatINRTwoDecimals(discountAmount)}</span>
            </div>
          ` : ""}
          ${isExempt ? `
            <div class="calc-line">
              <span>Tax (GST Free)</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #059669;">₹ 0.00</span>
            </div>
          ` : isIntraState ? `
            <div class="calc-line">
              <span>CGST (9%)</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #1f2a30;">₹ ${formatINRTwoDecimals(cgstAmount)}</span>
            </div>
            <div class="calc-line">
              <span>SGST (9%)</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #1f2a30;">₹ ${formatINRTwoDecimals(sgstAmount)}</span>
            </div>
          ` : `
            <div class="calc-line">
              <span>IGST (18%)</span>
              <span style="font-variant-numeric: tabular-nums; font-weight: 600; color: #1f2a30;">₹ ${formatINRTwoDecimals(igstAmount)}</span>
            </div>
          `}
          <div class="grand-total-line">
            <span style="letter-spacing: 0.5px; text-transform: uppercase;">GRAND TOTAL</span>
            <span style="font-variant-numeric: tabular-nums; font-size: 11.5px;">₹ ${formatINRTwoDecimals(grandTotal)}</span>
          </div>
        </div>
      </div>
    `;

    const renderFooterHtml = (pageNo: number) => `
      <div class="footer-wrap">
        <div class="footer-navy-bar">
          <div class="footer-left">
            <svg width="13" height="16" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
            </svg>
            <div class="footer-divider-left"></div>
            <div>
              <div class="footer-comp-name">${COMPANY.displayName}</div>
              <div class="footer-comp-addr">${COMPANY.address1} ${COMPANY.address2}</div>
            </div>
          </div>

          <div class="footer-right">
            <div class="page-badge">Page ${pageNo} of ${totalPages}</div>
            <div class="footer-divider-right"></div>
            <div class="footer-right-text">
              <div>${COMPANY.email}</div>
              <div>${COMPANY.website}</div>
            </div>
          </div>
        </div>
        <div class="bottom-white-margin"></div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Quotation_${quote.quotation_no || quote.id}</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" />
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            color: #1f2a30;
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }
          .a4-page {
            width: 794px;
            height: 1123px;
            min-height: 1123px;
            max-height: 1123px;
            margin: 0 auto;
            background: #ffffff;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
          }
          .a4-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .cover-img {
            width: 794px;
            height: 1123px;
            object-fit: cover;
            display: block;
          }
          .top-stripe-teal {
            height: 8px;
            width: 794px;
            background-color: #006181;
          }
          .top-stripe-grey {
            height: 4px;
            width: 794px;
            background-color: #62676b;
          }
          .page-content {
            padding: 20px 42px 0 42px;
            width: 794px;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 28px;
          }
          .logo-img {
            width: 240px;
            height: auto;
            display: block;
          }
          .title-text {
            font-size: 26px;
            font-weight: 800;
            color: #006181;
            letter-spacing: 0.5px;
            line-height: 1;
            margin-bottom: 6px;
            text-align: right;
          }
          .title-underline {
            height: 4px;
            width: 175px;
            background-color: #62676b;
            margin-left: auto;
          }
          .info-box {
            width: 710px;
            height: 48px;
            border: 1px solid #bcd8e0;
            border-radius: 10px;
            background-color: #f3f9fb;
            display: flex;
            margin-bottom: 16px;
            overflow: hidden;
          }
          .info-col {
            flex: 1;
            padding: 6px 18px;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .info-label {
            font-size: 8px;
            font-weight: 700;
            color: #006181;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .info-val {
            font-size: 12px;
            font-weight: 500;
            color: #33414a;
          }
          .party-box {
            width: 710px;
            margin-bottom: 16px;
          }
          .party-header {
            display: flex;
            background-color: #006181;
            height: 30px;
          }
          .party-header-cell {
            flex: 1;
            display: flex;
            align-items: center;
            padding: 0 14px;
            font-size: 10px;
            font-weight: 600;
            color: #ffffff;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .party-body {
            display: flex;
            background-color: #ffffff;
          }
          .party-col {
            flex: 1;
            padding: 10px 14px;
            font-size: 9.5px;
            line-height: 1.45;
            color: #3d4a52;
          }
          .party-name {
            font-size: 11px;
            font-weight: 700;
            color: #1f2a30;
            margin-bottom: 2px;
          }
          .bold-label {
            font-weight: 700;
            color: #1f2a30;
          }
          .section-heading {
            width: 710px;
            height: 28px;
            background-color: #e6f2f6;
            display: flex;
            align-items: center;
            padding-left: 10px;
            font-size: 10px;
            font-weight: 600;
            color: #006181;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .table-wrap {
            width: 710px;
            border: 1px solid #bcd8e0;
            margin-bottom: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          th {
            background-color: #006181;
            color: #ffffff;
            height: 34px;
            font-size: 9.5px;
            font-weight: 600;
            border-right: 1px solid rgba(255, 255, 255, 0.4);
            padding: 0 8px;
          }
          th:last-child {
            border-right: none;
          }
          td {
            height: 34px;
            border-top: 1px solid #bcd8e0;
            border-right: 1px solid #bcd8e0;
            font-size: 9.5px;
            padding: 4px 8px;
          }
          td:last-child {
            border-right: none;
          }
          .row-even {
            background-color: #f3f9fb;
          }
          .row-odd {
            background-color: #ffffff;
          }
          .td-center {
            text-align: center;
          }
          .td-left {
            text-align: left;
            padding: 0 12px;
          }
          .td-right {
            text-align: right;
            padding: 0 12px;
          }
          .totals-row {
            width: 710px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 14px;
            gap: 16px;
          }
          .words-box {
            width: 370px;
            border: 1px solid #bcd8e0;
            border-radius: 10px;
            background-color: #f3f9fb;
            padding: 10px 14px;
          }
          .words-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #006181;
            margin-bottom: 3px;
          }
          .words-text {
            font-size: 9.5px;
            font-weight: 600;
            font-style: italic;
            color: #1f2a30;
            line-height: 1.4;
          }
          .totals-card {
            width: 320px;
            border: 1px solid #bcd8e0;
            border-radius: 10px;
            overflow: hidden;
            font-size: 9.5px;
          }
          .calc-line {
            display: flex;
            justify-content: space-between;
            padding: 6px 14px;
            border-bottom: 1px solid #bcd8e0;
            color: #3d4a52;
          }
          .grand-total-line {
            display: flex;
            justify-content: space-between;
            padding: 8px 14px;
            background-color: #f3f9fb;
            color: #006181;
            font-weight: 700;
            font-size: 11px;
          }
          .footer-wrap {
            width: 794px;
            margin-top: auto;
          }
          .footer-navy-bar {
            width: 794px;
            padding: 7px 36px;
            background-color: #1b2537;
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #ffffff;
          }
          .footer-left {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .footer-divider-left {
            width: 1px;
            height: 32px;
            background-color: rgba(255, 255, 255, 0.4);
          }
          .footer-comp-name {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: -0.2px;
          }
          .footer-comp-addr {
            font-size: 7.5px;
            color: rgba(255, 255, 255, 0.9);
            line-height: 1.25;
          }
          .footer-right {
            display: flex;
            align-items: center;
            gap: 9px;
          }
          .footer-divider-right {
            width: 1px;
            height: 26px;
            background-color: rgba(255, 255, 255, 0.4);
          }
          .footer-right-text {
            font-size: 8px;
            font-weight: 600;
            letter-spacing: 0.3px;
            line-height: 1.3;
          }
          .bottom-white-margin {
            width: 794px;
            height: 10px;
            background-color: #ffffff;
          }
          .page-badge {
            font-size: 8.5px;
            font-weight: 600;
            color: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            padding: 1px 6px;
          }
          /* Page 3 Styles */
          .page3-header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 12px;
            border-bottom: 1.5px solid #006181;
            margin-bottom: 18px;
          }
          .bank-box {
            width: 710px;
            margin-bottom: 20px;
          }
          .bank-header {
            height: 32px;
            background-color: #006181;
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            padding-left: 14px;
          }
          .bank-grid {
            border: 1px solid #bcd8e0;
            border-top: none;
            background-color: #f3f9fb;
            padding: 12px 18px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
          }
          .bank-col {
            flex: 1;
          }
          .bank-col-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #006181;
            margin-bottom: 4px;
          }
          .terms-box {
            width: 710px;
            margin-bottom: 20px;
          }
          .terms-header {
            height: 32px;
            background-color: #006181;
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            padding-left: 14px;
          }
          .terms-body {
            border: 1px solid #bcd8e0;
            border-top: none;
            background-color: #ffffff;
            padding: 10px 18px;
          }
          .term-row {
            display: flex;
            align-items: flex-start;
            gap: 16px;
            padding: 6px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 10.5px;
            line-height: 1.5;
          }
          .term-row:last-child {
            border-bottom: none;
          }
          .term-label {
            width: 160px;
            flex-shrink: 0;
            font-size: 10.5px;
            font-weight: 700;
            color: #1f2a30;
          }
          .term-content {
            flex: 1;
            font-size: 10.5px;
            color: #3d4a52;
            white-space: pre-line;
          }
          .notes-strip {
            width: 710px;
            border: 1px solid #bcd8e0;
            border-radius: 8px;
            background-color: #f3f9fb;
            padding: 10px 18px;
            margin-bottom: 20px;
            font-size: 10px;
            line-height: 1.5;
            color: #3d4a52;
          }
          .sig-box {
            width: 710px;
            min-height: 185px;
            border: 1px solid #bcd8e0;
            border-radius: 10px;
            background-color: #ffffff;
            padding: 20px 26px 22px 26px;
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            position: relative;
          }
          .sig-col-left {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 145px;
            width: 320px;
          }
          .sig-col-right {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: flex-end;
            min-height: 145px;
          }
          .sig-title {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            color: #006181;
          }
          .sig-lines {
            font-size: 9.5px;
            color: #4a575e;
            line-height: 1.6;
            padding-bottom: 4px;
          }
          .sig-stamp-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            width: 200px;
            position: relative;
          }
          .stamp-wrap {
            margin-bottom: 6px;
            pointer-events: none;
            opacity: 0.90;
            z-index: 10;
          }
          .stamp-img {
            width: 76px;
            height: 76px;
            max-width: 76px;
            max-height: 76px;
            object-fit: contain;
            display: block;
            mix-blend-mode: multiply;
          }
          .signatory-label {
            font-size: 10.5px;
            font-weight: 700;
            color: #1f2a30;
            padding-top: 8px;
            padding-bottom: 2px;
            border-top: 1px solid #cbd5e1;
            width: 100%;
            text-align: center;
            z-index: 20;
          }
          .annexure-table {
            width: 710px;
            border: 1px solid #bcd8e0;
            border-radius: 4px;
            overflow: hidden;
            border-collapse: collapse;
          }
          .annexure-th {
            height: 28px;
            background-color: #006181;
            color: #ffffff;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 0 14px;
            text-align: left;
          }
          .annexure-td-title {
            padding: 6px 12px;
            font-size: 10px;
            font-weight: 700;
            color: #1f2a30;
            border-top: 1px solid #bcd8e0;
            border-right: 1px solid #bcd8e0;
            vertical-align: top;
            width: 215px;
          }
          .annexure-td-desc {
            padding: 6px 14px;
            font-size: 9.5px;
            line-height: 1.5;
            color: #3d4a52;
            border-top: 1px solid #bcd8e0;
            vertical-align: top;
            width: 495px;
          }
          .annexure-banner {
            width: 710px;
            height: 28px;
            background-color: #006181;
            color: #ffffff;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 12px;
            margin-bottom: 10px;
          }
          .ack-box {
            width: 710px;
            margin-top: 14px;
            border: 1px solid #bcd8e0;
            border-radius: 8px;
            background-color: #f3f9fb;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
        </style>
      </head>
      <body>

        <!-- ═══════════════════════════════════════════════════════════════════
             PAGE 1: OFFICIAL CORPORATE COVER PAGE (EXACT A4 794px x 1123px)
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="a4-page">
          ${coverDataUrl ? `<img src="${coverDataUrl}" alt="Cover" class="cover-img" />` : `<div style="padding: 100px; text-align: center; font-size: 30px; font-weight: bold; color: #006181;">STARMOULD QUOTATION</div>`}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             PAGE 2: COMMERCIAL OFFER (EXACT A4 794px x 1123px)
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="a4-page">
          <div>
            <div class="top-stripe-teal"></div>
            <div class="top-stripe-grey"></div>

            <div class="page-content">
              <div class="header-row">
                <div style="width: 260px;">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />` : `<div style="font-size:24px;font-weight:800;color:#006181;">STAR MOULD</div>`}
                </div>
                <div>
                  <div class="title-text">QUOTATION</div>
                  <div class="title-underline"></div>
                </div>
              </div>

              <div class="info-box">
                <div class="info-col">
                  <div class="info-label">QUOTATION NO.</div>
                  <div class="info-val">${quotationNo}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">QUOTATION DATE</div>
                  <div class="info-val">${quotationDate}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">CUSTOMER CODE</div>
                  <div class="info-val">${customerCode}</div>
                </div>
              </div>

              <div class="party-box">
                <div class="party-header">
                  <div class="party-header-cell">FROM / SUPPLIER</div>
                  <div class="party-header-cell">CUSTOMER (QUOTATION TO)</div>
                </div>
                <div class="party-body">
                  <div class="party-col">
                    <div class="party-name">${COMPANY.name}</div>
                    <div>${COMPANY.address1}</div>
                    <div>${COMPANY.address2}</div>
                    <div style="margin-top: 2px;">
                      <span class="bold-label">CIN No:</span> ${COMPANY.cin}
                    </div>
                    <div>
                      <span class="bold-label">GSTIN:</span> ${COMPANY.gstin} | <span class="bold-label">PAN:</span> ${COMPANY.pan}
                    </div>
                    <div>
                      <span class="bold-label">Mobile:</span> ${COMPANY.mobile} | <span class="bold-label">Email:</span> ${COMPANY.email}
                    </div>
                  </div>
                  <div class="party-col">
                    <div class="party-name">${consigneeName}</div>
                    <div style="white-space: pre-line;">${consigneeAddress}</div>
                    <div style="margin-top: 2px;">
                      <span class="bold-label">GSTIN:</span> ${consigneeGstin} | <span class="bold-label">PAN:</span> ${consigneePan}
                    </div>
                    <div>
                      <span class="bold-label">Contact:</span> ${consigneePhone} | <span class="bold-label">Email:</span> ${consigneeEmail}
                    </div>
                  </div>
                </div>
              </div>

              <div class="section-heading">PARTICULARS</div>

              ${renderParticularsTableHtml(itemChunks[0].items, 0)}

              ${itemChunks[0].isLast ? `
                ${renderTotalsHtml()}
                <div style="width: 710px; margin-top: 18px; padding: 10px 16px; border: 1px dashed #bcd8e0; border-radius: 8px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
                  <span>Please refer to <strong>Page ${bankPageNo}</strong> for Bank Remittance &amp; Signatures, and <strong>Pages ${annexure1PageNo}–${annexure2PageNo}</strong> for Annexure-I Terms.</span>
                  <span style="font-weight: 600; color: #006181;">Turn Over &rarr;</span>
                </div>
              ` : `
                <div style="width: 710px; margin-top: 18px; padding: 10px 16px; border: 1px dashed #bcd8e0; border-radius: 8px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
                  <span>Continued on <strong>Page 3</strong> for remaining particulars and totals.</span>
                  <span style="font-weight: 600; color: #006181;">Continued &rarr;</span>
                </div>
              `}

            </div>
          </div>

          ${renderFooterHtml(2)}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             CONTINUATION ITEM PAGES (IF MULTI-PAGE LINE ITEMS)
             ═══════════════════════════════════════════════════════════════════ -->
        ${itemChunks.slice(1).map((chunk, sliceIdx) => {
          const pageNo = 3 + sliceIdx;
          return `
            <div class="a4-page">
              <div>
                <div class="top-stripe-teal"></div>
                <div class="top-stripe-grey"></div>

                <div class="page-content">
                  <div class="header-row" style="margin-bottom: 20px;">
                    <div style="width: 260px;">
                      ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />` : `<div style="font-size:24px;font-weight:800;color:#006181;">STAR MOULD</div>`}
                    </div>
                    <div>
                      <div class="title-text" style="font-size: 22px;">QUOTATION (CONTINUED)</div>
                      <div class="title-underline" style="width: 270px; margin-bottom: 6px;"></div>
                      <div style="font-size: 9.5px; color: #64748b; font-weight: 500; text-align: right;">
                        Quotation No: <strong>${quotationNo}</strong> &bull; Customer: <strong>${consigneeName}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="section-heading" style="display: flex; justify-content: space-between; align-items: center; padding-right: 12px;">
                    <span>PARTICULARS (CONTINUED)</span>
                    <span style="font-size: 9px; font-weight: 400; color: #475569;">Items ${chunk.startIdx + 1} to ${chunk.startIdx + chunk.items.length}</span>
                  </div>

                  ${renderParticularsTableHtml(chunk.items, chunk.startIdx)}

                  ${chunk.isLast ? `
                    ${renderTotalsHtml()}
                    <div style="width: 710px; margin-top: 18px; padding: 10px 16px; border: 1px dashed #bcd8e0; border-radius: 8px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
                      <span>Please refer to <strong>Page ${bankPageNo}</strong> for Bank Remittance &amp; Signatures, and <strong>Pages ${annexure1PageNo}–${annexure2PageNo}</strong> for Annexure-I Terms.</span>
                      <span style="font-weight: 600; color: #006181;">Turn Over &rarr;</span>
                    </div>
                  ` : `
                    <div style="width: 710px; margin-top: 18px; padding: 10px 16px; border: 1px dashed #bcd8e0; border-radius: 8px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
                      <span>Continued on <strong>Page ${pageNo + 1}</strong> for remaining particulars and totals.</span>
                      <span style="font-weight: 600; color: #006181;">Continued &rarr;</span>
                    </div>
                  `}
                </div>
              </div>

              ${renderFooterHtml(pageNo)}
            </div>
          `;
        }).join("")}

        <!-- ═══════════════════════════════════════════════════════════════════
             PAGE: TERMS, BANK DETAILS & AUTHORIZATION (EXACT A4 794px x 1123px)
             ═══════════════════════════════════════════════════════════════════ -->
        ${hasPage3 ? `
          <div class="a4-page">
            <div>
              <div class="top-stripe-teal"></div>
              <div class="top-stripe-grey"></div>

              <div class="page-content">
                <div class="header-row" style="margin-bottom: 28px;">
                  <div class="logo-box">
                    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />` : `<div style="font-size:24px;font-weight:800;color:#006181;">STAR MOULD</div>`}
                  </div>
                  <div class="title-box">
                    <div class="title-text" style="font-size: 22px;">TERMS &amp; AUTHORIZATION</div>
                    <div class="title-underline" style="margin-bottom: 6px;"></div>
                    <div style="font-size: 9.5px; color: #475569; font-weight: 500; text-align: right;">Annexure to Quotation No: <strong>${quotationNo}</strong></div>
                  </div>
                </div>

                <!-- Bank Details -->
                <div class="bank-box">
                  <div class="bank-header">BANK DETAILS FOR REMITTANCE</div>
                  <div class="bank-grid">
                    <div class="bank-col">
                      <div class="bank-col-label">Bank Name</div>
                      <div style="color: #1f2a30; font-weight: 600;">${bankName}</div>
                    </div>
                    <div class="bank-col">
                      <div class="bank-col-label">Account Number</div>
                      <div style="font-variant-numeric: tabular-nums; letter-spacing: 0.5px; color: #1f2a30; font-weight: 600;">${bankAccountNo}</div>
                    </div>
                    <div class="bank-col">
                      <div class="bank-col-label">IFSC Code</div>
                      <div style="font-variant-numeric: tabular-nums; letter-spacing: 0.5px; color: #1f2a30; font-weight: 600;">${bankIfsc}</div>
                    </div>
                    <div class="bank-col">
                      <div class="bank-col-label">Branch &amp; City</div>
                      <div style="color: #1f2a30; font-weight: 600;">${bankBranch}</div>
                    </div>
                  </div>
                </div>

                <!-- Terms & Conditions -->
                <div class="terms-box">
                  <div class="terms-header">COMMERCIAL TERMS &amp; CONDITIONS</div>
                  <div class="terms-body">
                    ${activeTerms.map((t, idx) => `
                      <div class="term-row">
                        <div class="term-label">${idx + 1}. ${t.label}</div>
                        <div class="term-content">${t.content}</div>
                      </div>
                    `).join("")}
                  </div>
                </div>

                <!-- Notes -->
                <div class="notes-strip">
                  <strong style="color: #006181;">SPECIAL NOTES:&nbsp;</strong>
                  <span>Goods once manufactured / dispatched will not be accepted back or cancelled without prior mutual written consent. Payment delayed beyond agreed due date shall attract interest @ 18% per annum.</span>
                </div>

                <!-- Dual Signatures -->
                <div class="sig-box">
                  <div class="sig-col-left">
                    <div class="sig-title">CUSTOMER ACCEPTANCE &amp; CONFIRMATION</div>
                    
                    <!-- Blank space for customer stamp -->
                    <div style="height: 75px;"></div>

                    <div class="sig-lines">
                      <div>Authorized Signature: __________________________</div>
                      <div>Name &amp; Designation: &nbsp;__________________________</div>
                      <div>Date: __________________________</div>
                    </div>
                  </div>

                  <div class="sig-col-right">
                    <div class="sig-title" style="text-align: right;">FOR ${COMPANY.name}</div>
                    <div class="sig-stamp-group">
                      ${(quote.include_digital_stamp !== false && stampDataUrl) ? `
                        <div class="stamp-wrap">
                          <img src="${stampDataUrl}" alt="Stamp" class="stamp-img" />
                        </div>
                      ` : ""}
                      <div class="signatory-label">Authorized Signatory</div>
                    </div>
                  </div>
                </div>

                <!-- Turn-over notice to Annexure-I -->
                <div style="width: 710px; margin-top: 14px; padding: 8px 16px; border: 1px dashed #bcd8e0; border-radius: 8px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
                  <span>Please refer to <strong>Pages ${annexure1PageNo} &amp; ${annexure2PageNo}</strong> for Annexure-I: Detailed Manufacturer Terms &amp; Conditions (Clauses 1 to 23).</span>
                  <span style="font-weight: 600; color: #006181;">Annexure-I Next &rarr;</span>
                </div>

              </div>
            </div>

            ${renderFooterHtml(bankPageNo)}
          </div>
        ` : ""}

        <!-- ═══════════════════════════════════════════════════════════════════
             PAGE: ANNEXURE - I PART 1 (CLAUSES 1 TO 12)
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="a4-page">
          <div>
            <div class="top-stripe-teal"></div>
            <div class="top-stripe-grey"></div>

            <div class="page-content">
              <div class="header-row">
                <div style="width: 260px;">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />` : `<div style="font-size:24px;font-weight:800;color:#006181;">STAR MOULD</div>`}
                </div>
                <div>
                  <div class="title-text">ANNEXURE - I</div>
                  <div class="title-underline"></div>
                  <div style="font-size: 9.5px; color: #64748b; font-weight: 500; text-align: right; margin-top: 4px;">
                    Terms &amp; Conditions &bull; Quotation: <strong>${quotationNo}</strong>
                  </div>
                </div>
              </div>

              <div class="annexure-banner">
                <span>DETAILED TERMS &amp; CONDITIONS – MANUFACTURER</span>
                <span style="font-size: 9px; font-weight: 400; opacity: 0.85;">Part 1 (Clauses 1 to 12)</span>
              </div>

              ${renderAnnexureHtml(ANNEXURE_TERMS_PART1)}

              <div style="width: 710px; margin-top: 14px; padding: 8px 16px; border: 1px dashed #bcd8e0; border-radius: 8px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
                <span>Continued on <strong>Page ${annexure2PageNo}</strong> for Clauses 13 to 23 and Customer Final Acceptance.</span>
                <span style="font-weight: 600; color: #006181;">Continued &rarr;</span>
              </div>
            </div>
          </div>

          ${renderFooterHtml(annexure1PageNo)}
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             PAGE: ANNEXURE - I PART 2 (CLAUSES 13 TO 23 + ACCEPTANCE)
             ═══════════════════════════════════════════════════════════════════ -->
        <div class="a4-page">
          <div>
            <div class="top-stripe-teal"></div>
            <div class="top-stripe-grey"></div>

            <div class="page-content">
              <div class="header-row">
                <div style="width: 260px;">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />` : `<div style="font-size:24px;font-weight:800;color:#006181;">STAR MOULD</div>`}
                </div>
                <div>
                  <div class="title-text">ANNEXURE - I</div>
                  <div class="title-underline"></div>
                  <div style="font-size: 9.5px; color: #64748b; font-weight: 500; text-align: right; margin-top: 4px;">
                    Terms &amp; Conditions &bull; Quotation: <strong>${quotationNo}</strong>
                  </div>
                </div>
              </div>

              <div class="annexure-banner">
                <span>DETAILED TERMS &amp; CONDITIONS – MANUFACTURER</span>
                <span style="font-size: 9px; font-weight: 400; opacity: 0.85;">Part 2 (Clauses 13 to 23)</span>
              </div>

              ${renderAnnexureHtml(ANNEXURE_TERMS_PART2)}

              <!-- Special Notes -->
              <div class="notes-strip" style="margin-top: 10px; margin-bottom: 10px; padding: 6px 14px; font-size: 9px; line-height: 1.45;">
                <strong style="color: #006181;">SPECIAL NOTES:&nbsp;</strong>
                <span>Goods once manufactured / dispatched will not be accepted back or cancelled without prior mutual written consent. Payment delayed beyond agreed due date shall attract interest @ 18% per annum.</span>
              </div>

              <!-- Dual Signatures -->
              <div class="sig-box" style="min-height: 145px; padding: 14px 22px; margin-bottom: 0;">
                <div class="sig-col-left" style="min-height: 120px;">
                  <div class="sig-title" style="font-size: 9.5px;">CUSTOMER ACCEPTANCE &amp; CONFIRMATION</div>
                  
                  <!-- Blank space for customer stamp -->
                  <div style="height: 52px;"></div>

                  <div class="sig-lines" style="font-size: 9px; line-height: 1.45;">
                    <div>Authorized Signature: __________________________</div>
                    <div>Name &amp; Designation: &nbsp;__________________________</div>
                    <div>Date: __________________________</div>
                  </div>
                </div>

                <div class="sig-col-right" style="min-height: 120px;">
                  <div class="sig-title" style="font-size: 9.5px; text-align: right;">FOR ${COMPANY.name}</div>
                  <div class="sig-stamp-group">
                    ${(quote.include_digital_stamp !== false && stampDataUrl) ? `
                      <div class="stamp-wrap">
                        <img src="${stampDataUrl}" alt="Stamp" class="stamp-img" />
                      </div>
                    ` : ""}
                    <div class="signatory-label" style="font-size: 10px; padding-top: 4px;">Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${renderFooterHtml(annexure2PageNo)}
        </div>

      </body>
      </html>
    `;

    // Launch Headless Chrome via Puppeteer-core with exact A4 dimensions
    const browser = await puppeteer.launch({
      executablePath: findChromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--font-render-hinting=none"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    const fileName = `${quote.quotation_no || `Quotation_${quote.id}`}.pdf`;
    const isInline = searchParams.get("inline") === "1" || searchParams.get("view") === "1";

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${isInline ? "inline" : "attachment"}; filename="${fileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Quotation PDF Generation Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
