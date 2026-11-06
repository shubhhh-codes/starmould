"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { CheckCircle2, Package } from "lucide-react";
import type { Subplate } from "@/lib/supabase/types";

type Props = Pick<SubplatePageContext,
  | "activeStaff"
  | "router"
> & {
  val: any;
  row: Subplate;
  inwardQty: number;
  timestamp: any;
  isFullyInwarded: boolean;
  totalQty: number;
  isPartialInward: boolean;
  remainingInwardQty: any;
};

export function InwardStageDetails({
  activeStaff,
  val,
  row,
  inwardQty,
  timestamp,
  isFullyInwarded,
  totalQty,
  isPartialInward,
  router,
  remainingInwardQty,
}: Props) {
  const staffMember = activeStaff.find((u) => u.id === Number(val));
  const staffName = staffMember?.name || (row as any).received_workby_name || (val ? `Staff #${val}` : "Gate Inward");
  const staffInitials = staffMember?.initials || (row as any).received_workby_name?.slice(0, 2).toUpperCase() || "PI";
  const mouldParam = encodeURIComponent(row.subprojectid || (row as any).mould_project_code || (row as any).mold_code || "");

  const linkedInwards: any[] =
    row.linked_inwards && row.linked_inwards.length > 0
      ? row.linked_inwards
      : inwardQty > 0
        ? [
          {
            inward_id: 0,
            inward_no: "Gate Inward",
            qty: inwardQty,
            created_by: val,
            created_at: timestamp,
          },
        ]
        : [];

  if (isFullyInwarded) {
    if (linkedInwards.length > 1) {
      return (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {linkedInwards.map((inw, idx) => {
            const inwStaff = activeStaff.find((u) => u.id === Number(inw.created_by)) || staffMember;
            const inwStaffName = inwStaff?.name || (row as any).received_workby_name || staffName;
            const inwInitials = inwStaff?.initials || (row as any).received_workby_name?.slice(0, 2).toUpperCase() || staffInitials;
            return (
              <a
                key={inw.inward_id || idx}
                href={`/purchase-inward?mould=${mouldParam}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`View Inward #${inw.inward_no} in Purchase Inward`}
                className="h-9 px-2 rounded-lg bg-emerald-50/80 border border-emerald-200/90 hover:border-emerald-400 hover:bg-emerald-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                    {inwInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-900">
                      {inwStaffName}
                    </div>
                    <div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
                      {inw.inward_no ? `Inward #${inw.inward_no}` : "Inward"} • {inw.qty} pcs
                    </div>
                  </div>
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              </a>
            );
          })}
        </div>
      );
    }

    const singleInw = linkedInwards[0];
    const inwStaff = activeStaff.find((u) => u.id === Number(singleInw?.created_by)) || staffMember;
    const inwStaffName = inwStaff?.name || (row as any).received_workby_name || staffName;
    const inwInitials = inwStaff?.initials || (row as any).received_workby_name?.slice(0, 2).toUpperCase() || staffInitials;

    return (
      <a
        href={`/purchase-inward?mould=${mouldParam}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View Inward in Purchase Inward"
        className="h-9 px-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
            {inwInitials}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-900">
              {inwStaffName}
            </div>
            <div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
              {singleInw?.inward_no ? `Inward #${singleInw.inward_no}` : "Inward"} • {totalQty} pcs
            </div>
          </div>
        </div>
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
      </a>
    );
  }

  if (isPartialInward) {
    return (
      <div className="space-y-1.5">
        {linkedInwards.length > 1 ? (
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-0.5">
            {linkedInwards.map((inw, idx) => {
              const inwStaff = activeStaff.find((u) => u.id === Number(inw.created_by)) || staffMember;
              const inwStaffName = inwStaff?.name || (row as any).received_workby_name || staffName;
              const inwInitials = inwStaff?.initials || (row as any).received_workby_name?.slice(0, 2).toUpperCase() || staffInitials;
              return (
                <a
                  key={inw.inward_id || idx}
                  href={`/purchase-inward?mould=${mouldParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`View Inward #${inw.inward_no} in Purchase Inward`}
                  className="h-8 px-2 rounded-lg bg-amber-50/70 border border-amber-200/80 hover:border-amber-400 hover:bg-amber-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-4 h-4 rounded bg-amber-500 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                      {inwInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-slate-900 truncate leading-tight group-hover:text-amber-950">
                        {inwStaffName}
                      </div>
                      <div className="text-[8px] font-mono text-amber-700 truncate font-semibold leading-none">
                        {inw.inward_no ? `Inward #${inw.inward_no}` : "Inward"}
                      </div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-1 py-0.2 rounded font-mono shrink-0">
                    {inw.qty} pcs
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <a
            href={`/purchase-inward?mould=${mouldParam}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View Inward in Purchase Inward"
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
                  {linkedInwards[0]?.inward_no ? `Inward #${linkedInwards[0].inward_no}` : "Inward"}
                </div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.5 rounded font-mono shrink-0">
              {inwardQty}/{totalQty}
            </span>
          </a>
        )}
        <button
          type="button"
          onClick={() => router.push(`/purchase-inward?mould=${mouldParam}`)}
          className="w-full h-8 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer group"
        >
          <Package className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="truncate">Inward Rem. ({remainingInwardQty} pcs)</span>
        </button>
      </div>
    );
  }

  // 0 pcs inwarded (Uninwarded)
  return (
    <button
      type="button"
      onClick={() => router.push(`/purchase-inward?mould=${mouldParam}`)}
      className="w-full h-9 px-2.5 rounded-lg border border-dashed border-sky-300 bg-sky-50/60 hover:bg-sky-100/80 text-sky-900 transition flex items-center justify-between gap-1 cursor-pointer shadow-2xs group"
      title="Material Gate Entry Required in Purchase Inward"
    >
      <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5 truncate">
        <Package className="w-3.5 h-3.5 text-sky-600 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="truncate">Gate Inward</span>
      </span>
      <span className="text-[9px] font-mono font-bold text-sky-700 bg-sky-100 border border-sky-200/80 px-1.5 py-0.5 rounded shrink-0">
        Pending
      </span>
    </button>
  );
}
