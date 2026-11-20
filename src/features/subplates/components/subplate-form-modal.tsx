"use client";

import React, { useMemo } from "react";
import { SubplateDimensionFields } from "@/features/subplates/components/subplate-dimension-fields";
import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import {
  Layers,
  Plus,
  Building2,
  Compass,
  Package,
  Wrench,
  ShieldCheck,
  Tag,
  Scale,
  Sparkles,
  Check,
  Pencil,
  AlertCircle,
  Copy,
  Trash2,
} from "lucide-react";
import { ERPSelect } from "@/components/ui/erp-select";
import { RollingCounter } from "@/components/ui/rolling-counter";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { ProjectSelect } from "@/components/ui/project-select";
import { GhostPlateInput } from "@/components/subplate/ghost-plate-input";
import {
  MATERIAL_DENSITIES,
  isHeightDisabled,
  getDimensionLabels,
} from "@/lib/weight-calculator";

type Props = Pick<SubplatePageContext,
  | "isModalOpen"
  | "setIsModalOpen"
  | "setEditingSubplate"
  | "editingSubplate"
  | "handleSubmitModal"
  | "companionRecommendations"
  | "handleApplyCompanion"
  | "modalForm"
  | "modalTargetPlateNames"
  | "setModalForm"
  | "scans"
  | "isProjectsLoading"
  | "projectsQuery"
  | "handleDimensionChange"
  | "modalShapeOptions"
  | "modalMaterialOptions"
  | "recalculateWeight"
  | "dimLabels"
  | "blockInvalidNumberKeys"
  | "handleNumericDimension"
  | "heightDisabled"
  | "modalUnitOptions"
  | "isSubmitting"
  | "isModalFormValid"
  | "batchPlates"
  | "addBatchPlate"
  | "removeBatchPlate"
  | "duplicateBatchPlate"
  | "updateBatchPlate"
>;

