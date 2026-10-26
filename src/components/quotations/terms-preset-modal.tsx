"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Star,
  Tag,
  Truck,
  CreditCard,
  Clock,
  ShieldAlert,
  ChevronRight,
  Info,
} from "lucide-react";
import { QuotationTermsPreset } from "@/types/quotation";

export type TermCategory = "price" | "delivery" | "payment" | "validity" | "force_majeure";

interface TermsPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (preset: QuotationTermsPreset) => void;
  initialTab?: TermCategory;
}

export const CATEGORIES: {
  key: TermCategory;
  num: number;
  label: string;
  icon: React.ReactNode;
  placeholderName: string;
  placeholderText: string;
  description: string;
}[] = [
  {
    key: "price",
    num: 1,
    label: "Price Terms",
    icon: <Tag className="w-4 h-4" />,
    placeholderName: "e.g. Ex-Works Rajkot + 18% GST (Official)",
    placeholderText:
      "Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance [extra at actuals / included].",
    description: "Pricing currency, GST extra/included, ex-works vs FOR destination, freight.",
  },
  {
    key: "delivery",
    num: 2,
    label: "Delivery Terms",
    icon: <Truck className="w-4 h-4" />,
    placeholderName: "e.g. Tooling Lead Time (3-4 Weeks)",
    placeholderText:
      "[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.",
    description: "Dispatch schedules, manufacturing lead time from PO and advance payment.",
  },
  {
    key: "payment",
    num: 3,
    label: "Payment Terms",
    icon: <CreditCard className="w-4 h-4" />,
    placeholderName: "e.g. 50% Advance + 50% Before Dispatch",
    placeholderText:
      "[50% advance along with Purchase Order, balance 50% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.",
    description: "Advance splits (50/50, 70/30, 100% advance, 30 days credit) & bank mode.",
  },
  {
    key: "validity",
    num: 4,
    label: "Validity",
    icon: <Clock className="w-4 h-4" />,
    placeholderName: "e.g. 15 Days (Official)",
    placeholderText:
      "This quotation is valid for [15] days from the date of issue. Prices and delivery are subject to change thereafter.",
    description: "Quotation expiry window (10 days, 15 days, 30 days) before price revision.",
  },
  {
    key: "force_majeure",
    num: 5,
    label: "Force Majeure",
    icon: <ShieldAlert className="w-4 h-4" />,
    placeholderName: "e.g. Standard Clause Applicable",
    placeholderText: "This Clause Is Applicable.",
    description: "Acts of God, strikes, pandemic, uncontrollable delays exemption terms.",
  },
];

