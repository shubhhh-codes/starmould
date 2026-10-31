"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback, Suspense } from "react";
import { SubplateJobworkLocationBadge } from "@/components/subplate/subplate-jobwork-location-badge";
import { createPortal } from "react-dom";
import { AppLayout } from "@/components/layout/app-layout";
import {
	Layers,
	Search,
	Plus,
	Building2,
	MapPin,
	CheckCircle2,
	Clock,
	Compass,
	FileSpreadsheet,
	X,
	Filter,
	Package,
	Wrench,
	ShieldCheck,
	Tag,
	Trash2,
	Loader2,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	UserCheck,
	UserX,
	CheckCheck,
	Calculator,
	Scale,
	Sparkles,
	Lock,
	Minus,
	Check,
	Pencil,
	AlertCircle,
	ShoppingCart,
} from "lucide-react";
import type { Subplate, ScanProject, User } from "@/lib/supabase/types";
import { KpiCardSkeleton, TableSkeletonRows } from "@/components/ui/skeleton";
import { ERPSelect, type ERPSelectOption } from "@/components/ui/erp-select";
import { StaffSelect } from "@/components/ui/staff-select";
import { Modal, Drawer } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { ProjectSelect } from "@/components/ui/project-select";
import { appStore } from "@/lib/state/store";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/context-menu";
import { AssignStaffModal } from "@/components/subplate/assign-staff-modal";
import { CreatePurchaseOrderModal } from "@/components/purchase/create-purchase-order-modal";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import {
	getRecommendedCompanionPlates,
	learnSubplatePair,
	type CompanionRecommendation,
} from "@/lib/plate-recommender";
import { GhostPlateInput } from "@/components/subplate/ghost-plate-input";
import {
	calculateSubplateWeight,
	isHeightDisabled,
	getDimensionLabels,
	formatSubplateDimensions,
	SUPPORTED_UNITS,
	SUPPORTED_SHAPES,
	MATERIAL_DENSITIES,
} from "@/lib/weight-calculator";

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

// 9 Production Stages configuration & helpers re-exported from shared library
import {
	STAGE_DEFINITIONS,
	getAllowedStagesForUser,
	getSubplateProgressInfo,
	type StageDefinition,
} from "@/lib/subplate-stages";

export {
	STAGE_DEFINITIONS,
	getAllowedStagesForUser,
	getSubplateProgressInfo,
	type StageDefinition,
};

// Helper to format ISO timestamp to human-readable date/time in IST
const formatTimestamp = (ts: string | null | undefined): string => {
	if (!ts) return "";
	try {
		const d = new Date(ts);
		return d.toLocaleString("en-IN", {
			timeZone: "Asia/Kolkata",
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	} catch {
		return String(ts);
	}
};

import { useAuth, UserSession } from "@/components/providers/auth-provider";

// Compact Interactive Stage Chip with Direct Quick-Assign Popover
const StageChipPicker = React.memo(
function StageChipPicker({
	subplateId,
	stage,
	userId,
	userName,
	timestamp,
	staff,
	currentUser,
	isAdmin,
	onAssign,
}: {
	subplateId: number;
	stage: (typeof STAGE_DEFINITIONS)[number];
	userId: number | null | undefined;
	userName?: string | null;
	timestamp?: string | null;
	staff: User[];
	currentUser: UserSession | null;
	isAdmin: boolean;
	onAssign: (subplateId: number, field: string, userId: number) => Promise<void>;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [popoverCoords, setPopoverCoords] = useState<{
		top: number;
		left: number;
		placeAbove: boolean;
	} | null>(null);

	const triggerRef = useRef<HTMLDivElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const isAssigned = Boolean(userId && userId !== 0);
	const assignedUser = staff.find((u) => u.id === Number(userId));
	const isAssignedToMe = Boolean(currentUser?.id && Number(userId) === Number(currentUser.id));
	const isAssignedToOther = isAssigned && !isAssignedToMe;

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (
				triggerRef.current &&
				!triggerRef.current.contains(target) &&
				popoverRef.current &&
				!popoverRef.current.contains(target)
			) {
				setIsOpen(false);
			}
		}
		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen || !triggerRef.current) return;

		const updatePosition = () => {
			if (!triggerRef.current) return;
			const rect = triggerRef.current.getBoundingClientRect();
			const popoverHeight = 260;
			const spaceBelow = window.innerHeight - rect.bottom;
			const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

			const top = placeAbove ? rect.top - 4 : rect.bottom + 4;
			const popoverWidth = 240;
			let left = rect.left;
			if (stage.step >= 7) {
				left = rect.right - popoverWidth;
			} else if (stage.step >= 4) {
				left = rect.left + rect.width / 2 - popoverWidth / 2;
			}
			left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 12));

			setPopoverCoords({ top, left, placeAbove });
		};

		updatePosition();
		window.addEventListener("scroll", updatePosition, true);
		window.addEventListener("resize", updatePosition);

		return () => {
			window.removeEventListener("scroll", updatePosition, true);
			window.removeEventListener("resize", updatePosition);
		};
	}, [isOpen, stage.step]);

	const colorClasses: Record<string, { assigned: string; activeBadge: string }> = {
		blue: {
			assigned: "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
			activeBadge: "bg-blue-100 text-blue-800",
		},
		amber: {
			assigned: "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100",
			activeBadge: "bg-amber-100 text-amber-800",
		},
		emerald: {
			assigned: "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100",
			activeBadge: "bg-emerald-100 text-emerald-800",
		},
		teal: {
			assigned: "bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100",
			activeBadge: "bg-teal-100 text-teal-800",
		},
		indigo: {
			assigned: "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100",
			activeBadge: "bg-indigo-100 text-indigo-800",
		},
		purple: {
			assigned: "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100",
			activeBadge: "bg-purple-100 text-purple-800",
		},
		violet: {
			assigned: "bg-violet-50 text-violet-700 border-violet-300 hover:bg-violet-100",
			activeBadge: "bg-violet-100 text-violet-800",
		},
		cyan: {
			assigned: "bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100",
			activeBadge: "bg-cyan-100 text-cyan-800",
		},
		rose: {
			assigned: "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100",
			activeBadge: "bg-rose-100 text-rose-800",
		},
	};

	const style = colorClasses[stage.color] || colorClasses.blue;

	const handleSelect = async (newUserId: number) => {
		try {
			setIsUpdating(true);
			await onAssign(subplateId, stage.key, newUserId);
			setIsOpen(false);
		} finally {
			setIsUpdating(false);
		}
	};

	const initials = assignedUser?.initials || (userName ? userName.slice(0, 2).toUpperCase() : null);

	const popoverAlign =
		stage.step <= 2
			? "left-0"
			: stage.step >= 7
			? "right-0"
			: "left-1/2 -translate-x-1/2";

	const tooltipTitle =
		isAssignedToOther && !isAdmin
			? `${stage.label}: Assigned to ${assignedUser?.name || userName || "Staff"} (${formatTimestamp(timestamp)}) — Only Admin can reassign`
			: isAssignedToMe
			? `${stage.label}: Assigned to You (${formatTimestamp(timestamp)}) — Click to manage`
			: isAssigned
			? `${stage.label}: Assigned to ${assignedUser?.name || userName || "Staff"} (${formatTimestamp(timestamp)})`
			: !isAdmin
			? `${stage.label}: Unassigned — Click to assign to yourself`
			: `${stage.label}: Unassigned — Click to assign`;

	return (
		<div ref={triggerRef} className="relative w-full min-w-0">
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				title={tooltipTitle}
				className={`h-7 sm:h-7.5 w-full px-1 text-[10px] sm:text-[11px] font-mono font-bold rounded-lg border flex items-center justify-center gap-0.5 transition-all cursor-pointer select-none shadow-2xs ${
					isAssigned
						? `${style.assigned} shadow-xs font-semibold`
						: "bg-slate-50/90 border-slate-200/90 text-slate-400 hover:text-slate-700 hover:bg-white hover:border-slate-300"
				}`}
			>
				{isUpdating ? (
					<Loader2 className="w-3 h-3 animate-spin text-slate-400" />
				) : isAssigned ? (
					<span className="truncate px-0.5">{initials || "✓"}</span>
				) : (
					<span>{stage.short}</span>
				)}
			</button>

			{/* Floating Quick Assignment Popover rendered via Portal */}
			{isOpen && isMounted && popoverCoords && typeof document !== "undefined" && createPortal(
				<div
					ref={popoverRef}
					style={{
						position: "fixed",
						top: popoverCoords.placeAbove ? "auto" : `${popoverCoords.top}px`,
						bottom: popoverCoords.placeAbove ? `${Math.max(8, window.innerHeight - popoverCoords.top)}px` : "auto",
						left: `${popoverCoords.left}px`,
						width: "15rem",
						zIndex: 99999,
					}}
					className="bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 whitespace-normal select-none"
				>
					{/* Header */}
					<div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
						<div className="min-w-0 pr-1">
							<div className="font-bold text-slate-900 text-[11px] truncate">
								{stage.label}
							</div>
							<div className="text-[9px] text-slate-400 truncate">
								{isAssigned && timestamp ? formatTimestamp(timestamp) : !isAdmin ? "Self-Assignment" : "Select staff to assign"}
							</div>
						</div>
						{isAdmin && isAssigned ? (
							<button
								type="button"
								onClick={() => handleSelect(0)}
								className="text-[10px] text-rose-500 hover:text-rose-700 font-medium flex items-center gap-0.5 shrink-0 cursor-pointer"
								title="Unassign"
							>
								<X className="w-2.5 h-2.5" /> Clear
							</button>
						) : (
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
							>
								<X className="w-3 h-3" />
							</button>
						)}
					</div>

					{/* Case 1: Non-Admin, Assigned to Someone Else -> Read Only Lock Info */}
					{!isAdmin && isAssignedToOther ? (
						<div className="p-2.5 space-y-2">
							<div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
								<span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-slate-700 font-bold border border-slate-200 shadow-2xs shrink-0">
									{assignedUser?.initials || userName?.slice(0, 2).toUpperCase() || "ST"}
								</span>
								<div className="min-w-0 flex-1">
									<div className="font-semibold text-slate-800 text-xs truncate">{assignedUser?.name || userName || "Assigned Staff"}</div>
									{timestamp && <div className="text-[10px] text-slate-400 font-mono">{formatTimestamp(timestamp)}</div>}
								</div>
							</div>
							<div className="flex items-start gap-2 text-[11px] leading-snug text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 whitespace-normal">
								<Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
								<span className="break-words leading-relaxed">Assigned to another team member. Only Admins can reassign this stage.</span>
							</div>
						</div>
					) : !isAdmin ? (
						/* Case 2: Non-Admin, Unassigned or Assigned to Themselves */
						<div className="p-1.5 space-y-1">
							{currentUser && (
								<button
									type="button"
									onClick={() => handleSelect(Number(currentUser.id))}
									className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer ${
										isAssignedToMe
											? `${style.activeBadge} font-bold`
											: "bg-cyan-50/70 hover:bg-cyan-100/70 text-cyan-900 border border-cyan-200"
									}`}
								>
									<div className="flex items-center gap-2 min-w-0">
										<span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white text-cyan-800 font-bold border border-cyan-200 shrink-0">
											{currentUser.initials || currentUser.name?.slice(0, 2).toUpperCase()}
										</span>
										<div className="min-w-0">
											<div className="font-semibold text-xs truncate">{currentUser.name}</div>
											<div className="text-[10px] text-slate-500">
												{isAssignedToMe ? "Assigned to You" : "Click to assign to yourself"}
											</div>
										</div>
									</div>
									{isAssignedToMe ? (
										<Check className="w-4 h-4 text-cyan-700 shrink-0" />
									) : (
										<Plus className="w-4 h-4 text-cyan-600 shrink-0" />
									)}
								</button>
							)}

							{isAssignedToMe && (
								<div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-slate-500 bg-slate-50 rounded-lg border border-slate-200/80">
									<Lock className="w-3 h-3 text-slate-400 shrink-0" />
									<span>Assigned to you • Only Admin can unassign</span>
								</div>
							)}
						</div>
					) : (
						/* Case 3: Admin -> Full Staff Selection List */
						<div className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
							<button
								type="button"
								onClick={() => handleSelect(0)}
								className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition cursor-pointer ${
									!isAssigned ? "bg-slate-100 text-slate-900 font-semibold" : "text-slate-500 hover:bg-slate-50"
								}`}
							>
								<span className="italic text-slate-400">Unassigned</span>
								{!isAssigned && <Check className="w-3.5 h-3.5 text-slate-600" />}
							</button>

							{staff.map((u) => {
								const isSelected = Number(userId) === u.id;
								return (
									<button
										key={u.id}
										type="button"
										onClick={() => handleSelect(u.id)}
										className={`w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg text-left text-xs transition group cursor-pointer ${
											isSelected ? `${style.activeBadge} font-bold` : "text-slate-700 hover:bg-slate-50"
										}`}
									>
										<div className="flex items-center gap-1.5 min-w-0">
											<span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 font-bold border border-slate-200 shrink-0">
												{u.initials || u.name.slice(0, 2).toUpperCase()}
											</span>
											<span className="truncate font-medium text-slate-800 text-xs">
												{u.name}
											</span>
										</div>
										{isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
									</button>
								);
							})}
						</div>
					)}
				</div>,
				document.body
			)}
		</div>
	);
},
(prev, next) => {
	return (
		prev.subplateId === next.subplateId &&
		prev.userId === next.userId &&
		prev.userName === next.userName &&
		prev.timestamp === next.timestamp &&
		prev.isAdmin === next.isAdmin &&
		prev.currentUser?.id === next.currentUser?.id &&
		prev.stage.key === next.stage.key &&
		prev.staff === next.staff &&
		prev.onAssign === next.onAssign
	);
});

