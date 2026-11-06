import type { ScanProject, Subplate } from "@/lib/supabase/types";
import type { SubplateFormState } from "./types";

export function createEmptySubplateForm(): SubplateFormState {
  return {
    platename: "",
    subprojectid: "",
    material: "MS-Bright",
    shape: "Plate",
    length: "",
    width: "",
    height: "",
    weight: "",
    unit: "mm",
    sqty: "1",
    location: "SM",
  };
}

export function createNewSubplateForm(project: ScanProject): SubplateFormState {
  const count = (project.total_plates || 0) + 1;
  return {
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
  };
}

export function createEditingSubplateForm(subplate: Subplate): SubplateFormState {
  return {
    platename: subplate.platename || "",
    subprojectid: subplate.subprojectid || "",
    material: subplate.material || "MS-Bright",
    shape: subplate.shape || "Plate",
    length: subplate.length !== null && subplate.length !== undefined ? String(subplate.length) : "",
    width: subplate.width !== null && subplate.width !== undefined ? String(subplate.width) : "",
    height: subplate.height !== null && subplate.height !== undefined ? String(subplate.height) : "",
    weight: subplate.weight !== null && subplate.weight !== undefined ? String(subplate.weight) : "",
    unit: subplate.unit || "mm",
    sqty: subplate.sqty !== null && subplate.sqty !== undefined ? String(subplate.sqty) : "1",
    location: subplate.location || "SM",
  };
}

export function isSubplateFormValid(plateForm: Pick<SubplateFormState, "platename" | "sqty" | "length" | "width" | "height">, plateHeightDisabled: boolean) {
  if (!plateForm.platename?.trim()) return false;
  const q = parseInt(plateForm.sqty || "0", 10);
  if (isNaN(q) || q < 1) return false;
  if (plateForm.length && (isNaN(parseFloat(plateForm.length)) || parseFloat(plateForm.length) < 0)) return false;
  if (plateForm.width && (isNaN(parseFloat(plateForm.width)) || parseFloat(plateForm.width) < 0)) return false;
  if (!plateHeightDisabled && plateForm.height && (isNaN(parseFloat(plateForm.height)) || parseFloat(plateForm.height) < 0)) return false;
  return true;
}

export function createSubplatePayload(plateForm: SubplateFormState, editingSubplate: Subplate | null, addPlateProject: ScanProject, plateHeightDisabled: boolean, isEditing: boolean) {
  return isEditing
    ? {
      id: editingSubplate!.id,
      updates: {
        platename: plateForm.platename.trim(),
        subprojectid: plateForm.subprojectid?.trim() || undefined,
        shape: plateForm.shape,
        material: plateForm.material,
        length: plateForm.length ? Number(plateForm.length) : null,
        width: plateForm.width ? Number(plateForm.width) : null,
        height: plateHeightDisabled || !plateForm.height ? null : Number(plateForm.height),
        weight: Number(plateForm.weight || "0") || null,
        unit: plateForm.unit || "mm",
        sqty: Number(plateForm.sqty || "1"),
        location: plateForm.location || "SM",
      },
    }
    : {
      ...plateForm,
      platename: plateForm.platename.trim(),
      length: plateForm.length ? Number(plateForm.length) : null,
      width: plateForm.width ? Number(plateForm.width) : null,
      height: plateHeightDisabled || !plateForm.height ? null : Number(plateForm.height),
      weight: Number(plateForm.weight || "0") || null,
      sqty: Number(plateForm.sqty || "1"),
      projectid: addPlateProject.id,
    };
}
