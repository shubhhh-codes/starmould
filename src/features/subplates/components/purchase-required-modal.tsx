"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { useState } from "react";
import { useUpdateSubplateMutation } from "@/lib/query/hooks";
import { isPurchaseOptional } from "@/lib/subplate-purchase";
import type { Subplate } from "@/lib/supabase/types";
import { ShoppingCart, Warehouse, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/dialog";

type Props = {
  poRequiredModal: Subplate | null;
  setPoRequiredModal: (plate: Subplate | null) => void;
  handleOpenCreatePOForPlate: (plate: Subplate) => void;
};

export function PurchaseRequiredModal({
  poRequiredModal,
  setPoRequiredModal,
  handleOpenCreatePOForPlate,
}: Props) {
  const { currentUser } = useAuth();
  const canBypass = Boolean(currentUser && [0, 1, 2, 5].includes(Number(currentUser.role_id)));
  const mutation = useUpdateSubplateMutation();
  const [error, setError] = useState("");
  const isOptional = Boolean(poRequiredModal && isPurchaseOptional(poRequiredModal));

  const close = () => {
    if (mutation.isPending) return;
    setError("");
    setPoRequiredModal(null);
  };

  const bypassPurchase = async () => {
    if (!poRequiredModal || mutation.isPending) return;
    setError("");
    try {
      await mutation.mutateAsync({ id: poRequiredModal.id, action: "bypass_purchase" });
      setPoRequiredModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm in-house material.");
    }
  };

  const worktypeLabel = poRequiredModal?.subplate_type === "repair"
    ? "Repair"
    : (poRequiredModal?.mould_worktype || "Rework");

  return (
    <Modal
      isOpen={Boolean(poRequiredModal)}
      onClose={close}
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {isOptional ? "Material Sourcing" : "Purchase Order Required"}
          </span>
          {isOptional && (
            <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/60 shrink-0">
              {worktypeLabel}
            </span>
          )}
        </div>
      }
      description={`Stage 2 • ${poRequiredModal?.platename || "Subplate"}`}
      size="md"
    >
      <div className="space-y-4 pt-1">
        {/* Subplate Metadata */}
        {poRequiredModal && (
          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 sm:p-3.5">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 text-xs">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
                  Subplate
                </span>
                <span className="font-bold text-slate-900 truncate block mt-0.5">
                  {poRequiredModal.platename}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
                  Material
                </span>
                <span className="font-semibold text-slate-800 truncate block mt-0.5">
                  {poRequiredModal.material || "MS-Bright"}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
                  Quantity
                </span>
                <span className="font-semibold text-slate-800 block mt-0.5">
                  {poRequiredModal.sqty || 1} pcs
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Optional Branch (Rework / Sample / Repair) with bypass privileges */}
        {isOptional && canBypass ? (
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Choose material source:
            </p>

            {/* Choice 1: In-House Material (Fast-track) */}
            <button
              type="button"
              onClick={bypassPurchase}
              disabled={mutation.isPending}
              className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-emerald-300/80 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-400 transition-all flex items-start gap-3.5 group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                {mutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Warehouse className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-950 transition-colors">
                    In-House Material
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    No PO Needed
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Material already at Star Mould (existing mould rework or spare stock). Clears Stage 2 &amp; 3 to unlock Programming.
                </p>
              </div>
            </button>

            {/* Choice 2: Commercial PO */}
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                if (poRequiredModal) {
                  const p = poRequiredModal;
                  close();
                  handleOpenCreatePOForPlate(p);
                }
              }}
              className="w-full text-left p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 transition-all flex items-start gap-3.5 group cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-950 transition-colors">
                    Generate Purchase Order
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                    Procure
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Order raw material from a vendor via commercial PO and standard Inward delivery flow.
                </p>
              </div>
            </button>
          </div>
        ) : (
          /* Mandatory PO Branch or User lacking bypass rights */
          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h4 className="text-sm font-bold text-blue-950">
                {isOptional ? "Purchase Order Required" : "Commercial PO Mandatory"}
              </h4>
              <p className="text-xs text-blue-800/90 leading-relaxed">
                {isOptional
                  ? "Rework in-house material clearance requires management or purchase permissions. Generate a PO to procure."
                  : "Fresh manufacturing subplates require a Purchase Order before raw material can be inwarded and programmed."}
              </p>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100">
          {isOptional && canBypass ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={close}
                disabled={mutation.isPending}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={mutation.isPending}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => {
                  if (poRequiredModal) {
                    const p = poRequiredModal;
                    close();
                    handleOpenCreatePOForPlate(p);
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Generate Purchase Order</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
