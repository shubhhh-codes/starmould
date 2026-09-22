"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PipelineStatGrid } from "@/components/dashboard/pipeline-stat-card";
import { MouldProjectsTable } from "@/components/dashboard/mould-projects-table";
import {
  Plus,
  RefreshCw,
  FolderKanban,
} from "lucide-react";
import Link from "next/link";
import type { ScanProject } from "@/lib/supabase/types";

export default function DashboardPage() {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ScanProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/scanning?limit=100");
      const data = await res.json();
      if (data.scans) {
        setProjects(data.scans);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard projects:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Pipeline summary numbers computed from live project data
  const stats = {
    scantotal: projects.filter((p) => p.status !== "completed").length,
    designby: projects.filter((p) => p.modeldesign_by && p.modeldesign_by !== 0).length,
    orderbytotal: projects.filter((p) => p.status === "pending").length,
    receivedqcby: projects.filter((p) => p.qc_by && p.qc_by !== 0).length,
    vmcworkby: projects.filter((p) => (p.model_hr || 0) > 0).length,
    drilltapworkby: projects.filter((p) => (p.scan_hr || 0) > 0).length,
    finalqcby: projects.filter((p) => p.status === "completed").length,
    packingworkby: projects.filter((p) => p.dispatchdate != null).length,
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
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/scanning"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Mould Entry</span>
          </Link>
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
              Active Project Register ({projects.length} Projects)
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

        <MouldProjectsTable
          initialData={projects}
          isLoading={isLoading}
          onRefresh={fetchDashboardData}
        />
      </div>
    </AppLayout>
  );
}

