"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Flame,
  Wrench,
  Box,
  Cog,
  FileCode2,
  Calendar,
  Plus,
  Clock,
  FileText,
  AlertCircle,
  Check,
  Copy,
  Loader2,
} from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { CustomerSelect } from "@/components/ui/customer-select";
import { appStore } from "@/lib/state/store";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import {
  useCreateProjectMutation,
  useCustomerDropdownQuery,
  useNextProjectIdQuery,
} from "@/lib/query/hooks";
import type { Customer } from "@/lib/supabase/types";

export type WorkType =
  | "Pulp Mould"
  | "TF"
  | "Rework"
  | "Accessories"
  | "Machine part"
  | "Other";

export interface NewMouldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdProject: any) => void;
  customers?: Customer[];
}

const WORK_TYPES: {
  id: WorkType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeBorder: string;
  activeBg: string;
}[] = [
  {
    id: "Pulp Mould",
    label: "Pulp Mould",
    icon: Layers,
    color: "text-blue-600",
    activeBorder: "border-blue-600 ring-2 ring-blue-500/20",
    activeBg: "bg-blue-50 text-blue-900 font-bold",
  },
  {
    id: "TF",
    label: "TF",
    icon: Flame,
    color: "text-amber-600",
    activeBorder: "border-amber-600 ring-2 ring-amber-500/20",
    activeBg: "bg-amber-50 text-amber-900 font-bold",
  },
  {
    id: "Rework",
    label: "Rework",
    icon: Wrench,
    color: "text-rose-600",
    activeBorder: "border-rose-600 ring-2 ring-rose-500/20",
    activeBg: "bg-rose-50 text-rose-900 font-bold",
  },
  {
    id: "Accessories",
    label: "Accessories",
    icon: Box,
    color: "text-purple-600",
    activeBorder: "border-purple-600 ring-2 ring-purple-500/20",
    activeBg: "bg-purple-50 text-purple-900 font-bold",
  },
  {
    id: "Machine part",
    label: "Machine part",
    icon: Cog,
    color: "text-emerald-600",
    activeBorder: "border-emerald-600 ring-2 ring-emerald-500/20",
    activeBg: "bg-emerald-50 text-emerald-900 font-bold",
  },
  {
    id: "Other",
    label: "Other",
    icon: FileCode2,
    color: "text-indigo-600",
    activeBorder: "border-indigo-600 ring-2 ring-indigo-500/20",
    activeBg: "bg-indigo-50 text-indigo-900 font-bold",
  },
];

