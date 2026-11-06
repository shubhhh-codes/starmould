"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import type { Subplate, ScanProject } from "@/lib/supabase/types";
import { type ERPSelectOption } from "@/components/ui/erp-select";
import { appStore } from "@/lib/state/store";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import {
  getRecommendedCompanionPlates,
  learnSubplatePair,
  type CompanionRecommendation,
} from "@/lib/plate-recommender";
import {
  calculateSubplateWeight,
  isHeightDisabled,
  getDimensionLabels,
  formatSubplateDimensions,
  SUPPORTED_UNITS,
  SUPPORTED_SHAPES,
  MATERIAL_DENSITIES,
} from "@/lib/weight-calculator";
import { STAGE_DEFINITIONS, getAllowedStagesForUser } from "@/lib/subplate-stages";
import { useAuth } from "@/components/providers/auth-provider";
import { useSearchParams, useRouter } from "next/navigation";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useQueryClient, useIsRestoring } from "@tanstack/react-query";
import {
  useSubplatesQuery,
  useProjectsQuery,
  useCreateSubplateMutation,
  useUpdateSubplateMutation,
  useDeleteSubplateMutation,
} from "@/lib/query/hooks";

// The 23 authentic materials extracted from resources/views/scanning/index.blade.php
const REAL_MATERIALS = [
  "Acralic",
  "Aluminium",
  "Brass",
  "C45",
  "Copper",
  "D-2",
  "Derlin",
  "EN8",
  "Gun Metal",
  "MS-Black",
  "MS-Bright",
  "Nylon",
  "O-ring",
  "Rubber",
  "Silver Bar",
  "Spring",
  "SS",
  "SS-202",
  "SS-304",
  "U-seal",
  "Wood",
  "Wooden Box",
  "WPS",
];

