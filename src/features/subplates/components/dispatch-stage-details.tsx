"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { Truck, Printer } from "lucide-react";
import type { Subplate } from "@/lib/supabase/types";

type Props = Pick<SubplatePageContext,
  | "router"
> & {
  row: Subplate;
  isFullyDispatched: boolean;
  linkedDispatches: any[];
  dispatchedQty: number;
  totalQty: number;
  isPartialDispatch: boolean;
  remainingDispatchQty: number;
};

export function DispatchStageDetails({
  row,
  isFullyDispatched,
  linkedDispatches,
  dispatchedQty,
  totalQty,
  isPartialDispatch,
  router,
  remainingDispatchQty,
}: Props) {
  const mouldParam = encodeURIComponent(row.projectid || row.mold_code || "");

  if (isFullyDispatched) {
    if (linkedDispatches.length > 1) {
      return (
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
          {linkedDispatches.map((d: any, idx: number) => {
            const creatorName = d.created_by || (row as any).packing_workby_name || "Super Admin";
            const creatorInitials = creatorName.slice(0, 2).toUpperCase();
            return (
              <a
                key={d.dispatch_id || idx}
                href={d.print_url || `/print/dispatch/${d.dispatch_id || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Click to view Delivery Challan #${d.challanno}`}
                className="h-9 px-2 rounded-lg bg-emerald-50/80 border border-emerald-200/90 hover:border-emerald-400 hover:bg-emerald-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                    {creatorInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-900">
                      {creatorName}
                    </div>
                    <div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
                      #{d.challanno} • {d.qty} pcs
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Printer className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </a>
            );
          })}
        </div>
      );
    }

    const singleDispatch = linkedDispatches[0];
    const creatorName = singleDispatch?.created_by || (row as any).packing_workby_name || "Super Admin";
    const creatorInitials = creatorName.slice(0, 2).toUpperCase();

    return (
      <a
        href={singleDispatch?.print_url || (singleDispatch ? `/print/dispatch/${singleDispatch.dispatch_id || ""}` : "/dispatch")}
        target="_blank"
        rel="noopener noreferrer"
        title={singleDispatch ? `Click to view Delivery Challan #${singleDispatch.challanno}` : "Dispatched to Customer"}
        className="h-9 px-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
            {creatorInitials}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800 truncate leading-tight group-hover:text-emerald-900">
              {creatorName}
            </div>
            <div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
              {singleDispatch?.challanno ? `#${singleDispatch.challanno}` : "Delivery Challan"} • {dispatchedQty || totalQty} pcs
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Printer className="w-3.5 h-3.5 text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
        </div>
      </a>
    );
  }

  if (isPartialDispatch) {
    return (
      <div className="space-y-1.5">
        {linkedDispatches.length > 1 ? (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
            {linkedDispatches.map((d: any, idx: number) => {
              const creatorName = d.created_by || (row as any).packing_workby_name || "Super Admin";
              const creatorInitials = creatorName.slice(0, 2).toUpperCase();
              return (
                <a
                  key={d.dispatch_id || idx}
                  href={d.print_url || `/print/dispatch/${d.dispatch_id || ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Click to view Delivery Challan #${d.challanno}`}
                  className="h-9 px-2 rounded-lg bg-amber-50/80 border border-amber-200/90 hover:border-amber-400 hover:bg-amber-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      {creatorInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-900 truncate leading-tight group-hover:text-amber-950">
                        {creatorName}
                      </div>
                      <div className="text-[9px] font-mono text-amber-700 truncate font-semibold leading-none">
                        #{d.challanno} • {d.qty} pcs
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Printer className="w-3.5 h-3.5 text-amber-600 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    <Truck className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                </a>
              );
            })}
          </div>
        ) : linkedDispatches.length === 1 ? (
          <a
            href={linkedDispatches[0]?.print_url || `/print/dispatch/${linkedDispatches[0]?.dispatch_id || ""}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Click to view Delivery Challan #${linkedDispatches[0]?.challanno}`}
            className="h-9 px-2 rounded-lg bg-amber-50/70 border border-amber-200/80 hover:border-amber-400 hover:bg-amber-100/70 transition flex items-center justify-between gap-1.5 shadow-2xs group cursor-pointer"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                {(linkedDispatches[0]?.created_by || (row as any).packing_workby_name || "Super Admin").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-900 truncate leading-tight group-hover:text-amber-950">
                  {linkedDispatches[0]?.created_by || (row as any).packing_workby_name || "Super Admin"}
                </div>
                <div className="text-[9px] font-mono text-amber-700 truncate font-semibold leading-none">
                  #{linkedDispatches[0]?.challanno} • {linkedDispatches[0]?.qty} pcs
                </div>
              </div>
            </div>
            <span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.5 rounded font-mono shrink-0">
              {dispatchedQty}/{totalQty}
            </span>
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => router.push(`/dispatch?mould=${mouldParam}`)}
          className="w-full h-8 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer group"
        >
          <Truck className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
          <span className="truncate">Dispatch Rem. ({remainingDispatchQty} pcs)</span>
        </button>
      </div>
    );
  }

  // 0 pcs dispatched (Pending Delivery Challan)
  return (
    <button
      type="button"
      onClick={() => router.push(`/dispatch?mould=${mouldParam}`)}
      className="w-full h-9 px-2.5 rounded-lg border border-dashed border-rose-300 bg-rose-50/60 hover:bg-rose-100/80 text-rose-900 transition flex items-center justify-between gap-1 cursor-pointer shadow-2xs group"
      title="Create Customer Delivery Challan in Dispatch"
    >
      <span className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5 truncate">
        <Truck className="w-3.5 h-3.5 text-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
        <span className="truncate">Create Challan</span>
      </span>
      <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-100 border border-rose-200/80 px-1.5 py-0.5 rounded shrink-0">
        Pending
      </span>
    </button>
  );
}
