"use client";

import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
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
	CheckCheck,
	Calculator,
	Scale,
	Sparkles,
	Lock,
	Minus,
	Check,
} from "lucide-react";
import type { Subplate, ScanProject, User } from "@/lib/supabase/types";
import { KpiCardSkeleton, TableSkeletonRows } from "@/components/ui/skeleton";
import { StaffSelect } from "@/components/ui/staff-select";
import { Modal, Drawer } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import {
	calculateSubplateWeight,
	isHeightDisabled,
	getDimensionLabels,
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

// 9 Production Stages configuration
export const STAGE_DEFINITIONS = [
	{ key: "design_by", atKey: "design_at", nameKey: "design_by_name", short: "DES", label: "1. Design Order", step: 1, color: "blue" },
	{ key: "order_by", atKey: "order_at", nameKey: "order_by_name", short: "ORD", label: "2. Mat. Order", step: 2, color: "amber" },
	{ key: "received_workby", atKey: "received_work_at", nameKey: "received_workby_name", short: "REC", label: "3. Mat. Inward", step: 3, color: "emerald" },
	{ key: "received_qcby", atKey: "received_qc_at", nameKey: "received_qcby_name", short: "RQC", label: "4. Inward QC", step: 4, color: "teal" },
	{ key: "vmc_workby", atKey: "vmc_work_at", nameKey: "vmc_workby_name", short: "VMC", label: "5. VMC Work", step: 5, color: "indigo" },
	{ key: "vmc_qcby", atKey: "vmc_qc_at", nameKey: "vmc_qcby_name", short: "VQC", label: "6. VMC QC", step: 6, color: "purple" },
	{ key: "drilltap_workby", atKey: "drilltap_at", nameKey: "drilltap_workby_name", short: "D&T", label: "7. Drill & Tap", step: 7, color: "violet" },
	{ key: "final_qcby", atKey: "final_qc_at", nameKey: "final_qcby_name", short: "FQC", label: "8. Final QC", step: 8, color: "cyan" },
	{ key: "packing_workby", atKey: "packing_at", nameKey: "packing_workby_name", short: "PAK", label: "9. Packing", step: 9, color: "rose" },
] as const;

// Helper to format ISO timestamp to human-readable date/time
const formatTimestamp = (ts: string | null | undefined): string => {
	if (!ts) return "";
	try {
		const d = new Date(ts);
		return d.toLocaleString("en-GB", {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return String(ts);
	}
};

import { useAuth, UserSession } from "@/components/providers/auth-provider";

// Compact Interactive Stage Chip with Direct Quick-Assign Popover
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
	const popoverRef = useRef<HTMLDivElement>(null);
	const isAssigned = Boolean(userId && userId !== 0);
	const assignedUser = staff.find((u) => u.id === Number(userId));
	const isAssignedToMe = Boolean(currentUser?.id && Number(userId) === Number(currentUser.id));
	const isAssignedToOther = isAssigned && !isAssignedToMe;

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
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
		<div ref={popoverRef} className="relative w-full min-w-0">
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

			{/* Floating Quick Assignment Popover */}
			{isOpen && (
				<div className={`absolute z-50 mt-1 w-56 sm:w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 whitespace-normal ${popoverAlign}`}>
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
						{(isAdmin && isAssigned) || (isAssignedToMe) ? (
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
								<button
									type="button"
									onClick={() => handleSelect(0)}
									className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition cursor-pointer"
								>
									<span className="italic text-slate-400">Unassign / Leave open</span>
									<X className="w-3.5 h-3.5 text-slate-400" />
								</button>
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
				</div>
			)}
		</div>
	);
}

import { useSearchParams } from "next/navigation";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useSubplatesQuery, useCreateSubplateMutation, useUpdateSubplateMutation, useDeleteSubplateMutation } from "@/lib/query/hooks";

function SubplatePageContent() {
	const { currentUser } = useAuth();
	const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
	const searchParams = useSearchParams();
	const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

	const { data, isLoading, error: fetchQueryError } = useSubplatesQuery();
	const createSubplateMutation = useCreateSubplateMutation();
	const updateSubplateMutation = useUpdateSubplateMutation();
	const deleteSubplateMutation = useDeleteSubplateMutation();

	const subplates = data?.subplates || [];
	const scans = data?.scans || [];
	const users = data?.users || [];
	const kpis = data?.kpis || { totalCount: 0, inHouseCount: 0, vendorCount: 0 };
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
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
	const [pageSize, setPageSize] = useState<number>(50);
	const [currentPage, setCurrentPage] = useState<number>(1);

	// Modal State for Add / Edit Subplate
	const [isModalOpen, setIsModalOpen] = useState(false);
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
	});

	// Toggle row expansion for detailed 9-stage stepper
	const toggleRow = (id: number) => {
		setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	// Helper to count completed stages on a subplate
	const countCompletedStages = (sp: Subplate) => {
		let count = 0;
		if (sp.design_by) count++;
		if (sp.order_by) count++;
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
		// Non-admin users can only assign to themselves (or unassign)
		if (!isAdmin && userId !== 0 && currentUser?.id && Number(userId) !== Number(currentUser.id)) {
			alert("Permission Notice: Non-admin users can only assign production tasks to themselves.");
			return;
		}

		const newUserId = userId === 0 ? null : userId;
		try {
			await updateSubplateMutation.mutateAsync({
				id: subplateId,
				updates: {
					[field]: newUserId,
				},
			});
		} catch (err: any) {
			alert("Stage Update Error: " + err.message);
		}
	};

 // Filter subplates
 const filteredSubplates = useMemo(() => {
 return subplates.filter((sp) => {
 const q = searchQuery.toLowerCase();
 const matchQuery =
 !searchQuery ||
 sp.platename?.toLowerCase().includes(q) ||
 sp.subprojectid?.toLowerCase().includes(q) ||
 String(sp.projectid)?.toLowerCase().includes(q);

 const matchMaterial =
 materialFilter === "ALL" || sp.material === materialFilter;

 const matchLocation =
 locationFilter === "ALL" ||
 (locationFilter === "SM"
 ? sp.location === "SM" || !sp.location
 : sp.location !== "SM" && sp.location);

 const matchProject =
 projectFilter === "ALL" || String(sp.projectid) === projectFilter;

 let matchStage = true;
 if (stageFilter === "completed") {
 matchStage = countCompletedStages(sp) === 9;
 } else if (stageFilter === "pending") {
 matchStage = countCompletedStages(sp) < 9;
 } else if (stageFilter !== "ALL") {
 matchStage = Boolean((sp as any)[stageFilter]);
 }

 return matchQuery && matchMaterial && matchLocation && matchProject && matchStage;
 });
 }, [subplates, searchQuery, materialFilter, locationFilter, projectFilter, stageFilter]);

 const totalPages = Math.ceil(filteredSubplates.length / pageSize) || 1;
 const paginatedSubplates = useMemo(() => {
 const start = (currentPage - 1) * pageSize;
 return filteredSubplates.slice(start, start + pageSize);
 }, [filteredSubplates, currentPage, pageSize]);

 // Auto-scroll and highlight matching search row
 const { getRowHighlightClass } = useTableHighlight(filteredSubplates, pageSize, setCurrentPage);

 // Handle Delete Subplate (Soft Delete)
 const handleDeleteSubplate = async (id: number, platename: string) => {
 if (!confirm(`Are you sure you want to delete subplate "${platename || `#${id}`}"? This will soft-delete the record.`)) {
 return;
 }
 try {
 await deleteSubplateMutation.mutateAsync(id);
 } catch (err: any) {
 alert("Error: " + err.message);
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

 // Handle Create Subplate (Live API POST)
 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!modalForm.platename || !modalForm.projectid) return;

 try {
 setIsSubmitting(true);
 await createSubplateMutation.mutateAsync(modalForm);
 setIsModalOpen(false);
 setModalForm({
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
 });
 } catch (err: any) {
 alert("Error: " + err.message);
 } finally {
 setIsSubmitting(false);
 }
 };

 const handleExportCSV = () => {
 const headers = [
 "ID",
 "Plate Name",
 "Project ID",
 "Subproject ID",
 "Shape",
 "Dimensions (LxWxH)",
 "Material",
 "Qty",
 "Location",
 ];
 const rows = filteredSubplates.map((sp) => [
 sp.id,
 `"${sp.platename}"`,
 sp.projectid,
 sp.subprojectid || "",
 sp.shape || "Plate",
 `"${sp.length}x${sp.width}x${sp.height} ${sp.unit || "mm"}"`,
 sp.material || "",
 sp.sqty || 1,
 sp.location || "SM",
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
						<button
							onClick={handleExportCSV}
							className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-xs text-xs sm:text-sm cursor-pointer"
						>
							<FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
							<span>Export CSV</span>
						</button>
						<button
							onClick={() => setIsModalOpen(true)}
							className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-xs shadow-blue-500/20 text-xs sm:text-sm cursor-pointer"
						>
							<Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
							<span>Add Subplate</span>
						</button>
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

 {/* Filter Controls */}
				<div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 w-full max-w-full min-w-0">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 w-full min-w-0">
						<div className="relative w-full sm:col-span-2 lg:col-span-1 lg:w-auto lg:min-w-[260px] min-w-0">
							<Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
							<input
								type="text"
								placeholder="Search by plate name, subproject ID, project..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition"
							/>
						</div>

						{/* Material Selector */}
						<div className="w-full lg:w-auto min-w-0">
							<select
								value={materialFilter}
								onChange={(e) => setMaterialFilter(e.target.value)}
								className="w-full lg:w-auto max-w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium truncate"
							>
								<option value="ALL">All Materials ({REAL_MATERIALS.length})</option>
								{REAL_MATERIALS.map((m) => (
									<option key={m} value={m}>
										{m}
									</option>
								))}
							</select>
						</div>

						{/* Location Selector */}
						<div className="w-full lg:w-auto min-w-0">
							<select
								value={locationFilter}
								onChange={(e) => setLocationFilter(e.target.value)}
								className="w-full lg:w-auto max-w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium truncate"
							>
								<option value="ALL">All Locations</option>
								<option value="SM">In-House Only (SM)</option>
								<option value="VENDOR">At Vendor Only</option>
							</select>
						</div>

						{/* Project Selector - Truncated option labels to prevent mobile blowout */}
						<div className="w-full lg:w-auto min-w-0">
							<select
								value={projectFilter}
								onChange={(e) => setProjectFilter(e.target.value)}
								className="w-full lg:w-auto max-w-full lg:max-w-[220px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium truncate"
							>
								<option value="ALL">All Projects ({scans.length})</option>
								{scans.map((s) => {
									const fullLabel = s.projectid ? `${s.projectid} - ${s.description || "Mould"}` : `Project #${s.id}`;
									const shortLabel = fullLabel.length > 30 ? `${fullLabel.substring(0, 30)}...` : fullLabel;
									return (
										<option key={s.id} value={String(s.id)} title={fullLabel}>
											{shortLabel}
										</option>
									);
								})}
							</select>
						</div>

						{/* 9-Stage Production Filter */}
						<div className="w-full lg:w-auto min-w-0">
							<select
								value={stageFilter}
								onChange={(e) => setStageFilter(e.target.value)}
								className="w-full lg:w-auto max-w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium truncate"
							>
								<option value="ALL">All Stages (9/9 Pipeline)</option>
								<option value="pending">In-Progress (&lt; 9 Stages Done)</option>
								<option value="completed">Completed (All 9 Stages Done)</option>
								<option value="design_by">1. Design Assigned</option>
								<option value="order_by">2. Mat. Order Assigned</option>
								<option value="received_workby">3. Mat. Inward Assigned</option>
								<option value="received_qcby">4. Inward QC Assigned</option>
								<option value="vmc_workby">5. VMC Machining Assigned</option>
								<option value="vmc_qcby">6. VMC QC Assigned</option>
								<option value="drilltap_workby">7. Drill &amp; Tap Assigned</option>
								<option value="final_qcby">8. Final QC Assigned</option>
								<option value="packing_workby">9. Packing Assigned</option>
							</select>
						</div>
					</div>
				</div>

				{/* Subplates Table */}
				<div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full max-w-full min-w-0">
					{/* Desktop Table View - Single-Screen Fit (No Horizontal Scroll Needed) */}
					<div className="hidden md:block w-full overflow-x-auto custom-scrollbar">
						<table className="w-full text-left border-collapse text-sm">
							<thead>
								<tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
									<th className="py-3.5 px-2 w-8 text-center"></th>
									<th className="py-3.5 px-3.5 min-w-[170px]">Subplate &amp; Project</th>
									<th className="py-3.5 px-3.5 min-w-[150px]">Specs &amp; Material</th>
									<th className="py-3.5 px-2 text-center w-24">Location</th>
									<th className="py-3.5 px-4 min-w-[360px] w-full">9-Stage Production Pipeline</th>
									<th className="py-3.5 px-3 text-right w-20">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{isLoading ? (
									<TableSkeletonRows rows={8} columns={6} />
								) : filteredSubplates.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="py-12 text-center text-slate-400 text-sm"
										>
											No subplates found matching your filter criteria.
										</td>
									</tr>
								) : (
									paginatedSubplates.map((row) => {
										const isExpanded = Boolean(expandedRows[row.id]);
										const completedCount = countCompletedStages(row);

										return (
											<React.Fragment key={row.id}>
												{/* Main Subplate Row */}
												<tr
													id={`row-${row.id}`}
													className={`hover:bg-slate-50/70 transition-all duration-300 group ${getRowHighlightClass(row.id)}`}
												>
													{/* Row Expand Toggle */}
													<td className="py-3 px-2 text-center">
														<button
															type="button"
															onClick={() => toggleRow(row.id)}
															className="p-1 rounded text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition cursor-pointer"
															title={isExpanded ? "Hide stage details" : "Expand stage studio"}
														>
															{isExpanded ? (
																<ChevronDown className="w-4 h-4 text-cyan-600" />
															) : (
																<ChevronRight className="w-4 h-4 text-slate-400" />
															)}
														</button>
													</td>

													{/* Subplate & Mould Identification */}
													<td className="py-3 px-3.5">
														<div className="flex items-baseline gap-1.5 flex-wrap">
															<span className="font-bold text-slate-900 text-sm">
																{row.platename}
															</span>
															<span className="font-mono text-[11px] text-slate-400">
																#{row.id}
															</span>
														</div>
														<div className="flex items-center gap-1.5 mt-0.5 text-xs">
															<span className="font-mono text-[11px] text-indigo-700 font-semibold px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-100">
																{(row as any).mould_project_code || row.projectid || "—"}
															</span>
															{row.subprojectid && (
																<span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
																	{row.subprojectid}
																</span>
															)}
														</div>
													</td>

													{/* Specs, Dimensions & Material */}
													<td className="py-3 px-3.5">
														<div className="font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
															{row.length || 0} × {row.width || 0} × {row.height || 0}{" "}
															<span className="text-[10px] font-normal text-slate-500 font-sans">
																{row.unit || "mm"}
															</span>
														</div>
														<div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[11px]">
															<span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
																{row.material || "MS-Bright"}
															</span>
															<span className="text-slate-500 font-medium">
																{row.sqty || 1} {Number(row.sqty) === 1 ? "pc" : "pcs"}
															</span>
															{row.shape && (
																<span className="text-slate-400 text-[10px]">
																	({row.shape})
																</span>
															)}
														</div>
													</td>

													{/* Location Badge */}
													<td className="py-3 px-2 text-center">
														<span
															className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
																row.location === "SM" || !row.location
																	? "bg-emerald-50 text-emerald-700 border border-emerald-200"
																	: "bg-amber-50 text-amber-700 border border-amber-200"
															}`}
														>
															<MapPin className="w-2.5 h-2.5" />
															{row.location || "SM"}
														</span>
													</td>

													{/* 9-Stage Production Tracking & Instant Assignment Chips */}
													<td className="py-3 px-4">
														<div className="space-y-2">
															{/* Stage progress meter + Quick Switch */}
															<div className="flex items-center justify-between gap-2">
																<div className="flex items-center gap-2">
																	<span
																		className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
																			completedCount === 9
																				? "bg-emerald-100 text-emerald-800 border border-emerald-300"
																				: completedCount > 0
																				? "bg-cyan-100 text-cyan-800 border border-cyan-200"
																				: "bg-slate-100 text-slate-600 border border-slate-200"
																		}`}
																	>
																		{completedCount === 9 ? (
																			<CheckCheck className="w-3 h-3 text-emerald-600" />
																		) : (
																			<Clock className="w-3 h-3 text-cyan-600" />
																		)}
																		{completedCount}/9 Assigned
																	</span>
																	{/* Mini progress bar */}
																	<div className="w-16 sm:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
																		<div
																			className={`h-full transition-all duration-300 ${
																				completedCount === 9 ? "bg-emerald-500" : "bg-cyan-500"
																			}`}
																			style={{ width: `${(completedCount / 9) * 100}%` }}
																		/>
																	</div>
																</div>

																<button
																	type="button"
																	onClick={() => toggleRow(row.id)}
																	className="text-[11px] text-cyan-600 hover:text-cyan-800 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer shrink-0"
																>
																	<span>{isExpanded ? "Hide Studio" : "Full Studio"}</span>
																	{isExpanded ? (
																		<ChevronDown className="w-3 h-3" />
																	) : (
																		<ChevronRight className="w-3 h-3" />
																	)}
																</button>
															</div>

															{/* 9 Compact Interactive Stage Chips spreading across full available width */}
															<div className="grid grid-cols-9 gap-1 sm:gap-1.5 w-full">
																{STAGE_DEFINITIONS.map((stage) => {
																	const val = (row as any)[stage.key];
																	const name = (row as any)[stage.nameKey];
																	const timestamp = (row as any)[stage.atKey];

																	return (
																		<StageChipPicker
																			key={stage.key}
																			subplateId={row.id}
																			stage={stage}
																			userId={val}
																			userName={name}
																			timestamp={timestamp}
																			staff={activeStaff}
																			currentUser={currentUser}
																			isAdmin={isAdmin}
																			onAssign={handleStageStaffChange}
																		/>
																	);
																})}
															</div>
														</div>
													</td>

													{/* Actions */}
													<td className="py-3 px-3 text-right whitespace-nowrap">
														<div className="flex items-center justify-end gap-1.5">
															<button
																type="button"
																onClick={() => toggleRow(row.id)}
																className="px-2.5 py-1 text-[11px] font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition cursor-pointer"
															>
																{isExpanded ? "Close" : "Track"}
															</button>
															<button
																type="button"
																onClick={() => handleDeleteSubplate(row.id, row.platename)}
																className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
																title="Delete subplate"
															>
																<Trash2 className="w-3.5 h-3.5" />
															</button>
														</div>
													</td>
												</tr>

												{/* Expanded 9-Stage Timeline Studio */}
												{isExpanded && (
													<tr className="bg-slate-50/90">
														<td colSpan={6} className="p-3 sm:p-4 border-y border-slate-200">
															<div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
																<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
																	<div className="flex items-center gap-2">
																		<div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg">
																			<Layers className="w-4 h-4" />
																		</div>
																		<div>
																			<h4 className="text-xs font-bold text-slate-900">
																				9-Stage Production Tracking Studio for &quot;{row.platename}&quot;
																			</h4>
																			<p className="text-[11px] text-slate-500">
																				{isAdmin
																					? "Click any stage to assign or change staff. Timestamp is recorded automatically."
																					: "Assign yourself to pending stages or manage your active assignments."}
																			</p>
																		</div>
																	</div>

																	<div className="flex items-center gap-2 text-xs">
																		<span className="font-semibold text-slate-600">
																			Progress: {completedCount}/9 Completed
																		</span>
																		<div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
																			<div
																				className="h-full bg-cyan-600 transition-all duration-300"
																				style={{ width: `${(completedCount / 9) * 100}%` }}
																			/>
																		</div>
																	</div>
																</div>

																{/* 9-Stage Cards Grid */}
																<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
																	{STAGE_DEFINITIONS.map((stage) => {
																		const val = (row as any)[stage.key];
																		const name = (row as any)[stage.nameKey];
																		const timestamp = (row as any)[stage.atKey];
																		const isAssigned = Boolean(val && val !== 0);
																		const isAssignedToMe = Boolean(currentUser?.id && Number(val) === Number(currentUser.id));
																		const isAssignedToOther = isAssigned && !isAssignedToMe;

																		return (
																			<div
																				key={stage.key}
																				className={`p-2.5 rounded-xl border transition space-y-2 flex flex-col justify-between ${
																					isAssigned
																						? "bg-cyan-50/50 border-cyan-200 shadow-2xs"
																						: "bg-slate-50/60 border-slate-200"
																				}`}
																			>
																				<div>
																					{/* Step Header */}
																					<div className="flex items-center justify-between gap-1 mb-1">
																						<span className="text-[10px] font-bold text-slate-500 uppercase">
																							Stage {stage.step}
																						</span>
																						{isAssigned ? (
																							<CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
																						) : (
																							<span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
																						)}
																					</div>
																					<div className="text-xs font-bold text-slate-800 leading-tight">
																						{stage.label.replace(/^\d+\.\s*/, "")}
																					</div>
																				</div>

																				{/* Staff Dropdown */}
																				<div className="space-y-1">
																					<label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
																						Assigned Staff
																					</label>
																					{!isAdmin && isAssignedToOther ? (
																						<div className="w-full px-2 py-1 text-xs rounded border border-slate-200 bg-slate-100 text-slate-600 flex items-center justify-between" title="Assigned to another team member (Admin only)">
																							<span className="truncate font-medium">{name || "Assigned"}</span>
																							<Lock className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
																						</div>
																					) : (
																						<select
																							value={val || 0}
																							onChange={(e) =>
																								handleStageStaffChange(
																									row.id,
																									stage.key,
																									Number(e.target.value)
																								)
																							}
																							className={`w-full px-2 py-1 text-xs rounded border transition focus:ring-1 focus:ring-cyan-500 cursor-pointer ${
																								isAssigned
																									? "bg-white border-cyan-300 font-semibold text-slate-900"
																									: "bg-white border-slate-200 text-slate-500"
																							}`}
																						>
																							<option value={0}>Unassigned</option>
																							{isAdmin ? (
																								activeStaff.map((u) => (
																									<option key={u.id} value={u.id}>
																										{u.name || u.initials} ({u.initials})
																									</option>
																								))
																							) : currentUser ? (
																								<option value={currentUser.id}>
																									{currentUser.name} (Myself)
																								</option>
																							) : null}
																						</select>
																					)}
																				</div>

																				{/* Timestamp Display */}
																				<div className="pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
																					{isAssigned && timestamp ? (
																						<div className="flex items-center gap-1 text-cyan-800 font-mono text-[9px]">
																							<Clock className="w-2.5 h-2.5 shrink-0" />
																							<span>{formatTimestamp(timestamp)}</span>
																						</div>
																					) : isAssigned ? (
																						<span className="text-cyan-700 text-[9px]">Assigned</span>
																					) : (
																						<span className="text-slate-400 italic text-[9px]">Pending</span>
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
									})
								)}
							</tbody>
						</table>
					</div>

					{/* Mobile Card-List Fallback (< md) */}
					<div className="block md:hidden p-3 space-y-3">
						{isLoading ? (
							<div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
								<Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
								<span>Loading subplates...</span>
							</div>
						) : filteredSubplates.length === 0 ? (
							<div className="py-8 text-center text-slate-400 text-xs">
								No subplates found matching your filter criteria.
							</div>
						) : (
							paginatedSubplates.map((row) => {
								const isExpanded = Boolean(expandedRows[row.id]);
								const completedCount = countCompletedStages(row);

								return (
									<div
										key={row.id}
										id={`m-row-${row.id}`}
										className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5 text-xs shadow-2xs transition-all duration-300 ${getRowHighlightClass(row.id)}`}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1.5">
												<span className="font-mono text-slate-400 text-[11px]">#{row.id}</span>
												<span className="font-bold text-slate-900">{row.platename}</span>
											</div>
											<div className="flex items-center gap-2">
												<span
													className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
														row.location === "SM" || !row.location
															? "bg-emerald-50 text-emerald-700 border border-emerald-200"
															: "bg-amber-50 text-amber-700 border border-amber-200"
													}`}
												>
													<MapPin className="w-2.5 h-2.5" />
													{row.location || "SM"}
												</span>
												<button
													type="button"
													onClick={() => handleDeleteSubplate(row.id, row.platename)}
													className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
													title="Delete subplate"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
											<div>
												<span className="text-slate-400">Project: </span>
												<span className="font-mono font-medium text-indigo-600 truncate block">
													{(row as any).mould_project_code || row.projectid || "—"}
												</span>
											</div>
											<div>
												<span className="text-slate-400">Material: </span>
												<span className="font-medium text-slate-700 block">
													{row.material || "MS-Bright"}
												</span>
											</div>
											<div>
												<span className="text-slate-400">Dims: </span>
												<span className="font-mono font-medium text-slate-700 block">
													{row.length || 0}×{row.width || 0}×{row.height || 0} {row.unit || "mm"}
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
												className="px-2.5 py-1 text-xs font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition"
											>
												{isExpanded ? "Hide Stages" : "Edit 9 Stages"}
											</button>
										</div>

										{/* Mobile Expanded Stepper */}
										{isExpanded && (
											<div className="mt-2 pt-2 border-t border-slate-200 space-y-2">
												{STAGE_DEFINITIONS.map((stage) => {
													const val = (row as any)[stage.key];
													const timestamp = (row as any)[stage.atKey];
													const isAssigned = Boolean(val && val !== 0);
													const isAssignedToMe = Boolean(currentUser?.id && Number(val) === Number(currentUser.id));
													const isAssignedToOther = isAssigned && !isAssignedToMe;

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
																	<div className="text-[9px] text-cyan-700 font-mono">
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
																color="cyan"
																placeholder="Unassigned"
															/>
														</div>
													);
												})}
											</div>
										)}
									</div>
								);
							})
						)}
					</div>

 {/* Pagination Controls */}
 {!isLoading && filteredSubplates.length > 0 && (
 <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/50">
 <div className="flex items-center gap-2">
 <span>Show</span>
 <select
 value={pageSize}
 onChange={(e) => {
 setPageSize(Number(e.target.value));
 setCurrentPage(1);
 }}
 className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 font-medium focus:ring-1 focus:ring-cyan-500"
 >
 <option value={25}>25</option>
 <option value={50}>50</option>
 <option value={100}>100</option>
 </select>
 <span>
 per page â€¢ Showing {((currentPage - 1) * pageSize) + 1} to{" "}
 {Math.min(currentPage * pageSize, filteredSubplates.length)} of {filteredSubplates.length} subplates
 </span>
 </div>

 <div className="flex items-center gap-1.5">
 <button
 onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
 title="Previous page"
 >
 <ChevronLeft className="w-4 h-4" />
 </button>

 <span className="px-3 py-1 font-semibold text-slate-700">
 Page {currentPage} of {totalPages}
 </span>

 <button
 onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
 className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
 title="Next page"
 >
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 )}

 <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
 <span>Showing {filteredSubplates.length} subplates</span>
 <span>All dimensions and material grades derived from factory inventory</span>
 </div>
 </div>

 {/* Modal: Add Subplate (Physics-based Spring Modal) */}
				<Modal
					isOpen={isModalOpen}
					onClose={() => setIsModalOpen(false)}
					maxWidth="xl"
					title={
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
								<Layers className="w-5 h-5 stroke-[2.2]" />
							</div>
							<div>
								<h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-snug truncate">
									Add New Subplate
								</h3>
								<p className="text-[11px] sm:text-xs text-slate-500 truncate">
									Define workpiece specifications & allocate to project
								</p>
							</div>
						</div>
					}
				>
					<form onSubmit={handleCreate} className="space-y-4">
						{/* Group 1: Workpiece Identification & Mould Assignment */}
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
									placeholder="e.g. Cavity Plate A-Side"
									value={modalForm.platename}
									onChange={(e) =>
										setModalForm({
											...modalForm,
											platename: e.target.value,
										})
									}
									className="w-full h-10 px-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-xs"
								/>
							</div>

							<div>
								<label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
									<Building2 className="w-3.5 h-3.5 text-indigo-600" />
									<span>Target Mould / Project</span>
									<span className="text-rose-500 font-bold">*</span>
								</label>
								<select
									required
									value={modalForm.projectid}
									onChange={(e) =>
										setModalForm({
											...modalForm,
											projectid: e.target.value,
										})
									}
									className="w-full max-w-full h-10 px-3.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-xs cursor-pointer truncate"
								>
									<option value="">Select Project</option>
									{scans.map((s) => {
										const fullDesc = s.description || "Untitled";
										const label = s.projectid ? `${s.projectid} â€” ${fullDesc}` : `Project #${s.id}`;
										const shortLabel = label.length > 35 ? `${label.substring(0, 35)}...` : label;
										return (
											<option key={s.id} value={s.projectid || String(s.id)} title={label}>
												{shortLabel}
											</option>
										);
									})}
								</select>
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
									<select
										value={modalForm.shape}
										onChange={(e) =>
											handleDimensionChange("shape", e.target.value)
										}
										className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
									>
										{SHAPES.map((s) => (
											<option key={s} value={s}>
												{s}
											</option>
										))}
									</select>
								</div>

								{/* Material (5 cols) */}
								<div className="sm:col-span-5">
									<label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
										<span className="flex items-center gap-1.5">
											<Wrench className="w-3.5 h-3.5 text-amber-600" />
											<span>Material</span>
										</span>
										<span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200/60">
											{MATERIAL_DENSITIES[modalForm.material] || 7.81} g/cmÂ³
										</span>
									</label>
									<select
										value={modalForm.material}
										onChange={(e) =>
											handleDimensionChange("material", e.target.value)
										}
										className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
									>
										{REAL_MATERIALS.map((m) => (
											<option key={m} value={m}>
												{m}
											</option>
										))}
									</select>
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
										{modalForm.shape === "Round Bar"
											? "Length Ã— Diameter"
											: "Length Ã— Width Ã— Height / Thickness"}
									</span>
								</div>
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
												{heightDisabled ? "â€”" : "H"}
											</span>
										</div>
									</div>
									<div>
										<select
											value={modalForm.unit}
											onChange={(e) =>
												handleDimensionChange("unit", e.target.value)
											}
											className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
										>
											{SUPPORTED_UNITS.map((u) => (
												<option key={u} value={u}>
													Unit: {u}
												</option>
											))}
										</select>
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
											{modalForm.sqty} pcs Ã— {(Number(modalForm.weight) / Number(modalForm.sqty)).toFixed(3)} kg
										</span>
										<span className="text-slate-300 font-sans font-semibold">Total Batch Wt</span>
									</div>
								) : (
									<div className="mt-1 text-[10px] text-slate-400 relative z-10">
										Based on {modalForm.material} density @ {MATERIAL_DENSITIES[modalForm.material] || 7.81} g/cmÂ³
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
									<select
										value={modalForm.location}
										onChange={(e) =>
											setModalForm({ ...modalForm, location: e.target.value })
										}
										className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs cursor-pointer"
									>
										<option value="SM">SM â€” In-House Production</option>
										<option value="Vendor">Vendor â€” Outward Jobwork</option>
									</select>
								</div>
								<div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
									<span
										className={"w-2 h-2 rounded-full shrink-0 " + (
											modalForm.location === "SM"
												? "bg-emerald-500"
												: "bg-amber-500"
										)}
									/>
									<span>
										{modalForm.location === "SM"
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
									onClick={() => setIsModalOpen(false)}
									className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold"
								>
									Cancel
								</MotionButton>
								<MotionButton
									type="submit"
									variant="primary"
									disabled={isSubmitting || !modalForm.platename || !modalForm.projectid}
									isLoading={isSubmitting}
									loadingText="Saving..."
									successText="Subplate Saved!"
									className="flex-1 sm:flex-initial h-10 px-4 sm:px-5 rounded-xl text-xs font-semibold shadow-sm"
								>
									<Plus className="w-4 h-4" />
									<span>Save Subplate</span>
								</MotionButton>
							</div>
						</div>
					</form>
				</Modal>
 </div>
 </AppLayout>
 );
}

export default function SubplatePage() {
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
