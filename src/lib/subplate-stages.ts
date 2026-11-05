import type { Subplate, User } from "@/lib/supabase/types";

export interface UserSessionMinimal {
  role_id?: number | null;
  role?: string | null;
  id?: number | string | null;
  usertype?: string | null;
}

// 9 Production Stages configuration
export const STAGE_DEFINITIONS = [
  { key: "design_by", atKey: "design_at", nameKey: "design_by_name", short: "DES", label: "1. Design Order", assignTitle: "Assign to Designer", step: 1, color: "blue", roleId: 3, roleName: "Designer" },
  { key: "order_by", atKey: "order_at", nameKey: "order_by_name", short: "PUR", label: "2. Purchase", assignTitle: "Assign to Purchase", step: 2, color: "amber", roleId: 5, roleName: "Purchase Incharge" },
  { key: "received_workby", atKey: "received_work_at", nameKey: "received_workby_name", short: "REC", label: "3. Mat. Inward", assignTitle: "Assign to Mat. Inward", step: 3, color: "emerald", roleId: 5, roleName: "Purchase Incharge" },
  { key: "received_qcby", atKey: "received_qc_at", nameKey: "received_qcby_name", short: "PROG", label: "4. Programming Work", assignTitle: "Assign to Programmer", step: 4, color: "teal", roleId: 10, roleName: "Programmer" },
  { key: "vmc_workby", atKey: "vmc_work_at", nameKey: "vmc_workby_name", short: "VMC", label: "5. VMC Work", assignTitle: "Assign to VMC Work", step: 5, color: "indigo", roleId: 6, roleName: "VMC Department" },
  { key: "vmc_qcby", atKey: "vmc_qc_at", nameKey: "vmc_qcby_name", short: "VQC", label: "6. VMC QC", assignTitle: "Assign to VMC QC", step: 6, color: "purple", roleId: 7, roleName: "Quality Checking (QC)" },
  { key: "drilltap_workby", atKey: "drilltap_at", nameKey: "drilltap_workby_name", short: "D&T", label: "7. Drill & Tap", assignTitle: "Assign to Drill & Tap", step: 7, color: "violet", roleId: 4, roleName: "Worker" },
  { key: "final_qcby", atKey: "final_qc_at", nameKey: "final_qcby_name", short: "FQC", label: "8. Final QC", assignTitle: "Assign to Final QC", step: 8, color: "cyan", roleId: 7, roleName: "Quality Checking (QC)" },
  { key: "packing_workby", atKey: "packing_at", nameKey: "packing_workby_name", short: "PAK", label: "9. Packing & Dispatch", assignTitle: "Packing & Dispatch", step: 9, color: "rose", roleId: 9, roleName: "Dispatch" },
] as const;

export type StageDefinition = (typeof STAGE_DEFINITIONS)[number];

/**
 * Filter stages strictly based on the logged-in user's role:
 * - Admin (role 0) & Manager (role 1): All 9 stages
 * - Designer (role 3): ONLY Stage 1 (design_by)
 * - Purchase Incharge (role 5): Stage 2 (order_by) & Stage 3 (received_workby)
 * - Programmer (role 10): ONLY Stage 4 (received_qcby)
 * - VMC (role 6): ONLY Stage 5 (vmc_workby)
 * - QC (role 7): ONLY Stage 6 (vmc_qcby) & Stage 8 (final_qcby)
 * - Dispatch (role 9): ONLY Stage 9 (packing_workby)
 * - Worker (role 4): ONLY Stage 3 (received_workby) & Stage 7 (drilltap_workby)
 */
