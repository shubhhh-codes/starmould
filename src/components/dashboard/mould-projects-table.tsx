"use client";

import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ShoppingCart,
  Trash2,
  RefreshCw,
  X,
  Layers,
  Loader2,
  Building2,
  Calendar,
  Layers3,
  Calculator,
  Scale,
  Lock,
  ShieldCheck,
  Package,
  Compass,
  Wrench,
  Tag,
  MapPin,
  Minus,
  Sparkles,
  Pencil,
  Check,
  UserCheck,
  UserX,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ScanProject, Subplate, User } from "@/lib/supabase/types";
import { TableSkeletonRows } from "@/components/ui/skeleton";
import { Modal, Drawer, ConfirmDialog } from "@/components/ui/dialog";
import { ERPSelect, type ERPSelectOption } from "@/components/ui/erp-select";
import { MotionButton } from "@/components/ui/motion-button";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { CreatePurchaseOrderModal } from "@/components/purchase/create-purchase-order-modal";
import { appStore } from "@/lib/state/store";
import {
  calculateSubplateWeight,
  isHeightDisabled,
  getDimensionLabels,
  formatSubplateDimensions,
  SUPPORTED_UNITS,
  SUPPORTED_SHAPES,
  MATERIAL_DENSITIES,
} from "@/lib/weight-calculator";
import { useSmartPrefetch } from "@/lib/query/prefetch";
import { useLongPress } from "@/lib/hooks/use-long-press";
import { useQueryClient, useIsRestoring } from "@tanstack/react-query";
import { useSubplatesByProjectQuery, useUsersQuery } from "@/lib/query/hooks";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import { STAGE_DEFINITIONS, getAllowedStagesForUser, getSubplateProgressInfo } from "@/lib/subplate-stages";
import { AssignStaffModal } from "@/components/subplate/assign-staff-modal";

const REAL_MATERIALS = [
  "MS-Bright",
  "C45",
  "EN8",
  "D-2",
  "Aluminium",
  "Brass",
  "Copper",
  "SS",
  "SS-202",
  "SS-304",
  "MS-Black",
  "Acralic",
  "Gun Metal",
  "Derlin",
  "Nylon",
  "O-ring",
  "Rubber",
  "Silver Bar",
  "Spring",
  "U-seal",
  "Wood",
  "Wooden Box",
  "WPS",
];

const SHAPES = SUPPORTED_SHAPES;

