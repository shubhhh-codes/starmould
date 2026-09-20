"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PipelineStatGrid } from "@/components/dashboard/pipeline-stat-card";
import { MouldProjectsTable } from "@/components/dashboard/mould-projects-table";
import {
  Plus,
  RefreshCw,
  SlidersHorizontal,
  FolderKanban,
} from "lucide-react";
import type { ScanProject } from "@/lib/supabase/types";

// Realistic baseline data matching sm_prod MySQL dump records
const sampleProjects: ScanProject[] = [
  {
    id: 1,
    projectid: "0001_BSK_001",
    rdate: "2024-03-10",
    cdate: "2024-03-24",
    dispatchdate: "2024-03-25",
    cname: "Brijesh Kodinaria",
    customername: "Brijesh Kodinaria",
    description: "4 Cavity Medical Syringe Mould Core",
    note: "High precision finish required",
    scan_by: 2,
    qc_by: 1,
    modeldesign_by: 3,
    payment: 1,
    mail_done: 1,
    worktype: "Pulp Mould",
    scan_hr: 4,
    model_hr: 8,
    sr_scanhr: 0,
    sr_modelhr: 0,
    amount: 35000,
    status: "pending",
    subnote: "Material AL7075",
    created_at: "2024-03-10T10:00:00Z",
    created_by: 1,
    updated_at: "2024-03-15T14:30:00Z",
    total_plates: 8,
    completed_plates: 5,
  },
  {
    id: 2,
    projectid: "0033_VYS_001",
    rdate: "2024-03-12",
    cdate: "2024-03-28",
    dispatchdate: "2024-03-29",
    cname: "Vysali Polymers",
    customername: "Vysali Polymers",
    description: "12 Cavity Bottle Cap Insert Plate Set",
    note: "Hard anodizing after machining",
    scan_by: 2,
    qc_by: 1,
    modeldesign_by: 3,
    payment: 0,
    mail_done: 1,
    worktype: "Plastic Injection",
    scan_hr: 6,
    model_hr: 12,
    sr_scanhr: 0,
    sr_modelhr: 0,
    amount: 54000,
    status: "pending",
    subnote: "Standard tolerance +-0.01",
    created_at: "2024-03-12T11:20:00Z",
    created_by: 1,
    updated_at: "2024-03-16T09:10:00Z",
    total_plates: 12,
    completed_plates: 9,
  },
  {
    id: 3,
    projectid: "0035_RD_001",
    rdate: "2024-03-14",
    cdate: "2024-03-30",
    dispatchdate: "2024-03-31",
    cname: "R&D Tech Vadodara",
    customername: "R&D Tech Vadodara",
    description: "Automotive Dashboard Grill Mould Core",
    note: "VMC 5-axis required for curved contours",
    scan_by: 1,
    qc_by: 2,
    modeldesign_by: 3,
    payment: 1,
    mail_done: 0,
    worktype: "Blow Mould",
    scan_hr: 8,
    model_hr: 16,
    sr_scanhr: 0,
    sr_modelhr: 0,
    amount: 92000,
    status: "registered",
    subnote: "Steel P20",
    created_at: "2024-03-14T08:45:00Z",
    created_by: 2,
    updated_at: "2024-03-17T16:20:00Z",
    total_plates: 6,
    completed_plates: 3,
  },
  {
    id: 4,
    projectid: "0037_ARN_002",
    rdate: "2024-03-15",
    cdate: "2024-04-02",
    dispatchdate: "2024-04-03",
    cname: "Arnav Engineering",
    customername: "Arnav Engineering",
    description: "Thin Wall Food Container 2-Cavity Die",
    note: "Urgent committed delivery",
    scan_by: 2,
    qc_by: 1,
    modeldesign_by: 3,
    payment: 1,
    mail_done: 1,
    worktype: "Thermoforming",
    scan_hr: 5,
    model_hr: 10,
    sr_scanhr: 0,
    sr_modelhr: 0,
    amount: 48000,
    status: "pending",
    subnote: "Air vent drill required",
    created_at: "2024-03-15T09:30:00Z",
    created_by: 1,
    updated_at: "2024-03-18T11:00:00Z",
    total_plates: 10,
    completed_plates: 7,
  },
  {
    id: 5,
    projectid: "0044_JAE_002",
    rdate: "2024-03-18",
    cdate: "2024-04-05",
    dispatchdate: "2024-04-06",
    cname: "Jay Ambe Enterprises",
    customername: "Jay Ambe Enterprises",
    description: "Industrial Switch Outer Casing Plate",
    note: "Sample approval pending",
    scan_by: 2,
    qc_by: 1,
    modeldesign_by: 3,
    payment: 0,
    mail_done: 0,
    worktype: "Compression Mould",
    scan_hr: 3,
    model_hr: 7,
    sr_scanhr: 0,
    sr_modelhr: 0,
    amount: 28000,
    status: "pending",
    subnote: "Harden to 52 HRC",
    created_at: "2024-03-18T14:15:00Z",
    created_by: 1,
    updated_at: "2024-03-19T10:45:00Z",
    total_plates: 4,
    completed_plates: 2,
  },
  {
    id: 6,
    projectid: "0051_SKT_001",
    rdate: "2024-03-19",
    cdate: "2024-04-08",
    dispatchdate: "2024-04-09",
    cname: "Shakti Tools & Dies",
    customername: "Shakti Tools & Dies",
    description: "Dual Color Toothbrush Handle Base Mould",
    note: "Mirror EDM finish on cosmetic surface",
    scan_by: 1,
    qc_by: 2,
    modeldesign_by: 3,
    payment: 1,
    mail_done: 1,
    worktype: "Plastic Injection",
    scan_hr: 7,
    model_hr: 14,
    sr_scanhr: 0,
    sr_modelhr: 0,
    amount: 65000,
    status: "completed",
    subnote: "Passed CMM inspection",
    created_at: "2024-03-19T16:00:00Z",
    created_by: 2,
    updated_at: "2024-03-20T17:00:00Z",
    total_plates: 6,
    completed_plates: 6,
  },
];

export default function DashboardPage() {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [projects] = useState<ScanProject[]>(sampleProjects);

  // Pipeline summary numbers aligned with legacy ScanningController::index
  const stats = {
    scantotal: projects.filter((p) => p.status !== "completed").length,
    designby: 14,
    orderbytotal: 22,
    receivedqcby: 18,
    vmcworkby: 31,
    drilltapworkby: 19,
    finalqcby: 12,
    packingworkby: 7,
  };

  return (
    <AppLayout>
      {/* Breadcrumb & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
            <span>Manufacturing Execution</span>
            <span>/</span>
            <span className="text-slate-600">Production Dashboard</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Mould & Workpiece Pipeline
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Live Stage Tracking
            </span>
          </h1>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => alert("Opening Add New Mould dialog...")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Mould Entry</span>
          </button>
        </div>
      </div>

      {/* 7 Core Pipeline Stage Cards */}
      <PipelineStatGrid
        stats={stats}
        activeStage={activeStage}
        onSelectStage={setActiveStage}
      />

      {/* Main Dense Data Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              Active Project Register
            </h2>
            {activeStage && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Filtered by Stage: {activeStage.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            Click row actions to view subplate breakdowns or update stage completion
          </div>
        </div>

        <MouldProjectsTable initialData={projects} />
      </div>
    </AppLayout>
  );
}
