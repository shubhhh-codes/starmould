"use client";

import {
  CheckCircle2,
  ShoppingCart,
  Lock,
  Pencil,
  UserCheck,
  UserX,
} from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { STAGE_DEFINITIONS, getAllowedStagesForUser } from "@/lib/subplate-stages";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "subplateContextMenu"
  | "setSubplateContextMenu"
  | "getTargetStageForSubplate"
  | "currentUser"
  | "isAdmin"
  | "activeStaff"
  | "setCreatePOProject"
  | "setIsCreatePOOpen"
  | "router"
  | "handleAssignSubplateToUser"
  | "setAssignStaffModal"
  | "canEditSubplate"
  | "handleOpenEditPlate"
>;

export function SubplateContextMenu({
  subplateContextMenu,
  setSubplateContextMenu,
  getTargetStageForSubplate,
  currentUser,
  isAdmin,
  activeStaff,
  setCreatePOProject,
  setIsCreatePOOpen,
  router,
  handleAssignSubplateToUser,
  setAssignStaffModal,
  canEditSubplate,
  handleOpenEditPlate,
}: Props) {
  return (
    <>
      {subplateContextMenu.subplate && (
        <ContextMenu
          x={subplateContextMenu.x}
          y={subplateContextMenu.y}
          isOpen={subplateContextMenu.isOpen}
          onClose={() =>
            setSubplateContextMenu((prev) => ({ ...prev, isOpen: false, subplate: null, project: null }))
          }
          title={`${subplateContextMenu.subplate.platename} #${subplateContextMenu.subplate.id} • ${subplateContextMenu.subplate.subprojectid ||
            subplateContextMenu.project?.projectid ||
            "Subplate"
            }`}
          items={(() => {
            const sp = subplateContextMenu.subplate;
            if (!sp) return [];

            const targetStage = getTargetStageForSubplate(sp);
            const targetVal = (sp as any)[targetStage.key];
            const isAlreadyAssignedToMe = Boolean(
              currentUser?.id && Number(targetVal) === Number(currentUser.id)
            );
            const isAssignedToOther = Boolean(targetVal && targetVal !== 0 && !isAlreadyAssignedToMe);
            const currentUserId = Number(currentUser?.id);

            const items: ContextMenuItem[] = [];

            const isManagerial =
              isAdmin ||
              currentUser?.role_id === 1 ||
              currentUser?.role_id === 2 ||
              currentUser?.role?.toLowerCase() === "supervisor" ||
              currentUser?.role?.toLowerCase() === "manager";

            if (isManagerial) {
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
                const rawName = (sp as any)[st.nameKey];
                const validRawName = rawName && rawName !== "-" ? rawName : null;
                const staffName = validRawName || staffMember?.name || staffMember?.initials || `Staff #${val}`;

                if (st.key === "order_by") {
                  if (isDone) {
                    items.push({
                      label: `Purchase (Locked by PO)`,
                      subtext: `Stage 2 • Assigned to ${staffName} via PO`,
                      icon: Lock,
                      disabled: true,
                      onClick: () => { },
                    });
                  } else {
                    items.push({
                      label: `Generate PO for Plate (Stage 2)`,
                      subtext: `Stage 2 • Purchase Order required to assign`,
                      icon: ShoppingCart,
                      variant: "primary",
                      onClick: () => {
                        setCreatePOProject(subplateContextMenu.project || null);
                        setIsCreatePOOpen(true);
                      },
                    });
                  }
                  return;
                }

                if (st.key === "received_workby") {
                  const inwardQty = Number((sp as any).po_inward_qty) || 0;
                  if (!isDone && inwardQty <= 0) {
                    items.push({
                      label: `Material Inward (Gate Entry Required)`,
                      subtext: `Stage 3 • Receive steel at factory gate to unlock`,
                      icon: Lock,
                      variant: "primary",
                      onClick: () => {
                        router.push(`/purchase-inward?mould=${encodeURIComponent(subplateContextMenu.project?.projectid || "")}`);
                      },
                    });
                    return;
                  }
                }

                if (st.step >= 4 && st.step <= 9) {
                  const inwardQty = Number((sp as any).po_inward_qty) || 0;
                  if (!isDone && inwardQty <= 0) {
                    items.push({
                      label: `${st.assignTitle} (Material Inward Required)`,
                      subtext: `Stage ${st.step} • Receive steel at factory gate to unlock`,
                      icon: Lock,
                      variant: "primary",
                      onClick: () => {
                        router.push(`/purchase-inward?mould=${encodeURIComponent(subplateContextMenu.project?.projectid || "")}`);
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
                    onClick: () => handleAssignSubplateToUser(sp.id, st.key, 0),
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

              // Admin & Authorized Management Utilities
              if (canEditSubplate) {
                items.push({
                  separator: true,
                  label: "Edit Subplate Specifications",
                  icon: Pencil,
                  onClick: () => handleOpenEditPlate(sp, subplateContextMenu.project),
                });
              }
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
                  subtext: "Your role has no stage assignment permissions",
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
                  const rawName = (sp as any)[st.nameKey];
                  const validRawName = rawName && rawName !== "-" ? rawName : null;
                  const name = validRawName || staffMember?.name || staffMember?.initials || "staff";

                  if (isMine) {
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
                      subtext: `Assigned to ${name} • Only Admin can reassign`,
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
                        router.push(`/purchase-inward?mould=${encodeURIComponent(subplateContextMenu.project?.projectid || "")}`);
                      },
                    });
                  } else {
                    items.push({
                      label: `Assign to Me (${st.label.replace(/^\d+\.\s*/, "")})`,
                      subtext: `Stage ${st.step} • Click to assign to yourself`,
                      icon: UserCheck,
                      variant: "primary",
                      onClick: () => handleAssignSubplateToUser(sp.id, st.key, currentUserId),
                    });
                  }
                });
              }
            }

            return items;
          })()}
        />
      )}
    </>
  );
}
