"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Edit2, Trash2, Check, Star } from "lucide-react";
import { QuotationTermsPreset } from "@/types/quotation";

interface TermsPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset?: (preset: QuotationTermsPreset) => void;
}

export const TermsPresetModal: React.FC<TermsPresetModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
}) => {
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
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setEditingPreset({
      title: "",
      price_terms: "Ex-Works Rajkot, +18% GST Freight ,Transit Insurance At Actual.",
      delivery_terms: "2 Days",
      payment_terms: "100% advance before dispatch of goods.",
      validity_terms: "10 DAYS",
      force_majeure: "This Clause Is Applicable.",
      is_default: false,
    });
    setErrorMsg(null);
  };

  const handleStartEdit = (p: QuotationTermsPreset) => {
    setEditingPreset({ ...p });
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset?.title?.trim()) {
      setErrorMsg("Title is required");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      const isEdit = Boolean(editingPreset.id);
      const res = await fetch("/api/quotations/presets", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPreset),
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
    if (!window.confirm("Are you sure you want to delete this preset?")) return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Terms & Conditions Presets</h2>
            <p className="text-xs text-slate-500">Manage customizable quick terms presets for quotations</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {errorMsg}
            </div>
          )}

          {!editingPreset ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Available Presets ({presets.length})
                </span>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Preset
                </button>
              </div>

              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading presets...</div>
              ) : presets.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No presets found. Click &quot;Add New Preset&quot; to create one.</div>
              ) : (
                <div className="grid gap-3">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="p-4 border border-slate-200 rounded-xl hover:border-blue-300 transition-colors bg-white flex flex-col sm:flex-row justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">{preset.title}</h3>
                          {preset.is_default && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Star className="w-3 h-3 fill-amber-500" /> Default
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 space-y-0.5 mt-2">
                          <div><strong>Price:</strong> {preset.price_terms}</div>
                          <div><strong>Delivery:</strong> {preset.delivery_terms}</div>
                          <div><strong>Payment:</strong> {preset.payment_terms}</div>
                          <div><strong>Validity:</strong> {preset.validity_terms}</div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col justify-end items-end gap-2 shrink-0">
                        {onSelectPreset && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectPreset(preset);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" /> Use Preset
                          </button>
                        )}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(preset)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Preset"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(preset.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingPreset.id ? "Edit Preset" : "Create New Preset"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Preset Title *</label>
                <input
                  type="text"
                  required
                  value={editingPreset.title || ""}
                  onChange={(e) => setEditingPreset({ ...editingPreset, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Standard Terms, Urgent Dispatch..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">1. Price Terms</label>
                  <input
                    type="text"
                    value={editingPreset.price_terms || ""}
                    onChange={(e) => setEditingPreset({ ...editingPreset, price_terms: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Ex-Works Rajkot, +18% GST..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">2. Delivery Terms</label>
                  <input
                    type="text"
                    value={editingPreset.delivery_terms || ""}
                    onChange={(e) => setEditingPreset({ ...editingPreset, delivery_terms: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 2 Days / Immediate"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">3. Payment Terms</label>
                  <input
                    type="text"
                    value={editingPreset.payment_terms || ""}
                    onChange={(e) => setEditingPreset({ ...editingPreset, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 100% advance before dispatch of goods."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">4. Validity</label>
                  <input
                    type="text"
                    value={editingPreset.validity_terms || ""}
                    onChange={(e) => setEditingPreset({ ...editingPreset, validity_terms: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 10 DAYS"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">5. Force Majeure</label>
                <input
                  type="text"
                  value={editingPreset.force_majeure || ""}
                  onChange={(e) => setEditingPreset({ ...editingPreset, force_majeure: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. This Clause Is Applicable."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="preset_is_default"
                  checked={Boolean(editingPreset.is_default)}
                  onChange={(e) => setEditingPreset({ ...editingPreset, is_default: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="preset_is_default" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Set as Default preset for new quotations
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Preset"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
