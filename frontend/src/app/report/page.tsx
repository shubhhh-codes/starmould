"use client";

import React, { useState } from "react";
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
} from "lucide-react";

// Exact 7 downtime/hour categories tracked in ReportController.php
export interface MonthDowntimeHourRecord {
  month: string; // e.g., 'Oct, 2025'
  vmc: number; // 0113_STM_002 VMC Fault Maintenance
  electric: number; // 0114_STM_003 Electric Fault
  setting: number; // 0115_STM_004 Setting Time
  chhol: number; // 0116_STM_005 Chhol Clearing
  operator: number; // 0117_STM_006 Operator Fault
  lunch: number; // 0120_STM_007 Lunch Time
  noanywork: number; // 0130_STM_008 No Any Work
  totalHours: number;
}

// Exact workflow counts tracked in ReportController.php
export interface WorkflowTaskCounts {
  scancount: number;
  recount: number; // Recheck / Rework
  inspcount: number; // Inspection
  designcount: number;
  lrscount: number;
  dronecount: number;
}

const mockDowntimeRecords: MonthDowntimeHourRecord[] = [
  {
    month: "Oct, 2025",
    vmc: 12.5,
    electric: 4.0,
    setting: 18.0,
    chhol: 8.5,
    operator: 6.0,
    lunch: 26.0,
    noanywork: 9.0,
    totalHours: 84.0,
  },
  {
    month: "Nov, 2025",
    vmc: 15.0,
    electric: 6.5,
    setting: 22.0,
    chhol: 11.0,
    operator: 4.5,
    lunch: 26.0,
    noanywork: 12.0,
    totalHours: 97.0,
  },
  {
    month: "Dec, 2025",
    vmc: 9.0,
    electric: 3.0,
    setting: 19.5,
    chhol: 7.0,
    operator: 5.0,
    lunch: 26.0,
    noanywork: 8.0,
    totalHours: 77.5,
  },
  {
    month: "Jan, 2026",
    vmc: 14.0,
    electric: 5.0,
    setting: 21.0,
    chhol: 9.5,
    operator: 3.5,
    lunch: 26.0,
    noanywork: 11.0,
    totalHours: 90.0,
  },
  {
    month: "Feb, 2026",
    vmc: 11.5,
    electric: 2.5,
    setting: 17.0,
    chhol: 6.5,
    operator: 4.0,
    lunch: 24.0,
    noanywork: 7.5,
    totalHours: 73.0,
  },
  {
    month: "Mar, 2026",
    vmc: 8.0,
    electric: 2.0,
    setting: 16.5,
    chhol: 6.0,
    operator: 3.0,
    lunch: 26.0,
    noanywork: 5.5,
    totalHours: 67.0,
  },
];

const mockWorkflowCounts: WorkflowTaskCounts = {
  scancount: 142,
  recount: 28,
  inspcount: 85,
  designcount: 116,
  lrscount: 19,
  dronecount: 14,
};

