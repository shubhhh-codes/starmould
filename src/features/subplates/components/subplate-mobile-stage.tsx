"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { formatTimestamp } from "@/features/subplates/model/format-timestamp";
import {
  CheckCircle2,
  Package,
  Lock,
  ShoppingCart,
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
> & { row: Subplate; stage: (typeof STAGE_DEFINITIONS)[number]; };

export function SubplateMobileStage({
  row,
  currentUser,
  activeStaff,
  handleOpenCreatePOForPlate,
  router,
  handleStageStaffChange,
  isAdmin,
  stage,
}: Props) {
  const val = (row as any)[stage.key];
  const timestamp = (row as any)[stage.atKey];
  const isAssigned = Boolean(val && val !== 0);
  const isAssignedToMe = Boolean(currentUser?.id && Number(val) === Number(currentUser.id));
  const isAssignedToOther = isAssigned && !isAssignedToMe;
  const isStage2 = stage.key === "order_by";
  const isStage3 = stage.key === "received_workby";
  const totalQty = Number(row.sqty) || 1;
  const orderedQty = row.ordered_qty ?? 0;
  const remainingQty = row.remaining_qty !== undefined ? row.remaining_qty : Math.max(0, totalQty - orderedQty);
  const isPartial = isStage2 && (row.po_status === "PARTIAL" || (orderedQty > 0 && remainingQty > 0));
  const isFullyOrdered = isStage2 && (row.po_status === "FULLY_ORDERED" || (orderedQty >= totalQty && orderedQty > 0));

  const inwardQty = Number((row as any).inward_qty ?? row.jobwork_balance?.po_inward_qty ?? 0);
  const remainingInwardQty = (row as any).remaining_inward_qty !== undefined ? (row as any).remaining_inward_qty : Math.max(0, totalQty - inwardQty);
  const isPartialInward = isStage3 && ((row as any).inward_status === "PARTIAL" || (inwardQty > 0 && remainingInwardQty > 0));
  const isFullyInwarded = isStage3 && ((row as any).inward_status === "FULLY_INWARDED" || (inwardQty >= totalQty && inwardQty > 0));

  if (isStage2) {
    const staffMember = activeStaff.find((u) => u.id === Number(val));
    const staffName = staffMember?.name || (row as any).order_by_name || (val ? `Staff #${val}` : "PO Created");
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
      return (
        <div
          key={stage.key}
          className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/90 shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                {stage.label}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono whitespace-nowrap">
                {linkedPOs.length > 1 ? `${linkedPOs.length} POs • All ${totalQty} pcs` : `All ${totalQty} pcs`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-slate-800 text-[11px] font-medium shrink-0 max-w-[140px] shadow-2xs">
              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                {staffInitials}
              </div>
              <span className="truncate font-semibold">{staffName}</span>
              <Lock className="w-3 h-3 text-emerald-600 shrink-0 ml-0.5" />
            </div>
          </div>

          <div className="pt-1.5 border-t border-emerald-100/80 space-y-1">
            {linkedPOs.length > 1 ? (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5">
                {linkedPOs.map((po, idx) => (
                  <a
                    key={po.po_id || idx}
                    href={`/purchase-inward?search=${encodeURIComponent(po.po_srno)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-[10px] text-slate-600 font-mono py-0.5 hover:text-emerald-700"
                  >
                    <span className="font-semibold text-emerald-800">
                      PO #{po.po_srno}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {po.qty} pcs
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <a
                href={`/purchase-inward?search=${encodeURIComponent(row.po_srno || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-emerald-800 block hover:underline"
              >
                {row.po_srno ? `PO #${row.po_srno}` : "PO"}
              </a>
            )}
            {timestamp && (
              <div className="text-[9px] text-slate-400 font-mono">
                {formatTimestamp(timestamp)}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isPartial) {
      return (
        <div
          key={stage.key}
          className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-300 shadow-2xs space-y-2"
        >
          {/* Tier 1: Title, Progress Pill & Staff Card */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                {stage.label}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-200/90 text-amber-900 font-mono whitespace-nowrap">
                {orderedQty}/{totalQty} pcs ordered
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-amber-200 text-slate-800 text-[11px] font-medium shrink-0 max-w-[130px] shadow-2xs">
              <div className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                {staffInitials}
              </div>
              <span className="truncate font-semibold">{staffName}</span>
            </div>
          </div>

          {/* Tier 2: PO number & timestamp on left, Action Button on right */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-200/60 text-[10px]">
            <div className="min-w-0 text-slate-500 font-mono flex-1">
              {linkedPOs.length > 1 ? (
                <div className="space-y-0.5 max-h-24 overflow-y-auto pr-0.5">
                  {linkedPOs.map((po, idx) => (
                    <a
                      key={po.po_id || idx}
                      href={`/purchase-inward?search=${encodeURIComponent(po.po_srno)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-[10px] py-0.5 hover:text-amber-900"
                    >
                      <span className="font-semibold text-amber-800">
                        PO #{po.po_srno}
                      </span>
                      <span className="text-amber-700 font-bold">
                        {po.qty} pcs
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <a
                  href={`/purchase-inward?search=${encodeURIComponent(row.po_srno || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-amber-800 hover:underline"
                >
                  {row.po_srno ? `PO #${row.po_srno}` : "PO"}
                </a>
              )}
              {timestamp && (
                <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                  {formatTimestamp(timestamp)}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleOpenCreatePOForPlate(row)}
              className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[10px] shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <ShoppingCart className="w-3 h-3" />
              <span>+ Order {remainingQty} pcs</span>
            </button>
          </div>
        </div>
      );
    }

    // Unordered
    return (
      <div
        key={stage.key}
        className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
            {stage.label}
          </div>
          <div className="text-[10px] text-amber-700 font-medium">
            PO required ({totalQty} pcs)
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleOpenCreatePOForPlate(row)}
          className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Create PO</span>
        </button>
      </div>
    );
  }

  if (isStage3) {
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
      return (
        <div
          key={stage.key}
          className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/90 shadow-2xs space-y-1.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                {stage.label}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono whitespace-nowrap">
                {linkedInwards.length > 1 ? `${linkedInwards.length} Receipts • All ${totalQty} pcs` : `All ${totalQty} pcs`}
              </span>
            </div>

            <a
              href={`/purchase-inward?mould=${mouldParam}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-slate-800 text-[11px] font-medium shrink-0 max-w-[140px] shadow-2xs hover:bg-emerald-50"
            >
              <div className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
                {staffInitials}
              </div>
              <span className="truncate font-semibold">{staffName}</span>
              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 ml-0.5" />
            </a>
          </div>
        </div>
      );
    }

    if (isPartialInward) {
      return (
        <div
          key={stage.key}
          className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-300 shadow-2xs space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                {stage.label}
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono whitespace-nowrap">
                Partial ({inwardQty}/{totalQty} pcs)
              </span>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/purchase-inward?mould=${mouldParam}`)}
              className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[10px] shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Package className="w-3 h-3" />
              <span>+ Inward {remainingInwardQty} pcs</span>
            </button>
          </div>
        </div>
      );
    }

    // 0 pcs inwarded
    return (
      <div
        key={stage.key}
        className="p-2 rounded-lg bg-sky-50/40 border border-sky-200/70 flex items-center justify-between gap-2"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-slate-800 truncate">
            {stage.label}
          </div>
          <div className="text-[10px] text-sky-700 font-medium">
            Gate Entry Required ({totalQty} pcs)
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/purchase-inward?mould=${mouldParam}`)}
          className="h-7 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Package className="w-3.5 h-3.5" />
          <span>Gate Inward</span>
        </button>
      </div>
    );
  }

  return (
    <div
      key={stage.key}
      className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-slate-800 truncate">
          {stage.label}
        </div>
        {isAssigned && timestamp && (
          <div className="text-[10px] text-slate-600 font-mono">
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>
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
                  initials: currentUser.initials || currentUser.name?.slice(0, 2).toUpperCase() || "ME",
                } as any,
              ]
              : []
        }
        disabled={!isAdmin && isAssignedToOther}
        color="blue"
        placeholder="Unassigned"
      />
    </div>
  );
}
