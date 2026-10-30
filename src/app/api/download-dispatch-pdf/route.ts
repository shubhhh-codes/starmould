import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { verifySecurePrintToken } from "@/lib/print-token";
import { escapeHtml } from "@/lib/utils";
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
      return NextResponse.json({ error: "Missing dispatch id" }, { status: 400 });
    }

    // Fetch dispatch record
    const { data: dispatch, error: dErr } = await supabaseAdmin
      .from("dispatch")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (dErr || !dispatch) {
      return NextResponse.json({ error: "Dispatch record not found" }, { status: 404 });
    }

    // Fetch customer, transporter, and line items
    const [custRes, transpRes, itemsRes] = await Promise.all([
      dispatch.customerid
        ? supabaseAdmin
            .from("customers")
            .select("id, customername, mobile, mobile1, address, city, email, gstin, pan, customer_code")
            .eq("id", dispatch.customerid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      dispatch.vendortid
        ? supabaseAdmin
            .from("vendors")
            .select("id, vendor_name")
            .eq("id", dispatch.vendortid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("dispatch_items")
        .select("*")
        .eq("dispatchid", dispatch.id),
    ]);

    const customer = custRes.data;
    const transporter = transpRes.data;
    const items = itemsRes.data || [];

    // Fetch subplates for enriched info
    const plateIds = items.map((it: any) => it.plateid).filter(Boolean);
    let plateMap = new Map();
    if (plateIds.length > 0) {
      const { data: pData } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, subprojectid, material")
        .in("id", plateIds);
      if (pData) {
        plateMap = new Map(pData.map((p) => [p.id, p]));
      }
    }

    // Read official logo as base64
    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "images", "stpl-logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuf = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
      }
    } catch {}

    const challanNo = escapeHtml(dispatch.challanno || "—");
    const challanDate = escapeHtml(formatDate(dispatch.chdate));
    const invoiceNo = escapeHtml(dispatch.invoiceno || "N/A");
    const vehicleNo = escapeHtml(dispatch.vehicleno || "N/A");
    const transporterName = escapeHtml(transporter?.vendor_name || "Self / Hand to Hand");
    const deliveryType = escapeHtml(dispatch.deliverytype || "Door Delivery");
    const freightMode = escapeHtml(dispatch.freightmode || "To Pay");
    const noOfCases = escapeHtml(dispatch.noofcases || "1");
    const projectCode = escapeHtml(dispatch.projectid || "—");

    const customerName = escapeHtml(customer?.customername || "—");
    const customerAddress = escapeHtml(customer?.address || (customer?.city ? `${customer.city}, Gujarat, India` : "—"));
    const customerGstin = escapeHtml(customer?.gstin || "—");
    const customerPan = escapeHtml(customer?.pan || "—");
    const customerMobile = escapeHtml(customer?.mobile || customer?.mobile1 || "—");
    const customerEmail = escapeHtml(customer?.email || "—");

    const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);

    const itemsRowsHtml = items.length === 0
      ? `<tr><td colspan="6" style="height: 46px; text-align: center; color: #94a3b8; font-style: italic;">No items listed in this challan.</td></tr>`
      : items.map((it: any, idx: number) => {
          const sp = it.plateid ? plateMap.get(it.plateid) : null;
          const componentName = escapeHtml(it.custom_plate_name || sp?.platename || "Mould Component");
          const specs = escapeHtml(it.particulars || "");
          const subCode = escapeHtml(sp?.subprojectid || "");
          const mat = escapeHtml(sp?.material || "");
          const prj = escapeHtml(it.project || projectCode);
          const cond = escapeHtml(it.condition || "NEW");
          const work = escapeHtml(it.work || "NEW MADE");
          const qty = Number(it.qty) || 1;

          return `
            <tr style="background-color: #ffffff; page-break-inside: avoid;">
              <td style="min-height: 44px; padding: 10px 8px; text-align: center; vertical-align: middle; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #3d4a52;">
                ${idx + 1}
              </td>
              <td style="min-height: 44px; padding: 10px 14px; text-align: left; vertical-align: top; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0;">
                <div style="font-weight: 700; font-size: 10px; line-height: 1.3; color: #1f2a30;">${componentName}</div>
                ${specs ? `
                  <div style="font-size: 8.5px; margin-top: 3px; color: #3d4a52; white-space: pre-line; line-height: 1.45; word-break: break-word;">
                    ${specs}
                  </div>
                ` : (subCode || mat) ? `
                  <div style="font-size: 8.5px; margin-top: 2px; color: #62676b;">
                    ${subCode ? `<span style="font-family: monospace;">${subCode}</span>` : ""}
                    ${subCode && mat ? " • " : ""}
                    ${mat ? `<span>Material: ${mat}</span>` : ""}
                  </div>
                ` : ""}
              </td>
              <td style="min-height: 44px; padding: 10px 8px; text-align: center; vertical-align: middle; font-family: monospace; font-weight: 500; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #3d4a52;">
                ${prj}
              </td>
              <td style="min-height: 44px; padding: 10px 8px; text-align: center; vertical-align: middle; font-weight: 500; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; font-size: 9px; text-transform: uppercase; color: #3d4a52;">
                ${cond}
              </td>
              <td style="min-height: 44px; padding: 10px 8px; text-align: center; vertical-align: middle; font-weight: 500; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; font-size: 9px; color: #3d4a52;">
                ${work}
              </td>
              <td style="min-height: 44px; padding: 10px 12px; text-align: center; vertical-align: middle; font-weight: 700; border-top: 1px solid #bcd8e0; font-size: 11px; color: #006181;">
                ${qty}
              </td>
            </tr>
          `;
        }).join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: 794px 1123px; margin: 0; }
          html, body {
            width: 794px;
            height: 1123px;
            max-width: 794px;
            max-height: 1123px;
            overflow: hidden;
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: 'Poppins', sans-serif;
            color: #1f2a30;
            -webkit-font-smoothing: antialiased;
          }
          .page-container {
            width: 794px;
            height: 1123px;
            position: relative;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .top-stripe-teal { height: 9px; width: 794px; background-color: #006181; }
          .top-stripe-grey { height: 4px; width: 794px; background-color: #62676b; }
          .content { padding: 24px 42px 0 42px; width: 794px; }
          .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px; }
          .logo-img { width: 260px; height: auto; display: block; }
          .title-text { text-align: right; }
          .title-main { font-size: 28px; font-weight: 800; letter-spacing: 0.5px; line-height: 1; color: #006181; margin-bottom: 8px; }
          .title-underline { height: 5px; width: 330px; background-color: #62676b; margin-left: auto; }
          .title-sub { font-size: 9px; font-weight: 600; text-transform: uppercase; color: #62676b; letter-spacing: 0.8px; margin-top: 6px; }

          .info-card {
            width: 710px; height: 58px; border-radius: 12px; border: 1px solid #bcd8e0; background-color: #f3f9fb;
            display: flex; overflow: hidden; margin-bottom: 16px;
          }
          .info-cell { flex: 1; padding: 8px 18px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #bcd8e0; }
          .info-cell:last-child { border-right: none; }
          .info-label { font-size: 8px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #006181; margin-bottom: 3px; }
          .info-val { font-size: 12px; font-weight: 500; color: #33414a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .logistics-bar {
            width: 710px; min-height: 54px; border-radius: 12px; border: 1px solid #bcd8e0; background-color: #f3f9fb;
            display: flex; overflow: hidden; margin-bottom: 16px;
          }
          .logistics-cell { padding: 6px 12px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #bcd8e0; min-width: 0; }
          .logistics-cell:last-child { border-right: none; }
          .logistics-cell.col-transporter { flex: 1.6; }
          .logistics-cell.col-mode { flex: 1.1; }
          .logistics-cell.col-freight { flex: 0.75; }
          .logistics-cell.col-cases { flex: 0.75; }
          .logistics-cell.col-project { flex: 1.0; }
          .logistics-label { font-size: 8px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #006181; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .logistics-val { font-size: 11px; font-weight: 500; color: #33414a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .logistics-val-wrap { font-size: 10.5px; font-weight: 500; color: #33414a; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }

          .party-card { width: 710px; margin-bottom: 20px; }
          .party-head { display: flex; height: 36px; background-color: transparent; border: 1px solid #bcd8e0; border-bottom: none; }
          .party-head-cell { flex: 1; display: flex; align-items: center; padding: 0 16px; color: #006181; font-weight: 700; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; }
          .party-head-cell:first-child { border-right: 1px solid #bcd8e0; }
          .party-body { display: flex; background: #ffffff; border: 1px solid #bcd8e0; }
          .party-col { flex: 1; padding: 12px 16px; font-size: 10px; line-height: 1.5; color: #3d4a52; }
          .party-col:first-child { border-right: 1px solid #bcd8e0; }
          .party-name { font-weight: 700; font-size: 11.5px; margin-bottom: 2px; color: #1f2a30; }

          .section-bar {
            width: 710px; height: 32px; display: flex; align-items: center; justify-content: space-between;
            padding: 0 12px; font-weight: 600; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase;
            background-color: #e6f2f6; color: #006181; margin-bottom: 6px;
          }
          .table-box { width: 710px; border: 1px solid #bcd8e0; overflow: hidden; margin-bottom: 18px; }
          table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
          thead tr { background-color: transparent; border-bottom: 1px solid #bcd8e0; }
          thead th { height: 36px; padding: 0 8px; font-weight: 700; font-size: 9.5px; border-right: 1px solid #bcd8e0; color: #006181; }
          thead th:last-child { border-right: none; }
          .tot-row { background-color: #ffffff; font-weight: 700; }
          .tot-label { height: 34px; padding: 0 16px; text-align: right; text-transform: uppercase; font-size: 9.5px; border-top: 1px solid #bcd8e0; color: #006181; }
          .tot-val { height: 34px; padding: 0 12px; text-align: center; font-weight: 700; font-size: 12px; border-top: 1px solid #bcd8e0; color: #006181; }

          .terms-card { width: 710px; margin-bottom: 18px; }
          .terms-head { height: 34px; padding: 0 16px; display: flex; align-items: center; color: #006181; font-weight: 700; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; background-color: transparent; border: 1px solid #bcd8e0; border-bottom: none; }
          .terms-body { padding: 10px 16px; font-size: 9px; line-height: 1.6; border: 1px solid #bcd8e0; background-color: #ffffff; color: #3d4a52; }

          .sign-card {
            width: 710px; height: 98px; border-radius: 12px; border: 1px solid #bcd8e0; background-color: #f3f9fb;
            padding: 10px 20px; display: flex; flex-direction: column; justify-content: space-between;
          }
          .sign-top { display: flex; justify-content: space-between; font-weight: 700; font-size: 8.5px; letter-spacing: 0.5px; text-transform: uppercase; color: #006181; }
          .sign-bottom { display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; color: #4a575e; }

          .footer-navy { width: 794px; padding: 8px 36px; background-color: #e6f2f6; border-top: 1px solid #bcd8e0; display: flex; align-items: center; justify-content: space-between; color: #1f2a30; margin-top: auto; }
          .footer-left { display: flex; align-items: center; gap: 10px; }
          .footer-divider { width: 1px; height: 34px; background-color: #bcd8e0; }
          .footer-right { display: flex; align-items: center; gap: 9px; }
          .footer-right-text { font-size: 8.5px; font-weight: 600; line-height: 1.3; color: #006181; }
          .bottom-white { width: 794px; height: 14px; background: #ffffff; }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div>
            <div class="top-stripe-teal"></div>
            <div class="top-stripe-grey"></div>

            <div class="content">
              <!-- Header -->
              <div class="header-row">
                <div>
                  ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />` : ""}
                </div>
                <div class="title-text">
                  <div class="title-main">DELIVERY CHALLAN</div>
                  <div class="title-underline"></div>
                  <div class="title-sub">We Shape Your Ideas</div>
                </div>
              </div>

              <!-- Info Card -->
              <div class="info-card">
                <div class="info-cell">
                  <div class="info-label">CHALLAN NUMBER</div>
                  <div class="info-val">${challanNo}</div>
                </div>
                <div class="info-cell">
                  <div class="info-label">CHALLAN DATE</div>
                  <div class="info-val">${challanDate}</div>
                </div>
                <div class="info-cell">
                  <div class="info-label">INVOICE NUMBER</div>
                  <div class="info-val">${invoiceNo}</div>
                </div>
                <div class="info-cell">
                  <div class="info-label">VEHICLE NUMBER</div>
                  <div class="info-val">${vehicleNo}</div>
                </div>
              </div>

              <!-- Logistics Bar -->
              <div class="logistics-bar">
                <div class="logistics-cell col-transporter">
                  <div class="logistics-label">TRANSPORTER</div>
                  <div class="logistics-val-wrap" title="${transporterName}">${transporterName}</div>
                </div>
                <div class="logistics-cell col-mode">
                  <div class="logistics-label">DELIVERY MODE</div>
                  <div class="logistics-val">${deliveryType}</div>
                </div>
                <div class="logistics-cell col-freight">
                  <div class="logistics-label">FREIGHT</div>
                  <div class="logistics-val">${freightMode}</div>
                </div>
                <div class="logistics-cell col-cases">
                  <div class="logistics-label">NO. OF CASES</div>
                  <div class="logistics-val">${noOfCases}</div>
                </div>
                <div class="logistics-cell col-project">
                  <div class="logistics-label">PROJECT CODE</div>
                  <div class="logistics-val" style="font-family: monospace; font-weight: 700; color: #006181;">${projectCode}</div>
                </div>
              </div>

              <!-- Party Section -->
              <div class="party-card">
                <div class="party-head">
                  <div class="party-head-cell">CONSIGNEE (DELIVER TO)</div>
                  <div class="party-head-cell">CONSIGNOR (DISPATCHED FROM)</div>
                </div>
                <div class="party-body">
                  <div class="party-col">
                    <div class="party-name">${customerName}</div>
                    <div>${customerAddress}</div>
                    <div style="margin-top: 3px;">
                      <strong>GSTIN:</strong> ${customerGstin} &nbsp;|&nbsp; <strong>PAN:</strong> ${customerPan}
                    </div>
                    <div><strong>Contact:</strong> ${customerMobile}</div>
                    <div><strong>Email:</strong> ${customerEmail}</div>
                  </div>
                  <div class="party-col">
                    <div class="party-name">STARMOULD TECHNOLOGY PRIVATE LIMITED</div>
                    <div>G 705, Near Swaminarayan Restaurant, Road-5, G.I.D.C. Metoda,</div>
                    <div>Rajkot-360 021. (Gujarat) INDIA.</div>
                    <div style="margin-top: 3px;"><strong>CIN No:</strong> U25910GJ2023PTC142461</div>
                    <div><strong>GSTIN:</strong> 24ABLCS1427Q1ZV &nbsp;|&nbsp; <strong>PAN:</strong> ABLCS1427Q</div>
                    <div><strong>Mobile:</strong> 8238451671</div>
                    <div><strong>Email:</strong> starmoulda@yahoo.in</div>
                  </div>
                </div>
              </div>

              <!-- Particulars Table -->
              <div class="section-bar">
                <span>PARTICULARS &amp; TOOLING SPECIFICATIONS</span>
                <span style="font-size: 9.5px; font-family: monospace; text-transform: lowercase;">(${items.length} ${items.length === 1 ? "item" : "items"})</span>
              </div>
              <div class="table-box">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 38px;">#</th>
                      <th style="width: 320px; text-align: left; padding-left: 12px;">Component / Tooling Description</th>
                      <th style="width: 120px;">Mould Project</th>
                      <th style="width: 75px;">Condition</th>
                      <th style="width: 95px;">Work Nature</th>
                      <th style="width: 62px;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRowsHtml}
                    <tr class="tot-row">
                      <td colspan="5" class="tot-label">Total Dispatched Quantity:</td>
                      <td class="tot-val">${totalQty}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Terms & Conditions -->
              <div class="terms-card">
                <div class="terms-head">DELIVERY TERMS &amp; CONDITIONS</div>
                <div class="terms-body">
                  <p><strong>1. Goods Condition:</strong> The goods described above are dispatched in completely finished and good condition at consignee's risk.</p>
                  <p><strong>2. Verification &amp; Endorsement:</strong> Please check and verify the quantity and condition of goods upon receipt and endorse this delivery challan.</p>
                  <p><strong>3. Discrepancy / Damage Claims:</strong> Any discrepancy, shortage, or transit defect must be noted on the carrier's copy and intimated within 24 hours of delivery.</p>
                  <p><strong>4. Statutory Notice:</strong> This delivery challan is issued under GST provisions for movement of manufactured mould tooling &amp; component assemblies.</p>
                </div>
              </div>

              <!-- Signatures -->
              <div class="sign-card">
                <div class="sign-top">
                  <span>RECEIVER'S ACKNOWLEDGEMENT &amp; STAMP</span>
                  <span>FOR STARMOULD TECHNOLOGY PRIVATE LIMITED</span>
                </div>
                <div class="sign-bottom">
                  <div>Received in Good Condition &nbsp;|&nbsp; Date: ________________</div>
                  <div style="font-weight: 600; color: #1f2a30;">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Footer -->
          <div>
            <div class="footer-navy">
              <div class="footer-left">
                <svg width="14" height="17" viewBox="0 0 24 24" fill="#006181">
                  <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                </svg>
                <div class="footer-divider"></div>
                <div style="font-size: 8px; line-height: 1.25;">
                  <div style="font-size: 9.5px; font-weight: 700; color: #006181;">Starmould Technology Private Limited</div>
                  <div style="color: #475569; font-weight: 500;">G 705, Near Swaminarayan Restaurant, Road-5, G.I.D.C. Metoda,</div>
                  <div style="color: #475569; font-weight: 500;">Rajkot-360 021. (Gujarat) INDIA.</div>
                </div>
              </div>
              <div class="footer-right">
                <div class="footer-divider"></div>
                <div class="footer-right-text">
                  <div>starmoulda@yahoo.in</div>
                  <div>www.starmould.in</div>
                </div>
              </div>
            </div>
            <div class="bottom-white"></div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Launch Puppeteer with exact 794x1123 A4 dimensions with try-finally to guarantee process cleanup
    let browser: any = null;
    let pdfBuffer: Uint8Array | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: findChromePath(),
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--font-render-hinting=none"],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
      await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
      await page.evaluateHandle("document.fonts.ready");

      pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    if (!pdfBuffer) {
      throw new Error("Failed to generate PDF buffer");
    }

    const safeNumber = (dispatch.challanno || "Delivery_Challan").replace(/[\/\\]/g, "_");
    const fileName = `${safeNumber}.pdf`;
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
    const message = err instanceof Error ? err.message : "PDF Generation Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