import { useSearchParams } from "next/navigation";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useQueryClient, useIsRestoring } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { broadcastQueryInvalidation } from "@/lib/query/realtime";
import { useSubplatesQuery, useProjectsQuery, useCreateSubplateMutation, useUpdateSubplateMutation, useDeleteSubplateMutation } from "@/lib/query/hooks";

function SubplatePageContent() {
	const { currentUser } = useAuth();
	const { hasPermission } = useRolePermissions();
	const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
	const canCreateSubplate = hasPermission("action_create_subplate");
	const canExportCSV = hasPermission("financial_export_csv");
	const canEditSubplate = hasPermission("action_edit_subplate");
	const canDeleteSubplate = hasPermission("action_delete_subplate");
	const searchParams = useSearchParams();
	const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

	const isRestoring = useIsRestoring();
	const queryClient = useQueryClient();
	const { data, isLoading: queryLoading, error: fetchQueryError } = useSubplatesQuery();
	// Modal State for Add / Edit Subplate (declared early for on-demand query gating)
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingSubplate, setEditingSubplate] = useState<Subplate | null>(null);

	// On-Demand Projects Query: Only fetched when opening Add/Edit modal, not on initial page load
	const projectsQuery = useProjectsQuery({ pageSize: 500, enabled: isModalOpen });
	const createSubplateMutation = useCreateSubplateMutation();
	const updateSubplateMutation = useUpdateSubplateMutation();
	const deleteSubplateMutation = useDeleteSubplateMutation();

	const subplates = data?.subplates || [];
	const scans = (data?.scans && data.scans.length > 0)
		? data.scans
		: (projectsQuery.data?.scans || []);
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
		const isPartialPO = sp.po_status === "PARTIAL" || ((sp.ordered_qty ?? 0) > 0 && (sp.remaining_qty ?? 0) > 0);
		if (sp.order_by && !isPartialPO) count++;
		if (sp.received_workby) count++;
		if (sp.received_qcby) count++;
		if (sp.vmc_workby) count++;
		if (sp.vmc_qcby) count++;
		if (sp.drilltap_workby) count++;
		if (sp.final_qcby) count++;
		if (sp.packing_workby) count++;
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
				appStore.addToast({
					type: "warning",
					message: `Stage 2 (Purchase) is locked by Purchase Order${targetSp.po_srno ? ` (#${targetSp.po_srno})` : ""}. It cannot be changed or unassigned manually.`,
				});
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

 return (
 <AppLayout>
 <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0">
 {/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm min-w-0">
					<div className="flex items-center gap-3 sm:gap-4 min-w-0">
						<div className="p-2.5 sm:p-3 bg-cyan-50 text-cyan-600 rounded-xl shrink-0">
							<Layers className="w-6 h-6 sm:w-7 sm:h-7" />
						</div>
						<div className="min-w-0">
							<h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
								Subplate Master & Progression
							</h1>
							<p className="text-xs sm:text-sm text-slate-500 line-clamp-1 sm:line-clamp-none">
								Track workpiece dimensions, raw materials, location stages, and machining milestones
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
						{canExportCSV && (
							<button
								onClick={handleExportCSV}
								className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-xs text-xs sm:text-sm cursor-pointer"
							>
								<FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
								<span>Export CSV</span>
							</button>
						)}
						{canCreateSubplate && (
							<button
								onClick={handleOpenAddModal}
								className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-xs shadow-blue-500/20 text-xs sm:text-sm cursor-pointer"
							>
								<Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
								<span>Add Subplate</span>
							</button>
						)}
					</div>
				</div>

				{/* KPI Cards */}
 {isLoading ? (
 <KpiCardSkeleton count={4} />
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
 <Package className="w-6 h-6" />
 </div>
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
 Total Subplates
 </p>
 <p className="text-2xl font-black text-slate-900">
 {totalCount.toLocaleString()}
 </p>
 </div>
 </div>

 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
 <Building2 className="w-6 h-6" />
 </div>
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
 In-House (At Workshop &apos;SM&apos;)
 </p>
 <p className="text-2xl font-black text-emerald-600">
 {inHouseCount.toLocaleString()}
 </p>
 </div>
 </div>

 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
 <MapPin className="w-6 h-6" />
 </div>
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
 On Job Work (Vendor)
 </p>
 <p className="text-2xl font-black text-amber-600">
 {vendorCount.toLocaleString()}
 </p>
 </div>
 </div>

 <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
 <Compass className="w-6 h-6" />
 </div>
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
 Active Projects Linked
 </p>
 <p className="text-2xl font-black text-indigo-600">
 {uniqueProjects}
 </p>
 </div>
 </div>
 </div>
 )}

 {/* Filter Controls & Universal Search */}
				<div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 w-full max-w-full min-w-0">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 w-full min-w-0">
						{/* Universal Search Input */}
						<div className="relative w-full sm:col-span-2 lg:col-span-1 lg:w-auto lg:min-w-[320px] min-w-0">
							<Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
							<input
								type="text"
								placeholder="Universal Search (mould, plate, customer, specs, staff)..."
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setCurrentPage(1);
								}}
								className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
							/>
							{searchQuery && (
								<button
									type="button"
									onClick={() => {
										setSearchQuery("");
										setCurrentPage(1);
									}}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
									title="Clear search"
								>
									<X className="w-3.5 h-3.5" />
								</button>
							)}
						</div>

						{/* Material Selector */}
						<div className="w-full lg:w-44 min-w-0">
							<ERPSelect
								value={materialFilter}
								onChange={(val) => {
									setMaterialFilter(String(val));
									setCurrentPage(1);
								}}
								options={materialFilterOptions}
								placeholder="All Materials"
								searchPlaceholder="Search materials..."
							/>
						</div>

						{/* Category Selector */}
						<div className="w-full lg:w-48 min-w-0">
							<ERPSelect
								value={categoryFilter}
								onChange={(val) => {
									setCategoryFilter(String(val));
									setCurrentPage(1);
								}}
								options={categoryFilterOptions}
								placeholder="All Categories"
								showSearch={false}
							/>
						</div>

						{/* Location Selector */}
						<div className="w-full lg:w-40 min-w-0">
							<ERPSelect
								value={locationFilter}
								onChange={(val) => {
									setLocationFilter(String(val));
									setCurrentPage(1);
								}}
								options={locationFilterOptions}
								placeholder="All Locations"
								showSearch={false}
							/>
						</div>

						{/* Project Selector */}
						<div className="w-full lg:w-56 min-w-0">
							<ERPSelect
								value={projectFilter}
								onChange={(val) => {
									setProjectFilter(String(val));
									setCurrentPage(1);
								}}
								options={projectFilterOptions}
								placeholder="All Projects"
								searchPlaceholder="Search projects..."
							/>
						</div>

						{/* 9-Stage Production Filter */}
						<div className="w-full lg:w-52 min-w-0">
							<ERPSelect
								value={stageFilter}
								onChange={(val) => {
									setStageFilter(String(val));
									setCurrentPage(1);
								}}
								options={stageFilterOptions}
								placeholder="All Stages"
								showSearch={false}
							/>
						</div>
					</div>

					{/* Toolbar Sub-Bar: Counts and Expand/Collapse Controls */}
					<div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 flex-wrap text-xs">
						<div className="flex items-center gap-2 text-slate-500">
							<span className="font-bold text-slate-800">
								{mouldGroups.length} {mouldGroups.length === 1 ? "Mould Project" : "Mould Projects"}
							</span>
							<span className="text-slate-300">•</span>
							<span className="font-medium text-slate-600">
								{filteredSubplates.length} {filteredSubplates.length === 1 ? "Subplate" : "Subplates"} Total
							</span>
							{searchQuery && (
								<span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200">
									Search: &quot;{searchQuery}&quot;
								</span>
							)}
							{(materialFilter !== "ALL" || locationFilter !== "ALL" || projectFilter !== "ALL" || stageFilter !== "ALL" || categoryFilter !== "ALL") && (
								<button
									type="button"
									onClick={() => {
										setSearchQuery("");
										setMaterialFilter("ALL");
										setLocationFilter("ALL");
										setProjectFilter("ALL");
										setStageFilter("ALL");
										setCategoryFilter("ALL");
										setCurrentPage(1);
									}}
									className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer ml-1"
								>
									Clear all filters
								</button>
							)}
						</div>

						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => handleToggleAllMoulds(true)}
								className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg transition border border-slate-200 cursor-pointer"
								title="Expand all mould cards"
							>
								Expand All
							</button>
							<button
								type="button"
								onClick={() => handleToggleAllMoulds(false)}
								className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-200 cursor-pointer"
								title="Collapse all mould cards"
							>
								Collapse All
							</button>
						</div>
					</div>
				</div>

				{/* Mould Groups Container */}
				{isLoading ? (
					<div className="space-y-4">
						{[1, 2].map((idx) => (
							<div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3.5 animate-pulse">
								<div className="flex items-center justify-between pb-3 border-b border-slate-100">
									<div className="flex items-center gap-3">
										<div className="w-9 h-9 rounded-xl bg-slate-200" />
										<div className="space-y-2">
											<div className="h-4 w-40 bg-slate-200 rounded" />
											<div className="h-3 w-56 bg-slate-100 rounded" />
										</div>
									</div>
									<div className="h-7 w-24 bg-slate-200 rounded-lg" />
								</div>
								<div className="overflow-x-auto rounded-xl border border-slate-100">
									<table className="w-full text-left border-collapse">
										<tbody className="divide-y divide-slate-100">
											<TableSkeletonRows rows={3} columns={6} />
										</tbody>
									</table>
								</div>
							</div>
						))}
					</div>
				) : mouldGroups.length === 0 ? (
					/* Empty State */
					<div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
						<div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
							<Search className="w-6 h-6" />
						</div>
						<div className="space-y-1">
							<h3 className="font-bold text-slate-900 text-sm">No Moulds or Subplates Found</h3>
							<p className="text-xs text-slate-500 max-w-md mx-auto">
								{searchQuery
									? `No subplates or mould projects matched "${searchQuery}". Try a different search term or reset your filters.`
									: "No subplates found matching your selected filters."}
							</p>
						</div>
						{(searchQuery || materialFilter !== "ALL" || locationFilter !== "ALL" || projectFilter !== "ALL" || stageFilter !== "ALL" || categoryFilter !== "ALL") && (
							<button
								type="button"
								onClick={() => {
									setSearchQuery("");
									setMaterialFilter("ALL");
									setLocationFilter("ALL");
									setProjectFilter("ALL");
									setStageFilter("ALL");
									setCategoryFilter("ALL");
									setCurrentPage(1);
								}}
								className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold border border-blue-200 transition cursor-pointer"
							>
								<X className="w-3.5 h-3.5" />
								<span>Reset All Filters</span>
							</button>
						)}
					</div>
				) : (
					/* Grouped Mould Projects List */
					<div className="space-y-4">
						{paginatedMouldGroups.map((group) => {
							const isExpanded = isMouldExpanded(group.id);
							const percent = Math.round((group.completedPlates / Math.max(1, group.totalPlates)) * 100);

							return (
								<div
									key={group.id}
									className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-150"
								>
									{/* Mould Header Bar */}
									<div
										onClick={() => toggleMould(group.id)}
										className="bg-gradient-to-r from-slate-50/90 via-slate-50/70 to-white hover:bg-slate-100/70 border-b border-slate-200 cursor-pointer select-none transition-colors"
									>
										{/* Mobile Mould Header (< sm): Left-aligned, NO text cropping, fully structured */}
										<div className="block sm:hidden p-3.5 space-y-2.5">
											{/* Top Row: Chevron + Code + Worktype on Left, Status Pill on Right */}
											<div className="flex items-center justify-between gap-2">
												<div className="flex items-center gap-1.5 min-w-0">
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															toggleMould(group.id);
														}}
														className="p-1 -ml-1 text-slate-400 hover:text-blue-600 transition cursor-pointer shrink-0"
														title={isExpanded ? "Collapse mould group" : "Expand mould group"}
													>
														<ChevronDown
															className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${
																isExpanded ? "rotate-0 text-blue-600" : "-rotate-90"
															}`}
														/>
													</button>
													<span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
														{group.mouldCode}
													</span>
													{group.worktype && (
														<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
															{group.worktype}
														</span>
													)}
												</div>

												<span
													className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 whitespace-nowrap ${
														group.completedPlates === group.totalPlates && group.totalPlates > 0
															? "bg-emerald-50 text-emerald-700 border-emerald-200"
															: group.completedPlates > 0
															? "bg-blue-50 text-blue-700 border-blue-200"
															: "bg-slate-100 text-slate-600 border-slate-200"
													}`}
												>
													{group.completedPlates === group.totalPlates && group.totalPlates > 0
														? "All Ready ✓"
														: `${group.completedPlates}/${group.totalPlates} Ready`}
												</span>
											</div>

											{/* Main Title & Customer: Full-width, NO crop, bold, properly left-aligned */}
											<div className="space-y-1">
												<h3 className="font-bold text-slate-900 text-sm leading-snug break-words">
													{group.mouldName || "Mould Project"}
												</h3>
												{group.customerName && (
													<div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
														<Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
														<span className="break-words leading-tight">{group.customerName}</span>
													</div>
												)}
											</div>

											{/* Bottom Row: Subplates Count + Total Weight on Left, Add Plate Button on Right */}
											<div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
												<div className="text-slate-500 font-mono text-[11px] flex items-center gap-1.5 flex-wrap">
													<span className="font-semibold text-slate-700">
														{group.plates.length} {group.plates.length === 1 ? "Subplate" : "Subplates"}
													</span>
													{group.totalWeight > 0 && (
														<>
															<span className="text-slate-300">•</span>
															<span>Total Wt: {group.totalWeight.toFixed(2)} kg</span>
														</>
													)}
												</div>

												{canCreateSubplate && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															const targetId = group.project?.id ? String(group.project.id) : (group.id !== "unassigned" ? group.id.replace("proj_", "") : "");
															handleOpenAddModal(targetId);
														}}
														className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer shrink-0"
													>
														<Plus className="w-3.5 h-3.5" />
														<span>Add Plate</span>
													</button>
												)}
											</div>
										</div>

										{/* Desktop Mould Header (sm and above): Full ERP horizontal bar */}
										<div className="hidden sm:flex items-center justify-between gap-4 p-4">
											<div className="flex items-center gap-3 min-w-0 flex-1">
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														toggleMould(group.id);
													}}
													className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer shrink-0"
													title={isExpanded ? "Collapse mould group" : "Expand mould group"}
												>
													<ChevronDown
														className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${
															isExpanded ? "rotate-0 text-blue-600" : "-rotate-90"
														}`}
													/>
												</button>

												<div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-200/60 shrink-0">
													<Layers className="w-4 h-4 text-blue-600" />
												</div>

												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2 flex-wrap">
														<span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/90 shrink-0">
															{group.mouldCode}
														</span>
														<h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">
															{group.mouldName || "Mould Project"}
														</h3>
														{group.worktype && (
															<span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0">
																{group.worktype}
															</span>
														)}
													</div>

													<div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
														{group.customerName && (
															<span className="inline-flex items-center gap-1 font-medium text-slate-700">
																<Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
																<span className="truncate">{group.customerName}</span>
															</span>
														)}
														{group.customerName && <span className="text-slate-300">•</span>}
														<span className="font-semibold text-slate-700 shrink-0">
															{group.plates.length} {group.plates.length === 1 ? "Subplate" : "Subplates"}
														</span>
														{group.totalWeight > 0 && (
															<>
																<span className="text-slate-300">•</span>
																<span className="font-mono text-slate-600 font-medium whitespace-nowrap shrink-0">
																	Total Wt: {group.totalWeight.toFixed(2)} kg
																</span>
															</>
														)}
													</div>
												</div>
											</div>

											{/* Right: Progress Summary & Quick Add Subplate Action */}
											<div className="flex items-center gap-3 shrink-0">
												<div className="flex items-center gap-2.5">
													<div className="text-right">
														<div className="font-bold text-slate-800 text-[11px]">
															{group.completedPlates}/{group.totalPlates} Ready
														</div>
														<div className="text-[10px] text-slate-400">
															{percent}% Complete
														</div>
													</div>
													<div className="w-20 sm:w-24 h-2 bg-slate-200 rounded-full overflow-hidden border border-slate-300/60">
														<div
															className={`h-full rounded-full transition-all duration-300 ${
																group.completedPlates === group.totalPlates && group.totalPlates > 0
																	? "bg-emerald-500"
																	: "bg-blue-600"
															}`}
															style={{ width: `${percent}%` }}
														/>
													</div>
													<span
														className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
															group.completedPlates === group.totalPlates && group.totalPlates > 0
																? "bg-emerald-50 text-emerald-700 border-emerald-200"
																: group.completedPlates > 0
																? "bg-blue-50 text-blue-700 border-blue-200"
																: "bg-slate-100 text-slate-600 border-slate-200"
														}`}
													>
														{group.completedPlates === group.totalPlates && group.totalPlates > 0
															? "All Ready ✓"
															: `${group.completedPlates}/${group.totalPlates} Ready`}
													</span>
												</div>

												{canCreateSubplate && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															const targetId = group.project?.id ? String(group.project.id) : (group.id !== "unassigned" ? group.id.replace("proj_", "") : "");
															handleOpenAddModal(targetId);
														}}
														className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs shadow-blue-600/30 transition-all cursor-pointer"
														title="Add a new subplate to this mould"
													>
														<Plus className="w-3.5 h-3.5" />
														<span>Add Plate</span>
													</button>
												)}
											</div>
										</div>
									</div>

									{/* Expanded Mould Subplates */}
									{isExpanded && (
										<div>
											{/* Desktop Subplates Table View */}
											<div className="hidden md:block w-full overflow-x-auto custom-scrollbar">
												<table className="w-full text-left border-collapse text-sm">
													<thead>
														<tr className="bg-slate-50/60 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
															<th className="py-3 px-2 w-8 text-center"></th>
															<th className="py-3 px-4 min-w-[210px]">Subplate Name</th>
															<th className="py-3 px-4 min-w-[200px]">Specs &amp; Material</th>
															<th className="py-3 px-2 text-center w-24">Location</th>
															<th className="py-3 px-4 min-w-[320px] w-full">Production Pipeline &amp; Status</th>
															<th className="py-3 px-3 text-right w-20">Actions</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-slate-100">
														{group.plates.map((row) => {
															const isRowExpanded = Boolean(expandedRows[row.id]);
															const completedCount = countCompletedStages(row);

															return (
																<React.Fragment key={row.id}>
																	{/* Main Subplate Row */}
																	<tr
																		id={`row-${row.id}`}
																		onClick={(e) => {
																			const target = e.target as HTMLElement;
																			if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
																				return;
																			}
																			toggleRow(row.id);
																		}}
																		onContextMenu={(e) => handleSubplateContextMenu(e, row)}
																		className={`hover:bg-slate-50/90 transition-all duration-150 group cursor-pointer ${getRowHighlightClass(row.id)}`}
																		title="Click to expand Studio • Right-click for 'Assign to Me'"
																	>
																		{/* Row Expand Toggle */}
																		<td className="py-3 px-2 text-center">
																			<button
																				type="button"
																				onClick={() => toggleRow(row.id)}
																				className="p-1 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition cursor-pointer"
																				title={isRowExpanded ? "Hide stage studio" : "Expand stage studio"}
																			>
																				{isRowExpanded ? (
																					<ChevronDown className="w-4 h-4 text-cyan-600" />
																				) : (
																					<ChevronRight className="w-4 h-4 text-slate-400" />
																				)}
																			</button>
																		</td>

																		{/* Subplate Identification */}
																		<td className="py-3 px-4">
																			<div className="flex items-center gap-2">
																				<span className="font-bold text-slate-900 text-[15px] leading-tight">
																					{row.platename}
																				</span>
																				<span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded shrink-0">
																					#{row.id}
																				</span>
																			</div>
																			<div className="flex items-center gap-2 mt-1.5 flex-wrap">
																				{row.subprojectid ? (
																					<span className="font-mono text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80 whitespace-nowrap">
																						{row.subprojectid}
																					</span>
																				) : null}
																				{row.plate_category && (
																					<span className="text-[10px] font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/60 whitespace-nowrap">
																						{row.plate_category}
																					</span>
																				)}
																			</div>
																		</td>

																		{/* Specs, Dimensions & Material */}
																		<td className="py-3 px-4">
																			<div className="font-mono text-[14px] font-bold text-slate-900 whitespace-nowrap tracking-tight">
																				{formatSubplateDimensions(row)}
																			</div>
																			<div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
																				<span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200/90 whitespace-nowrap">
																					{row.material || "MS-Bright"}
																				</span>
																				<span className="text-slate-700 font-semibold whitespace-nowrap">
																					{row.sqty || 1} {Number(row.sqty) === 1 ? "pc" : "pcs"}
																				</span>
																				{row.shape && (
																					<span className="text-slate-400 text-xs whitespace-nowrap font-medium">
																						({row.shape})
																					</span>
																				)}
																			</div>
																		</td>

																		{/* Location Badge */}
																		<td className="py-3 px-2 text-center whitespace-nowrap">
											<SubplateJobworkLocationBadge subplate={row} size="sm" />
																		</td>

																		{/* Production Pipeline & Clean Status */}
																		<td className="py-3 px-4">
																			{(() => {
																				const progress = getSubplateProgressInfo(row, activeStaff);
																				return (
																					<div className="space-y-2">
																						{/* Status Header: Badge + Step count + Open Studio button */}
																						<div className="flex items-center justify-between gap-2.5">
																							<div className="flex items-center gap-2 flex-wrap">
																								<span
																									className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${progress.badgeStyle}`}
																								>
																									<span className={`w-1.5 h-1.5 rounded-full ${progress.dotColor}`} />
																									<span>{progress.badgeLabel}</span>
																									{progress.assignee && (
																										<span className="font-mono text-[10px] opacity-75 font-normal ml-0.5">
																											({progress.assignee})
																										</span>
																									)}
																								</span>
																								<span className="text-[11px] font-semibold text-slate-500">
																									{progress.completed}/9 Steps
																								</span>
																							</div>

																							<button
																								type="button"
																								onClick={() => toggleRow(row.id)}
																								className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer shrink-0 ${
																									isRowExpanded
																										? "bg-slate-200 text-slate-800 hover:bg-slate-300"
																										: "text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/90 font-bold"
																								}`}
																								title={isRowExpanded ? "Close stage studio" : "Open 9-stage management studio"}
																							>
																								<span>{isRowExpanded ? "Hide Studio" : "Open Studio"}</span>
																								{isRowExpanded ? (
																									<ChevronDown className="w-3.5 h-3.5 text-slate-700" />
																								) : (
																									<ChevronRight className="w-3.5 h-3.5 text-blue-700" />
																								)}
																							</button>
																						</div>

																						{/* Sleek 9-Segment Micro-Stepper */}
																						<div className="flex items-center gap-1 w-full" title="Hover over a segment to see stage name">
																							{STAGE_DEFINITIONS.map((stage, idx) => {
																								const val = (row as any)[stage.key];
																								const isDone = Boolean(val && val !== 0);
																								const staffMember = activeStaff.find((u) => u.id === Number(val));
																								const name = (row as any)[stage.nameKey] || staffMember?.initials || staffMember?.name || "";
																								return (
																									<div
																										key={stage.key}
																										title={`Stage ${idx + 1}: ${stage.label.replace(/^\d+\.\s*/, "")}${isDone ? ` (Done: ${name || "Assigned"})` : " (Pending)"}`}
																										className={`h-2 flex-1 rounded-sm transition-all cursor-pointer ${
																											isDone
																												? "bg-blue-600 hover:bg-blue-700 shadow-2xs"
																												: "bg-slate-200 hover:bg-slate-300"
																										}`}
																										onClick={() => toggleRow(row.id)}
																									/>
																								);
																							})}
																						</div>
																					</div>
																				);
																			})()}
																		</td>

																		{/* Actions */}
																		<td className="py-3 px-3 text-right whitespace-nowrap">
																			<div className="flex items-center justify-end gap-1.5">
																				{canEditSubplate && (
																					<button
																						type="button"
																						onClick={() => handleOpenEditModal(row)}
																						className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
																						title="Edit subplate"
																					>
																						<Pencil className="w-4 h-4" />
																					</button>
																				)}
																				{canDeleteSubplate && (
																					<button
																						type="button"
																						onClick={() => handleDeleteSubplate(row.id, row.platename)}
																						className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
																						title="Delete subplate"
																					>
																						<Trash2 className="w-4 h-4" />
																					</button>
																				)}
																			</div>
																		</td>
																	</tr>

																	{/* Expanded 9-Stage Timeline Studio */}
																	{isRowExpanded && (
																		<tr className="bg-slate-50/90">
																			<td colSpan={6} className="p-3 sm:p-4 border-y border-slate-200">
																				<div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
																					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
																						<div className="flex items-center gap-2">
																							<div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
																								<Layers className="w-4 h-4" />
																							</div>
																							<div>
																								<h4 className="text-sm font-bold text-slate-900">
																									9-Stage Production Tracking Studio for &quot;{row.platename}&quot;
																								</h4>
																								<p className="text-xs text-slate-500">
																									{isAdmin
																										? "Click any stage to assign or change staff. Timestamp is recorded automatically."
																										: "Assign yourself to pending stages or manage your active assignments."}
																								</p>
																							</div>
																						</div>

																						<div className="flex items-center gap-2.5 text-xs">
																							<span className="font-bold text-slate-800">
																								Progress: {completedCount}/9 Completed
																							</span>
																							<div className="w-28 h-2.5 bg-slate-200 rounded-full overflow-hidden border border-slate-300/60">
																								<div
																									className="h-full bg-blue-600 rounded-full transition-all duration-300"
																									style={{ width: `${(completedCount / 9) * 100}%` }}
																								/>
																							</div>
																						</div>
																					</div>

																					{/* 9-Stage Cards Grid */}
																					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
																						{STAGE_DEFINITIONS.map((stage) => {
																							const val = (row as any)[stage.key];
																							const timestamp = (row as any)[stage.atKey];
																							const isAssigned = Boolean(val && val !== 0);
																							const isAssignedToMe = Boolean(currentUser?.id && Number(val) === Number(currentUser.id));
																							const isAssignedToOther = isAssigned && !isAssignedToMe;
																							const isStage2 = stage.key === "order_by";
																							const totalQty = Number(row.sqty) || 1;
																							const orderedQty = row.ordered_qty ?? 0;
																							const remainingQty = row.remaining_qty !== undefined ? row.remaining_qty : Math.max(0, totalQty - orderedQty);
																							const isPartial = isStage2 && (row.po_status === "PARTIAL" || (orderedQty > 0 && remainingQty > 0));
																							const isFullyOrdered = isStage2 && (row.po_status === "FULLY_ORDERED" || (orderedQty >= totalQty && orderedQty > 0));
																							const isStageDone = isStage2 ? isFullyOrdered : isAssigned;

																							return (
																								<div
																									key={stage.key}
																									className={`p-3 rounded-xl border transition-all space-y-2.5 flex flex-col justify-between ${
																										isPartial
																											? "bg-white border-amber-300 shadow-xs ring-1 ring-amber-400/20"
																											: isStageDone
																											? "bg-white border-blue-200 shadow-xs ring-1 ring-blue-500/10"
																											: "bg-white/80 border-slate-200 hover:border-slate-300"
																									}`}
																								>
																									<div>
																										{/* Step Header */}
																										<div className="flex items-center justify-between gap-1 mb-1.5">
																											<span
																												className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
																													isPartial
																														? "bg-amber-50 text-amber-700 border border-amber-200/80"
																														: isStageDone
																														? "bg-blue-50 text-blue-700 border border-blue-200/60"
																														: "bg-slate-100 text-slate-500 border border-slate-200/60"
																												}`}
																											>
																												Stage {stage.step}
																											</span>
																											{isStage2 ? (
																												isFullyOrdered ? (
																													<Lock className="w-4 h-4 text-emerald-600 shrink-0" />
																												) : isPartial ? (
																													<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 font-mono">
																														Partial
																													</span>
																												) : (
																													<span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
																												)
																											) : isAssigned ? (
																												<CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
																											) : (
																												<span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
																											)}
																										</div>
																										<div className="text-xs font-bold text-slate-900 leading-snug">
																											{stage.label.replace(/^\d+\.\s*/, "")}
																										</div>
																									</div>

																									{/* Middle: Staff / Action Section */}
																									<div className="space-y-1.5 flex-1 flex flex-col justify-end">
																										<label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
																											Assigned Staff
																										</label>
																										{isStage2 ? (
																											(() => {
																												const staffMember = activeStaff.find((u) => u.id === Number(val));
																												const staffName = staffMember?.name || (row as any).order_by_name || `Staff #${val}`;
																												const staffInitials = staffMember?.initials || (row as any).order_by_name?.slice(0, 2).toUpperCase() || "PO";

																												if (isFullyOrdered) {
																													return (
																														<div className="h-9 px-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-1.5 shadow-2xs">
																															<div className="flex items-center gap-1.5 min-w-0">
																																<div className="w-5 h-5 rounded-md bg-emerald-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
																																	{staffInitials}
																																</div>
																																<div className="min-w-0">
																																	<div className="text-[11px] font-bold text-slate-800 truncate leading-tight">
																																		{staffName}
																																	</div>
																																	<div className="text-[9px] font-mono text-emerald-700 truncate font-semibold leading-none">
																																		{row.po_srno ? `PO #${row.po_srno}` : "PO"} • {totalQty} pcs
																																	</div>
																																</div>
																															</div>
																															<Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
																														</div>
																													);
																												}

																												if (isPartial) {
																													return (
																														<div className="space-y-1.5">
																															<div className="h-9 px-2 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-center justify-between gap-1.5 shadow-2xs">
																																<div className="flex items-center gap-1.5 min-w-0">
																																	<div className="w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
																																		{staffInitials}
																																	</div>
																																	<div className="min-w-0">
																																		<div className="text-[11px] font-bold text-slate-900 truncate leading-tight">
																																			{staffName}
																																		</div>
																																		<div className="text-[9px] font-mono text-amber-700 truncate font-semibold leading-none">
																																			{row.po_srno ? `PO #${row.po_srno}` : "PO"}
																																		</div>
																																	</div>
																																</div>
																																<span className="text-[9px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-1.5 py-0.5 rounded font-mono shrink-0">
																																	{orderedQty}/{totalQty}
																																</span>
																															</div>
																															<button
																																type="button"
																																onClick={() => handleOpenCreatePOForPlate(row)}
																																className="w-full h-8 px-2 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer group"
																															>
																																<ShoppingCart className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
																																<span className="truncate">Order Rem. ({remainingQty} pcs)</span>
																															</button>
																														</div>
																													);
																												}

																												// Unordered
																												return (
																													<button
																														type="button"
																														onClick={() => handleOpenCreatePOForPlate(row)}
																														className="w-full h-9 px-2.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-100/80 text-amber-900 transition flex items-center justify-between gap-1 cursor-pointer shadow-2xs group"
																													>
																														<span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5 truncate">
																															<ShoppingCart className="w-3.5 h-3.5 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
																															<span className="truncate">Create PO</span>
																														</span>
																														<span className="text-[9px] font-mono font-bold text-amber-700 bg-amber-100 border border-amber-200/80 px-1.5 py-0.5 rounded shrink-0">
																															{totalQty} pcs
																														</span>
																													</button>
																												);
																											})()
																										) : (
																											<StaffSelect
																												value={val}
																												onChange={(userId) =>
																													handleStageStaffChange(
																														row.id,
																														stage.key,
																														userId
																													)
																												}
																												staff={
																													isAdmin
																														? activeStaff
																														: currentUser
																														? [
																																{
																																	id: Number(currentUser.id),
																																	name: currentUser.name || "Me",
																																	initials:
																																		currentUser.initials ||
																																		currentUser.name?.slice(0, 2).toUpperCase() ||
																																		"ME",
																																} as any,
																														  ]
																														: []
																												}
																												disabled={!isAdmin && isAssignedToOther}
																												color="blue"
																												className="w-full"
																												placeholder="Unassigned"
																											/>
																										)}
																									</div>

																									{/* Timestamp Display */}
																									<div className="pt-2 border-t border-slate-100 text-[10px]">
																										{isAssigned && timestamp ? (
																											<div className="flex items-center gap-1.5 text-slate-600 font-mono text-[10px] font-medium truncate">
																												<Clock className="w-3 h-3 text-slate-400 shrink-0" />
																												<span>{formatTimestamp(timestamp)}</span>
																											</div>
																										) : isAssigned ? (
																											<span className="text-blue-700 font-semibold text-[10px]">Assigned</span>
																										) : (
																											<span className="text-slate-400 font-medium text-[10px]">Pending</span>
																										)}
																									</div>
																								</div>
																							);
																						})}
																					</div>
																				</div>
																			</td>
																		</tr>
																	)}
																</React.Fragment>
															);
														})}
													</tbody>
												</table>
											</div>

											{/* Mobile Subplates Card View */}
											<div className="block md:hidden p-3 space-y-2.5">
												{group.plates.map((row) => {
													const isRowExpanded = Boolean(expandedRows[row.id]);
													const completedCount = countCompletedStages(row);

													return (
														<div
															key={row.id}
															id={`m-row-${row.id}`}
															onClick={(e) => {
																const target = e.target as HTMLElement;
																if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
																	return;
																}
																toggleRow(row.id);
															}}
															onContextMenu={(e) => handleSubplateContextMenu(e, row)}
															className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5 text-xs shadow-2xs transition-all duration-200 cursor-pointer ${getRowHighlightClass(row.id)}`}
														>
															<div className="flex items-center justify-between gap-2">
																<div className="flex items-center gap-1.5 min-w-0 flex-1">
																	<span className="font-mono text-slate-400 text-[11px] shrink-0">#{row.id}</span>
																	<span className="font-bold text-slate-900 break-words leading-tight">{row.platename}</span>
																</div>
																<div className="flex items-center gap-1.5 shrink-0">
																	<SubplateJobworkLocationBadge subplate={row} size="sm" />
																	{canEditSubplate && (
																		<button
																			type="button"
																			onClick={() => handleOpenEditModal(row)}
																			className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
																			title="Edit subplate"
																		>
																			<Pencil className="w-3.5 h-3.5" />
																		</button>
																	)}
																	{canDeleteSubplate && (
																		<button
																			type="button"
																			onClick={() => handleDeleteSubplate(row.id, row.platename)}
																			className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
																			title="Delete subplate"
																		>
																			<Trash2 className="w-3.5 h-3.5" />
																		</button>
																	)}
																</div>
															</div>

															<div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
																<div>
																	<span className="text-slate-400">Subproject: </span>
																	<span className="font-mono font-medium text-slate-700 truncate block">
																		{row.subprojectid || "—"}
																	</span>
																</div>
																<div>
																	<span className="text-slate-400">Material: </span>
																	<span className="font-medium text-slate-700 block">
																		{row.material || "MS-Bright"}
																	</span>
																</div>
																<div>
																	<span className="text-slate-400">Dimensions: </span>
																	<span className="font-mono font-medium text-slate-700 block">
																		{formatSubplateDimensions(row)}
																	</span>
																</div>
																<div>
																	<span className="text-slate-400">Qty / Shape: </span>
																	<span className="font-medium text-slate-700 block">
																		{row.sqty || 1} ({row.shape || "Plate"})
																	</span>
																</div>
															</div>

															{/* Mobile 9-Stage Progress Bar & Trigger */}
															<div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
																<span className="text-[11px] font-semibold text-slate-700">
																	{completedCount}/9 Stages Done
																</span>
																<button
																	type="button"
																	onClick={() => toggleRow(row.id)}
																	className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition cursor-pointer"
																>
																	{isRowExpanded ? "Hide Studio" : "Open Studio"}
																</button>
															</div>

															{/* Mobile Expanded Stepper */}
															{isRowExpanded && (
																<div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
																	{STAGE_DEFINITIONS.map((stage) => {
																		const val = (row as any)[stage.key];
																		const timestamp = (row as any)[stage.atKey];
																		const isAssigned = Boolean(val && val !== 0);
																		const isAssignedToMe = Boolean(currentUser?.id && Number(val) === Number(currentUser.id));
																		const isAssignedToOther = isAssigned && !isAssignedToMe;
																		const isStage2 = stage.key === "order_by";
																		const totalQty = Number(row.sqty) || 1;
																		const orderedQty = row.ordered_qty ?? 0;
																		const remainingQty = row.remaining_qty !== undefined ? row.remaining_qty : Math.max(0, totalQty - orderedQty);
																		const isPartial = isStage2 && (row.po_status === "PARTIAL" || (orderedQty > 0 && remainingQty > 0));
																		const isFullyOrdered = isStage2 && (row.po_status === "FULLY_ORDERED" || (orderedQty >= totalQty && orderedQty > 0));

																		if (isStage2) {
																			const staffMember = activeStaff.find((u) => u.id === Number(val));
																			const staffName = staffMember?.name || (row as any).order_by_name || (val ? `Staff #${val}` : "PO Created");
																			const staffInitials = staffMember?.initials || (row as any).order_by_name?.slice(0, 2).toUpperCase() || "PO";

																			if (isFullyOrdered) {
																				return (
																					<div
																						key={stage.key}
																						className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/90 shadow-2xs space-y-1.5"
																					>
																						<div className="flex items-center justify-between gap-2">
																							<div className="flex items-center gap-2 min-w-0">
																								<span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
																									{stage.label}
																								</span>
																								<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono whitespace-nowrap">
																									All {totalQty} pcs
																								</span>
																							</div>

																							<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-emerald-200 text-slate-800 text-[11px] font-medium shrink-0 max-w-[140px] shadow-2xs">
																								<div className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
																									{staffInitials}
																								</div>
																								<span className="truncate font-semibold">{staffName}</span>
																								<Lock className="w-3 h-3 text-emerald-600 shrink-0 ml-0.5" />
																							</div>
																						</div>

																						<div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono pt-1.5 border-t border-emerald-100/80">
																							<span className="font-semibold text-emerald-800">
																								{row.po_srno ? `PO #${row.po_srno}` : "PO"}
																							</span>
																							{timestamp && (
																								<>
																									<span>•</span>
																									<span>{formatTimestamp(timestamp)}</span>
																								</>
																							)}
																						</div>
																					</div>
																				);
																			}

																			if (isPartial) {
																				return (
																					<div
																						key={stage.key}
																						className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-300 shadow-2xs space-y-2"
																					>
																						{/* Tier 1: Title, Progress Pill & Staff Card */}
																						<div className="flex items-center justify-between gap-2">
																							<div className="flex items-center gap-2 min-w-0">
																								<span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
																									{stage.label}
																								</span>
																								<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-200/90 text-amber-900 font-mono whitespace-nowrap">
																									{orderedQty}/{totalQty} pcs ordered
																								</span>
																							</div>

																							<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-amber-200 text-slate-800 text-[11px] font-medium shrink-0 max-w-[130px] shadow-2xs">
																								<div className="w-4 h-4 rounded-full bg-amber-500 text-white font-bold text-[8px] flex items-center justify-center shrink-0">
																									{staffInitials}
																								</div>
																								<span className="truncate font-semibold">{staffName}</span>
																							</div>
																						</div>

																						{/* Tier 2: PO number & timestamp on left, Action Button on right */}
																						<div className="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-200/60 text-[10px]">
																							<div className="min-w-0 text-slate-500 font-mono flex items-center gap-1 truncate">
																								<span className="font-semibold text-amber-800 shrink-0">
																									{row.po_srno ? `PO #${row.po_srno}` : "PO"}
																								</span>
																								{timestamp && (
																									<>
																										<span>•</span>
																										<span className="truncate">{formatTimestamp(timestamp)}</span>
																									</>
																								)}
																							</div>

																							<button
																								type="button"
																								onClick={() => handleOpenCreatePOForPlate(row)}
																								className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-[10px] shadow-2xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
																							>
																								<ShoppingCart className="w-3 h-3" />
																								<span>+ Order {remainingQty} pcs</span>
																							</button>
																						</div>
																					</div>
																				);
																			}

																			// Unordered
																			return (
																				<div
																					key={stage.key}
																					className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
																				>
																					<div className="min-w-0 flex-1">
																						<div className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
																							{stage.label}
																						</div>
																						<div className="text-[10px] text-amber-700 font-medium">
																							PO required ({totalQty} pcs)
																						</div>
																					</div>
																					<button
																						type="button"
																						onClick={() => handleOpenCreatePOForPlate(row)}
																						className="h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
																					>
																						<ShoppingCart className="w-3.5 h-3.5" />
																						<span>Create PO</span>
																					</button>
																				</div>
																			);
																		}

																		return (
																			<div
																				key={stage.key}
																				className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
																			>
																				<div className="flex-1 min-w-0">
																					<div className="text-[11px] font-bold text-slate-800 truncate">
																						{stage.label}
																					</div>
																					{isAssigned && timestamp && (
																						<div className="text-[10px] text-slate-600 font-mono">
																							{formatTimestamp(timestamp)}
																						</div>
																					)}
																				</div>
																				<StaffSelect
																					value={val}
																					onChange={(userId) =>
																						handleStageStaffChange(
																							row.id,
																							stage.key,
																							userId
																						)
																					}
																					staff={
																						isAdmin
																							? activeStaff
																							: currentUser
																							? [
																									{
																										id: Number(currentUser.id),
																										name: currentUser.name || "Me",
																										initials: currentUser.initials || currentUser.name?.slice(0, 2).toUpperCase() || "ME",
																									} as any,
																							  ]
																							: []
																					}
																					disabled={!isAdmin && isAssignedToOther}
																					color="blue"
																					placeholder="Unassigned"
																				/>
																			</div>
																		);
																	})}
																</div>
															)}
														</div>
													);
												})}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}

				{/* Pagination Controls */}
				{!isLoading && mouldGroups.length > 0 && (
					<div className="px-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
						<div className="flex items-center gap-2">
							<span>Show</span>
							<div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
								{[10, 25, 50, 100].map((size) => (
									<button
										key={size}
										type="button"
										onClick={() => {
											setPageSize(size);
											setCurrentPage(1);
										}}
										className={`px-2 py-0.5 rounded text-xs font-semibold transition cursor-pointer ${
											pageSize === size
												? "bg-white text-blue-700 shadow-2xs font-bold"
												: "text-slate-600 hover:text-slate-900"
										}`}
									>
										{size}
									</button>
								))}
							</div>
							<span>
								per page • Showing {((currentPage - 1) * pageSize) + 1} to{" "}
								{Math.min(currentPage * pageSize, mouldGroups.length)} of {mouldGroups.length} Mould Projects ({filteredSubplates.length} Subplates)
							</span>
						</div>

						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
								className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
								title="Previous page"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>
							<span className="px-2.5 py-1 font-semibold text-slate-700">
								Page {currentPage} of {totalPages}
							</span>
							<button
								type="button"
								onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
								disabled={currentPage >= totalPages}
								className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
								title="Next page"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}

				<div className="py-2.5 px-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
					<span>
						Showing {filteredSubplates.length} subplates grouped across {mouldGroups.length} mould projects
					</span>
					<span>All dimensions and material grades derived from factory inventory</span>
				</div>

				{/* Modal: Add Subplate (Physics-based Spring Modal) */}
				<Modal
					isOpen={isModalOpen}
					onClose={() => {
						setIsModalOpen(false);
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
								<h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug truncate">
									{editingSubplate ? "Edit Subplate Workpiece" : "Add New Subplate"}
								</h3>
								<p className="text-[11px] sm:text-xs text-slate-500 truncate">
									{editingSubplate
										? `Update specifications for "${editingSubplate.platename}"`
										: "Define workpiece specifications & allocate to project"}
								</p>
							</div>
						</div>
					}
				>
					<form onSubmit={handleSubmitModal} className="space-y-4">
						{/* Group 1: Workpiece Identification & Mould Assignment */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
							{/* 1-Click Companion Quick-Pills (if target mould has sibling plates) */}
							{companionRecommendations.length > 0 && !editingSubplate && (
								<div className="sm:col-span-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-cyan-50/50 border border-blue-200/70 shadow-2xs space-y-1.5 animate-in fade-in duration-200">
									<div className="flex items-center justify-between">
										<span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
											<Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
											<span>Suggested Companion Plates</span>
											<span className="text-[9px] font-medium text-blue-600 bg-blue-100/80 px-1.5 py-0.2 rounded-full border border-blue-200/60">
												Co-Occurrence
											</span>
										</span>
										<span className="text-[10px] text-slate-500 font-medium hidden xs:inline">
											1-Click Auto-Fill
										</span>
									</div>
									<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-0.5">
										{companionRecommendations.map((rec) => (
											<button
												key={rec.name}
												type="button"
												tabIndex={-1}
												onClick={() => handleApplyCompanion(rec)}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-blue-200/90 bg-white text-slate-800 hover:text-blue-700 hover:bg-blue-50/90 hover:border-blue-300 active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer group"
												title={
													rec.mirroredSpecs
														? `Auto-mirrors specs: ${rec.mirroredSpecs.length}×${rec.mirroredSpecs.width} ${rec.mirroredSpecs.material}`
														: undefined
												}
											>
												<span className="group-hover:text-blue-600 transition-colors">
													{rec.name}
												</span>
												<span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100 group-hover:bg-blue-100/80">
													{rec.confidence}%
												</span>
												{rec.mirroredSpecs && (
													<span className="text-[9px] text-emerald-600 font-medium hidden sm:inline">
														(Auto-specs)
													</span>
												)}
											</button>
										))}
									</div>
								</div>
							)}

							<div>
								<label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
									<span className="flex items-center gap-1.5">
										<Tag className="w-3.5 h-3.5 text-blue-600" />
										<span>Plate Name</span>
										<span className="text-rose-500 font-bold">*</span>
									</span>
									<span className="text-[10px] text-slate-400 font-medium hidden md:inline">
										Press <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">Tab</kbd> or <kbd className="px-1 py-0.5 rounded bg-slate-100 font-mono text-slate-600 border border-slate-200">→</kbd> to complete
									</span>
								</label>
								<GhostPlateInput
									id="subplate-modal-platename"
									required
									placeholder="e.g. Cavity Plate A-Side"
									value={modalForm.platename}
									existingPlateNames={modalTargetPlateNames}
									onChange={(val) =>
										setModalForm((prev) => ({
											...prev,
											platename: val,
										}))
									}
								/>
							</div>

							<div>
								<label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
									<Building2 className="w-3.5 h-3.5 text-indigo-600" />
									<span>Target Mould / Project</span>
									<span className="text-rose-500 font-bold">*</span>
								</label>
								<ProjectSelect
									projects={scans}
									value={modalForm.projectid}
									required
									isLoading={isProjectsLoading}
									placeholder="Search or select mould / project..."
									onOpen={() => projectsQuery.refetch()}
									onChange={(val, project) => {
										setModalForm((prev) => ({
											...prev,
											projectid: project?.id ? String(project.id) : val,
										}));
									}}
								/>
								{!modalForm.projectid && (
									<p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1.5">
										<AlertCircle className="w-3 h-3 shrink-0" />
										Target mould selection is required to enable saving.
									</p>
								)}
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
										value={modalForm.shape}
										onChange={(val) =>
											handleDimensionChange("shape", String(val))
										}
										options={modalShapeOptions}
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
											{MATERIAL_DENSITIES[modalForm.material] || 7.81} g/cm³
										</span>
									</label>
									<ERPSelect
										value={modalForm.material}
										onChange={(val) =>
											handleDimensionChange("material", String(val))
										}
										options={modalMaterialOptions}
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
											onClick={() => handleStepQty(-1)}
											disabled={Number(modalForm.sqty || 1) <= 1}
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
											value={modalForm.sqty}
											onKeyDown={blockInvalidIntegerKeys}
											onChange={handleQtyChange}
											className="h-full w-full text-center font-bold text-xs text-slate-900 focus:outline-none bg-transparent"
										/>
										<button
											type="button"
											tabIndex={-1}
											onClick={() => handleStepQty(1)}
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
										{dimLabels.headerGuide}
									</span>
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
									{dimLabels.isRound ? (
										<>
											{/* 1. OD (Outer Diameter) */}
											<div>
												<div className="relative">
													<input
														type="text"
														inputMode="decimal"
														placeholder={dimLabels.widthPlaceholder}
														value={modalForm.width}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("width", e.target.value)
														}
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
														placeholder={dimLabels.length}
														value={modalForm.length}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("length", e.target.value)
														}
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
														placeholder={dimLabels.heightPlaceholder}
														value=""
														className="w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
													/>
													<span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
														—
													</span>
												</div>
											</div>
										</>
									) : dimLabels.isPipe ? (
										<>
											{/* 1. OD (Outer Diameter) */}
											<div>
												<div className="relative">
													<input
														type="text"
														inputMode="decimal"
														placeholder={dimLabels.widthPlaceholder}
														value={modalForm.width}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("width", e.target.value)
														}
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
														placeholder={dimLabels.heightPlaceholder}
														value={modalForm.height}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("height", e.target.value)
														}
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
														placeholder={dimLabels.length}
														value={modalForm.length}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("length", e.target.value)
														}
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
														placeholder={dimLabels.length}
														value={modalForm.length}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("length", e.target.value)
														}
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
														placeholder={dimLabels.widthPlaceholder}
														value={modalForm.width}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("width", e.target.value)
														}
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
														placeholder={dimLabels.heightPlaceholder}
														value={modalForm.height}
														disabled={heightDisabled}
														onKeyDown={blockInvalidNumberKeys}
														onChange={(e) =>
															handleNumericDimension("height", e.target.value)
														}
														className={"w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 " + (
															heightDisabled
																? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
																: "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
														)}
													/>
													<span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
														{heightDisabled ? "—" : "H"}
													</span>
												</div>
											</div>
										</>
									)}
									<div>
										<ERPSelect
											value={modalForm.unit}
											onChange={(val) =>
												handleDimensionChange("unit", String(val))
											}
											options={modalUnitOptions}
											showSearch={false}
											placeholder="Unit"
										/>
									</div>
								</div>
							</div>
						</div>

						{/* Group 3: Weight Engineering Readout */}
						<div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-3.5 sm:p-4 text-white flex flex-col justify-between shadow-md relative overflow-hidden border border-slate-800">
							<div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
							<div className="flex items-center justify-between relative z-10 mb-2">
								<span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
									<Scale className="w-3.5 h-3.5 text-blue-400" />
									<span>Theoretical Weight</span>
									<Lock className="w-3 h-3 text-slate-400" />
								</span>
								<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
									<Sparkles className="w-2.5 h-2.5 text-cyan-300" />
									{Number(modalForm.sqty) > 1
										? ("Total (" + modalForm.sqty + " pcs)")
										: "Auto-Calculated"}
								</span>
							</div>

							<div className="flex items-baseline gap-2 relative z-10">
								<span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
									{modalForm.weight || "0.000"}
								</span>
								<span className="text-sm font-bold text-slate-400">kg</span>
								{Number(modalForm.sqty) > 1 && Boolean(modalForm.weight) && (
									<span className="ml-auto text-[11px] font-mono text-slate-300 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
										{(Number(modalForm.weight) / Number(modalForm.sqty)).toFixed(3)} kg / pc
									</span>
								)}
							</div>

							{Number(modalForm.sqty) > 1 && Boolean(modalForm.weight) ? (
								<div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 flex items-center justify-between relative z-10 font-mono">
									<span>
										{modalForm.sqty} pcs × {(Number(modalForm.weight) / Number(modalForm.sqty)).toFixed(3)} kg
									</span>
									<span className="text-slate-300 font-sans font-semibold">Total Batch Wt</span>
								</div>
							) : (
								<div className="mt-1 text-[10px] text-slate-400 relative z-10">
									Based on {modalForm.material} density @ {MATERIAL_DENSITIES[modalForm.material] || 7.81} g/cm³
								</div>
							)}
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
										setIsModalOpen(false);
										setEditingSubplate(null);
									}}
									className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold"
								>
									Cancel
								</MotionButton>
								<MotionButton
									type="submit"
									variant="primary"
									disabled={isSubmitting || !isModalFormValid}
									isLoading={isSubmitting}
									loadingText={editingSubplate ? "Saving Changes..." : "Saving..."}
									successText={editingSubplate ? "Saved!" : "Subplate Saved!"}
									className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
								>
									{editingSubplate ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
									<span>{editingSubplate ? "Save Changes" : "Save Subplate"}</span>
								</MotionButton>
							</div>
						</div>
					</form>
				</Modal>

				{/* Right-Click Floating Context Menu on Subplate */}
				{contextMenu.subplate && (
					<ContextMenu
						x={contextMenu.x}
						y={contextMenu.y}
						isOpen={contextMenu.isOpen}
						onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false, subplate: null }))}
						title={`${contextMenu.subplate.platename} #${contextMenu.subplate.id} • ${
							contextMenu.subplate.subprojectid || (contextMenu.subplate as any).mould_project_code || "Subplate"
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
										onClick: () => {},
									});
								} else if (allowedStages.length === 0) {
									items.push({
										label: "No Assigned Department Stages",
										subtext: "Your role has no production stage assignments",
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
										const name = (sp as any)[st.nameKey] || staffMember?.name || staffMember?.initials;

										if (isMine) {
											// Locked: non-admins cannot unassign once assigned
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
												subtext: `Assigned to ${name || "staff"} • Only Admin can reassign`,
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
												onClick: () => handleStageStaffChange(sp.id, st.key, currentUserId),
											});
										}
									});
								}

								// Overview utility for non-admin
								items.push({
									separator: true,
									label: "Open 9-Stage Studio",
									icon: Layers,
									onClick: () => toggleRow(sp.id),
								});
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
					onAssign={handleStageStaffChange}
					onCreatePO={handleOpenCreatePOForPlate}
				/>

				{/* Inline Create Purchase Order Modal */}
				<CreatePurchaseOrderModal
					isOpen={createPOModalOpen}
					onClose={() => {
						setCreatePOModalOpen(false);
						setTargetPOProject(null);
						setTargetPOPlate(null);
					}}
					initialProject={targetPOProject}
					initialPlate={targetPOPlate}
					onSuccess={() => {
						queryClient.invalidateQueries({ queryKey: queryKeys.subplates.all() });
						queryClient.invalidateQueries({ queryKey: queryKeys.purchases.all() });
						queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.counts() });
						broadcastQueryInvalidation(queryKeys.subplates.all());
						broadcastQueryInvalidation(queryKeys.dashboard.counts());
					}}
				/>

				{/* Dedicated Purchase Order Required Modal */}
				<Modal
					isOpen={Boolean(poRequiredModal)}
					onClose={() => setPoRequiredModal(null)}
					title="Purchase Order Required"
					description={`Stage 2 • ${poRequiredModal?.platename || "Subplate"}`}
					size="md"
				>
					<div className="space-y-4 pt-1">
						<div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start gap-3.5">
							<div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
								<ShoppingCart className="w-5 h-5" />
							</div>
							<div className="space-y-1 min-w-0">
								<h4 className="text-sm font-bold text-amber-950">Commercial PO Mandatory</h4>
								<p className="text-xs text-amber-800/90 leading-relaxed">
									Stage 2 (Purchase) cannot be assigned manually. To assign this stage, please generate an official Purchase Order for this subplate.
								</p>
							</div>
						</div>

						{poRequiredModal && (
							<div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
								<div className="flex justify-between items-center text-slate-500">
									<span>Subplate Name:</span>
									<span className="font-bold text-slate-800">{poRequiredModal.platename}</span>
								</div>
								<div className="flex justify-between items-center text-slate-500">
									<span>Material:</span>
									<span className="font-semibold text-slate-700">{poRequiredModal.material || "MS-Bright"}</span>
								</div>
								<div className="flex justify-between items-center text-slate-500">
									<span>Required Qty:</span>
									<span className="font-semibold text-slate-700">{poRequiredModal.sqty || 1} pcs</span>
								</div>
							</div>
						)}

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
							<button
								type="button"
								onClick={() => setPoRequiredModal(null)}
								className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={() => {
									if (poRequiredModal) {
										const p = poRequiredModal;
										setPoRequiredModal(null);
										handleOpenCreatePOForPlate(p);
									}
								}}
								className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1.5 shadow-xs cursor-pointer"
							>
								<ShoppingCart className="w-3.5 h-3.5" />
								<span>Generate Purchase Order</span>
							</button>
						</div>
					</div>
				</Modal>
			</div>
 </AppLayout>
 );
}

export function SubplatePage() {
	return (
		<Suspense
			fallback={
				<AppLayout>
					<div className="p-6 space-y-4">
						<div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
						<KpiCardSkeleton count={4} />
					</div>
				</AppLayout>
			}
		>
			<SubplatePageContent />
		</Suspense>
	);
}
