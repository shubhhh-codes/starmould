"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Modal } from "@/components/ui/dialog";
import { ERPSelect, type ERPSelectOption } from "@/components/ui/erp-select";
import { MotionButton } from "@/components/ui/motion-button";
import { GhostPlateInput } from "@/components/subplate/ghost-plate-input";
import {
  calculateSubplateWeight,
  MATERIAL_DENSITIES,
  SUPPORTED_SHAPES,
  SUPPORTED_UNITS,
} from "@/lib/weight-calculator";
import {
  getRecommendedCompanionPlates,
  type CompanionRecommendation,
} from "@/lib/plate-recommender";
import { useCreateSubplateMutation, useSubplatesByProjectQuery } from "@/lib/query/hooks";
import { appStore } from "@/lib/state/store";
import type { ScanProject, Subplate } from "@/lib/supabase/types";
import {
  Boxes,
  Compass,
  Layers,
  Scale,
  Sparkles,
  MapPin,
  Check,
  Plus,
  Tag,
  AlertCircle,
  Hash,
  ShieldCheck,
  Building2,
} from "lucide-react";

export interface CreateSubplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ScanProject | null;
  onSuccess?: (newSubplate?: any) => void;
}

const MATERIAL_OPTIONS: ERPSelectOption[] = Object.keys(MATERIAL_DENSITIES).map((mat) => ({
  value: mat,
  label: `${mat} (${MATERIAL_DENSITIES[mat]} g/cm³)`,
}));

const SHAPE_OPTIONS: ERPSelectOption[] = SUPPORTED_SHAPES.map((shape) => ({
  value: shape,
  label: shape,
}));

const UNIT_OPTIONS: ERPSelectOption[] = SUPPORTED_UNITS.map((unit) => ({
  value: unit,
  label: unit,
}));