export function SubplateFormModal({
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
  scans,
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
  batchPlates = [],
  addBatchPlate,
  removeBatchPlate,
  duplicateBatchPlate,
  updateBatchPlate,
}: Props) {
  const isEditing = Boolean(editingSubplate);

  const totalBatchWeight = useMemo(() => {
    return (batchPlates || []).reduce((sum, p) => sum + (parseFloat(p.weight) || 0), 0);
  }, [batchPlates]);

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setEditingSubplate(null);
      }}
      maxWidth={isEditing ? "xl" : "2xl"}
      title={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
              {isEditing ? (
                <Pencil className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Layers className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug truncate">
                {isEditing ? "Edit Subplate Workpiece" : "Add Subplate Workpieces"}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {isEditing
                  ? `Update specifications for "${editingSubplate?.platename}"`
                  : "Define workpiece specifications & allocate to project"}
              </p>
            </div>
          </div>
          {!isEditing && (batchPlates || []).length > 0 && (
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
              {batchPlates.length} {batchPlates.length === 1 ? "Plate" : "Plates"}
            </span>
          )}
        </div>
      }
    >
      <form onSubmit={handleSubmitModal} className="space-y-4">
        {isEditing ? (
          /* ================= SINGLE SUBPLATE EDIT MODE ================= */
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-600" />
                    <span>Plate Name</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cavity Plate A-Side"
                  value={modalForm.platename}
                  onChange={(e) =>
                    setModalForm((prev) => ({
                      ...prev,
                      platename: e.target.value,
                    }))
                  }
                  className="w-full h-10 px-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Target Mould / Project</span>
                  <span className="text-rose-500 font-bold">*</span>
                </label>
                <ProjectSelect
                  projects={scans}
                  value={modalForm.projectid}
                  required
                  isLoading={isProjectsLoading}
                  placeholder="Search or select mould / project..."
                  onOpen={() => projectsQuery.refetch()}
                  onChange={(val, project) => {
                    setModalForm((prev) => ({
                      ...prev,
                      projectid: project?.id ? String(project.id) : val,
                    }));
                  }}
                />
              </div>
            </div>

            {/* Geometry Specifications */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Shape</span>
                  </label>
                  <ERPSelect
                    value={modalForm.shape}
                    onChange={(val) => handleDimensionChange("shape", String(val))}
                    options={modalShapeOptions}
                    showSearch={false}
                    placeholder="Shape"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-600" />
                      <span>Material</span>
                    </span>
                    <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200/60">
                      {MATERIAL_DENSITIES[modalForm.material] || 7.81} g/cm³
                    </span>
                  </label>
                  <ERPSelect
                    value={modalForm.material}
                    onChange={(val) => handleDimensionChange("material", String(val))}
                    options={modalMaterialOptions}
                    searchPlaceholder="Search material..."
                    placeholder="Material"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Quantity</span>
                  </label>
                  <RollingCounter
                    size="sm"
                    variant="input"
                    min={1}
                    max={9999}
                    value={Math.max(1, parseInt(modalForm.sqty || "1", 10) || 1)}
                    onChange={(val) => {
                      const next = Math.max(1, val);
                      const updated = { ...modalForm, sqty: String(next) };
                      updated.weight = recalculateWeight(updated);
                      setModalForm(updated);
                    }}
                    fullWidth
                  />
                </div>
              </div>

              {/* Dimensions */}
              <SubplateDimensionFields
                dimLabels={dimLabels}
                modalForm={modalForm}
                blockInvalidNumberKeys={blockInvalidNumberKeys}
                handleNumericDimension={handleNumericDimension}
                heightDisabled={heightDisabled}
                handleDimensionChange={handleDimensionChange}
                modalUnitOptions={modalUnitOptions}
              />

              {/* Minimal Clean Theoretical Weight Readout */}
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100/70 border border-slate-200/90 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                    <Scale className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Theoretical Weight:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {modalForm.weight ? `${modalForm.weight} kg` : "0.000 kg"}
                  </span>
                </div>
                {Number(modalForm.sqty) > 1 && Boolean(modalForm.weight) && (
                  <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-xs">
                    {(Number(modalForm.weight) / Number(modalForm.sqty)).toFixed(3)} kg/pc ({modalForm.sqty} pcs)
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ================= BATCH SUBPLATE ADD MODE ================= */
          <div className="space-y-4">
            {/* Target Mould Selection (Applies to all subplates in this batch) */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Target Mould / Project</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <ProjectSelect
                projects={scans}
                value={modalForm.projectid}
                required
                isLoading={isProjectsLoading}
                placeholder="Search or select mould / project for all subplates..."
                onOpen={() => projectsQuery.refetch()}
                onChange={(val, project) => {
                  setModalForm((prev) => ({
                    ...prev,
                    projectid: project?.id ? String(project.id) : val,
                  }));
                }}
              />
              {!modalForm.projectid && (
                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  Please select target mould to allocate subplates.
                </p>
              )}
            </div>

            {/* List of Subplates */}
            <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {(batchPlates || []).map((plate, index) => {
                const shape = plate.shape || "Plate";
                const unit = plate.unit || "mm";
                const plateDimLabels = getDimensionLabels(shape, unit);
                const hDisabled = isHeightDisabled(shape);

                return (
                  <div
                    key={plate.id}
                    className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 hover:border-slate-300 transition-all space-y-3"
                  >
                    {/* Header with index, duplicate, remove */}
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {plate.platename || `Subplate #${index + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => duplicateBatchPlate?.(plate.id)}
                          title="Duplicate subplate"
                          className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 rounded-lg transition-colors flex items-center gap-1 border border-transparent hover:border-blue-200"
                        >
                          <Copy className="w-3 h-3" />
                          <span className="hidden sm:inline">Duplicate</span>
                        </button>
                        {batchPlates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBatchPlate?.(plate.id)}
                            title="Remove subplate"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition-colors border border-transparent hover:border-rose-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-blue-600" />
                          <span>Plate Name</span>
                          <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <GhostPlateInput
                          id={`batch-plate-${plate.id}`}
                          required
                          placeholder="e.g. Cavity Plate A-Side"
                          value={plate.platename}
                          existingPlateNames={modalTargetPlateNames}
                          onChange={(val) =>
                            updateBatchPlate?.(plate.id, "platename", val)
                          }
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Compass className="w-3 h-3 text-cyan-600" />
                          <span>Shape</span>
                        </label>
                        <ERPSelect
                          value={plate.shape}
                          onChange={(val) => updateBatchPlate?.(plate.id, "shape", String(val))}
                          options={modalShapeOptions}
                          showSearch={false}
                          placeholder="Shape"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-amber-600" />
                          <span>Material</span>
                        </label>
                        <ERPSelect
                          value={plate.material}
                          onChange={(val) => updateBatchPlate?.(plate.id, "material", String(val))}
                          options={modalMaterialOptions}
                          searchPlaceholder="Search material..."
                          placeholder="Material"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Package className="w-3 h-3 text-indigo-600" />
                          <span>Qty</span>
                        </label>
                        <RollingCounter
                          size="sm"
                          variant="input"
                          min={1}
                          max={9999}
                          value={Math.max(1, parseInt(plate.sqty || "1", 10) || 1)}
                          onChange={(val) => {
                            updateBatchPlate?.(plate.id, "sqty", String(Math.max(1, val)));
                          }}
                          fullWidth
                        />
                      </div>
                    </div>

                    {/* Dimensions */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {plateDimLabels.isRound ? (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.widthPlaceholder}
                              value={plate.width}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "width", clean);
                              }}
                              className="w-full h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              OD
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.length}
                              value={plate.length}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "length", clean);
                              }}
                              className="w-full h-9 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              L
                            </span>
                          </div>
                          <div>
                            <input
                              type="text"
                              disabled
                              placeholder="—"
                              value=""
                              className="w-full h-9 pl-3 pr-7 rounded-xl text-xs font-mono font-bold bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                            />
                          </div>
                        </>
                      ) : plateDimLabels.isPipe ? (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.widthPlaceholder}
                              value={plate.width}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "width", clean);
                              }}
                              className="w-full h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              OD
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.heightPlaceholder}
                              value={plate.height}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "height", clean);
                              }}
                              className="w-full h-9 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              T
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.length}
                              value={plate.length}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "length", clean);
                              }}
                              className="w-full h-9 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              L
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.length}
                              value={plate.length}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "length", clean);
                              }}
                              className="w-full h-9 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              L
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.widthPlaceholder}
                              value={plate.width}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "width", clean);
                              }}
                              className="w-full h-9 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              W
                            </span>
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder={plateDimLabels.heightPlaceholder}
                              value={plate.height}
                              disabled={hDisabled}
                              onKeyDown={blockInvalidNumberKeys}
                              onChange={(e) => {
                                const clean = e.target.value.replace(/[^0-9.]/g, "");
                                updateBatchPlate?.(plate.id, "height", clean);
                              }}
                              className={"w-full h-9 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 " + (
                                hDisabled
                                  ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                                  : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400"
                              )}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                              {hDisabled ? "—" : "H"}
                            </span>
                          </div>
                        </>
                      )}
                      <div>
                        <ERPSelect
                          value={plate.unit || "mm"}
                          onChange={(val) => updateBatchPlate?.(plate.id, "unit", String(val))}
                          options={modalUnitOptions}
                          showSearch={false}
                          placeholder="Unit"
                        />
                      </div>
                    </div>

                    {/* Compact Theoretical Weight */}
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                          <Scale className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Theoretical Weight:
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm">
                          {plate.weight ? `${plate.weight} kg` : "0.000 kg"}
                        </span>
                      </div>
                      {Number(plate.sqty) > 1 && Boolean(plate.weight) && (
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200/80 shadow-xs">
                          {(Number(plate.weight) / Number(plate.sqty)).toFixed(3)} kg/pc ({plate.sqty} pcs)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* + Add Another Subplate Row Button */}
            <button
              type="button"
              onClick={addBatchPlate}
              className="w-full py-2.5 rounded-xl border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 hover:bg-blue-50 text-blue-700 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Subplate Workpiece</span>
            </button>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 sm:pt-4 mt-2 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
          <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-2">
            {!isEditing && batchPlates.length > 1 ? (
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                <span>Total: {batchPlates.length} plates</span>
                <span className="text-slate-400">·</span>
                <span>Batch Weight: <strong className="font-mono text-slate-900">{totalBatchWeight.toFixed(3)} kg</strong></span>
              </span>
            ) : (
              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Strict numeric validation & 9-stage tracking enabled</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto sm:ml-auto">
            <MotionButton
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalOpen(false);
                setEditingSubplate(null);
              }}
              className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold"
            >
              Cancel
            </MotionButton>
            <MotionButton
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isModalFormValid}
              isLoading={isSubmitting}
              loadingText={
                isEditing
                  ? "Saving Changes..."
                  : batchPlates.length > 1
                    ? `Adding ${batchPlates.length} Plates...`
                    : "Saving..."
              }
              successText={
                isEditing
                  ? "Saved!"
                  : batchPlates.length > 1
                    ? `${batchPlates.length} Plates Added!`
                    : "Saved!"
              }
              className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
            >
              {isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>
                {isEditing
                  ? "Save Changes"
                  : batchPlates.length > 1
                    ? `Add ${batchPlates.length} Subplates`
                    : "Add Subplate"}
              </span>
            </MotionButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
