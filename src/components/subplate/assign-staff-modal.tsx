"use client";

import React, { useState, useMemo } from "react";
import { Modal } from "@/components/ui/dialog";
import {
  UserCheck,
  UserX,
  Search,
  Sparkles,
  ShieldCheck,
  Check,
  Lock,
  Layers,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import type { Subplate, User } from "@/lib/supabase/types";
import type { StageDefinition } from "@/app/subplate/page";
import type { UserSession } from "@/components/providers/auth-provider";

interface AssignStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  subplate: Subplate | null;
  stage: StageDefinition | null;
  staff: User[];
  currentUser: UserSession | null;
  isAdmin: boolean;
  onAssign: (subplateId: number, field: string, userId: number) => Promise<void>;
  onCreatePO?: (subplate: Subplate) => void;
}

export function AssignStaffModal({
  isOpen,
  onClose,
  subplate,
  stage,
  staff,
  currentUser,
  isAdmin,
  onAssign,
  onCreatePO,
}: AssignStaffModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset search when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const currentAssignedId = subplate && stage ? Number((subplate as any)[stage.key]) || 0 : 0;
  const isAssigned = currentAssignedId > 0;
  const currentAssignedUser = staff.find((u) => u.id === currentAssignedId);

  // Filter active staff
  const activeStaff = useMemo(() => {
    return staff.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [staff]);

  // Recommended staff matching the stage role
  const recommendedStaff = useMemo(() => {
    if (!stage) return [];
    return activeStaff.filter((u) => {
      const uRoleId = Number(u.role_id);
      const uRoleName = (u.usertype || (u as any).role || "").toLowerCase();
      if (stage.roleId && uRoleId === stage.roleId) return true;
      if (stage.roleName && uRoleName.includes(stage.roleName.toLowerCase())) return true;
      return false;
    });
  }, [activeStaff, stage]);

  // Search filtered staff
  const filteredStaff = useMemo(() => {
    if (!searchQuery.trim()) return activeStaff;
    const q = searchQuery.toLowerCase().trim();
    return activeStaff.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.initials?.toLowerCase().includes(q) ||
        (u.usertype || (u as any).role || "").toLowerCase().includes(q)
    );
  }, [activeStaff, searchQuery]);

  if (!isOpen || !subplate || !stage) return null;

  // Strict rule: Stage 2 (Purchase) cannot be manually assigned without a PO, and is locked if PO exists
  if (stage.key === "order_by") {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isAssigned ? "Purchase Stage (Locked)" : "Purchase Order Required"}
        description={`Stage 2 • Subplate: ${subplate.platename} #${subplate.id} (${subplate.subprojectid || (subplate as any).mould_project_code || "Project"})`}
        size="md"
      >
        <div className="space-y-4 pt-2">
          {isAssigned ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900">Stage Locked by Purchase Order</h4>
                <p className="text-xs text-amber-800/80 leading-relaxed max-w-sm mx-auto">
                  This stage was automatically assigned to <span className="font-semibold">{currentAssignedUser?.name || `Staff #${currentAssignedId}`}</span> via Purchase Order {subplate.po_srno ? `(#${subplate.po_srno})` : ""}. It cannot be changed or unassigned manually.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Purchase Order Required</h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Stage 2 (Purchase) cannot be assigned manually. To assign this stage, please generate a Purchase Order for this subplate first.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                {onCreatePO && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCreatePO(subplate);
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Generate Purchase Order</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const handleSelectStaff = async (userId: number) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAssign(subplate.id, stage.key, userId);
      onClose();
    } catch {
      // error handled by parent caller
    } finally {
      setIsSubmitting(false);
    }
  };

  const stageCleanLabel = stage.label.replace(/^\d+\.\s*/, "");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign ${stageCleanLabel}`}
      description={`Stage ${stage.step} • Subplate: ${subplate.platename} #${subplate.id} (${subplate.subprojectid || (subplate as any).mould_project_code || "Project"})`}
      size="md"
    >
      <div className="space-y-4 pt-1">
        {/* Current Status banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Stage {stage.step}
            </span>
            <span className="font-bold text-slate-900">{stageCleanLabel}</span>
          </div>
          <div>
            {isAssigned ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3 h-3 text-emerald-600" />
                Assigned: {currentAssignedUser?.name || `Staff #${currentAssignedId}`}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Pending Assignment
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Quick Self-Assign for Logged-In User */}
        {currentUser && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                Quick Self-Assignment
              </span>
              {currentAssignedId === Number(currentUser.id) && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Currently Assigned to You
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={isSubmitting || currentAssignedId === Number(currentUser.id)}
              onClick={() => handleSelectStaff(Number(currentUser.id))}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                currentAssignedId === Number(currentUser.id)
                  ? "bg-white text-emerald-700 border border-emerald-300 opacity-90 cursor-default"
                  : "bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs hover:shadow"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">
                  {currentUser.initials || currentUser.name?.slice(0, 2).toUpperCase() || "ME"}
                </span>
                <span>Assign to Me ({currentUser.name})</span>
              </div>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search Input for Admin */}
        {isAdmin && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name, initials, or role..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        )}

        {/* Staff List */}
        {isAdmin ? (
          <div className="space-y-3">
            {/* Recommended for this Stage */}
            {!searchQuery && recommendedStaff.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 px-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  Recommended ({stage.roleName || "Department"})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {recommendedStaff.map((u) => {
                    const isSelected = u.id === currentAssignedId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSelectStaff(u.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-50/80 border-blue-400 ring-1 ring-blue-400 shadow-2xs font-bold"
                            : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold border border-blue-200 shrink-0">
                            {u.initials || u.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate text-xs">{u.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{u.usertype || (u as any).role || "Staff"}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Staff */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                {searchQuery ? `Matching Staff (${filteredStaff.length})` : "All Staff Members"}
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar border border-slate-200 rounded-xl p-1 bg-slate-50/50">
                {filteredStaff.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No active staff matching &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredStaff.map((u) => {
                    const isSelected = u.id === currentAssignedId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSelectStaff(u.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
                          isSelected
                            ? "bg-blue-500 text-white font-bold shadow-2xs"
                            : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {u.initials || u.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="font-semibold truncate">{u.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-normal shrink-0 ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-slate-50 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {u.usertype || (u as any).role || "Staff"}
                          </span>
                        </div>
                        {isSelected ? (
                          <Check className="w-4 h-4 shrink-0" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Non-Admin View: locked information if assigned to others */
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Non-admin staff can only assign tasks to themselves. Reassigning or assigning to other team members requires Administrator permissions.
            </span>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div>
            {isAdmin && isAssigned && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSelectStaff(0)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                Unassign Current Staff
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
