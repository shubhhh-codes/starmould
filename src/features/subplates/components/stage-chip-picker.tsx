"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  X,
  Loader2,
  Lock,
  Check,
} from "lucide-react";
import type { User } from "@/lib/supabase/types";
import { STAGE_DEFINITIONS } from "@/lib/subplate-stages";
import { UserSession } from "@/components/providers/auth-provider";
import { formatTimestamp } from "../model/format-timestamp";

export const StageChipPicker = React.memo(
  function StageChipPicker({
    subplateId,
    stage,
    userId,
    userName,
    timestamp,
    staff,
    currentUser,
    isAdmin,
    onAssign,
  }: {
    subplateId: number;
    stage: (typeof STAGE_DEFINITIONS)[number];
    userId: number | null | undefined;
    userName?: string | null;
    timestamp?: string | null;
    staff: User[];
    currentUser: UserSession | null;
    isAdmin: boolean;
    onAssign: (subplateId: number, field: string, userId: number) => Promise<void>;
  }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [popoverCoords, setPopoverCoords] = useState<{
      top: number;
      left: number;
      placeAbove: boolean;
    } | null>(null);

    const triggerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const isAssigned = Boolean(userId && userId !== 0);
    const assignedUser = staff.find((u) => u.id === Number(userId));
    const isAssignedToMe = Boolean(currentUser?.id && Number(userId) === Number(currentUser.id));
    const isAssignedToOther = isAssigned && !isAssignedToMe;

    useEffect(() => {
      setIsMounted(true);
    }, []);

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        const target = event.target as Node;
        if (
          triggerRef.current &&
          !triggerRef.current.contains(target) &&
          popoverRef.current &&
          !popoverRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      }
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen || !triggerRef.current) return;

      const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const popoverHeight = 260;
        const spaceBelow = window.innerHeight - rect.bottom;
        const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

        const top = placeAbove ? rect.top - 4 : rect.bottom + 4;
        const popoverWidth = 240;
        let left = rect.left;
        if (stage.step >= 7) {
          left = rect.right - popoverWidth;
        } else if (stage.step >= 4) {
          left = rect.left + rect.width / 2 - popoverWidth / 2;
        }
        left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 12));

        setPopoverCoords({ top, left, placeAbove });
      };

      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }, [isOpen, stage.step]);

    const colorClasses: Record<string, { assigned: string; activeBadge: string }> = {
      blue: {
        assigned: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
        activeBadge: "bg-blue-100 text-blue-800",
      },
      amber: {
        assigned: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100",
        activeBadge: "bg-amber-100 text-amber-800",
      },
      emerald: {
        assigned: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
        activeBadge: "bg-emerald-100 text-emerald-800",
      },
      teal: {
        assigned: "bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100",
        activeBadge: "bg-teal-100 text-teal-800",
      },
      indigo: {
        assigned: "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100",
        activeBadge: "bg-indigo-100 text-indigo-800",
      },
      purple: {
        assigned: "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100",
        activeBadge: "bg-purple-100 text-purple-800",
      },
      violet: {
        assigned: "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100",
        activeBadge: "bg-violet-100 text-violet-800",
      },
      cyan: {
        assigned: "bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100",
        activeBadge: "bg-cyan-100 text-cyan-800",
      },
      rose: {
        assigned: "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100",
        activeBadge: "bg-rose-100 text-rose-800",
      },
    };

    const style = colorClasses[stage.color] || colorClasses.blue;

    const handleSelect = async (newUserId: number) => {
      try {
        setIsUpdating(true);
        await onAssign(subplateId, stage.key, newUserId);
        setIsOpen(false);
      } finally {
        setIsUpdating(false);
      }
    };

    const initials = assignedUser?.initials || (userName ? userName.slice(0, 2).toUpperCase() : null);

    const popoverAlign =
      stage.step <= 2
        ? "left-0"
        : stage.step >= 7
          ? "right-0"
          : "left-1/2 -translate-x-1/2";

    const tooltipTitle =
      isAssignedToOther && !isAdmin
        ? `${stage.label}: Assigned to ${assignedUser?.name || userName || "Staff"} (${formatTimestamp(timestamp)}) — Only Admin can reassign`
        : isAssignedToMe
          ? `${stage.label}: Assigned to You (${formatTimestamp(timestamp)}) — Click to manage`
          : isAssigned
            ? `${stage.label}: Assigned to ${assignedUser?.name || userName || "Staff"} (${formatTimestamp(timestamp)})`
            : !isAdmin
              ? `${stage.label}: Unassigned — Click to assign to yourself`
              : `${stage.label}: Unassigned — Click to assign`;

    return (
      <div ref={triggerRef} className="relative w-full min-w-0">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          title={tooltipTitle}
          className={`h-7 sm:h-7.5 w-full px-1 text-[10px] sm:text-[11px] font-mono font-bold rounded-lg border flex items-center justify-center gap-0.5 transition-all cursor-pointer select-none shadow-2xs ${isAssigned
            ? `${style.assigned} shadow-xs font-semibold`
            : "bg-slate-50/90 border-slate-200/90 text-slate-400 hover:text-slate-700 hover:bg-white hover:border-slate-300"
            }`}
        >
          {isUpdating ? (
            <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
          ) : isAssigned ? (
            <span className="truncate px-0.5">{initials || "✓"}</span>
          ) : (
            <span>{stage.short}</span>
          )}
        </button>

        {/* Floating Quick Assignment Popover rendered via Portal */}
        {isOpen && isMounted && popoverCoords && typeof document !== "undefined" && createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverCoords.placeAbove ? "auto" : `${popoverCoords.top}px`,
              bottom: popoverCoords.placeAbove ? `${Math.max(8, window.innerHeight - popoverCoords.top)}px` : "auto",
              left: `${popoverCoords.left}px`,
              width: "15rem",
              zIndex: 99999,
            }}
            className="bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 whitespace-normal select-none"
          >
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0 pr-1">
                <div className="font-bold text-slate-900 text-[11px] truncate">
                  {stage.label}
                </div>
                <div className="text-[9px] text-slate-400 truncate">
                  {isAssigned && timestamp ? formatTimestamp(timestamp) : !isAdmin ? "Self-Assignment" : "Select staff to assign"}
                </div>
              </div>
              {isAdmin && isAssigned ? (
                <button
                  type="button"
                  onClick={() => handleSelect(0)}
                  className="text-[10px] text-rose-500 hover:text-rose-700 font-medium flex items-center gap-0.5 shrink-0 cursor-pointer"
                  title="Unassign"
                >
                  <X className="w-2.5 h-2.5" /> Clear
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Case 1: Non-Admin, Assigned to Someone Else -> Read Only Lock Info */}
            {!isAdmin && isAssignedToOther ? (
              <div className="p-2.5 space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 font-bold border border-slate-200 shadow-2xs shrink-0">
                    {assignedUser?.initials || userName?.slice(0, 2).toUpperCase() || "ST"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 text-xs truncate">{assignedUser?.name || userName || "Assigned Staff"}</div>
                    {timestamp && <div className="text-[10px] text-slate-400 font-mono">{formatTimestamp(timestamp)}</div>}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-[11px] leading-snug text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 whitespace-normal">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="break-words leading-relaxed">Assigned to another team member. Only Admins can reassign this stage.</span>
                </div>
              </div>
            ) : !isAdmin ? (
              /* Case 2: Non-Admin, Unassigned or Assigned to Themselves */
              <div className="p-1.5 space-y-1">
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => handleSelect(Number(currentUser.id))}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer ${isAssignedToMe
                      ? `${style.activeBadge} font-bold`
                      : "bg-cyan-50/70 hover:bg-cyan-100/70 text-cyan-900 border border-cyan-200"
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-cyan-800 font-bold border border-cyan-200 shrink-0">
                        {currentUser.initials || currentUser.name?.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">{currentUser.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {isAssignedToMe ? "Assigned to You" : "Click to assign to yourself"}
                        </div>
                      </div>
                    </div>
                    {isAssignedToMe ? (
                      <Check className="w-4 h-4 text-cyan-700 shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-cyan-600 shrink-0" />
                    )}
                  </button>
                )}

                {isAssignedToMe && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-slate-500 bg-slate-50 rounded-lg border border-slate-200/80">
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Assigned to you • Only Admin can unassign</span>
                  </div>
                )}
              </div>
            ) : (
              /* Case 3: Admin -> Full Staff Selection List */
              <div className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => handleSelect(0)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${!isAssigned ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  <span className="italic text-slate-400">Unassigned</span>
                  {!isAssigned && <Check className="w-3.5 h-3.5 text-slate-600" />}
                </button>

                {staff.map((u) => {
                  const isSelected = Number(userId) === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSelect(u.id)}
                      className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-left text-xs transition group cursor-pointer ${isSelected ? `${style.activeBadge} font-bold` : "text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 shrink-0">
                          {u.initials || u.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="truncate font-medium text-slate-800 text-xs">
                          {u.name}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          document.body
        )}
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.subplateId === next.subplateId &&
      prev.userId === next.userId &&
      prev.userName === next.userName &&
      prev.timestamp === next.timestamp &&
      prev.isAdmin === next.isAdmin &&
      prev.currentUser?.id === next.currentUser?.id &&
      prev.stage.key === next.stage.key &&
      prev.staff === next.staff &&
      prev.onAssign === next.onAssign
    );
  });
