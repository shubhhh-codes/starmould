"use client";

import { DispatchStageDetails } from "@/features/subplates/components/dispatch-stage-details";
import { InwardStageDetails } from "@/features/subplates/components/inward-stage-details";
import { PurchaseStageDetails } from "@/features/subplates/components/purchase-stage-details";
import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { formatTimestamp } from "@/features/subplates/model/format-timestamp";
import {
  CheckCircle2,
  Clock,
  Lock,
  Truck,
} from "lucide-react";
import { StaffSelect } from "@/components/ui/staff-select";
import { STAGE_DEFINITIONS } from "@/lib/subplate-stages";
import type { Subplate } from "@/lib/supabase/types";

type Props = Pick<SubplatePageContext,
  | "currentUser"
  | "activeStaff"
  | "handleOpenCreatePOForPlate"
  | "router"
  | "handleStageStaffChange"
  | "isAdmin"
> & { row: Subplate; stage: (typeof STAGE_DEFINITIONS)[number]; isRoleCard?: boolean; };

export function SubplateStageCard({
  row,
  currentUser,
  activeStaff,
  handleOpenCreatePOForPlate,
  router,
  handleStageStaffChange,
  isAdmin,
  stage,
  isRoleCard = false,
}: Props) {
  const val = (row as any)[stage.key];
  const timestamp = (row as any)[stage.atKey];
  const isAssigned = Boolean(val && val !== 0);
  const isAssignedToMe = Boolean(currentUser?.id && Number(val) === Number(currentUser.id));
  const isAssignedToOther = isAssigned && !isAssignedToMe;
  const isStage2 = stage.key === "order_by";
  const isStage3 = stage.key === "received_workby";
  const isStage9 = stage.key === "packing_workby";
  const totalQty = Number(row.sqty) || 1;
  const orderedQty = row.ordered_qty ?? 0;
  const remainingQty = row.remaining_qty !== undefined ? row.remaining_qty : Math.max(0, totalQty - orderedQty);
  const isPartial = isStage2 && (row.po_status === "PARTIAL" || (orderedQty > 0 && remainingQty > 0));
  const isFullyOrdered = isStage2 && (row.po_status === "FULLY_ORDERED" || (orderedQty >= totalQty && orderedQty > 0));

  const inwardQty = Number((row as any).inward_qty ?? row.jobwork_balance?.po_inward_qty ?? 0);
  const remainingInwardQty = (row as any).remaining_inward_qty !== undefined ? (row as any).remaining_inward_qty : Math.max(0, totalQty - inwardQty);
  const isPartialInward = isStage3 && ((row as any).inward_status === "PARTIAL" || (inwardQty > 0 && remainingInwardQty > 0));
  const isFullyInwarded = isStage3 && ((row as any).inward_status === "FULLY_INWARDED" || (inwardQty >= totalQty && inwardQty > 0));

  const linkedDispatches: any[] = (row as any).linked_dispatches || [];
  const dispatchedQty = Number(
    (row as any).dispatched_qty ??
    row.jobwork_balance?.customer_dispatched_qty ??
    linkedDispatches.reduce((s: number, d: any) => s + (Number(d.qty) || 0), 0)
  );
  const remainingDispatchQty = (row as any).remaining_dispatch_qty !== undefined
    ? Number((row as any).remaining_dispatch_qty)
    : Math.max(0, totalQty - dispatchedQty);
  const isPartialDispatch = isStage9 && Boolean((row as any).is_partial_dispatch || (row as any).dispatch_status === "partial" || (dispatchedQty > 0 && remainingDispatchQty > 0));
  const isFullyDispatched = isStage9 && Boolean((row as any).is_fully_dispatched || (row as any).dispatch_status === "dispatched" || (dispatchedQty >= totalQty && dispatchedQty > 0) || row.location === "Customer");
  const isDispatched = isStage9 && Boolean((row as any).is_dispatched || isFullyDispatched || isPartialDispatch || linkedDispatches.length > 0);

  const isCardPartial = isPartial || isPartialInward || isPartialDispatch;
  const isStageDone = isStage2 ? isFullyOrdered : isStage3 ? isFullyInwarded : isStage9 ? isFullyDispatched : isAssigned;

  return (
    <div
      key={stage.key}
      className={`p-4 rounded-xl border transition-all space-y-3.5 flex flex-col justify-between ${isRoleCard ? "shadow-sm bg-white ring-1 ring-blue-500/15" : ""
        } ${isCardPartial
          ? "bg-white border-amber-300 shadow-xs ring-1 ring-amber-400/20"
          : isStageDone
            ? "bg-white border-blue-200 shadow-xs ring-1 ring-blue-500/10"
            : "bg-white/80 border-slate-200 hover:border-slate-300"
        }`}
    >
      <div>
        {/* Step Header */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${isCardPartial
              ? "bg-amber-50 text-amber-700 border border-amber-200/80"
              : isStageDone
                ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                : "bg-slate-100 text-slate-500 border border-slate-200/60"
              }`}
          >
            Stage {stage.step}
          </span>
          {isStage2 ? (
            isFullyOrdered ? (
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : isPartial ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                Partial
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
            )
          ) : isStage3 ? (
            isFullyInwarded ? (
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Fully Inwarded</span>
              </div>
            ) : isPartialInward ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                Partial ({inwardQty}/{totalQty})
              </span>
            ) : isAssigned ? (
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Assigned</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Pending</span>
            )
          ) : isStage9 ? (
            isFullyDispatched ? (
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                <Truck className="w-4 h-4 shrink-0" />
                <span>Fully Dispatched</span>
              </div>
            ) : isPartialDispatch ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-mono">
                Partial ({dispatchedQty}/{totalQty})
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">Pending</span>
            )
          ) : isAssigned ? (
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Assigned</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Pending</span>
          )}
        </div>
        <div className="text-sm font-bold text-slate-900 leading-snug">
          {stage.label.replace(/^\d+\.\s*/, "")}
        </div>
      </div>

      {/* Middle: Staff / Action Section */}
      <div className="space-y-1.5 flex-1 flex flex-col justify-end">
        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
          Assigned Staff
        </label>
        {isStage2 ? (
          <PurchaseStageDetails
            activeStaff={activeStaff}
            val={val}
            row={row}
            orderedQty={orderedQty}
            totalQty={totalQty}
            isFullyOrdered={isFullyOrdered}
            isPartial={isPartial}
            handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
            remainingQty={remainingQty}
          />
        ) : isStage3 ? (
          <InwardStageDetails
            activeStaff={activeStaff}
            val={val}
            row={row}
            inwardQty={inwardQty}
            timestamp={timestamp}
            isFullyInwarded={isFullyInwarded}
            totalQty={totalQty}
            isPartialInward={isPartialInward}
            router={router}
            remainingInwardQty={remainingInwardQty}
          />
        ) : isStage9 ? (
          <DispatchStageDetails
            row={row}
            isFullyDispatched={isFullyDispatched}
            linkedDispatches={linkedDispatches}
            dispatchedQty={dispatchedQty}
            totalQty={totalQty}
            isPartialDispatch={isPartialDispatch}
            router={router}
            remainingDispatchQty={remainingDispatchQty}
          />
        ) : (
          <StaffSelect
            value={val}
            onChange={(userId) =>
              handleStageStaffChange(
                row.id,
                stage.key,
                userId
              )
            }
            staff={
              isAdmin
                ? activeStaff
                : currentUser
                  ? [
                    {
                      id: Number(currentUser.id),
                      name: currentUser.name || "Me",
                      initials:
                        currentUser.initials ||
                        currentUser.name?.slice(0, 2).toUpperCase() ||
                        "ME",
                    } as any,
                  ]
                  : []
            }
            disabled={!isAdmin && isAssignedToOther}
            color="blue"
            className="w-full"
            placeholder="Unassigned"
          />
        )}
      </div>

      {/* Timestamp Display */}
      <div className="pt-2 border-t border-slate-100 text-[10px]">
        {isStage9 && linkedDispatches.length > 0 ? (
          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[10px] font-medium truncate">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatTimestamp(linkedDispatches[linkedDispatches.length - 1]?.created_at || linkedDispatches[linkedDispatches.length - 1]?.date || timestamp)}</span>
          </div>
        ) : isAssigned && timestamp ? (
          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[10px] font-medium truncate">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatTimestamp(timestamp)}</span>
          </div>
        ) : isAssigned ? (
          <span className="text-blue-700 font-semibold text-[10px]">Assigned</span>
        ) : (
          <span className="text-slate-400 font-medium text-[10px]">Pending</span>
        )}
      </div>
    </div>
  );
}
