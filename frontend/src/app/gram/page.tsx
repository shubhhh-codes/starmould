"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface GramTier {
  id: number;
  graterthan: number; // lower bound (min weight in g)
  lessthan: number;   // upper bound (max weight in g)
  fix: number;        // fixed charge (₹)
  multiply: number;   // rate per gram (₹/g)
}

const defaultTiers: GramTier[] = [
  { id: 1, graterthan: 0, lessthan: 50, fix: 450, multiply: 0 },
  { id: 2, graterthan: 51, lessthan: 150, fix: 900, multiply: 0 },
  { id: 3, graterthan: 151, lessthan: 300, fix: 1600, multiply: 0 },
  { id: 4, graterthan: 301, lessthan: 600, fix: 0, multiply: 5.5 },
  { id: 5, graterthan: 601, lessthan: 1200, fix: 0, multiply: 5.0 },
  { id: 6, graterthan: 1201, lessthan: 5000, fix: 0, multiply: 4.5 },
];

export default function GramMasterPage() {
  const [tiers, setTiers] = useState<GramTier[]>(defaultTiers);
  const [testWeight, setTestWeight] = useState<number>(240);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<GramTier | null>(null);

  // Form State
  const [formMin, setFormMin] = useState<number>(0);
  const [formMax, setFormMax] = useState<number>(100);
  const [formFix, setFormFix] = useState<number>(0);
  const [formMultiply, setFormMultiply] = useState<number>(0);

  // Price Calculation Logic matching legacy PrintingController store formula:
  // if ($fix != 0) { $amount = $fix; } else { $amount = $multiply * $gram; }
  const calculatePrice = (weight: number) => {
    const matched = tiers.find(
      (t) => weight >= t.graterthan && weight <= t.lessthan
    );
    if (!matched) return { total: 0, tier: null, method: "Out of range" };
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

  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (formMin > formMax) {
      alert("Minimum weight cannot be greater than maximum weight.");
      return;
    }

    if (editingTier) {
      setTiers(
        tiers.map((t) =>
          t.id === editingTier.id
            ? {
                ...t,
                graterthan: formMin,
                lessthan: formMax,
                fix: formFix,
                multiply: formMultiply,
              }
            : t
        )
      );
    } else {
      const newId = Math.max(...tiers.map((t) => t.id), 0) + 1;
      setTiers([
        ...tiers,
        {
          id: newId,
          graterthan: formMin,
          lessthan: formMax,
          fix: formFix,
          multiply: formMultiply,
        },
      ]);
    }
    setShowModal(false);
  };

  const handleDeleteTier = (id: number) => {
    if (confirm("Are you sure you want to delete this weight tier?")) {
      setTiers(tiers.filter((t) => t.id !== id));
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <Scale className="h-3.5 w-3.5 text-blue-600" />
            <span>Master Data</span>
            <span>/</span>
            <span className="text-slate-600">Gram Pricing Matrix</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Material Weight Rate Tiers
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              `gram_calc` Table
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configures dynamic 3D print and mould material cost lookups applied across Scanning and Printing modules.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Weight Tier</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tiers Table Grid */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Configured Weight Tiers ({tiers.length})
              </h2>
              <span className="text-[11px] text-slate-400">
                Ordered by ascending gram ranges
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Tier ID</th>
                  <th>Weight Range (g)</th>
                  <th>Fixed Charge</th>
                  <th>Multiplier (Rate / g)</th>
                  <th>Pricing Mode</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const isFixed = tier.fix > 0;
                  return (
                    <tr key={tier.id}>
                      <td className="font-mono text-xs font-semibold text-slate-600">
                        #{tier.id}
                      </td>
                      <td className="font-semibold text-slate-800 text-xs">
                        <span className="font-mono">{tier.graterthan}g</span>
                        <span className="text-slate-400 mx-1.5">to</span>
                        <span className="font-mono">{tier.lessthan}g</span>
                      </td>
                      <td className="font-semibold text-slate-900 text-xs">
                        {tier.fix > 0 ? formatCurrency(tier.fix) : "-"}
                      </td>
                      <td className="text-slate-700 text-xs font-medium">
                        {tier.multiply > 0 ? `₹${tier.multiply} / g` : "-"}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isFixed
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {isFixed ? "Fixed Flat Fee" : "Weight Multiplier"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(tier)}
                            title="Edit Tier"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTier(tier.id)}
                            title="Delete Tier"
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              Enter any mould or print part weight in grams to test price calculation against active tiers.
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
                  <div className="text-[10px] text-slate-400">
                    Matched Tier #{testResult.tier.id} ({testResult.tier.graterthan}g – {testResult.tier.lessthan}g)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Rules Helper Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-600 shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Info className="h-3.5 w-3.5 text-blue-600" />
              <span>Business Calculation Rules</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 text-[11px]">
              <li>If <strong>Fixed Charge</strong> is greater than zero, it takes absolute precedence.</li>
              <li>Otherwise, <strong>Multiplier × Gram Weight</strong> is automatically applied.</li>
              <li>Ranges should be continuous without gaps to ensure every part is priced.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add / Edit Tier Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <Scale className="h-4 w-4 text-blue-600" />
                {editingTier ? "Edit Weight Tier" : "Add New Weight Tier"}
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTier} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Min Weight (g)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formMin}
                    onChange={(e) => setFormMin(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Max Weight (g)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formMax}
                    onChange={(e) => setFormMax(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fixed Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formFix}
                  onChange={(e) => setFormFix(Number(e.target.value))}
                  placeholder="e.g. 500 (Set 0 if using multiplier)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Overrides multiplier when set to a non-zero value.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rate Multiplier (₹ / gram)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMultiply}
                  onChange={(e) => setFormMultiply(Number(e.target.value))}
                  placeholder="e.g. 5.5 (Used if fixed charge is 0)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">
                  Multiplied by exact weight in grams when fixed charge is 0.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs shadow-blue-600/30"
                >
                  Save Weight Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
