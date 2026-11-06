"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import {
  Layers,
  CheckCircle2,
  UserCheck,
  UserX,
  Lock,
  Pencil,
} from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { STAGE_DEFINITIONS, getAllowedStagesForUser } from "@/lib/subplate-stages";

type Props = Pick<SubplatePageContext,
  | "contextMenu"
  | "setContextMenu"
  | "getTargetStageForUser"
  | "currentUser"
  | "isAdmin"
  | "activeStaff"
  | "router"
  | "handleStageStaffChange"
  | "setAssignStaffModal"
  | "toggleRow"
  | "handleOpenEditModal"
>;

export function SubplateActionsMenu({
  contextMenu,
  setContextMenu,
  getTargetStageForUser,
  currentUser,
  isAdmin,
  activeStaff,
  router,
  handleStageStaffChange,
  setAssignStaffModal,
  toggleRow,
  handleOpenEditModal,
}: Props) {
  return (
    contextMenu.subplate && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false, subplate: null }))}
        title={`${contextMenu.subplate.platename} #${contextMenu.subplate.id} • ${contextMenu.subplate.subprojectid || (contextMenu.subplate as any).mould_project_code || "Subplate"
          }`}
        items={(() => {
          const sp = contextMenu.subplate;
          if (!sp) return [];

          const targetStage = getTargetStageForUser(sp);
          const targetVal = (sp as any)[targetStage.key];
          const isAlreadyAssignedToMe = Boolean(
            currentUser?.id && Number(targetVal) === Number(currentUser.id)
          );
          const isAssignedToOther = Boolean(targetVal && targetVal !== 0 && !isAlreadyAssignedToMe);
          const currentUserId = Number(currentUser?.id);

          const items: ContextMenuItem[] = [];

          if (isAdmin) {
            // =====================================================================
            // ADMIN ACTIONS:
            // Show all 9 production stages with department-targeted actions:
            // - If assigned: "Unassign [Staff Name] ([Stage])" (Danger Red)
            // - If unassigned: "Assign to [Department]" (e.g. "Assign to Designer", "Assign to VMC Work", etc.)
            // =====================================================================
            STAGE_DEFINITIONS.forEach((st) => {
              const val = (sp as any)[st.key];
              const isDone = Boolean(val && val !== 0);
              const staffMember = activeStaff.find((u) => u.id === Number(val));
              const staffName = (sp as any)[st.nameKey] || staffMember?.name || staffMember?.initials || `Staff #${val}`;

              if (st.key === "received_workby") {
                const inwardQty = Number((sp as any).po_inward_qty) || 0;
                if (!isDone && inwardQty <= 0) {
                  items.push({
                    label: `Material Inward (Gate Entry Required)`,
                    subtext: `Stage 3 • Receive steel at factory gate to unlock`,
                    icon: Lock,
                    variant: "primary",
                    onClick: () => {
                      router.push(`/purchase-inward?mould=${encodeURIComponent(sp.subprojectid || (sp as any).mould_project_code || "")}`);
                    },
                  });
                  return;
                }
              }

              if (isDone) {
                items.push({
                  label: `Unassign ${staffName} (${st.label.replace(/^\d+\.\s*/, "")})`,
                  subtext: `Stage ${st.step} • Click to unassign staff`,
                  icon: UserX,
                  variant: "danger",
                  onClick: () => handleStageStaffChange(sp.id, st.key, 0),
                });
              } else {
                items.push({
                  label: st.assignTitle,
                  subtext: `Stage ${st.step} • Click to select staff`,
                  icon: UserCheck,
                  variant: "primary",
                  onClick: () => {
                    setAssignStaffModal({
                      isOpen: true,
                      subplate: sp,
                      stage: st,
                    });
                  },
                });
              }
            });

            // Admin Management Utilities
            items.push({
              separator: true,
              label: "Open 9-Stage Studio",
              icon: Layers,
              onClick: () => toggleRow(sp.id),
            });
            items.push({
              label: "Edit Subplate Specifications",
              icon: Pencil,
              onClick: () => handleOpenEditModal(sp),
            });
          } else {
            // =====================================================================
            // NON-ADMIN ACTIONS (Strictly single department stage):
            // =====================================================================
            const allowedStages = getAllowedStagesForUser(currentUser, false);

            if (!currentUserId) {
              items.push({
                label: "Assign to Me",
                subtext: "Please login to assign tasks to your account",
                icon: UserCheck,
                disabled: true,
                onClick: () => { },
              });
            } else if (allowedStages.length === 0) {
              items.push({
                label: "No Assigned Department Stages",
                subtext: "Your role has no production stage assignments",
                icon: Lock,
                disabled: true,
                onClick: () => { },
              });
            } else {
              allowedStages.forEach((st) => {
                const val = (sp as any)[st.key];
                const isDone = Boolean(val && val !== 0);
                const isMine = Boolean(currentUserId && Number(val) === currentUserId);
                const isOther = isDone && !isMine;
                const staffMember = activeStaff.find((u) => u.id === Number(val));
                const name = (sp as any)[st.nameKey] || staffMember?.name || staffMember?.initials;

                if (isMine) {
                  // Locked: non-admins cannot unassign once assigned
                  items.push({
                    label: `${st.label.replace(/^\d+\.\s*/, "")} (Assigned to You)`,
                    subtext: `Assigned to you • Only Admin can unassign`,
                    icon: CheckCircle2,
                    variant: "success",
                    disabled: true,
                    onClick: () => { },
                  });
                } else if (isOther) {
                  items.push({
                    label: `${st.label.replace(/^\d+\.\s*/, "")} (Assigned)`,
                    subtext: `Assigned to ${name || "staff"} • Only Admin can reassign`,
                    icon: Lock,
                    disabled: true,
                    onClick: () => { },
                  });
                } else if (st.key === "received_workby" && (Number((sp as any).po_inward_qty) || 0) <= 0) {
                  items.push({
                    label: `Material Inward (Gate Entry Required)`,
                    subtext: `Stage 3 • Receive steel at factory gate to unlock`,
                    icon: Lock,
                    variant: "primary",
                    onClick: () => {
                      router.push(`/purchase-inward?mould=${encodeURIComponent(sp.subprojectid || (sp as any).mould_project_code || "")}`);
                    },
                  });
                } else {
                  items.push({
                    label: `Assign to Me (${st.label.replace(/^\d+\.\s*/, "")})`,
                    subtext: `Stage ${st.step} • Click to assign to yourself`,
                    icon: UserCheck,
                    variant: "primary",
                    onClick: () => handleStageStaffChange(sp.id, st.key, currentUserId),
                  });
                }
              });
            }

            // Overview utility for non-admin
            items.push({
              separator: true,
              label:
                allowedStages.length === 1
                  ? `Open ${allowedStages[0].label.replace(/^\d+\.\s*/, "")} Studio`
                  : "Open Tracking Studio",
              icon: Layers,
              onClick: () => toggleRow(sp.id),
            });
          }

          return items;
        })()}
      />
    )
  );
}
