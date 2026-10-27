"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Settings, Sparkles, Building2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Quotation, QuotationItem, QuotationTermsPreset } from "@/types/quotation";
import { TermsPresetModal, TermCategory } from "./terms-preset-modal";
import { amountInWords } from "@/lib/number-to-words";
import { calculateGST, formatINRTwoDecimals, type TaxType } from "@/lib/gst-calculation";
import { CustomerSelect } from "@/components/ui/customer-select";
import { QuickCustomerModal } from "./quick-customer-modal";
import { useCustomerDropdownQuery } from "@/lib/query/hooks";
import type { Customer } from "@/lib/supabase/types";

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialQuotation?: Quotation | null;
}


interface AutoResizingTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  disabled?: boolean;
  required?: boolean;
}

const AutoResizingTextarea: React.FC<AutoResizingTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 80,
  disabled = false,
  required = false,
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const adjustHeight = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.minHeight = "0px";
    el.style.height = "auto";
    const targetHeight = Math.max(el.scrollHeight, minHeight);
    el.style.height = `${targetHeight}px`;
    el.style.minHeight = `${minHeight}px`;
  }, [minHeight]);

  React.useEffect(() => {
    adjustHeight();
    const timer = setTimeout(adjustHeight, 50);
    return () => clearTimeout(timer);
  }, [value, adjustHeight]);

  React.useEffect(() => {
    window.addEventListener("resize", adjustHeight);
    return () => window.removeEventListener("resize", adjustHeight);
  }, [adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      required={required}
      disabled={disabled}
      onFocus={adjustHeight}
      onChange={(e) => {
        onChange(e.target.value);
        adjustHeight();
      }}
      placeholder={placeholder}
      className={className}
    />
  );
};

