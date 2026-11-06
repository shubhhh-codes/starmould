"use client";

import {
  createEmptySubplateForm,
  createNewSubplateForm,
  createEditingSubplateForm,
  isSubplateFormValid,
  createSubplatePayload,
} from "../model/subplate-form";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import React, { useState, useMemo } from "react";
import { type ERPSelectOption } from "@/components/ui/erp-select";
import { appStore } from "@/lib/state/store";
import {
  calculateSubplateWeight,
  isHeightDisabled,
  getDimensionLabels,
  SUPPORTED_UNITS,
  SUPPORTED_SHAPES,
  MATERIAL_DENSITIES,
} from "@/lib/weight-calculator";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import type { ScanProject, Subplate } from "@/lib/supabase/types";
import type { Dispatch, SetStateAction } from "react";

type Options = {
  data: ScanProject[];
  viewProject: ScanProject | null;
  setViewSubplates: Dispatch<SetStateAction<Subplate[]>>;
  fetchSubplatesForProject: (project: ScanProject) => Promise<void>;
  queryClient: ReturnType<typeof useQueryClient>;
  onRefresh: (() => void) | undefined;
};

export function useSubplateForm({
  data,
  viewProject,
  setViewSubplates,
  fetchSubplatesForProject,
  queryClient,
  onRefresh,
}: Options) {

  // Add / Edit Subplate Modal State
  const [addPlateProject, setAddPlateProject] = useState<ScanProject | null>(null);
  const [editingSubplate, setEditingSubplate] = useState<Subplate | null>(null);
  const [isSubmittingPlate, setIsSubmittingPlate] = useState(false);
  const [plateForm, setPlateForm] = useState(createEmptySubplateForm());

  const handleOpenAddPlate = (project: ScanProject) => {
    setEditingSubplate(null);
    setAddPlateProject(project);
    setPlateForm(createNewSubplateForm(project));
  };

  const handleOpenEditPlate = (subplate: Subplate, project?: ScanProject | null) => {
    const proj = project || data.find((d) => String(d.id) === String(subplate.projectid) || d.projectid === String(subplate.projectid)) || null;
    setEditingSubplate(subplate);
    setAddPlateProject(proj);
    setPlateForm(createEditingSubplateForm(subplate));
  };

  // Dynamic dimension labels and shape constraints for Add Plate modal
  const plateDimLabels = useMemo(
    () => getDimensionLabels(plateForm.shape, plateForm.unit || "mm"),
    [plateForm.shape, plateForm.unit]
  );
  const plateHeightDisabled = useMemo(
    () => isHeightDisabled(plateForm.shape),
    [plateForm.shape]
  );

  const isPlateFormValid = useMemo(() => isSubplateFormValid({ platename: plateForm.platename, sqty: plateForm.sqty, length: plateForm.length, width: plateForm.width, height: plateForm.height }, plateHeightDisabled), [plateForm.platename, plateForm.length, plateForm.width, plateForm.height, plateForm.sqty, plateHeightDisabled]);

  // Dynamic auto-calculation of subplate weight based on geometry, density, unit and quantity
  const recalculatePlateWeight = (form: typeof plateForm) => {
    const calculated = calculateSubplateWeight({
      shape: form.shape,
      material: form.material,
      length: form.length,
      width: form.width,
      height: form.height,
      unit: form.unit,
      quantity: form.sqty,
    });
    return calculated > 0 ? calculated.toFixed(3) : "";
  };

  // Strict numeric validation and keyboard filters for Add Plate modal
  const handleStepPlateQty = (delta: number) => {
    const current = parseInt(plateForm.sqty || '1', 10) || 1;
    const next = Math.max(1, current + delta);
    const updated = { ...plateForm, sqty: String(next) };
    updated.weight = recalculatePlateWeight(updated);
    setPlateForm(updated);
  };

  const handlePlateQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9]/g, "");
    const updated = { ...plateForm, sqty: clean };
    updated.weight = recalculatePlateWeight(updated);
    setPlateForm(updated);
  };

  const handleNumericPlateDimension = (field: "length" | "width" | "height", rawVal: string) => {
    let clean = rawVal.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = parts[0] + "." + parts.slice(1).join("");
    }
    handleDimensionChange(field, clean);
  };

  const blockInvalidNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const blockInvalidIntegerKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) {
      e.preventDefault();
    }
  };

  // Auto calculate subplate weight dynamically based on geometry, material density and units
  const handleDimensionChange = (field: string, value: string) => {
    const updated = { ...plateForm, [field]: value };
    if (field === "shape" && isHeightDisabled(value)) {
      updated.height = "";
    }
    updated.weight = recalculatePlateWeight(updated);
    setPlateForm(updated);
  };

  const handleSubmitPlate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPlateProject || !plateForm.platename?.trim()) {
      appStore.addToast({
        type: "warning",
        message: "Please enter a valid plate name.",
      });
      return;
    }

    if (!isPlateFormValid) {
      appStore.addToast({
        type: "warning",
        message: "Please enter valid, positive dimensions.",
      });
      return;
    }

    try {
      setIsSubmittingPlate(true);
      const isEditing = Boolean(editingSubplate);
      const url = "/api/subplate";
      const method = isEditing ? "PUT" : "POST";
      const payload = createSubplatePayload(plateForm, editingSubplate, addPlateProject, plateHeightDisabled, isEditing);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${isEditing ? "update" : "create"} subplate`);
      }

      const resData = await res.json();
      const plateResult = resData.subplate || resData.data;

      // If view modal is open for this same project, refresh its subplates
      if (viewProject && addPlateProject && viewProject.id === addPlateProject.id) {
        if (isEditing && plateResult) {
          setViewSubplates((prev) =>
            prev.map((p) => (p.id === editingSubplate!.id ? { ...p, ...plateResult } : p))
          );
        } else {
          await fetchSubplatesForProject(viewProject);
        }
      }

      // Invalidate queries so TanStack Query updates all active subplate tables/accordions & purchase orders
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.purchases.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());

      appStore.addToast({
        type: "success",
        message: isEditing ? "Subplate updated successfully" : "Subplate added successfully",
      });

      setEditingSubplate(null);
      setAddPlateProject(null);
      onRefresh?.();
    } catch (err: any) {
      const errMsg = err?.message || "Error saving subplate";
      if (errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("access denied")) {
        setEditingSubplate(null);
        setAddPlateProject(null);
        appStore.addToast({
          type: "error",
          message: "Access Denied: Your permission was revoked by administrator.",
          duration: 5000,
        });
      } else {
        appStore.addToast({
          type: "error",
          message: "Error saving subplate: " + errMsg,
        });
      }
    } finally {
      setIsSubmittingPlate(false);
    }
  };

  const modalPlateShapeOptions: ERPSelectOption[] = SUPPORTED_SHAPES.map((s) => ({ value: s, label: s }));

  const modalPlateMaterialOptions: ERPSelectOption[] = Object.keys(MATERIAL_DENSITIES).map((m) => ({
    value: m,
    label: m,
    subtitle: `${MATERIAL_DENSITIES[m] || 7.81} g/cm³`,
  }));

  const modalPlateUnitOptions: ERPSelectOption[] = SUPPORTED_UNITS.map((u) => ({ value: u, label: u }));
  return {
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
  };
}