export function getAllowedStagesForUser(currentUser: UserSessionMinimal | null, isAdmin: boolean): StageDefinition[] {
  if (isAdmin) {
    return [...STAGE_DEFINITIONS];
  }
  if (!currentUser) return [];

  const roleId = Number(currentUser.role_id ?? -1);
  const roleName = (currentUser.role || "").toLowerCase();
  const userType = (currentUser.usertype || "").toLowerCase();
  const match = (term: string) => roleName.includes(term) || userType.includes(term);

  if (roleId === 3 || match("designer")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "design_by");
  }
  if (roleId === 5 || match("purchase")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "order_by" || s.key === "received_workby");
  }
  if (roleId === 10 || match("programmer")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "received_qcby");
  }
  if (roleId === 6 || match("vmc")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "vmc_workby");
  }
  if (roleId === 7 || match("qc") || match("quality")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "vmc_qcby" || s.key === "final_qcby");
  }
  if (roleId === 9 || match("dispatch") || match("packing")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "packing_workby");
  }
  if (roleId === 4 || match("worker") || match("operator")) {
    return STAGE_DEFINITIONS.filter((s) => s.key === "drilltap_workby" || s.key === "received_workby");
  }
  if (roleId === 1 || match("manager")) {
    return [...STAGE_DEFINITIONS];
  }

  return [];
}

/**
 * Helper to get clean active status & progress summary for a subplate
 */
