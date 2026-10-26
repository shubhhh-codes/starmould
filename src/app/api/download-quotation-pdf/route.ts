import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { verifySecurePrintToken } from "@/lib/print-token";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

function findChromePath(): string {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "chrome";
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

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    let id = searchParams.get("id");

    if (token) {
      const decoded = verifySecurePrintToken(token);
      if (decoded) {
        id = decoded.id;
      }
    } else if (id && id.includes(".")) {
      const decoded = verifySecurePrintToken(id);
      if (decoded) {
        id = decoded.id;
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

    // Fetch line items
    const { data: items } = await supabaseAdmin
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", id)
      .order("sr_no", { ascending: true });

    const quoteItems = items || [];

    // Read Cover image
    let coverDataUrl = "";
    try {
      const coverPath = path.join(process.cwd(), "public", "images", "quotation-cover.jpg");
      if (fs.existsSync(coverPath)) {
        const coverBuf = fs.readFileSync(coverPath);
        coverDataUrl = `data:image/jpeg;base64,${coverBuf.toString("base64")}`;
      }
    } catch {}

    // Read Logo
    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "images", "stpl-logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuf = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
      }
    } catch {}

    // Read Stamp
    let stampDataUrl = "";
    try {
      const stampPath = path.join(process.cwd(), "public", "images", "starmould-stamp.jpg");
      if (fs.existsSync(stampPath)) {
        const stampBuf = fs.readFileSync(stampPath);
        stampDataUrl = `data:image/jpeg;base64,${stampBuf.toString("base64")}`;
      }
    } catch {}

    const companyHeaderHTML = `
      <div class="company-header">
        <div class="logo-box">
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould Logo" class="brand-logo" />` : `<div style="font-size:22px;font-weight:900;color:#0e7490;">STAR MOULD</div>`}
        </div>
        <div class="header-company-info">
          <div class="since-text">SINCE 1995</div>
          <div class="first-mould-text">(INDIA's First Pulp Mould Manufacturer)</div>
          <div class="comp-name">STARMOULD TECHNOLOGY PVT. LTD.</div>
          <div class="comp-sub">G-705, Near Swaminarayan Restaurant, Road -5, G.I.D.C. Metoda, Rajkot - 360021 Gujarat. India</div>
          <div class="comp-sub">Phone No :- 98256 69459, 95865 33750</div>
          <div class="comp-sub">Email :- starmoulda@yahoo.in , info.starmould@yahoo.in</div>
          <div class="comp-sub">Website :- www.starmould.in</div>
        </div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Quotation_${quote.quotation_no}</title>
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
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #111827;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.35;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            max-height: 297mm;
            height: 297mm;
            page-break-after: always;
            position: relative;
            background: #ffffff;
            overflow: hidden;
          }
          .page-inner {
            padding: 10mm 15mm 12mm 15mm;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .cover-page {
            width: 210mm;
            height: 297mm;
            padding: 0;
            margin: 0;
          }
          .cover-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          }

          /* Header Component */
          .company-header {
            text-align: center;
            margin-bottom: 8px;
          }
          .logo-box {
            display: flex;
            justify-content: center;
            margin-bottom: 2px;
          }
          .brand-logo {
            height: 52px;
            width: auto;
            object-fit: contain;
          }
          .since-text {
            font-size: 10px;
            font-weight: bold;
            color: #111;
          }
          .first-mould-text {
            font-size: 9.5px;
            font-weight: 600;
            color: #222;
          }
          .comp-name {
            font-size: 13.5px;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin: 1px 0;
          }
          .comp-sub {
            font-size: 9.5px;
            color: #334155;
            line-height: 1.25;
          }

          /* Bordered Boxes & Bars */
          .tax-bar {
            border: 1.5px solid #000;
            padding: 4px 8px;
            display: flex;
            justify-content: space-between;
            font-size: 10.5px;
            font-weight: bold;
            margin-bottom: 6px;
          }
          .tan-cin-grid {
            margin-bottom: 10px;
            font-size: 10px;
            line-height: 1.4;
          }
          .tan-cin-row {
            display: flex;
            gap: 12px;
          }
          .tan-cin-col {
            width: 50%;
          }
          .doc-title-bar {
            text-align: center;
            font-size: 15px;
            font-weight: 900;
            letter-spacing: 1px;
            text-decoration: underline;
            margin: 8px 0;
            text-transform: uppercase;
          }
          .quote-no-date-bar {
            border: 1.5px solid #000;
            padding: 4px 8px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            font-weight: bold;
            margin-bottom: 12px;
          }

          /* Details of Consignee */
          .section-heading {
            font-size: 11.5px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 8px;
          }
          .consignee-box {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          .consignee-left {
            width: 54%;
            font-size: 10.5px;
            line-height: 1.45;
          }
          .consignee-right {
            width: 44%;
            font-size: 10.5px;
            line-height: 1.45;
          }
          .consignee-row {
            display: flex;
            margin-bottom: 3px;
          }
          .consignee-lbl {
            width: 95px;
            font-weight: bold;
          }
          .consignee-val {
            flex: 1;
          }

          /* Subject & Reference */
          .subj-ref-section {
            border-top: 1.5px solid #000;
            border-bottom: 1.5px solid #000;
            padding: 8px 0;
            font-size: 10.5px;
            line-height: 1.5;
            margin-top: 10px;
          }
          .subj-ref-row {
            display: flex;
            margin-bottom: 2px;
          }
          .subj-ref-lbl {
            width: 85px;
            font-weight: bold;
          }
          .subj-ref-val {
            flex: 1;
            font-weight: 600;
          }

          /* Table Styling (Page 3) */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          .items-table th, .items-table td {
            border: 1px solid #000;
            padding: 6px 8px;
            font-size: 10.5px;
          }
          .items-table th {
            font-weight: bold;
            text-align: center;
            background: #f8fafc;
          }
          .th-sr { width: 45px; }
          .th-desc { text-align: left !important; }
          .th-qty { width: 55px; text-align: center; }
          .th-unit { width: 75px; text-align: right; }
          .th-total { width: 95px; text-align: right; }

          /* Bank & Totals Split (Page 3) */
          .quote-bottom-split {
            display: flex;
            gap: 14px;
            margin-bottom: 14px;
          }
          .split-left {
            width: 58%;
          }
          .split-right {
            width: 42%;
          }
          .bank-heading {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 4px;
            font-size: 10.5px;
          }
          .bank-table {
            width: 100%;
            font-size: 10px;
            line-height: 1.4;
            margin-bottom: 10px;
          }
          .bank-lbl { width: 100px; }
          
          .summary-terms-heading {
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 4px;
            font-size: 10px;
          }
          .summary-terms-list {
            font-size: 9.5px;
            line-height: 1.35;
          }

          /* Totals Box */
          .totals-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .totals-table td {
            border: 1px solid #000;
            padding: 5px 8px;
            font-size: 10.5px;
          }
          .totals-lbl {
            font-weight: bold;
            width: 55%;
          }
          .totals-val {
            text-align: right;
            font-weight: bold;
            width: 45%;
          }

          /* Signatures */
          .sig-box-right {
            text-align: center;
            margin-top: 16px;
          }
          .sig-comp-title {
            font-size: 10.5px;
            font-weight: bold;
            margin-bottom: 6px;
          }
          .stamp-wrap {
            height: 75px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .stamp-img {
            max-height: 75px;
            width: auto;
            object-fit: contain;
          }
          .sig-auth-text {
            font-size: 10.5px;
            font-weight: bold;
            border-top: 1px dashed #444;
            display: inline-block;
            padding-top: 3px;
            margin-top: 4px;
            min-width: 130px;
          }

          /* Annexure Tables (Pages 4 & 5) */
          .annexure-title {
            text-align: center;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-decoration: underline;
            margin-bottom: 3px;
          }
          .annexure-sub {
            text-align: center;
            font-size: 11px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 10px;
          }
          .terms-grid {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          .terms-grid td {
            border: 1px solid #000;
            padding: 5px 7px;
            vertical-align: top;
          }
          .terms-col-no {
            width: 34%;
            font-weight: bold;
            color: #0f172a;
          }
          .terms-col-desc {
            width: 66%;
            color: #1e293b;
            line-height: 1.35;
          }

          .dual-signature-row {
            display: flex;
            justify-content: space-between;
            margin-top: 25px;
            padding: 0 10px;
          }
          .dual-sig-col {
            text-align: center;
            width: 200px;
          }
          .dual-sig-top {
            font-size: 10.5px;
            font-weight: bold;
            text-decoration: underline;
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>

        <!-- PAGE 1: COVER PAGE -->
        <div class="page cover-page">
          ${coverDataUrl ? `<img src="${coverDataUrl}" alt="Quotation Cover" class="cover-img" />` : `<div style="padding:40px;text-align:center;"><h1>STARMOULD</h1><p>INDIA's 1st Pulp Tableware Mould Manufacturer</p></div>`}
        </div>

        <!-- PAGE 2: HEADER + CONSIGNEE + SUBJECT & REFERENCE -->
        <div class="page">
          <div class="page-inner">
            ${companyHeaderHTML}

            <div class="tax-bar">
              <div>GSTIN NO :- 24ABLCS1427Q1ZV</div>
              <div>PAN NO :- ABLCS1427Q</div>
            </div>

            <div class="tan-cin-grid">
              <div class="tan-cin-row">
                <div class="tan-cin-col"><strong>CIN NO</strong> :- U25910GJ2023PTC142461</div>
                <div class="tan-cin-col"><strong>TAN NO</strong> :- RKTS21097G</div>
              </div>
              <div class="tan-cin-row">
                <div class="tan-cin-col"><strong>Udhyam No</strong> :- UDYAM-GJ-20-0186249</div>
              </div>
            </div>

            <div class="doc-title-bar">QUOTATION</div>

            <div class="quote-no-date-bar">
              <div>Quotation No :- ${quote.quotation_no}</div>
              <div>Date :- ${formatDate(quote.quotation_date)}</div>
            </div>

            <div class="section-heading">Details Of Consignee :-</div>

            <div class="consignee-box">
              <div class="consignee-left">
                <div style="font-weight:bold;margin-bottom:4px;">M/S :-</div>
                <div style="font-weight:bold;font-size:11.5px;margin-bottom:4px;">${quote.consignee_name}</div>
                <div>${(quote.consignee_address || "").replace(/\n/g, "<br/>")}</div>
              </div>

              <div class="consignee-right">
                <div class="consignee-row">
                  <div class="consignee-lbl">GSTIN No</div>
                  <div class="consignee-val">:- ${quote.consignee_gstin || "N/A"}</div>
                </div>
                <div class="consignee-row">
                  <div class="consignee-lbl">PAN No</div>
                  <div class="consignee-val">:- ${quote.consignee_pan || "N/A"}</div>
                </div>
                <div class="consignee-row">
                  <div class="consignee-lbl">Telephone No</div>
                  <div class="consignee-val">:- ${quote.consignee_phone || "N/A"}</div>
                </div>
                <div class="consignee-row">
                  <div class="consignee-lbl">State Code</div>
                  <div class="consignee-val">:- ${quote.state_code || "24 - Gujarat"}</div>
                </div>
              </div>
            </div>

            ${(Boolean(quote.subject?.trim()) || Boolean(quote.reference?.trim())) ? `
            <div class="subj-ref-section">
              ${quote.subject?.trim() ? `
              <div class="subj-ref-row">
                <div class="subj-ref-lbl">Subject</div>
                <div class="subj-ref-val">:- ${quote.subject.trim()}</div>
              </div>` : ''}
              ${quote.reference?.trim() ? `
              <div class="subj-ref-row">
                <div class="subj-ref-lbl">Reference</div>
                <div class="subj-ref-val">:- ${quote.reference.trim()}</div>
              </div>` : ''}
            </div>` : ''}
          </div>
        </div>

        <!-- PAGE 3: PARTICULARS TABLE + BANK DETAILS + QUICK T&C + TOTALS & SIGNATURE -->
        <div class="page">
          <div class="page-inner">
            ${companyHeaderHTML}

            <div class="quote-no-date-bar">
              <div>Quotation No :- ${quote.quotation_no}</div>
              <div>Date :- ${formatDate(quote.quotation_date)}</div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th class="th-sr">Sr. no.</th>
                  <th class="th-desc">Product Description</th>
                  <th class="th-qty">Qty</th>
                  <th class="th-unit">Unit Price</th>
                  <th class="th-total">Total amount</th>
                </tr>
              </thead>
              <tbody>
                ${quoteItems.map((it: any, idx: number) => `
                  <tr>
                    <td style="text-align:center;">${idx + 1}</td>
                    <td>${(it.product_description || "").replace(/\n/g, "<br/>")}</td>
                    <td style="text-align:center;">${it.qty}</td>
                    <td style="text-align:right;">₹ ${formatINR(it.unit_price)}</td>
                    <td style="text-align:right;">₹ ${formatINR(it.total_amount)}</td>
                  </tr>
                `).join("")}
                ${Array.from({ length: Math.max(0, 5 - quoteItems.length) }).map(() => `
                  <tr>
                    <td style="text-align:center;">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <div class="quote-bottom-split">
              <!-- Left: Bank Details & Quick T&C -->
              <div class="split-left">
                <div class="bank-heading">Bank Details :-</div>
                <table class="bank-table">
                  <tr>
                    <td class="bank-lbl">Account No</td>
                    <td>:- ${quote.bank_account_no || "5875819245"}</td>
                  </tr>
                  <tr>
                    <td class="bank-lbl">IFSC Code</td>
                    <td>:- ${quote.bank_ifsc || "CBIN0281313"}</td>
                  </tr>
                  <tr>
                    <td class="bank-lbl">Bank Name</td>
                    <td>:- ${quote.bank_name || "Central Bank Of India"}</td>
                  </tr>
                  <tr>
                    <td class="bank-lbl">Branch Name</td>
                    <td>:- ${quote.bank_branch || "Saurashtra University Branch"}</td>
                  </tr>
                  <tr>
                    <td class="bank-lbl">Branch Address</td>
                    <td>:- ${quote.bank_address || "Saurashtra University Campus, Rajkot"}</td>
                  </tr>
                </table>

                ${(() => {
                  const activeTerms: { label: string; text: string }[] = [];
                  if (quote.price_terms?.trim()) activeTerms.push({ label: "Price Terms", text: quote.price_terms });
                  if (quote.delivery_terms?.trim()) activeTerms.push({ label: "Delivery Terms", text: quote.delivery_terms });
                  if (quote.payment_terms?.trim()) activeTerms.push({ label: "Payment Terms", text: quote.payment_terms });
                  if (quote.validity_terms?.trim()) activeTerms.push({ label: "Validity", text: quote.validity_terms });
                  if (quote.force_majeure?.trim()) activeTerms.push({ label: "Force Majeure", text: quote.force_majeure });
                  if (quote.order_confirmation?.trim()) activeTerms.push({ label: "Order Confirmation", text: quote.order_confirmation });
                  if (quote.warranty_terms?.trim()) activeTerms.push({ label: "Warranty", text: quote.warranty_terms });
                  if (quote.jurisdiction_terms?.trim()) activeTerms.push({ label: "Jurisdiction", text: quote.jurisdiction_terms });

                  if (activeTerms.length === 0) return "";

                  return `
                    <div class="summary-terms-heading">Terms & Conditions :=</div>
                    <div class="summary-terms-list">
                      ${activeTerms.map((term, idx) => `
                        <div><strong>${idx + 1}. ${term.label} :-</strong> ${term.text}</div>
                      `).join("")}
                    </div>
                  `;
                })()}
              </div>

              <!-- Right: Totals Table & Authorized Signatory -->
              <div class="split-right">
                <table class="totals-table">
                  <tr>
                    <td class="totals-lbl">Taxable Amount</td>
                    <td class="totals-val">₹ ${formatINR(quote.taxable_amount)}</td>
                  </tr>
                  ${quote.tax_type === "exempt" ? `
                    <tr>
                      <td class="totals-lbl">Tax (GST Free)</td>
                      <td class="totals-val">₹ 0.00</td>
                    </tr>
                  ` : `
                    <tr>
                      <td class="totals-lbl">GST (18%)</td>
                      <td class="totals-val">₹ ${formatINR(quote.igst_amount || ((quote.cgst_amount || 0) + (quote.sgst_amount || 0)) || Math.round(((quote.taxable_amount || 0) * 0.18) * 100) / 100)}</td>
                    </tr>
                  `}
                  <tr style="background:#f1f5f9;">
                    <td class="totals-lbl" style="font-size:11.5px;">Grand Total</td>
                    <td class="totals-val" style="font-size:11.5px;">₹ ${formatINR(quote.grand_total)}</td>
                  </tr>
                </table>

                <div class="sig-box-right">
                  <div class="sig-comp-title">Starmould Technology PVT. LTD.</div>
                  <div class="stamp-wrap">
                    ${(quote.include_digital_stamp && stampDataUrl) ? `<img src="${stampDataUrl}" alt="Stamp" class="stamp-img" />` : `<div style="height:70px;"></div>`}
                  </div>
                  <div class="sig-auth-text">Authorise Signatory</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- PAGE 4: ANNEXURE - I (Part 1 - Points 1 to 12) -->
        <div class="page">
          <div class="page-inner">
            ${companyHeaderHTML}

            <div class="annexure-title">ANNEXURE - I</div>
            <div class="annexure-sub">Terms & Conditions</div>

            <table class="terms-grid">
              <tbody>
                <tr>
                  <td class="terms-col-no">1. PRICE VALIDITY:</td>
                  <td class="terms-col-desc">This quotation is valid for 10 days from the date of issue. After the validity period, prices are subject to change without prior notice.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">2. PAYMENT TERMS:</td>
                  <td class="terms-col-desc">100% advance before dispatch of goods.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">3. TAXES:</td>
                  <td class="terms-col-desc">GST and all applicable government taxes will be charged extra as per prevailing rates at the time of billing.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">4. ORDER CONFIRMATION:</td>
                  <td class="terms-col-desc">Orders will be treated as confirmed only after receipt of advance payment and a written purchase order or email confirmation from the customer.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">5. PRODUCTION & DELIVERY SCHEDULE:</td>
                  <td class="terms-col-desc">Manufacturing will start only after confirmation and receipt of advance. Delivery timeline will be calculated from the confirmation date and is subject to availability of raw material and production capacity.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">6. TRANSPORTATION, LOADING & UNLOADING:</td>
                  <td class="terms-col-desc">Transportation, packing, loading, unloading, and insurance are chargeable extra unless mentioned otherwise in writing. Risk transfers to the buyer once goods leave our premises.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">7. RAW MATERIAL PRICE FLUCTUATION:</td>
                  <td class="terms-col-desc">Prices are based on current raw material rates. Any significant increase in raw material rates before production may result in price revision.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">8. DESIGN, DRAWING & SAMPLE APPROVAL:</td>
                  <td class="terms-col-desc">If applicable, all drawings, samples, specifications, and designs must be approved by the customer before production. Any changes after approval will attract additional charges and delivery time.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">9. INSPECTION & ACCEPTANCE:</td>
                  <td class="terms-col-desc">Goods must be inspected immediately upon receipt. Any complaints regarding damage, defect, or shortage must be reported within 24–48 hours of delivery. No claims will be entertained thereafter.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">10. WARRANTY:</td>
                  <td class="terms-col-desc">Warranty is applicable only against manufacturing defects, if specifically mentioned. Warranty does not cover damage due to misuse, mishandling, overloading, improper installation, external impact, or power fluctuations</td>
                </tr>
                <tr>
                  <td class="terms-col-no">11. REJECTION POLICY:</td>
                  <td class="terms-col-desc">Rejection of goods after acceptance will not be entertained. Any rejection must be mutually agreed upon in writing and returned at the customer's cost.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">12. CANCELLATION POLICY:</td>
                  <td class="terms-col-desc">Once manufacturing has started, the order cannot be cancelled under any circumstances. The advance amount shall be non-refundable.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- PAGE 5: ANNEXURE - I (Part 2 - Points 13 to 23) + DUAL SIGNATURES -->
        <div class="page">
          <div class="page-inner">
            <div style="height: 15px;"></div>
            <table class="terms-grid">
              <tbody>
                <tr>
                  <td class="terms-col-no">13. NO RETURN / EXCHANGE:</td>
                  <td class="terms-col-desc">Manufactured and custom-made goods are not eligible for return or exchange.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">14. DELAY IN PAYMENT:</td>
                  <td class="terms-col-desc">Any delay in payment beyond the agreed period will attract interest at 18% per annum, or as per industry standards</td>
                </tr>
                <tr>
                  <td class="terms-col-no">15. PACKAGING:</td>
                  <td class="terms-col-desc">Standard packaging will be provided. Special packaging, if required, will be charged extra.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">16. QUANTITY VARIATION:</td>
                  <td class="terms-col-desc">A production variance of ±5% in quantity is considered acceptable and shall be billed accordingly.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">17. CONFIDENTIALITY:</td>
                  <td class="terms-col-desc">All drawings, designs, specifications, and pricing shared are confidential and shall not be disclosed to third parties.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">18. FORCE MAJEURE:</td>
                  <td class="terms-col-desc">We shall not be responsible for delays or non-performance due to events beyond our control including but not limited to natural disasters, fire, strike, government restrictions, or power failure</td>
                </tr>
                <tr>
                  <td class="terms-col-no">19. INTELLECTUAL PROPERTY :</td>
                  <td class="terms-col-desc">All designs, molds, tools, and development work created by us shall remain our intellectual property unless otherwise agreed in writing.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">20. LIABILITY LIMITATION:</td>
                  <td class="terms-col-desc">Our liability is limited strictly to the value of the goods supplied. We are not liable for indirect, incidental, or consequential losses.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">21. GOVERNING LAW & JURISDICTION:</td>
                  <td class="terms-col-desc">All disputes shall be subject to the exclusive jurisdiction of the courts of Rajkot, Gujarat only.</td>
                </tr>
                <tr>
                  <td class="terms-col-no">22. ENTIRE AGREEMENT:</td>
                  <td class="terms-col-desc">This quotation along with these terms constitutes the entire understanding between both parties and overrides all previous discussions or agreements</td>
                </tr>
                <tr>
                  <td class="terms-col-no">23. ACCEPTANCE:</td>
                  <td class="terms-col-desc">Placing an order against this quotation implies full acceptance of the above terms and conditions by the customer.</td>
                </tr>
              </tbody>
            </table>

            <div class="dual-signature-row">
              <div class="dual-sig-col">
                <div class="dual-sig-top">Receiver's Sign & Stamp</div>
                <div style="height: 65px;"></div>
                <div class="sig-auth-text">Authorise Signatory</div>
              </div>

              <div class="dual-sig-col">
                <div class="dual-sig-top" style="text-decoration:none;">Starmould Technology PVT. LTD.</div>
                <div class="stamp-wrap">
                  ${(quote.include_digital_stamp && stampDataUrl) ? `<img src="${stampDataUrl}" alt="Stamp" class="stamp-img" />` : `<div style="height:65px;"></div>`}
                </div>
                <div class="sig-auth-text">Authorise Signatory</div>
              </div>
            </div>
          </div>
        </div>

      </body>
      </html>
    `;

    const chromePath = findChromePath();
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    const cleanQuoteNo = (quote.quotation_no || "Quotation").replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `Quotation_${cleanQuoteNo}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
