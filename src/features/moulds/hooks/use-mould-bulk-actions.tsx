"use client";

import type { ConfirmationState } from "../model/types";
import type { RowSelectionState } from "@tanstack/react-table";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { appStore } from "@/lib/state/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { ScanProject } from "@/lib/supabase/types";
import type { Table } from "@tanstack/react-table";
import type { Dispatch, SetStateAction } from "react";

type Options = {
  table: Table<ScanProject>;
  setConfirmDialog: Dispatch<SetStateAction<ConfirmationState>>;
  queryClient: ReturnType<typeof useQueryClient>;
  onRefresh: (() => void) | undefined;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
  promptDeleteMoulds: (projectsToDelete: ScanProject[]) => Promise<void>;
};

export function useMouldBulkActions({
  table,
  setConfirmDialog,
  queryClient,
  onRefresh,
  setRowSelection,
  promptDeleteMoulds,
}: Options) {

  const handleBatchMarkDone = () => {
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
    if (selectedRows.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Mark ${selectedRows.length} Moulds as Completed`,
      description: (
        <p className="text-xs text-slate-700">
          Are you sure you want to mark{" "}
          <strong className="text-slate-900 font-semibold">{selectedRows.length}</strong> selected moulds as Completed?
        </p>
      ),
      confirmLabel: "Mark Completed",
      cancelLabel: "Cancel",
      variant: "primary",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await Promise.all(
            selectedRows.map((r) =>
              fetch("/api/scanning", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: r.id, field: "status", value: "completed" }),
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
          onRefresh?.();
          setRowSelection({});
          appStore.addToast({
            type: "success",
            message: `${selectedRows.length} moulds marked as Completed`,
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          appStore.addToast({
            type: "error",
            message: err.message || "Failed to update status",
          });
        }
      },
    });
  };

  const handleBatchDelete = () => {
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
    promptDeleteMoulds(selectedRows);
  };
  return {
    handleBatchMarkDone,
    handleBatchDelete,
  };
}
