"use client";

import { SubplateActionsMenu } from "@/features/subplates/components/subplate-actions-menu";
import { PurchaseRequiredModal } from "@/features/subplates/components/purchase-required-modal";
import { SubplateSummaryCards } from "@/features/subplates/components/subplate-summary-cards";
import { SubplatePageToolbar } from "@/features/subplates/components/subplate-page-toolbar";
import { SubplateFormModal } from "@/features/subplates/components/subplate-form-modal";
import { SubplateMouldGroup } from "@/features/subplates/components/subplate-mould-group";
import { useSubplatePageController } from "@/features/subplates/hooks/use-subplate-page-controller";
import { Suspense } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Layers,
  Search,
  Plus,
  FileSpreadsheet,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { KpiCardSkeleton, TableSkeletonRows } from "@/components/ui/skeleton";
import { AssignStaffModal } from "@/components/subplate/assign-staff-modal";
import { CreatePurchaseOrderModal } from "@/components/purchase/create-purchase-order-modal";
import {
  STAGE_DEFINITIONS,
  getAllowedStagesForUser,
  getSubplateProgressInfo,
  type StageDefinition,
} from "@/lib/subplate-stages";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";

export {
  STAGE_DEFINITIONS,
  getAllowedStagesForUser,
  getSubplateProgressInfo,
  type StageDefinition,
};

