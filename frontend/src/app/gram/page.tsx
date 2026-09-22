"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  Calculator,
  CheckCircle2,
  Sparkles,
  ArrowUpDown,
  X,
  Info,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface GramTier {
  id: number;
  graterthan: number; // lower bound (min weight in g)
  lessthan: number;   // upper bound (max weight in g)
  fix: number;        // fixed charge (₹)
  multiply: number;   // rate per gram (₹/g)
}

export default function GramMasterPage() {
  const [tiers, setTiers] = useState<GramTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testWeight, setTestWeight] = useState<number>(240);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<GramTier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GramTier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Form State
  const [formMin, setFormMin] = useState<number>(0);
  const [formMax, setFormMax] = useState<number>(100);
  const [formFix, setFormFix] = useState<number>(0);
  const [formMultiply, setFormMultiply] = useState<number>(0);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Live fetch from Supabase gram_calc table
  const fetchTiers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/gram");
      const data = await res.json();
      if (res.ok && Array.isArray(data.tiers)) {
        setTiers(data.tiers);
      } else {
        showNotification("error", data.error || "Failed to load gram tiers");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load gram tiers";
      showNotification("error", msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  // Price Calculation Logic matching legacy PrintingController store formula:
  // if ($fix != 0) { $amount = $fix; } else { $amount = $multiply * $gram; }
  const calculatePrice = (weight: number) => {
    const matched = tiers.find(
      (t) => weight >= t.graterthan && weight <= t.lessthan
    );
    if (!matched) return { total: 0, tier: null, method: "Out of range / No tier matched" };
    if (matched.fix > 0) {
      return { total: matched.fix, tier: matched, method: `Fixed tier fee (₹${matched.fix})` };
    }
    const total = matched.multiply * weight;
    return {
      total,
      tier: matched,
      method: `${weight}g × ₹${matched.multiply}/g`,
    };
  };

  const testResult = calculatePrice(testWeight);

  const openAddModal = () => {
    setEditingTier(null);
    const lastTier = tiers[tiers.length - 1];
    setFormMin(lastTier ? lastTier.lessthan + 1 : 0);
    setFormMax(lastTier ? lastTier.lessthan + 500 : 500);
    setFormFix(0);
    setFormMultiply(5);
    setShowModal(true);
  };

  const openEditModal = (tier: GramTier) => {
    setEditingTier(tier);
    setFormMin(tier.graterthan);
    setFormMax(tier.lessthan);
    setFormFix(tier.fix);
    setFormMultiply(tier.multiply);
    setShowModal(true);
  };

  const handleSaveTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMin > formMax) {
      showNotification("error", "Minimum weight cannot be greater than maximum weight.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingTier) {
        const res = await fetch("/api/gram", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTier.id,
            graterthan: formMin,
            lessthan: formMax,
            fix: formFix,
            multiply: formMultiply,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          showNotification("error", result.error || "Failed to update tier");
          return;
        }
        setTiers((prev) =>
          prev.map((t) => (t.id === editingTier.id ? result.tier : t))
        );
        showNotification("success", "Gram tier updated successfully.");
      } else {
        const res = await fetch("/api/gram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graterthan: formMin,
            lessthan: formMax,
            fix: formFix,
            multiply: formMultiply,
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          showNotification("error", result.error || "Failed to create tier");
          return;
        }
        setTiers((prev) => [...prev, result.tier].sort((a, b) => a.graterthan - b.graterthan));
        showNotification("success", "Gram pricing tier added successfully.");
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save tier";
      showNotification("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/gram?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) {
        showNotification("error", result.error || "Failed to delete tier");
        return;
      }
      setTiers((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      showNotification("success", "Weight tier deleted successfully.");
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete tier";
      showNotification("error", msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout>
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 text-xs font-medium ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Scale className="h-3.5 w-3.5 text-blue-600" />
            <span>Master Data</span>
            <span>/</span>
            <span className="text-slate-600 dark:text-slate-300">Gram Pricing Matrix</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Material Weight Rate Tiers
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live `gram_calc` Table
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configures dynamic 3D print and mould material cost lookups applied across Scanning and Printing modules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTiers}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
            title="Refresh tiers from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Weight Tier</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tiers Table Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Configured Weight Tiers ({tiers.length})
              </h2>
              <span className="text-[11px] text-slate-400">
                Source: `gram_calc` table in live Supabase database
              </span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tier ID</th>
                  <th className="py-3 px-4">Weight Range (g)</th>
                  <th className="py-3 px-4">Fixed Charge</th>
                  <th className="py-3 px-4">Multiplier (Rate / g)</th>
                  <th className="py-3 px-4">Pricing Mode</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                      <p>Loading gram calculation tiers from database...</p>
                    </td>
                  </tr>
                ) : tiers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-10 text-slate-500 text-sm"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Scale className="w-8 h-8 text-slate-300" />
                        <p className="font-semibold text-slate-700 dark:text-slate-200">
                          No Gram Pricing Tiers Configured
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          `gram_calc` has 0 rows in production database. Click &ldquo;Add Weight Tier&rdquo; above to configure rate brackets.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tiers.map((tier) => {
                    const isFixed = tier.fix > 0;
                    return (
                      <tr key={tier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                          #{tier.id}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          <span className="font-mono">{tier.graterthan}g</span>
                          <span className="text-slate-400 mx-1.5">to</span>
                          <span className="font-mono">{tier.lessthan}g</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                          {tier.fix > 0 ? formatCurrency(tier.fix) : "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 text-xs font-medium">
                          {tier.multiply > 0 ? `₹${tier.multiply} / g` : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isFixed
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800"
                            }`}
                          >
                            {isFixed ? "Fixed Flat Fee" : "Weight Multiplier"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(tier)}
                              title="Edit Tier"
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(tier)}
                              title="Delete Tier"
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-blue-600" />
                <p>Loading tiers...</p>
              </div>
            ) : tiers.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No Gram Pricing Tiers Configured.
              </div>
            ) : (
              tiers.map((tier) => {
                const isFixed = tier.fix > 0;
                return (
                  <div
                    key={tier.id}
                    className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-500 font-bold">
                        Tier #{tier.id}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isFixed
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {isFixed ? "Fixed Flat Fee" : "Multiplier"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Range:</span>
                        <span className="font-mono font-semibold">
                          {tier.graterthan}g – {tier.lessthan}g
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Charge / Rate:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {tier.fix > 0 ? formatCurrency(tier.fix) : `₹${tier.multiply}/g`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                      <button
                        onClick={() => openEditModal(tier)}
                        className="px-3 py-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tier)}
                        className="px-3 py-1 text-[11px] font-medium text-rose-600 border border-rose-200 rounded hover:bg-rose-50 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Live Formula Calculator & Simulator */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-5 shadow-lg border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Calculator className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-bold tracking-tight text-white">
                Formula Simulator
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Enter any mould or print part weight in grams to test price calculation against live database tiers.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Part Weight (Grams)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={testWeight}
                    onChange={(e) => setTestWeight(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                    grams
                  </span>
                </div>
              </div>

              {/* Calculated Result Box */}
              <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                <div className="text-[11px] text-slate-400 font-medium">
                  Derived Billing Estimation
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {formatCurrency(testResult.total)}
                </div>
                <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-700 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400 flex-shrink-0" />
                  <span className="font-mono text-[11px]">{testResult.method}</span>
                </div>
                {testResult.tier && (
                  <div className="text-[10px] text-slate-400 font-mono">
                    Tier Range: {testResult.tier.graterthan}g - {testResult.tier.lessthan}g
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add / Edit Tier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {editingTier ? "Edit Weight Tier" : "Add Weight Tier"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Min Weight (graterthan)
                  </label>
                  <input
                    type="number"
                    required
                    value={formMin}
                    onChange={(e) => setFormMin(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Max Weight (lessthan)
                  </label>
                  <input
                    type="number"
                    required
                    value={formMax}
                    onChange={(e) => setFormMax(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Fixed Charge (₹)
                  </label>
                  <input
                    type="number"
                    value={formFix}
                    onChange={(e) => setFormFix(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Multiplier (₹ / g)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formMultiply}
                    onChange={(e) => setFormMultiply(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Tier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Confirm Tier Deletion
                </h4>
                <p className="text-slate-500">
                  Delete Tier #{deleteTarget.id} ({deleteTarget.graterthan}g - {deleteTarget.lessthan}g)
                </p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Are you sure you want to delete this weight tier from the database?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Yes, Delete Tier</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
