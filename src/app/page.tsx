"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { motion } from "motion/react";
import { PipelineStatGrid } from "@/components/dashboard/pipeline-stat-card";
import { MouldProjectsTable } from "@/components/dashboard/mould-projects-table";
import {
  Plus,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
} from "lucide-react";
import { useProgressiveProjectsStream, useDashboardCountsQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import { NewMouldModal } from "@/components/mould/new-mould-modal";
import { clearLocalProjectsStore } from "@/lib/cache/projects-local-store";
import { appStore } from "@/lib/state/store";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";

/**
 * Buttery smooth animated counter using requestAnimationFrame with cubic deceleration
 */
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const targetValue = value;
    if (startValue === targetValue) return;

    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }

    const diff = Math.abs(targetValue - startValue);
    const duration = Math.min(650, Math.max(300, diff * 1.5));
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutCubic: fast responsive start, soft landing
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (targetValue - startValue) * ease));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <span className="tabular-nums font-mono">{displayValue.toLocaleString()}</span>;
}

/**
 * Buttery smooth progress pill:
 * 1. Counts smoothly from current count to target count using requestAnimationFrame (no 50-jump shock).
 * 2. Progress bar glides continuously with CSS spring easing & linear-gradient shine.
 */
function SmoothProgressPill({
  loadedCount,
  totalCount,
}: {
  loadedCount: number;
  totalCount: number;
}) {
  const [animatedLoaded, setAnimatedLoaded] = useState(loadedCount);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startVal = animatedLoaded;
    const targetVal = loadedCount;
    if (startVal === targetVal) return;

    if (targetVal === 0) {
      setAnimatedLoaded(0);
      return;
    }

    const diff = Math.abs(targetVal - startVal);
    const duration = Math.min(750, Math.max(350, diff * 1.8));
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart: ultra smooth deceleration
      const ease = 1 - Math.pow(1 - progress, 4);
      setAnimatedLoaded(Math.round(startVal + (targetVal - startVal) * ease));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [loadedCount]);

  const pct = totalCount > 0 ? Math.min(100, Math.round((animatedLoaded / totalCount) * 100)) : 0;

  return (
    <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-blue-50/90 border border-blue-200/80 text-xs text-blue-700 shadow-2xs backdrop-blur-xs transition-all duration-300">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
      </span>
      <span className="font-medium tracking-tight">
        Loading moulds: <span className="font-mono tabular-nums font-semibold">{animatedLoaded.toLocaleString()}</span> / {totalCount.toLocaleString()}
      </span>
      <div className="w-16 bg-blue-200/80 rounded-full h-1.5 overflow-hidden p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 bg-[length:200%_100%] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();
  const canCreateProject = hasPermission("action_create_scanning_project");
  const canDeleteMould = hasPermission("action_delete_mould");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // If user visits with ?fresh in URL, reset local store for cold-start testing
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("fresh")) {
      clearLocalProjectsStore().then(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
    }
  }, []);

  // Enterprise Local-First Progressive Streaming & Incremental Delta Sync:
  // 1. Instantly renders all cached moulds in 0ms from local storage (IndexedDB).
  // 2. On refresh / sync, strictly queries `/api/scanning?since=lastSyncTime` for delta updates only.
  // 3. Old records are NEVER re-fetched or re-queried from the database.
  const projectsStream = useProgressiveProjectsStream({ initialChunkSize: 100 });
  const countsQuery = useDashboardCountsQuery();

  const projects = projectsStream.scans;

  // On browser hard-refresh / reload, immediately sync live KPI counts.
  // Note: projectsStream hydration + deltaSync is handled automatically on mount in hooks.ts.
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        const isReload = navEntries.length > 0 && navEntries[0].type === "reload";
        if (isReload) {
          countsQuery.refetch();
        }
      } catch {}
    }
  }, []);

  // Ultra-fast loading guard:
  // If data exists in local storage (warm start), loading is false in 0ms!
  const isLoading = isRestoring || (projectsStream.isLoading && projects.length === 0);
  const isFetching = projectsStream.isFetching || countsQuery.isFetching;
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isRefreshing = isManualRefreshing || isFetching;

  // Manual refresh button strictly runs an Incremental Delta Sync:
  // If user holds Shift + clicks Refresh, it clears local cache and executes live chunk streaming!
  const handleRefresh = async (e?: React.MouseEvent) => {
    setIsManualRefreshing(true);
    const start = Date.now();
    try {
      if (e?.shiftKey) {
        await clearLocalProjectsStore();
        queryClient.clear();
        window.location.reload();
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      await Promise.all([
        projectsStream.refetch(),
        countsQuery.refetch(),
      ]);
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < 600) {
        setTimeout(() => setIsManualRefreshing(false), 600 - elapsed);
      } else {
        setIsManualRefreshing(false);
      }
    }
  };

  // Optimistic Instant Removal (0ms UI lag) + Cascade Deletion
  const handleDeleteProject = async (id: number | string): Promise<boolean> => {
    const original = projectsStream.scans.find((p) => String(p.id) === String(id) || Number(p.id) === Number(id));

    // 1. Capture the CURRENT lastSyncTime BEFORE removal so we can use it for
    //    post-delete delta sync. removeProjectLocally now preserves lastSyncTime
    //    in IndexedDB so the delta sync correctly detects this deletion via activeIds.
    const syncTimeBefore = projectsStream.lastSyncTime;

    // 2. Instantly remove row from local state and IndexedDB (optimistic, 0ms UI lag)
    await projectsStream.removeProjectLocally(id);

    try {
      const res = await fetch(`/api/scanning?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete mould project");
      }
      // 3. After successful server delete, run a lightweight delta sync using the
      //    pre-delete syncTime. This confirms the deletion via activeIds and updates
      //    lastSyncTime to the current server time — preventing ghost re-appearances.
      if (syncTimeBefore) {
        projectsStream.syncDelta(syncTimeBefore);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      return true;
    } catch (err: any) {
      // 4. Rollback if delete fails
      if (original) {
        await projectsStream.restoreProjectLocally(original);
      }
      appStore.addToast({
        type: "error",
        message: err.message || "Failed to delete mould project",
      });
      return false;
    }
  };

  // Real pipeline metrics computed directly via fast Supabase database RPC (300 bytes, ~15ms)
  // Eliminates 2.18MB client-side bulk subplate download!
  const stats = useMemo(() => {
    const pipeline = countsQuery.data?.pipeline;
    if (pipeline) {
      return {
        scantotal: Number(pipeline.scantotal ?? 0),
        designPending: Number(pipeline.designPending ?? pipeline.designby ?? 0),
        designCompleted: Number(pipeline.designCompleted ?? 0),
        orderPending: Number(pipeline.orderPending ?? pipeline.orderbytotal ?? 0),
        orderCompleted: Number(pipeline.orderCompleted ?? 0),
        programmingPending: Number(pipeline.programmingPending ?? pipeline.receivedqcby ?? 0),
        programmingCompleted: Number(pipeline.programmingCompleted ?? 0),
        vmcPending: Number(pipeline.vmcPending ?? pipeline.vmcworkby ?? 0),
        vmcCompleted: Number(pipeline.vmcCompleted ?? 0),
        drilltapPending: Number(pipeline.drilltapPending ?? pipeline.drilltapworkby ?? 0),
        drilltapCompleted: Number(pipeline.drilltapCompleted ?? 0),
        finalqcPending: Number(pipeline.finalqcPending ?? pipeline.finalqcby ?? 0),
        finalqcCompleted: Number(pipeline.finalqcCompleted ?? 0),
        packingPending: Number(pipeline.packingPending ?? pipeline.packingworkby ?? 0),
        packingCompleted: Number(pipeline.packingCompleted ?? 0),
        designby: Number(pipeline.designby ?? 0),
        orderbytotal: Number(pipeline.orderbytotal ?? 0),
        receivedqcby: Number(pipeline.receivedqcby ?? 0),
        vmcworkby: Number(pipeline.vmcworkby ?? 0),
        drilltapworkby: Number(pipeline.drilltapworkby ?? 0),
        finalqcby: Number(pipeline.finalqcby ?? 0),
        packingworkby: Number(pipeline.packingworkby ?? 0),
        designMoulds: Number(pipeline.designMoulds ?? pipeline.scantotal ?? 0),
        orderMoulds: Number(pipeline.orderMoulds ?? pipeline.scantotal ?? 0),
        programmingMoulds: Number(pipeline.programmingMoulds ?? pipeline.scantotal ?? 0),
        vmcMoulds: Number(pipeline.vmcMoulds ?? pipeline.scantotal ?? 0),
        drilltapMoulds: Number(pipeline.drilltapMoulds ?? pipeline.scantotal ?? 0),
        finalqcMoulds: Number(pipeline.finalqcMoulds ?? pipeline.scantotal ?? 0),
        packingMoulds: Number(pipeline.packingMoulds ?? pipeline.scantotal ?? 0),
      };
    }
    return {
      scantotal: 0,
      designPending: 0,
      designCompleted: 0,
      orderPending: 0,
      orderCompleted: 0,
      programmingPending: 0,
      programmingCompleted: 0,
      vmcPending: 0,
      vmcCompleted: 0,
      drilltapPending: 0,
      drilltapCompleted: 0,
      finalqcPending: 0,
      finalqcCompleted: 0,
      packingPending: 0,
      packingCompleted: 0,
      designby: 0,
      orderbytotal: 0,
      receivedqcby: 0,
      vmcworkby: 0,
      drilltapworkby: 0,
      finalqcby: 0,
      packingworkby: 0,
      designMoulds: 0,
      orderMoulds: 0,
      programmingMoulds: 0,
      vmcMoulds: 0,
      drilltapMoulds: 0,
      finalqcMoulds: 0,
      packingMoulds: 0,
    };
  }, [countsQuery.data?.pipeline]);

  // Stage filtering based on department-wise pending backlog queues
  const displayedProjects = useMemo(() => {
    if (!activeStage) return projects;

    return projects.filter((p) => {
      const plates = p.subplates || [];
      if (activeStage === "design") {
        return plates.some((sp) => !sp.design_by || Number(sp.design_by) === 0);
      } else if (activeStage === "order") {
        return plates.some((sp) => !sp.order_by || Number(sp.order_by) === 0);
      } else if (activeStage === "programming") {
        return plates.some(
          (sp) =>
            ((sp.order_by && Number(sp.order_by) > 0) || (sp.received_workby && Number(sp.received_workby) > 0)) &&
            (!sp.received_qcby || Number(sp.received_qcby) === 0)
        );
      } else if (activeStage === "machining" || activeStage === "vmc") {
        return plates.some(
          (sp) =>
            sp.received_qcby && Number(sp.received_qcby) > 0 &&
            (!sp.vmc_workby || Number(sp.vmc_workby) === 0)
        );
      } else if (activeStage === "drilltap") {
        return plates.some(
          (sp) =>
            sp.vmc_workby && Number(sp.vmc_workby) > 0 &&
            (!sp.drilltap_workby || Number(sp.drilltap_workby) === 0)
        );
      } else if (activeStage === "finalqc") {
        return plates.some(
          (sp) =>
            sp.drilltap_workby && Number(sp.drilltap_workby) > 0 &&
            (!sp.final_qcby || Number(sp.final_qcby) === 0)
        );
      } else if (activeStage === "packing") {
        return plates.some(
          (sp) =>
            sp.final_qcby && Number(sp.final_qcby) > 0 &&
            (!sp.packing_workby || Number(sp.packing_workby) === 0)
        );
      }
      return true;
    });
  }, [projects, activeStage]);

  return (
    <AppLayout>
      {/* Breadcrumb & Action Header with Corbel Text Roll */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1"
            >
              <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
              <span>Manufacturing Execution</span>
              <span>/</span>
              <span className="text-slate-600">Production Dashboard</span>
            </motion.div>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: "0%" }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2"
            >
              Mould & Workpiece Pipeline
            </motion.h1>
          </div>
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
            <span suppressHydrationWarning>{isRefreshing ? "Syncing..." : "Refresh"}</span>
          </button>
          {isMounted && canCreateProject && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Mould Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* 7 Core Pipeline Stage Cards - Admin Only */}
      {isMounted && isAdmin && (
        <div suppressHydrationWarning>
          <PipelineStatGrid
            stats={stats}
            activeStage={activeStage}
            onSelectStage={setActiveStage}
            isLoading={false}
          />
        </div>
      )}

      {/* Main Dense Data Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Active Project Register
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200" suppressHydrationWarning>
              <AnimatedNumber value={displayedProjects.length} />
              <span>Projects</span>
            </span>
            {activeStage && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Filtered by Stage: {activeStage.toUpperCase()}
              </span>
            )}

            {/* Subtle Syncing Indicator */}
            {projectsStream.isSyncingDelta && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-xs text-blue-700">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                <span className="font-medium">Updating...</span>
              </div>
            )}

            {/* Initial Stream Indicator with Buttery Smooth Animation */}
            {projectsStream.isStreaming && !projectsStream.isSyncingDelta && (
              <SmoothProgressPill
                loadedCount={projectsStream.loadedCount}
                totalCount={projectsStream.totalCount}
              />
            )}

            {/* Simple clean Up-to-date indicator */}
            {!projectsStream.isStreaming && !projectsStream.isSyncingDelta && projectsStream.loadedCount > 0 && (
              <button
                type="button"
                onClick={projectsStream.startFreshStream}
                title="Click karein live 50, 100, 500 chunks streaming test karne ke liye"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 px-2.5 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all duration-300 cursor-pointer shadow-2xs group"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Up to date</span>
              </button>
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
          onDeleteProject={handleDeleteProject}
        />
      </div>

      {/* New Mould Entry Quick Modal */}
      {isMounted && canCreateProject && (
        <NewMouldModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          customers={projectsStream.customers}
          onSuccess={async () => {
            await Promise.all([
              projectsStream.refetch(),
              queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() }),
              queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() }),
              queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() }),
            ]);
            broadcastQueryInvalidation(queryKeys.dashboard.counts());
            broadcastQueryInvalidation(queryKeys.purchases.all());
            broadcastQueryInvalidation(queryKeys.subplates.all());
          }}
        />
      )}
    </AppLayout>
  );
}
