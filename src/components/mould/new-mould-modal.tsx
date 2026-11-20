"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  useProjectsQuery,
} from "@/lib/query/hooks";
import type { Customer } from "@/lib/supabase/types";
import { GhostDescriptionInput } from "@/components/mould/ghost-description-input";
import { learnMouldDescription } from "@/lib/mould-autocomplete";
import { Scale, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { ERPSelect, type ERPSelectOption } from "@/components/ui/erp-select";
import { RollingCounter } from "@/components/ui/rolling-counter";
import {
  calculateSubplateWeight,
  isHeightDisabled,
  getDimensionLabels,
  SUPPORTED_UNITS,
  SUPPORTED_SHAPES,
  MATERIAL_DENSITIES,
} from "@/lib/weight-calculator";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";

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
  const customerList = useMemo(() => {
    if (dropdownQuery.data) {
      return dropdownQuery.data as Customer[];
    }
    return (propCustomers || []) as Customer[];
  }, [dropdownQuery.data, propCustomers]);

  const createProjectMutation = useCreateProjectMutation();

  const getToday = () => new Date().toISOString().split("T")[0];
  const getDatePlusDaysFrom = (baseDateStr: string, days: number) => {
    const d = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(d.getTime())) return getToday();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    cname: "",
    worktype: "Pulp Mould" as WorkType,
    rdate: getToday(),
    cdate: getToday(),
    description: "",
    note: "",
  });

  interface InitialSubplate {
    id: string;
    platename: string;
    shape: string;
    material: string;
    length: string;
    width: string;
    height: string;
    weight: string;
    unit: string;
    sqty: string;
  }

  const [subplates, setSubplates] = useState<InitialSubplate[]>([]);
  const [showSubplatesSection, setShowSubplatesSection] = useState(false);

  const addInitialSubplate = () => {
    const nextIdx = subplates.length + 1;
    const newItem: InitialSubplate = {
      id: `new-sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      platename: `Plate ${nextIdx}`,
      shape: "Plate",
      material: "MS-Bright",
      length: "",
      width: "",
      height: "",
      weight: "",
      unit: "mm",
      sqty: "1",
    };
    setSubplates((prev) => [...prev, newItem]);
    setShowSubplatesSection(true);
  };

  const removeInitialSubplate = (id: string) => {
    setSubplates((prev) => prev.filter((p) => p.id !== id));
  };

  const duplicateInitialSubplate = (id: string) => {
    const target = subplates.find((p) => p.id === id);
    if (!target) return;
    const nextIdx = subplates.length + 1;
    const duplicated: InitialSubplate = {
      ...target,
      id: `new-sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      platename: `Plate ${nextIdx}`,
    };
    setSubplates((prev) => [...prev, duplicated]);
  };

  const updateInitialSubplate = (id: string, field: keyof InitialSubplate, value: string) => {
    setSubplates((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };
        if (field === "shape" && isHeightDisabled(value)) {
          updated.height = "";
        }
        if (["shape", "material", "length", "width", "height", "unit", "sqty"].includes(field)) {
          const wt = calculateSubplateWeight({
            shape: updated.shape,
            material: updated.material,
            length: updated.length,
            width: updated.width,
            height: updated.height,
            unit: updated.unit,
            quantity: updated.sqty,
          });
          updated.weight = wt > 0 ? wt.toFixed(3) : "";
        }
        return updated;
      })
    );
  };

  const shapeOptions: ERPSelectOption[] = SUPPORTED_SHAPES.map((s) => ({ value: s, label: s }));
  const materialOptions: ERPSelectOption[] = Object.keys(MATERIAL_DENSITIES).map((m) => ({
    value: m,
    label: m,
    subtitle: `${MATERIAL_DENSITIES[m] || 7.81} g/cm³`,
  }));
  const unitOptions: ERPSelectOption[] = SUPPORTED_UNITS.map((u) => ({ value: u, label: u }));

  const selectedCustomer = useMemo(() => {
    if (!form.cname) return null;
    return customerList.find((c) => String(c.id) === String(form.cname)) || null;
  }, [customerList, form.cname]);

  const nextIdQuery = useNextProjectIdQuery(
    form.cname,
    selectedCustomer?.initials,
    isOpen
  );

  // Fetch existing projects for live dynamic description suggestions
  const projectsQuery = useProjectsQuery({ enabled: isOpen, pageSize: 200 });
  const liveDescriptions = useMemo(() => {
    return (projectsQuery.data?.scans || [])
      .map((s) => s.description?.trim())
      .filter((d): d is string => Boolean(d));
  }, [projectsQuery.data?.scans]);

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

  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);

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
      setSubplates([]);
      setShowSubplatesSection(false);
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
    if (!selectedCustomer) {
      setErrorMessage("The selected customer is invalid or no longer exists. Please re-select from the list.");
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

      // Register new description for future smart autocomplete
      learnMouldDescription(form.description.trim(), form.worktype);

      const created = res?.scan || res?.project || res?.data || res;
      const assignedCode = created?.projectid || created?.id;
      if (assignedCode) {
        appStore.addToast({
          type: "success",
          message: `Project ${assignedCode} created successfully!`,
          duration: 4000,
        });
      }

      // If user configured any subplates, batch-create them now
      const validSubplates = subplates.filter((sp) => sp.platename.trim());
      if (created?.id && validSubplates.length > 0) {
        try {
          const baseCode = created.projectid || `PRJ${created.id}`;
          await fetch("/api/subplate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectid: created.id,
              subplates: validSubplates.map((sp, idx) => ({
                platename: sp.platename.trim(),
                subprojectid: `${baseCode}_${String(idx + 1).padStart(3, "0")}`,
                shape: sp.shape,
                material: sp.material,
                length: sp.length ? Number(sp.length) : null,
                width: sp.width ? Number(sp.width) : null,
                height: isHeightDisabled(sp.shape) || !sp.height ? null : Number(sp.height),
                weight: Number(sp.weight || "0") || null,
                unit: sp.unit || "mm",
                sqty: Math.max(1, parseInt(sp.sqty || "1", 10) || 1),
                location: "SM",
              })),
            }),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
          broadcastQueryInvalidation(queryKeys.subplates.all());
          appStore.addToast({
            type: "success",
            message: `Attached ${validSubplates.length} subplates to ${assignedCode || "mould"}`,
            duration: 4000,
          });
        } catch (subErr) {
          console.error("Failed to attach initial subplates", subErr);
        }
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
      maxWidth={subplates.length > 0 ? "2xl" : "xl"}
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
                  tabIndex={isSelected ? 0 : -1}
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

        {/* 4. Part Description with Inline Ghost Text Smart Autocomplete */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Part Description <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">Tab</kbd> or <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">→</kbd> to complete
            </span>
          </div>
          <GhostDescriptionInput
            id="part-description-input"
            required
            rows={2}
            placeholder="e.g. 8 Cavity Cap Mould Top Core Plate, 120 GSM pulp packaging..."
            value={form.description}
            worktype={form.worktype}
            liveDescriptions={liveDescriptions}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, description: val }))
            }
            onEnterAdvance={() => {
              document.getElementById("internal-note-input")?.focus();
            }}
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
            onKeyDown={(e) => {
              if (e.key === "Tab" && !e.shiftKey) {
                e.preventDefault();
                submitButtonRef.current?.focus();
              }
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all placeholder:text-slate-400 resize-none text-slate-800"
          />
        </div>

        {/* Subplates / Workpieces Section (Optional) */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 overflow-hidden transition-all">
          <div className="p-3 sm:p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Initial Subplates / Workpieces</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                </span>
                <p className="text-[10px] text-slate-500">
                  {subplates.length > 0
                    ? `${subplates.length} ${subplates.length === 1 ? "plate" : "plates"} configured for this mould`
                    : "Add plates now or configure later"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {subplates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowSubplatesSection((prev) => !prev)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg flex items-center gap-1 transition-all"
                >
                  <span>{showSubplatesSection ? "Hide Plates" : `Show Plates (${subplates.length})`}</span>
                  {showSubplatesSection ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={addInitialSubplate}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Subplate</span>
                </button>
              )}
            </div>
          </div>

          {showSubplatesSection && subplates.length > 0 && (
            <div className="p-3 sm:p-3.5 pt-0 space-y-3 border-t border-slate-200/60 bg-white/50">
              <div className="max-h-[300px] overflow-y-auto space-y-2.5 pr-1 mt-2.5">
                {subplates.map((plate, index) => {
                  const shape = plate.shape || "Plate";
                  const unit = plate.unit || "mm";
                  const dimLabels = getDimensionLabels(shape, unit);
                  const hDisabled = isHeightDisabled(shape);
                  const previewPrefix = nextIdQuery.data?.previewCode || "PRJ";
                  const itemCode = `${previewPrefix}_${String(index + 1).padStart(3, "0")}`;

                  return (
                    <div
                      key={plate.id}
                      className="p-3 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                            {itemCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateInitialSubplate(plate.id)}
                            title="Duplicate"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInitialSubplate(plate.id)}
                            title="Remove"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Plate Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Cavity Plate"
                            value={plate.platename}
                            onChange={(e) =>
                              updateInitialSubplate(plate.id, "platename", e.target.value)
                            }
                            className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Shape
                          </label>
                          <ERPSelect
                            value={plate.shape}
                            onChange={(val) => updateInitialSubplate(plate.id, "shape", String(val))}
                            options={shapeOptions}
                            showSearch={false}
                            placeholder="Shape"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Material
                          </label>
                          <ERPSelect
                            value={plate.material}
                            onChange={(val) => updateInitialSubplate(plate.id, "material", String(val))}
                            options={materialOptions}
                            showSearch={false}
                            placeholder="Material"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                            Qty
                          </label>
                          <RollingCounter
                            size="sm"
                            variant="input"
                            min={1}
                            max={9999}
                            value={Math.max(1, parseInt(plate.sqty || "1", 10) || 1)}
                            onChange={(val) => {
                              updateInitialSubplate(plate.id, "sqty", String(Math.max(1, val)));
                            }}
                            fullWidth
                          />
                        </div>
                      </div>

                      {/* Dimensions Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {dimLabels.isRound ? (
                          <>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.widthPlaceholder}
                                value={plate.width}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "width", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                OD
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.length}
                                value={plate.length}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "length", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                L
                              </span>
                            </div>
                            <div>
                              <input
                                type="text"
                                disabled
                                placeholder="—"
                                value=""
                                className="w-full h-8 pl-2.5 pr-6 rounded-lg text-xs font-mono font-bold bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                              />
                            </div>
                          </>
                        ) : dimLabels.isPipe ? (
                          <>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.widthPlaceholder}
                                value={plate.width}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "width", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-7 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                OD
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.heightPlaceholder}
                                value={plate.height}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "height", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                T
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.length}
                                value={plate.length}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "length", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                L
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.length}
                                value={plate.length}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "length", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                L
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.widthPlaceholder}
                                value={plate.width}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "width", clean);
                                }}
                                className="w-full h-8 pl-2.5 pr-6 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                W
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder={dimLabels.heightPlaceholder}
                                value={plate.height}
                                disabled={hDisabled}
                                onChange={(e) => {
                                  const clean = e.target.value.replace(/[^0-9.]/g, "");
                                  updateInitialSubplate(plate.id, "height", clean);
                                }}
                                className={"w-full h-8 pl-2.5 pr-6 rounded-lg text-xs font-mono font-bold " + (
                                  hDisabled
                                    ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                                    : "bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                )}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                                {hDisabled ? "—" : "H"}
                              </span>
                            </div>
                          </>
                        )}
                        <div>
                          <ERPSelect
                            value={plate.unit || "mm"}
                            onChange={(val) => updateInitialSubplate(plate.id, "unit", String(val))}
                            options={unitOptions}
                            showSearch={false}
                            placeholder="Unit"
                          />
                        </div>
                      </div>

                      {/* Compact Theoretical Weight */}
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Scale className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="text-[10px] font-bold text-slate-600 uppercase">Weight:</span>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {plate.weight ? `${plate.weight} kg` : "0.000 kg"}
                          </span>
                        </div>
                        {Number(plate.sqty) > 1 && Boolean(plate.weight) && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {(Number(plate.weight) / Number(plate.sqty)).toFixed(3)} kg/pc ({plate.sqty} pcs)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addInitialSubplate}
                className="w-full py-2 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Subplate</span>
              </button>
            </div>
          )}
        </div>

        {/* 6. Footer Action Bar (Responsive) */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100">
          {/* Action Buttons: Positioned first in tab order (Create -> Cancel), placed on right visually via flex order */}
          <div className="order-1 sm:order-2 flex items-center gap-2 justify-end w-full sm:w-auto shrink-0 flex-row-reverse">
            <MotionButton
              ref={submitButtonRef}
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createProjectMutation.isPending}
              loadingText="Creating Project..."
              successText="Project Created!"
              className="flex-1 sm:flex-none shadow-xs shadow-blue-500/20"
              onKeyDown={(e) => {
                if (e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  cancelButtonRef.current?.focus();
                } else if (e.key === "Tab" && e.shiftKey) {
                  e.preventDefault();
                  document.getElementById("internal-note-input")?.focus();
                }
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Mould Project</span>
            </MotionButton>
            <MotionButton
              ref={cancelButtonRef}
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={createProjectMutation.isPending}
              className="flex-1 sm:flex-none"
              onKeyDown={(e) => {
                if (e.key === "Tab" && !e.shiftKey) {
                  if (copyButtonRef.current) {
                    e.preventDefault();
                    copyButtonRef.current.focus();
                  }
                } else if (e.key === "Tab" && e.shiftKey) {
                  e.preventDefault();
                  submitButtonRef.current?.focus();
                }
              }}
            >
              Cancel
            </MotionButton>
          </div>

          {/* Next ID: Positioned after buttons in tab order, placed on left visually via flex order */}
          <div className="order-2 sm:order-1 flex items-center gap-2 min-w-0">
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
                  ref={copyButtonRef}
                  type="button"
                  onClick={handleCopy}
                  title={copied ? "Copied to clipboard!" : "Copy tentative ID"}
                  className="ml-0.5 p-1 text-emerald-700 hover:text-emerald-950 rounded hover:bg-emerald-200/60 transition-colors cursor-pointer"
                  aria-label="Copy tentative Project ID"
                  onKeyDown={(e) => {
                    if (e.key === "Tab" && e.shiftKey) {
                      e.preventDefault();
                      cancelButtonRef.current?.focus();
                    }
                  }}
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
        </div>
      </form>
    </Modal>
  );
}