function ProjectSubplatesRow({
  project,
  columnsCount,
  staff = [],
  onAddPlate,
  onOpenView,
  onEditPlate,
  onDeletePlate,
  onSubplateContextMenu,
}: {
  project: ScanProject;
  columnsCount: number;
  staff?: User[];
  onAddPlate: (p: ScanProject) => void;
  onOpenView: (p: ScanProject) => void;
  onEditPlate: (sp: Subplate, p: ScanProject) => void;
  onDeletePlate: (id: number, projectId?: number) => void;
  onSubplateContextMenu?: (e: React.MouseEvent, sp: Subplate, p: ScanProject) => void;
}) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();
  const canCreateSubplate = hasPermission("action_create_subplate");
  const canEditPlate = hasPermission("action_edit_subplate");
  const canDeletePlate = hasPermission("action_delete_subplate");

  // 1. Instant 0ms Resolution: check if project already has subplates in memory
  const preloadedPlates = useMemo(() => {
    return Array.isArray(project.subplates) && project.subplates.length > 0 ? project.subplates : null;
  }, [project.subplates]);

  // 2. On-Demand Single Lean Query: ONLY triggers if plates are not already preloaded
  const targetId = project.id || project.projectid || undefined;
  const platesQuery = useSubplatesByProjectQuery(targetId, {
    enabled: !preloadedPlates,
  });

  const plates = preloadedPlates || platesQuery.data || [];
  const isLoading = !preloadedPlates && platesQuery.isLoading;
  const isError = !preloadedPlates && platesQuery.isError;

  return (
    <tr className="bg-slate-50/70 border-y border-blue-100/80 animate-in fade-in duration-150">
      <td colSpan={columnsCount} className="p-0">
        <div className="p-4 sm:p-5 bg-gradient-to-b from-blue-50/40 via-slate-50/60 to-white space-y-3.5 border-l-4 border-blue-600">
          {/* Header inside detail workbench */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    Subplate Register: {project.projectid || `#${project.id}`}
                  </h4>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-700">
                    {plates.length} Plates Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {project.description} • {project.customername || project.cname || "Customer"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canCreateSubplate && (
                <button
                  type="button"
                  onClick={() => onAddPlate(project)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add Subplate</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenView(project)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>Full Studio Modal</span>
              </button>
            </div>
          </div>

          {/* Subplates Table / Grid */}
          {isLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading subplate specifications...</span>
            </div>
          ) : isError ? (
            <div className="py-6 px-4 text-center rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
              <p className="text-xs text-rose-600 font-medium">
                Failed to load subplates for this project.
              </p>
              <button
                type="button"
                onClick={() => {
                  platesQuery.refetch();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : plates.length === 0 ? (
            <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-300 bg-white/70 space-y-2">
              <p className="text-xs text-slate-500 font-medium">
                No subplates have been defined for this mould project yet.
              </p>
              {canCreateSubplate && (
                <button
                  type="button"
                  onClick={() => onAddPlate(project)}
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Subplate</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Plate Name</th>
                    <th className="py-2.5 px-3">Subproject ID</th>
                    <th className="py-2.5 px-3">Dimensions</th>
                    <th className="py-2.5 px-3">Material</th>
                    <th className="py-2.5 px-3 text-right">Calc Weight</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plates.map((sp) => {
                    const dim = formatSubplateDimensions({
                      shape: sp.shape || "Plate",
                      length: sp.length ?? undefined,
                      width: sp.width ?? undefined,
                      height: sp.height ?? undefined,
                      unit: sp.unit || "mm",
                    });
                    return (
                      <tr
                        key={sp.id}
                        onContextMenu={(e) => onSubplateContextMenu?.(e, sp, project)}
                        className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        title="Right-click for options (Assign to Me)..."
                      >
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {sp.platename}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-blue-700">
                          {sp.subprojectid || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {dim}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {sp.material || "MS-Bright"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {(() => {
                            if (sp.weight && Number(sp.weight) > 0) {
                              return `${Number(sp.weight).toFixed(3)} kg`;
                            }
                            const calc = calculateSubplateWeight({
                              shape: sp.shape || "Plate",
                              material: sp.material || "MS-Bright",
                              length: sp.length ?? undefined,
                              width: sp.width ?? undefined,
                              height: sp.height ?? undefined,
                              unit: sp.unit || "mm",
                              quantity: sp.sqty || 1,
                            });
                            return calc > 0 ? `${calc.toFixed(3)} kg` : "—";
                          })()}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                          {sp.sqty || 1}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const progress = getSubplateProgressInfo(sp, staff);
                            return (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] border font-bold ${progress.badgeStyle}`}
                                title={progress.subtext}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${progress.dotColor}`} />
                                <span>{progress.badgeLabel}</span>
                                {progress.assignee && (
                                  <span className="font-mono text-[9px] opacity-80 font-normal ml-0.5">
                                    ({progress.assignee})
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEditPlate && (
                              <button
                                type="button"
                                onClick={() => onEditPlate(sp, project)}
                                title="Edit Subplate"
                                className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDeletePlate && (
                              <button
                                type="button"
                                onClick={() => onDeletePlate(sp.id, project.id)}
                                title="Delete Subplate"
                                className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

interface MouldProjectsTableProps {
  initialData?: ScanProject[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onDeleteProject?: (id: number | string) => Promise<boolean>;
}

const columnHelper = createColumnHelper<ScanProject>();

export function MouldProjectsTable({
  initialData = [],
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onDeleteProject,
}: MouldProjectsTableProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isRestoring = useIsRestoring();
  const showSkeleton = !mounted || isLoading || isRestoring;
  const data = initialData;
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rdate", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("ALL");
  const [selectedWorktype, setSelectedWorktype] = useState<string>("ALL");
  const [rowSelection, setRowSelection] = useState({});

  // Custom Website Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "primary";
    isLoading?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    variant: "danger",
    isLoading: false,
    onConfirm: () => {},
  });

  // View Subplates Modal State
  const [viewProject, setViewProject] = useState<ScanProject | null>(null);
  const [viewSubplates, setViewSubplates] = useState<Subplate[]>([]);
  const [isLoadingSubplates, setIsLoadingSubplates] = useState(false);

  const queryClient = useQueryClient();

  // Inline Master-Detail Accordion State
  const [expandedRowId, setExpandedRowId] = useState<number | string | null>(null);

  const toggleRowExpand = (project: ScanProject) => {
    const targetId = project.id;
    setExpandedRowId((prev) => (prev !== null && String(prev) === String(targetId) ? null : targetId));
  };

  // Add / Edit Subplate Modal State
  const [addPlateProject, setAddPlateProject] = useState<ScanProject | null>(null);
  const [editingSubplate, setEditingSubplate] = useState<Subplate | null>(null);
  const [isSubmittingPlate, setIsSubmittingPlate] = useState(false);
  const [plateForm, setPlateForm] = useState({
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
  });

  // Create Purchase Order Modal State (Dashboard Inline)
  const [createPOProject, setCreatePOProject] = useState<ScanProject | null>(null);
  const [isCreatePOOpen, setIsCreatePOOpen] = useState(false);

  // Context Menu State for Right-Click
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();

  const canCreateProject = hasPermission("action_create_scanning_project");
  const canEditMould = hasPermission("action_edit_mould");
  const canDeleteMould = hasPermission("action_delete_mould");
  const canCreateSubplate = hasPermission("action_create_subplate");
  const canEditSubplate = hasPermission("action_edit_subplate");
  const canDeleteSubplate = hasPermission("action_delete_subplate");
  const canCreatePurchase = hasPermission("action_create_purchase");
  const canAssignStaff = hasPermission("action_assign_subplate_designer");

  // Real-time permission revocation guard: auto-close modal if admin revokes permission while open
  useEffect(() => {
    if (addPlateProject && !canCreateSubplate) {
      setAddPlateProject(null);
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to add subplates was revoked by administrator.",
        duration: 5000,
      });
    }
    if (editingSubplate && !canEditSubplate) {
      setEditingSubplate(null);
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to edit subplates was revoked by administrator.",
        duration: 5000,
      });
    }
    if (isCreatePOOpen && !canCreatePurchase) {
      setIsCreatePOOpen(false);
      setCreatePOProject(null);
      appStore.addToast({
        type: "error",
        message: "Access Denied: Permission to create purchase orders was revoked by administrator.",
        duration: 5000,
      });
    }
  }, [addPlateProject, editingSubplate, isCreatePOOpen, canCreateSubplate, canEditSubplate, canCreatePurchase]);

  const { data: usersData } = useUsersQuery();
  const users = usersData?.users || [];
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [users]);

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

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
    project: ScanProject | null;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    project: null,
  });

  const [subplateContextMenu, setSubplateContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
    subplate: Subplate | null;
    project?: ScanProject | null;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    subplate: null,
    project: null,
  });

  const handleSubplateContextMenu = (e: React.MouseEvent, sp: Subplate, project?: ScanProject | null) => {
    e.preventDefault();
    e.stopPropagation();
    setSubplateContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      subplate: sp,
      project,
    });
  };

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

  const handleRowContextMenu = (e: React.MouseEvent, project: ScanProject) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      project,
    });
  };

  const handleLongPress = React.useCallback((project: ScanProject, pos: { x: number; y: number }) => {
    setContextMenu({
      x: pos.x,
      y: pos.y,
      isOpen: true,
      project,
    });
  }, []);

  const longPress = useLongPress<ScanProject>(handleLongPress, {
    threshold: 500,
    vibrate: 50,
  });

  const handleToggleProjectStatus = async (project: ScanProject) => {
    const isCompleted = (project.status || "").toLowerCase() === "completed";
    const nextStatus: "completed" | "registered" = isCompleted ? "registered" : "completed";
    try {
      const res = await fetch("/api/scanning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: project.id, field: "status", value: nextStatus }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
        onRefresh?.();
        appStore.addToast({
          type: "success",
          message: `Project status updated to ${nextStatus}`,
        });
      } else {
        const err = await res.json().catch(() => ({}));
        appStore.addToast({
          type: "error",
          message: err.error || "Failed to update project status",
        });
      }
    } catch {
      appStore.addToast({
        type: "error",
        message: "Error updating project status",
      });
    }
  };

  const handleDeleteSingleProject = (project: ScanProject) => {
    const code = project.projectid || `#${project.id}`;
    setConfirmDialog({
      isOpen: true,
      title: "Delete Mould Project",
      description: (
        <div className="space-y-2 text-xs">
          <p className="text-slate-700">
            Are you sure you want to permanently delete mould project{" "}
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
              {code}
            </span>
            ?
          </p>
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
            <span className="font-semibold">⚠️ Cascade Deletion:</span> This will also permanently delete all linked child subplates and operator worklogs. This action cannot be undone.
          </div>
        </div>
      ),
      confirmLabel: "Delete Mould",
      cancelLabel: "Cancel",
      variant: "danger",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          if (onDeleteProject) {
            // Primary path: delegates to page.tsx which handles optimistic removal
            // from IndexedDB + React state BEFORE the API call (0ms UI lag)
            await onDeleteProject(project.id);
          } else {
            // Fallback path (table used standalone without onDeleteProject prop):
            // Optimistically remove from TanStack Query cache first so UI updates immediately
            queryClient.setQueriesData<any>({ queryKey: queryKeys.projects.all() }, (old: any) => {
              if (!old || !Array.isArray(old.scans)) return old;
              return {
                ...old,
                scans: old.scans.filter((s: any) => String(s.id) !== String(project.id) && Number(s.id) !== Number(project.id)),
                pagination: old.pagination
                  ? { ...old.pagination, total: Math.max(0, old.pagination.total - 1) }
                  : old.pagination,
              };
            });

            const res = await fetch(`/api/scanning?id=${project.id}`, { method: "DELETE" });
            if (res.ok) {
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
              queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
              queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
              queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
              broadcastQueryInvalidation(queryKeys.projects.all());
              broadcastQueryInvalidation(queryKeys.purchases.all());
              broadcastQueryInvalidation(queryKeys.subplates.all());
              broadcastQueryInvalidation(queryKeys.dashboard.counts());
              onRefresh?.();
            } else {
              // Rollback: restore the removed row immediately before invalidating
              queryClient.setQueriesData<any>({ queryKey: queryKeys.projects.all() }, (old: any) => {
                if (!old || !Array.isArray(old.scans)) return old;
                if (old.scans.some((s: any) => String(s.id) === String(project.id) || Number(s.id) === Number(project.id))) return old;
                return {
                  ...old,
                  scans: [project, ...old.scans],
                  pagination: old.pagination
                    ? { ...old.pagination, total: old.pagination.total + 1 }
                    : old.pagination,
                };
              });
              queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || "Failed to delete project");
            }
          }
          appStore.addToast({
            type: "success",
            message: `Mould project ${code} deleted successfully`,
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          appStore.addToast({
            type: "error",
            message: err.message || "Failed to delete project",
          });
        }
      },
    });
  };

  // Handlers for View & Add Plate Modals
  const fetchSubplatesForProject = async (project: ScanProject) => {
    // Instant 0ms: check if already in memory
    if (Array.isArray(project.subplates) && project.subplates.length > 0) {
      setViewSubplates(project.subplates);
      return;
    }

    setIsLoadingSubplates(true);
    try {
      const target = project.id || project.projectid;
      const res = await fetch(`/api/subplate?projectid=${encodeURIComponent(String(target))}`);
      const json = await res.json();
      setViewSubplates(json.subplates || []);
    } catch (err) {
      console.error("Failed to load subplates:", err);
      setViewSubplates([]);
    } finally {
      setIsLoadingSubplates(false);
    }
  };

  const handleOpenView = (project: ScanProject) => {
    setViewProject(project);
    fetchSubplatesForProject(project);
  };

  const handleOpenAddPlate = (project: ScanProject) => {
    setEditingSubplate(null);
    setAddPlateProject(project);
    const count = (project.total_plates || 0) + 1;
    setPlateForm({
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
    });
  };

  const handleCreatePO = (project: ScanProject) => {
    setCreatePOProject(project);
    setIsCreatePOOpen(true);
  };

  const handleOpenEditPlate = (subplate: Subplate, project?: ScanProject | null) => {
    const proj = project || data.find((d) => String(d.id) === String(subplate.projectid) || d.projectid === String(subplate.projectid)) || null;
    setEditingSubplate(subplate);
    setAddPlateProject(proj);
    setPlateForm({
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
    });
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
    if (!plateForm.platename?.trim()) return false;
    const q = parseInt(plateForm.sqty || "0", 10);
    if (isNaN(q) || q < 1) return false;
    if (plateForm.length && (isNaN(parseFloat(plateForm.length)) || parseFloat(plateForm.length) < 0)) return false;
    if (plateForm.width && (isNaN(parseFloat(plateForm.width)) || parseFloat(plateForm.width) < 0)) return false;
    if (!plateHeightDisabled && plateForm.height && (isNaN(parseFloat(plateForm.height)) || parseFloat(plateForm.height) < 0)) return false;
    return true;
  }, [plateForm.platename, plateForm.length, plateForm.width, plateForm.height, plateForm.sqty, plateHeightDisabled]);

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
      const payload = isEditing
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

  const handleDeleteSubplate = (subplateId: number, projectId?: number) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Subplate Component",
      description: (
        <div className="space-y-2 text-xs">
          <p className="text-slate-700">
            Are you sure you want to permanently delete this subplate from the database?
          </p>
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
            <span className="font-semibold">⚠️ Caution:</span> This component will be permanently removed and cannot be recovered.
          </div>
        </div>
      ),
      confirmLabel: "Delete Subplate",
      cancelLabel: "Cancel",
      variant: "danger",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          const res = await fetch(`/api/subplate?id=${subplateId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setViewSubplates((prev) => prev.filter((p) => p.id !== subplateId));
            queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
            broadcastQueryInvalidation(queryKeys.subplates.all());
            broadcastQueryInvalidation(queryKeys.projects.all());
            broadcastQueryInvalidation(queryKeys.purchases.all());
            broadcastQueryInvalidation(queryKeys.dashboard.counts());
            onRefresh?.();
            appStore.addToast({
              type: "success",
              message: "Subplate deleted successfully",
            });
            setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
          } else {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to delete subplate");
          }
        } catch (err: any) {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          appStore.addToast({
            type: "error",
            message: err.message || "Failed to delete subplate",
          });
        }
      },
    });
  };

  // Extract unique filters
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.cname) set.add(d.cname);
      else if (d.customername) set.add(d.customername);
    });
    return Array.from(set).sort();
  }, [data]);

  const dashboardCustomerOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Customers (${uniqueCustomers.length})` },
    ...uniqueCustomers.map((cust) => ({ value: cust, label: cust })),
  ], [uniqueCustomers]);



  const modalPlateShapeOptions: ERPSelectOption[] = SUPPORTED_SHAPES.map((s) => ({ value: s, label: s }));

  const modalPlateMaterialOptions: ERPSelectOption[] = Object.keys(MATERIAL_DENSITIES).map((m) => ({
    value: m,
    label: m,
    subtitle: `${MATERIAL_DENSITIES[m] || 7.81} g/cm³`,
  }));

  const modalPlateLocationOptions: ERPSelectOption[] = [
    { value: "SM", label: "SM — In-House Production" },
    { value: "Vendor", label: "Vendor — Outward Jobwork" },
  ];

  const modalPlateUnitOptions: ERPSelectOption[] = SUPPORTED_UNITS.map((u) => ({ value: u, label: u }));

  const uniqueWorktypes = useMemo(() => {
    const set = new Set<string>();
    data.forEach((d) => {
      if (d.worktype) set.add(d.worktype);
    });
    return Array.from(set).sort();
  }, [data]);

  const dashboardWorktypeOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Work Types (${uniqueWorktypes.length})` },
    ...uniqueWorktypes.map((wt) => ({ value: wt, label: wt })),
  ], [uniqueWorktypes]);



  // Filtered dataset
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (
        selectedCustomer !== "ALL" &&
        item.cname !== selectedCustomer &&
        item.customername !== selectedCustomer &&
        String(item.customer_id) !== selectedCustomer
      ) {
        return false;
      }
      if (selectedWorktype !== "ALL" && item.worktype !== selectedWorktype) {
        return false;
      }
      return true;
    });
  }, [data, selectedCustomer, selectedWorktype]);

  const columns = useMemo(
    () => [
      // Checkbox selection column for bulk actions
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              suppressHydrationWarning
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-blue-600 transition"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              suppressHydrationWarning
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-blue-600 transition"
            />
          </div>
        ),
      }),
      // Project Code / ID
      columnHelper.accessor("projectid", {
        header: "Project Code",
        cell: (info) => {
          const isExpanded = expandedRowId !== null && String(expandedRowId) === String(info.row.original.id);
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleRowExpand(info.row.original);
                }}
                className={`p-1 rounded-md transition cursor-pointer ${
                  isExpanded
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-slate-200/70 text-slate-400 hover:text-slate-700"
                }`}
                title={isExpanded ? "Collapse Subplates" : "Expand Subplates Inline"}
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isExpanded ? "rotate-180 text-blue-600" : "-rotate-90"
                  }`}
                />
              </button>
              <span className="font-mono font-bold text-blue-600 text-xs">
                {info.getValue() || `P-${info.row.original.id}`}
              </span>
            </div>
          );
        },
      }),
      // Received Date
      columnHelper.accessor("rdate", {
        header: "Received Dt",
        cell: (info) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatDate(info.getValue())}</span>
          </div>
        ),
      }),
      // Committed Date
      columnHelper.accessor("cdate", {
        header: "Committed Dt",
        cell: (info) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{formatDate(info.getValue())}</span>
          </div>
        ),
      }),
      // Customer Name
      columnHelper.accessor((row) => row.cname || row.customername, {
        id: "customer",
        header: "Customer",
        cell: (info) => (
          <div className="flex items-center gap-1.5 min-w-[140px] max-w-[200px]">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900 text-xs truncate" title={info.getValue()}>
              {info.getValue() || "Unknown"}
            </span>
          </div>
        ),
      }),
      // Work Type
      columnHelper.accessor("worktype", {
        header: "Work Type",
        cell: (info) => {
          const val = info.getValue() || "Standard";
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              {val}
            </span>
          );
        },
      }),
      // Description / Mould Name
      columnHelper.accessor("description", {
        header: "Mould / Part Name",
        cell: (info) => (
          <span className="font-medium text-slate-800 text-xs truncate max-w-[240px] block" title={info.getValue()}>
            {info.getValue() || "—"}
          </span>
        ),
      }),
      // Plates Progress / Subplate Counts
      columnHelper.display({
        id: "plates",
        header: "Plates Progress",
        cell: ({ row }) => {
          const completed = row.original.completed_plates || 0;
          const total = row.original.total_plates || 5;
          const percent = Math.min(100, Math.round((completed / (total || 1)) * 100));
          const isDone = percent === 100 && total > 0;

          return (
            <div className="flex items-center gap-2.5 min-w-[130px]">
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isDone ? "bg-emerald-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold font-mono text-slate-700 min-w-[34px]">
                {completed}/{total}
              </span>
            </div>
          );
        },
      }),
      // Row Actions
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleOpenView(row.original)}
              title="View Subplates & Stages"
              className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
            >
              <Eye className="h-4 w-4" />
            </button>
            {canCreateSubplate && (
              <button
                type="button"
                onClick={() => handleOpenAddPlate(row.original)}
                title="Add Subplate"
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {canCreatePurchase && (
              <button
                type="button"
                onClick={() => handleCreatePO(row.original)}
                title="Create Purchase Order"
                className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
              >
                <ShoppingCart className="h-4 w-4" />
              </button>
            )}
            {canDeleteMould && (
              <button
                type="button"
                onClick={() => handleDeleteSingleProject(row.original)}
                title="Delete Mould"
                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      }),
    ],
    [canCreateSubplate, canCreatePurchase, canDeleteMould]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 15,
      },
    },
  });

  const selectedCount = Object.keys(rowSelection).length;

  const handleBatchMarkDone = () => {
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
    if (selectedRows.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Mark ${selectedRows.length} Moulds as Completed`,
      description: (
        <p className="text-xs text-slate-700">
          Are you sure you want to mark{" "}
          <strong className="text-slate-900 font-semibold">{selectedRows.length}</strong> selected moulds as Completed?
        </p>
      ),
      confirmLabel: "Mark Completed",
      cancelLabel: "Cancel",
      variant: "primary",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await Promise.all(
            selectedRows.map((r) =>
              fetch("/api/scanning", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: r.id, field: "status", value: "completed" }),
              })
            )
          );
          queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
          onRefresh?.();
          setRowSelection({});
          appStore.addToast({
            type: "success",
            message: `${selectedRows.length} moulds marked as Completed`,
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          appStore.addToast({
            type: "error",
            message: err.message || "Failed to update status",
          });
        }
      },
    });
  };

  const handleBatchDelete = () => {
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
    if (selectedRows.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: `Delete ${selectedRows.length} Selected Moulds`,
      description: (
        <div className="space-y-2 text-xs">
          <p className="text-slate-700">
            Are you sure you want to permanently delete{" "}
            <strong className="text-slate-900 font-semibold">{selectedRows.length}</strong> selected mould projects?
          </p>
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] leading-relaxed">
            <span className="font-semibold">⚠️ Cascade Deletion:</span> All associated child subplates and worklogs will also be permanently deleted. This action cannot be undone.
          </div>
        </div>
      ),
      confirmLabel: `Delete ${selectedRows.length} Moulds`,
      cancelLabel: "Cancel",
      variant: "danger",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          for (const r of selectedRows) {
            if (onDeleteProject) {
              await onDeleteProject(r.id);
            } else {
              await fetch(`/api/scanning?id=${r.id}`, { method: "DELETE" });
            }
          }
          if (!onDeleteProject) {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
            broadcastQueryInvalidation(queryKeys.projects.all());
            broadcastQueryInvalidation(queryKeys.subplates.all());
            broadcastQueryInvalidation(queryKeys.purchases.all());
            broadcastQueryInvalidation(queryKeys.dashboard.counts());
            onRefresh?.();
          }
          setRowSelection({});
          appStore.addToast({
            type: "success",
            message: `${selectedRows.length} moulds deleted successfully`,
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (err: any) {
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          appStore.addToast({
            type: "error",
            message: err.message || "Failed to delete moulds",
          });
        }
      },
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Action & Filter Toolbar */}
      <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/60 space-y-2.5 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
        {/* Left: Search Input & Filter Dropdowns */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 sm:flex-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              suppressHydrationWarning
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search in table..."
              className="w-full pl-8 pr-8 py-2 sm:py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filters: 2-column on mobile, inline on desktop */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Customer Dropdown */}
            <div className="w-full sm:w-48 min-w-0">
              <ERPSelect
                value={selectedCustomer}
                onChange={(val) => setSelectedCustomer(String(val))}
                options={dashboardCustomerOptions}
                placeholder="All Customers"
                searchPlaceholder="Search customer..."
              />
            </div>

            {/* Work Type Dropdown */}
            <div className="w-full sm:w-40 min-w-0">
              <ERPSelect
                value={selectedWorktype}
                onChange={(val) => setSelectedWorktype(String(val))}
                options={dashboardWorktypeOptions}
                placeholder="All Work Types"
                showSearch={false}
              />
            </div>
          </div>
        </div>

        {/* Right: Bulk Actions & Export Buttons */}
        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1 sm:pt-0 border-t border-slate-200/60 sm:border-0">
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                <span>{selectedCount} sel</span>
                <button
                  onClick={handleBatchMarkDone}
                  className="hover:underline text-[11px] font-semibold text-blue-800 cursor-pointer"
                >
                  Done
                </button>
                {canDeleteMould && (
                  <>
                    <span>•</span>
                    <button
                      onClick={handleBatchDelete}
                      className="text-rose-600 hover:text-rose-700 text-[11px] cursor-pointer flex items-center gap-1"
                      title="Delete selected moulds"
                    >
                      <Trash2 className="h-3.5 w-3.5 inline" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const headers = [
                  "ID",
                  "Project ID",
                  "Customer",
                  "Description",
                  "Received Date",
                  "Committed Date",
                  "Plates",
                  "Amount",
                  "Payment",
                ];
                const rows = data.map((d) => [
                  d.id,
                  `"${d.projectid}"`,
                  `"${d.customername}"`,
                  `"${(d.description || "").replace(/"/g, '""')}"`,
                  d.rdate,
                  d.cdate,
                  d.total_plates || 0,
                  d.amount || 0,
                  d.payment === 1 ? "Paid" : "Unpaid",
                ]);
                const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", `Mould_Projects_${new Date().toISOString().split("T")[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Download Excel/CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => window.print()}
              className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="Print / Save PDF"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Grid (Desktop: hidden below md) */}
      <div className="hidden md:block overflow-x-auto w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-slate-50/90 border-b border-slate-200">
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const isSelect = header.id === "select";
                  const isActions = header.id === "actions";

                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`py-3.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap transition-colors ${
                        canSort ? "cursor-pointer select-none hover:bg-slate-100/90 hover:text-slate-900 group" : ""
                      } ${isSelect ? "w-10 text-center px-3" : ""} ${isActions ? "text-right pr-4" : ""}`}
                    >
                      <div className={`flex items-center gap-1.5 ${isActions ? "justify-end" : isSelect ? "justify-center" : ""}`}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="inline-flex items-center ml-1">
                            {isSorted === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                            ) : isSorted === "desc" ? (
                              <ArrowDown className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {showSkeleton ? (
              <TableSkeletonRows rows={8} columns={columns.length} />
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-400 text-xs"
                >
                  No moulds or projects match the selected filter.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const project = row.original;
                const isExpanded = expandedRowId !== null && String(expandedRowId) === String(project.id);

                return (
                  <React.Fragment key={row.id}>
                    <tr
                      onClick={() => toggleRowExpand(project)}
                      onContextMenu={(e) => handleRowContextMenu(e, project)}
                      {...longPress.getHandlers(project)}
                      className={`transition-colors hover:bg-blue-50/40 cursor-pointer select-none ${
                        row.getIsSelected() ? "bg-blue-50/50" : ""
                      } ${isExpanded ? "bg-blue-50/20 font-medium" : ""}`}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isInteractive = cell.column.id === "select" || cell.column.id === "actions";
                        return (
                          <td
                            key={cell.id}
                            onClick={isInteractive ? undefined : (e) => {
                              e.stopPropagation();
                              toggleRowExpand(project);
                            }}
                            className={`py-2.5 px-3 align-middle text-slate-700 text-xs ${isInteractive ? "" : "cursor-pointer"} ${
                              cell.column.id === "select" ? "text-center" : ""
                            } ${cell.column.id === "actions" ? "text-right pr-4" : ""}`}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Inline Master-Detail Workbench */}
                    {isExpanded && (
                      <ProjectSubplatesRow
                        project={project}
                        columnsCount={columns.length}
                        staff={activeStaff}
                        onAddPlate={handleOpenAddPlate}
                        onOpenView={handleOpenView}
                        onEditPlate={handleOpenEditPlate}
                        onDeletePlate={handleDeleteSubplate}
                        onSubplateContextMenu={handleSubplateContextMenu}
                      />
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card-List Fallback (block below md, hidden on md+) */}
      <div className="block md:hidden p-3 space-y-3">
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Hold card 0.5s for options</span>
          </span>
          <span className="text-slate-400 font-mono">
            {table.getRowModel().rows.length} moulds
          </span>
        </div>

        {showSkeleton ? (
          <div className="py-8 text-center text-slate-400 text-xs animate-pulse">Loading moulds...</div>
        ) : table.getRowModel().rows.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No moulds or projects match the selected filter.
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const m = row.original;
            return (
              <div
                key={row.id}
                {...longPress.getHandlers(m)}
                className="p-3.5 bg-white rounded-2xl border border-slate-200/90 space-y-2.5 text-xs shadow-xs select-none active:scale-[0.98] transition-all touch-manipulation hover:border-blue-300 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-600">
                    {m.projectid}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenView(m)}
                      title="View Subplates"
                      className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    {canCreateSubplate && (
                      <button
                        onClick={() => handleOpenAddPlate(m)}
                        title="Add Subplate"
                        className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                    {canCreatePurchase && (
                      <button
                        onClick={() => handleCreatePO(m)}
                        title="Create PO"
                        className="p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-amber-600 cursor-pointer"
                      >
                        <ShoppingCart className="h-3 w-3" />
                      </button>
                    )}
                    {canDeleteMould && (
                      <button
                        onClick={() => handleDeleteSingleProject(m)}
                        title="Delete Mould"
                        className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="font-medium text-slate-800 line-clamp-2">
                  {m.description || "No description"}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-400">Customer: </span>
                    <span className="font-medium text-slate-700 truncate block">
                      {m.customername || m.cname || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Worktype: </span>
                    <span className="font-medium text-slate-700 block">
                      {m.worktype || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">R-Date: </span>
                    <span className="font-medium text-slate-700 block">
                      {m.rdate ? formatDate(m.rdate) : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Plates: </span>
                    <span className="font-medium text-slate-700 block">
                      {m.total_plates ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 px-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
            suppressHydrationWarning
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="px-2 py-1 rounded bg-white border border-slate-300 text-xs font-medium focus:outline-none"
          >
            {[10, 15, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-slate-400 ml-2">
            Showing {table.getRowModel().rows.length} of {filteredData.length} records
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-slate-700 font-semibold">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* View Subplates Drawer (Linear-style slide-over) */}
      <Drawer
        isOpen={Boolean(viewProject)}
        onClose={() => setViewProject(null)}
        width="2xl"
        title={
          viewProject ? (
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-900">
                {viewProject.projectid || `Project #${viewProject.id}`}
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  viewProject.status === "completed"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {viewProject.status}
              </span>
            </div>
          ) : undefined
        }
        description={
          viewProject
            ? `${viewProject.customername || viewProject.cname || "Customer"} • ${
                viewProject.description || "No description"
              }`
            : undefined
        }
      >
        {viewProject && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500">
                {viewSubplates.length} Subplates Linked
              </span>
              {canCreateSubplate && (
                <MotionButton
                  variant="primary"
                  size="xs"
                  onClick={() => handleOpenAddPlate(viewProject)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Subplate</span>
                </MotionButton>
              )}
            </div>

            {isLoadingSubplates ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs">Loading subplates...</span>
              </div>
            ) : viewSubplates.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-medium text-slate-600">No subplates registered yet</p>
                <p className="text-slate-400 mt-1">
                  Click &quot;Add Subplate&quot; above to attach plates to this mould project.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {viewSubplates.map((sp) => (
                  <div
                    key={sp.id}
                    onContextMenu={(e) => handleSubplateContextMenu(e, sp, viewProject)}
                    className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer"
                    title="Right-click for options (Assign to Me)..."
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">
                          {sp.platename}
                        </span>
                        {sp.subprojectid && (
                          <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {sp.subprojectid}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {sp.material || "MS-Bright"}
                        </span>
                        <SubplateJobworkLocationBadge subplate={sp} size="sm" />
                      </div>
                      <div className="text-slate-500 flex flex-wrap items-center gap-3 font-mono text-[11px]">
                        <span>
                          {formatSubplateDimensions(sp)}
                        </span>
                        <span>•</span>
                        <span>Qty: {sp.sqty || 1}</span>
                        {sp.weight ? (
                          <>
                            <span>•</span>
                            <span>{sp.weight} kg</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <span
                          title="Design"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.design_by ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          DES
                        </span>
                        <span
                          title="Material Order"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.order_by ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          ORD
                        </span>
                        <span
                          title="Material Inward"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.received_workby ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          REC
                        </span>
                        <span
                          title="VMC Machining"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.vmc_workby ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          VMC
                        </span>
                        <span
                          title="Drill & Tap"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.drilltap_workby ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          D&T
                        </span>
                        <span
                          title="Final QC"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.final_qcby ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          FQC
                        </span>
                        <span
                          title="Packing"
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sp.packing_workby ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          PAK
                        </span>
                      </div>
                      {canEditSubplate && (
                        <button
                          onClick={() => handleOpenEditPlate(sp, viewProject)}
                          title="Edit Subplate"
                          className="btn-interactive p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteSubplate && (
                        <button
                          onClick={() => handleDeleteSubplate(sp.id, viewProject.id)}
                          title="Delete Subplate"
                          className="btn-interactive p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Add / Edit Subplate Modal */}
      <Modal
        isOpen={Boolean(addPlateProject || editingSubplate)}
        onClose={() => {
          setAddPlateProject(null);
          setEditingSubplate(null);
        }}
        maxWidth="xl"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
              {editingSubplate ? (
                <Pencil className="w-5 h-5 stroke-[2.2]" />
              ) : (
                <Layers className="w-5 h-5 stroke-[2.2]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug">
                {editingSubplate ? "Edit Subplate Workpiece" : "Add Subplate Workpiece"}
              </h3>
              <p className="text-xs text-slate-500">
                {editingSubplate
                  ? `Update specifications for "${editingSubplate.platename}"`
                  : addPlateProject
                  ? `Attach workpiece plate to Mould ${addPlateProject.projectid || `#${addPlateProject.id}`}`
                  : "Define workpiece dimensions, material and route to shopfloor"}
              </p>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmitPlate} className="space-y-4">
          {/* Group 1: Plate Identification & Auto Subproject Code */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-600" />
                <span>Plate Name</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Cavity Plate A"
                value={plateForm.platename}
                onChange={(e) =>
                  setPlateForm({ ...plateForm, platename: e.target.value })
                }
                className="w-full h-10 px-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Subproject / Mould Code</span>
              </label>
              <input
                type="text"
                readOnly
                tabIndex={-1}
                value={plateForm.subprojectid || (addPlateProject ? addPlateProject.projectid : "") || ""}
                className="w-full h-10 px-3.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 select-none cursor-not-allowed shadow-xs"
              />
            </div>
          </div>

          {/* Group 2: Material Grade & Geometry Specifications */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Shape (4 cols) */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Shape</span>
                </label>
                <ERPSelect
                  value={plateForm.shape}
                  onChange={(val) => handleDimensionChange("shape", String(val))}
                  options={modalPlateShapeOptions}
                  showSearch={false}
                  placeholder="Shape"
                />
              </div>

              {/* Material (5 cols) */}
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <span>Material</span>
                  </span>
                  <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200/60">
                    {MATERIAL_DENSITIES[plateForm.material] || 7.81} g/cm³
                  </span>
                </label>
                <ERPSelect
                  value={plateForm.material}
                  onChange={(val) => handleDimensionChange("material", String(val))}
                  options={modalPlateMaterialOptions}
                  searchPlaceholder="Search material..."
                  placeholder="Material"
                />
              </div>

              {/* Quantity with Aligned Stepper (3 cols) */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Quantity</span>
                </label>
                <div className="h-10 flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleStepPlateQty(-1)}
                    disabled={Number(plateForm.sqty || 1) <= 1}
                    className="h-full px-2.5 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
                    title="Decrease Quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="1"
                    value={plateForm.sqty}
                    onKeyDown={blockInvalidIntegerKeys}
                    onChange={handlePlateQtyChange}
                    className="h-full w-full text-center font-bold text-xs text-slate-900 focus:outline-none bg-transparent"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleStepPlateQty(1)}
                    className="h-full px-2.5 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                    title="Increase Quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Dimensions Sub-grid */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Dimensions & Unit
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {plateDimLabels.headerGuide}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {plateDimLabels.isRound ? (
                  <>
                    {/* 1. OD (Outer Diameter) */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.widthPlaceholder}
                          value={plateForm.width}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                          className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          OD
                        </span>
                      </div>
                    </div>
                    {/* 2. Length */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.length}
                          value={plateForm.length}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                          className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          L
                        </span>
                      </div>
                    </div>
                    {/* 3. Height (Disabled for Round) */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          placeholder={plateDimLabels.heightPlaceholder}
                          value=""
                          className="w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          —
                        </span>
                      </div>
                    </div>
                  </>
                ) : plateDimLabels.isPipe ? (
                  <>
                    {/* 1. OD (Outer Diameter) */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.widthPlaceholder}
                          value={plateForm.width}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                          className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          OD
                        </span>
                      </div>
                    </div>
                    {/* 2. Wall Thickness */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.heightPlaceholder}
                          value={plateForm.height}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("height", e.target.value)}
                          className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          T
                        </span>
                      </div>
                    </div>
                    {/* 3. Length */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.length}
                          value={plateForm.length}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                          className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          L
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 1. Length */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.length}
                          value={plateForm.length}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("length", e.target.value)}
                          className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          L
                        </span>
                      </div>
                    </div>
                    {/* 2. Width */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.widthPlaceholder}
                          value={plateForm.width}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("width", e.target.value)}
                          className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          W
                        </span>
                      </div>
                    </div>
                    {/* 3. Height / Thickness */}
                    <div>
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={plateDimLabels.heightPlaceholder}
                          value={plateForm.height}
                          disabled={plateHeightDisabled}
                          onKeyDown={blockInvalidNumberKeys}
                          onChange={(e) => handleNumericPlateDimension("height", e.target.value)}
                          className={"w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 " + (
                            plateHeightDisabled
                              ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                          )}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                          {plateHeightDisabled ? "—" : "H"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <ERPSelect
                    value={plateForm.unit || "mm"}
                    onChange={(val) => handleDimensionChange("unit", String(val))}
                    options={modalPlateUnitOptions}
                    showSearch={false}
                    placeholder="Unit"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Group 3: Weight Engineering Readout & Production Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-stretch">
            {/* Hero Calculated Weight Display (7 cols) */}
            <div className="sm:col-span-7 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3.5 text-white flex flex-col justify-between shadow-md relative overflow-hidden border border-slate-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between relative z-10 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-blue-400" />
                  <span>Theoretical Weight</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                  {Number(plateForm.sqty) > 1
                    ? ("Total (" + plateForm.sqty + " pcs)")
                    : "Auto"}
                </span>
              </div>

              <div className="flex items-baseline gap-2 relative z-10">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {plateForm.weight || "0.000"}
                </span>
                <span className="text-sm font-bold text-slate-400">kg</span>
                {Number(plateForm.sqty) > 1 && Boolean(plateForm.weight) && (
                  <span className="ml-auto text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                    {(Number(plateForm.weight) / Number(plateForm.sqty)).toFixed(3)} kg / pc
                  </span>
                )}
              </div>

              {Number(plateForm.sqty) > 1 && Boolean(plateForm.weight) ? (
                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 flex items-center justify-between relative z-10 font-mono">
                  <span>
                    {plateForm.sqty} pcs × {(Number(plateForm.weight) / Number(plateForm.sqty)).toFixed(3)} kg
                  </span>
                  <span className="text-slate-300 font-sans font-semibold">Total Batch Wt</span>
                </div>
              ) : (
                <div className="mt-1 text-[10px] text-slate-400 relative z-10">
                  Based on {plateForm.material} density @ {MATERIAL_DENSITIES[plateForm.material] || 7.81} g/cm³
                </div>
              )}
            </div>

            {/* Production Location Card (5 cols) */}
            <div className="sm:col-span-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col justify-between">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Production Routing</span>
                </label>
                <ERPSelect
                  value={plateForm.location}
                  onChange={(val) => setPlateForm({ ...plateForm, location: String(val) })}
                  options={modalPlateLocationOptions}
                  showSearch={false}
                  placeholder="Routing"
                />
              </div>
              <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
                <span
                  className={"w-2 h-2 rounded-full shrink-0 " + (
                    plateForm.location === "SM"
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                  )}
                />
                <span>
                  {plateForm.location === "SM"
                    ? "Routed to in-house VMC / Milling"
                    : "Requires outward delivery challan"}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions with Perfect Baseline Alignment */}
          <div className="pt-3 sm:pt-4 mt-1 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 min-w-0">
            <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Strict numeric validation & 9-stage tracking enabled</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto sm:ml-auto">
              <MotionButton
                type="button"
                variant="outline"
                onClick={() => {
                  setAddPlateProject(null);
                  setEditingSubplate(null);
                }}
                className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </MotionButton>
              <MotionButton
                type="submit"
                variant="primary"
                disabled={isSubmittingPlate || !isPlateFormValid}
                isLoading={isSubmittingPlate}
                loadingText={editingSubplate ? "Saving Changes..." : "Adding Plate..."}
                successText={editingSubplate ? "Saved!" : "Plate Added!"}
                className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
              >
                {editingSubplate ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingSubplate ? "Save Changes" : "Add Subplate"}</span>
              </MotionButton>
            </div>
          </div>
        </form>
      </Modal>

      {/* Right-Click Floating Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false, project: null }))}
        title={
          contextMenu.project
            ? `${contextMenu.project.projectid || `#${contextMenu.project.id}`} • ${
                contextMenu.project.customername || contextMenu.project.cname || "Mould"
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

      {/* Right-Click Floating Context Menu on Subplate */}
      {subplateContextMenu.subplate && (
        <ContextMenu
          x={subplateContextMenu.x}
          y={subplateContextMenu.y}
          isOpen={subplateContextMenu.isOpen}
          onClose={() =>
            setSubplateContextMenu((prev) => ({ ...prev, isOpen: false, subplate: null, project: null }))
          }
          title={`${subplateContextMenu.subplate.platename} #${subplateContextMenu.subplate.id} • ${
            subplateContextMenu.subplate.subprojectid ||
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

            if (isAdmin || canAssignStaff) {
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
                      onClick: () => {},
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
                  onClick: () => {},
                });
              } else if (allowedStages.length === 0) {
                items.push({
                  label: "No Assigned Department Stages",
                  subtext: "Your role has no stage assignment permissions",
                  icon: Lock,
                  disabled: true,
                  onClick: () => {},
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
                      onClick: () => {},
                    });
                  } else if (isOther) {
                    items.push({
                      label: `${st.label.replace(/^\d+\.\s*/, "")} (Assigned)`,
                      subtext: `Assigned to ${name} • Only Admin can reassign`,
                      icon: Lock,
                      disabled: true,
                      onClick: () => {},
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

      {/* Quick Staff Assignment Modal (Admin & Staff) */}
      <AssignStaffModal
        isOpen={assignStaffModal.isOpen}
        onClose={() =>
          setAssignStaffModal({
            isOpen: false,
            subplate: null,
            stage: null,
          })
        }
        subplate={assignStaffModal.subplate}
        stage={assignStaffModal.stage}
        staff={activeStaff}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onAssign={handleAssignSubplateToUser}
        onCreatePO={() => {
          if (subplateContextMenu?.project) {
            setCreatePOProject(subplateContextMenu.project);
            setIsCreatePOOpen(true);
          }
        }}
      />

      {/* Website Custom Delete & Action Confirmation Modal */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        cancelLabel={confirmDialog.cancelLabel}
        variant={confirmDialog.variant}
        isLoading={confirmDialog.isLoading}
      />

      {/* Create Raw Material Purchase Order Modal (Dashboard Inline) */}
      {isCreatePOOpen && (
        <CreatePurchaseOrderModal
          isOpen={isCreatePOOpen}
          onClose={() => {
            setIsCreatePOOpen(false);
            setCreatePOProject(null);
          }}
          initialProject={createPOProject}
        />
      )}
    </div>
  );
}

