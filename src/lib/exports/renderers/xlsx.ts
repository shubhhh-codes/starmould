import ExcelJS from "exceljs";
import { ExportDatasetResult } from "../contracts";

/**
 * Sanitizes spreadsheet cell strings against formula injection (CWE-1236)
 */
function sanitizeCellString(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();

  // If begins with formula triggering characters: escape with single quote
  if (/^[=@\t\r]/.test(str)) {
    return "'" + str;
  }
  if (/^[+\-]/.test(str)) {
    const isPureNumber = /^[+\-]?\d+(\.\d+)?$/.test(str);
    if (!isPureNumber) {
      return "'" + str;
    }
  }
  return str;
}

function formatDate(val: any): string {
  if (!val) return "";
  const str = String(val).slice(0, 10);
  const parts = str.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return str;
}

export async function renderXlsx(dataset: ExportDatasetResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Star Mould ERP";
  workbook.lastModifiedBy = "Star Mould ERP";
  workbook.created = new Date();
  workbook.modified = new Date();

  const isHierarchicalMoulds =
    dataset.rows.length > 0 && Array.isArray(dataset.rows[0].subplates);

  if (isHierarchicalMoulds) {
    await renderHierarchicalMouldSheet(workbook, dataset);
  } else {
    await renderStandardFlatSheet(workbook, dataset);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 2-Tier Hierarchical Sheet (Moulds + Nested Subplates)
 * Color-corrected, enterprise styling, clean borders, freeze panes
 */
async function renderHierarchicalMouldSheet(
  workbook: ExcelJS.Workbook,
  dataset: ExportDatasetResult
) {
  const ws = workbook.addWorksheet("Mould Projects", {
    views: [{ state: "frozen", ySplit: 2, showGridLines: true }],
  });

  // Common Palette
  const fillHeader1: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Deep Navy / Slate 800
  };
  const fillHeader2: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" }, // Slate 700
  };
  const fillMouldBanner: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" }, // Soft Elegant Slate / Gray
  };
  const fillZebraOdd: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  const fillZebraEven: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  const fillSubtotal: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  const borderHairline: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  const borderMouldRow: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF94A3B8" } },
    bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    left: { style: "thin", color: { argb: "FFCBD5E1" } },
    right: { style: "thin", color: { argb: "FFCBD5E1" } },
  };

  const borderSubtotal: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFCBD5E1" } },
    bottom: { style: "double", color: { argb: "FF94A3B8" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  // Define Column Dimensions
  ws.columns = [
    { key: "colA", width: 14 }, // Received Dt
    { key: "colB", width: 28 }, // Customer Name / Plate Name
    { key: "colC", width: 26 }, // Mould/Part Name / Subproject
    { key: "colD", width: 18 }, // Mould / Shape
    { key: "colE", width: 16 }, // Worktype / Material
    { key: "colF", width: 11 }, // W(OD)
    { key: "colG", width: 11 }, // H(ID)
    { key: "colH", width: 11 }, // Length
    { key: "colI", width: 13 }, // Weight
    { key: "colJ", width: 9 },  // Unit
    { key: "colK", width: 9 },  // Qty
  ];

  // Row 1: Parent Mould Header
  const row1 = ws.addRow([
    "Received Dt",
    "Customer Name",
    "Mould/Part Name",
    "Mould Code",
    "Worktype",
    "", "", "", "", "", ""
  ]);
  row1.height = 26;
  for (let c = 1; c <= 11; c++) {
    const cell = row1.getCell(c);
    cell.fill = fillHeader1;
    cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: c === 1 ? "center" : "left" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  }

  // Row 2: Child Subplate Header
  const row2 = ws.addRow([
    "",
    "Plate Name",
    "Subproject",
    "Shape",
    "Material",
    "W(OD)",
    "H(ID)",
    "Length",
    "Weight",
    "Unit",
    "Qty"
  ]);
  row2.height = 24;
  for (let c = 1; c <= 11; c++) {
    const cell = row2.getCell(c);
    cell.fill = fillHeader2;
    cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FFF8FAFC" } };
    const isNum = c >= 6 && c <= 9;
    const isCenter = c === 4 || c === 10 || c === 11;
    cell.alignment = {
      vertical: "middle",
      horizontal: isNum ? "right" : isCenter ? "center" : "left"
    };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF1E293B" } },
      right: { style: "thin", color: { argb: "FF475569" } },
    };
  }

  // Row 3: Blank separator
  const row3 = ws.addRow(["", "", "", "", "", "", "", "", "", "", ""]);
  row3.height = 8;

  // Render Data
  for (const mould of dataset.rows) {
    const subplates = Array.isArray(mould.subplates) ? mould.subplates : [];

    // Mould Banner Row
    const mouldRow = ws.addRow([
      formatDate(mould.rdate),
      sanitizeCellString(mould.customername),
      sanitizeCellString(mould.description),
      sanitizeCellString(mould.projectid),
      sanitizeCellString(mould.worktype),
      "", "", "", "", "", ""
    ]);
    mouldRow.height = 24;

    for (let c = 1; c <= 11; c++) {
      const cell = mouldRow.getCell(c);
      cell.fill = fillMouldBanner;
      cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: c === 1 || c === 5 ? "center" : "left",
      };
      cell.border = borderMouldRow;
    }

    // Subplates Rows
    let totalWeight = 0;
    let totalQty = 0;

    if (subplates.length > 0) {
      subplates.forEach((sp: any, spIdx: number) => {
        const isEven = spIdx % 2 === 1;
        const fill = isEven ? fillZebraEven : fillZebraOdd;

        const w = sp.width != null ? Number(sp.width) : null;
        const h = sp.height != null ? Number(sp.height) : null;
        const l = sp.length != null ? Number(sp.length) : null;
        const wt = sp.weight != null ? Number(sp.weight) : null;
        const qty = sp.sqty != null ? Number(sp.sqty) : 1;

        if (wt != null && !isNaN(wt)) totalWeight += wt;
        if (qty != null && !isNaN(qty)) totalQty += qty;

        const spRow = ws.addRow([
          "",
          sanitizeCellString(sp.platename),
          sanitizeCellString(sp.subprojectid),
          sanitizeCellString(sp.shape),
          sanitizeCellString(sp.material),
          w != null ? w : "",
          h != null ? h : "",
          l != null ? l : "",
          wt != null ? wt : "",
          sanitizeCellString(sp.unit || "mm"),
          qty,
        ]);
        spRow.height = 20;

        for (let c = 1; c <= 11; c++) {
          const cell = spRow.getCell(c);
          cell.fill = fill;
          cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF1E293B" } };
          cell.border = borderHairline;

          if (c >= 6 && c <= 8) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0.##";
          } else if (c === 9) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0.000";
          } else if (c === 10) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (c === 11) {
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.numFmt = "#,##0";
          } else if (c === 4) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }
        }
      });

      // Subtotal Row
      const subtotalRow = ws.addRow([
        "",
        `Total (${subplates.length} plates)`,
        "", "", "", "", "", "",
        totalWeight > 0 ? totalWeight : "",
        "kg",
        totalQty,
      ]);
      subtotalRow.height = 20;

      for (let c = 1; c <= 11; c++) {
        const cell = subtotalRow.getCell(c);
        cell.fill = fillSubtotal;
        cell.font = { name: "Segoe UI", size: 9.5, bold: true, color: { argb: "FF334155" } };
        cell.border = borderSubtotal;

        if (c === 2) {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        } else if (c === 9) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0.000";
        } else if (c === 10) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else if (c === 11) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0";
        }
      }
    } else {
      const emptyRow = ws.addRow([
        "",
        "No subplates registered",
        "", "", "", "", "", "", "", "", ""
      ]);
      emptyRow.height = 20;
      for (let c = 1; c <= 11; c++) {
        const cell = emptyRow.getCell(c);
        cell.fill = fillZebraOdd;
        cell.font = { name: "Segoe UI", size: 9, italic: true, color: { argb: "FF94A3B8" } };
        cell.border = borderHairline;
      }
    }

    // Blank row separator between mould projects
    const spacer = ws.addRow(["", "", "", "", "", "", "", "", "", "", ""]);
    spacer.height = 10;
  }
}

