"use client";

import React, { useState, useMemo } from "react";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { PipelineStatGrid } from "@/components/dashboard/pipeline-stat-card";
import { MouldProjectsTable } from "@/components/dashboard/mould-projects-table";
import {
  Plus,
  RefreshCw,
  FolderKanban,
} from "lucide-react";
import Link from "next/link";
import type { Subplate } from "@/lib/supabase/types";
import { useProjectsQuery, useSubplatesQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { NewMouldModal } from "@/components/mould/new-mould-modal";

export default function DashboardPage() {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();

  // Standardized shared cache query hooks matching Scanning and Subplate modules
  const projectsQuery = useProjectsQuery({ pageSize: 500 });
  const subplatesQuery = useSubplatesQuery();

  const projects = projectsQuery.data?.scans || [];
  const subplates = subplatesQuery.data?.subplates || [];

  // Robust loading guard:
  // True while restoring from device storage, or when initial queries are pending and no data exists yet.
  // Never drops to false when data is empty unless query is genuinely settled with 0 items.
  const hasLoadedProjects = projects.length > 0 || (projectsQuery.isSuccess && !projectsQuery.isFetching);
  const hasLoadedSubplates = subplates.length > 0 || (subplatesQuery.isSuccess && !subplatesQuery.isFetching);
  const hasData = hasLoadedProjects && hasLoadedSubplates;

  const isLoading = isRestoring || (!hasData && (projectsQuery.isLoading || projectsQuery.isPending || subplatesQuery.isLoading || subplatesQuery.isPending));
  const isFetching = projectsQuery.isFetching || subplatesQuery.isFetching;
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isRefreshing = isManualRefreshing || isFetching;

  const handleRefresh = async () => {
    setIsManualRefreshing(true);
    const start = Date.now();
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() }),
        projectsQuery.refetch(),
        subplatesQuery.refetch(),
      ]);
    } finally {
      // Ensure the user visibly sees the refresh spinning animation for at least 700ms
      const elapsed = Date.now() - start;
      if (elapsed < 700) {
        setTimeout(() => setIsManualRefreshing(false), 700 - elapsed);
      } else {
        setIsManualRefreshing(false);
      }
    }
  };

  // Real pipeline metrics computed from subplate tracking records & active projects
  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status !== "completed");
    
    // Subplates with stage assignments (NOT NULL & > 0)
    const platesWithDesign = subplates.filter((sp) => sp.design_by && Number(sp.design_by) > 0);
    const platesWithOrder = subplates.filter((sp) => sp.order_by && Number(sp.order_by) > 0);
    const platesWithRecQC = subplates.filter((sp) => (sp.received_qcby && Number(sp.received_qcby) > 0) || (sp.received_workby && Number(sp.received_workby) > 0));
    const platesWithVMC = subplates.filter((sp) => sp.vmc_workby && Number(sp.vmc_workby) > 0);
    const platesWithDrillTap = subplates.filter((sp) => sp.drilltap_workby && Number(sp.drilltap_workby) > 0);
    const platesWithFinalQC = subplates.filter((sp) => sp.final_qcby && Number(sp.final_qcby) > 0);
    const platesWithPacking = subplates.filter((sp) => sp.packing_workby && Number(sp.packing_workby) > 0);

    // Count distinct mould projects per stage
    const countDistinctMoulds = (platesList: Subplate[]) => {
      const set = new Set(platesList.map((sp) => sp.projectid).filter(Boolean));
      return set.size;
    };

    return {
      scantotal: activeProjects.length,
      designby: platesWithDesign.length,
      orderbytotal: platesWithOrder.length,
      receivedqcby: platesWithRecQC.length,
      vmcworkby: platesWithVMC.length,
      drilltapworkby: platesWithDrillTap.length,
      finalqcby: platesWithFinalQC.length,
      packingworkby: platesWithPacking.length,
      // Real per-stage mould counts
      designMoulds: countDistinctMoulds(platesWithDesign) || activeProjects.length,
      orderMoulds: countDistinctMoulds(platesWithOrder) || activeProjects.length,
      programmingMoulds: countDistinctMoulds(platesWithRecQC) || activeProjects.length,
      vmcMoulds: countDistinctMoulds(platesWithVMC) || activeProjects.length,
      drilltapMoulds: countDistinctMoulds(platesWithDrillTap) || activeProjects.length,
      finalqcMoulds: countDistinctMoulds(platesWithFinalQC) || activeProjects.length,
      packingMoulds: countDistinctMoulds(platesWithPacking) || activeProjects.length,
    };
  }, [projects, subplates]);

  const displayedProjects = useMemo(() => {
    if (!activeStage) return projects;
    let targetPlates: Subplate[] = [];
    if (activeStage === "design") {
      targetPlates = subplates.filter((sp) => sp.design_by && Number(sp.design_by) > 0);
    } else if (activeStage === "order") {
      targetPlates = subplates.filter((sp) => sp.order_by && Number(sp.order_by) > 0);
    } else if (activeStage === "programming") {
      targetPlates = subplates.filter((sp) => (sp.received_qcby && Number(sp.received_qcby) > 0) || (sp.received_workby && Number(sp.received_workby) > 0));
    } else if (activeStage === "machining" || activeStage === "vmc") {
      targetPlates = subplates.filter((sp) => sp.vmc_workby && Number(sp.vmc_workby) > 0);
    } else if (activeStage === "drilltap") {
      targetPlates = subplates.filter((sp) => sp.drilltap_workby && Number(sp.drilltap_workby) > 0);
    } else if (activeStage === "finalqc") {
      targetPlates = subplates.filter((sp) => sp.final_qcby && Number(sp.final_qcby) > 0);
    } else if (activeStage === "packing") {
      targetPlates = subplates.filter((sp) => sp.packing_workby && Number(sp.packing_workby) > 0);
    }

    const matchingProjectIds = new Set(
      targetPlates.map((sp) => String(sp.projectid || "")).filter(Boolean)
    );
    const matchingSubprojectIds = new Set(
      targetPlates.map((sp) => String(sp.subprojectid || "")).filter(Boolean)
    );

    return projects.filter(
      (p) =>
        matchingProjectIds.has(String(p.id)) ||
        (p.projectid && matchingProjectIds.has(String(p.projectid))) ||
        (p.projectid && matchingSubprojectIds.has(String(p.projectid)))
    );
  }, [projects, subplates, activeStage]);

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
          </h1>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            suppressHydrationWarning
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition cursor-pointer shadow-xs ${
              isRefreshing
                ? "border-blue-300 bg-blue-50/70 text-blue-700"
                : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            }`}
          >
            <RefreshCw
              suppressHydrationWarning
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin-fast text-blue-600" : "text-slate-500"}`}
            />
            <span suppressHydrationWarning>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
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
        isLoading={isLoading}
      />

      {/* Main Dense Data Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Active Project Register
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200" suppressHydrationWarning>
              {displayedProjects.length} Projects
            </span>
            {activeStage && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Filtered by Stage: {activeStage.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">
            Click row actions to view subplate breakdowns or update stage completion
          </div>
        </div>

        <MouldProjectsTable
          initialData={displayedProjects}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      </div>

      {/* New Mould Entry Quick Modal */}
      <NewMouldModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        customers={projectsQuery.data?.customers}
        onSuccess={async () => {
          await Promise.all([
            projectsQuery.refetch(),
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() }),
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() }),
          ]);
        }}
      />
    </AppLayout>
  );
}

