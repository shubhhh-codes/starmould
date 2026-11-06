"use client";

import type { UserSession } from "@/components/providers/auth-provider";
import type { UserProfile } from "@/lib/supabase/types";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { appStore } from "@/lib/state/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import { STAGE_DEFINITIONS } from "@/lib/subplate-stages";
import type { ScanProject, Subplate } from "@/lib/supabase/types";

type Options = {
  currentUser: UserSession | null;
  data: ScanProject[];
  router: ReturnType<typeof useRouter>;
  isAdmin: boolean;
  activeStaff: UserProfile[];
  queryClient: ReturnType<typeof useQueryClient>;
  onRefresh: (() => void) | undefined;
};

export function useMouldAssignments({
  currentUser,
  data,
  router,
  isAdmin,
  activeStaff,
  queryClient,
  onRefresh,
}: Options) {

  // Quick Staff Assignment Modal (Admin & Staff)
  const [assignStaffModal, setAssignStaffModal] = useState<{
    isOpen: boolean;
    subplate: Subplate | null;
    stage: (typeof STAGE_DEFINITIONS)[number] | null;
  }>({
    isOpen: false,
    subplate: null,
    stage: null,
  });

  const getTargetStageForSubplate = (sp: Subplate) => {
    if (!currentUser) return STAGE_DEFINITIONS[0];
    const roleId = Number(currentUser.role_id);
    const roleName = (currentUser.role || "").toLowerCase();

    let rolePreferredKey: string | null = null;
    if (roleId === 3 || roleName.includes("designer")) {
      rolePreferredKey = "design_by";
    } else if (roleId === 5 || roleName.includes("purchase")) {
      rolePreferredKey = "order_by";
    } else if (roleId === 10 || roleName.includes("programmer")) {
      rolePreferredKey = "received_qcby";
    } else if (roleId === 6 || roleName.includes("vmc")) {
      rolePreferredKey = "vmc_workby";
    } else if (roleId === 7 || roleName.includes("qc") || roleName.includes("quality")) {
      rolePreferredKey = !(sp as any).vmc_qcby ? "vmc_qcby" : "final_qcby";
    } else if (roleId === 9 || roleName.includes("dispatch")) {
      rolePreferredKey = "packing_workby";
    }

    if (rolePreferredKey) {
      const matched = STAGE_DEFINITIONS.find((s) => s.key === rolePreferredKey);
      if (matched) {
        const currentVal = (sp as any)[matched.key];
        if (!currentVal || Number(currentVal) === Number(currentUser.id)) {
          return matched;
        }
      }
    }

    for (const stage of STAGE_DEFINITIONS) {
      const val = (sp as any)[stage.key];
      if (!val || Number(val) === 0) {
        return stage;
      }
    }
    return STAGE_DEFINITIONS[0];
  };

  const handleAssignSubplateToUser = async (subplateId: number, stageKey: string, userId: number) => {
    if (stageKey === "order_by") {
      appStore.addToast({
        type: "error",
        message: "Stage 2 (Purchase) cannot be assigned manually. A Purchase Order must be created first.",
      });
      return;
    }

    if (stageKey === "received_workby" && userId !== 0) {
      let foundSubplate: any = null;
      let parentProject: ScanProject | undefined = undefined;
      for (const p of data) {
        const sp = p.subplates?.find((s: any) => s.id === subplateId);
        if (sp) {
          foundSubplate = sp;
          parentProject = p;
          break;
        }
      }
      const inwardQty = Number(foundSubplate?.po_inward_qty) || 0;
      if (inwardQty <= 0) {
        appStore.addToast({
          type: "error",
          message: "Stage 3 (Material Inward) cannot be assigned manually. Steel has not been received yet. Go to Purchase Inward.",
        });
        if (parentProject?.projectid) {
          router.push(`/purchase-inward?mould=${encodeURIComponent(parentProject.projectid)}`);
        }
        return;
      }
    }
    // Non-admin users cannot unassign once assigned
    if (!isAdmin && userId === 0) {
      appStore.addToast({
        type: "error",
        message: "Once assigned, only Administrators can unassign or reassign a production stage.",
      });
      return;
    }

    const newUserId = userId === 0 ? null : userId;
    const stageDef = STAGE_DEFINITIONS.find((s) => s.key === stageKey);
    const staffMember = activeStaff.find((u) => u.id === userId);
    const staffName = newUserId ? (staffMember?.name || staffMember?.initials || `Staff #${userId}`) : null;
    const nowIso = newUserId ? new Date().toISOString() : null;

    try {
      const res = await fetch("/api/subplate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subplateId,
          updates: {
            [stageKey]: newUserId,
            ...(stageDef ? { [stageDef.nameKey]: staffName, [stageDef.atKey]: nowIso } : {}),
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update subplate assignment");
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
      broadcastQueryInvalidation(queryKeys.subplates.all());
      broadcastQueryInvalidation(queryKeys.projects.all());
      broadcastQueryInvalidation(queryKeys.dashboard.counts());
      onRefresh?.();
      appStore.addToast({
        type: "success",
        message: userId === 0 ? "Stage unassigned successfully" : `Assigned to ${staffName || "staff"} successfully`,
      });
    } catch (err: any) {
      appStore.addToast({
        type: "error",
        message: err.message || "Failed to update stage assignment",
      });
    }
  };
  return {
    getTargetStageForSubplate,
    handleAssignSubplateToUser,
    setAssignStaffModal,
    assignStaffModal,
  };
}
