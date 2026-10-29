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
  let browser: any = null;
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
      return NextResponse.json({ error: "Missing challan id" }, { status: 400 });
    }

    // Fetch challan record
    const { data: challan, error: cErr } = await supabaseAdmin
      .from("challan")
      .select("*")
      .eq("id", Number(id))
      .single();

    if (cErr || !challan) {
      return NextResponse.json({ error: "Challan record not found" }, { status: 404 });
    }

    // Fetch vendor, customer, transporter, and line items
    const [vendorRes, custRes, transRes, itemsRes] = await Promise.all([
      challan.vendorid
        ? supabaseAdmin
            .from("vendors")
            .select("id, vendor_name, mobile, mobile1, address, city, email, gstin, pan, vendor_code")
            .eq("id", challan.vendorid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      challan.customerid
        ? supabaseAdmin
            .from("customers")
            .select("id, customername")
            .eq("id", challan.customerid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      challan.vendortid
        ? supabaseAdmin
            .from("vendors")
            .select("id, vendor_name")
            .eq("id", challan.vendortid)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from("challan_items")
        .select("*")
        .eq("challanid", challan.id),
    ]);

    const vendor = vendorRes.data;
    const customer = custRes.data;
    const transporter = transRes.data;
    const items = itemsRes.data || [];

    // Fetch subplates for enriched dimensions and material
    const plateIds = items.map((it: any) => it.plateid).filter(Boolean);
    let plateMap = new Map();
    if (plateIds.length > 0) {
      const { data: pData } = await supabaseAdmin
        .from("subplate")
        .select("id, platename, subprojectid, material, width, height, length")
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

    const challanNo = escapeHtml(challan.challanno || "—");
    const challanDate = escapeHtml(formatDate(challan.chdate));
    const projectCode = escapeHtml(challan.projectid || "—");
    const customerName = escapeHtml(customer?.customername || "—");
    const transporterName = escapeHtml(transporter?.vendor_name || "Self / Hand to Hand");

    const vendorName = escapeHtml(vendor?.vendor_name || "—");
    const vendorAddress = escapeHtml(vendor?.address || (vendor?.city ? `${vendor.city}, Gujarat, India` : "—"));
    const vendorGstin = escapeHtml(vendor?.gstin || "—");
    const vendorPan = escapeHtml(vendor?.pan || "—");
    const vendorMobile = escapeHtml(vendor?.mobile || vendor?.mobile1 || "—");
    const vendorEmail = escapeHtml(vendor?.email || "—");

    const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);

    const itemsRowsHtml = items.length === 0
      ? `<tr><td colspan="6" style="height: 46px; text-align: center; color: #94a3b8; font-style: italic;">No items listed in this challan.</td></tr>`
      : items.map((it: any, idx: number) => {
          const sp = it.plateid ? plateMap.get(it.plateid) : null;
          const plateName = escapeHtml(sp?.platename || "Mould Plate");
          const mat = escapeHtml(sp?.material || "—");
          const dims = sp ? `${sp.width}x${sp.height}x${sp.length}` : "—";
          const particulars = escapeHtml(it.particulars || "Standard Jobwork");
          const qty = Number(it.qty) || 1;
          const bg = idx % 2 === 0 ? "#f3f9fb" : "#ffffff";

          return `
            <tr style="background-color: ${bg};">
              <td style="height: 42px; padding: 0 8px; text-align: center; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #3d4a52; font-family: monospace;">
                ${idx + 1}
              </td>
              <td style="height: 42px; padding: 0 12px; text-align: left; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0;">
                <div style="font-weight: 700; font-size: 10.5px; color: #1f2a30;">${plateName}</div>
              </td>
              <td style="height: 42px; padding: 0 8px; text-align: center; font-size: 9.5px; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #3d4a52;">
                ${mat}
              </td>
              <td style="height: 42px; padding: 0 8px; text-align: center; font-family: monospace; font-size: 9px; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #3d4a52;">
                ${dims}
              </td>
              <td style="height: 42px; padding: 0 12px; text-align: left; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; font-size: 9.5px; color: #1f2a30; font-weight: 600;">
                ${particulars}
              </td>
              <td style="height: 42px; padding: 0 12px; text-align: center; font-weight: 700; border-top: 1px solid #bcd8e0; font-size: 11px; color: #006181; font-family: monospace;">
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
          .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .logo-img { width: 240px; height: auto; display: block; }
          .title-text { text-align: right; }
          .title-main { font-size: 24px; font-weight: 800; letter-spacing: 0.5px; line-height: 1; color: #006181; margin-bottom: 6px; }
          .title-underline { height: 4px; width: 340px; background-color: #62676b; margin-left: auto; }
          .title-sub { font-size: 9px; font-weight: 600; text-transform: uppercase; color: #62676b; letter-spacing: 0.8px; margin-top: 6px; }

          .info-card {
            width: 710px; border-radius: 10px; border: 1px solid #bcd8e0; background-color: #f3f9fb;
            display: flex; overflow: hidden; margin-bottom: 14px;
          }
          .info-cell { flex: 1; padding: 8px 14px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #bcd8e0; }
          .info-cell:last-child { border-right: none; }
          .info-label { font-size: 8px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #006181; margin-bottom: 2px; }
          .info-val { font-size: 11px; font-weight: 600; color: #33414a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .party-box {
            width: 710px; border-radius: 10px; border: 1px solid #bcd8e0; background: #ffffff;
            margin-bottom: 16px; overflow: hidden; display: flex;
          }
          .party-col { flex: 1; padding: 10px 16px; }
          .party-col-left { border-right: 1px solid #bcd8e0; background-color: #fafcfd; }
          .party-title { font-size: 8.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #006181; margin-bottom: 4px; }
          .party-name { font-size: 13px; font-weight: 700; color: #1f2a30; margin-bottom: 4px; line-height: 1.2; }
          .party-addr { font-size: 9.5px; color: #3d4a52; line-height: 1.35; margin-bottom: 4px; }
          .party-tax { font-size: 9px; color: #62676b; line-height: 1.35; }

          .table-container { width: 710px; border-radius: 10px; border: 1px solid #bcd8e0; overflow: hidden; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; }
          th {
            height: 32px; background-color: #006181; color: #ffffff; font-size: 8.5px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.6px; padding: 0 10px; border-right: 1px solid #004b64;
          }
          th:last-child { border-right: none; }
          .total-row { background-color: #f3f9fb; border-top: 2px solid #006181; }
          .total-row td { height: 32px; font-weight: 700; font-size: 10.5px; color: #006181; }

          .terms-box {
            width: 710px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc;
            padding: 8px 14px; margin-bottom: 16px; font-size: 8.5px; color: #62676b; line-height: 1.4;
          }
          .terms-title { font-weight: 700; text-transform: uppercase; color: #33414a; margin-bottom: 2px; }

          .sig-row { width: 710px; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 10px; }
          .sig-box { width: 220px; text-align: center; }
          .sig-line { border-top: 1px solid #33414a; margin-bottom: 4px; }
          .sig-label { font-size: 8.5px; font-weight: 600; text-transform: uppercase; color: #3d4a52; }

          .bottom-bar { height: 12px; width: 794px; background-color: #006181; }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div>
            <div class="top-stripe-teal"></div>
            <div class="top-stripe-grey"></div>

            <div class="content">
              <!-- Header Row -->
              <div class="header-row">
                <div>
                  ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Star Mould Logo" />` : `
                    <div style="font-size: 22px; font-weight: 800; color: #006181;">STARMOULD</div>
                    <div style="font-size: 9px; font-weight: 600; color: #62676b;">TECHNOLOGY PRIVATE LIMITED</div>
                  `}
                </div>
                <div class="title-text">
                  <div class="title-main">OUTWARD CHALLAN</div>
                  <div class="title-underline"></div>
                  <div class="title-sub">DELIVERY / JOB WORK CHALLAN</div>
                </div>
              </div>

              <!-- Info Card (Challan No, Date, Project, Transporter) -->
              <div class="info-card">
                <div class="info-cell">
                  <div class="info-label">Challan No.</div>
                  <div class="info-val" style="font-family: monospace; font-weight: 700; color: #006181;">${challanNo}</div>
                </div>
                <div class="info-cell">
                  <div class="info-label">Challan Date</div>
                  <div class="info-val">${challanDate}</div>
                </div>
                <div class="info-cell">
                  <div class="info-label">Mould Project</div>
                  <div class="info-val" style="font-family: monospace;">${projectCode}</div>
                </div>
                <div class="info-cell">
                  <div class="info-label">Transporter</div>
                  <div class="info-val">${transporterName}</div>
                </div>
              </div>

              <!-- Party Box: Consignor vs Vendor -->
              <div class="party-box">
                <div class="party-col party-col-left">
                  <div class="party-title">Consignor / Principal Manufacturer</div>
                  <div class="party-name">STARMOULD TECHNOLOGY PRIVATE LIMITED</div>
                  <div class="party-addr">G 705, Near Swaminarayan Restaurant, Road-5, G.I.D.C. Metoda, Rajkot-360 021 (Gujarat) INDIA</div>
                  <div class="party-tax">
                    <span>GSTIN: <strong>24ABLCS1427Q1ZV</strong></span> • 
                    <span>PAN: <strong>ABLCS1427Q</strong></span><br>
                    <span>Mobile: 8238451671</span> • <span>Email: info.starmould@yahoo.com</span>
                  </div>
                </div>
                <div class="party-col">
                  <div class="party-title">Consignee / Job Worker (Vendor)</div>
                  <div class="party-name">${vendorName}</div>
                  <div class="party-addr">${vendorAddress}</div>
                  <div class="party-tax">
                    ${vendorGstin !== "—" ? `<span>GSTIN: <strong>${vendorGstin}</strong></span> • ` : ""}
                    ${vendorPan !== "—" ? `<span>PAN: <strong>${vendorPan}</strong></span><br>` : ""}
                    <span>Contact: ${vendorMobile}</span>
                    ${vendorEmail !== "—" ? ` • <span>Email: ${vendorEmail}</span>` : ""}
                  </div>
                </div>
              </div>

              <!-- Items Table -->
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 36px; text-align: center;">No.</th>
                      <th style="width: 170px; text-align: left; padding-left: 12px;">Subplate Name</th>
                      <th style="width: 75px; text-align: center;">Material</th>
                      <th style="width: 110px; text-align: center;">Dimensions (WxHxL)</th>
                      <th style="text-align: left; padding-left: 12px;">Job Work Particulars / Process</th>
                      <th style="width: 55px; text-align: center;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRowsHtml}
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td colspan="5" style="text-align: right; padding-right: 14px; text-transform: uppercase; font-size: 9.5px;">
                        Total Items: <span style="font-family: monospace; font-weight: 700; margin-right: 18px;">${items.length}</span> Total Quantity:
                      </td>
                      <td style="text-align: center; font-size: 12px; font-weight: 800; font-family: monospace;">
                        ${totalQty}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Terms Box -->
              <div class="terms-box">
                <div class="terms-title">Job Work Conditions &amp; Declarations:</div>
                <div>
                  1. Goods dispatched under this challan are solely for job work / machining operations and will be returned after processing.<br>
                  2. Ownership and proprietary title remain exclusively with Star Mould Technology Pvt. Ltd.<br>
                  3. Please verify plate specifications, dimensions, and condition immediately upon receipt. Subject to Rajkot jurisdiction.
                </div>
              </div>

              <!-- Signature Row -->
              <div class="sig-row">
                <div class="sig-box">
                  <div style="height: 36px;"></div>
                  <div class="sig-line"></div>
                  <div class="sig-label">Receiver's Signature &amp; Stamp</div>
                </div>
                <div class="sig-box">
                  <div style="font-size: 8.5px; font-weight: 700; color: #006181; margin-bottom: 24px;">For, STARMOULD TECHNOLOGY PVT. LTD.</div>
                  <div class="sig-line"></div>
                  <div class="sig-label">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>

          <div class="bottom-bar"></div>
        </div>
      </body>
      </html>
    `;

    // Launch Chromium instance
    browser = await puppeteer.launch({
      executablePath: findChromePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      width: "794px",
      height: "1123px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Outward-Challan-${challanNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF generation error for challan:", err);
    return NextResponse.json({ error: "Failed to generate Challan PDF", details: err?.message }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error("Error closing puppeteer browser:", closeErr);
      }
    }
  }
}
