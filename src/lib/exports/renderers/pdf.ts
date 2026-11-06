import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "@/lib/pdf/chrome";
import { ExportDatasetResult } from "../contracts";
import { escapeHtml } from "@/lib/utils";

function formatDate(val: any): string {
  if (!val) return "—";
  const str = String(val).slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

export async function renderPdf(dataset: ExportDatasetResult): Promise<Buffer> {
  const isHierarchicalMoulds =
    dataset.rows.length > 0 && Array.isArray(dataset.rows[0].subplates);

  const chromePath = resolveChromeExecutable();

  // Format timestamp in Asia/Kolkata
  const generatedTimeStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(dataset.generatedAt));

  // Build filter pills
  const filterEntries = Object.entries(dataset.filtersApplied).filter(([_, v]) => v && v !== "ALL");
  const filterHtml = filterEntries.length > 0
    ? filterEntries
        .map(
          ([k, v]) => `
          <span class="filter-pill">
            <strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}
          </span>
        `
        )
        .join("")
    : '<span class="filter-pill">All Records</span>';

  // Overall totals calculation for header metrics
  let totalPlatesOverall = 0;
  let totalWeightOverall = 0;
  if (isHierarchicalMoulds) {
    for (const m of dataset.rows) {
      const subplates = Array.isArray(m.subplates) ? m.subplates : [];
      totalPlatesOverall += subplates.length;
      for (const sp of subplates) {
        const wt = Number(sp.weight);
        if (!isNaN(wt) && wt > 0) totalWeightOverall += wt;
      }
    }
  }

  let bodyContentHtml = "";

  if (isHierarchicalMoulds) {
    // 2-Tier Hierarchical Moulds + Subplates Cards
    bodyContentHtml = dataset.rows
      .map((mould, mIdx) => {
        const subplates = Array.isArray(mould.subplates) ? mould.subplates : [];

        let mouldWeight = 0;
        let mouldQty = 0;

        const subplatesTbodyHtml =
          subplates.length > 0
            ? subplates
                .map((sp: any) => {
                  const wt = Number(sp.weight);
                  const qty = Number(sp.sqty) || 1;
                  if (!isNaN(wt) && wt > 0) mouldWeight += wt;
                  mouldQty += qty;

                  const wStr = sp.width != null ? Number(sp.width).toLocaleString("en-IN") : "—";
                  const hStr = sp.height != null ? Number(sp.height).toLocaleString("en-IN") : "—";
                  const lStr = sp.length != null ? Number(sp.length).toLocaleString("en-IN") : "—";
                  const wtStr = wt > 0 ? wt.toFixed(3) : "—";

                  return `
                    <tr>
                      <td class="text-left font-medium">${escapeHtml(sp.platename || "—")}</td>
                      <td class="text-left mono text-slate-500">${escapeHtml(sp.subprojectid || "—")}</td>
                      <td class="text-center">${escapeHtml(sp.shape || "—")}</td>
                      <td class="text-left">${escapeHtml(sp.material || "—")}</td>
                      <td class="text-right num">${wStr}</td>
                      <td class="text-right num">${hStr}</td>
                      <td class="text-right num">${lStr}</td>
                      <td class="text-right num font-semibold">${wtStr}</td>
                      <td class="text-center text-slate-400">${escapeHtml(sp.unit || "mm")}</td>
                      <td class="text-right num font-bold">${qty}</td>
                    </tr>
                  `;
                })
                .join("")
            : `
              <tr>
                <td colspan="10" class="text-center empty-subplates">No subplates registered for this mould.</td>
              </tr>
            `;

        const subtotalRowHtml =
          subplates.length > 0
            ? `
              <tfoot>
                <tr class="subtotal-row">
                  <td colspan="4" class="text-left font-bold text-slate-700">
                    Total: ${subplates.length} plates
                  </td>
                  <td colspan="3" class="text-right font-bold text-slate-600">Subtotal Weight:</td>
                  <td class="text-right num font-bold text-blue-900">${mouldWeight > 0 ? mouldWeight.toFixed(3) : "0.000"} kg</td>
                  <td class="text-center font-bold text-slate-500">kg</td>
                  <td class="text-right num font-bold text-slate-900">${mouldQty} pcs</td>
                </tr>
              </tfoot>
            `
            : "";

        const statusClass = (mould.status || "pending").toLowerCase();

        return `
          <div class="mould-card">
            <!-- Mould Header Banner -->
            <div class="mould-banner">
              <div class="mould-primary">
                <span class="mould-code-badge">${escapeHtml(mould.projectid)}</span>
                <span class="mould-customer">${escapeHtml(mould.customername || "—")}</span>
                <span class="mould-desc">${escapeHtml(mould.description || "—")}</span>
              </div>
              <div class="mould-meta">
                <span class="type-pill">${escapeHtml(mould.worktype || "—")}</span>
                <span class="meta-label">Received: <strong>${formatDate(mould.rdate)}</strong></span>
                <span class="meta-label">Target: <strong>${formatDate(mould.cdate)}</strong></span>
                <span class="status-badge ${statusClass}">${escapeHtml(mould.status || "Pending")}</span>
              </div>
            </div>

            <!-- Subplates Itemized Table -->
            <table class="subplates-table">
              <thead>
                <tr>
                  <th style="width: 22%;">Plate Name</th>
                  <th style="width: 18%;">Subproject ID</th>
                  <th style="width: 8%; text-align: center;">Shape</th>
                  <th style="width: 12%;">Material</th>
                  <th style="width: 7%; text-align: right;">W (OD)</th>
                  <th style="width: 7%; text-align: right;">H (ID)</th>
                  <th style="width: 7%; text-align: right;">Length</th>
                  <th style="width: 9%; text-align: right;">Weight (kg)</th>
                  <th style="width: 5%; text-align: center;">Unit</th>
                  <th style="width: 5%; text-align: right;">Qty</th>
                </tr>
              </thead>
              <tbody>
                ${subplatesTbodyHtml}
              </tbody>
              ${subtotalRowHtml}
            </table>
          </div>
        `;
      })
      .join("");
  } else {
    // Standard Flat Table
    const theadHtml = dataset.columns.map((col) => `<th>${escapeHtml(col.header)}</th>`).join("");
    const tbodyHtml = dataset.rows
      .map((row) => {
        const cells = dataset.columns
          .map((col) => {
            let val = row[col.key];
            if (val === null || val === undefined) val = "—";

            let align = "text-left";
            if (col.type === "number" || col.type === "currency") {
              align = "text-right num";
              if (col.type === "currency" && typeof val === "number") {
                val = `₹${val.toLocaleString("en-IN")}`;
              }
            } else if (col.type === "date" && val !== "—") {
              align = "text-center";
              val = formatDate(val);
            } else if (col.type === "status") {
              align = "text-center";
            }

            return `<td class="${align}">${escapeHtml(String(val))}</td>`;
          })
          .join("");

        return `<tr>${cells}</tr>`;
      })
      .join("");

    bodyContentHtml = `
      <div class="mould-card">
        <table class="subplates-table">
          <thead>
            <tr>${theadHtml}</tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(dataset.title)}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm 10mm 14mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          font-size: 9px;
          line-height: 1.35;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2.5px solid #1e293b;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .brand {
          display: flex;
          flex-direction: column;
        }
        .brand-title {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.8px;
        }
        .brand-subtitle {
          font-size: 8px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
        }
        .summary-stats {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 8.5px;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .stat-label {
          font-size: 7.5px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        .stat-val {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
        }
        .report-title-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .report-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.2px;
        }
        .filter-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 12px;
        }
        .filter-pill {
          background-color: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 8px;
          color: #334155;
        }
        .filter-pill strong {
          color: #0f172a;
        }

        /* Mould Project Card Styling */
        .mould-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 14px;
          page-break-inside: avoid;
          background: #ffffff;
        }
        .mould-banner {
          background: #1e293b;
          color: #ffffff;
          padding: 6px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          border-bottom: 1px solid #0f172a;
        }
        .mould-primary {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mould-code-badge {
          background: #38bdf8;
          color: #0f172a;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 800;
          font-size: 9.5px;
          padding: 1.5px 6px;
          border-radius: 4px;
          letter-spacing: 0.2px;
        }
        .mould-customer {
          font-weight: 700;
          font-size: 10px;
          color: #ffffff;
        }
        .mould-desc {
          color: #cbd5e1;
          font-size: 8.5px;
          border-left: 1px solid #475569;
          padding-left: 8px;
        }
        .mould-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 8.5px;
        }
        .meta-label {
          color: #94a3b8;
        }
        .meta-label strong {
          color: #f8fafc;
        }
        .type-pill {
          background: #334155;
          color: #e2e8f0;
          padding: 1.5px 6px;
          border-radius: 3px;
          font-weight: 600;
          font-size: 8px;
        }
        .status-badge {
          padding: 1.5px 6px;
          border-radius: 3px;
          font-weight: 700;
          font-size: 8px;
          text-transform: uppercase;
        }
        .status-badge.pending {
          background: #fef3c7;
          color: #92400e;
        }
        .status-badge.completed, .status-badge.registered {
          background: #dcfce7;
          color: #166534;
        }

        /* Subplates Table */
        .subplates-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
        }
        .subplates-table thead th {
          background: #334155;
          color: #ffffff;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 7.5px;
          letter-spacing: 0.3px;
          padding: 5px 6px;
          border-bottom: 1px solid #1e293b;
          border-right: 1px solid #475569;
        }
        .subplates-table thead th:last-child {
          border-right: none;
        }
        .subplates-table tbody td {
          padding: 4px 6px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #f1f5f9;
          color: #1e293b;
        }
        .subplates-table tbody td:last-child {
          border-right: none;
        }
        .subplates-table tbody tr:nth-child(even) td {
          background-color: #f8fafc;
        }
        .subtotal-row td {
          background-color: #f1f5f9 !important;
          border-top: 1.5px solid #cbd5e1;
          border-bottom: none;
          padding: 4.5px 6px;
          font-size: 8px;
        }
        .empty-subplates {
          color: #94a3b8;
          font-style: italic;
          padding: 8px;
        }

        /* Typography & Utilities */
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-semibold { font-weight: 600; }
        .font-bold { font-weight: 700; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 7.5px; }
        .num { font-variant-numeric: tabular-nums; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <span class="brand-title">STAR MOULD ERP</span>
          <span class="brand-subtitle">Precision Mould Manufacturing System</span>
        </div>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">Moulds</span>
            <span class="stat-val">${dataset.rows.length}</span>
          </div>
          ${
            isHierarchicalMoulds
              ? `
            <div class="stat-item" style="border-left: 1px solid #cbd5e1; padding-left: 10px;">
              <span class="stat-label">Total Plates</span>
              <span class="stat-val">${totalPlatesOverall}</span>
            </div>
            <div class="stat-item" style="border-left: 1px solid #cbd5e1; padding-left: 10px;">
              <span class="stat-label">Total Weight</span>
              <span class="stat-val">${totalWeightOverall > 0 ? totalWeightOverall.toFixed(3) : "0.000"} kg</span>
            </div>
          `
              : ""
          }
          <div class="stat-item" style="border-left: 1px solid #cbd5e1; padding-left: 10px;">
            <span class="stat-label">Generated</span>
            <span class="stat-val" style="font-size: 9px; font-weight: 600;">${escapeHtml(generatedTimeStr)}</span>
          </div>
        </div>
      </div>

      <div class="report-title-bar">
        <div class="report-title">${escapeHtml(dataset.title)}</div>
      </div>

      <div class="filter-bar">
        ${filterHtml}
      </div>

      ${bodyContentHtml}
    </body>
    </html>
  `;

  let browser: any = null;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--font-render-hinting=none"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="font-size: 8px; width: 100%; text-align: right; padding-right: 12mm; color: #94a3b8; font-family: sans-serif;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span> • Star Mould ERP Precision Manufacturing
        </div>
      `,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "12mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