/**
 * Standard 1-Tier Flat Sheet
 * Polished enterprise styling for tables without subplates
 */
async function renderStandardFlatSheet(
  workbook: ExcelJS.Workbook,
  dataset: ExportDatasetResult
) {
  const ws = workbook.addWorksheet(dataset.title || "Export", {
    views: [{ state: "frozen", ySplit: 1, showGridLines: true }],
  });

  const fillHeader: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" }, // Deep Navy
  };
  const fillZebraOdd: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
  };
  const fillZebraEven: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  const borderHairline: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  // Header Row
  const headerLabels = dataset.columns.map((col) => col.header);
  const headerRow = ws.addRow(headerLabels);
  headerRow.height = 26;

  for (let c = 1; c <= dataset.columns.length; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = fillHeader;
    cell.font = { name: "Segoe UI", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  }

  // Data Rows
  dataset.rows.forEach((row, rIdx) => {
    const isEven = rIdx % 2 === 1;
    const fill = isEven ? fillZebraEven : fillZebraOdd;

    const rowValues = dataset.columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return "";
      if (col.type === "number" || col.type === "currency") {
        const num = Number(val);
        return isNaN(num) ? sanitizeCellString(val) : num;
      }
      if (col.type === "date") {
        return formatDate(val);
      }
      return sanitizeCellString(val);
    });

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 21;

    for (let c = 1; c <= dataset.columns.length; c++) {
      const colDef = dataset.columns[c - 1];
      const cell = dataRow.getCell(c);
      cell.fill = fill;
      cell.font = { name: "Segoe UI", size: 9.5, color: { argb: "FF1E293B" } };
      cell.border = borderHairline;

      if (colDef.type === "currency") {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "₹#,##0.00";
      } else if (colDef.type === "number") {
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = "#,##0.##";
      } else if (colDef.type === "date" || colDef.type === "status") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      } else {
        cell.alignment = { vertical: "middle", horizontal: "left" };
      }
    }
  });

  // Column Widths
  ws.columns = dataset.columns.map((col) => {
    const minW = Math.max(col.header.length, col.width || 12);
    return { width: minW + 4 };
  });
}