function SubplatePageContent() {
  const {
    refetchSubplates,
    isMounted,
    isFetching,
    canExportCSV,
    handleExportCSV,
    canCreateSubplate,
    handleOpenAddModal,
    isLoading,
    totalCount,
    inHouseCount,
    vendorCount,
    uniqueProjects,
    searchQuery,
    setSearchQuery,
    setCurrentPage,
    materialFilter,
    setMaterialFilter,
    materialFilterOptions,
    categoryFilter,
    setCategoryFilter,
    categoryFilterOptions,
    locationFilter,
    setLocationFilter,
    locationFilterOptions,
    projectFilter,
    setProjectFilter,
    projectFilterOptions,
    stageFilter,
    setStageFilter,
    stageFilterOptions,
    mouldGroups,
    filteredSubplates,
    handleToggleAllMoulds,
    paginatedMouldGroups,
    isMouldExpanded,
    toggleMould,
    expandedRows,
    countCompletedStages,
    toggleRow,
    handleSubplateContextMenu,
    getRowHighlightClass,
    activeStaff,
    canEditSubplate,
    handleOpenEditModal,
    canDeleteSubplate,
    handleDeleteSubplate,
    allowedStages,
    isAdmin,
    currentUser,
    handleOpenCreatePOForPlate,
    router,
    handleStageStaffChange,
    scans,
    setPageSize,
    pageSize,
    currentPage,
    totalPages,
    isModalOpen,
    setIsModalOpen,
    setEditingSubplate,
    editingSubplate,
    handleSubmitModal,
    companionRecommendations,
    handleApplyCompanion,
    modalForm,
    modalTargetPlateNames,
    setModalForm,
    isProjectsLoading,
    projectsQuery,
    handleDimensionChange,
    modalShapeOptions,
    modalMaterialOptions,
    recalculateWeight,
    dimLabels,
    blockInvalidNumberKeys,
    handleNumericDimension,
    heightDisabled,
    modalUnitOptions,
    isSubmitting,
    isModalFormValid,
    contextMenu,
    setContextMenu,
    getTargetStageForUser,
    setAssignStaffModal,
    assignStaffModal,
    createPOModalOpen,
    setCreatePOModalOpen,
    setTargetPOProject,
    setTargetPOPlate,
    targetPOProject,
    targetPOPlate,
    queryClient,
    poRequiredModal,
    setPoRequiredModal,
  } = useSubplatePageController();

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2.5 sm:p-3 bg-cyan-50 text-cyan-600 rounded-xl shrink-0">
              <Layers className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                Subplate Master & Progression
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 line-clamp-1 sm:line-clamp-none">
                Track workpiece dimensions, raw materials, location stages, and machining milestones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => refetchSubplates()}
              disabled={isMounted && isFetching}
              title="Refresh Subplates"
              className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-xs text-xs sm:text-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 ${isMounted && isFetching ? "animate-spin text-blue-600" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canExportCSV && (
              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-xs text-xs sm:text-sm cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>
            )}
            {canCreateSubplate && (
              <button
                data-shortcut-create="true"
                accessKey="n"
                title="Add Subplate (Alt+N or press N)"
                onClick={handleOpenAddModal}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-xs shadow-blue-500/20 text-xs sm:text-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Add Subplate</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <SubplateSummaryCards
          isLoading={isLoading}
          totalCount={totalCount}
          inHouseCount={inHouseCount}
          vendorCount={vendorCount}
          uniqueProjects={uniqueProjects}
        />

        {/* Filter Controls & Universal Search */}
        <SubplatePageToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setCurrentPage={setCurrentPage}
          materialFilter={materialFilter}
          setMaterialFilter={setMaterialFilter}
          materialFilterOptions={materialFilterOptions}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categoryFilterOptions={categoryFilterOptions}
          locationFilter={locationFilter}
          setLocationFilter={setLocationFilter}
          locationFilterOptions={locationFilterOptions}
          projectFilter={projectFilter}
          setProjectFilter={setProjectFilter}
          projectFilterOptions={projectFilterOptions}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          stageFilterOptions={stageFilterOptions}
          mouldGroups={mouldGroups}
          filteredSubplates={filteredSubplates}
          handleToggleAllMoulds={handleToggleAllMoulds}
        />

        {/* Mould Groups Container */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3.5 animate-pulse">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-200" />
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-slate-200 rounded" />
                      <div className="h-3 w-56 bg-slate-100 rounded" />
                    </div>
                  </div>
                  <div className="h-7 w-24 bg-slate-200 rounded-lg" />
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      <TableSkeletonRows rows={3} columns={6} />
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : mouldGroups.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 text-sm">No Moulds or Subplates Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? `No subplates or mould projects matched "${searchQuery}". Try a different search term or reset your filters.`
                  : "No subplates found matching your selected filters."}
              </p>
            </div>
            {(searchQuery || materialFilter !== "ALL" || locationFilter !== "ALL" || projectFilter !== "ALL" || stageFilter !== "ALL" || categoryFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setMaterialFilter("ALL");
                  setLocationFilter("ALL");
                  setProjectFilter("ALL");
                  setStageFilter("ALL");
                  setCategoryFilter("ALL");
                  setCurrentPage(1);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        ) : (
          /* Grouped Mould Projects List */
          <div className="space-y-4">
            {paginatedMouldGroups.map((group) => {
              const isExpanded = isMouldExpanded(group.id);
              const percent = Math.round((group.completedPlates / Math.max(1, group.totalPlates)) * 100);

              return (
                <SubplateMouldGroup key={group.id}
                  group={group}
                  toggleMould={toggleMould}
                  isExpanded={isExpanded}
                  canCreateSubplate={canCreateSubplate}
                  handleOpenAddModal={handleOpenAddModal}
                  percent={percent}
                  expandedRows={expandedRows}
                  countCompletedStages={countCompletedStages}
                  toggleRow={toggleRow}
                  handleSubplateContextMenu={handleSubplateContextMenu}
                  getRowHighlightClass={getRowHighlightClass}
                  activeStaff={activeStaff}
                  canEditSubplate={canEditSubplate}
                  handleOpenEditModal={handleOpenEditModal}
                  canDeleteSubplate={canDeleteSubplate}
                  handleDeleteSubplate={handleDeleteSubplate}
                  allowedStages={allowedStages}
                  isAdmin={isAdmin}
                  currentUser={currentUser}
                  handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
                  router={router}
                  handleStageStaffChange={handleStageStaffChange}
                  scans={scans}
                />
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && mouldGroups.length > 0 && (
          <div className="px-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {[10, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    className={`px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${pageSize === size
                        ? "bg-white text-blue-700 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <span>
                per page • Showing {((currentPage - 1) * pageSize) + 1} to{" "}
                {Math.min(currentPage * pageSize, mouldGroups.length)} of {mouldGroups.length} Mould Projects ({filteredSubplates.length} Subplates)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2.5 py-1 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="py-2.5 px-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filteredSubplates.length} subplates grouped across {mouldGroups.length} mould projects
          </span>
          <span>All dimensions and material grades derived from factory inventory</span>
        </div>

        {/* Modal: Add Subplate (Physics-based Spring Modal) */}
        <SubplateFormModal
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          setEditingSubplate={setEditingSubplate}
          editingSubplate={editingSubplate}
          handleSubmitModal={handleSubmitModal}
          companionRecommendations={companionRecommendations}
          handleApplyCompanion={handleApplyCompanion}
          modalForm={modalForm}
          modalTargetPlateNames={modalTargetPlateNames}
          setModalForm={setModalForm}
          scans={scans}
          isProjectsLoading={isProjectsLoading}
          projectsQuery={projectsQuery}
          handleDimensionChange={handleDimensionChange}
          modalShapeOptions={modalShapeOptions}
          modalMaterialOptions={modalMaterialOptions}
          recalculateWeight={recalculateWeight}
          dimLabels={dimLabels}
          blockInvalidNumberKeys={blockInvalidNumberKeys}
          handleNumericDimension={handleNumericDimension}
          heightDisabled={heightDisabled}
          modalUnitOptions={modalUnitOptions}
          isSubmitting={isSubmitting}
          isModalFormValid={isModalFormValid}
        />

        {/* Right-Click Floating Context Menu on Subplate */}
        <SubplateActionsMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          getTargetStageForUser={getTargetStageForUser}
          currentUser={currentUser}
          isAdmin={isAdmin}
          activeStaff={activeStaff}
          router={router}
          handleStageStaffChange={handleStageStaffChange}
          setAssignStaffModal={setAssignStaffModal}
          toggleRow={toggleRow}
          handleOpenEditModal={handleOpenEditModal}
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
          onAssign={handleStageStaffChange}
          onCreatePO={handleOpenCreatePOForPlate}
        />

        {/* Inline Create Purchase Order Modal */}
        <CreatePurchaseOrderModal
          isOpen={createPOModalOpen}
          onClose={() => {
            setCreatePOModalOpen(false);
            setTargetPOProject(null);
            setTargetPOPlate(null);
          }}
          initialProject={targetPOProject}
          initialPlate={targetPOPlate}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
            broadcastQueryInvalidation(queryKeys.subplates.all());
            broadcastQueryInvalidation(queryKeys.dashboard.counts());
          }}
        />

        {/* Dedicated Purchase Order Required Modal */}
        <PurchaseRequiredModal
          poRequiredModal={poRequiredModal}
          setPoRequiredModal={setPoRequiredModal}
          handleOpenCreatePOForPlate={handleOpenCreatePOForPlate}
        />
      </div>
    </AppLayout>
  );
}

export function SubplatePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="p-6 space-y-4">
            <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
            <KpiCardSkeleton count={4} />
          </div>
        </AppLayout>
      }
    >
      <SubplatePageContent />
    </Suspense>
  );
}
