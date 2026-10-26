"use client";

import React, { useState, useEffect } from "react";
import { Building2, X, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useCreateCustomerMutation } from "@/lib/query/hooks";
import type { Customer } from "@/lib/supabase/types";

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onCustomerCreated: (customer: Customer) => void;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
  isOpen,
  onClose,
  initialName = "",
  onCustomerCreated,
}) => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0;

  const createCustomerMutation = useCreateCustomerMutation();

  const [customerName, setCustomerName] = useState("");
  const [initials, setInitials] = useState("");
  const [hasManuallyEditedInitials, setHasManuallyEditedInitials] = useState(false);
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate initials from company name
  const generateInitials = (name: string): string => {
    const clean = name.trim();
    if (!clean) return "";
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return words[0].slice(0, 4).toUpperCase();
    }
    return words.map((w) => w[0]).join("").toUpperCase().slice(0, 5);
  };

  useEffect(() => {
    if (isOpen) {
      const trimmed = initialName.trim();
      setCustomerName(trimmed);
      setInitials(generateInitials(trimmed));
      setHasManuallyEditedInitials(false);
      setAddress("");
      setGstin("");
      setPan("");
      setMobile("");
      setEmail("");
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialName]);

  const handleNameChange = (val: string) => {
    setCustomerName(val);
    if (!hasManuallyEditedInitials) {
      setInitials(generateInitials(val));
    }
  };

  const handleInitialsChange = (val: string) => {
    setHasManuallyEditedInitials(true);
    const clean = val.replace(/\s+/g, "").toUpperCase().slice(0, 5);
    setInitials(clean);
  };

  const handleGstinChange = (val: string) => {
    const clean = val.toUpperCase().replace(/\s+/g, "");
    setGstin(clean);
    // Standard 15-character GSTIN contains PAN as characters 2 to 12 (0-indexed: index 2 to 12 is 10 chars)
    if (clean.length === 15) {
      const derivedPan = clean.slice(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(derivedPan)) {
        setPan(derivedPan);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isAdmin) {
      setErrorMsg("Access Denied: Only Administrators are authorized to create Customer records.");
      return;
    }

    const cleanName = customerName.trim();
    const cleanInitials = initials.trim().toUpperCase();

    if (!cleanName) {
      setErrorMsg("Customer company name is required.");
      return;
    }

    if (!cleanInitials) {
      setErrorMsg("Customer initials / code are required (max 5 letters).");
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, "").slice(0, 10);
    if (cleanMobile && cleanMobile.length !== 10) {
      setErrorMsg("Mobile number must be exactly 10 numeric digits.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const payload = {
        customername: cleanName,
        initials: cleanInitials,
        usertype: "Customer",
        address: address.trim() || null,
        gstin: gstin.trim() || null,
        pan: pan.trim() || null,
        mobile: cleanMobile || null,
        email: email.trim() || null,
      };

      const result = await createCustomerMutation.mutateAsync(payload);
      const created: Customer = result.customer || result.data || result;

      // Close and pass created customer
      onCustomerCreated(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create customer.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quick Add Customer</h3>
              <p className="text-[11px] text-slate-500">
                Register customer and continue quotation without losing your progress
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {!isAdmin && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[11.5px] block">Administrator Access Required</span>
                <span className="text-[11px] leading-tight block mt-0.5">
                  Only users with Administrator role can register new Customer records into the directory.
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer / Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Acme Polymers Private Limited"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Customer Initials / Short Code */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Initials / Customer Code <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Max 5 letters (e.g. APPL)</span>
            </div>
            <input
              type="text"
              required
              maxLength={5}
              value={initials}
              onChange={(e) => handleInitialsChange(e.target.value)}
              placeholder="e.g. APPL"
              className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Plot No., Industrial Area, City, State, PIN..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* GSTIN & PAN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                maxLength={15}
                value={gstin}
                onChange={(e) => handleGstinChange(e.target.value)}
                placeholder="e.g. 24AAABC1234F1Z9"
                className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PAN</label>
              <input
                type="text"
                maxLength={10}
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="e.g. AAABC1234F"
                className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile / Phone <span className="text-[10px] text-slate-400 font-normal">(10 digits)</span>
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@customer.com"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isAdmin}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Customer...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Create &amp; Apply to Quotation</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
