/**
 * Indian GST Financial Calculation Engine
 * 
 * Rules:
 * 1. Standard 18% GST: All quotes are calculated at a standard 18% GST (or 0% GST Free if exempt).
 * 2. No CGST / SGST / IGST split is exposed on the quote, keeping the quote clean, professional, and unambiguous.
 * 3. Exact 2-decimal paise arithmetic:
 *    - Taxable Amount = sum of line totals
 *    - GST (18%) = round(Taxable Amount * 18 / 100)
 *    - Grand Total = Taxable Amount + GST
 * 4. GST Free: GST = 0, Grand Total = Taxable Amount.
 */

export type TaxType = "gst_18" | "exempt" | "cgst_sgst" | "igst";

export interface GSTCalculationResult {
  taxableAmount: number;
  taxRate: number;
  taxType: TaxType;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  grandTotal: number;
  taxablePaise: number;
  gstPaise: number;
  grandTotalPaise: number;
}

export interface ItemCalculationInput {
  qty?: number | string;
  unit_price?: number | string;
  total_amount?: number | string;
}

export function calculateLineTotal(qty: number | string, unitPrice: number | string): number {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

export function calculateGST(
  items: ItemCalculationInput[],
  taxType: TaxType,
  _taxRate: number = 18
): GSTCalculationResult {
  let taxablePaise = 0;
  for (const item of items) {
    let linePaise: number;
    if (item.total_amount !== undefined && item.total_amount !== null && item.total_amount !== "") {
      linePaise = Math.round(Number(item.total_amount) * 100);
    } else {
      const q = Number(item.qty) || 0;
      const p = Number(item.unit_price) || 0;
      linePaise = Math.round(q * p * 100);
    }
    if (!isNaN(linePaise)) {
      taxablePaise += linePaise;
    }
  }

  if (taxType === "exempt") {
    const grandTotalPaise = taxablePaise;
    return {
      taxableAmount: taxablePaise / 100,
      taxRate: 0,
      taxType: "exempt",
      gstAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      grandTotal: grandTotalPaise / 100,
      taxablePaise,
      gstPaise: 0,
      grandTotalPaise,
    };
  }

  // Standard 18% GST
  const gstPaise = Math.round((taxablePaise * 18) / 100);
  const grandTotalPaise = taxablePaise + gstPaise;
  const halfPaise = Math.round(gstPaise / 2);

  return {
    taxableAmount: taxablePaise / 100,
    taxRate: 18,
    taxType: "gst_18",
    gstAmount: gstPaise / 100,
    cgstAmount: halfPaise / 100,
    sgstAmount: (gstPaise - halfPaise) / 100,
    igstAmount: gstPaise / 100,
    grandTotal: grandTotalPaise / 100,
    taxablePaise,
    gstPaise,
    grandTotalPaise,
  };
}

export function formatINRTwoDecimals(val?: number | string | null): string {
  if (val === undefined || val === null || val === "") return "0.00";
  const num = Number(val);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
