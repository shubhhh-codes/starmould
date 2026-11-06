"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { Lock, ShoppingCart } from "lucide-react";
import type { Subplate } from "@/lib/supabase/types";

type Props = Pick<SubplatePageContext,
  | "activeStaff"
  | "handleOpenCreatePOForPlate"
> & {
  val: any;
  row: Subplate;
  orderedQty: number;
  totalQty: number;
  isFullyOrdered: boolean;
  isPartial: boolean;
  remainingQty: number;
};

export function PurchaseStageDetails({
  activeStaff,
  val,
  row,
  orderedQty,
  totalQty,
  isFullyOrdered,
  isPartial,
  handleOpenCreatePOForPlate,
  remainingQty,
}: Props) {
  const staffMember = activeStaff.find((u) => u.id === Number(val));
  const staffName = staffMember?.name || (row as any).order_by_name || `Staff #${val}`;
  const staffInitials = staffMember?.initials || (row as any).order_by_name?.slice(0, 2).toUpperCase() || "PO";

  const linkedPOs: any[] =
    row.linked_pos && row.linked_pos.length > 0
      ? row.linked_pos
      : row.po_srno
        ? [
          {
            po_id: row.po_id || 0,
            po_srno: row.po_srno,
            qty: orderedQty || totalQty,
            created_by: row.order_by,
            created_at: (row as any).order_at,
          },
        ]
        : [];

  if (isFullyOrdered) {
    if (linkedPOs.length > 1) {
      return (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {linkedPOs.map((po, idx) => {
            const poStaff = activeStaff.find((u) => u.id === Number(po.created_by)) || staffMember;
            const poStaffName = poStaff?.name || (row as any).order_by_name || staffName;
            const poInitials = poStaff?.initials || (row as any).order_by_name?.slice(0, 2).toUpperCase() || staffInitials;
            return (
              <a
                key={po.po_id || idx}
                href={`/purchase-inward?search=${encodeURIComponent(po.po_srno)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Click to inward PO #${po.po_srno} in Purchase Inward`}
                className="h-9 px-2 rounded-lg bg-emerald-50/80 border border-emerald-200/90 hover:border-emerald-400 hover:bg-emerald-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                    {poInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-900">
                      {poStaffName}
                    </div>
                    <div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
                      PO #{po.po_srno} • {po.qty} pcs
                    </div>
                  </div>
                </div>
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              </a>
            );
          })}
        </div>
      );
    }

    const singlePO = linkedPOs[0];
    const poStaff = activeStaff.find((u) => u.id === Number(singlePO?.created_by)) || staffMember;
    const poStaffName = poStaff?.name || (row as any).order_by_name || staffName;
    const poInitials = poStaff?.initials || (row as any).order_by_name?.slice(0, 2).toUpperCase() || staffInitials;

    return (
      <a
        href={`/purchase-inward?search=${encodeURIComponent(singlePO?.po_srno || row.po_srno || "")}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`Click to inward PO #${singlePO?.po_srno || row.po_srno} in Purchase Inward`}
        className="h-9 px-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
            {poInitials}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-900">
              {poStaffName}
            </div>
            <div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
              {singlePO?.po_srno || row.po_srno ? `PO #${singlePO?.po_srno || row.po_srno}` : "PO"} • {totalQty} pcs
            </div>
          </div>
        </div>
        <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
      </a>
    );
  }

  if (isPartial) {
    return (
      <div className="space-y-1.5">
        {linkedPOs.length > 1 ? (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
            {linkedPOs.map((po, idx) => {
              const poStaff = activeStaff.find((u) => u.id === Number(po.created_by)) || staffMember;
              const poStaffName = poStaff?.name || (row as any).order_by_name || staffName;
              const poInitials = poStaff?.initials || (row as any).order_by_name?.slice(0, 2).toUpperCase() || staffInitials;
              return (
                <a
                  key={po.po_id || idx}
                  href={`/purchase-inward?search=${encodeURIComponent(po.po_srno)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Click to inward PO #${po.po_srno} in Purchase Inward`}
                  className="h-9 px-2 rounded-lg bg-amber-50/80 border border-amber-200/90 hover:border-amber-400 hover:bg-amber-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      {poInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-900 truncate leading-tight group-hover:text-amber-950">
                        {poStaffName}
                      </div>
                      <div className="text-[9px] font-mono text-amber-700 truncate font-semibold leading-none">
                        PO #{po.po_srno} • {po.qty} pcs
                      </div>
                    </div>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
                </a>
              );
            })}
          </div>
        ) : (
          <a
            href={`/purchase-inward?search=${encodeURIComponent(row.po_srno || "")}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Click to inward PO #${row.po_srno} in Purchase Inward`}
            className="h-9 px-2 rounded-lg bg-amber-50/70 border border-amber-200/80 hover:border-amber-400 hover:bg-amber-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                {staffInitials}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate leading-tight group-hover:text-amber-950">
                  {staffName}
                </div>
                <div className="text-[9px] font-mono text-amber-700 truncate font-semibold leading-none">
                  {row.po_srno ? `PO #${row.po_srno}` : "PO"}
                </div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.5 rounded font-mono shrink-0">
              {orderedQty}/{totalQty}
            </span>
          </a>
        )}
        <button
          type="button"
          onClick={() => handleOpenCreatePOForPlate(row)}
          className="w-full h-8 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer group"
        >
          <ShoppingCart className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="truncate">Order Rem. ({remainingQty} pcs)</span>
        </button>
      </div>
    );
  }

  // Unordered
  return (
    <button
      type="button"
      onClick={() => handleOpenCreatePOForPlate(row)}
      className="w-full h-9 px-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/80 text-amber-900 transition flex items-center justify-between gap-1 cursor-pointer shadow-2xs group"
    >
      <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 truncate">
        <ShoppingCart className="w-3.5 h-3.5 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="truncate">Create PO</span>
      </span>
      <span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-100 border border-amber-200/80 px-1.5 py-0.5 rounded shrink-0">
        {totalQty} pcs
      </span>
    </button>
  );
}
