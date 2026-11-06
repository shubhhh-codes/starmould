"use client";

import {
  Plus,
  Layers,
  Building2,
  Scale,
  Lock,
  ShieldCheck,
  Package,
  Compass,
  Wrench,
  Tag,
  Sparkles,
  Pencil,
  Check,
} from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { ERPSelect } from "@/components/ui/erp-select";
import { RollingCounter } from "@/components/ui/rolling-counter";
import { MotionButton } from "@/components/ui/motion-button";
import { MATERIAL_DENSITIES } from "@/lib/weight-calculator";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "addPlateProject"
  | "editingSubplate"
  | "setAddPlateProject"
  | "setEditingSubplate"
  | "handleSubmitPlate"
  | "plateForm"
  | "setPlateForm"
  | "handleDimensionChange"
  | "modalPlateShapeOptions"
  | "modalPlateMaterialOptions"
  | "recalculatePlateWeight"
  | "plateDimLabels"
  | "blockInvalidNumberKeys"
  | "handleNumericPlateDimension"
  | "plateHeightDisabled"
  | "modalPlateUnitOptions"
  | "isSubmittingPlate"
  | "isPlateFormValid"
>;

export function SubplateFormModal({
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
}: Props) {
  return (
    <Modal
      isOpen={Boolean(addPlateProject || editingSubplate)}
      onClose={() => {
        setAddPlateProject(null);
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
            <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
              {editingSubplate ? "Edit Subplate Workpiece" : "Add Subplate Workpiece"}
            </h3>
            <p className="text-xs text-slate-500">
              {editingSubplate
                ? `Update specifications for "${editingSubplate.platename}"`
                : addPlateProject
                  ? `Attach workpiece plate to Mould ${addPlateProject.projectid || `#${addPlateProject.id}`}`
                  : "Define workpiece dimensions, material and route to shopfloor"}
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmitPlate} className="space-y-4">
        {/* Group 1: Plate Identification & Auto Subproject Code */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Plate Name</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cavity Plate A"
              value={plateForm.platename}
              onChange={(e) =>
                setPlateForm({ ...plateForm, platename: e.target.value })
              }
              className="w-full h-10 px-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Subproject / Mould Code</span>
            </label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={plateForm.subprojectid || (addPlateProject ? addPlateProject.projectid : "") || ""}
              className="w-full h-10 px-3.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 select-none cursor-not-allowed shadow-xs"
            />
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
                value={plateForm.shape}
                onChange={(val) => handleDimensionChange("shape", String(val))}
                options={modalPlateShapeOptions}
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
                  {MATERIAL_DENSITIES[plateForm.material] || 7.81} g/cm³
                </span>
              </label>
              <ERPSelect
                value={plateForm.material}
                onChange={(val) => handleDimensionChange("material", String(val))}
                options={modalPlateMaterialOptions}
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
                value={Math.max(1, parseInt(plateForm.sqty || "1", 10) || 1)}
                onChange={(val) => {
                  const next = Math.max(1, val);
                  const updated = { ...plateForm, sqty: String(next) };
                  updated.weight = recalculatePlateWeight(updated);
                  setPlateForm(updated);
                }}
                fullWidth
              />
            </div>
          </div>

          {/* Dimensions Sub-grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Dimensions & Unit
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                {plateDimLabels.headerGuide}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {plateDimLabels.isRound ? (
                <>
                  {/* 1. OD (Outer Diameter) */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.widthPlaceholder}
                        value={plateForm.width}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                        className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        OD
                      </span>
                    </div>
                  </div>
                  {/* 2. Length */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.length}
                        value={plateForm.length}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                        className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        L
                      </span>
                    </div>
                  </div>
                  {/* 3. Height (Disabled for Round) */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        placeholder={plateDimLabels.heightPlaceholder}
                        value=""
                        className="w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        —
                      </span>
                    </div>
                  </div>
                </>
              ) : plateDimLabels.isPipe ? (
                <>
                  {/* 1. OD (Outer Diameter) */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.widthPlaceholder}
                        value={plateForm.width}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                        className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        OD
                      </span>
                    </div>
                  </div>
                  {/* 2. Wall Thickness */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.heightPlaceholder}
                        value={plateForm.height}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("height", e.target.value)}
                        className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        T
                      </span>
                    </div>
                  </div>
                  {/* 3. Length */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.length}
                        value={plateForm.length}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                        className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        L
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 1. Length */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.length}
                        value={plateForm.length}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                        className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        L
                      </span>
                    </div>
                  </div>
                  {/* 2. Width */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.widthPlaceholder}
                        value={plateForm.width}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                        className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        W
                      </span>
                    </div>
                  </div>
                  {/* 3. Height / Thickness */}
                  <div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={plateDimLabels.heightPlaceholder}
                        value={plateForm.height}
                        disabled={plateHeightDisabled}
                        onKeyDown={blockInvalidNumberKeys}
                        onChange={(e) => handleNumericPlateDimension("height", e.target.value)}
                        className={"w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 " + (
                          plateHeightDisabled
                            ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                        )}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                        {plateHeightDisabled ? "—" : "H"}
                      </span>
                    </div>
                  </div>
                </>
              )}
              <div>
                <ERPSelect
                  value={plateForm.unit || "mm"}
                  onChange={(val) => handleDimensionChange("unit", String(val))}
                  options={modalPlateUnitOptions}
                  showSearch={false}
                  placeholder="Unit"
                />
              </div>
            </div>
          </div>
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
              {Number(plateForm.sqty) > 1
                ? ("Total (" + plateForm.sqty + " pcs)")
                : "Auto"}
            </span>
          </div>

          <div className="flex items-baseline gap-2 relative z-10">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {plateForm.weight || "0.000"}
            </span>
            <span className="text-sm font-bold text-slate-400">kg</span>
            {Number(plateForm.sqty) > 1 && Boolean(plateForm.weight) && (
              <span className="ml-auto text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                {(Number(plateForm.weight) / Number(plateForm.sqty)).toFixed(3)} kg / pc
              </span>
            )}
          </div>

          {Number(plateForm.sqty) > 1 && Boolean(plateForm.weight) ? (
            <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 flex items-center justify-between relative z-10 font-mono">
              <span>
                {plateForm.sqty} pcs × {(Number(plateForm.weight) / Number(plateForm.sqty)).toFixed(3)} kg
              </span>
              <span className="text-slate-300 font-sans font-semibold">Total Batch Wt</span>
            </div>
          ) : (
            <div className="mt-1 text-[10px] text-slate-400 relative z-10">
              Based on {plateForm.material} density @ {MATERIAL_DENSITIES[plateForm.material] || 7.81} g/cm³
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
                setAddPlateProject(null);
                setEditingSubplate(null);
              }}
              className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold"
            >
              Cancel
            </MotionButton>
            <MotionButton
              type="submit"
              variant="primary"
              disabled={isSubmittingPlate || !isPlateFormValid}
              isLoading={isSubmittingPlate}
              loadingText={editingSubplate ? "Saving Changes..." : "Adding Plate..."}
              successText={editingSubplate ? "Saved!" : "Plate Added!"}
              className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
            >
              {editingSubplate ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingSubplate ? "Save Changes" : "Add Subplate"}</span>
            </MotionButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
