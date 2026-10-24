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
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    let id = searchParams.get("id");
    let type = searchParams.get("type") || "purchase";

    if (token) {
      const decoded = verifySecurePrintToken(token);
      if (decoded) {
        id = decoded.id;
        type = decoded.type;
      }
    } else if (id && id.includes(".")) {
      const decoded = verifySecurePrintToken(id);
      if (decoded) {
        id = decoded.id;
        type = decoded.type;
      }
    }

    if (!id || type !== "purchase") {
      return NextResponse.json({ error: "Invalid purchase order request" }, { status: 400 });
    }

    // Fetch purchase record
    const { data: purchase, error: pErr } = await supabaseAdmin
      .from("purchase")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (pErr || !purchase) {
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    // Fetch vendor and line items
    const [vendorRes, custVendorRes, itemsRes] = await Promise.all([
      purchase.vname
        ? supabaseAdmin
            .from("vendors")
            .select("id, vendor_name, mobile, mobile1, address, email, vendor_code, city, gstin, pan")
            .eq("id", purchase.vname)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      purchase.vname
        ? supabaseAdmin
            .from("customers")
            .select("id, customername, mobile, mobile1, address, email, city, gstin, pan")
            .eq("id", purchase.vname)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("purchase_items")
        .select("*")
        .eq("pid", purchase.id),
    ]);

    const vendor = vendorRes.data
      ? { ...vendorRes.data, customername: vendorRes.data.vendor_name }
      : custVendorRes.data
      ? { ...custVendorRes.data, vendor_name: custVendorRes.data.customername }
      : null;

    const items = itemsRes.data || [];
    const plateIds = items.map((it) => it.plateid).filter(Boolean);
    let subplates: any[] = [];
    if (plateIds.length > 0) {
      const { data: sps } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, subprojectid, material, width, height, length, unit")
        .in("id", plateIds);
      subplates = sps || [];
    }
    const plateMap = new Map(subplates.map((sp) => [sp.id, sp]));

    const processedItems = items.map((it, idx) => {
      const sp = plateMap.get(it.plateid);
      return {
        srNo: idx + 1,
        name: sp?.platename || `Subplate #${it.plateid}`,
        dimensions: it.material || (sp ? `${sp.width} x ${sp.height} x ${sp.length} ${sp.unit || "mm"}` : ""),
        materialtype: it.materialtype || sp?.material || "—",
        qty: it.qty || 1,
        rate: it.rate !== null && it.rate !== undefined && it.rate !== "" ? Number(it.rate) : null,
      };
    });

    // Read official logo as base64
    let logoDataUrl = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "images", "stpl-logo.png");
      if (fs.existsSync(logoPath)) {
        const logoBuf = fs.readFileSync(logoPath);
        logoDataUrl = `data:image/png;base64,${logoBuf.toString("base64")}`;
      }
    } catch {}

    const vendorName    = vendor?.vendor_name || vendor?.customername || "—";
    const vendorAddress = vendor?.address || (vendor?.city ? `${vendor.city}, Gujarat, India` : "—");
    const vendorGst     = vendor?.gstin  || "—";
    const vendorPan     = vendor?.pan    || "—";
    const vendorMobile  = vendor?.mobile || vendor?.mobile1 || "—";
    const vendorEmail   = vendor?.email  || "—";
    const vendorCode    = (vendor as any)?.vendor_code || "—";

    // Generate HTML with exact 794x1123 A4 geometry matching Purchase_Order_V23.pdf
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          @page {
            size: 794px 1123px;
            margin: 0;
          }
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
          /* Top Decorative Stripes */
          .top-stripe-teal {
            height: 9px;
            width: 794px;
            background-color: #006181;
          }
          .top-stripe-grey {
            height: 4px;
            width: 794px;
            background-color: #62676b;
          }
          /* Main Content Area */
          .content {
            padding: 24px 42px 0 42px;
            width: 794px;
          }
          /* Header */
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
          .logo-wrap {
            width: 280px;
          }
          .logo-img {
            width: 260px;
            height: auto;
            display: block;
          }
          .title-wrap {
            text-align: right;
          }
          .title-text {
            font-size: 29px;
            font-weight: 800;
            color: #006181;
            letter-spacing: 0.5px;
            line-height: 1;
            margin-bottom: 8px;
          }
          .title-underline {
            height: 5px;
            width: 330px;
            background-color: #62676b;
            margin-left: auto;
          }
          /* Info Box */
          .info-box {
            width: 710px;
            height: 60px;
            border: 1px solid #bcd8e0;
            border-radius: 12px;
            background-color: #f3f9fb;
            display: flex;
            margin-bottom: 24px;
            overflow: hidden;
          }
          .info-col {
            flex: 1;
            padding: 9px 22px;
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
            margin-bottom: 4px;
          }
          .info-val {
            font-size: 12.5px;
            font-weight: 400;
            color: #33414a;
          }
          /* Party Section */
          .party-box {
            width: 710px;
            margin-bottom: 22px;
          }
          .party-header {
            display: flex;
            background-color: #006181;
            height: 37px;
          }
          .party-header-cell {
            flex: 1;
            display: flex;
            align-items: center;
            padding: 0 16px;
            font-size: 11px;
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
            padding: 12px 16px;
            font-size: 10px;
            line-height: 1.5;
            color: #3d4a52;
          }
          .party-name {
            font-size: 11.5px;
            font-weight: 700;
            color: #1f2a30;
            margin-bottom: 2px;
          }
          .bold-label {
            font-weight: 700;
            color: #1f2a30;
          }
          /* Particulars Table */
          .section-heading {
            width: 710px;
            height: 33px;
            background-color: #e6f2f6;
            display: flex;
            align-items: center;
            padding-left: 10px;
            font-size: 11px;
            font-weight: 600;
            color: #006181;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .table-wrap {
            width: 710px;
            border: 1px solid #bcd8e0;
            margin-bottom: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          th {
            background-color: #006181;
            color: #ffffff;
            height: 39px;
            font-size: 9.5px;
            font-weight: 600;
            border-right: 1px solid rgba(255, 255, 255, 0.4);
            padding: 0 8px;
            text-align: center;
          }
          th:last-child {
            border-right: none;
          }
          td {
            height: 46px;
            padding: 0 8px;
            border-top: 1px solid #bcd8e0;
            border-right: 1px solid #bcd8e0;
            color: #3d4a52;
            vertical-align: middle;
          }
          td:last-child {
            border-right: none;
          }
          tr.tinted {
            background-color: #f3f9fb;
          }
          tr.white {
            background-color: #ffffff;
          }
          .footnote {
            font-size: 8.5px;
            font-style: italic;
            color: #4a575e;
            margin-top: 4px;
            margin-bottom: 16px;
          }
          /* Terms */
          .terms-box {
            width: 710px;
            margin-bottom: 16px;
          }
          .terms-header {
            height: 37px;
            background-color: #006181;
            color: #ffffff;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            padding: 0 16px;
          }
          .terms-content {
            padding: 10px 16px;
            font-size: 9.5px;
            line-height: 1.6;
            color: #3d4a52;
          }
          /* Signature */
          .sig-box {
            width: 710px;
            height: 105px;
            border: 1px solid #bcd8e0;
            border-radius: 12px;
            background-color: #f3f9fb;
            padding: 12px 20px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .sig-header {
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
            font-weight: 700;
            color: #006181;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .sig-footer {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 9px;
            color: #4a575e;
          }
          .sig-footer-bold {
            font-weight: 600;
            color: #1f2a30;
          }
          /* Bottom Stripes */
          .bottom-wrap {
            width: 794px;
          }
          .bottom-stripe-grey {
            width: 710px;
            height: 4px;
            background-color: #62676b;
            margin: 0 auto 8px auto;
          }
          .bottom-stripe-teal {
            width: 794px;
            height: 12px;
            background-color: #006181;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div>
            <!-- Top decorative stripes -->
            <div class="top-stripe-teal"></div>
            <div class="top-stripe-grey"></div>

            <div class="content">
              <!-- 1. Header -->
              <div class="header-row">
                <div class="logo-wrap">
                  <img src="${logoDataUrl}" alt="Star Mould" class="logo-img" />
                </div>
                <div class="title-wrap">
                  <div class="title-text">PURCHASE ORDER</div>
                  <div class="title-underline"></div>
                </div>
              </div>

              <!-- 2. Info Box -->
              <div class="info-box">
                <div class="info-col">
                  <div class="info-label">PO NUMBER</div>
                  <div class="info-val">${purchase.srno}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">PO DATE</div>
                  <div class="info-val">${formatDate(purchase.odate)}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">VENDOR CODE</div>
                  <div class="info-val">${vendorCode}</div>
                </div>
              </div>

              <!-- 3. Party Section -->
              <div class="party-box">
                <div class="party-header">
                  <div class="party-header-cell">VENDOR / SUPPLIER</div>
                  <div class="party-header-cell">BUYER (BILL TO)</div>
                </div>
                <div class="party-body">
                  <div class="party-col">
                    <div class="party-name">${vendorName}</div>
                    <div>${vendorAddress}</div>
                    <div style="margin-top: 3px;">
                      <span class="bold-label">GSTIN:</span> ${vendorGst} &nbsp;|&nbsp; <span class="bold-label">PAN:</span> ${vendorPan}
                    </div>
                    <div><span class="bold-label">Contact:</span> ${vendorMobile}</div>
                    <div><span class="bold-label">Email:</span> ${vendorEmail}</div>
                  </div>
                  <div class="party-col">
                    <div class="party-name">STARMOULD TECHNOLOGY PRIVATE LIMITED</div>
                    <div>G-705, Nr Swaminarayan Restaurant, Road-5,</div>
                    <div>Metoda G.I.D.C. Gate no-2, Rajkot, Gujarat - 360021</div>
                    <div style="margin-top: 3px;">
                      <span class="bold-label">GSTIN:</span> 24ABLCS1427Q1ZV &nbsp;|&nbsp; <span class="bold-label">PAN:</span> ABLCS1427Q
                    </div>
                    <div><span class="bold-label">Mobile:</span> 8238451671</div>
                    <div><span class="bold-label">Email:</span> info.starmould@yahoo.com</div>
                  </div>
                </div>
              </div>

              <!-- 4. Particulars Table -->
              <div class="section-heading">PARTICULARS</div>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 38px; text-align: center;">#</th>
                      <th style="width: 312px; text-align: center;">Purchase Material</th>
                      <th style="width: 62px; text-align: center;">Qty</th>
                      <th style="width: 110px; text-align: center;">Material Type</th>
                      <th style="width: 90px; text-align: center;">Mould</th>
                      <th style="width: 96px; text-align: center;">Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      processedItems.length === 0
                        ? `<tr><td colspan="6" style="text-align: center; height: 46px; color: #62676b; font-style: italic;">No items found in this purchase order.</td></tr>`
                        : processedItems
                            .map((it, idx) => {
                              const bgClass = idx % 2 === 0 ? "tinted" : "white";
                              return `
                                <tr class="${bgClass}">
                                  <td style="text-align: center; color: #3d4a52;">${idx + 1}</td>
                                  <td style="text-align: left; padding: 0 16px; color: #3d4a52;">
                                    <div>${it.name}</div>
                                    ${it.dimensions ? `<div style="font-size: 8.5px; color: #62676b; margin-top: 2px;">${it.dimensions}</div>` : ""}
                                  </td>
                                  <td style="text-align: center; color: #3d4a52;">${it.qty}</td>
                                  <td style="text-align: center; color: #3d4a52;">${it.materialtype}</td>
                                  <td style="text-align: center; color: #3d4a52;">${purchase.projectid || "—"}</td>
                                  <td style="text-align: center; font-weight: 700; color: #006181; font-size: 10.5px;">
                                    ${it.rate !== null && it.rate !== undefined && Number(it.rate) > 0 ? "₹ " + Number(it.rate).toLocaleString("en-IN") : "—"}
                                  </td>
                                </tr>
                              `;
                            })
                            .join("")
                    }
                  </tbody>
                </table>
              </div>

              <!-- 5. Terms & Conditions -->
              <div class="terms-box">
                <div class="terms-header">TERMS &amp; CONDITIONS</div>
                <div class="terms-content">
                  <p><span class="bold-label">1. The above-mentioned prices are exclusive of GST.</span></p>
                  <p><span class="bold-label">2. Delivery:</span> Material must be delivered as per the delivery schedule agreed with the buyer.</p>
                  <p><span class="bold-label">3. Quality:</span> Material must match the specifications, type, mould and quantity stated in this purchase order. Defective or non-conforming material may be rejected.</p>
                  <p><span class="bold-label">4. Payment:</span> Payment will be made as per the agreed payment terms after receipt and acceptance of the material.</p>
                  <p><span class="bold-label">5. Documents:</span> Please quote the PO number on all invoices, challans and correspondence.</p>
                </div>
              </div>

              <!-- 6. Footer Signatures -->
              <div class="sig-box">
                <div class="sig-header">
                  <span>VENDOR ACCEPTANCE</span>
                  <span>FOR STARMOULD TECHNOLOGY PRIVATE LIMITED</span>
                </div>
                <div class="sig-footer">
                  <div>Name: [Name]&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Date: [Date]</div>
                  <div class="sig-footer-bold">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom decorative stripes -->
          <div class="bottom-wrap">
            <div class="bottom-stripe-grey"></div>
            <div class="bottom-stripe-teal"></div>
          </div>
        </div>
      </body>
      </html>
    `;

    // Launch Puppeteer with exact 794x1123 A4 dimensions
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

    const fileName = `${purchase.srno || "Purchase_Order"}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PDF Generation Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
