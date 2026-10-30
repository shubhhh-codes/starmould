"use client";

import React from "react";
import {
  PenTool,
  Boxes,
  Cpu,
  Wrench,
  Disc,
  CheckCheck,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";

export interface PipelineStageItem {
  id: string;
  label: string;
  fullLabel?: string;
  pendingCount: number;
  completedCount: number;
  partialCount?: number;
  icon: LucideIcon;
  colorTheme: {
    bg: string;
    border: string;
    badge: string;
    text: string;
    iconBg: string;
  };
}

interface PipelineStatGridProps {
  stats: {
    scantotal: number;
    designPending?: number;
    designCompleted?: number;
    orderPending?: number;
    orderCompleted?: number;
    orderPartial?: number;
    programmingPending?: number;
    programmingCompleted?: number;
    vmcPending?: number;
    vmcCompleted?: number;
    drilltapPending?: number;
    drilltapCompleted?: number;
    finalqcPending?: number;
    finalqcCompleted?: number;
    packingPending?: number;
    packingCompleted?: number;
    designby?: number;
    orderbytotal?: number;
    receivedqcby?: number;
    vmcworkby?: number;
    drilltapworkby?: number;
    finalqcby?: number;
    packingworkby?: number;
    designMoulds?: number;
    orderMoulds?: number;
    programmingMoulds?: number;
    vmcMoulds?: number;
    drilltapMoulds?: number;
    finalqcMoulds?: number;
    packingMoulds?: number;
  };
  activeStage?: string | null;
  onSelectStage?: (stageId: string | null) => void;
  isLoading?: boolean;
}

export function PipelineStatGrid({
  stats,
  activeStage,
  onSelectStage,
  isLoading = false,
}: PipelineStatGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 xl:gap-3 mb-6" suppressHydrationWarning>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white border border-slate-200 p-2 sm:p-2.5 xl:p-3 shadow-xs animate-pulse space-y-2.5"
            suppressHydrationWarning
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-14 bg-slate-200 rounded" />
              <div className="w-5 h-5 bg-slate-200 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-0.5 pt-1.5 border-t border-slate-100">
              <div className="space-y-1">
                <div className="h-4 w-7 mx-auto bg-slate-300 rounded" />
                <div className="h-2 w-9 mx-auto bg-slate-200 rounded" />
              </div>
              <div className="space-y-1 border-l border-slate-100">
                <div className="h-4 w-7 mx-auto bg-slate-300 rounded" />
                <div className="h-2 w-9 mx-auto bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const stages: PipelineStageItem[] = [
    {
      id: "design",
      label: "Design",
      fullLabel: "Design Order",
      pendingCount: stats.designPending ?? stats.designby ?? 0,
      completedCount: stats.designCompleted ?? 0,
      icon: PenTool,
      colorTheme: {
        bg: "hover:bg-blue-50/70",
        border: "border-blue-200/80",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        text: "text-blue-700",
        iconBg: "bg-blue-100/80 text-blue-600",
      },
    },
    {
      id: "order",
      label: "Purchase",
      fullLabel: "Purchase",
      pendingCount: stats.orderPending ?? stats.orderbytotal ?? 0,
      completedCount: stats.orderCompleted ?? 0,
      partialCount: stats.orderPartial ?? 0,
      icon: Boxes,
      colorTheme: {
        bg: "hover:bg-amber-50/70",
        border: "border-amber-200/80",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        text: "text-amber-700",
        iconBg: "bg-amber-100/80 text-amber-600",
      },
    },
    {
      id: "programming",
      label: "Programming",
      fullLabel: "Programming Work",
      pendingCount: stats.programmingPending ?? stats.receivedqcby ?? 0,
      completedCount: stats.programmingCompleted ?? 0,
      icon: Cpu,
      colorTheme: {
        bg: "hover:bg-indigo-50/70",
        border: "border-indigo-200/80",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        text: "text-indigo-700",
        iconBg: "bg-indigo-100/80 text-indigo-600",
      },
    },
    {
      id: "machining",
      label: "Machining",
      fullLabel: "Machining (VMC)",
      pendingCount: stats.vmcPending ?? stats.vmcworkby ?? 0,
      completedCount: stats.vmcCompleted ?? 0,
      icon: Wrench,
      colorTheme: {
        bg: "hover:bg-cyan-50/70",
        border: "border-cyan-200/80",
        badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
        text: "text-cyan-700",
        iconBg: "bg-cyan-100/80 text-cyan-600",
      },
    },
    {
      id: "drilltap",
      label: "Drill & Tap",
      fullLabel: "Drill & Tap",
      pendingCount: stats.drilltapPending ?? stats.drilltapworkby ?? 0,
      completedCount: stats.drilltapCompleted ?? 0,
      icon: Disc,
      colorTheme: {
        bg: "hover:bg-violet-50/70",
        border: "border-violet-200/80",
        badge: "bg-violet-50 text-violet-700 border-violet-200",
        text: "text-violet-700",
        iconBg: "bg-violet-100/80 text-violet-600",
      },
    },
    {
      id: "finalqc",
      label: "Final QC",
      fullLabel: "Final QC",
      pendingCount: stats.finalqcPending ?? stats.finalqcby ?? 0,
      completedCount: stats.finalqcCompleted ?? 0,
      icon: CheckCheck,
      colorTheme: {
        bg: "hover:bg-emerald-50/70",
        border: "border-emerald-200/80",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        text: "text-emerald-700",
        iconBg: "bg-emerald-100/80 text-emerald-600",
      },
    },
    {
      id: "packing",
      label: "Packing",
      fullLabel: "Packing",
      pendingCount: stats.packingPending ?? stats.packingworkby ?? 0,
      completedCount: stats.packingCompleted ?? 0,
      icon: PackageCheck,
      colorTheme: {
        bg: "hover:bg-rose-50/70",
        border: "border-rose-200/80",
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        text: "text-rose-700",
        iconBg: "bg-rose-100/80 text-rose-600",
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5 xl:gap-3 mb-6" suppressHydrationWarning>
      {stages.map((stage) => {
        const isSelected = activeStage === stage.id;
        const Icon = stage.icon;

        return (
          <div
            key={stage.id}
            suppressHydrationWarning
            onClick={() => onSelectStage?.(isSelected ? null : stage.id)}
            title={stage.fullLabel || stage.label}
            className={`card-interactive cursor-pointer rounded-xl bg-white border p-2 sm:p-2.5 xl:p-3 select-none transition-all duration-200 ${
              isSelected
                ? `ring-2 ring-blue-500 shadow-md border-blue-400 bg-blue-50/40 transform -translate-y-0.5`
                : `${stage.colorTheme.border} ${stage.colorTheme.bg}`
            }`}
          >
            {/* Header / Title */}
            <div className="flex items-center justify-between gap-1 mb-1.5 min-w-0">
              <span
                className={`min-w-0 text-[10.5px] sm:text-[11px] xl:text-xs font-semibold truncate ${
                  isSelected ? "text-blue-900 font-bold" : "text-slate-700"
                }`}
              >
                <span className="hidden 2xl:inline">{stage.fullLabel || stage.label}</span>
                <span className="2xl:hidden">{stage.label}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {stage.partialCount !== undefined && stage.partialCount > 0 && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs leading-none"
                    title={`${stage.partialCount} subplate(s) partially ordered`}
                  >
                    ⚡ {stage.partialCount}
                  </span>
                )}
                <div
                  className={`p-1 rounded-md ${stage.colorTheme.iconBg} shrink-0 transition-transform duration-150 ${
                    isSelected ? "scale-110" : ""
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </div>
              </div>
            </div>

            {/* Counts breakdown: Pending & Completed */}
            <div className="grid grid-cols-2 gap-0.5 pt-1.5 border-t border-slate-100 text-center">
              <div className="min-w-0 px-0.5">
                <div
                  className={`text-sm sm:text-base font-bold leading-tight ${
                    stage.pendingCount > 0 ? "text-amber-600" : "text-slate-800"
                  }`}
                  suppressHydrationWarning
                >
                  {stage.pendingCount}
                </div>
                <div className="text-[9px] xl:text-[10px] text-slate-500 font-medium tracking-tight truncate">
                  Pending
                </div>
              </div>
              <div className="min-w-0 px-0.5 border-l border-slate-100">
                <div
                  className={`text-sm sm:text-base font-bold leading-tight ${
                    stage.completedCount > 0 ? "text-emerald-600" : "text-slate-400"
                  }`}
                  suppressHydrationWarning
                >
                  {stage.completedCount}
                </div>
                <div className="text-[9px] xl:text-[10px] text-slate-500 font-medium tracking-tight truncate">
                  Completed
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