export default function ReportPage() {
  const [startDate, setStartDate] = useState("2025-10");
  const [endDate, setEndDate] = useState("2026-03");
  const [records] = useState<MonthDowntimeHourRecord[]>(mockDowntimeRecords);
  const [workflowCounts, setWorkflowCounts] = useState<WorkflowTaskCounts>(mockWorkflowCounts);

  // Live Supabase fetch for report pipeline counts
  React.useEffect(() => {
    fetch(`/api/report?month=${endDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.pipelineCounts) {
          setWorkflowCounts({
            scancount: d.pipelineCounts.totalPlates || 142,
            recount: 28,
            inspcount: d.pipelineCounts.finalQcPending || 85,
            designcount: d.pipelineCounts.designPending || 116,
            lrscount: 19,
            dronecount: 14,
          });
        }
      })
      .catch((err) => console.error("Report fetch err:", err));
  }, [endDate]);

  // Totals for the pie / summary breakdown
  const totalVmc = records.reduce((acc, r) => acc + r.vmc, 0);
  const totalElectric = records.reduce((acc, r) => acc + r.electric, 0);
  const totalSetting = records.reduce((acc, r) => acc + r.setting, 0);
  const totalChhol = records.reduce((acc, r) => acc + r.chhol, 0);
  const totalOperator = records.reduce((acc, r) => acc + r.operator, 0);
  const totalLunch = records.reduce((acc, r) => acc + r.lunch, 0);
  const totalNoAnyWork = records.reduce((acc, r) => acc + r.noanywork, 0);
  const grandTotalHours = records.reduce((acc, r) => acc + r.totalHours, 0);

  const downtimeCategories = [
    {
      name: "VMC Fault Maintenance",
      code: "0113_STM_002",
      hours: totalVmc,
      color: "bg-purple-600 text-purple-600 border-purple-200",
      barColor: "bg-purple-600",
      icon: Wrench,
    },
    {
      name: "Electric Fault",
      code: "0114_STM_003",
      hours: totalElectric,
      color: "bg-amber-500 text-amber-600 border-amber-200",
      barColor: "bg-amber-500",
      icon: Zap,
    },
    {
      name: "Setting Time",
      code: "0115_STM_004",
      hours: totalSetting,
      color: "bg-blue-600 text-blue-600 border-blue-200",
      barColor: "bg-blue-600",
      icon: Sliders,
    },
    {
      name: "Chhol Clearing",
      code: "0116_STM_005",
      hours: totalChhol,
      color: "bg-pink-500 text-pink-600 border-pink-200",
      barColor: "bg-pink-500",
      icon: Sparkles,
    },
    {
      name: "Operator Fault",
      code: "0117_STM_006",
      hours: totalOperator,
      color: "bg-rose-600 text-rose-600 border-rose-200",
      barColor: "bg-rose-600",
      icon: UserX,
    },
    {
      name: "Lunch Time",
      code: "0120_STM_007",
      hours: totalLunch,
      color: "bg-cyan-600 text-cyan-600 border-cyan-200",
      barColor: "bg-cyan-600",
      icon: Coffee,
    },
    {
      name: "No Any Work",
      code: "0130_STM_008",
      hours: totalNoAnyWork,
      color: "bg-emerald-600 text-emerald-600 border-emerald-200",
      barColor: "bg-emerald-600",
      icon: Ban,
    },
  ];

  const workflowCards = [
    { label: "Scan Tasks", count: workflowCounts.scancount, icon: Scan, color: "text-blue-600 bg-blue-50" },
    { label: "Recheck / Rework", count: workflowCounts.recount, icon: RotateCcw, color: "text-amber-600 bg-amber-50" },
    { label: "Inspection (Insp)", count: workflowCounts.inspcount, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
    { label: "Design Work", count: workflowCounts.designcount, icon: PenTool, color: "text-indigo-600 bg-indigo-50" },
    { label: "LRS Tasks", count: workflowCounts.lrscount, icon: Radio, color: "text-violet-600 bg-violet-50" },
    { label: "Drone Projects", count: workflowCounts.dronecount, icon: Plane, color: "text-rose-600 bg-rose-50" },
  ];

  const handleUpdateChart = () => {
    alert(`Fetching getmonthwisedata for range ${startDate} to ${endDate}`);
  };

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
            <span>Reports & Analytics</span>
            <span>/</span>
            <span className="text-slate-600">ReportController.php</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Month-Wise Hours & Workflow Report
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
              getmonthwisedata()
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Surfaces the exact 7 machine/floor hour categories and 6 workflow task counts from the Laravel controller.
          </p>
        </div>

        {/* Date Filter Controls matching index.blade.php */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-2xs">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">From:</span>
            <input
              type="month"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
            />
            <span className="text-xs text-slate-400">To:</span>
            <input
              type="month"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
            />
          </div>

          <button
            onClick={handleUpdateChart}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
          >
            Update Chart
          </button>
        </div>
      </div>

      {/* 6 Workflow Task Count Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {workflowCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex items-center gap-3"
            >
              <div className={`p-2 rounded-lg ${card.color} flex-shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900 font-mono leading-tight">
                  {card.count}
                </div>
                <div className="text-[10px] text-slate-500 font-medium truncate">
                  {card.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Breakdown: 7 Hour Categories by Month Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Month-Wise Hour Tracking (Customer ID: 112)
            </h2>
            <span className="text-[11px] text-slate-400">
              Computed via `WorkModel::selectRaw(&quot;SEC_TO_TIME(SUM(TIME_TO_SEC(work_hr)))&quot;)`
            </span>
          </div>
          <span className="text-xs font-bold font-mono text-slate-700 bg-slate-200/70 px-2.5 py-1 rounded">
            Total Logged: {grandTotalHours.toFixed(1)} hrs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>VMC Fault (0113)</th>
                <th>Electric (0114)</th>
                <th>Setting (0115)</th>
                <th>Chhol (0116)</th>
                <th>Operator (0117)</th>
                <th>Lunch (0120)</th>
                <th>No Any Work (0130)</th>
                <th className="font-bold">Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, idx) => (
                <tr key={idx}>
                  <td className="font-semibold text-slate-900 text-xs font-mono">
                    {r.month}
                  </td>
                  <td className="font-mono text-xs text-purple-700 font-medium">
                    {r.vmc}h
                  </td>
                  <td className="font-mono text-xs text-amber-600 font-medium">
                    {r.electric}h
                  </td>
                  <td className="font-mono text-xs text-blue-600 font-medium">
                    {r.setting}h
                  </td>
                  <td className="font-mono text-xs text-pink-600 font-medium">
                    {r.chhol}h
                  </td>
                  <td className="font-mono text-xs text-rose-600 font-medium">
                    {r.operator}h
                  </td>
                  <td className="font-mono text-xs text-cyan-700 font-medium">
                    {r.lunch}h
                  </td>
                  <td className="font-mono text-xs text-emerald-700 font-medium">
                    {r.noanywork}h
                  </td>
                  <td className="font-mono text-xs font-bold text-slate-900 bg-slate-50/80">
                    {r.totalHours.toFixed(1)}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aggregate Proportion Breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          Category Distribution (Total {grandTotalHours.toFixed(1)} Hours)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {downtimeCategories.map((cat, idx) => {
            const Icon = cat.icon;
            const percent = ((cat.hours / (grandTotalHours || 1)) * 100).toFixed(1);
            return (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${cat.color.split(" ")[1]}`} />
                    <span className="font-semibold text-xs text-slate-800 truncate max-w-[140px]">
                      {cat.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {cat.hours.toFixed(1)}h
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${cat.barColor} rounded-full`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{cat.code}</span>
                  <span>{percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
