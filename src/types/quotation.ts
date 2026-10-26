export interface QuotationItem {
  id?: number;
  quotation_id?: number;
  sr_no: number;
  product_description: string;
  qty: number;
  unit: string;
  unit_price: number;
  total_amount: number;
}

export interface Quotation {
  id: number;
  quotation_no: string;
  quotation_date: string;
  customer_id?: number | null;
  consignee_name: string;
  consignee_address?: string | null;
  consignee_gstin?: string | null;
  consignee_pan?: string | null;
  consignee_phone?: string | null;
  consignee_email?: string | null;
  state_code?: string;
  subject?: string | null;
  reference?: string | null;
  tax_type: "gst_18" | "exempt" | "cgst_sgst" | "igst";
  tax_rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  grand_total: number;
  amount_in_words?: string | null;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  bank_address?: string;
  price_terms?: string;
  delivery_terms?: string;
  payment_terms?: string;
  validity_terms?: string;
  order_confirmation?: string;
  warranty_terms?: string;
  jurisdiction_terms?: string;
  force_majeure?: string;
  notes?: string | null;
  include_digital_stamp: boolean;
  status: "Draft" | "Sent" | "Accepted" | "Rejected" | "Expired";
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  items?: QuotationItem[];
}

export type TermType = "price" | "delivery" | "payment" | "validity" | "force_majeure";

export interface QuotationTermsPreset {
  id: number;
  term_type: TermType;
  title: string;
  content: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}
