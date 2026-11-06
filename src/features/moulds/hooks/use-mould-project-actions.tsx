"use client";

import type { ConfirmationState } from "../model/types";
import type { RowSelectionState } from "@tanstack/react-table";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { appStore } from "@/lib/state/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { ScanProject } from "@/lib/supabase/types";
import type { Dispatch, SetStateAction } from "react";

type Options = {
  queryClient: ReturnType<typeof useQueryClient>;
  onRefresh: (() => void) | undefined;
  onDeleteProjects: ((ids: (string | number)[], force?: boolean | undefined) => Promise<boolean>) | undefined;
  onDeleteProject: ((id: string | number, force?: boolean | undefined) => Promise<boolean>) | undefined;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
};

export function useMouldProjectActions({
  queryClient,
  onRefresh,
  onDeleteProjects,
  onDeleteProject,
  setRowSelection,
}: Options) {

  // Custom Website Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "danger",
    isLoading: false,
    onConfirm: () => { },
  });

  // Move to Register Modal State (detects partial dispatch)
  const [moveToRegisterProject, setMoveToRegisterProject] = useState<ScanProject | null>(null);

  const handleToggleProjectStatus = async (project: ScanProject) => {
    const isCompleted = (project.status || "").toLowerCase() === "completed";
    if (!isCompleted) {
      setMoveToRegisterProject(project);
      return;
    }
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, field: "status", value: "pending" }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        onRefresh?.();
        appStore.addToast({
          type: "success",
          message: "Project reopened to Active Pipeline",
        });
      } else {
        const err = await res.json().catch(() => ({}));
        appStore.addToast({
          type: "error",
          message: err.error || "Failed to update project status",
        });
      }
    } catch {
      appStore.addToast({
        type: "error",
        message: "Error updating project status",
      });
    }
  };

  const promptDeleteMoulds = async (projectsToDelete: ScanProject[]) => {
    if (!projectsToDelete || projectsToDelete.length === 0) return;
    const ids = projectsToDelete.map((p) => p.id);
    const isSingle = projectsToDelete.length === 1;
    const title = isSingle
      ? `Delete Mould: ${projectsToDelete[0].projectid || `#${projectsToDelete[0].id}`}`
      : `Delete ${projectsToDelete.length} Selected Moulds`;

    // 1. Show pre-check loading modal
    setConfirmDialog({
      isOpen: true,
      title,
      description: (
        <div className="flex items-center gap-2 py-3 text-xs text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
          <span>Checking active challans, POs, and dispatches...</span>
        </div>
      ),
      confirmLabel: "Checking...",
      cancelLabel: "Cancel",
      variant: "danger",
      isLoading: true,
      onConfirm: async () => { },
    });

    try {
      const res = await fetch(`/api/scanning?ids=${ids.join(",")}&checkOnly=true`);
      const checkData = await res.json().catch(() => ({}));
      const hasDeps = Boolean(checkData?.hasDependencies);
      const dependencies = checkData?.dependencies || [];

      setConfirmDialog({
        isOpen: true,
        title,
        description: hasDeps ? (
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 text-[13px] mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Pending Challans & Linked Records Detected</span>
              </div>
              <p className="text-[11.5px] text-amber-800 mb-2">
                Active Job Work Challans, Purchase Orders, or Delivery Dispatches are linked to these moulds. Deleting will permanently remove all linked records:
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {dependencies
                  .filter((d: any) => d.has_dependencies)
                  .map((d: any) => (
                    <div key={d.id} className="p-2 rounded-lg bg-white/90 border border-amber-200/90 text-[11px] shadow-2xs">
                      <div className="font-semibold text-slate-900 flex items-center justify-between">
                        <span className="font-mono">{d.projectid || `#${d.id}`}</span>
                        <span className="text-slate-500 font-normal">{d.subplate_count || 0} subplates</span>
                      </div>
                      <div className="mt-1 space-y-0.5 text-slate-700">
                        {d.active_challans?.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-1 text-[11px] text-amber-900 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span>Job Work Challan: <strong>#{c.challanno}</strong></span>
                          </div>
                        ))}
                        {d.active_dispatches?.map((dp: any) => (
                          <div key={dp.id} className="flex items-center gap-1 text-[11px] text-blue-900 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span>Delivery Dispatch: <strong>#{dp.challanno}</strong></span>
                          </div>
                        ))}
                        {d.active_pos?.map((po: any) => (
                          <div key={po.id} className="flex items-center gap-1 text-[11px] text-emerald-900 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span>Purchase Order: <strong>#{po.srno}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              ⚠️ <strong>Atomic Deletion:</strong> All selected moulds and their linked records will be deleted together in a single atomic transaction. No orphaned records will remain in the database.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <p className="text-slate-700">
              Are you sure you want to permanently delete{" "}
              {isSingle ? (
                <>mould project <strong className="text-slate-900 font-mono">{projectsToDelete[0].projectid || `#${projectsToDelete[0].id}`}</strong>?</>
              ) : (
                <><strong className="text-slate-900">{projectsToDelete.length}</strong> selected mould projects?</>
              )}
            </p>
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
              <span className="font-semibold">⚠️ Cascade Deletion:</span> All associated child subplates and operator worklogs will be permanently deleted from the database. This action cannot be undone.
            </div>
          </div>
        ),
        confirmLabel: hasDeps ? "Force Delete & Cancel Linked Records" : (isSingle ? "Delete Mould" : `Delete ${projectsToDelete.length} Moulds`),
        cancelLabel: "Cancel",
        variant: "danger",
        isLoading: false,
        onConfirm: async () => {
          setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
          try {
            let ok = false;
            if (onDeleteProjects) {
              ok = await onDeleteProjects(ids, true);
            } else if (onDeleteProject && isSingle) {
              ok = await onDeleteProject(ids[0], true);
            } else {
              const res = await fetch(`/api/scanning?ids=${ids.join(",")}&force=true`, { method: "DELETE" });
              const result = await res.json().catch(() => ({}));
              ok = res.ok && result.success;
              if (ok) {
                queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
                queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
                queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
                queryClient.invalidateQueries({ queryKey: queryKeys.challans.all() });
                queryClient.invalidateQueries({ queryKey: queryKeys.dispatch.all() });
                queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
                onRefresh?.();
              } else {
                throw new Error(result.error || "Failed to delete moulds");
              }
            }

            if (ok) {
              setRowSelection({});
              appStore.addToast({
                type: "success",
                message: `${projectsToDelete.length} mould project(s) and all linked records deleted successfully`,
              });
              setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
            } else {
              setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
            }
          } catch (err: any) {
            setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
            appStore.addToast({
              type: "error",
              message: err.message || "Failed to delete moulds",
            });
          }
        },
      });
    } catch (err: any) {
      setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
      appStore.addToast({
        type: "error",
        message: err.message || "Failed to inspect project dependencies",
      });
    }
  };

  const handleDeleteSingleProject = (project: ScanProject) => {
    promptDeleteMoulds([project]);
  };
  return {
    setConfirmDialog,
    handleDeleteSingleProject,
    promptDeleteMoulds,
    confirmDialog,
    handleToggleProjectStatus,
    moveToRegisterProject,
    setMoveToRegisterProject,
  };
}
