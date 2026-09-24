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
  mouldsCount: number;
  platesCount: number;
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
    designby: number;
    orderbytotal: number;
    receivedqcby: number;
    vmcworkby: number;
    drilltapworkby: number;
    finalqcby: number;
    packingworkby: number;
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 shadow-xs animate-pulse space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="w-6 h-6 bg-slate-200 dark:bg-slate-800 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <div className="h-4 w-8 mx-auto bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-2 w-10 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="space-y-1 border-l border-slate-100 dark:border-slate-800">
                <div className="h-4 w-8 mx-auto bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-2 w-10 mx-auto bg-slate-200 dark:bg-slate-800 rounded" />
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
      label: "Design Order",
      mouldsCount: stats.designMoulds ?? stats.scantotal,
      platesCount: stats.designby,
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
      label: "Material Order",
      mouldsCount: stats.orderMoulds ?? stats.scantotal,
      platesCount: stats.orderbytotal,
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
      mouldsCount: stats.programmingMoulds ?? stats.scantotal,
      platesCount: stats.receivedqcby,
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
      label: "Machining (VMC)",
      mouldsCount: stats.vmcMoulds ?? stats.scantotal,
      platesCount: stats.vmcworkby,
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
      mouldsCount: stats.drilltapMoulds ?? stats.scantotal,
      platesCount: stats.drilltapworkby,
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
      mouldsCount: stats.finalqcMoulds ?? stats.scantotal,
      platesCount: stats.finalqcby,
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
      mouldsCount: stats.packingMoulds ?? stats.scantotal,
      platesCount: stats.packingworkby,
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {stages.map((stage) => {
        const isSelected = activeStage === stage.id;
        const Icon = stage.icon;

        return (
          <div
            key={stage.id}
            onClick={() => onSelectStage?.(isSelected ? null : stage.id)}
            className={`cursor-pointer rounded-xl bg-white border p-3 transition-all duration-200 shadow-xs hover:shadow-md ${
              isSelected
                ? `ring-2 ring-blue-500 shadow-sm border-transparent bg-slate-50`
                : `${stage.colorTheme.border} ${stage.colorTheme.bg}`
            }`}
          >
            {/* Header / Title */}
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-semibold text-slate-700 truncate">
                {stage.label}
              </span>
              <div className={`p-1 rounded-md ${stage.colorTheme.iconBg} flex-shrink-0`}>
                <Icon className="h-3 w-3" />
              </div>
            </div>

            {/* Counts breakdown: Moulds & Plates */}
            <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-slate-100 text-center">
              <div>
                <div className="text-base font-bold text-slate-900 leading-tight">
                  {stage.mouldsCount}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Moulds</div>
              </div>
              <div className="border-l border-slate-100">
                <div className={`text-base font-bold leading-tight ${stage.colorTheme.text}`}>
                  {stage.platesCount}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">Plates</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
