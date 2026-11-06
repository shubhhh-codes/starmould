"use client";

import { SubplateDetailsDrawer } from "./components/subplate-details-drawer";
import { SubplateFormModal } from "./components/subplate-form-modal";
import { ProjectContextMenu } from "./components/project-context-menu";
import { SubplateContextMenu } from "./components/subplate-context-menu";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CreatePurchaseOrderModal } from "@/components/purchase/create-purchase-order-modal";
import { MouldTimelineDrawer } from "@/components/mould/mould-timeline-drawer";
import { MoveToRegisterModal } from "@/components/mould/move-to-register-modal";
import { appStore } from "@/lib/state/store";
import { queryKeys } from "@/lib/query/keys";
import { AssignStaffModal } from "@/components/subplate/assign-staff-modal";
import {
  useMouldTableController,
  type MouldProjectsTableProps,
} from "./hooks/use-mould-table-controller";
import { MouldToolbar } from "./components/mould-toolbar";
import { MouldDesktopTable } from "./components/mould-desktop-table";
import { MouldMobileCards } from "./components/mould-mobile-cards";
import { MouldPagination } from "./components/mould-pagination";

export function MouldProjectsTable(props: MouldProjectsTableProps) {
  const {
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
  } = useMouldTableController(props);
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Action & Filter Toolbar */}
      <MouldToolbar
        searchInputRef={searchInputRef}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        dashboardCustomerOptions={dashboardCustomerOptions}
        selectedWorktype={selectedWorktype}
        setSelectedWorktype={setSelectedWorktype}
        dashboardWorktypeOptions={dashboardWorktypeOptions}
        selectedCount={selectedCount}
        handleBatchMarkDone={handleBatchMarkDone}
        canDeleteMould={canDeleteMould}
        handleBatchDelete={handleBatchDelete}
        setRowSelection={setRowSelection}
        data={data}
        table={table}
      />

      {/* Main Table Grid (Desktop: hidden below md) */}
      <MouldDesktopTable
        table={table}
        showSkeleton={showSkeleton}
        columns={columns}
        expandedRowId={expandedRowId}
        toggleRowExpand={toggleRowExpand}
        handleRowContextMenu={handleRowContextMenu}
        longPress={longPress}
        activeStaff={activeStaff}
        handleOpenAddPlate={handleOpenAddPlate}
        handleOpenView={handleOpenView}
        handleOpenEditPlate={handleOpenEditPlate}
        handleDeleteSubplate={handleDeleteSubplate}
        handleSubplateContextMenu={handleSubplateContextMenu}
      />

      {/* Mobile Card-List Fallback (block below md, hidden on md+) */}
      <MouldMobileCards
        table={table}
        showSkeleton={showSkeleton}
        longPress={longPress}
        handleOpenView={handleOpenView}
        isAdmin={isAdmin}
        setTimelineProjectId={setTimelineProjectId}
        setIsTimelineOpen={setIsTimelineOpen}
        canCreateSubplate={canCreateSubplate}
        handleOpenAddPlate={handleOpenAddPlate}
        canCreatePurchase={canCreatePurchase}
        handleCreatePO={handleCreatePO}
        canDeleteMould={canDeleteMould}
        handleDeleteSingleProject={handleDeleteSingleProject}
      />

      {/* Pagination Footer */}
      <MouldPagination
        table={table}
        filteredData={filteredData}
      />

      {/* View Subplates Drawer (Linear-style slide-over) */}
      <SubplateDetailsDrawer
        viewProject={viewProject}
        setViewProject={setViewProject}
        viewSubplates={viewSubplates}
        canCreateSubplate={canCreateSubplate}
        handleOpenAddPlate={handleOpenAddPlate}
        isLoadingSubplates={isLoadingSubplates}
        handleSubplateContextMenu={handleSubplateContextMenu}
        canEditSubplate={canEditSubplate}
        handleOpenEditPlate={handleOpenEditPlate}
        canDeleteSubplate={canDeleteSubplate}
        handleDeleteSubplate={handleDeleteSubplate}
      />

      {/* Add / Edit Subplate Modal */}
      <SubplateFormModal
        addPlateProject={addPlateProject}
        editingSubplate={editingSubplate}
        setAddPlateProject={setAddPlateProject}
        setEditingSubplate={setEditingSubplate}
        handleSubmitPlate={handleSubmitPlate}
        plateForm={plateForm}
        setPlateForm={setPlateForm}
        handleDimensionChange={handleDimensionChange}
        modalPlateShapeOptions={modalPlateShapeOptions}
        modalPlateMaterialOptions={modalPlateMaterialOptions}
        recalculatePlateWeight={recalculatePlateWeight}
        plateDimLabels={plateDimLabels}
        blockInvalidNumberKeys={blockInvalidNumberKeys}
        handleNumericPlateDimension={handleNumericPlateDimension}
        plateHeightDisabled={plateHeightDisabled}
        modalPlateUnitOptions={modalPlateUnitOptions}
        isSubmittingPlate={isSubmittingPlate}
        isPlateFormValid={isPlateFormValid}
      />

      {/* Right-Click Floating Context Menu */}
      <ProjectContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        canCreateSubplate={canCreateSubplate}
        handleOpenAddPlate={handleOpenAddPlate}
        canCreatePurchase={canCreatePurchase}
        handleCreatePO={handleCreatePO}
        handleOpenView={handleOpenView}
        isAdmin={isAdmin}
        handleToggleProjectStatus={handleToggleProjectStatus}
        canDeleteMould={canDeleteMould}
        handleDeleteSingleProject={handleDeleteSingleProject}
      />

      {/* Right-Click Floating Context Menu on Subplate */}
      <SubplateContextMenu
        subplateContextMenu={subplateContextMenu}
        setSubplateContextMenu={setSubplateContextMenu}
        getTargetStageForSubplate={getTargetStageForSubplate}
        currentUser={currentUser}
        isAdmin={isAdmin}
        activeStaff={activeStaff}
        setCreatePOProject={setCreatePOProject}
        setIsCreatePOOpen={setIsCreatePOOpen}
        router={router}
        handleAssignSubplateToUser={handleAssignSubplateToUser}
        setAssignStaffModal={setAssignStaffModal}
        canEditSubplate={canEditSubplate}
        handleOpenEditPlate={handleOpenEditPlate}
      />

      {/* Quick Staff Assignment Modal (Admin & Staff) */}
      <AssignStaffModal
        isOpen={assignStaffModal.isOpen}
        onClose={() =>
          setAssignStaffModal({
            isOpen: false,
            subplate: null,
            stage: null,
          })
        }
        subplate={assignStaffModal.subplate}
        stage={assignStaffModal.stage}
        staff={activeStaff}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onAssign={handleAssignSubplateToUser}
        onCreatePO={() => {
          if (subplateContextMenu?.project) {
            setCreatePOProject(subplateContextMenu.project);
            setIsCreatePOOpen(true);
          }
        }}
      />

      {/* Website Custom Delete & Action Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        variant={confirmDialog.variant}
        isLoading={confirmDialog.isLoading}
      />

      {/* Create Raw Material Purchase Order Modal (Dashboard Inline) */}
      {isCreatePOOpen && (
        <CreatePurchaseOrderModal
          isOpen={isCreatePOOpen}
          onClose={() => {
            setIsCreatePOOpen(false);
            setCreatePOProject(null);
          }}
          initialProject={createPOProject}
        />
      )}

      {/* Mould Lifecycle Timeline & History Drawer (Admin Only) */}
      {isAdmin && (
        <MouldTimelineDrawer
          projectId={timelineProjectId}
          isOpen={isTimelineOpen}
          onClose={() => {
            setIsTimelineOpen(false);
            setTimelineProjectId(null);
          }}
        />
      )}

      {/* Move to Project Register Modal with Partial Dispatch Detection */}
      <MoveToRegisterModal
        project={moveToRegisterProject}
        isOpen={!!moveToRegisterProject}
        onClose={() => setMoveToRegisterProject(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
          queryClient.invalidateQueries({ queryKey: ["project_register_completed"] });
          onRefresh?.();
          appStore.addToast({
            type: "success",
            message: "Project successfully moved to Completed Project Register",
          });
        }}
        onOpenDispatchForRemaining={(project) => {
          const code = project.projectid || project.id;
          router.push(`/dispatch?projectid=${encodeURIComponent(code)}`);
        }}
      />
    </div>
  );
}
