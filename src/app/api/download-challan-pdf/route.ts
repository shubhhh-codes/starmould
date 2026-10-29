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
    const transporterName = escapeHtml(transporter?.vendor_name || "Self / Hand to Hand");

    const vendorName = escapeHtml(vendor?.vendor_name || "—");
    const vendorAddress = escapeHtml(vendor?.address || (vendor?.city ? `${vendor.city}, Gujarat, India` : "—"));
    const vendorGstin = escapeHtml(vendor?.gstin || "—");
    const vendorPan = escapeHtml(vendor?.pan || "—");
    const vendorMobile = escapeHtml(vendor?.mobile || vendor?.mobile1 || "—");
    const vendorEmail = escapeHtml(vendor?.email || "—");
    const vendorCode = escapeHtml(vendor?.vendor_code || "");

    const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.qty) || 0), 0);

    const itemsRowsHtml = items.length === 0
      ? `<tr><td colspan="4" style="height: 46px; text-align: center; color: #94a3b8; font-style: italic;">No subplates or items specified in this outward challan.</td></tr>`
      : items.map((it: any, idx: number) => {
          const sp = it.plateid ? plateMap.get(it.plateid) : null;
          const plateName = escapeHtml(sp?.platename || "Mould Plate");
          const particulars = escapeHtml(it.particulars || "Standard Machining / Job Work");
          const qty = Number(it.qty) || 1;
          const bg = idx % 2 === 0 ? "#f3f9fb" : "#ffffff";

          return `
            <tr style="background-color: ${bg};">
              <td style="height: 44px; padding: 0 8px; text-align: center; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #3d4a52; font-size: 9.5px;">
                ${idx + 1}
              </td>
              <td style="height: 44px; padding: 0 14px; text-align: left; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0;">
                <div style="font-weight: 600; font-size: 10.5px; color: #1f2a30;">${plateName}</div>
              </td>
              <td style="height: 44px; padding: 0 10px; text-align: left; font-weight: 500; font-size: 9.5px; border-top: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; color: #1f2a30;">
                ${particulars}
              </td>
              <td style="height: 44px; padding: 0 12px; text-align: center; font-weight: 700; border-top: 1px solid #bcd8e0; font-size: 11px; color: #006181;">
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
            font-family: 'Poppins', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
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
          .logo-wrap { width: 280px; }
          .logo-img { width: 260px; height: auto; display: block; }
          .title-wrap { text-align: right; }
          .title-main { font-size: 28px; font-weight: 800; letter-spacing: 0.5px; line-height: 1; color: #006181; margin-bottom: 8px; }
          .title-underline { height: 5px; width: 330px; background-color: #62676b; margin-left: auto; }
          .title-sub { font-size: 9px; font-weight: 600; text-transform: uppercase; color: #62676b; letter-spacing: 0.8px; margin-top: 6px; }

          .info-box {
            width: 710px; height: 58px; border: 1px solid #bcd8e0; border-radius: 12px; background-color: #f3f9fb;
            display: flex; overflow: hidden; margin-bottom: 16px;
          }
          .info-col { flex: 1; padding: 8px 18px; display: flex; flex-direction: column; justify-content: center; border-right: 1px solid #bcd8e0; }
          .info-col:last-child { border-right: none; }
          .info-label { font-size: 8px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #006181; margin-bottom: 3px; }
          .info-val { font-size: 12px; font-weight: 500; color: #33414a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .quick-bar {
            width: 710px; border-radius: 8px; border: 1px solid #bcd8e0; padding: 9px 18px; margin-bottom: 18px;
            display: flex; align-items: center; justify-content: space-between; font-size: 10px; background-color: #ffffff;
          }
          .quick-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #006181; }

          .party-box { width: 710px; margin-bottom: 20px; }
          .party-header { display: flex; height: 36px; background-color: #006181; }
          .party-header-cell {
            flex: 1; display: flex; align-items: center; padding: 0 16px;
            font-size: 10.5px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;
          }
          .party-body { display: flex; background: #ffffff; border-left: 1px solid #bcd8e0; border-right: 1px solid #bcd8e0; border-bottom: 1px solid #bcd8e0; }
          .party-col { flex: 1; padding: 12px 16px; font-size: 10px; line-height: 1.5; color: #3d4a52; }
          .party-col-left { border-right: 1px solid #bcd8e0; }
          .party-name { font-weight: 700; font-size: 11.5px; color: #1f2a30; margin-bottom: 2px; }

          .section-bar {
            width: 710px; height: 32px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px;
            font-weight: 600; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 6px;
            background-color: #e6f2f6; color: #006181;
          }

          .table-box { width: 710px; border: 1px solid #bcd8e0; overflow: hidden; margin-bottom: 18px; }
          table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
          th {
            height: 36px; background-color: #006181; color: #ffffff; font-size: 9.5px; font-weight: 600;
            padding: 0 8px; border-right: 1px solid rgba(255,255,255,0.4); text-align: center;
          }
          th:last-child { border-right: none; }
          .total-row { background-color: #e6f2f6; font-weight: 700; }
          .total-row td { height: 34px; font-size: 9.5px; color: #006181; border-top: 1px solid #bcd8e0; }

          .terms-wrap { width: 710px; margin-bottom: 18px; }
          .terms-header {
            height: 34px; padding: 0 16px; display: flex; align-items: center; background-color: #006181;
            color: #ffffff; font-weight: 600; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase;
          }
          .terms-body {
            padding: 10px 16px; font-size: 9px; line-height: 1.6; border-left: 1px solid #bcd8e0;
            border-right: 1px solid #bcd8e0; border-bottom: 1px solid #bcd8e0; background-color: #ffffff; color: #3d4a52;
          }

          .sig-card {
            width: 710px; height: 98px; border-radius: 12px; border: 1px solid #bcd8e0; background-color: #f3f9fb;
            padding: 10px 20px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;
          }
          .sig-top { display: flex; justify-content: space-between; align-items: flex-start; }
          .sig-title { font-weight: 700; font-size: 8.5px; letter-spacing: 0.5px; text-transform: uppercase; color: #006181; }
          .sig-bottom { display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; color: #4a575e; }

          .footer-wrap { width: 794px; margin-top: auto; }
          .footer-navy {
            width: 794px; padding: 8px 36px; display: flex; align-items: center; justify-content: space-between;
            background-color: #1b2537; color: #ffffff;
          }
          .footer-left { display: flex; align-items: center; gap: 10px; }
          .footer-divider { width: 1px; height: 34px; background-color: rgba(255,255,255,0.4); }
          .footer-addr { display: flex; flex-direction: column; line-height: 1.25; }
          .footer-right { display: flex; align-items: center; gap: 9px; }
          .footer-contact { display: flex; flex-direction: column; line-height: 1.3; font-size: 8.5px; font-weight: 600; }
          .footer-white-space { width: 794px; height: 14px; background-color: #ffffff; }
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
                <div class="logo-wrap">
                  ${logoDataUrl ? `<img src="${logoDataUrl}" class="logo-img" alt="Star Mould Logo" />` : `
                    <div style="font-size: 24px; font-weight: 800; color: #006181;">STARMOULD</div>
                    <div style="font-size: 10px; font-weight: 600; color: #62676b;">TECHNOLOGY PRIVATE LIMITED</div>
                  `}
                </div>
                <div class="title-wrap">
                  <div class="title-main">JOB WORK CHALLAN</div>
                  <div class="title-underline"></div>
                  <div class="title-sub">Outward Delivery / Job Work Under Section 143</div>
                </div>
              </div>

              <!-- Top Info Bar -->
              <div class="info-box">
                <div class="info-col">
                  <div class="info-label">Challan Number</div>
                  <div class="info-val" style="font-family: monospace; font-weight: 700; color: #006181;">${challanNo}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">Challan Date</div>
                  <div class="info-val">${challanDate}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">Transporter</div>
                  <div class="info-val">${transporterName}</div>
                </div>
                <div class="info-col">
                  <div class="info-label">Mould Project</div>
                  <div class="info-val" style="font-family: monospace;">${projectCode}</div>
                </div>
              </div>

              <!-- Logistics Quick Bar -->
              <div class="quick-bar">
                <div>
                  <span class="quick-label">Transporter:&nbsp;</span>
                  <span style="font-weight: 600; font-size: 11px; color: #1f2a30;">${transporterName}</span>
                </div>
                <div>
                  <span class="quick-label">Movement Purpose:&nbsp;</span>
                  <span style="font-weight: 500; color: #1f2a30;">Job Work / Subplate Processing</span>
                </div>
              </div>

              <!-- Party Section (Job Worker vs Consignor) -->
              <div class="party-box">
                <div class="party-header">
                  <div class="party-header-cell">Job Worker / Processor (Consignee)</div>
                  <div class="party-header-cell">Consignor (Issued By / Principal)</div>
                </div>
                <div class="party-body">
                  <div class="party-col party-col-left">
                    <div class="party-name">${vendorName}</div>
                    <div>${vendorAddress}</div>
                    ${vendorCode ? `<div style="font-size: 9px; font-family: monospace; color: #64748b;">Vendor Code: ${vendorCode}</div>` : ""}
                    <div style="margin-top: 3px;">
                      <strong style="color: #1f2a30;">GSTIN:</strong> ${vendorGstin}
                      &nbsp;|&nbsp;
                      <strong style="color: #1f2a30;">PAN:</strong> ${vendorPan}
                    </div>
                    <div><strong style="color: #1f2a30;">Contact:</strong> ${vendorMobile}</div>
                    <div><strong style="color: #1f2a30;">Email:</strong> ${vendorEmail}</div>
                  </div>
                  <div class="party-col">
                    <div class="party-name">STARMOULD TECHNOLOGY PRIVATE LIMITED</div>
                    <div>G 705, Near Swaminarayan Restaurant, Road-5, G.I.D.C. Metoda,</div>
                    <div>Rajkot-360 021. (Gujarat) INDIA.</div>
                    <div style="margin-top: 3px;"><strong style="color: #1f2a30;">CIN No:</strong> U25910GJ2023PTC142461</div>
                    <div>
                      <strong style="color: #1f2a30;">GSTIN:</strong> 24ABLCS1427Q1ZV
                      &nbsp;|&nbsp;
                      <strong style="color: #1f2a30;">PAN:</strong> ABLCS1427Q
                    </div>
                    <div><strong style="color: #1f2a30;">Mobile:</strong> 8238451671</div>
                    <div><strong style="color: #1f2a30;">Email:</strong> starmoulda@yahoo.in</div>
                  </div>
                </div>
              </div>

              <!-- Table Section -->
              <div class="section-bar">
                <span>Particulars &amp; Specifications of Goods Sent For Job Work</span>
                <span style="font-size: 9.5px; font-family: monospace; text-transform: lowercase;">(${items.length} ${items.length === 1 ? "item" : "items"})</span>
              </div>
              <div class="table-box">
                <table>
                  <thead>
                    <tr>
                      <th style="width: 40px;">#</th>
                      <th style="width: 360px; text-align: left; padding-left: 14px;">Component / Plate Description</th>
                      <th style="width: 230px; text-align: left; padding-left: 10px;">Job Work Particulars</th>
                      <th style="width: 80px;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRowsHtml}
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td colspan="3" style="text-align: right; padding-right: 16px; text-transform: uppercase; font-size: 9.5px;">
                        Total Dispatched Quantity:
                      </td>
                      <td style="text-align: center; font-size: 12px; font-weight: 700;">
                        ${totalQty}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Terms Box -->
              <div class="terms-wrap">
                <div class="terms-header">Delivery &amp; Job Work Terms &amp; Conditions (Sec. 143 CGST Act)</div>
                <div class="terms-body">
                  <p><strong style="color: #1f2a30;">1. Nature of Movement:</strong> Goods dispatched under this challan are strictly for Job Work / Tooling Processing only and not intended for sale.</p>
                  <p><strong style="color: #1f2a30;">2. Statutory Rule:</strong> Issued in accordance with Section 143 of the CGST Act 2017 &amp; Rule 55 of CGST Rules for movement of goods sent for job work.</p>
                  <p><strong style="color: #1f2a30;">3. Return Obligation:</strong> The processed goods/components must be returned to the consignor within the statutory period of 1 year (or 3 years for capital mould tooling).</p>
                  <p><strong style="color: #1f2a30;">4. Verification &amp; Damage Claims:</strong> Please inspect the dimensions, weight, and condition upon receipt. Any defect or discrepancy must be reported within 24 hours.</p>
                </div>
              </div>

              <!-- Signature Box -->
              <div class="sig-card">
                <div class="sig-top">
                  <span class="sig-title">Receiver's / Processor's Acknowledgement</span>
                  <span class="sig-title">For STARMOULD TECHNOLOGY PRIVATE LIMITED</span>
                </div>
                <div class="sig-bottom">
                  <div>Received in Good Condition&nbsp;&nbsp;|&nbsp;&nbsp;Date: ________________</div>
                  <div style="font-weight: 600; color: #1f2a30;">Authorized Signatory</div>
                </div>
              </div>

            </div>
          </div>

          <!-- Bottom Footer Bar -->
          <div class="footer-wrap">
            <div class="footer-navy">
              <div class="footer-left">
                <div style="display: flex; align-items: center; justify-content: center;">
                  <svg width="14" height="17" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                  </svg>
                </div>
                <div class="footer-divider"></div>
                <div class="footer-addr">
                  <span style="font-size: 9.5px; font-weight: 700; letter-spacing: -0.2px;">Starmould Technology Private Limited</span>
                  <span style="font-size: 8px; color: rgba(255,255,255,0.9);">G 705, Near Swaminarayan Restaurant, Road-5, G.I.D.C. Metoda,</span>
                  <span style="font-size: 8px; color: rgba(255,255,255,0.9);">Rajkot-360 021. (Gujarat) INDIA.</span>
                </div>
              </div>

              <div class="footer-right">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
                  <svg width="12" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <div class="footer-divider" style="height: 28px;"></div>
                <div class="footer-contact">
                  <span>starmoulda@yahoo.in</span>
                  <span>www.starmould.in</span>
                </div>
              </div>
            </div>
            <div class="footer-white-space"></div>
          </div>
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
        "Content-Disposition": `attachment; filename="Job-Work-Challan-${challanNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
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