export function renderCsv(dataset: ExportDatasetResult): Buffer {
  const isHierarchicalMoulds =
    dataset.rows.length > 0 && Array.isArray(dataset.rows[0].subplates);

  if (isHierarchicalMoulds) {
    const lines: string[] = [
      `"Received Dt","Customer Name","Mould/Part Name","Mould Code","Worktype"`,
      `"","Plate Name","Subproject","Shape","Material","W(OD)","H(ID)","Length","Weight","Unit","Qty"`,
      `""`,
    ];

    for (const m of dataset.rows) {
      lines.push(
        `"${formatDate(m.rdate)}","${sanitizeCellString(m.customername)}","${sanitizeCellString(m.description)}","${sanitizeCellString(m.projectid)}","${sanitizeCellString(m.worktype)}"`
      );
      const subplates = Array.isArray(m.subplates) ? m.subplates : [];
      for (const sp of subplates) {
        lines.push(
          `"","${sanitizeCellString(sp.platename)}","${sanitizeCellString(sp.subprojectid)}","${sanitizeCellString(sp.shape)}","${sanitizeCellString(sp.material)}","${sp.width ?? ""}","${sp.height ?? ""}","${sp.length ?? ""}","${sp.weight ?? ""}","${sp.unit ?? "mm"}","${sp.sqty ?? 1}"`
        );
      }
      lines.push(`""`);
    }

    return Buffer.from(lines.join("\r\n"), "utf-8");
  }

  const headerLabels = dataset.columns.map((col) => `"${col.header.replace(/"/g, '""')}"`);
  const lines: string[] = [headerLabels.join(",")];

  for (const row of dataset.rows) {
    const rowValues = dataset.columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return '""';
      const sanitized = sanitizeCellString(val);
      return `"${String(sanitized).replace(/"/g, '""')}"`;
    });
    lines.push(rowValues.join(","));
  }

  return Buffer.from(lines.join("\r\n"), "utf-8");
}