export function NewMouldModal({
  isOpen,
  onClose,
  onSuccess,
  customers: propCustomers,
}: NewMouldModalProps) {
  // Fetch active customers matching exact legacy ERP (usertype = 'Customer')
  const dropdownQuery = useCustomerDropdownQuery("Customer");
  const customerList =
    propCustomers && propCustomers.length > 0
      ? propCustomers
      : (dropdownQuery.data as Customer[]) || [];

  const createProjectMutation = useCreateProjectMutation();

  const getToday = () => new Date().toISOString().split("T")[0];
  const getDatePlusDaysFrom = (baseDateStr: string, days: number) => {
    const d = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(d.getTime())) return getToday();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const [form, setForm] = useState({
    cname: "",
    worktype: "Pulp Mould" as WorkType,
    rdate: getToday(),
    cdate: getToday(),
    description: "",
    note: "",
  });

  const selectedCustomer = useMemo(() => {
    if (!form.cname) return null;
    return customerList.find((c) => String(c.id) === String(form.cname)) || null;
  }, [customerList, form.cname]);

  const nextIdQuery = useNextProjectIdQuery(
    form.cname,
    selectedCustomer?.initials,
    isOpen
  );

  const cidStr = nextIdQuery.data?.cidStr || "----";
  const isComplete = Boolean(
    form.cname && nextIdQuery.data?.isComplete && nextIdQuery.data?.previewCode
  );
  const isGenerating = Boolean(form.cname && nextIdQuery.isFetching);

  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission, refreshPermissions } = useRolePermissions();
  const canCreateProject = hasPermission("action_create_scanning_project");

  // Real-time permission revocation guard: if admin revokes permission while modal is open, auto-close!
  useEffect(() => {
    if (isOpen && !canCreateProject) {
      onClose();
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to create mould projects was revoked by administrator.",
        duration: 5000,
      });
    }
  }, [isOpen, canCreateProject, onClose]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = nextIdQuery.data?.previewCode || "";
    if (text) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fast keyboard & selection continuity
  const selectWorkTypeAndAdvance = (wtId: WorkType) => {
    setForm((prev) => ({ ...prev, worktype: wtId }));
    setTimeout(() => {
      document.getElementById("customer-select-input")?.focus();
    }, 20);
  };

  const handleWorkTypeKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    // Enter selects and advances directly to Customer Name
    if (e.key === "Enter") {
      e.preventDefault();
      selectWorkTypeAndAdvance(WORK_TYPES[index].id);
      return;
    }

    // Space selects the work type without advancing
    if (e.key === " ") {
      e.preventDefault();
      setForm((prev) => ({ ...prev, worktype: WORK_TYPES[index].id }));
      return;
    }

    // Arrow keys cycle and select
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % WORK_TYPES.length;
      const nextBtn = document.getElementById(`worktype-btn-${nextIndex}`);
      nextBtn?.focus();
      setForm((prev) => ({ ...prev, worktype: WORK_TYPES[nextIndex].id }));
      return;
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + WORK_TYPES.length) % WORK_TYPES.length;
      const prevBtn = document.getElementById(`worktype-btn-${prevIndex}`);
      prevBtn?.focus();
      setForm((prev) => ({ ...prev, worktype: WORK_TYPES[prevIndex].id }));
      return;
    }
  };

  // Reset form when modal opens & auto-focus the first work type box
  useEffect(() => {
    if (isOpen) {
      setForm({
        cname: "",
        worktype: "Pulp Mould",
        rdate: getToday(),
        cdate: getToday(),
        description: "",
        note: "",
      });
      setErrorMessage(null);
      setCopied(false);

      // Focus the first Work Type box immediately so Tab navigation works right away
      const focusTimer = setTimeout(() => {
        document.getElementById("worktype-btn-0")?.focus();
      }, 50);

      return () => clearTimeout(focusTimer);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createProjectMutation.isPending) return;
    if (!form.cname) {
      setErrorMessage("Please select a customer.");
      return;
    }
    if (!form.description.trim()) {
      setErrorMessage("Please enter the part description.");
      return;
    }

    try {
      setErrorMessage(null);
      const res = await createProjectMutation.mutateAsync({
        cname: form.cname,
        worktype: form.worktype,
        rdate: form.rdate,
        cdate: form.cdate,
        description: form.description.trim(),
        note: form.note.trim(),
      });

      const created = res?.scan || res?.project || res?.data || res;
      const assignedCode = created?.projectid || created?.id;
      if (assignedCode) {
        appStore.addToast({
          type: "success",
          message: `Project ${assignedCode} created successfully!`,
          duration: 4000,
        });
      }

      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err: any) {
      const errMsg = err?.message || "Failed to create project";
      if (
        errMsg.toLowerCase().includes("permission") ||
        errMsg.toLowerCase().includes("access denied") ||
        err?.status === 403
      ) {
        setErrorMessage("Access Denied: Your permission to create moulds was revoked by administrator.");
        appStore.addToast({
          type: "error",
          message: "Access Denied: Permission was revoked by administrator.",
          duration: 5000,
        });
        refreshPermissions();
        setTimeout(() => onClose(), 1200);
      } else {
        setErrorMessage(errMsg);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 truncate">
                Create New Mould Project
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full shrink-0">
                Mould Work
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">
              Initialize mould project and configure pipeline tracking
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* 1. Work Type Selection (Compact Segmented Pills with Full Tab & Keyboard Navigation) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Work Type <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              Tab to navigate · Enter to select
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" role="radiogroup" aria-label="Work Type">
            {WORK_TYPES.map((wt, idx) => {
              const Icon = wt.icon;
              const isSelected = form.worktype === wt.id;
              return (
                <button
                  type="button"
                  id={`worktype-btn-${idx}`}
                  key={wt.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  data-autofocus={idx === 0 ? "true" : undefined}
                  onClick={() =>
                    setForm((prev) => ({ ...prev, worktype: wt.id }))
                  }
                  onKeyDown={(e) => handleWorkTypeKeyDown(e, idx)}
                  className={`h-10 px-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 focus:border-blue-600 ${
                    isSelected
                      ? `${wt.activeBorder} ${wt.activeBg} shadow-xs font-bold`
                      : "bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isSelected ? "text-current" : wt.color
                      }`}
                    />
                    <span className="truncate font-semibold">{wt.label}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Customer Selection (Full Width - Exact Legacy Customer Filter) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Customer Name <span className="text-rose-500">*</span>
          </label>
          <CustomerSelect
            id="customer-select-input"
            customers={customerList}
            value={form.cname}
            onChange={(cId) => setForm((prev) => ({ ...prev, cname: cId }))}
            onSelectAdvance={() => {
              document.getElementById("received-date-input")?.focus();
            }}
            placeholder="Search or pick customer..."
            filterUserType="Customer"
            required
          />
        </div>

        {/* 3. Dates (Balanced 2 Columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Received Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>Received Date <span className="text-rose-500">*</span></span>
            </label>
            <input
              id="received-date-input"
              type="date"
              required
              value={form.rdate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, rdate: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("target-date-input")?.focus();
                }
              }}
              className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800 cursor-pointer"
            />
          </div>

          {/* Target / Committed Date with Inline Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Target Date <span className="text-rose-500">*</span></span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      cdate: getDatePlusDaysFrom(prev.rdate, 7),
                    }))
                  }
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                  title="Target in 7 days"
                >
                  +7d
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      cdate: getDatePlusDaysFrom(prev.rdate, 14),
                    }))
                  }
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                  title="Target in 14 days"
                >
                  +14d
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      cdate: getDatePlusDaysFrom(prev.rdate, 30),
                    }))
                  }
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                  title="Target in 30 days"
                >
                  +30d
                </button>
              </div>
            </div>
            <input
              id="target-date-input"
              type="date"
              required
              value={form.cdate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, cdate: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("part-description-input")?.focus();
                }
              }}
              className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800 cursor-pointer"
            />
          </div>
        </div>

        {/* 4. Part Description */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
            Part Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="part-description-input"
            required
            rows={2}
            placeholder="e.g. 8 Cavity Cap Mould Top Core Plate, 120 GSM pulp packaging..."
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 resize-none text-slate-800"
          />
        </div>

        {/* 5. Internal Notes / Instructions (Optional) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>Internal Note / Instructions</span>
            </label>
            <span className="text-[10px] text-slate-400 font-normal">Optional</span>
          </div>
          <textarea
            id="internal-note-input"
            rows={2}
            placeholder="Special machining instructions, material preference, client remarks..."
            value={form.note}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, note: e.target.value }))
            }
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 resize-none text-slate-800"
          />
        </div>

        {/* 6. Footer Action Bar (Responsive) */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
              Next ID:
            </span>

            {isComplete ? (
              <div
                role="status"
                aria-readonly="true"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50/90 text-emerald-800 text-xs font-mono font-bold tracking-wider select-all whitespace-nowrap shadow-xs transition-all"
                title="Tentative Project ID (computed from high-water mark; atomically confirmed upon submission)"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{nextIdQuery.data?.previewCode}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  title={copied ? "Copied to clipboard!" : "Copy tentative ID"}
                  className="ml-0.5 p-1 text-emerald-700 hover:text-emerald-950 rounded hover:bg-emerald-200/60 transition-colors cursor-pointer"
                  aria-label="Copy tentative Project ID"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  )}
                </button>
              </div>
            ) : isGenerating || (form.cname && selectedCustomer) ? (
              <div
                role="status"
                aria-readonly="true"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50/80 text-blue-700 text-xs font-mono whitespace-nowrap"
                title="Calculating tentative Project ID..."
              >
                <Loader2 className="w-3 h-3 animate-spin text-blue-600 shrink-0" />
                <span className="font-bold text-slate-800">{cidStr}</span>
                <span className="text-slate-300">_</span>
                <span className="font-semibold text-blue-800">
                  {selectedCustomer?.initials || "..."}
                </span>
                <span className="text-slate-400">_...</span>
              </div>
            ) : (
              <div
                role="status"
                aria-readonly="true"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-mono whitespace-nowrap select-none transition-all"
                title="Next sequence number reserved. Select customer to generate tentative project code."
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="font-bold text-slate-700">{cidStr}</span>
                <span className="text-slate-300">_</span>
                <span className="text-[11px] font-sans font-medium text-slate-400 italic">
                  select customer
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end w-full sm:w-auto shrink-0">
            <MotionButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={createProjectMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </MotionButton>
            <MotionButton
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createProjectMutation.isPending}
              loadingText="Creating Project..."
              successText="Project Created!"
              className="flex-1 sm:flex-none shadow-xs shadow-blue-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Mould Project</span>
            </MotionButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