const SHAPES = SUPPORTED_SHAPES;
export function useSubplatePageController() {

  const router = useRouter();
  const { currentUser } = useAuth();
  const { hasPermission } = useRolePermissions();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const allowedStages = useMemo(
    () => getAllowedStagesForUser(currentUser, isAdmin),
    [currentUser, isAdmin]
  );
  const canCreateSubplate = hasPermission("action_create_subplate");
  const canExportCSV = hasPermission("financial_export_csv");
  const canEditSubplate = hasPermission("action_edit_subplate");
  const canDeleteSubplate = hasPermission("action_delete_subplate");
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();
  const { data, isLoading: queryLoading, error: fetchQueryError, refetch: refetchSubplates, isFetching } = useSubplatesQuery();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  // Modal State for Add / Edit Subplate (declared early for on-demand query gating)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubplate, setEditingSubplate] = useState<Subplate | null>(null);

  // On-Demand Projects Query: Only fetched when opening Add/Edit modal, not on initial page load
  const projectsQuery = useProjectsQuery({ pageSize: 500, status: "pending", enabled: isModalOpen });
  const createSubplateMutation = useCreateSubplateMutation();
  const updateSubplateMutation = useUpdateSubplateMutation();
  const deleteSubplateMutation = useDeleteSubplateMutation();

  const scans = (data?.scans && data.scans.length > 0)
    ? data.scans
    : (projectsQuery.data?.scans || []);
  const rawSubplates = data?.subplates || [];
  const subplates = useMemo(() => {
    const completedSet = new Set<string>();
    (scans || []).forEach((s: any) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "completed" || st === "registered") {
        if (s.id) completedSet.add(String(s.id));
        if (s.projectid) {
          const pid = String(s.projectid).trim();
          completedSet.add(pid);
          completedSet.add(pid.toLowerCase());
        }
      }
    });
    return rawSubplates.filter((sp: any) => {
      if (sp.mold_id && completedSet.has(String(sp.mold_id))) return false;
      if (sp.projectid) {
        const pid = String(sp.projectid).trim();
        if (completedSet.has(pid) || completedSet.has(pid.toLowerCase())) return false;
      }
      return true;
    });
  }, [rawSubplates, scans]);
  const isProjectsLoading = isModalOpen && projectsQuery.isLoading && scans.length === 0;
  const users = data?.users || [];
  const kpis = data?.kpis || { totalCount: 0, inHouseCount: 0, vendorCount: 0 };
  const hasLoadedData = subplates.length > 0 || (!!data && !queryLoading);
  const isLoading = isRestoring || (!hasLoadedData && queryLoading);
  const fetchError = fetchQueryError ? (fetchQueryError as Error).message : null;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(urlSearch);

  // Sync URL search query
  useEffect(() => {
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  const [materialFilter, setMaterialFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Real-time permission revocation guard: auto-close modal if permission revoked
  useEffect(() => {
    if (isModalOpen) {
      if (editingSubplate && !canEditSubplate) {
        setIsModalOpen(false);
        setEditingSubplate(null);
        appStore.addToast({
          type: "error",
          message: "Access Denied: Permission to edit subplates was revoked by administrator.",
          duration: 5000,
        });
      } else if (!editingSubplate && !canCreateSubplate) {
        setIsModalOpen(false);
        appStore.addToast({
          type: "error",
          message: "Access Denied: Permission to add subplates was revoked by administrator.",
          duration: 5000,
        });
      }
    }
  }, [isModalOpen, editingSubplate, canCreateSubplate, canEditSubplate]);

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    isOpen: boolean;
    subplate: Subplate | null;
  }>({
    x: 0,
    y: 0,
    isOpen: false,
    subplate: null,
  });

  // Inline Create Purchase Order Modal state
  const [createPOModalOpen, setCreatePOModalOpen] = useState(false);
  const [poRequiredModal, setPoRequiredModal] = useState<Subplate | null>(null);
  const [targetPOProject, setTargetPOProject] = useState<ScanProject | null>(null);
  const [targetPOPlate, setTargetPOPlate] = useState<Subplate | null>(null);

  const handleOpenCreatePOForPlate = useCallback((plate: Subplate) => {
    const scan = scans.find(
      (s) =>
        String(s.id) === String(plate.projectid) ||
        (plate.mold_id && s.id === plate.mold_id) ||
        (s.projectid && s.projectid === plate.projectid)
    );
    const mouldPlates = subplates.filter((sp) =>
      (scan && (String(sp.projectid) === String(scan.id) || (sp.mold_id && sp.mold_id === scan.id) || (sp.mold_code && scan.projectid && sp.mold_code === scan.projectid))) ||
      (plate.mold_code && sp.mold_code === plate.mold_code) ||
      (String(sp.projectid) === String(plate.projectid))
    );
    if (scan) {
      setTargetPOProject({
        ...scan,
        subplates: mouldPlates.length > 0 ? mouldPlates : (scan as any).subplates,
      });
    } else {
      setTargetPOProject({
        id: Number(plate.projectid) || 0,
        projectid: plate.mold_code || plate.subprojectid?.split("_").slice(0, 3).join("_") || String(plate.projectid),
        description: (plate as any).mould_description || plate.platename,
        customer_id: (plate as any).customer_id || null,
        cname: (plate as any).cname || (plate as any).customername || "",
        subplates: mouldPlates.length > 0 ? mouldPlates : [plate],
      } as any);
    }
    setTargetPOPlate(plate);
    setCreatePOModalOpen(true);
  }, [scans, subplates]);

  // Quick Staff Assignment Modal (Admin only)
  // Studio View Mode and Stage Inspection Preview per subplate row

  const [assignStaffModal, setAssignStaffModal] = useState<{
    isOpen: boolean;
    subplate: Subplate | null;
    stage: (typeof STAGE_DEFINITIONS)[number] | null;
  }>({
    isOpen: false,
    subplate: null,
    stage: null,
  });

  const handleSubplateContextMenu = (e: React.MouseEvent, sp: Subplate) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      isOpen: true,
      subplate: sp,
    });
  };

  // Determine recommended stage for "Assign to me" based on logged-in user's role and subplate state
  const getTargetStageForUser = useCallback(
    (sp: Subplate) => {
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
    },
    [currentUser]
  );
  const materialFilterOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Materials (${REAL_MATERIALS.length})` },
    ...REAL_MATERIALS.map((m) => ({ value: m, label: m })),
  ], []);

  const categoryFilterOptions: ERPSelectOption[] = [
    { value: "ALL", label: "All Categories" },
    { value: "Core & Cavity Inserts", label: "Core & Cavity Inserts" },
    { value: "Base & Clamping Plates", label: "Base & Clamping Plates" },
    { value: "Ejection System", label: "Ejection System" },
    { value: "Slides & Lifters", label: "Slides & Lifters" },
    { value: "Guiding & Alignment", label: "Guiding & Alignment" },
    { value: "General Component", label: "General Component" },
  ];

  const locationFilterOptions: ERPSelectOption[] = [
    { value: "ALL", label: "All Locations" },
    { value: "SM", label: "In-House Only (SM)" },
    { value: "VENDOR", label: "At Vendor Only" },
  ];

  const projectFilterOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Projects (${scans.length})` },
    ...scans.map((s) => ({
      value: String(s.id),
      label: s.projectid ? `${s.projectid} - ${s.description || "Mould"}` : `Project #${s.id}`,
    })),
  ], [scans]);

  const stageFilterOptions: ERPSelectOption[] = [
    { value: "ALL", label: "All Stages (9/9 Pipeline)" },
    { value: "pending", label: "In-Progress (< 9 Stages Done)" },
    { value: "completed", label: "Completed (All 9 Stages Done)" },
    { value: "design_by", label: "1. Design Assigned" },
    { value: "order_by", label: "2. Purchase Assigned" },
    { value: "received_workby", label: "3. Mat. Inward Assigned" },
    { value: "received_qcby", label: "4. Programming Work Assigned" },
    { value: "vmc_workby", label: "5. VMC Machining Assigned" },
    { value: "vmc_qcby", label: "6. VMC QC Assigned" },
    { value: "drilltap_workby", label: "7. Drill & Tap Assigned" },
    { value: "final_qcby", label: "8. Final QC Assigned" },
    { value: "packing_workby", label: "9. Packing Assigned" },
  ];

  const modalShapeOptions: ERPSelectOption[] = SHAPES.map((s) => ({ value: s, label: s }));

  const modalMaterialOptions: ERPSelectOption[] = REAL_MATERIALS.map((m) => ({
    value: m,
    label: m,
    subtitle: `${MATERIAL_DENSITIES[m] || 7.81} g/cm³`,
  }));

  const modalUnitOptions: ERPSelectOption[] = SUPPORTED_UNITS.map((u) => ({ value: u, label: u }));

  const [modalForm, setModalForm] = useState({
    platename: "",
    projectid: "",
    subprojectid: "",
    shape: "Plate",
    width: "",
    height: "",
    length: "",
    weight: "",
    unit: "mm",
    material: "MS-Bright",
    sqty: "1",
    location: "SM",
    plate_category: "General Component",
  });

  const handleOpenAddModal = (defaultProjectId?: string | React.MouseEvent) => {
    setEditingSubplate(null);
    const targetProjectId = typeof defaultProjectId === "string" ? defaultProjectId : (projectFilter && projectFilter !== "ALL" ? projectFilter : "");
    setModalForm({
      platename: "",
      projectid: targetProjectId,
      subprojectid: "",
      shape: "Plate",
      width: "",
      height: "",
      length: "",
      weight: "",
      unit: "mm",
      material: "MS-Bright",
      sqty: "1",
      location: "SM",
      plate_category: "General Component",
    });
    setIsModalOpen(true);
    // Actively guarantee fresh project list when modal is invoked
    projectsQuery.refetch();
  };

  const handleOpenEditModal = (sp: Subplate) => {
    setEditingSubplate(sp);
    setModalForm({
      platename: sp.platename || "",
      projectid: sp.projectid ? String(sp.projectid) : "",
      subprojectid: sp.subprojectid || "",
      shape: sp.shape || "Plate",
      width: sp.width !== null && sp.width !== undefined ? String(sp.width) : "",
      height: sp.height !== null && sp.height !== undefined ? String(sp.height) : "",
      length: sp.length !== null && sp.length !== undefined ? String(sp.length) : "",
      weight: sp.weight !== null && sp.weight !== undefined ? String(sp.weight) : "",
      unit: sp.unit || "mm",
      material: sp.material || "MS-Bright",
      sqty: sp.sqty !== null && sp.sqty !== undefined ? String(sp.sqty) : "1",
      location: sp.location || "SM",
      plate_category: sp.plate_category || "General Component",
    });
    setIsModalOpen(true);
    // Actively guarantee fresh project list when modal is invoked
    projectsQuery.refetch();
  };

  // Toggle row expansion for detailed 9-stage stepper
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to count completed stages on a subplate
  const countCompletedStages = (sp: Subplate) => {
    let count = 0;
    if (sp.design_by) count++;
    const totalQty = Number(sp.sqty) || 1;
    const ordQty = Number(sp.ordered_qty ?? sp.jobwork_balance?.po_ordered_qty ?? (sp as any).po_ordered_qty ?? 0);
    const isPartialPO = sp.po_status === "PARTIAL" || (ordQty > 0 && ordQty < totalQty);
    if (sp.order_by && !isPartialPO) count++;
    if (sp.received_workby) count++;
    if (sp.received_qcby) count++;
    if (sp.vmc_workby) count++;
    if (sp.vmc_qcby) count++;
    if (sp.drilltap_workby) count++;
    if (sp.final_qcby) count++;
    if (sp.packing_workby || sp.location === "Customer" || sp.dispatch_status === "dispatched" || (sp as any).is_dispatched) count++;
    return count;
  };

  // Dynamic dimension labels and shape constraints
  const dimLabels = useMemo(
    () => getDimensionLabels(modalForm.shape, modalForm.unit),
    [modalForm.shape, modalForm.unit]
  );
  const heightDisabled = useMemo(
    () => isHeightDisabled(modalForm.shape),
    [modalForm.shape]
  );

  const isModalFormValid = useMemo(() => {
    if (!modalForm.platename?.trim() || !modalForm.projectid || isNaN(Number(modalForm.projectid)) || Number(modalForm.projectid) <= 0) return false;
    const q = parseInt(modalForm.sqty || "0", 10);
    if (isNaN(q) || q < 1) return false;
    if (modalForm.length && (isNaN(parseFloat(modalForm.length)) || parseFloat(modalForm.length) < 0)) return false;
    if (modalForm.width && (isNaN(parseFloat(modalForm.width)) || parseFloat(modalForm.width) < 0)) return false;
    if (!heightDisabled && modalForm.height && (isNaN(parseFloat(modalForm.height)) || parseFloat(modalForm.height) < 0)) return false;
    return true;
  }, [modalForm.platename, modalForm.projectid, modalForm.length, modalForm.width, modalForm.height, modalForm.sqty, heightDisabled]);

  // Dynamic auto-calculation of subplate weight based on geometry, density, unit, and quantity
  const recalculateWeight = (form: typeof modalForm) => {
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

  // Sibling plates for the target mould (used for contextual autocomplete and companion recommendations)
  const modalTargetMouldPlates = useMemo(() => {
    if (!modalForm.projectid) return [];
    const targetId = String(modalForm.projectid);
    return subplates.filter(
      (sp) => String(sp.projectid) === targetId || (sp.mold_id && String(sp.mold_id) === targetId)
    );
  }, [subplates, modalForm.projectid]);

  // Plate names in target mould for ghost autocomplete boost
  const modalTargetPlateNames = useMemo(() => {
    return modalTargetMouldPlates
      .map((sp) => sp.platename?.trim())
      .filter((name): name is string => Boolean(name));
  }, [modalTargetMouldPlates]);

  // 1-Click companion recommendations for current mould workpiece set
  const companionRecommendations = useMemo(() => {
    if (!modalTargetMouldPlates.length) return [];
    return getRecommendedCompanionPlates(modalTargetMouldPlates, 4);
  }, [modalTargetMouldPlates]);

  // Handler to apply recommended companion plate and mirror specs
  const handleApplyCompanion = (rec: CompanionRecommendation) => {
    const updated = {
      ...modalForm,
      platename: rec.name,
      plate_category: rec.category || modalForm.plate_category,
    };

    if (rec.mirroredSpecs) {
      if (rec.mirroredSpecs.length !== undefined && rec.mirroredSpecs.length !== null) {
        updated.length = String(rec.mirroredSpecs.length);
      }
      if (rec.mirroredSpecs.width !== undefined && rec.mirroredSpecs.width !== null) {
        updated.width = String(rec.mirroredSpecs.width);
      }
      if (rec.mirroredSpecs.material) {
        updated.material = String(rec.mirroredSpecs.material);
      }
      if (rec.mirroredSpecs.shape) {
        updated.shape = String(rec.mirroredSpecs.shape);
      }
    }

    updated.weight = recalculateWeight(updated);
    setModalForm(updated);
  };

  // Strict numeric validation and keyboard filters
  const handleStepQty = (delta: number) => {
    const current = parseInt(modalForm.sqty || '1', 10) || 1;
    const next = Math.max(1, current + delta);
    const updated = { ...modalForm, sqty: String(next) };
    updated.weight = recalculateWeight(updated);
    setModalForm(updated);
  };

  const handleQtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9]/g, '');
    const updated = { ...modalForm, sqty: clean };
    updated.weight = recalculateWeight(updated);
    setModalForm(updated);
  };

  const handleNumericDimension = (field: 'length' | 'width' | 'height', rawVal: string) => {
    let clean = rawVal.replace(/[^0-9.]/g, '');
    const parts = clean.split('.');
    if (parts.length > 2) {
      clean = parts[0] + '.' + parts.slice(1).join('');
    }
    handleDimensionChange(field, clean);
  };

  const blockInvalidNumberKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const blockInvalidIntegerKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-', '.'].includes(e.key)) {
      e.preventDefault();
    }
  };

  // Dynamic auto-calculation of subplate weight based on geometry, density and unit
  const handleDimensionChange = (field: string, value: string) => {
    const updated = { ...modalForm, [field]: value };
    if (field === "shape" && isHeightDisabled(value)) {
      updated.height = "";
    }
    updated.weight = recalculateWeight(updated);
    setModalForm(updated);
  };

  // Active staff
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1" || u.status === 1);
  }, [users]);

  // Handle stage staff assignment change (Live API PATCH)
  const handleStageStaffChange = async (
    subplateId: number,
    field: string,
    userId: number
  ) => {
    // Non-admin users cannot unassign once assigned
    if (!isAdmin && userId === 0) {
      appStore.addToast({
        type: "error",
        message: "Permission Notice: Once assigned, only Administrators can unassign or reassign a production stage.",
      });
      return;
    }

    // Non-admin users can only assign to themselves
    if (!isAdmin && userId !== 0 && currentUser?.id && Number(userId) !== Number(currentUser.id)) {
      appStore.addToast({
        type: "error",
        message: "Permission Notice: Non-admin users can only assign production tasks to themselves.",
      });
      return;
    }

    if (field === "order_by") {
      const targetSp = subplates.find((s) => Number(s.id) === Number(subplateId));
      if (targetSp && !targetSp.has_active_po && (!targetSp.order_by || targetSp.order_by === 0)) {
        setPoRequiredModal(targetSp);
        return;
      }
      if (targetSp && (targetSp.has_active_po || (targetSp.order_by && targetSp.order_by > 0))) {
        const poText = targetSp.linked_pos && targetSp.linked_pos.length > 1
          ? ` (${targetSp.linked_pos.map((p) => `#${p.po_srno}`).join(", ")})`
          : targetSp.po_srno ? ` (#${targetSp.po_srno})` : "";
        appStore.addToast({
          type: "warning",
          message: `Stage 2 (Purchase) is locked by Purchase Order${poText}. It cannot be changed or unassigned manually.`,
        });
        return;
      }
    }

    if (field === "received_workby" && userId !== 0) {
      const targetSp = subplates.find((s) => Number(s.id) === Number(subplateId));
      const inwardQty = Number((targetSp as any)?.po_inward_qty) || 0;
      if (inwardQty <= 0) {
        appStore.addToast({
          type: "error",
          message: "Stage 3 (Material Inward) cannot be assigned manually. Steel has not been received at factory gate. Record receipt in Purchase Inward first.",
        });
        const mouldCode = targetSp?.subprojectid || (targetSp as any)?.mould_project_code || "";
        if (mouldCode) {
          router.push(`/purchase-inward?mould=${encodeURIComponent(mouldCode)}`);
        }
        return;
      }
    }

    const newUserId = userId === 0 ? null : userId;
    const stageDef = STAGE_DEFINITIONS.find((s) => s.key === field);
    const staffMember = activeStaff.find((u) => u.id === userId);
    const staffName = newUserId ? staffMember?.name || staffMember?.initials || `Staff #${userId}` : null;
    const nowIso = newUserId ? new Date().toISOString() : null;

    try {
      await updateSubplateMutation.mutateAsync({
        id: subplateId,
        updates: {
          [field]: newUserId,
          ...(stageDef ? { [stageDef.nameKey]: staffName, [stageDef.atKey]: nowIso } : {}),
        },
      });
    } catch (err: any) {
      alert("Stage Update Error: " + err.message);
    }
  };

  // Interface for Subplates grouped by Mould Project
  interface MouldGroup {
    id: string;
    project?: ScanProject | null;
    mouldCode: string;
    mouldName: string;
    customerName: string;
    worktype: string;
    status: string;
    plates: Subplate[];
    totalPlates: number;
    completedPlates: number;
    totalWeight: number;
  }

  // State for expanded Mould project groups
  const [expandedMoulds, setExpandedMoulds] = useState<Record<string, boolean>>({});

  // Filter subplates with deep universal search matching
  const filteredSubplates = useMemo(() => {
    const scanMap = new Map<string, ScanProject>();
    scans.forEach((s) => {
      scanMap.set(String(s.id), s);
      if (s.projectid) {
        scanMap.set(s.projectid.toLowerCase(), s);
      }
    });

    const q = searchQuery.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return subplates.filter((sp) => {
      const project =
        (sp.projectid ? scanMap.get(String(sp.projectid)) : null) ||
        (sp.mold_id ? scanMap.get(String(sp.mold_id)) : null) ||
        (sp.subprojectid ? scanMap.get(sp.subprojectid.toLowerCase().split("_").slice(0, 3).join("_")) : null);

      // 1. Universal Search (Matches plate name, subproject id, material, dimensions, shape, location, category, mould code, mould name, customer, and staff)
      if (tokens.length > 0) {
        const matchesAllTokens = tokens.every((token) => {
          // Subplate direct properties
          if (sp.platename && sp.platename.toLowerCase().includes(token)) return true;
          if (sp.subprojectid && sp.subprojectid.toLowerCase().includes(token)) return true;
          if (String(sp.id).includes(token)) return true;
          if (sp.material && sp.material.toLowerCase().includes(token)) return true;
          if (sp.shape && sp.shape.toLowerCase().includes(token)) return true;
          if (sp.location && sp.location.toLowerCase().includes(token)) return true;
          if (sp.plate_category && sp.plate_category.toLowerCase().includes(token)) return true;
          if (sp.unit && sp.unit.toLowerCase().includes(token)) return true;

          // Dimensions (length, width, height, thickness, formatted text)
          if (String(sp.length ?? "").includes(token)) return true;
          if (String(sp.width ?? "").includes(token)) return true;
          if (String(sp.height ?? "").includes(token)) return true;
          if (formatSubplateDimensions(sp).toLowerCase().includes(token)) return true;

          // Parent Mould properties
          if (project) {
            if (project.projectid && project.projectid.toLowerCase().includes(token)) return true;
            if (project.description && project.description.toLowerCase().includes(token)) return true;
            if ((project.cname || project.customername) && (project.cname || project.customername)?.toLowerCase().includes(token)) return true;
            if (project.worktype && project.worktype.toLowerCase().includes(token)) return true;
            if (String(project.id).includes(token)) return true;
          }
          if ((sp as any).mould_project_code && (sp as any).mould_project_code.toLowerCase().includes(token)) return true;
          if ((sp as any).mould_description && (sp as any).mould_description.toLowerCase().includes(token)) return true;
          if ((sp as any).mould_customer_name && (sp as any).mould_customer_name.toLowerCase().includes(token)) return true;

          // 9-Stage Assigned Staff (Names or Initials)
          for (const st of STAGE_DEFINITIONS) {
            const staffName = (sp as any)[st.nameKey];
            if (staffName && typeof staffName === "string" && staffName.toLowerCase().includes(token)) return true;
            const staffId = (sp as any)[st.key];
            if (staffId) {
              const u = activeStaff.find((usr) => usr.id === Number(staffId));
              if (u && (u.name?.toLowerCase().includes(token) || u.initials?.toLowerCase().includes(token))) return true;
            }
          }

          return false;
        });

        if (!matchesAllTokens) return false;
      }

      // 2. Material Filter
      const matchMaterial = materialFilter === "ALL" || sp.material === materialFilter;
      if (!matchMaterial) return false;

      // 3. Location Filter
      const isSM = sp.location === "SM" || !sp.location;
      const matchLocation =
        locationFilter === "ALL" ||
        (locationFilter === "SM" ? isSM : !isSM);
      if (!matchLocation) return false;

      // 4. Project Filter
      const matchProject =
        projectFilter === "ALL" ||
        String(sp.projectid) === projectFilter ||
        String(sp.mold_id) === projectFilter ||
        (project && String(project.id) === projectFilter);
      if (!matchProject) return false;

      // 5. Stage Filter
      let matchStage = true;
      const completedCount = countCompletedStages(sp);
      if (stageFilter === "completed") {
        matchStage = completedCount === 9;
      } else if (stageFilter === "pending") {
        matchStage = completedCount < 9;
      } else if (stageFilter !== "ALL") {
        matchStage = Boolean((sp as any)[stageFilter]);
      }
      if (!matchStage) return false;

      // 6. Category Filter
      const matchCategory = categoryFilter === "ALL" || sp.plate_category === categoryFilter;
      if (!matchCategory) return false;

      return true;
    });
  }, [subplates, scans, searchQuery, materialFilter, locationFilter, projectFilter, stageFilter, categoryFilter, activeStaff]);

  // Group filtered subplates by their parent Mould Project
  const mouldGroups = useMemo<MouldGroup[]>(() => {
    const scanMap = new Map<string, ScanProject>();
    scans.forEach((s) => {
      scanMap.set(String(s.id), s);
      if (s.projectid) {
        scanMap.set(s.projectid.toLowerCase(), s);
      }
    });

    const groupMap = new Map<string, MouldGroup>();

    filteredSubplates.forEach((sp) => {
      const project =
        (sp.projectid ? scanMap.get(String(sp.projectid)) : null) ||
        (sp.mold_id ? scanMap.get(String(sp.mold_id)) : null) ||
        (sp.subprojectid ? scanMap.get(sp.subprojectid.toLowerCase().split("_").slice(0, 3).join("_")) : null);

      const mouldId = project
        ? String(project.id)
        : sp.projectid
          ? `proj_${sp.projectid}`
          : "unassigned";

      if (!groupMap.has(mouldId)) {
        groupMap.set(mouldId, {
          id: mouldId,
          project,
          mouldCode:
            project?.projectid ||
            sp.mold_code ||
            (sp.subprojectid ? sp.subprojectid.split("_").slice(0, 3).join("_") : "") ||
            (sp as any).mould_project_code ||
            (sp.projectid ? `Project #${sp.projectid}` : "Unassigned Mould"),
          mouldName:
            project?.description ||
            (sp as any).mould_description ||
            "General Subplates",
          customerName:
            project?.cname ||
            project?.customername ||
            (sp as any).mould_customer_name ||
            "",
          worktype: project?.worktype || (sp as any).mould_worktype || "",
          status: project?.status || (sp as any).mould_status || "",
          plates: [],
          totalPlates: 0,
          completedPlates: 0,
          totalWeight: 0,
        });
      }

      const grp = groupMap.get(mouldId)!;
      grp.plates.push(sp);
      grp.totalPlates++;
      if (countCompletedStages(sp) === 9) {
        grp.completedPlates++;
      }
      const wt = parseFloat(String(sp.weight || 0));
      if (!isNaN(wt) && wt > 0) {
        grp.totalWeight += wt;
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => {
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      return a.mouldCode.localeCompare(b.mouldCode);
    });
  }, [filteredSubplates, scans]);

  // Auto-expand on active search, default expand all mould groups
  const isMouldExpanded = useCallback(
    (mouldId: string) => {
      if (searchQuery.trim().length > 0) return true;
      return expandedMoulds[mouldId] ?? true;
    },
    [searchQuery, expandedMoulds]
  );

  const toggleMould = useCallback(
    (mouldId: string) => {
      setExpandedMoulds((prev) => ({
        ...prev,
        [mouldId]: !isMouldExpanded(mouldId),
      }));
    },
    [isMouldExpanded]
  );

  const handleToggleAllMoulds = useCallback(
    (expand: boolean) => {
      const next: Record<string, boolean> = {};
      mouldGroups.forEach((g) => {
        next[g.id] = expand;
      });
      setExpandedMoulds(next);
    },
    [mouldGroups]
  );

  const totalPages = Math.ceil(mouldGroups.length / pageSize) || 1;
  const paginatedMouldGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return mouldGroups.slice(start, start + pageSize);
  }, [mouldGroups, currentPage, pageSize]);

  // Auto-scroll and highlight matching search row
  const { getRowHighlightClass } = useTableHighlight(filteredSubplates, pageSize, setCurrentPage);

  // Handle Delete Subplate (Permanent DB Deletion)
  const handleDeleteSubplate = async (id: number, platename: string) => {
    if (!confirm(`Are you sure you want to permanently delete subplate "${platename || `#${id}`}" from the database? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteSubplateMutation.mutateAsync(id);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to save subplate";
      if (errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("access denied")) {
        setIsModalOpen(false);
        setEditingSubplate(null);
        appStore.addToast({
          type: "error",
          message: "Access Denied: Your permission was revoked by administrator.",
          duration: 5000,
        });
      } else {
        appStore.addToast({
          type: "error",
          message: errMsg,
        });
      }
    }
  };

  // KPI Calculations
  const totalCount = kpis.totalCount || subplates.length;
  const inHouseCount = kpis.inHouseCount || subplates.filter(
    (sp) => sp.location === "SM" || !sp.location
  ).length;
  const vendorCount = kpis.vendorCount || subplates.filter(
    (sp) => sp.location && sp.location !== "SM"
  ).length;
  const uniqueProjects = new Set(subplates.map((sp) => sp.projectid)).size;

  // Handle Create / Update Subplate
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.platename?.trim() || !modalForm.projectid || isNaN(Number(modalForm.projectid)) || Number(modalForm.projectid) <= 0) {
      alert("Please enter a plate name and select a valid target mould project.");
      return;
    }

    if (!isModalFormValid) {
      alert("Please enter valid, positive dimensions.");
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingSubplate) {
        await updateSubplateMutation.mutateAsync({
          id: editingSubplate.id,
          updates: {
            platename: modalForm.platename.trim(),
            projectid: Number(modalForm.projectid),
            subprojectid: modalForm.subprojectid?.trim() || undefined,
            shape: modalForm.shape,
            material: modalForm.material,
            length: Number(modalForm.length),
            width: Number(modalForm.width),
            height: heightDisabled ? null : Number(modalForm.height),
            weight: Number(modalForm.weight || "0") || null,
            unit: modalForm.unit || "mm",
            sqty: Number(modalForm.sqty || "1"),
            location: modalForm.location || "SM",
          },
        });
      } else {
        await createSubplateMutation.mutateAsync({
          ...modalForm,
          platename: modalForm.platename.trim(),
          projectid: Number(modalForm.projectid),
          length: Number(modalForm.length),
          width: Number(modalForm.width),
          height: heightDisabled ? null : Number(modalForm.height),
          weight: Number(modalForm.weight || "0") || null,
          sqty: Number(modalForm.sqty || "1"),
        });
      }

      // Continuous online self-learning: learn co-occurrence pairs for this mould workpiece basket
      if (modalForm.projectid && modalForm.platename?.trim()) {
        const newName = modalForm.platename.trim();
        const targetId = String(modalForm.projectid);
        for (const sib of subplates) {
          if (
            (String(sib.projectid) === targetId || (sib.mold_id && String(sib.mold_id) === targetId)) &&
            sib.platename &&
            sib.platename.trim().toLowerCase() !== newName.toLowerCase()
          ) {
            learnSubplatePair(sib.platename, newName);
          }
        }
      }

      setIsModalOpen(false);
      setEditingSubplate(null);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to save subplate";
      if (errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("access denied")) {
        setIsModalOpen(false);
        setEditingSubplate(null);
        appStore.addToast({
          type: "error",
          message: "Access Denied: Your permission was revoked by administrator.",
          duration: 5000,
        });
      } else {
        appStore.addToast({
          type: "error",
          message: errMsg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Plate Name",
      "Mould Project Code",
      "Customer",
      "Subproject ID",
      "Shape",
      "Dimensions (LxWxH)",
      "Material",
      "Weight (kg)",
      "Qty",
      "Location",
      "Completed Stages (out of 9)",
    ];
    const rows = filteredSubplates.map((sp) => [
      sp.id,
      `"${sp.platename}"`,
      `"${(sp as any).mould_project_code || sp.projectid || ""}"`,
      `"${(sp as any).mould_customer_name || ""}"`,
      sp.subprojectid || "",
      sp.shape || "Plate",
      `"${sp.length}x${sp.width}x${sp.height} ${sp.unit || "mm"}"`,
      sp.material || "",
      sp.weight || "",
      sp.sqty || 1,
      sp.location || "SM",
      countCompletedStages(sp),
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Subplates_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return {
    refetchSubplates,
    isMounted,
    isFetching,
    canExportCSV,
    handleExportCSV,
    canCreateSubplate,
    handleOpenAddModal,
    isLoading,
    totalCount,
    inHouseCount,
    vendorCount,
    uniqueProjects,
    searchQuery,
    setSearchQuery,
    setCurrentPage,
    materialFilter,
    setMaterialFilter,
    materialFilterOptions,
    categoryFilter,
    setCategoryFilter,
    categoryFilterOptions,
    locationFilter,
    setLocationFilter,
    locationFilterOptions,
    projectFilter,
    setProjectFilter,
    projectFilterOptions,
    stageFilter,
    setStageFilter,
    stageFilterOptions,
    mouldGroups,
    filteredSubplates,
    handleToggleAllMoulds,
    paginatedMouldGroups,
    isMouldExpanded,
    toggleMould,
    expandedRows,
    countCompletedStages,
    toggleRow,
    handleSubplateContextMenu,
    getRowHighlightClass,
    activeStaff,
    canEditSubplate,
    handleOpenEditModal,
    canDeleteSubplate,
    handleDeleteSubplate,
    allowedStages,
    isAdmin,
    currentUser,
    handleOpenCreatePOForPlate,
    router,
    handleStageStaffChange,
    scans,
    setPageSize,
    pageSize,
    currentPage,
    totalPages,
    isModalOpen,
    setIsModalOpen,
    setEditingSubplate,
    editingSubplate,
    handleSubmitModal,
    companionRecommendations,
    handleApplyCompanion,
    modalForm,
    modalTargetPlateNames,
    setModalForm,
    isProjectsLoading,
    projectsQuery,
    handleDimensionChange,
    modalShapeOptions,
    modalMaterialOptions,
    recalculateWeight,
    dimLabels,
    blockInvalidNumberKeys,
    handleNumericDimension,
    heightDisabled,
    modalUnitOptions,
    isSubmitting,
    isModalFormValid,
    contextMenu,
    setContextMenu,
    getTargetStageForUser,
    setAssignStaffModal,
    assignStaffModal,
    createPOModalOpen,
    setCreatePOModalOpen,
    setTargetPOProject,
    setTargetPOPlate,
    targetPOProject,
    targetPOPlate,
    queryClient,
    poRequiredModal,
    setPoRequiredModal,
  };
}

export type SubplatePageContext = ReturnType<typeof useSubplatePageController>;
