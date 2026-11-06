"use client";

import type { ConfirmationState, ProjectMenuState } from "../model/types";
import type { RowSelectionState } from "@tanstack/react-table";
import type { RefObject } from "react";
import { useEffect } from "react";
import { appStore } from "@/lib/state/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import type { ScanProject } from "@/lib/supabase/types";
import type { Table } from "@tanstack/react-table";
import type { Dispatch, SetStateAction } from "react";

type Options = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  setGlobalFilter: Dispatch<SetStateAction<string>>;
  table: Table<ScanProject>;
  canDeleteMould: boolean;
  promptDeleteMoulds: (projectsToDelete: ScanProject[]) => Promise<void>;
  selectedCount: number;
  handleBatchMarkDone: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
  onRefresh: (() => void) | undefined;
  confirmDialog: ConfirmationState;
  contextMenu: ProjectMenuState;
  setContextMenu: Dispatch<SetStateAction<ProjectMenuState>>;
  setRowSelection: Dispatch<SetStateAction<RowSelectionState>>;
};

export function useMouldKeyboardShortcuts({
  searchInputRef,
  setGlobalFilter,
  table,
  canDeleteMould,
  promptDeleteMoulds,
  selectedCount,
  handleBatchMarkDone,
  queryClient,
  onRefresh,
  confirmDialog,
  contextMenu,
  setContextMenu,
  setRowSelection,
}: Options) {

  // Keyboard Shortcuts:
  // - Ctrl+A: Select All
  // - Delete / Del: Batch Delete
  // - Escape: Deselect / Exit Search
  // - / or Ctrl+F: Focus Search
  // - M or Ctrl+Enter: Mark Selected Completed
  // - R: Refresh Table
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      // 1. Search focus with '/' or Ctrl+F / Cmd+F
      if ((e.key === "/" && !isInput) || ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F"))) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // If inside search input and press Escape -> clear and blur
      if (e.key === "Escape" && activeEl === searchInputRef.current) {
        e.preventDefault();
        setGlobalFilter("");
        searchInputRef.current?.blur();
        return;
      }

      // 2. Ctrl+A or Cmd+A -> Select all rows in the table
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        if (isInput) return;
        e.preventDefault();
        table.toggleAllRowsSelected(true);
        return;
      }

      // 3. Delete or Backspace -> Trigger delete on selected moulds
      if (e.key === "Delete" || e.key === "Del") {
        if (isInput) return;
        const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
        if (selectedRows.length > 0) {
          e.preventDefault();
          if (canDeleteMould) {
            promptDeleteMoulds(selectedRows);
          } else {
            appStore.addToast({
              type: "error",
              message: "Access Denied: You do not have permission to delete moulds.",
            });
          }
        }
        return;
      }

      // 4. M or Ctrl+Enter -> Mark selected moulds as completed
      if ((e.key === "m" || e.key === "M" || ((e.ctrlKey || e.metaKey) && e.key === "Enter")) && !isInput) {
        if (selectedCount > 0) {
          e.preventDefault();
          handleBatchMarkDone();
          return;
        }
      }

      // 5. Alt+R -> Refresh mould register table silently
      if ((e.key === "r" || e.key === "R") && (e.altKey || e.shiftKey) && !isInput) {
        e.preventDefault();
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        onRefresh?.();
        return;
      }

      // 6. Escape -> Deselect all rows, or close context menu
      if (e.key === "Escape") {
        if (confirmDialog.isOpen) return;
        if (contextMenu.isOpen) {
          setContextMenu((prev) => ({ ...prev, isOpen: false }));
          return;
        }
        if (selectedCount > 0) {
          e.preventDefault();
          setRowSelection({});
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [table, selectedCount, canDeleteMould, confirmDialog.isOpen, contextMenu.isOpen, promptDeleteMoulds, queryClient, onRefresh]);
  return {

  };
}
