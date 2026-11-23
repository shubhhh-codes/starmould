import type { Subplate } from "@/lib/supabase/types";

export function isPurchaseOptional(plate: Subplate, worktype: string | null | undefined = plate.mould_worktype): boolean {
  return plate.subplate_type === "repair" || ["rework", "sample"].includes(worktype?.trim().toLowerCase() ?? "");
}

export function hasInHousePurchaseClearance(plate?: Subplate | null): boolean {
  return Boolean(plate?.po_bypassed && !plate.has_active_po && !plate.jobwork_balance?.has_po);
}

export function hasCompletedManufacturing(plate: Subplate): boolean {
  return [plate.received_qcby, plate.vmc_workby, plate.vmc_qcby, plate.drilltap_workby, plate.final_qcby, plate.packing_workby]
    .every((assignee) => Number(assignee) > 0);
}
