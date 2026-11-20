"use client";

import {
  createEmptySubplateForm,
  createNewSubplateForm,
  createEditingSubplateForm,
  isSubplateFormValid,
  createSubplatePayload,
} from "../model/subplate-form";
import type { BatchSubplateItem } from "../model/types";
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
  const [batchPlates, setBatchPlates] = useState<BatchSubplateItem[]>([]);

  const handleOpenAddPlate = (project: ScanProject) => {
    setEditingSubplate(null);
    setAddPlateProject(project);
    const count = (project.total_plates || 0) + 1;
    const isRework = (project.worktype || "").toLowerCase().includes("rework");
    const initialItem: BatchSubplateItem = {
      id: `sp-${Date.now()}-1`,
      platename: `Plate ${count}`,
      subprojectid: project.projectid ? `${project.projectid}_${String(count).padStart(3, "0")}` : "",
      material: "MS-Bright",
      shape: "Plate",
      length: "",
      width: "",
      height: "",
      weight: "",
      unit: "mm",
      sqty: "1",
      location: "SM",
      subplate_type: isRework ? "repair" : "new_make",
    };
    setBatchPlates([initialItem]);
    setPlateForm(createNewSubplateForm(project));
  };

  const handleOpenEditPlate = (subplate: Subplate, project?: ScanProject | null) => {
    const proj = project || data.find((d) => String(d.id) === String(subplate.projectid) || d.projectid === String(subplate.projectid)) || null;
    setEditingSubplate(subplate);
    setAddPlateProject(proj);
    setPlateForm(createEditingSubplateForm(subplate));
  };

  const addBatchPlate = () => {
    if (!addPlateProject) return;
    const nextNum = (addPlateProject.total_plates || 0) + batchPlates.length + 1;
    const isRework = (addPlateProject.worktype || "").toLowerCase().includes("rework");
    const newItem: BatchSubplateItem = {
      id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      platename: `Plate ${nextNum}`,
      subprojectid: addPlateProject.projectid ? `${addPlateProject.projectid}_${String(nextNum).padStart(3, "0")}` : "",
      material: "MS-Bright",
      shape: "Plate",
      length: "",
      width: "",
      height: "",
      weight: "",
      unit: "mm",
      sqty: "1",
      location: "SM",
      subplate_type: isRework ? "repair" : "new_make",
    };
    setBatchPlates((prev) => [...prev, newItem]);
  };

  const removeBatchPlate = (id: string) => {
    if (batchPlates.length <= 1) return;
    setBatchPlates((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (!addPlateProject) return filtered;
      const baseCount = (addPlateProject.total_plates || 0);
      return filtered.map((p, idx) => ({
        ...p,
        subprojectid: addPlateProject.projectid ? `${addPlateProject.projectid}_${String(baseCount + idx + 1).padStart(3, "0")}` : p.subprojectid,
      }));
    });
  };

  const duplicateBatchPlate = (id: string) => {
    const target = batchPlates.find((p) => p.id === id);
    if (!target || !addPlateProject) return;
    const nextNum = (addPlateProject.total_plates || 0) + batchPlates.length + 1;
    const duplicated: BatchSubplateItem = {
      ...target,
      id: `sp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      platename: `${target.platename} (Copy)`,
      subprojectid: addPlateProject.projectid ? `${addPlateProject.projectid}_${String(nextNum).padStart(3, "0")}` : "",
    };
    setBatchPlates((prev) => [...prev, duplicated]);
  };

  const updateBatchPlate = (id: string, field: keyof BatchSubplateItem, value: string) => {
    setBatchPlates((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const updated = { ...p, [field]: value };
        if (field === "shape" && isHeightDisabled(value)) {
          updated.height = "";
        }
        if (["shape", "material", "length", "width", "height", "unit", "sqty"].includes(field)) {
          const wt = calculateSubplateWeight({
            shape: updated.shape,
            material: updated.material,
            length: updated.length,
            width: updated.width,
            height: updated.height,
            unit: updated.unit,
            quantity: updated.sqty,
          });
          updated.weight = wt > 0 ? wt.toFixed(3) : "";
        }
        return updated;
      })
    );
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

  const isPlateFormValid = useMemo(() => {
    if (editingSubplate) {
      return isSubplateFormValid(
        { platename: plateForm.platename, sqty: plateForm.sqty, length: plateForm.length, width: plateForm.width, height: plateForm.height, subplate_type: plateForm.subplate_type },
        plateHeightDisabled
      );
    }
    if (!batchPlates.length) return false;
    return batchPlates.every((p) => {
      if (!p.platename?.trim()) return false;
      const q = parseInt(p.sqty || "0", 10);
      if (isNaN(q) || q < 1) return false;
      // Repair subplates skip dimension validation
      if (p.subplate_type === "repair") return true;
      const hDisabled = isHeightDisabled(p.shape);
      if (p.length && (isNaN(parseFloat(p.length)) || parseFloat(p.length) < 0)) return false;
      if (p.width && (isNaN(parseFloat(p.width)) || parseFloat(p.width) < 0)) return false;
      if (!hDisabled && p.height && (isNaN(parseFloat(p.height)) || parseFloat(p.height) < 0)) return false;
      return true;
    });
  }, [editingSubplate, plateForm, plateHeightDisabled, batchPlates]);

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
    if (!addPlateProject) return;

    if (editingSubplate) {
      if (!plateForm.platename?.trim()) {
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
        const url = "/api/subplate";
        const payload = createSubplatePayload(plateForm, editingSubplate, addPlateProject, plateHeightDisabled, true);

        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update subplate");
        }

        const resData = await res.json();
        const plateResult = resData.subplate || resData.data;

        if (viewProject && addPlateProject && viewProject.id === addPlateProject.id) {
          if (plateResult) {
            setViewSubplates((prev) =>
              prev.map((p) => (p.id === editingSubplate.id ? { ...p, ...plateResult } : p))
            );
          } else {
            await fetchSubplatesForProject(viewProject);
          }
        }

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
          message: "Subplate updated successfully",
        });

        setEditingSubplate(null);
        setAddPlateProject(null);
        onRefresh?.();
      } catch (err: any) {
        const errMsg = err?.message || "Error saving subplate";
        appStore.addToast({
          type: "error",
          message: "Error saving subplate: " + errMsg,
        });
      } finally {
        setIsSubmittingPlate(false);
      }
    } else {
      // Batch Add Subplates
      if (!batchPlates.length || !isPlateFormValid) {
        appStore.addToast({
          type: "warning",
          message: "Please ensure all subplates have valid names and positive dimensions.",
        });
        return;
      }

      try {
        setIsSubmittingPlate(true);
        const url = "/api/subplate";
        const payload = {
          projectid: addPlateProject.id,
          subplates: batchPlates.map((p) => {
            const isRepair = p.subplate_type === "repair";
            return {
              platename: p.platename.trim(),
              subprojectid: p.subprojectid?.trim() || undefined,
              subplate_type: p.subplate_type || "new_make",
              shape: isRepair ? null : p.shape,
              material: isRepair ? null : p.material,
              length: isRepair ? null : (p.length ? Number(p.length) : null),
              width: isRepair ? null : (p.width ? Number(p.width) : null),
              height: isRepair ? null : (isHeightDisabled(p.shape) || !p.height ? null : Number(p.height)),
              weight: isRepair ? null : (Number(p.weight || "0") || null),
              unit: isRepair ? null : (p.unit || "mm"),
              sqty: Math.max(1, parseInt(p.sqty || "1", 10) || 1),
              location: p.location || "SM",
            };
          }),
        };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create subplates");
        }

        if (viewProject && addPlateProject && viewProject.id === addPlateProject.id) {
          await fetchSubplatesForProject(viewProject);
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        broadcastQueryInvalidation(queryKeys.subplates.all());
        broadcastQueryInvalidation(queryKeys.projects.all());
        broadcastQueryInvalidation(queryKeys.purchases.all());
        broadcastQueryInvalidation(queryKeys.dashboard.counts());

        const count = batchPlates.length;
        appStore.addToast({
          type: "success",
          message: count > 1 ? `${count} subplates added successfully!` : "Subplate added successfully!",
        });

        setEditingSubplate(null);
        setAddPlateProject(null);
        onRefresh?.();
      } catch (err: any) {
        const errMsg = err?.message || "Error adding subplates";
        appStore.addToast({
          type: "error",
          message: "Error adding subplates: " + errMsg,
        });
      } finally {
        setIsSubmittingPlate(false);
      }
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
    batchPlates,
    setBatchPlates,
    addBatchPlate,
    removeBatchPlate,
    duplicateBatchPlate,
    updateBatchPlate,
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
