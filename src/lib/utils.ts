import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export function formatDateTimeIST(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return String(dateStr);
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(d) + " IST"
    );
  } catch {
    return String(dateStr);
  }
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "₹0.00";
  const num = Number(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Escapes characters with special meaning in HTML to prevent XSS and HTML injection.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes a single cell value for CSV export according to RFC 4180 and OWASP Formula Injection guidelines.
 */
export function formatCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";

  // Safe numbers
  if (typeof val === "number") {
    return isNaN(val) ? "" : String(val);
  }

  const str = String(val);
  if (str.length === 0) return "";

  // Check if the trimmed value is a legitimate numeric literal (including negative currency balances)
  const trimmed = str.trim();
  const isNumericLiteral = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/.test(trimmed);
  if (isNumericLiteral) {
    return trimmed;
  }

  let sanitized = str;
  const leadingTrimmed = str.trimStart();
  const firstChar = leadingTrimmed.charAt(0);

  // Neutralize formula injection: =, @, \t, \r, or non-numeric + and -
  if (
    firstChar === "=" ||
    firstChar === "@" ||
    firstChar === "\t" ||
    firstChar === "\r" ||
    firstChar === "+" ||
    firstChar === "-"
  ) {
    sanitized = `'${str}`;
  }

  // RFC 4180: If contains quotes, commas, newlines, or leading sanitization quote, wrap in quotes
  if (
    sanitized.includes('"') ||
    sanitized.includes(",") ||
    sanitized.includes("\n") ||
    sanitized.includes("\r") ||
    sanitized.startsWith("'")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * Downloads tabular data as an RFC 4180 compliant CSV file with UTF-8 BOM and formula injection protection.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): void {
  const headerLine = headers.map(formatCsvCell).join(",");
  const rowLines = rows.map((row) => row.map(formatCsvCell).join(","));
  const csvContent = "\uFEFF" + [headerLine, ...rowLines].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
