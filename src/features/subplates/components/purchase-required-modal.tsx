"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { ShoppingCart } from "lucide-react";
import { Modal } from "@/components/ui/dialog";

type Props = Pick<SubplatePageContext,
  | "poRequiredModal"
  | "setPoRequiredModal"
  | "handleOpenCreatePOForPlate"
>;

export function PurchaseRequiredModal({
  poRequiredModal,
  setPoRequiredModal,
  handleOpenCreatePOForPlate,
}: Props) {
  return (
    <Modal
      isOpen={Boolean(poRequiredModal)}
      onClose={() => setPoRequiredModal(null)}
      title="Purchase Order Required"
      description={`Stage 2 • ${poRequiredModal?.platename || "Subplate"}`}
      size="md"
    >
      <div className="space-y-4 pt-1">
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h4 className="text-sm font-bold text-amber-950">Commercial PO Mandatory</h4>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              Stage 2 (Purchase) cannot be assigned manually. To assign this stage, please generate an official Purchase Order for this subplate.
            </p>
          </div>
        </div>

        {poRequiredModal && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-500">
              <span>Subplate Name:</span>
              <span className="font-bold text-slate-800">{poRequiredModal.platename}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Material:</span>
              <span className="font-semibold text-slate-700">{poRequiredModal.material || "MS-Bright"}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Required Qty:</span>
              <span className="font-semibold text-slate-700">{poRequiredModal.sqty || 1} pcs</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setPoRequiredModal(null)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (poRequiredModal) {
                const p = poRequiredModal;
                setPoRequiredModal(null);
                handleOpenCreatePOForPlate(p);
              }
            }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Generate Purchase Order</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