export function CreateSubplateModal({
  isOpen,
  onClose,
  project,
  onSuccess,
}: CreateSubplateModalProps) {
  const createSubplateMutation = useCreateSubplateMutation();

  const [form, setForm] = useState({
    platename: "",
    shape: "Plate",
    length: "100",
    width: "100",
    height: "25",
    unit: "mm",
    material: "MS-Bright",
    sqty: "1",
    location: "SM",
  });

  const [keepOpenForNext, setKeepOpenForNext] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch sibling subplates for context recommendations
  const siblingSubplatesQuery = useSubplatesByProjectQuery(project?.id ? String(project.id) : undefined);
  const siblingSubplates = (Array.isArray(siblingSubplatesQuery.data)
    ? siblingSubplatesQuery.data
    : (project?.subplates || [])) as Subplate[];

  const existingPlateNames = useMemo(() => {
    return siblingSubplates
      .map((sp) => sp.platename?.trim())
      .filter((name): name is string => Boolean(name));
  }, [siblingSubplates]);

  const companionRecommendations = useMemo(() => {
    if (!siblingSubplates.length) return [];
    return getRecommendedCompanionPlates(siblingSubplates, 4);
  }, [siblingSubplates]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        platename: "",
        shape: "Plate",
        length: "100",
        width: "100",
        height: "25",
        unit: "mm",
        material: "MS-Bright",
        sqty: "1",
        location: "SM",
      });
      setErrorMessage(null);
    }
  }, [isOpen, project]);

  const normShape = (form.shape || "Plate").toLowerCase();
  const isRound = normShape === "round" || normShape === "round bar";
  const isPipe = normShape === "pipe";

  // Real-time theoretical weight calculation
  const calculatedWeight = useMemo(() => {
    const numLen = parseFloat(form.length) || 0;
    const numWid = parseFloat(form.width) || 0;
    const numHgt = parseFloat(form.height) || 0;
    const numQty = parseInt(form.sqty, 10) || 1;

    if (numLen <= 0 || numWid <= 0 || (!isRound && numHgt <= 0)) {
      return "0.000";
    }

    const wt = calculateSubplateWeight({
      shape: form.shape,
      material: form.material,
      length: numLen,
      width: numWid,
      height: numHgt,
      unit: form.unit,
      quantity: numQty,
    });

    return wt > 0 ? wt.toFixed(3) : "0.000";
  }, [form, isRound]);

  const handleApplyCompanion = (rec: CompanionRecommendation) => {
    setForm((prev) => {
      const next = { ...prev, platename: rec.name };
      if (rec.mirroredSpecs) {
        if (rec.mirroredSpecs.length) next.length = String(rec.mirroredSpecs.length);
        if (rec.mirroredSpecs.width) next.width = String(rec.mirroredSpecs.width);
        if (rec.mirroredSpecs.material) next.material = String(rec.mirroredSpecs.material);
        if (rec.mirroredSpecs.shape) next.shape = String(rec.mirroredSpecs.shape);
      }
      return next;
    });
  };

  const isValid = useMemo(() => {
    if (!form.platename.trim()) return false;
    const l = parseFloat(form.length);
    const w = parseFloat(form.width);
    const h = parseFloat(form.height);
    const q = parseInt(form.sqty, 10);
    if (isNaN(l) || l <= 0) return false;
    if (isNaN(w) || w <= 0) return false;
    if (!isRound && (isNaN(h) || h <= 0)) return false;
    if (isNaN(q) || q <= 0) return false;
    return true;
  }, [form, isRound]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id) {
      setErrorMessage("No target mould project selected.");
      return;
    }
    if (!isValid) {
      setErrorMessage("Please fill all required dimension fields with valid positive numbers.");
      return;
    }

    try {
      setErrorMessage(null);
      const res = await createSubplateMutation.mutateAsync({
        platename: form.platename.trim(),
        projectid: Number(project.id),
        shape: form.shape,
        length: parseFloat(form.length),
        width: parseFloat(form.width),
        height: isRound ? 0 : parseFloat(form.height),
        unit: form.unit,
        material: form.material,
        sqty: parseInt(form.sqty, 10) || 1,
        weight: parseFloat(calculatedWeight) || 0,
        location: form.location,
      });

      appStore.addToast({
        type: "success",
        message: `Subplate "${form.platename.trim()}" added to ${project.projectid || `#${project.id}`} successfully!`,
        duration: 4000,
      });

      if (onSuccess) {
        onSuccess(res);
      }

      if (keepOpenForNext) {
        setForm((prev) => ({
          ...prev,
          platename: "",
        }));
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create subplate";
      setErrorMessage(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">Add New Subplate</span>
              {project && (
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {project.projectid || `#${project.id}`}
                </span>
              )}
            </div>
            {project?.description && (
              <p className="text-xs text-slate-500 font-normal truncate max-w-sm">
                Target: {project.description}
              </p>
            )}
          </div>
        </div>
      }
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1-Click Companion Recommendations (Contextual Engine) */}
        {companionRecommendations.length > 0 && (
          <div className="p-3 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Recommended Companion Plates</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {companionRecommendations.map((rec) => (
                <button
                  key={rec.name}
                  type="button"
                  onClick={() => handleApplyCompanion(rec)}
                  className="px-2.5 py-1 bg-white hover:bg-blue-600 hover:text-white border border-slate-200 hover:border-blue-600 text-slate-700 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5 shadow-2xs group cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-blue-500 group-hover:text-white" />
                  <span>{rec.name}</span>
                  <span className="text-[10px] opacity-70 font-mono">({rec.confidence}%)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Plate Name Input with Smart Contextual Autocomplete */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Plate Name</span>
              <span className="text-rose-500">*</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              Press <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">Tab</kbd> to complete suggestion
            </span>
          </label>
          <GhostPlateInput
            id="create-subplate-name-input"
            required
            placeholder="e.g. Cavity Plate A-Side, Top Clamping Plate..."
            value={form.platename}
            existingPlateNames={existingPlateNames}
            onChange={(val) => setForm((prev) => ({ ...prev, platename: val }))}
          />
        </div>

        {/* Geometry & Shape Specifications */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            {/* Shape (4 cols) */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-600" />
                <span>Shape</span>
              </label>
              <ERPSelect
                value={form.shape}
                onChange={(val) => setForm((prev) => ({ ...prev, shape: String(val) }))}
                options={SHAPE_OPTIONS}
                showSearch={false}
              />
            </div>

            {/* Material Grade (8 cols) */}
            <div className="sm:col-span-8">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>Material Grade</span>
              </label>
              <ERPSelect
                value={form.material}
                onChange={(val) => setForm((prev) => ({ ...prev, material: String(val) }))}
                options={MATERIAL_OPTIONS}
                showSearch={true}
              />
            </div>
          </div>

          {/* Dynamic Dimensions: Length, Width/OD, Height/Thickness, Unit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Dimensions & Unit
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Length */}
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  placeholder="Length"
                  value={form.length}
                  onChange={(e) => setForm((prev) => ({ ...prev, length: e.target.value }))}
                  className="w-full h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  L
                </span>
              </div>

              {/* Width / OD */}
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  placeholder={isRound ? "Outer Dia (OD)" : "Width (W)"}
                  value={form.width}
                  onChange={(e) => setForm((prev) => ({ ...prev, width: e.target.value }))}
                  className="w-full h-9 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  {isRound ? "OD" : "W"}
                </span>
              </div>

              {/* Height / Thickness */}
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  disabled={isRound}
                  placeholder={isRound ? "—" : isPipe ? "Wall (T)" : "Thickness (H)"}
                  value={isRound ? "" : form.height}
                  onChange={(e) => setForm((prev) => ({ ...prev, height: e.target.value }))}
                  className={`w-full h-9 pl-3 pr-8 rounded-lg text-xs font-mono font-bold ${
                    isRound
                      ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  }`}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  {isRound ? "—" : isPipe ? "T" : "H"}
                </span>
              </div>

              {/* Unit */}
              <div>
                <ERPSelect
                  value={form.unit}
                  onChange={(val) => setForm((prev) => ({ ...prev, unit: String(val) }))}
                  options={UNIT_OPTIONS}
                  showSearch={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quantity, Location & Hero Weight Readout */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
          {/* Weight Card (6 cols) */}
          <div className="sm:col-span-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-3 text-white flex flex-col justify-between shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-400" />
                <span>Theoretical Weight</span>
              </span>
              <span className="text-[10px] font-mono text-cyan-300">
                {parseInt(form.sqty, 10) > 1 ? `Batch (${form.sqty} pcs)` : "Auto"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 my-1">
              <span className="font-mono text-2xl font-extrabold tracking-tight text-white">
                {calculatedWeight}
              </span>
              <span className="text-xs font-bold text-slate-400">kg</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Density: {MATERIAL_DENSITIES[form.material] || 7.81} g/cm³ ({form.material})
            </div>
          </div>

          {/* Quantity & Location (6 cols) */}
          <div className="sm:col-span-6 flex flex-col justify-between gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span>Quantity (Pcs)</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={form.sqty}
                onChange={(e) => setForm((prev) => ({ ...prev, sqty: e.target.value }))}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Production Routing</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, location: "SM" }))}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                    form.location === "SM"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  In-House (SM)
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, location: "Vendor" }))}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition text-center cursor-pointer ${
                    form.location !== "SM"
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Outward Vendor
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={keepOpenForNext}
              onChange={(e) => setKeepOpenForNext(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Keep modal open to add multiple subplates</span>
          </label>

          <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={createSubplateMutation.isPending}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <MotionButton
              type="submit"
              variant="primary"
              disabled={!isValid || createSubplateMutation.isPending}
              isLoading={createSubplateMutation.isPending}
              loadingText="Adding Subplate..."
              className="px-5 py-2 text-xs font-bold shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Subplate</span>
            </MotionButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
