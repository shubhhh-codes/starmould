"use client";

import type { ConfirmationState } from "../model/types";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { useState } from "react";
import { appStore } from "@/lib/state/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import type { ScanProject, Subplate } from "@/lib/supabase/types";
import type { Dispatch, SetStateAction } from "react";

type Options = {
  setConfirmDialog: Dispatch<SetStateAction<ConfirmationState>>;
  queryClient: ReturnType<typeof useQueryClient>;
  onRefresh: (() => void) | undefined;
};

export function useSubplateDetails({
  setConfirmDialog,
  queryClient,
  onRefresh,
}: Options) {

  // View Subplates Modal State
  const [viewProject, setViewProject] = useState<ScanProject | null>(null);
  const [viewSubplates, setViewSubplates] = useState<Subplate[]>([]);
  const [isLoadingSubplates, setIsLoadingSubplates] = useState(false);

  // Handlers for View & Add Plate Modals
  const fetchSubplatesForProject = async (project: ScanProject) => {
    // Instant 0ms: check if already in memory
    if (Array.isArray(project.subplates) && project.subplates.length > 0) {
      setViewSubplates(project.subplates);
      return;
    }

    setIsLoadingSubplates(true);
    try {
      const target = project.id || project.projectid;
      const res = await fetch(`/api/subplate?projectid=${encodeURIComponent(String(target))}`);
      const json = await res.json();
      setViewSubplates(json.subplates || []);
    } catch (err) {
      console.error("Failed to load subplates:", err);
      setViewSubplates([]);
    } finally {
      setIsLoadingSubplates(false);
    }
  };

  const handleOpenView = (project: ScanProject) => {
    setViewProject(project);
    fetchSubplatesForProject(project);
  };

  const handleDeleteSubplate = (subplateId: number, projectId?: number) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Subplate Component",
      description: (
        <div className="space-y-2 text-xs">
          <p className="text-slate-700">
            Are you sure you want to permanently delete this subplate from the database?
          </p>
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
            <span className="font-semibold">⚠️ Caution:</span> This component will be permanently removed and cannot be recovered.
          </div>
        </div>
      ),
      confirmLabel: "Delete Subplate",
      cancelLabel: "Cancel",
      variant: "danger",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/subplate?id=${subplateId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setViewSubplates((prev) => prev.filter((p) => p.id !== subplateId));
            queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
            broadcastQueryInvalidation(queryKeys.subplates.all());
            broadcastQueryInvalidation(queryKeys.projects.all());
            broadcastQueryInvalidation(queryKeys.purchases.all());
            broadcastQueryInvalidation(queryKeys.dashboard.counts());
            onRefresh?.();
            appStore.addToast({
              type: "success",
              message: "Subplate deleted successfully",
            });
            setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to delete subplate");
          }
        } catch (err: any) {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          appStore.addToast({
            type: "error",
            message: err.message || "Failed to delete subplate",
          });
        }
      },
    });
  };
  return {
    viewProject,
    setViewSubplates,
    fetchSubplatesForProject,
    handleOpenView,
    handleDeleteSubplate,
    setViewProject,
    viewSubplates,
    isLoadingSubplates,
  };
}
