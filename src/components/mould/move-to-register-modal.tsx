"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Truck,
  Box,
  FileCheck2,
} from "lucide-react";
import type { ScanProject, Subplate } from "@/lib/supabase/types";

interface MoveToRegisterModalProps {
  project: ScanProject | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenDispatchForRemaining?: (project: ScanProject, remainingPlateIds: number[]) => void;
}

const CLOSURE_REASONS = [
  "Customer Cancelled / Return",
  "Direct Handover (No Document)",
  "Kept In-House / Spare Tooling",
  "Rework / Scrapped Component",
  "Other / Custom Note",
];

export function MoveToRegisterModal({
  project,
  isOpen,
  onClose,
  onSuccess,
  onOpenDispatchForRemaining,
}: MoveToRegisterModalProps) {
  const [selectedReason, setSelectedReason] = useState(CLOSURE_REASONS[0]);
  const [customNote, setCustomNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute plates and dispatch status
  const { subplates, dispatchedPlates, remainingPlates } = useMemo(() => {
    if (!project) return { subplates: [], dispatchedPlates: [], remainingPlates: [] };

    const plates = project.subplates || [];
    const dispatched = plates.filter(
      (p: Subplate) =>
        p.location === "Customer" ||
        p.dispatch_status === "dispatched" ||
        (p as any).isDispatched === true
    );
    const remaining = plates.filter(
      (p: Subplate) =>
        p.location !== "Customer" &&
        p.dispatch_status !== "dispatched" &&
        (p as any).isDispatched !== true
    );

    return {
      subplates: plates,
      dispatchedPlates: dispatched,
      remainingPlates: remaining,
    };
  }, [project]);

  const isPartialDispatch = dispatchedPlates.length > 0 && remainingPlates.length > 0;
  const isNoDispatch = dispatchedPlates.length === 0 && remainingPlates.length > 0;
  const isFullyDispatched = subplates.length > 0 && remainingPlates.length === 0;

  const handleDirectClose = async () => {
    if (!project) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const remainingIds = remainingPlates.map((p: Subplate) => p.id);
      const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directClosePlateIds: remainingIds,
          closureReason: selectedReason,
          closureNotes: customNote.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to move project to register");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error moving project to register";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRemainingChallan = () => {
    if (!project) return;
    const remainingIds = remainingPlates.map((p: Subplate) => p.id);
    onClose();
    onOpenDispatchForRemaining?.(project, remainingIds);
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Move to Project Register
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {project.projectid || `#${project.id}`} • {project.description || "Mould Set"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Fully Dispatched Scenario */}
          {isFullyDispatched && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>All {subplates.length} Subplates Dispatched</span>
              </div>
              <p className="text-emerald-700 leading-relaxed">
                All subplates for this mould have been dispatched to the customer. Ready to move to the permanent Completed Project Register.
              </p>
            </div>
          )}

          {/* Partial Dispatch Scenario */}
          {isPartialDispatch && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Partial Dispatch Detected</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  <strong className="font-semibold">{dispatchedPlates.length} of {subplates.length}</strong> subplates already have Dispatch Challans generated. <strong className="font-semibold">{remainingPlates.length}</strong> subplates have not been dispatched.
                </p>
              </div>

              {/* Undispatched Plates List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                <div className="px-3 py-2 bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider flex justify-between">
                  <span>Undispatched Plates ({remainingPlates.length})</span>
                  <span>Location</span>
                </div>
                <div className="divide-y divide-slate-200/60 max-h-36 overflow-y-auto">
                  {remainingPlates.map((p: Subplate) => (
                    <div key={p.id} className="px-3 py-2 text-xs flex items-center justify-between">
                      <span className="font-medium text-slate-800">{p.platename}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {p.location || "SM"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reason Selector for Direct Closure */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold text-slate-700">
                  Reason for Direct Closure (Remaining {remainingPlates.length} Plates)
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
                >
                  {CLOSURE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {selectedReason === "Other / Custom Note" && (
                  <input
                    type="text"
                    placeholder="Enter custom closure reason..."
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl mt-1.5 focus:outline-hidden focus:border-blue-500"
                  />
                )}
              </div>
            </div>
          )}

          {/* No Dispatch Scenario */}
          {isNoDispatch && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>No Delivery Challan Created</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  None of the {subplates.length} subplates have a customer Dispatch Challan. You can either generate a delivery challan first or archive directly to the Project Register.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Direct Archive Reason
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
                >
                  {CLOSURE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {/* Action 1: Create Challan for Remaining */}
            {(isPartialDispatch || isNoDispatch) && onOpenDispatchForRemaining && (
              <button
                type="button"
                onClick={handleCreateRemainingChallan}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Create Challan for Remaining ({remainingPlates.length})</span>
              </button>
            )}

            {/* Action 2: Move to Register Directly */}
            <button
              type="button"
              onClick={handleDirectClose}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 ${
                isFullyDispatched
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }`}
            >
              {isSubmitting ? (
                <span>Moving...</span>
              ) : (
                <>
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>{isFullyDispatched ? "Move to Project Register" : "Move Directly to Register"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
