/**
 * Indian GST Financial Calculation Engine
 * 
 * Rules:
 * 1. Intrastate (Within Gujarat / state code 24 or cgst_sgst):
 *    - 9% CGST + 9% SGST, 0% IGST.
 *    - Total GST = 18%.
 * 2. Interstate (Outside Gujarat / IGST):
 *    - 18% IGST, 0% CGST, 0% SGST.
 *    - Total GST = 18%.
 * 3. Exempt (GST Free):
 *    - 0% GST, Grand Total = Taxable Amount.
 * 4. Exact 2-decimal paise arithmetic with penny-rounding balance:
 *    - Taxable Amount = sum of line totals - discount
 *    - GST (18%) = round(Taxable Amount * 18 / 100)
 *    - Grand Total = Taxable Amount + GST
 */

export type TaxType = "gst_18" | "exempt" | "cgst_sgst" | "igst";

export interface GSTCalculationResult {
  subtotalAmount: number;
  discountAmount: number;
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
  taxRate: number = 18,
  discount: number = 0
): GSTCalculationResult {
  let subtotalPaise = 0;
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
      subtotalPaise += linePaise;
    }
  }

  const discountPaise = Math.round((Number(discount) || 0) * 100);
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise);

  if (taxType === "exempt") {
    const grandTotalPaise = taxablePaise;
    return {
      subtotalAmount: subtotalPaise / 100,
      discountAmount: discountPaise / 100,
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

  const effectiveRate = taxRate > 0 ? taxRate : 18;
  const gstPaise = Math.round((taxablePaise * effectiveRate) / 100);
  const grandTotalPaise = taxablePaise + gstPaise;

  if (taxType === "igst") {
    // Interstate: 18% IGST only, 0% CGST, 0% SGST
    return {
      subtotalAmount: subtotalPaise / 100,
      discountAmount: discountPaise / 100,
      taxableAmount: taxablePaise / 100,
      taxRate: effectiveRate,
      taxType: "igst",
      gstAmount: gstPaise / 100,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: gstPaise / 100,
      grandTotal: grandTotalPaise / 100,
      taxablePaise,
      gstPaise,
      grandTotalPaise,
    };
  }

  // Intrastate (cgst_sgst or gst_18): 9% CGST + 9% SGST, 0% IGST
  const halfPaise = Math.round(gstPaise / 2);
  return {
    subtotalAmount: subtotalPaise / 100,
    discountAmount: discountPaise / 100,
    taxableAmount: taxablePaise / 100,
    taxRate: effectiveRate,
    taxType: taxType === "cgst_sgst" ? "cgst_sgst" : "gst_18",
    gstAmount: gstPaise / 100,
    cgstAmount: halfPaise / 100,
    sgstAmount: (gstPaise - halfPaise) / 100,
    igstAmount: 0,
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