export function getSubplateProgressInfo(sp: Subplate, staff: User[] = []) {
  let completed = 0;
  let lastAssignedIndex = -1;
  const totalQty = Number(sp.sqty) || 1;
  const orderedQty = Number(sp.ordered_qty ?? sp.jobwork_balance?.po_ordered_qty ?? (sp as any).po_ordered_qty ?? 0);
  const remainingQty = Number(sp.remaining_qty ?? Math.max(0, totalQty - orderedQty));
  const isPartialPO = sp.po_status === "PARTIAL" || (orderedQty > 0 && orderedQty < totalQty);
  const inwardQty = Number((sp as any).inward_qty ?? sp.jobwork_balance?.po_inward_qty ?? 0);
  const isPartialInward = sp.inward_status === "PARTIAL" || (inwardQty > 0 && inwardQty < totalQty);
  const remainingInward = Math.max(0, totalQty - inwardQty);

  for (let i = 0; i < STAGE_DEFINITIONS.length; i++) {
    const stageDef = STAGE_DEFINITIONS[i];
    const val = (sp as any)[stageDef.key];
    if (val && Number(val) !== 0) {
      if (stageDef.key === "order_by" && isPartialPO) {
        // Stage 2 is only partially completed
      } else if (stageDef.key === "received_workby" && isPartialInward) {
        // Stage 3 is only partially completed
      } else {
        completed++;
      }
      lastAssignedIndex = i;
    }
  }

  if (completed === 0 && !isPartialPO) {
    return {
      badgeLabel: "Not Started",
      subtext: "Pending Design Order",
      badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
      dotColor: "bg-slate-400",
      completed,
      isCompleted: false,
      activeStage: STAGE_DEFINITIONS[0],
      assignee: null,
    };
  }

  if (completed === 9) {
    return {
      badgeLabel: "Completed & Ready",
      subtext: "All 9 stages done",
      badgeStyle: "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold",
      dotColor: "bg-emerald-500",
      completed,
      isCompleted: true,
      activeStage: STAGE_DEFINITIONS[8],
      assignee: null,
    };
  }

  const stage = STAGE_DEFINITIONS[lastAssignedIndex] || STAGE_DEFINITIONS[0];
  const userId = (sp as any)[stage.key];
  const staffMember = staff.find((u) => u.id === Number(userId));
  const rawName = (sp as any)[stage.nameKey];
  const validRawName = rawName && rawName !== "-" ? rawName : null;
  const staffName = validRawName || staffMember?.name || staffMember?.initials || null;

  if (stage.key === "order_by") {
    const linkedPOs = sp.linked_pos && sp.linked_pos.length > 0 ? sp.linked_pos : [];
    const isMultiPO = linkedPOs.length > 1;
    const poListStr = linkedPOs.map((p) => `#${p.po_srno}`).join(", ");

    if (isPartialPO) {
      return {
        badgeLabel: isMultiPO
          ? `Stage 2: Purchase (${linkedPOs.length} POs • ${orderedQty}/${totalQty} pcs)`
          : `Stage 2: Purchase (${orderedQty}/${totalQty} pcs)`,
        subtext: isMultiPO
          ? `${linkedPOs.length} POs: ${poListStr} (${remainingQty} pending)`
          : `${orderedQty}/${totalQty} ordered (${remainingQty} pending)`,
        badgeStyle: "bg-amber-50 text-amber-900 border-amber-300 font-bold shadow-2xs",
        dotColor: "bg-amber-500",
        completed,
        isCompleted: false,
        activeStage: stage,
        assignee: isMultiPO
          ? `${linkedPOs.length} POs (${orderedQty}/${totalQty} pcs)`
          : (staffName ? `${staffName} (${orderedQty}/${totalQty} pcs)` : null),
      };
    }

    if (isMultiPO) {
      return {
        badgeLabel: `Stage 2: Purchase (${linkedPOs.length} POs • ${sp.sqty || sp.ordered_qty} pcs)`,
        subtext: `${linkedPOs.length} POs: ${poListStr}`,
        badgeStyle: "bg-blue-50 text-blue-900 border-blue-200/90 font-bold shadow-2xs",
        dotColor: "bg-blue-600",
        completed,
        isCompleted: false,
        activeStage: stage,
        assignee: `${linkedPOs.length} POs • ${sp.sqty || sp.ordered_qty} pcs`,
      };
    }
  }

  if (stage.key === "received_workby") {
    const linkedInwards = sp.linked_inwards && sp.linked_inwards.length > 0 ? sp.linked_inwards : [];
    const isMultiInward = linkedInwards.length > 1;
    const inwardListStr = linkedInwards.map((inw) => `#${inw.inward_no}`).join(", ");

    if (isPartialInward) {
      return {
        badgeLabel: isMultiInward
          ? `Stage 3: Mat. Inward (${linkedInwards.length} Receipts • ${inwardQty}/${totalQty} pcs)`
          : `Stage 3: Mat. Inward (Partial: ${inwardQty}/${totalQty} pcs)`,
        subtext: isMultiInward
          ? `${linkedInwards.length} Inwards: ${inwardListStr} (${remainingInward} pending)`
          : `${inwardQty}/${totalQty} inwarded (${remainingInward} pending)`,
        badgeStyle: "bg-amber-50 text-amber-900 border-amber-300 font-bold shadow-2xs",
        dotColor: "bg-amber-500",
        completed,
        isCompleted: false,
        activeStage: stage,
        assignee: isMultiInward
          ? `${linkedInwards.length} Inwards (${inwardQty}/${totalQty} pcs)`
          : (staffName ? `${staffName} (${inwardQty}/${totalQty} pcs)` : null),
      };
    }

    if (isMultiInward) {
      return {
        badgeLabel: `Stage 3: Mat. Inward (${linkedInwards.length} Receipts • ${totalQty} pcs)`,
        subtext: `${linkedInwards.length} Inwards: ${inwardListStr}`,
        badgeStyle: "bg-blue-50 text-blue-900 border-blue-200/90 font-bold shadow-2xs",
        dotColor: "bg-blue-600",
        completed,
        isCompleted: false,
        activeStage: stage,
        assignee: `${linkedInwards.length} Inwards • ${totalQty} pcs`,
      };
    }
  }

  return {
    badgeLabel: `Stage ${stage.step}: ${stage.label.replace(/^\d+\.\s*/, "")}`,
    subtext: staffName ? `Assigned: ${staffName}` : "In Progress",
    badgeStyle: "bg-blue-50 text-blue-900 border-blue-200/90 font-bold shadow-2xs",
    dotColor: "bg-blue-600",
    completed,
    isCompleted: false,
    activeStage: stage,
    assignee: staffName,
  };
}