export const QuotationModal: React.FC<QuotationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialQuotation,
}) => {
  const isEdit = Boolean(initialQuotation?.id);

  // Real-time customers from database
  const customerDropdown = useCustomerDropdownQuery("Customer");
  const customerList = (customerDropdown.data as Customer[]) || [];

  // Form State
  const [quotationNo, setQuotationNo] = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [consigneeName, setConsigneeName] = useState("");
  const [consigneeAddress, setConsigneeAddress] = useState("");
  const [consigneeGstin, setConsigneeGstin] = useState("");
  const [consigneePan, setConsigneePan] = useState("");
  const [consigneePhone, setConsigneePhone] = useState("");
  const [consigneeEmail, setConsigneeEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Quick Customer Creation
  const [isQuickCustomerOpen, setIsQuickCustomerOpen] = useState(false);
  const [quickCustomerInitialName, setQuickCustomerInitialName] = useState("");

  // Items
  const [items, setItems] = useState<any[]>([
    { sr_no: 1, product_name: "", description: "", product_description: "", qty: 1, unit: "Nos", unit_price: "", total_amount: 0 },
  ]);

  // Tax & Discount
  const [taxType, setTaxType] = useState<TaxType>("gst_18");
  const [discountAmount, setDiscountAmount] = useState<number | string>(0);

  // Bank
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [bankName, setBankName] = useState("Central Bank Of India");
  const [bankAccountNo, setBankAccountNo] = useState("5875819245");
  const [bankIfsc, setBankIfsc] = useState("CBIN0281313");
  const [bankBranch, setBankBranch] = useState("Saurashtra University Branch");
  const [bankAddress, setBankAddress] = useState("Saurashtra University Campus, Rajkot");

  // Terms
  const [showTermsDetails, setShowTermsDetails] = useState(false);
  const [priceTerms, setPriceTerms] = useState("Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance [extra at actuals / included].");
  const [deliveryTerms, setDeliveryTerms] = useState("[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.");
  const [paymentTerms, setPaymentTerms] = useState("[50% advance along with Purchase Order, balance 50% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.");
  const [validityTerms, setValidityTerms] = useState("This quotation is valid for [15] days from the date of issue. Prices and delivery are subject to change thereafter.");
  const [orderConfirmation, setOrderConfirmation] = useState("Manufacturing starts only after receipt of advance payment and a written Purchase Order.");
  const [warrantyTerms, setWarrantyTerms] = useState("[__ months] against manufacturing defects only; excludes misuse, mishandling, overloading or external damage.");
  const [jurisdictionTerms, setJurisdictionTerms] = useState("Subject to Rajkot, Gujarat jurisdiction only.");
  const [forceMajeure, setForceMajeure] = useState("This Clause Is Applicable.");

  // Terms toggle states (which ones to keep/exclude in the quotation & PDF)
  const [enablePrice, setEnablePrice] = useState(true);
  const [enableDelivery, setEnableDelivery] = useState(true);
  const [enablePayment, setEnablePayment] = useState(true);
  const [enableValidity, setEnableValidity] = useState(true);
  const [enableForceMajeure, setEnableForceMajeure] = useState(true);

  const [includeDigitalStamp, setIncludeDigitalStamp] = useState(true);
  const [status, setStatus] = useState<"Draft" | "Sent" | "Accepted" | "Rejected" | "Expired">("Draft");

  // Presets
  const [presets, setPresets] = useState<QuotationTermsPreset[]>([]);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presetModalTab, setPresetModalTab] = useState<TermCategory>("price");

  // Filter presets by term_type
  const pricePresets = presets.filter((p) => (p.term_type || "price") === "price");
  const deliveryPresets = presets.filter((p) => p.term_type === "delivery");
  const paymentPresets = presets.filter((p) => p.term_type === "payment");
  const validityPresets = presets.filter((p) => p.term_type === "validity");
  const forceMajeurePresets = presets.filter((p) => p.term_type === "force_majeure");

  // UI status
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load next number & presets
  useEffect(() => {
    if (!isOpen) return;

    // Load Presets
    fetch("/api/quotations/presets")
      .then((res) => res.json())
      .then((data) => {
        if (data.presets) {
          setPresets(data.presets);
          if (!initialQuotation) {
            const defaultPrice = data.presets.find((p: any) => p.term_type === "price" && p.is_default);
            if (defaultPrice) setPriceTerms(defaultPrice.content || "");

            const defaultDelivery = data.presets.find((p: any) => p.term_type === "delivery" && p.is_default);
            if (defaultDelivery) setDeliveryTerms(defaultDelivery.content || "");

            const defaultPayment = data.presets.find((p: any) => p.term_type === "payment" && p.is_default);
            if (defaultPayment) setPaymentTerms(defaultPayment.content || "");

            const defaultValidity = data.presets.find((p: any) => p.term_type === "validity" && p.is_default);
            if (defaultValidity) setValidityTerms(defaultValidity.content || "");

            const defaultForceMajeure = data.presets.find((p: any) => p.term_type === "force_majeure" && p.is_default);
            if (defaultForceMajeure) setForceMajeure(defaultForceMajeure.content || "");
          }
        }
      })
      .catch(() => {});

    if (initialQuotation) {
      // Populate edit mode
      setQuotationNo(initialQuotation.quotation_no || "");
      setQuotationDate(initialQuotation.quotation_date || new Date().toISOString().split("T")[0]);
      setCustomerId(initialQuotation.customer_id || null);
      setConsigneeName(initialQuotation.consignee_name || "");
      setConsigneeAddress(initialQuotation.consignee_address || "");
      setConsigneeGstin(initialQuotation.consignee_gstin || "");
      setConsigneePan(initialQuotation.consignee_pan || "");
      setConsigneePhone(initialQuotation.consignee_phone || "");
      setConsigneeEmail(initialQuotation.consignee_email || "");
      setNotes(initialQuotation.notes || "");
      setTaxType(initialQuotation.tax_type || "gst_18");
      setDiscountAmount(initialQuotation.discount_amount || 0);
      setBankName(initialQuotation.bank_name || "Central Bank Of India");
      setBankAccountNo(initialQuotation.bank_account_no || "5875819245");
      setBankIfsc(initialQuotation.bank_ifsc || "CBIN0281313");
      setBankBranch(initialQuotation.bank_branch || "Saurashtra University Branch");
      setBankAddress(initialQuotation.bank_address || "Saurashtra University Campus, Rajkot");
      setPriceTerms(initialQuotation.price_terms || "");
      setDeliveryTerms(initialQuotation.delivery_terms || "");
      setPaymentTerms(initialQuotation.payment_terms || "");
      setValidityTerms(initialQuotation.validity_terms || "");
      setOrderConfirmation(initialQuotation.order_confirmation || "");
      setWarrantyTerms(initialQuotation.warranty_terms || "");
      setJurisdictionTerms(initialQuotation.jurisdiction_terms || "");
      setForceMajeure(initialQuotation.force_majeure || "");
      setIncludeDigitalStamp(initialQuotation.include_digital_stamp !== false);
      setStatus(initialQuotation.status || "Draft");

      // Set toggle states based on whether text is present in existing quotation
      setEnablePrice(Boolean(initialQuotation.price_terms && initialQuotation.price_terms.trim()));
      setEnableDelivery(Boolean(initialQuotation.delivery_terms && initialQuotation.delivery_terms.trim()));
      setEnablePayment(Boolean(initialQuotation.payment_terms && initialQuotation.payment_terms.trim()));
      setEnableValidity(Boolean(initialQuotation.validity_terms && initialQuotation.validity_terms.trim()));
      setEnableForceMajeure(Boolean(initialQuotation.force_majeure && initialQuotation.force_majeure.trim()));

      if (initialQuotation.items && initialQuotation.items.length > 0) {
        setItems(
          initialQuotation.items.map((it, idx) => ({
            ...it,
            product_name: it.product_name ?? it.product_description ?? "",
            description: it.description ?? "",
            unit_price: it.unit_price === 0 ? "" : it.unit_price,
            sr_no: idx + 1,
          }))
        );
      }
    } else {
      // New quote - fetch next auto-sequential number
      fetch("/api/quotations?action=next-number")
        .then((res) => res.json())
        .then((data) => {
          if (data.nextNumber) setQuotationNo(data.nextNumber);
        })
        .catch(() => {});

      // Reset
      setQuotationDate(new Date().toISOString().split("T")[0]);
      setCustomerId(null);
      setConsigneeName("");
      setConsigneeAddress("");
      setConsigneeGstin("");
      setConsigneePan("");
      setConsigneePhone("");
      setConsigneeEmail("");
      setNotes("");
      setTaxType("gst_18");
      setDiscountAmount(0);
      setItems([{ sr_no: 1, product_name: "", description: "", product_description: "", qty: 1, unit: "Nos", unit_price: "", total_amount: 0 }]);
      setStatus("Draft");
      setIncludeDigitalStamp(true);
      setEnablePrice(true);
      setEnableDelivery(true);
      setEnablePayment(true);
      setEnableValidity(true);
      setEnableForceMajeure(true);
    }

    setErrorMsg(null);
  }, [isOpen, initialQuotation]);

  // Handle ESC key to close modal (only if child modals are not open)
  useEffect(() => {
    if (!isOpen || isQuickCustomerOpen || isPresetModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isQuickCustomerOpen, isPresetModalOpen, onClose]);

  if (!isOpen) return null;

  const applyPreset = (preset: QuotationTermsPreset) => {
    const text = preset.content || "";
    if (preset.term_type === "price") {
      setPriceTerms(text);
      setEnablePrice(true);
    } else if (preset.term_type === "delivery") {
      setDeliveryTerms(text);
      setEnableDelivery(true);
    } else if (preset.term_type === "payment") {
      setPaymentTerms(text);
      setEnablePayment(true);
    } else if (preset.term_type === "validity") {
      setValidityTerms(text);
      setEnableValidity(true);
    } else if (preset.term_type === "force_majeure") {
      setForceMajeure(text);
      setEnableForceMajeure(true);
    }
  };

  const handleSelectCustomer = async (c: any) => {
    if (!c) return;
    setCustomerId(c.id);
    setConsigneeName(c.customername || "");
    const addr = [c.address, c.city].filter(Boolean).join(", ");
    setConsigneeAddress(addr);
    setConsigneeGstin(c.gstin || "");
    setConsigneePan(c.pan || "");
    setConsigneePhone(c.mobile || c.mobile1 || "");
    setConsigneeEmail(c.email || "");

    // Automatically fetch full fresh profile by ID and fallback to previous quotation
    try {
      if (c.id) {
        const res = await fetch(`/api/customers?id=${c.id}`);
        if (res.ok) {
          const data = await res.json();
          const full = data.customer || data.data;
          if (full) {
            const freshAddr = [full.address, full.city].filter(Boolean).join(", ");
            if (freshAddr) setConsigneeAddress(freshAddr);
            if (full.gstin) setConsigneeGstin(full.gstin);
            if (full.pan) setConsigneePan(full.pan);
            if (full.mobile || full.mobile1) setConsigneePhone(full.mobile || full.mobile1);
            if (full.email) setConsigneeEmail(full.email);
          }
        }
      }

      // Check if previous quotation exists for this customer to fill any remaining empty fields
      if (c.customername) {
        const quoteRes = await fetch(`/api/quotations?search=${encodeURIComponent(c.customername)}&limit=1`);
        if (quoteRes.ok) {
          const qData = await quoteRes.json();
          const prevQuote = qData.quotations?.[0];
          if (prevQuote) {
            setConsigneeAddress((cur) => cur || prevQuote.consignee_address || "");
            setConsigneeGstin((cur) => cur || prevQuote.consignee_gstin || "");
            setConsigneePan((cur) => cur || prevQuote.consignee_pan || "");
            setConsigneePhone((cur) => cur || prevQuote.consignee_phone || "");
            setConsigneeEmail((cur) => cur || prevQuote.consignee_email || "");
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch extended customer details:", err);
    }
  };

  const handleQuickCustomerCreated = (newCustomer: Customer) => {
    handleSelectCustomer(newCustomer);
    setIsQuickCustomerOpen(false);
  };

  // Item management
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    if (field === "product_name" || field === "description") {
      const pName = field === "product_name" ? value : (item.product_name || "");
      const desc = field === "description" ? value : (item.description || "");
      item.product_description = desc ? `${pName}\n${desc}` : pName;
    }

    if (field === "qty" || field === "unit_price") {
      const q = Number(item.qty) || 0;
      const p = Number(item.unit_price) || 0;
      item.total_amount = Math.round(q * p * 100) / 100;
    }

    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { sr_no: items.length + 1, product_name: "", description: "", product_description: "", qty: 1, unit: "Nos", unit_price: "", total_amount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const updated = items.filter((_, i) => i !== index).map((it, idx) => ({ ...it, sr_no: idx + 1 }));
    setItems(updated);
  };

  // Totals calculations via Indian GST Calculation Engine
  const { taxableAmount, gstAmount, cgstAmount, sgstAmount, igstAmount, grandTotal, subtotalAmount } = calculateGST(
    items,
    taxType,
    taxType === "exempt" ? 0 : 18,
    Number(discountAmount) || 0
  );
  const inWords = amountInWords(grandTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consigneeName.trim()) {
      setErrorMsg("Please select a customer from the customer list.");
      return;
    }
    if (items.length === 0 || !items.some((it) => (it.product_name?.trim() || it.product_description?.trim()))) {
      setErrorMsg("Please add at least one item with a product title.");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);

      const payload = {
        id: initialQuotation?.id,
        quotation_no: quotationNo.trim(),
        quotation_date: quotationDate,
        customer_id: customerId,
        consignee_name: consigneeName.trim(),
        consignee_address: consigneeAddress,
        consignee_gstin: consigneeGstin,
        consignee_pan: consigneePan,
        consignee_phone: consigneePhone,
        consignee_email: consigneeEmail,
        tax_type: taxType,
        tax_rate: taxType === "exempt" ? 0 : 18,
        discount_amount: Number(discountAmount) || 0,
        taxable_amount: taxableAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        grand_total: grandTotal,
        bank_name: bankName,
        bank_account_no: bankAccountNo,
        bank_ifsc: bankIfsc,
        bank_branch: bankBranch,
        bank_address: bankAddress,
        price_terms: enablePrice ? priceTerms : "",
        delivery_terms: enableDelivery ? deliveryTerms : "",
        payment_terms: enablePayment ? paymentTerms : "",
        validity_terms: enableValidity ? validityTerms : "",
        order_confirmation: orderConfirmation,
        warranty_terms: warrantyTerms,
        jurisdiction_terms: jurisdictionTerms,
        force_majeure: enableForceMajeure ? forceMajeure : "",
        notes: notes.trim() || null,
        include_digital_stamp: includeDigitalStamp,
        status,
        items: items.map((it) => ({
          ...it,
          qty: Number(it.qty) || 0,
          unit_price: Number(it.unit_price) || 0,
          total_amount: Number(it.total_amount) || 0,
        })),
      };

      const res = await fetch("/api/quotations", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save quotation");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 backdrop-blur-xs flex sm:items-center sm:justify-center p-0 sm:p-3 md:p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  {isEdit ? `Edit Quotation (${quotationNo})` : "Create Quotation"}
                </h2>
                <p className="text-xs text-slate-500">
                  Official quotation with terms & bank details
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 space-y-5 sm:space-y-6">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {errorMsg}
              </div>
            )}

            {/* TOP BAR: Quotation No, Date, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quotation No
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={quotationNo}
                    className="w-full min-w-0 max-w-full h-[38px] pl-3 pr-8 py-2 text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded-lg cursor-not-allowed select-all focus:outline-hidden shadow-2xs"
                    placeholder="Generating..."
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Date</label>
                <input
                  type="date"
                  required
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full min-w-0 max-w-full h-[38px] px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs text-slate-800"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <div className="relative">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className={`w-full min-w-0 max-w-full h-[38px] pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border appearance-none cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-2xs transition-colors ${
                      status === "Draft"
                        ? "bg-slate-50 border-slate-300 text-slate-700"
                        : status === "Sent"
                        ? "bg-blue-50/60 border-blue-200 text-blue-700"
                        : status === "Accepted"
                        ? "bg-emerald-50/60 border-emerald-200 text-emerald-700"
                        : status === "Rejected"
                        ? "bg-rose-50/60 border-rose-200 text-rose-700"
                        : "bg-amber-50/60 border-amber-200 text-amber-700"
                    }`}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* CUSTOMER DETAILS */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" /> Customer Details
                </span>
                <span className="text-[11px] text-slate-500">Quotation To</span>
              </div>

              {/* Customer Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <CustomerSelect
                  customers={customerList}
                  value={customerId ? String(customerId) : ""}
                  onChange={(cId, cust) => {
                    if (cust) {
                      handleSelectCustomer(cust);
                    } else if (cId) {
                      const found = customerList.find((c) => String(c.id) === String(cId));
                      if (found) {
                        handleSelectCustomer(found);
                      } else {
                        handleSelectCustomer({ id: Number(cId) });
                      }
                    } else {
                      setCustomerId(null);
                      setConsigneeName("");
                      setConsigneeAddress("");
                      setConsigneeGstin("");
                      setConsigneePan("");
                      setConsigneePhone("");
                      setConsigneeEmail("");
                    }
                  }}
                  onAddNew={(initialQuery) => {
                    setQuickCustomerInitialName(initialQuery || "");
                    setIsQuickCustomerOpen(true);
                  }}
                  placeholder="Select customer..."
                  filterUserType="Customer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={consigneeAddress}
                  onChange={(e) => setConsigneeAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="Customer address..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={consigneeGstin}
                    onChange={(e) => setConsigneeGstin(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 24ABAFV3901A1ZV"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN</label>
                  <input
                    type="text"
                    value={consigneePan}
                    onChange={(e) => setConsigneePan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. ABAFV3901A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={consigneePhone}
                    onChange={(e) => setConsigneePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={consigneeEmail}
                    onChange={(e) => setConsigneeEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Email address"
                  />
                </div>
              </div>
            </div>


            {/* PARTICULARS / PRODUCTS TABLE */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Product Details ({items.length})
                  </span>
                  <span className="text-[11px] text-slate-500 hidden sm:block">
                    Add products, services, or tooling particulars
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {/* MOBILE VIEW: Stacked Card Layout (Zero Horizontal Scroll) */}
              <div className="sm:hidden space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold inline-flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          Item #{index + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900 bg-slate-50 px-2.5 py-0.5 rounded-md border border-slate-200">
                          ₹ {formatINRTwoDecimals(item.total_amount)}
                        </span>
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 cursor-pointer transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Product Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.product_name ?? item.product_description ?? ""}
                          onChange={(e) => handleItemChange(index, "product_name", e.target.value)}
                          placeholder="Product Name / Title (e.g. Mould 1)..."
                          className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Specifications / Description <span className="text-[10px] font-normal text-slate-400">(optional)</span>
                        </label>
                        <AutoResizingTextarea
                          value={item.description || ""}
                          onChange={(val) => handleItemChange(index, "description", val)}
                          placeholder="Detailed description, specifications, cavity info..."
                          minHeight={42}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-y"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Qty *
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs text-center border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                          placeholder="Nos"
                          className="w-full px-2.5 py-1.5 text-xs text-center border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Rate (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unit_price ?? ""}
                          onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 text-xs text-right border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Amount (₹)
                        </label>
                        <div className="w-full px-2.5 py-1.5 text-xs text-right bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 flex items-center justify-end h-[34px]">
                          ₹ {formatINRTwoDecimals(item.total_amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP / TABLET VIEW: Compact Table */}
              <div className="hidden sm:block border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-xs min-w-[650px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-10">#</th>
                      <th className="py-2.5 px-3 text-left min-w-[260px]">Product Title &amp; Description *</th>
                      <th className="py-2.5 px-2 text-center w-20">Qty</th>
                      <th className="py-2.5 px-2 text-center w-20">Unit</th>
                      <th className="py-2.5 px-2 text-right w-24">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right w-28">Amount (₹)</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-500 align-top">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3 align-top space-y-1.5">
                          <input
                            type="text"
                            required
                            value={item.product_name ?? item.product_description ?? ""}
                            onChange={(e) => handleItemChange(index, "product_name", e.target.value)}
                            placeholder="Product Title (e.g. Mould 1) *"
                            className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                          <AutoResizingTextarea
                            value={item.description || ""}
                            onChange={(val) => handleItemChange(index, "description", val)}
                            placeholder="Detailed description / specifications (optional)..."
                            minHeight={36}
                            className="w-full px-2.5 py-1 text-[11px] text-slate-600 border border-slate-200 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-y"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs text-center border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, "unit", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs text-center border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            placeholder="Nos"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_price ?? ""}
                            onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 text-xs text-right border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 align-top pt-3.5">
                          ₹ {formatINRTwoDecimals(item.total_amount)}
                        </td>
                        <td className="py-2.5 px-2 text-center align-top pt-2.5">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TOTALS & TAX */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Tax Type
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="tax_type"
                      value="gst_18"
                      checked={taxType !== "exempt"}
                      onChange={() => setTaxType("gst_18")}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    GST (18%)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-emerald-700 cursor-pointer">
                    <input
                      type="radio"
                      name="tax_type"
                      value="exempt"
                      checked={taxType === "exempt"}
                      onChange={() => setTaxType("exempt")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    GST Free Quote (0%)
                  </label>
                </div>

                {taxType === "exempt" ? (
                  <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 inline-block">
                    ✓ GST Free Quote: No tax applicable (0% GST)
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    Standard 18% GST applies to this quotation.
                  </div>
                )}

                <div className="text-[11px] text-slate-500 pt-2 italic">
                  <strong>Amount in Words:</strong> {inWords}
                </div>

                <div className="pt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Custom Note / Remarks (Optional)
                    </label>
                    <span className={`text-[10px] font-mono ${notes.length > 200 ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                      {notes.length}/220 chars (max ~35 words)
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={220}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Delivery within 10 days of advance payment. Testing report attached."
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600 bg-white"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Note will appear on Page 2 under Amount in Words (limited to keep layout clean).
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 text-xs font-medium">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold text-slate-800">₹ {formatINRTwoDecimals(subtotalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 gap-2">
                  <span>Discount (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0.00"
                    value={discountAmount === 0 ? "" : discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-28 text-right px-2 py-1 border border-slate-300 rounded text-xs font-mono focus "
                  />
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Amount</span>
                  <span className="font-mono font-bold text-slate-800">₹ {formatINRTwoDecimals(taxableAmount)}</span>
                </div>

                {taxType === "exempt" ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax (GST Free)</span>
                    <span className="font-mono font-bold text-emerald-600">₹ 0.00</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-600">
                    <span>GST (18%)</span>
                    <span className="font-mono font-bold text-slate-800">₹ {formatINRTwoDecimals(gstAmount)}</span>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold text-blue-800">
                  <span>Grand Total</span>
                  <span className="font-mono text-base">₹ {formatINRTwoDecimals(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* TERMS & CONDITIONS PRESET ACCORDION */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="w-full flex justify-between items-center p-3 sm:p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors">
                <div
                  onClick={() => setShowTermsDetails(!showTermsDetails)}
                  className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                >
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Terms & Conditions
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">(5 Modular Clauses)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPresetModalTab("price");
                      setIsPresetModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" /> Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTermsDetails(!showTermsDetails)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showTermsDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {showTermsDetails && (
                <div className="p-3 sm:p-4 space-y-3.5 sm:space-y-4 bg-white">
                  <div className="text-[11px] text-slate-500 pb-1 border-b border-slate-100">
                    Toggle checkbox to include or exclude clauses for this quotation:
                  </div>

                  {/* 1. Price Terms */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    enablePrice
                      ? "bg-slate-50/70 border-slate-200/90 shadow-2xs"
                      : "bg-slate-50/30 border-dashed border-slate-200 opacity-60"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enablePrice}
                          onChange={(e) => setEnablePrice(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 inline-flex items-center justify-center text-[10px] shrink-0">1</span>
                          Price Terms
                        </span>
                        {!enablePrice && <span className="text-[10.5px] text-slate-400 font-medium italic">(Excluded from PDF)</span>}
                      </label>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                        <select
                          disabled={!enablePrice}
                          onChange={(e) => {
                            const p = pricePresets.find((pr) => String(pr.id) === e.target.value);
                            if (p) {
                              setPriceTerms(p.content);
                              setEnablePrice(true);
                            }
                          }}
                          className="flex-1 min-w-0 sm:w-64 max-w-full px-2.5 py-1.5 text-xs sm:text-[11px] bg-white border border-slate-300 text-slate-700 rounded-lg font-medium shadow-2xs hover:border-blue-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-40 truncate"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Price Option...</option>
                          {pricePresets.map((p) => (
                            <option key={p.id} value={p.id}>{p.title} {p.is_default ? "★" : ""}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetModalTab("price");
                            setIsPresetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer shrink-0 shadow-2xs"
                          title="Manage Price Presets"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {enablePrice && (
                      <AutoResizingTextarea
                        value={priceTerms}
                        onChange={setPriceTerms}
                        minHeight={84}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-blue-500 resize-y"
                        placeholder="Prices are in Indian Rupees (₹)..."
                      />
                    )}
                  </div>

                  {/* 2. Delivery Terms */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    enableDelivery
                      ? "bg-slate-50/70 border-slate-200/90 shadow-2xs"
                      : "bg-slate-50/30 border-dashed border-slate-200 opacity-60"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableDelivery}
                          onChange={(e) => setEnableDelivery(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 inline-flex items-center justify-center text-[10px] shrink-0">2</span>
                          Delivery Terms
                        </span>
                        {!enableDelivery && <span className="text-[10.5px] text-slate-400 font-medium italic">(Excluded from PDF)</span>}
                      </label>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                        <select
                          disabled={!enableDelivery}
                          onChange={(e) => {
                            const p = deliveryPresets.find((pr) => String(pr.id) === e.target.value);
                            if (p) {
                              setDeliveryTerms(p.content);
                              setEnableDelivery(true);
                            }
                          }}
                          className="flex-1 min-w-0 sm:w-64 max-w-full px-2.5 py-1.5 text-xs sm:text-[11px] bg-white border border-slate-300 text-slate-700 rounded-lg font-medium shadow-2xs hover:border-emerald-400 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer disabled:opacity-40 truncate"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Delivery Option...</option>
                          {deliveryPresets.map((p) => (
                            <option key={p.id} value={p.id}>{p.title} {p.is_default ? "★" : ""}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetModalTab("delivery");
                            setIsPresetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer shrink-0 shadow-2xs"
                          title="Manage Delivery Presets"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {enableDelivery && (
                      <AutoResizingTextarea
                        value={deliveryTerms}
                        onChange={setDeliveryTerms}
                        minHeight={84}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-emerald-500 resize-y"
                        placeholder="[__] days from receipt of a clear PO..."
                      />
                    )}
                  </div>

                  {/* 3. Payment Terms */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    enablePayment
                      ? "bg-slate-50/70 border-slate-200/90 shadow-2xs"
                      : "bg-slate-50/30 border-dashed border-slate-200 opacity-60"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enablePayment}
                          onChange={(e) => setEnablePayment(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 inline-flex items-center justify-center text-[10px] shrink-0">3</span>
                          Payment Terms
                        </span>
                        {!enablePayment && <span className="text-[10.5px] text-slate-400 font-medium italic">(Excluded from PDF)</span>}
                      </label>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                        <select
                          disabled={!enablePayment}
                          onChange={(e) => {
                            const p = paymentPresets.find((pr) => String(pr.id) === e.target.value);
                            if (p) {
                              setPaymentTerms(p.content);
                              setEnablePayment(true);
                            }
                          }}
                          className="flex-1 min-w-0 sm:w-64 max-w-full px-2.5 py-1.5 text-xs sm:text-[11px] bg-white border border-slate-300 text-slate-700 rounded-lg font-medium shadow-2xs hover:border-indigo-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-40 truncate"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Payment Option (e.g. 50/50, 70/30)...</option>
                          {paymentPresets.map((p) => (
                            <option key={p.id} value={p.id}>{p.title} {p.is_default ? "★" : ""}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetModalTab("payment");
                            setIsPresetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer shrink-0 shadow-2xs"
                          title="Manage Payment Presets"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {enablePayment && (
                      <AutoResizingTextarea
                        value={paymentTerms}
                        onChange={setPaymentTerms}
                        minHeight={84}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-y"
                        placeholder="[50% advance along with PO...]"
                      />
                    )}
                  </div>

                  {/* 4. Validity */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    enableValidity
                      ? "bg-slate-50/70 border-slate-200/90 shadow-2xs"
                      : "bg-slate-50/30 border-dashed border-slate-200 opacity-60"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableValidity}
                          onChange={(e) => setEnableValidity(e.target.checked)}
                          className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center text-[10px] shrink-0">4</span>
                          Validity
                        </span>
                        {!enableValidity && <span className="text-[10.5px] text-slate-400 font-medium italic">(Excluded from PDF)</span>}
                      </label>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                        <select
                          disabled={!enableValidity}
                          onChange={(e) => {
                            const p = validityPresets.find((pr) => String(pr.id) === e.target.value);
                            if (p) {
                              setValidityTerms(p.content);
                              setEnableValidity(true);
                            }
                          }}
                          className="flex-1 min-w-0 sm:w-64 max-w-full px-2.5 py-1.5 text-xs sm:text-[11px] bg-white border border-slate-300 text-slate-700 rounded-lg font-medium shadow-2xs hover:border-amber-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-40 truncate"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Validity Option...</option>
                          {validityPresets.map((p) => (
                            <option key={p.id} value={p.id}>{p.title} {p.is_default ? "★" : ""}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetModalTab("validity");
                            setIsPresetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer shrink-0 shadow-2xs"
                          title="Manage Validity Presets"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {enableValidity && (
                      <AutoResizingTextarea
                        value={validityTerms}
                        onChange={setValidityTerms}
                        minHeight={50}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-amber-500 resize-y"
                        placeholder="This quotation is valid for [15] days..."
                      />
                    )}
                  </div>

                  {/* 5. Force Majeure */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    enableForceMajeure
                      ? "bg-slate-50/70 border-slate-200/90 shadow-2xs"
                      : "bg-slate-50/30 border-dashed border-slate-200 opacity-60"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={enableForceMajeure}
                          onChange={(e) => setEnableForceMajeure(e.target.checked)}
                          className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-800 inline-flex items-center justify-center text-[10px] shrink-0">5</span>
                          Force Majeure
                        </span>
                        {!enableForceMajeure && <span className="text-[10.5px] text-slate-400 font-medium italic">(Excluded from PDF)</span>}
                      </label>
                      <div className="flex items-center gap-1.5 w-full sm:w-auto min-w-0">
                        <select
                          disabled={!enableForceMajeure}
                          onChange={(e) => {
                            const p = forceMajeurePresets.find((pr) => String(pr.id) === e.target.value);
                            if (p) {
                              setForceMajeure(p.content);
                              setEnableForceMajeure(true);
                            }
                          }}
                          className="flex-1 min-w-0 sm:w-64 max-w-full px-2.5 py-1.5 text-xs sm:text-[11px] bg-white border border-slate-300 text-slate-700 rounded-lg font-medium shadow-2xs hover:border-rose-400 focus:outline-hidden focus:ring-1 focus:ring-rose-500 cursor-pointer disabled:opacity-40 truncate"
                          defaultValue=""
                        >
                          <option value="" disabled>Select Force Majeure Option...</option>
                          {forceMajeurePresets.map((p) => (
                            <option key={p.id} value={p.id}>{p.title} {p.is_default ? "★" : ""}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            setPresetModalTab("force_majeure");
                            setIsPresetModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 border border-slate-200 bg-white cursor-pointer shrink-0 shadow-2xs"
                          title="Manage Force Majeure Presets"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {enableForceMajeure && (
                      <AutoResizingTextarea
                        value={forceMajeure}
                        onChange={setForceMajeure}
                        minHeight={42}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono leading-relaxed focus:outline-hidden focus:ring-1 focus:ring-rose-500 resize-y"
                        placeholder="This Clause Is Applicable."
                      />
                    )}
                  </div>

                  {/* General Commercial Terms */}
                  <div className="p-3 rounded-xl bg-slate-50/50 border border-slate-200 space-y-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      General Commercial & Legal Clauses
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Order Confirmation</label>
                        <input
                          type="text"
                          value={orderConfirmation}
                          onChange={(e) => setOrderConfirmation(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          placeholder="Manufacturing starts only after receipt of advance..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty</label>
                        <input
                          type="text"
                          value={warrantyTerms}
                          onChange={(e) => setWarrantyTerms(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          placeholder="[__ months] against manufacturing defects..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Jurisdiction</label>
                      <input
                        type="text"
                        value={jurisdictionTerms}
                        onChange={(e) => setJurisdictionTerms(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        placeholder="Subject to Rajkot, Gujarat jurisdiction only."
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BANK DETAILS ACCORDION */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div
                onClick={() => setShowBankDetails(!showBankDetails)}
                className="w-full flex justify-between items-center p-3.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Bank Details
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Central Bank Of India</span>
                </div>
                {showBankDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {showBankDetails && (
                <div className="p-4 space-y-3 bg-white">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Account No</label>
                      <input
                        type="text"
                        value={bankAccountNo}
                        onChange={(e) => setBankAccountNo(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code</label>
                      <input
                        type="text"
                        value={bankIfsc}
                        onChange={(e) => setBankIfsc(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name</label>
                      <input
                        type="text"
                        value={bankBranch}
                        onChange={(e) => setBankBranch(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Address</label>
                    <input
                      type="text"
                      value={bankAddress}
                      onChange={(e) => setBankAddress(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving Quotation..." : isEdit ? "Update Quotation" : "Create Quotation"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Preset Modal */}
      <TermsPresetModal
        isOpen={isPresetModalOpen}
        onClose={() => {
          setIsPresetModalOpen(false);
          fetch("/api/quotations/presets")
            .then((res) => res.json())
            .then((data) => {
              if (data.presets) setPresets(data.presets);
            })
            .catch(() => {});
        }}
        onSelectPreset={applyPreset}
        initialTab={presetModalTab}
      />

      {/* Quick Customer Modal */}
      <QuickCustomerModal
        isOpen={isQuickCustomerOpen}
        onClose={() => setIsQuickCustomerOpen(false)}
        initialName={quickCustomerInitialName}
        onCustomerCreated={handleQuickCustomerCreated}
      />
    </>
  );
};
