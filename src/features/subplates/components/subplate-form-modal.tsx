"use client";

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
  Lock,
  Check,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { ERPSelect } from "@/components/ui/erp-select";
import { RollingCounter } from "@/components/ui/rolling-counter";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { ProjectSelect } from "@/components/ui/project-select";
import { GhostPlateInput } from "@/components/subplate/ghost-plate-input";
import { MATERIAL_DENSITIES } from "@/lib/weight-calculator";

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
}: Props) {
  return (
    <Modal
      isOpen={isModalOpen}
      onClose={() => {
        setIsModalOpen(false);
        setEditingSubplate(null);
      }}
      maxWidth="xl"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
            {editingSubplate ? (
              <Pencil className="w-5 h-5 stroke-[2.2]" />
            ) : (
              <Layers className="w-5 h-5 stroke-[2.2]" />
            )}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug truncate">
              {editingSubplate ? "Edit Subplate Workpiece" : "Add New Subplate"}
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              {editingSubplate
                ? `Update specifications for "${editingSubplate.platename}"`
                : "Define workpiece specifications & allocate to project"}
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmitModal} className="space-y-4">
        {/* Group 1: Workpiece Identification & Mould Assignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* 1-Click Companion Quick-Pills (if target mould has sibling plates) */}
          {companionRecommendations.length > 0 && !editingSubplate && (
            <div className="sm:col-span-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-cyan-50/50 border border-blue-200/70 shadow-2xs space-y-1.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  <span>Suggested Companion Plates</span>
                  <span className="text-[9px] font-medium text-blue-600 bg-blue-100/80 px-1.5 py-0.2 rounded-full border border-blue-200/60">
                    Co-Occurrence
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium hidden xs:inline">
                  1-Click Auto-Fill
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
                {companionRecommendations.map((rec) => (
                  <button
                    key={rec.name}
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleApplyCompanion(rec)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-blue-200/90 bg-white text-slate-800 hover:text-blue-700 hover:bg-blue-50/90 hover:border-blue-300 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer group"
                    title={
                      rec.mirroredSpecs
                        ? `Auto-mirrors specs: ${rec.mirroredSpecs.length}×${rec.mirroredSpecs.width} ${rec.mirroredSpecs.material}`
                        : undefined
                    }
                  >
                    <span className="group-hover:text-blue-600 transition-colors">
                      {rec.name}
                    </span>
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 group-hover:bg-blue-100/80">
                      {rec.confidence}%
                    </span>
                    {rec.mirroredSpecs && (
                      <span className="text-[9px] text-emerald-600 font-medium hidden sm:inline">
                        (Auto-specs)
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Plate Name</span>
                <span className="text-rose-500 font-bold">*</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
                Press <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">Tab</kbd> or <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">→</kbd> to complete
              </span>
            </label>
            <GhostPlateInput
              id="subplate-modal-platename"
              required
              placeholder="e.g. Cavity Plate A-Side"
              value={modalForm.platename}
              existingPlateNames={modalTargetPlateNames}
              onChange={(val) =>
                setModalForm((prev) => ({
                  ...prev,
                  platename: val,
                }))
              }
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
            {!modalForm.projectid && (
              <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1.5">
                <AlertCircle className="w-3 h-3 shrink-0" />
                Target mould selection is required to enable saving.
              </p>
            )}
          </div>
        </div>

        {/* Group 2: Material Grade & Geometry Specifications */}
        <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Shape (4 cols) */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-600" />
                <span>Shape</span>
              </label>
              <ERPSelect
                value={modalForm.shape}
                onChange={(val) =>
                  handleDimensionChange("shape", String(val))
                }
                options={modalShapeOptions}
                showSearch={false}
                placeholder="Shape"
              />
            </div>

            {/* Material (5 cols) */}
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
                onChange={(val) =>
                  handleDimensionChange("material", String(val))
                }
                options={modalMaterialOptions}
                searchPlaceholder="Search material..."
                placeholder="Material"
              />
            </div>

            {/* Quantity with Bencho Rolling Counter (3 cols) */}
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

          {/* Dimensions Sub-grid */}
          <SubplateDimensionFields
            dimLabels={dimLabels}
            modalForm={modalForm}
            blockInvalidNumberKeys={blockInvalidNumberKeys}
            handleNumericDimension={handleNumericDimension}
            heightDisabled={heightDisabled}
            handleDimensionChange={handleDimensionChange}
            modalUnitOptions={modalUnitOptions}
          />
        </div>

        {/* Group 3: Weight Engineering Readout */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3.5 sm:p-4 text-white flex flex-col justify-between shadow-md relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between relative z-10 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-blue-400" />
              <span>Theoretical Weight</span>
              <Lock className="w-3 h-3 text-slate-400" />
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
              {Number(modalForm.sqty) > 1
                ? ("Total (" + modalForm.sqty + " pcs)")
                : "Auto-Calculated"}
            </span>
          </div>

          <div className="flex items-baseline gap-2 relative z-10">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {modalForm.weight || "0.000"}
            </span>
            <span className="text-sm font-bold text-slate-400">kg</span>
            {Number(modalForm.sqty) > 1 && Boolean(modalForm.weight) && (
              <span className="ml-auto text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                {(Number(modalForm.weight) / Number(modalForm.sqty)).toFixed(3)} kg / pc
              </span>
            )}
          </div>

          {Number(modalForm.sqty) > 1 && Boolean(modalForm.weight) ? (
            <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 flex items-center justify-between relative z-10 font-mono">
              <span>
                {modalForm.sqty} pcs × {(Number(modalForm.weight) / Number(modalForm.sqty)).toFixed(3)} kg
              </span>
              <span className="text-slate-300 font-sans font-semibold">Total Batch Wt</span>
            </div>
          ) : (
            <div className="mt-1 text-[10px] text-slate-400 relative z-10">
              Based on {modalForm.material} density @ {MATERIAL_DENSITIES[modalForm.material] || 7.81} g/cm³
            </div>
          )}
        </div>

        {/* Footer Actions with Perfect Baseline Alignment */}
        <div className="pt-3 sm:pt-4 mt-1 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Strict numeric validation & 9-stage tracking enabled</span>
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
              loadingText={editingSubplate ? "Saving Changes..." : "Saving..."}
              successText={editingSubplate ? "Saved!" : "Subplate Saved!"}
              className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
            >
              {editingSubplate ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingSubplate ? "Save Changes" : "Save Subplate"}</span>
            </MotionButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
