"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X, Lock, Plus, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export interface StaffUser {
  id: number;
  name: string;
  initials?: string;
  username?: string;
  usertype?: string;
}

interface StaffSelectProps {
  value: number | null | undefined;
  onChange: (userId: number) => void;
  staff: StaffUser[];
  assignableStaff?: StaffUser[];
  placeholder?: string;
  disabled?: boolean;
  color?: "blue" | "cyan" | "purple" | "teal" | "indigo" | "slate";
  className?: string;
}

export function StaffSelect({
  value,
  onChange,
  staff,
  assignableStaff,
  placeholder = "Select",
  disabled = false,
  color = "blue",
  className = "",
}: StaffSelectProps) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentVal = value ? Number(value) : 0;
  const isAssigned = Boolean(currentVal && currentVal !== 0);
  const isAssignedToMe = Boolean(currentUser?.id && currentVal === Number(currentUser.id));
  const isAssignedToOther = Boolean(isAssigned && !isAssignedToMe);

  const selectedUser = staff.find((u) => u.id === currentVal);
  const displayStaff = assignableStaff || staff;

  // Color scheme variants matching StarMould theme
  const colorMap = {
    blue: {
      badge: "bg-blue-50 text-blue-700 border-blue-200",
      active: "bg-blue-50 text-blue-700",
      ring: "focus:ring-blue-500/30 focus:border-blue-500",
      dot: "bg-blue-500",
      accent: "text-blue-600",
      selfCard: "bg-blue-50/70 hover:bg-blue-100/80 text-blue-900 border-blue-200",
      selfIcon: "text-blue-600",
    },
    cyan: {
      badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
      active: "bg-cyan-50 text-cyan-700",
      ring: "focus:ring-cyan-500/30 focus:border-cyan-500",
      dot: "bg-cyan-500",
      accent: "text-cyan-600",
      selfCard: "bg-cyan-50/70 hover:bg-cyan-100/80 text-cyan-900 border-cyan-200",
      selfIcon: "text-cyan-600",
    },
    purple: {
      badge: "bg-purple-50 text-purple-700 border-purple-200",
      active: "bg-purple-50 text-purple-700",
      ring: "focus:ring-purple-500/30 focus:border-purple-500",
      dot: "bg-purple-500",
      accent: "text-purple-600",
      selfCard: "bg-purple-50/70 hover:bg-purple-100/80 text-purple-900 border-purple-200",
      selfIcon: "text-purple-600",
    },
    teal: {
      badge: "bg-teal-50 text-teal-700 border-teal-200",
      active: "bg-teal-50 text-teal-700",
      ring: "focus:ring-teal-500/30 focus:border-teal-500",
      dot: "bg-teal-500",
      accent: "text-teal-600",
      selfCard: "bg-teal-50/70 hover:bg-teal-100/80 text-teal-900 border-teal-200",
      selfIcon: "text-teal-600",
    },
    indigo: {
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      active: "bg-indigo-50 text-indigo-700",
      ring: "focus:ring-indigo-500/30 focus:border-indigo-500",
      dot: "bg-indigo-500",
      accent: "text-indigo-600",
      selfCard: "bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-900 border-indigo-200",
      selfIcon: "text-indigo-600",
    },
    slate: {
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      active: "bg-slate-100 text-slate-800",
      ring: "focus:ring-slate-500/30 focus:border-slate-500",
      dot: "bg-slate-500",
      accent: "text-slate-600",
      selfCard: "bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200",
      selfIcon: "text-slate-600",
    },
  };

  const scheme = colorMap[color] || colorMap.blue;

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  // Determine tooltip
  const hoverTooltip = disabled
    ? `${selectedUser ? `Assigned to ${selectedUser.name}` : "Unassigned"} (Locked)`
    : !isAdmin && isAssignedToOther
    ? `Assigned to ${selectedUser?.name || "another team member"} — Only Admins can reassign`
    : !isAdmin && isAssignedToMe
    ? `Assigned to You (${currentUser?.name}) — Click to manage`
    : !isAdmin
    ? "Unassigned — Click to assign to yourself"
    : selectedUser
    ? `${selectedUser.name} (${selectedUser.initials || selectedUser.name}) ${
        selectedUser.usertype ? `• ${selectedUser.usertype}` : ""
      }`
    : placeholder;

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        title={hoverTooltip}
        className={`group relative inline-flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-150 ${
          disabled
            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            : selectedUser
            ? `${scheme.badge} shadow-xs hover:border-slate-300`
            : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300"
        } ${scheme.ring} focus:outline-none focus:ring-2`}
      >
        <span className="truncate max-w-[90px] flex items-center gap-1">
          {selectedUser ? (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${scheme.dot} shrink-0`} />
              <span className="font-mono font-semibold tracking-wide">
                {selectedUser.initials || selectedUser.name}
              </span>
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        {disabled || (!isAdmin && isAssignedToOther) ? (
          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown
            className={`w-3 h-3 text-slate-400 transition-transform duration-150 shrink-0 ${
              isOpen ? "rotate-180 " + scheme.accent : "group-hover:text-slate-600"
            }`}
          />
        )}
      </button>

      {/* Popover / Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 focus:outline-none left-0 whitespace-normal">
          
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>{!isAdmin ? "Self-Assignment" : "Assign Staff"}</span>
            {((isAdmin && isAssigned) || isAssignedToMe) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(0);
                  setIsOpen(false);
                }}
                className="text-rose-500 hover:text-rose-700 flex items-center gap-0.5 text-[10px] normal-case font-medium cursor-pointer"
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

          {/* Body */}
          <div className="p-1.5">
            {/* Non-Admin Case 1: Assigned to Someone Else -> Read Only Notice */}
            {!isAdmin && isAssignedToOther ? (
              <div className="space-y-2 p-1">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 font-bold border border-slate-200 shadow-2xs shrink-0">
                    {selectedUser?.initials || selectedUser?.name?.slice(0, 2).toUpperCase() || "ST"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800 text-xs truncate">
                      {selectedUser?.name || "Assigned Staff"}
                    </div>
                    {selectedUser?.usertype && (
                      <div className="text-[10px] text-slate-400 truncate">{selectedUser.usertype}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-[11px] leading-snug text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 whitespace-normal">
                  <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span className="break-words leading-relaxed">
                    Assigned to another team member. Only Admins can reassign this task.
                  </span>
                </div>
              </div>
            ) : !isAdmin ? (
              /* Non-Admin Case 2: Unassigned or Assigned to Me -> Clean Button matching Image 2 */
              <div className="space-y-1.5">
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(Number(currentUser.id));
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer group ${
                      isAssignedToMe
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                        : scheme.selfCard
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[10px] px-2 py-1 rounded-md bg-white text-slate-800 font-bold border border-slate-200 shrink-0 shadow-2xs">
                        {currentUser.initials || currentUser.name?.slice(0, 5).toUpperCase() || "ME"}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate text-slate-900">
                          {currentUser.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isAssignedToMe ? "Assigned to you" : "Click to assign to yourself"}
                        </div>
                      </div>
                    </div>
                    {isAssignedToMe ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Plus className={`w-4 h-4 ${scheme.selfIcon} shrink-0 group-hover:scale-110 transition-transform`} />
                    )}
                  </button>
                )}

                {isAssignedToMe && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(0);
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <span className="font-medium text-[11px]">Unassign / Leave open</span>
                    <X className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                )}
              </div>
            ) : (
              /* Admin Case: Full Staff Selection List */
              <div className="max-h-56 overflow-y-auto overflow-x-hidden space-y-0.5 custom-scrollbar">
                {/* Unassigned / Default Option */}
                <button
                  type="button"
                  onClick={() => {
                    onChange(0);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                    !selectedUser
                      ? "bg-slate-100 text-slate-800 font-semibold"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-slate-400 italic">Unassigned</span>
                  {!selectedUser && <Check className="w-3.5 h-3.5 text-slate-600" />}
                </button>

                {displayStaff.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const titleText = `${u.name} (${u.initials || u.name}) ${
                    u.usertype ? `• ${u.usertype}` : ""
                  }`;

                  return (
                    <button
                      key={u.id}
                      type="button"
                      title={titleText}
                      onClick={() => {
                        onChange(u.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors group cursor-pointer ${
                        isSelected
                          ? `${scheme.active} font-semibold`
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                            isSelected
                              ? scheme.badge
                              : "bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-white"
                          }`}
                        >
                          {u.initials || u.name.slice(0, 5)}
                        </span>
                        <div className="truncate min-w-0">
                          <div className="truncate font-medium text-slate-800">
                            {u.name}
                          </div>
                          {u.usertype && (
                            <div className="text-[10px] text-slate-400 truncate">
                              {u.usertype}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <Check
                          className={`w-3.5 h-3.5 shrink-0 ${scheme.accent}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
