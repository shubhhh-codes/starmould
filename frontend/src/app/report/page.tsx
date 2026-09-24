"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  BarChart3,
  Calendar,
  Clock,
  Filter,
  Wrench,
  Zap,
  Sliders,
  Sparkles,
  UserX,
  Coffee,
  Ban,
  Scan,
  RotateCcw,
  CheckCircle,
  PenTool,
  Radio,
  Plane,
  RefreshCw,
  Loader2,
  AlertCircle,
  Package,
} from "lucide-react";
import {
  KpiCardSkeleton,
  TableSkeletonRows,
  CardGridSkeleton,
} from "@/components/ui/skeleton";

// Exact 7 downtime/hour categories tracked in ReportController.php
export interface MonthDowntimeHourRecord {
  month: string;
  vmc: number; // 0113_STM_002 VMC Fault Maintenance
  electric: number; // 0114_STM_003 Electric Fault
  setting: number; // 0115_STM_004 Setting Time
  chhol: number; // 0116_STM_005 Chhol Clearing
  operator: number; // 0117_STM_006 Operator Fault
  lunch: number; // 0120_STM_007 Lunch Time
  noanywork: number; // 0130_STM_008 No Any Work
  totalHours: number;
}

export default function ReportPage() {
  const [records, setRecords] = useState<MonthDowntimeHourRecord[]>([]);
  const [workflowCounts, setWorkflowCounts] = useState<{
    pulpMould: number;
    tf: number;
    rework: number;
    machinePart: number;
    accessories: number;
    sample: number;
    other: number;
    totalProjects: number;
  }>({
    pulpMould: 0,
    tf: 0,
    rework: 0,
    machinePart: 0,
    accessories: 0,
    sample: 0,
    other: 0,
    totalProjects: 0,
  });
  const [totalSubplates, setTotalSubplates] = useState(0);
  const [totalWorklogs, setTotalWorklogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/report");
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.downtimeRecords)) {
          setRecords(data.downtimeRecords);
        }
        if (data.workflowCounts) {
          setWorkflowCounts(data.workflowCounts);
        }
        if (data.totalSubplates !== undefined) {
          setTotalSubplates(data.totalSubplates);
        }
        if (data.totalWorklogs !== undefined) {
          setTotalWorklogs(data.totalWorklogs);
        }
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Totals for summary breakdown
  const totalVmc = records.reduce((acc, r) => acc + (r.vmc || 0), 0);
  const totalElectric = records.reduce((acc, r) => acc + (r.electric || 0), 0);
  const totalSetting = records.reduce((acc, r) => acc + (r.setting || 0), 0);
  const totalChhol = records.reduce((acc, r) => acc + (r.chhol || 0), 0);
  const totalOperator = records.reduce((acc, r) => acc + (r.operator || 0), 0);
  const totalLunch = records.reduce((acc, r) => acc + (r.lunch || 0), 0);
  const totalNoAnyWork = records.reduce((acc, r) => acc + (r.noanywork || 0), 0);
  const grandTotalHours = Math.round(
    records.reduce((acc, r) => acc + (r.totalHours || 0), 0) * 100
  ) / 100;

  const downtimeCategories = [
    {
      name: "VMC Fault Maintenance",
      code: "0113_STM_002",
      hours: Math.round(totalVmc * 100) / 100,
      color: "bg-purple-600 text-purple-600 border-purple-200",
      barColor: "bg-purple-600",
      icon: Wrench,
    },
    {
      name: "Electric Fault",
      code: "0114_STM_003",
      hours: Math.round(totalElectric * 100) / 100,
      color: "bg-amber-500 text-amber-600 border-amber-200",
      barColor: "bg-amber-500",
      icon: Zap,
    },
    {
      name: "Setting Time",
      code: "0115_STM_004",
      hours: Math.round(totalSetting * 100) / 100,
      color: "bg-blue-600 text-blue-600 border-blue-200",
      barColor: "bg-blue-600",
      icon: Sliders,
    },
    {
      name: "Chhol Clearing",
      code: "0116_STM_005",
      hours: Math.round(totalChhol * 100) / 100,
      color: "bg-pink-500 text-pink-600 border-pink-200",
      barColor: "bg-pink-500",
      icon: Sparkles,
    },
    {
      name: "Operator Fault",
      code: "0117_STM_006",
      hours: Math.round(totalOperator * 100) / 100,
      color: "bg-rose-600 text-rose-600 border-rose-200",
      barColor: "bg-rose-600",
      icon: UserX,
    },
    {
      name: "Lunch Time",
      code: "0120_STM_007",
      hours: Math.round(totalLunch * 100) / 100,
      color: "bg-cyan-600 text-cyan-600 border-cyan-200",
      barColor: "bg-cyan-600",
      icon: Coffee,
    },
    {
      name: "No Any Work",
      code: "0130_STM_008",
      hours: Math.round(totalNoAnyWork * 100) / 100,
      color: "bg-emerald-600 text-emerald-600 border-emerald-200",
      barColor: "bg-emerald-600",
      icon: Ban,
    },
  ];

  const workflowCards = [
    { label: "Pulp Mould Projects", count: workflowCounts.pulpMould, icon: Scan, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
    { label: "Rework / R.E.", count: workflowCounts.rework, icon: RotateCcw, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
    { label: "Thermoforming (TF)", count: workflowCounts.tf, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "Machine Parts", count: workflowCounts.machinePart, icon: PenTool, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
    { label: "Accessories & Tools", count: workflowCounts.accessories, icon: Radio, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/40" },
    { label: "Sample Work", count: workflowCounts.sample, icon: Plane, color: "text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 w-full max-w-[1700px] mx-auto">
        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
              <span>Reports & Analytics</span>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-300">ReportController.php</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Month-Wise Hours & Workflow Report
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Supabase Aggregation
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real downtime analysis (7 legacy codes) and scan workflow volume from `worklog` & `scan` tables.
            </p>
          </div>

          <button
            onClick={fetchReportData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Report</span>
          </button>
        </div>

        {/* Top Stat Summary Cards */}
        {isLoading ? (
          <KpiCardSkeleton count={6} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {workflowCards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex items-center gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                      {c.label}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                      {c.count}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Main Grid: Downtime Breakdown + Monthly Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 7 Downtime Category Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              7 Downtime Categories
            </h2>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
              {grandTotalHours} hrs total
            </span>
          </div>

          <div className="space-y-3">
            {downtimeCategories.map((cat, idx) => {
              const Icon = cat.icon;
              const percentage = grandTotalHours > 0 ? ((cat.hours / grandTotalHours) * 100).toFixed(1) : "0";
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({cat.code})</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{cat.hours} hrs</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cat.barColor}`}
                      style={{ width: `${Math.min(100, Number(percentage))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Monthly Downtime Hours Data Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Monthly Downtime Breakdown
              </h2>
              <span className="text-[11px] text-slate-400">
                Aggregated from {totalWorklogs} live `worklog` records
              </span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full">
            <table className="w-full min-w-[750px] text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">Month</th>
                  <th className="py-3 px-2 text-right">VMC</th>
                  <th className="py-3 px-2 text-right">Electric</th>
                  <th className="py-3 px-2 text-right">Setting</th>
                  <th className="py-3 px-2 text-right">Chhol</th>
                  <th className="py-3 px-2 text-right">Operator</th>
                  <th className="py-3 px-2 text-right">Lunch</th>
                  <th className="py-3 px-2 text-right">No Work</th>
                  <th className="py-3 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  <TableSkeletonRows columns={9} rows={6} />
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      No downtime records found in worklog data.
                    </td>
                  </tr>
                ) : (
                  records.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {r.month}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.vmc}h</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.electric}h</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.setting}h</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.chhol}h</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.operator}h</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.lunch}h</td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-slate-400">{r.noanywork}h</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/20">
                        {r.totalHours}h
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card-List Fallback (< md) */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <CardGridSkeleton count={3} />
            ) : records.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No downtime records found.
              </div>
            ) : (
              records.map((r, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
                      {r.month}
                    </span>
                    <span className="font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full text-xs border border-rose-200 dark:border-rose-900">
                      {r.totalHours} hrs total
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">VMC:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{r.vmc}h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Electric:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{r.electric}h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Setting:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{r.setting}h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Chhol:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{r.chhol}h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Operator:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{r.operator}h</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Lunch / Idle:</span>
                      <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{r.lunch + r.noanywork}h</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
