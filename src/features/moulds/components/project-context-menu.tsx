"use client";

import {
  Eye,
  CheckCircle2,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { ContextMenu } from "@/components/ui/context-menu";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "contextMenu"
  | "setContextMenu"
  | "canCreateSubplate"
  | "handleOpenAddPlate"
  | "canCreatePurchase"
  | "handleCreatePO"
  | "handleOpenView"
  | "isAdmin"
  | "handleToggleProjectStatus"
  | "canDeleteMould"
  | "handleDeleteSingleProject"
>;

export function ProjectContextMenu({
  contextMenu,
  setContextMenu,
  canCreateSubplate,
  handleOpenAddPlate,
  canCreatePurchase,
  handleCreatePO,
  handleOpenView,
  isAdmin,
  handleToggleProjectStatus,
  canDeleteMould,
  handleDeleteSingleProject,
}: Props) {
  return (
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      isOpen={contextMenu.isOpen}
      onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false, project: null }))}
      title={
        contextMenu.project
          ? `${contextMenu.project.projectid || `#${contextMenu.project.id}`} • ${contextMenu.project.customername || contextMenu.project.cname || "Mould"
          }`
          : undefined
      }
      items={
        contextMenu.project
          ? [
            ...(canCreateSubplate
              ? [
                {
                  label: "Add Subplate",
                  icon: Plus,
                  variant: "primary" as const,
                  onClick: () => {
                    if (contextMenu.project) handleOpenAddPlate(contextMenu.project);
                  },
                },
              ]
              : []),
            ...(canCreatePurchase
              ? [
                {
                  label: "Create Purchase PO",
                  icon: ShoppingCart,
                  variant: "primary" as const,
                  onClick: () => {
                    if (contextMenu.project) handleCreatePO(contextMenu.project);
                  },
                },
              ]
              : []),
            {
              label: "View Subplates",
              icon: Eye,
              variant: "default" as const,
              onClick: () => {
                if (contextMenu.project) handleOpenView(contextMenu.project);
              },
            },
            ...(isAdmin
              ? [
                {
                  label:
                    (contextMenu.project.status || "").toLowerCase() === "completed"
                      ? "Mark In Progress"
                      : "Mark Completed",
                  icon: CheckCircle2,
                  variant: "success" as const,
                  onClick: () => {
                    if (contextMenu.project) handleToggleProjectStatus(contextMenu.project);
                  },
                },
              ]
              : []),
            ...(canDeleteMould
              ? [
                {
                  label: "Delete Mould",
                  icon: Trash2,
                  variant: "danger" as const,
                  separator: true,
                  onClick: () => {
                    if (contextMenu.project) handleDeleteSingleProject(contextMenu.project);
                  },
                },
              ]
              : []),
          ]
          : []
      }
    />
  );
}
