"use client";

import type { MouldProjectsTableProps } from "../model/types";
import type { RowSelectionState } from "@tanstack/react-table";
import { useMouldTableModel } from "./use-mould-table-model";
import { useMouldKeyboardShortcuts } from "./use-mould-keyboard-shortcuts";
import { useMouldBulkActions } from "./use-mould-bulk-actions";
import { useMouldContextMenus } from "./use-mould-context-menus";
import { useMouldAssignments } from "./use-mould-assignments";
import { useSubplateForm } from "./use-subplate-form";
import { useSubplateDetails } from "./use-subplate-details";
import { useMouldProjectActions } from "./use-mould-project-actions";
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type SortingState } from "@tanstack/react-table";
import type { ScanProject } from "@/lib/supabase/types";
import { appStore } from "@/lib/state/store";
import { useQueryClient, useIsRestoring } from "@tanstack/react-query";
import { useUsersQuery } from "@/lib/query/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";

export function useMouldTableController({
  initialData = [],
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onDeleteProject,
  onDeleteProjects,
}: MouldProjectsTableProps) {

  const {
    contextMenu,
    setContextMenu,
    handleRowContextMenu,
    longPress,
    handleSubplateContextMenu,
    subplateContextMenu,
    setSubplateContextMenu,
  } = useMouldContextMenus();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isRestoring = useIsRestoring();
  const showSkeleton = !mounted || isLoading || isRestoring;
  const data = initialData;
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rdate", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("ALL");
  const [selectedWorktype, setSelectedWorktype] = useState<string>("ALL");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Mould Lifecycle Timeline Drawer State
  const [timelineProjectId, setTimelineProjectId] = useState<string | number | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const queryClient = useQueryClient();

  const {
    setConfirmDialog,
    handleDeleteSingleProject,
    promptDeleteMoulds,
    confirmDialog,
    handleToggleProjectStatus,
    moveToRegisterProject,
    setMoveToRegisterProject,
  } = useMouldProjectActions({
    queryClient,
    onRefresh,
    onDeleteProjects,
    onDeleteProject,
    setRowSelection,
  });

  const {
    viewProject,
    setViewSubplates,
    fetchSubplatesForProject,
    handleOpenView,
    handleDeleteSubplate,
    setViewProject,
    viewSubplates,
    isLoadingSubplates,
  } = useSubplateDetails({
    setConfirmDialog,
    queryClient,
    onRefresh,
  });

  const {
    addPlateProject,
    setAddPlateProject,
    editingSubplate,
    setEditingSubplate,
    handleOpenAddPlate,
    handleOpenEditPlate,
    handleSubmitPlate,
    plateForm,
    setPlateForm,
    handleDimensionChange,
    modalPlateShapeOptions,
    modalPlateMaterialOptions,
    recalculatePlateWeight,
    plateDimLabels,
    blockInvalidNumberKeys,
    handleNumericPlateDimension,
    plateHeightDisabled,
    modalPlateUnitOptions,
    isSubmittingPlate,
    isPlateFormValid,
  } = useSubplateForm({
    data,
    viewProject,
    setViewSubplates,
    fetchSubplatesForProject,
    queryClient,
    onRefresh,
  });

  // Inline Master-Detail Accordion State
  const [expandedRowId, setExpandedRowId] = useState<number | string | null>(null);

  const toggleRowExpand = (project: ScanProject) => {
    const targetId = project.id;
    setExpandedRowId((prev) => (prev !== null && String(prev) === String(targetId) ? null : targetId));
  };

  // Create Purchase Order Modal State (Dashboard Inline)
  const [createPOProject, setCreatePOProject] = useState<ScanProject | null>(null);
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);

  // Context Menu State for Right-Click
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();

  const canCreateProject = hasPermission("action_create_scanning_project");
  const canEditMould = hasPermission("action_edit_mould");
  const canDeleteMould = hasPermission("action_delete_mould");
  const canCreateSubplate = hasPermission("action_create_subplate");
  const canEditSubplate = hasPermission("action_edit_subplate");
  const canDeleteSubplate = hasPermission("action_delete_subplate");
  const canCreatePurchase = hasPermission("action_create_purchase");

  // Real-time permission revocation guard: auto-close modal if admin revokes permission while open
  useEffect(() => {
    if (addPlateProject && !canCreateSubplate) {
      setAddPlateProject(null);
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to add subplates was revoked by administrator.",
        duration: 5000,
      });
    }
    if (editingSubplate && !canEditSubplate) {
      setEditingSubplate(null);
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to edit subplates was revoked by administrator.",
        duration: 5000,
      });
    }
    if (isCreatePOOpen && !canCreatePurchase) {
      setIsCreatePOOpen(false);
      setCreatePOProject(null);
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to create purchase orders was revoked by administrator.",
        duration: 5000,
      });
    }
  }, [addPlateProject, editingSubplate, isCreatePOOpen, canCreateSubplate, canEditSubplate, canCreatePurchase]);

  const { data: usersData } = useUsersQuery();
  const users = usersData?.users || [];
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [users]);

  const {
    getTargetStageForSubplate,
    handleAssignSubplateToUser,
    setAssignStaffModal,
    assignStaffModal,
  } = useMouldAssignments({
    currentUser,
    data,
    router,
    isAdmin,
    activeStaff,
    queryClient,
    onRefresh,
  });

  const handleCreatePO = (project: ScanProject) => {
    setCreatePOProject(project);
    setIsCreatePOOpen(true);
  };

  const {
    table,
    selectedCount,
    dashboardCustomerOptions,
    dashboardWorktypeOptions,
    columns,
    filteredData,
  } = useMouldTableModel({
    data,
    selectedCustomer,
    selectedWorktype,
    expandedRowId,
    toggleRowExpand,
    setTimelineProjectId,
    setIsTimelineOpen,
    isAdmin,
    handleOpenView,
    canCreateSubplate,
    handleOpenAddPlate,
    canCreatePurchase,
    handleCreatePO,
    canDeleteMould,
    handleDeleteSingleProject,
    sorting,
    globalFilter,
    rowSelection,
    setRowSelection,
    setSorting,
    setGlobalFilter,
  });

  const {
    handleBatchMarkDone,
    handleBatchDelete,
  } = useMouldBulkActions({
    table,
    setConfirmDialog,
    queryClient,
    onRefresh,
    setRowSelection,
    promptDeleteMoulds,
  });

  useMouldKeyboardShortcuts({
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
  });
  return {
    searchInputRef,
    globalFilter,
    setGlobalFilter,
    selectedCustomer,
    setSelectedCustomer,
    dashboardCustomerOptions,
    selectedWorktype,
    setSelectedWorktype,
    dashboardWorktypeOptions,
    selectedCount,
    handleBatchMarkDone,
    canDeleteMould,
    handleBatchDelete,
    setRowSelection,
    data,
    table,
    showSkeleton,
    columns,
    expandedRowId,
    toggleRowExpand,
    handleRowContextMenu,
    longPress,
    activeStaff,
    handleOpenAddPlate,
    handleOpenView,
    handleOpenEditPlate,
    handleDeleteSubplate,
    handleSubplateContextMenu,
    canCreateSubplate,
    canCreatePurchase,
    handleCreatePO,
    handleDeleteSingleProject,
    filteredData,
    viewProject,
    setViewProject,
    viewSubplates,
    isLoadingSubplates,
    canEditSubplate,
    canDeleteSubplate,
    addPlateProject,
    editingSubplate,
    setAddPlateProject,
    setEditingSubplate,
    handleSubmitPlate,
    plateForm,
    setPlateForm,
    handleDimensionChange,
    modalPlateShapeOptions,
    modalPlateMaterialOptions,
    recalculatePlateWeight,
    plateDimLabels,
    blockInvalidNumberKeys,
    handleNumericPlateDimension,
    plateHeightDisabled,
    modalPlateUnitOptions,
    isSubmittingPlate,
    isPlateFormValid,
    contextMenu,
    setContextMenu,
    isAdmin,
    handleToggleProjectStatus,
    subplateContextMenu,
    setSubplateContextMenu,
    getTargetStageForSubplate,
    currentUser,
    setCreatePOProject,
    setIsCreatePOOpen,
    router,
    handleAssignSubplateToUser,
    setAssignStaffModal,
    assignStaffModal,
    confirmDialog,
    setConfirmDialog,
    isCreatePOOpen,
    createPOProject,
    timelineProjectId,
    isTimelineOpen,
    setIsTimelineOpen,
    setTimelineProjectId,
    moveToRegisterProject,
    setMoveToRegisterProject,
    queryClient,
    onRefresh,
  };
}

export type MouldTableContext = ReturnType<typeof useMouldTableController>;

export type { MouldProjectsTableProps } from "../model/types";
