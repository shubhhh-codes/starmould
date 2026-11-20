import type { ScanProject, Subplate } from "@/lib/supabase/types";
import type { SubplateFormState } from "./types";

function isReworkProject(project: ScanProject): boolean {
  return (project.worktype || "").toLowerCase().includes("rework");
}

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
    subplate_type: "new_make",
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
    subplate_type: isReworkProject(project) ? "repair" : "new_make",
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
    subplate_type: subplate.subplate_type ?? "new_make",
  };
}

export function isSubplateFormValid(plateForm: Pick<SubplateFormState, "platename" | "sqty" | "length" | "width" | "height" | "subplate_type">, plateHeightDisabled: boolean) {
  if (!plateForm.platename?.trim()) return false;
  const q = parseInt(plateForm.sqty || "0", 10);
  if (isNaN(q) || q < 1) return false;
  // Repair subplates skip dimension validation
  if (plateForm.subplate_type === "repair") return true;
  if (plateForm.length && (isNaN(parseFloat(plateForm.length)) || parseFloat(plateForm.length) < 0)) return false;
  if (plateForm.width && (isNaN(parseFloat(plateForm.width)) || parseFloat(plateForm.width) < 0)) return false;
  if (!plateHeightDisabled && plateForm.height && (isNaN(parseFloat(plateForm.height)) || parseFloat(plateForm.height) < 0)) return false;
  return true;
}

export function createSubplatePayload(plateForm: SubplateFormState, editingSubplate: Subplate | null, addPlateProject: ScanProject, plateHeightDisabled: boolean, isEditing: boolean) {
  const isRepair = plateForm.subplate_type === "repair";
  return isEditing
    ? {
      id: editingSubplate!.id,
      updates: {
        platename: plateForm.platename.trim(),
        subprojectid: plateForm.subprojectid?.trim() || undefined,
        subplate_type: plateForm.subplate_type,
        shape: isRepair ? null : plateForm.shape,
        material: isRepair ? null : plateForm.material,
        length: isRepair ? null : (plateForm.length ? Number(plateForm.length) : null),
        width: isRepair ? null : (plateForm.width ? Number(plateForm.width) : null),
        height: isRepair ? null : (plateHeightDisabled || !plateForm.height ? null : Number(plateForm.height)),
        weight: isRepair ? null : (Number(plateForm.weight || "0") || null),
        unit: isRepair ? null : (plateForm.unit || "mm"),
        sqty: Number(plateForm.sqty || "1"),
        location: plateForm.location || "SM",
      },
    }
    : {
      ...plateForm,
      platename: plateForm.platename.trim(),
      subplate_type: plateForm.subplate_type,
      shape: isRepair ? null : plateForm.shape,
      material: isRepair ? null : plateForm.material,
      length: isRepair ? null : (plateForm.length ? Number(plateForm.length) : null),
      width: isRepair ? null : (plateForm.width ? Number(plateForm.width) : null),
      height: isRepair ? null : (plateHeightDisabled || !plateForm.height ? null : Number(plateForm.height)),
      weight: isRepair ? null : (Number(plateForm.weight || "0") || null),
      sqty: Number(plateForm.sqty || "1"),
      projectid: addPlateProject.id,
    };
}
