"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Settings, Sparkles, Building2, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { Quotation, QuotationItem, QuotationTermsPreset } from "@/types/quotation";
import { TermsPresetModal } from "./terms-preset-modal";
import { amountInWords } from "@/lib/number-to-words";
import { calculateGST, formatINRTwoDecimals, type TaxType } from "@/lib/gst-calculation";
import { CustomerSelect } from "@/components/ui/customer-select";
import { useCustomerDropdownQuery } from "@/lib/query/hooks";
import type { Customer } from "@/lib/supabase/types";

interface QuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialQuotation?: Quotation | null;
}

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
  const [stateCode, setStateCode] = useState("24 - Gujarat");
  const [subject, setSubject] = useState("");
  const [reference, setReference] = useState("");

  // Items
  const [items, setItems] = useState<any[]>([
    { sr_no: 1, product_description: "", qty: 1, unit: "Nos", unit_price: "", total_amount: 0 },
  ]);

  // Tax
  const [taxType, setTaxType] = useState<TaxType>("gst_18");

  // Bank
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [bankName, setBankName] = useState("Central Bank Of India");
  const [bankAccountNo, setBankAccountNo] = useState("5875819245");
  const [bankIfsc, setBankIfsc] = useState("CBIN0281313");
  const [bankBranch, setBankBranch] = useState("Saurashtra University Branch");
  const [bankAddress, setBankAddress] = useState("Saurashtra University Campus, Rajkot");

  // Terms
  const [showTermsDetails, setShowTermsDetails] = useState(false);
  const [priceTerms, setPriceTerms] = useState("Ex-Works Rajkot, +18% GST Freight ,Transit Insurance At Actual.");
  const [deliveryTerms, setDeliveryTerms] = useState("2 Days");
  const [paymentTerms, setPaymentTerms] = useState("100% advance before dispatch of goods.");
  const [validityTerms, setValidityTerms] = useState("10 DAYS");
  const [forceMajeure, setForceMajeure] = useState("This Clause Is Applicable.");

  const [includeDigitalStamp, setIncludeDigitalStamp] = useState(true);
  const [status, setStatus] = useState<"Draft" | "Sent" | "Accepted" | "Rejected" | "Expired">("Draft");

  // Presets
  const [presets, setPresets] = useState<QuotationTermsPreset[]>([]);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

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
            const defaultPreset = data.presets.find((p: any) => p.is_default);
            if (defaultPreset) {
              applyPreset(defaultPreset);
            }
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
      setStateCode(initialQuotation.state_code || "24 - Gujarat");
      setSubject(initialQuotation.subject || "");
      setReference(initialQuotation.reference || "");
      setTaxType(initialQuotation.tax_type || "gst_18");
      setBankName(initialQuotation.bank_name || "Central Bank Of India");
      setBankAccountNo(initialQuotation.bank_account_no || "5875819245");
      setBankIfsc(initialQuotation.bank_ifsc || "CBIN0281313");
      setBankBranch(initialQuotation.bank_branch || "Saurashtra University Branch");
      setBankAddress(initialQuotation.bank_address || "Saurashtra University Campus, Rajkot");
      setPriceTerms(initialQuotation.price_terms || "");
      setDeliveryTerms(initialQuotation.delivery_terms || "");
      setPaymentTerms(initialQuotation.payment_terms || "");
      setValidityTerms(initialQuotation.validity_terms || "");
      setForceMajeure(initialQuotation.force_majeure || "");
      setIncludeDigitalStamp(initialQuotation.include_digital_stamp !== false);
      setStatus(initialQuotation.status || "Draft");

      if (initialQuotation.items && initialQuotation.items.length > 0) {
        setItems(
          initialQuotation.items.map((it, idx) => ({
            ...it,
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
      setStateCode("24 - Gujarat");
      setSubject("");
      setReference("");
      setTaxType("gst_18");
      setItems([{ sr_no: 1, product_description: "", qty: 1, unit: "Nos", unit_price: "", total_amount: 0 }]);
      setStatus("Draft");
      setIncludeDigitalStamp(true);
    }

    setErrorMsg(null);
  }, [isOpen, initialQuotation]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const applyPreset = (preset: QuotationTermsPreset) => {
    if (preset.price_terms) setPriceTerms(preset.price_terms);
    if (preset.delivery_terms) setDeliveryTerms(preset.delivery_terms);
    if (preset.payment_terms) setPaymentTerms(preset.payment_terms);
    if (preset.validity_terms) setValidityTerms(preset.validity_terms);
    if (preset.force_majeure) setForceMajeure(preset.force_majeure);
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

    if (c.gstin && c.gstin.length >= 2) {
      const prefix = c.gstin.substring(0, 2);
      setStateCode(prefix === "24" ? "24 - Gujarat" : `${prefix} - Other State`);
    } else {
      setStateCode("24 - Gujarat");
    }

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
            if (full.gstin && full.gstin.length >= 2) {
              const prefix = full.gstin.substring(0, 2);
              setStateCode(prefix === "24" ? "24 - Gujarat" : `${prefix} - Other State`);
            }
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
            if (prevQuote.state_code) setStateCode((cur) => cur || prevQuote.state_code);
          }
        }
      }
    } catch (err) {
      console.warn("Could not fetch extended customer details:", err);
    }
  };

  // Item management
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

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
      { sr_no: items.length + 1, product_description: "", qty: 1, unit: "Nos", unit_price: "", total_amount: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    const updated = items.filter((_, i) => i !== index).map((it, idx) => ({ ...it, sr_no: idx + 1 }));
    setItems(updated);
  };

  // Totals calculations via Indian GST Calculation Engine
  const { taxableAmount, gstAmount, cgstAmount, sgstAmount, igstAmount, grandTotal } = calculateGST(
    items,
    taxType
  );
  const inWords = amountInWords(grandTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consigneeName.trim()) {
      setErrorMsg("Please select a customer from the customer list.");
      return;
    }
    if (items.length === 0 || !items.some((it) => it.product_description.trim())) {
      setErrorMsg("Please add at least one item with a description.");
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
        state_code: stateCode,
        subject,
        reference,
        tax_type: taxType,
        tax_rate: taxType === "exempt" ? 0 : 18,
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
        price_terms: priceTerms,
        delivery_terms: deliveryTerms,
        payment_terms: paymentTerms,
        validity_terms: validityTerms,
        force_majeure: forceMajeure,
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
        className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="min-h-full flex items-center justify-center p-0 sm:p-2">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
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
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-5 sm:space-y-6">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {errorMsg}
              </div>
            )}

            {/* TOP BAR: Quotation No, Date, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quotation No
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={quotationNo}
                    className="w-full pl-3 pr-8 py-2 text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded-lg cursor-not-allowed select-all focus:outline-hidden"
                    placeholder="Generating..."
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Date</label>
                <input
                  type="date"
                  required
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Expired">Expired</option>
                </select>
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
                    type="text"
                    value={consigneePhone}
                    onChange={(e) => setConsigneePhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Mobile or phone number"
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

            {/* SUBJECT & REFERENCE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Cutting Blade / Pulp Tableware Mould"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="If any..."
                />
              </div>
            </div>

            {/* PARTICULARS / PRODUCTS TABLE */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Product Details ({items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full text-xs min-w-[550px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">#</th>
                      <th className="py-2.5 px-3 text-left">Description / Particulars *</th>
                      <th className="py-2.5 px-3 text-center w-20">Qty</th>
                      <th className="py-2.5 px-3 text-center w-24">Unit</th>
                      <th className="py-2.5 px-3 text-right w-28">Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right w-32">Amount (₹)</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-500 align-top">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <textarea
                            rows={2}
                            required
                            value={item.product_description}
                            onChange={(e) => handleItemChange(index, "product_description", e.target.value)}
                            placeholder="Description and specifications..."
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500 resize-y"
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
              </div>

              <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2 text-xs font-medium">
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
              <div className="w-full flex justify-between items-center p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors">
                <div
                  onClick={() => setShowTermsDetails(!showTermsDetails)}
                  className="flex items-center gap-2 flex-1 cursor-pointer select-none"
                >
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Terms & Conditions
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">(Delivery, Payment & Validity)</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPresetModalOpen(true)}
                    className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium underline cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5" /> Manage Presets
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
                <div className="p-4 space-y-3 bg-white">
                  {presets.length > 0 && (
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <span className="text-xs text-slate-500 font-medium">Quick Apply Preset:</span>
                      <select
                        onChange={(e) => {
                          const p = presets.find((pr) => String(pr.id) === e.target.value);
                          if (p) applyPreset(p);
                        }}
                        className="px-2.5 py-1 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-md font-semibold"
                        defaultValue=""
                      >
                        <option value="" disabled>Select Preset...</option>
                        {presets.map((p) => (
                          <option key={p.id} value={p.id}>{p.title} {p.is_default ? "(Default)" : ""}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">1. Price Terms</label>
                      <input
                        type="text"
                        value={priceTerms}
                        onChange={(e) => setPriceTerms(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">2. Delivery Terms</label>
                      <input
                        type="text"
                        value={deliveryTerms}
                        onChange={(e) => setDeliveryTerms(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">3. Payment Terms</label>
                      <input
                        type="text"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">4. Validity</label>
                      <input
                        type="text"
                        value={validityTerms}
                        onChange={(e) => setValidityTerms(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">5. Force Majeure</label>
                    <input
                      type="text"
                      value={forceMajeure}
                      onChange={(e) => setForceMajeure(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                    />
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

            {/* DIGITAL STAMP & ANNEXURE NOTE */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-blue-50/60 rounded-xl border border-blue-200">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDigitalStamp}
                  onChange={(e) => setIncludeDigitalStamp(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                Include Stamp & Signature
              </label>

              <div className="text-[11px] text-blue-800 font-medium">
                Standard terms & conditions (Annexure-I) are included automatically.
              </div>
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
    </div>

    {/* Preset Modal */}
    <TermsPresetModal
      isOpen={isPresetModalOpen}
      onClose={() => setIsPresetModalOpen(false)}
      onSelectPreset={applyPreset}
    />
  </>
);
};