export const TermsPresetModal: React.FC<TermsPresetModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
  initialTab = "price",
}) => {
  const [activeCategory, setActiveCategory] = useState<TermCategory>(initialTab);
  const [presets, setPresets] = useState<QuotationTermsPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPreset, setEditingPreset] = useState<Partial<QuotationTermsPreset> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/quotations/presets");
      const json = await res.json();
      if (res.ok && json.presets) {
        setPresets(json.presets);
      }
    } catch {
      setErrorMsg("Failed to load presets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPresets();
      setEditingPreset(null);
      setErrorMsg(null);
      if (initialTab) setActiveCategory(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentCategoryConfig =
    CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];
  const activeCategoryPresets = presets.filter(
    (p) => (p.term_type || "price") === activeCategory
  );

  const handleStartCreate = () => {
    setEditingPreset({
      term_type: activeCategory,
      title: "",
      content: currentCategoryConfig.placeholderText,
      is_default: activeCategoryPresets.length === 0,
    });
    setErrorMsg(null);
  };

  const handleStartEdit = (p: QuotationTermsPreset) => {
    setEditingPreset({
      ...p,
      term_type: (p.term_type || activeCategory) as TermCategory,
      content: p.content || "",
    });
    setErrorMsg(null);
  };

  const handleSetDefault = async (preset: QuotationTermsPreset) => {
    try {
      setIsSaving(true);
      setErrorMsg(null);
      const res = await fetch("/api/quotations/presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: preset.id,
          term_type: preset.term_type || activeCategory,
          title: preset.title,
          content: preset.content,
          is_default: true,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to update default preset");
      }
      await fetchPresets();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to set default preset");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset?.title?.trim()) {
      setErrorMsg("Preset title is required");
      return;
    }
    if (!editingPreset?.content?.trim()) {
      setErrorMsg("Terms content text is required");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      const isEdit = Boolean(editingPreset.id);
      const payload = {
        ...editingPreset,
        term_type: editingPreset.term_type || activeCategory,
        title: editingPreset.title.trim(),
        content: editingPreset.content.trim(),
      };

      const res = await fetch("/api/quotations/presets", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save preset");
      }

      await fetchPresets();
      setEditingPreset(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save preset");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this preset option?")) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/quotations/presets?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchPresets();
      }
    } catch {
      setErrorMsg("Failed to delete preset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white rounded-none sm:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border-0 sm:border border-slate-200 h-full sm:h-[88vh] sm:max-h-[750px] flex flex-col">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-800 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="truncate">Terms & Conditions Presets</span>
              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                5 Categories
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate sm:whitespace-normal">
              Customize modular clauses & default options for quotations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Column Split: Master List on Left | Category Detail on Right */}
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
          {/* Categories: Horizontal Tab Bar on Mobile | Left Sidebar on Desktop */}
          <div className="w-full sm:w-72 bg-slate-50/70 border-b sm:border-b-0 sm:border-r border-slate-200 p-2 sm:p-3 flex flex-row sm:flex-col gap-1.5 overflow-x-auto sm:overflow-y-auto shrink-0">
            <div className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
              Terms Categories
            </div>
            {CATEGORIES.map((cat) => {
              const catPresets = presets.filter(
                (p) => (p.term_type || "price") === cat.key
              );
              const defaultP = catPresets.find((p) => p.is_default);
              const isActive = activeCategory === cat.key;

              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setEditingPreset(null);
                    setErrorMsg(null);
                  }}
                  className={`shrink-0 text-left p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer border flex items-center justify-between group ${
                    isActive
                      ? "bg-white border-blue-500 shadow-xs ring-1 ring-blue-500/20"
                      : "bg-white/60 hover:bg-white border-slate-200/80 text-slate-700 hover:border-slate-300"
                  } min-w-[130px] sm:min-w-0 sm:w-full`}
                >
                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <span
                      className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                      }`}
                    >
                      {cat.num}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold truncate ${
                            isActive ? "text-blue-900" : "text-slate-800"
                          }`}
                        >
                          {cat.label}
                        </span>
                      </div>
                      <p className="hidden sm:block text-[10.5px] text-slate-400 truncate max-w-[160px]">
                        {defaultP ? `★ ${defaultP.title}` : `${catPresets.length} presets`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-1.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {catPresets.length}
                    </span>
                    <ChevronRight
                      className={`hidden sm:block w-3.5 h-3.5 ${
                        isActive ? "text-blue-600" : "text-slate-300 group-hover:text-slate-400"
                      }`}
                    />
                  </div>
                </button>
              );
            })}

            <div className="hidden sm:flex mt-auto pt-3 border-t border-slate-200 px-2 text-[11px] text-slate-500 items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Each category can have multiple presets (e.g. 50/50, 70/30). One preset can be set as default.
              </span>
            </div>
          </div>

          {/* Right Panel: Active Category Presets & Forms */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-5 bg-white">
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between shrink-0">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {!editingPreset ? (
              <div className="space-y-4">
                {/* Header bar of active category */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 inline-flex items-center justify-center text-xs font-bold">
                        {currentCategoryConfig.num}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                        {currentCategoryConfig.label}
                      </h3>
                      <span className="text-xs text-slate-400">
                        ({activeCategoryPresets.length} available)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentCategoryConfig.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartCreate}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer w-full sm:w-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Preset Option</span>
                  </button>
                </div>

                {/* List of Presets for this Category */}
                {loading ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    Loading category presets...
                  </div>
                ) : activeCategoryPresets.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl p-6">
                    <p className="text-xs font-semibold text-slate-600 mb-1">
                      No presets found for {currentCategoryConfig.label}
                    </p>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Add common variations (e.g., standard terms, alternate terms) for quick selection in quotations.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartCreate}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add First Preset
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeCategoryPresets.map((preset) => {
                      const text = preset.content || "";

                      return (
                        <div
                          key={preset.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            preset.is_default
                              ? "border-blue-300 bg-blue-50/20 shadow-2xs"
                              : "border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-xs text-slate-800">
                                  {preset.title}
                                </span>
                                {preset.is_default ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                    Current Default
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSetDefault(preset)}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-slate-600 bg-white hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border border-slate-200 transition-all cursor-pointer shadow-2xs group/btn active:scale-95"
                                    title="Click to set as default for new quotations"
                                  >
                                    <Star className="w-3 h-3 text-slate-400 group-hover/btn:text-amber-500 transition-colors" />
                                    <span>Make Default</span>
                                  </button>
                                )}
                              </div>

                              <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 text-[11px] font-mono text-slate-700 leading-relaxed break-words whitespace-pre-wrap">
                                {text}
                              </div>
                            </div>

                            <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                              {onSelectPreset && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectPreset(preset);
                                    onClose();
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition cursor-pointer"
                                >
                                  <Check className="w-3 h-3" /> Apply
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(preset)}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  title="Edit preset wording"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(preset.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                  title="Delete preset"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Inline Add / Edit Form */
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 inline-flex items-center justify-center text-xs font-bold">
                      {currentCategoryConfig.num}
                    </span>
                    <h3 className="font-bold text-slate-800 text-sm">
                      {editingPreset.id
                        ? `Edit ${currentCategoryConfig.label} Preset`
                        : `New ${currentCategoryConfig.label} Preset`}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPreset(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preset Option Title / Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPreset.title || ""}
                    onChange={(e) =>
                      setEditingPreset({ ...editingPreset, title: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder={currentCategoryConfig.placeholderName}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This title will appear in the dropdown inside the Quotation modal.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {currentCategoryConfig.label} Content / Text Wording *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={editingPreset.content || ""}
                    onChange={(e) =>
                      setEditingPreset({ ...editingPreset, content: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-[11px] leading-relaxed"
                    placeholder={currentCategoryConfig.placeholderText}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This exact wording will be filled when this preset is selected from the dropdown.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="preset_is_default"
                    checked={Boolean(editingPreset.is_default)}
                    onChange={(e) =>
                      setEditingPreset({ ...editingPreset, is_default: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <label
                    htmlFor="preset_is_default"
                    className="text-xs font-medium text-slate-700 cursor-pointer select-none"
                  >
                    Set as default for {currentCategoryConfig.label} (auto-loaded in new quotations)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingPreset(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {isSaving
                      ? "Saving..."
                      : editingPreset.id
                      ? "Update Preset"
                      : "Create Preset"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
