"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
    ShoppingCart,
    Plus,
    Search,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    FileSpreadsheet,
    Printer,
    Trash2,
    Edit2,
    Calendar,
    Building2,
    Layers,
    AlertCircle,
    CheckCircle2,
    Clock,
    X,
    PackagePlus,
    ArrowUpRight,
    Filter,
    ExternalLink,
    Scale,
    Boxes,
    CheckSquare,
    Square,
    LayoutGrid,
    List,
    Sparkles,
    RotateCcw,
    AlertTriangle,
    RefreshCw,
    ShieldAlert,
    Lock,
} from "lucide-react";
import type {
    PurchaseOrder,
    PurchaseItem,
    Subplate,
    Customer,
    ScanProject,
} from "@/lib/supabase/types";
import { TableSkeletonRows } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { ERPSelect } from "@/components/ui/erp-select";
import { MotionButton } from "@/components/ui/motion-button";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useIsRestoring } from "@tanstack/react-query";
import {
    usePurchasesQuery,
    useCreatePurchaseMutation,
    useUpdatePurchaseMutation,
    useDeletePurchaseMutation,
    useSubplatesByProjectQuery,
    useCustomerDropdownQuery,
    useVendorDropdownQuery,
} from "@/lib/query/hooks";
import {
    formatSubplateDimensions,
    calculateSubplateWeight,
} from "@/lib/weight-calculator";

function PurchasePageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlSearch = searchParams.get("search") || searchParams.get("q") || "";
    const tabParam = searchParams.get("tab");
    const mouldParam = searchParams.get("mould") || "";
    const shouldCreate = searchParams.get("create") === "true";

    const isRestoring = useIsRestoring();
    const { data, isLoading: queryLoading, refetch, isFetching } = usePurchasesQuery({
        limit: 200,
        includePlates: true,
    });
    const { data: vendorLookup = [] } = useVendorDropdownQuery("Supplier");
    const { data: customerLookup = [] } = useCustomerDropdownQuery("Customer");
    const createPurchaseMutation = useCreatePurchaseMutation();
    const updatePurchaseMutation = useUpdatePurchaseMutation();
    const deletePurchaseMutation = useDeletePurchaseMutation();

    const purchases = (data?.purchases || []) as PurchaseOrder[];
    const subplates = (data?.subplates || []) as Subplate[];
    const customers = (data?.customers || []) as Customer[];
    const scans = (data?.scans || []) as ScanProject[];
    const hasLoadedData = purchases.length > 0 || (!!data && !queryLoading);
    const isLoading = isRestoring || (!hasLoadedData && queryLoading);

    // Navigation Tabs: All Purchase Orders vs. Pending Purchase (needing PO)
    const [activeTab, setActiveTab] = useState<"orders" | "pending_plates">(
        tabParam === "pending" || tabParam === "pending_plates"
            ? "pending_plates"
            : "orders",
    );
    const [searchQuery, setSearchQuery] = useState(urlSearch);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Sync tab when search params change in URL
    useEffect(() => {
        const currentTabParam = searchParams.get("tab");
        const nextTab: "orders" | "pending_plates" =
            currentTabParam === "pending" || currentTabParam === "pending_plates"
                ? "pending_plates"
                : "orders";
        setActiveTab((prev) => (prev !== nextTab ? nextTab : prev));
    }, [searchParams]);

    const handleTabChange = useCallback(
        (tab: "orders" | "pending_plates") => {
            setActiveTab(tab);
            setCurrentPage(1);
            if (tab === "pending_plates") {
                refetch();
            }
            const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
            if (tab === "pending_plates") {
                params.set("tab", "pending");
            } else {
                params.delete("tab");
            }
            const queryString = params.toString();
            router.replace(queryString ? `/purchase?${queryString}` : "/purchase", { scroll: false });
        },
        [searchParams, router, refetch]
    );

    // Sync URL search query
    useEffect(() => {
        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [urlSearch]);

    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>(
        {},
    );

    // Pending Purchase view mode, filter & multi-select batch state
    const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
    const [mouldFilter, setMouldFilter] = useState<string>(mouldParam || "ALL");
    const [materialFilter, setMaterialFilter] = useState<string>("ALL");
    const [selectedPlateIds, setSelectedPlateIds] = useState<number[]>([]);
    const [collapsedMoulds, setCollapsedMoulds] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (mouldParam) {
            setMouldFilter(mouldParam);
        }
    }, [mouldParam]);

    const toggleCollapseMould = (mouldCode: string) => {
        setCollapsedMoulds((prev) => ({
            ...prev,
            [mouldCode]: !prev[mouldCode],
        }));
    };

    // Add / Edit Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
    const [selectedMould, setSelectedMould] = useState("");

    // Open Voucher directly in new tab with secure print token
    const handleOpenVoucherTab = async (po: PurchaseOrder) => {
        // Pre-open window synchronously to prevent mobile popup blockers
        const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
        try {
            const res = await fetch("/api/print-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "purchase", id: po.id }),
            });
            if (res.ok) {
                const data = await res.json();
                const targetUrl = data.url || `/print/purchase/${po.id}`;
                if (win) {
                    win.location.href = targetUrl;
                } else {
                    window.open(targetUrl, "_blank", "noopener,noreferrer");
                }
            } else {
                // Fallback
                const fallbackUrl = `/print/purchase/${po.id}`;
                if (win) {
                    win.location.href = fallbackUrl;
                } else {
                    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
                }
            }
        } catch {
            const fallbackUrl = `/print/purchase/${po.id}`;
            if (win) {
                win.location.href = fallbackUrl;
            } else {
                window.open(fallbackUrl, "_blank", "noopener,noreferrer");
            }
        }
    };
    const [formData, setFormData] = useState<{
        odate: string;
        vname: number | "";
        cname: number | "";
        projectid: string;
        items: {
            id?: number;
            plateid: number | "";
            material: string;
            materialtype: string;
            qty: number;
            rate?: number | "" | null;
        }[];
    }>({
        odate: new Date().toISOString().slice(0, 10),
        vname: "",
        cname: "",
        projectid: "",
        items: [{ plateid: "", material: "", materialtype: "", qty: 1, rate: "" }],
    });

    const [formError, setFormError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(
        null,
    );

    // Filtered vendor and customer lists matching legacy query
    // Source: PurchaseController.php index() lines 27-33: usertype='Vendor', usertype='Customer'
    const vendors = useMemo(() => {
        return (vendorLookup || []).map((v: any) => ({ ...v, customername: v.vendor_name }));
    }, [vendorLookup]);
    const clients = useMemo(
        () => (customerLookup.length > 0 ? customerLookup : customers).filter((c: any) => c.usertype === "Customer" || !c.usertype),
        [customerLookup, customers],
    );

    // Available moulds for the selected customer in Add modal
    // Supports scan.customer_id, scan.cname numeric ID, or exact customername string
    const availableMoulds = useMemo(() => {
        if (!formData.cname) return [];
        const selectedCustomer = clients.find((c: any) => c.id === Number(formData.cname));
        const selectedCustName = selectedCustomer?.customername?.toLowerCase().trim();

        return scans.filter((s) => {
            if (s.status === "completed") return false;
            const scanCustId = s.customer_id ? Number(s.customer_id) : (s.cname && !isNaN(Number(s.cname)) ? Number(s.cname) : null);
            // Match by numeric customer ID
            if (scanCustId !== null && scanCustId === Number(formData.cname)) return true;
            // Match by customer name string
            if (selectedCustName && String(s.cname || "").toLowerCase().trim() === selectedCustName) return true;
            return false;
        });
    }, [scans, formData.cname, clients]);

    const vendorOptions = useMemo(() => {
        return vendors.map((v: any) => ({
            value: v.id,
            label: v.vendor_name || v.customername || `Vendor #${v.id}`,
            badge: v.initials || undefined,
            badgeVariant: "purple" as const,
            subtitle: v.mobile || undefined,
        }));
    }, [vendors]);

    const customerOptions = useMemo(() => {
        return clients.map((c: any) => ({
            value: c.id,
            label: c.customername,
            badge: c.initials || undefined,
            badgeVariant: "blue" as const,
            subtitle: c.city || undefined,
        }));
    }, [clients]);

    const mouldOptions = useMemo(() => {
        const list = [...availableMoulds];
        // Ensure that if formData.projectid is already preset (e.g. from + PO for Mould), it is always included
        if (formData.projectid && !list.some((s) => s.projectid === formData.projectid)) {
            const foundScan = scans.find((s) => s.projectid === formData.projectid);
            if (foundScan) {
                list.push(foundScan);
            } else {
                list.push({ projectid: formData.projectid, description: "" } as any);
            }
        }
        return list.map((s: any) => ({
            value: s.projectid || "",
            label: s.projectid || "",
            subtitle: s.description || undefined,
        }));
    }, [availableMoulds, formData.projectid, scans]);

    // Selected scan for subplate resolution
    const selectedScan = useMemo(() => {
        if (!formData.projectid) return null;
        return scans.find(
            (s) =>
                s.projectid === formData.projectid ||
                String(s.id) === formData.projectid,
        );
    }, [scans, formData.projectid]);

    const lookupProjectId = selectedScan ? selectedScan.id : (formData.projectid || undefined);
    const { data: dynamicSubplates = [] } = useSubplatesByProjectQuery(lookupProjectId);

    const allSubplates = useMemo(() => {
        const map = new Map<number, Subplate>();
        subplates.forEach((s) => map.set(s.id, s));
        dynamicSubplates.forEach((s) => map.set(s.id, s));
        return Array.from(map.values());
    }, [subplates, dynamicSubplates]);

    // Subplates matching the selected mould in Add modal
    // Source: CustomerController.php:294-297 (getprojectsubplates):
    // ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')->where('scan.projectid', $request->projectid)
    const platesForSelectedProject = useMemo(() => {
        if (!formData.projectid) return [];
        const scanIdStr = selectedScan ? String(selectedScan.id) : "";
        return allSubplates.filter(
            (sp) =>
                (scanIdStr && String(sp.projectid) === scanIdStr) ||
                (selectedScan && sp.mold_id && sp.mold_id === selectedScan.id) ||
                (sp.mold_code && sp.mold_code === formData.projectid) ||
                String(sp.projectid) === formData.projectid ||
                (sp.subprojectid &&
                    sp.subprojectid.includes(formData.projectid)),
        );
    }, [allSubplates, formData.projectid, selectedScan]);

    // Distinct projects available from scans & purchases for table filters
    const availableProjects = useMemo(() => {
        const set = new Set<string>();
        scans.forEach((s) => {
            if (s.projectid) set.add(s.projectid);
        });
        purchases.forEach((p) => {
            if (p.projectid) set.add(p.projectid);
        });
        return Array.from(set);
    }, [scans, purchases]);

    // Map of plate ID -> already ordered quantity in active POs
    const orderedQtyByPlateId = useMemo(() => {
        const map = new Map<number, number>();
        purchases.forEach((p) => {
            if (String(p.status) !== "0" && (p as any).status !== 0 && p.items) {
                // If editing an existing PO, exclude that PO's items from the subtracted quantity
                if (editingPO && p.id === editingPO.id) return;
                p.items.forEach((item: PurchaseItem) => {
                    const pid = Number(item.plateid);
                    const q = Number(item.qty) || 0;
                    map.set(pid, (map.get(pid) || 0) + q);
                });
            }
        });
        return map;
    }, [purchases, editingPO]);

    // Helper to calculate exact remaining quantity for any subplate
    const getPlateRemainingQty = useCallback(
        (plateId: number | string | undefined | null) => {
            if (!plateId) return null;
            const numId = Number(plateId);
            const sp = allSubplates.find((p) => p.id === numId);
            if (!sp) return null;
            const total = Number(sp.sqty) || 1;
            // Use API remaining_qty if present and not editing, or compute using orderedQtyByPlateId
            const ordered = orderedQtyByPlateId.get(numId) ?? (sp.ordered_qty ?? 0);
            return Math.max(0, total - ordered);
        },
        [allSubplates, orderedQtyByPlateId],
    );

    // Pending Purchase List Logic
    // Subplates that still have positive remaining quantity to procure (remaining_qty > 0)
    const pendingPlates = useMemo(() => {
        return allSubplates.filter((sp) => {
            const rem = getPlateRemainingQty(sp.id);
            return rem === null || rem > 0;
        });
    }, [allSubplates, getPlateRemainingQty]);

    // Subplate dropdown options for the currently selected mould
    const subplateOptions = useMemo(() => {
        return platesForSelectedProject.map((sp) => {
            const remQty = getPlateRemainingQty(sp.id);
            const isFullyOrdered = remQty !== null && remQty <= 0;
            return {
                value: sp.id,
                label: sp.platename,
                badge: remQty !== null ? `Rem: ${remQty} / Req: ${sp.sqty}` : `Qty: ${sp.sqty}`,
                badgeVariant: remQty !== null && remQty > 0 ? ("amber" as const) : ("slate" as const),
                disabled: isFullyOrdered,
                disabledReason: isFullyOrdered ? "Fully Ordered" : undefined,
            };
        });
    }, [platesForSelectedProject, getPlateRemainingQty]);

    // Toggle row expansion for child items
    const toggleRow = (id: number) => {
        setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Helper names lookup
    const getCustomerName = (id: number) => {
        const found = customers.find((c) => c.id === id);
        return found ? found.customername : `ID: ${id}`;
    };

    const getVendorName = (id: number) => {
        const found = (vendorLookup || []).find((v) => v.id === id);
        return found ? found.vendor_name : `Vendor #${id}`;
    };

    const getSubplateName = (id: number) => {
        const found = allSubplates.find((sp) => sp.id === id);
        return found ? found.platename : `Plate #${id}`;
    };

    // Helper to resolve scan project, customer details, and mould code for any subplate
    const getPlateScanAndCustomer = useCallback(
        (sp: Subplate) => {
            const matchingScan = scans.find(
                (s) =>
                    (sp.mold_id && s.id === sp.mold_id) ||
                    (sp.mold_code && s.projectid === sp.mold_code) ||
                    String(s.id) === String(sp.projectid) ||
                    s.projectid === sp.projectid,
            );
            const mouldCode = sp.mold_code || matchingScan?.projectid || sp.projectid || "Unassigned";

            // Resolve customer ID from scan (checking customer_id, numeric cname, or customer name lookup)
            let rawCustId: number | null = null;
            if (matchingScan?.customer_id) {
                rawCustId = Number(matchingScan.customer_id);
            } else if (matchingScan?.cname && !isNaN(Number(matchingScan.cname))) {
                rawCustId = Number(matchingScan.cname);
            }

            const customer = rawCustId
                ? clients.find((c: any) => c.id === rawCustId)
                : matchingScan?.cname
                  ? clients.find(
                        (c: any) =>
                            c.customername?.toLowerCase().trim() ===
                            String(matchingScan.cname).toLowerCase().trim(),
                    )
                  : null;

            const resolvedCustId = rawCustId || (customer ? customer.id : null);
            const custName =
                customer?.customername ||
                (matchingScan as any)?.customername ||
                matchingScan?.cname ||
                (resolvedCustId ? `Customer #${resolvedCustId}` : "Direct / In-House");

            return {
                scan: matchingScan,
                mouldCode,
                custId: resolvedCustId,
                custName,
                description: matchingScan?.description || "",
                worktype: matchingScan?.worktype || "",
            };
        },
        [scans, clients],
    );

    // Color-coded material badge classes for instant visual classification
    const getMaterialBadgeClass = (material?: string | null) => {
        const mat = (material || "").toUpperCase();
        if (mat.includes("EN8") || mat.includes("EN-8"))
            return "bg-blue-50 text-blue-700 border-blue-200";
        if (mat.includes("C45") || mat.includes("C-45"))
            return "bg-indigo-50 text-indigo-700 border-indigo-200";
        if (mat.includes("D2") || mat.includes("D-2"))
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (mat.includes("MS-BRIGHT") || mat.includes("BRIGHT"))
            return "bg-amber-50 text-amber-800 border-amber-200";
        if (mat.includes("MS-BLACK") || mat.includes("BLACK"))
            return "bg-slate-100 text-slate-800 border-slate-300";
        if (mat.includes("ALUM"))
            return "bg-cyan-50 text-cyan-700 border-cyan-200";
        if (mat.includes("P20") || mat.includes("P-20"))
            return "bg-purple-50 text-purple-700 border-purple-200";
        return "bg-slate-50 text-slate-700 border-slate-200";
    };

    // Filtered PO records
    const filteredPurchases = useMemo(() => {
        return purchases.filter((p) => {
            if (String(p.status) === "0" || (p as any).status === 0)
                return false; // Soft deleted
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            const vendorName = getVendorName(p.vname).toLowerCase();
            const clientName = getCustomerName(p.cname).toLowerCase();
            return (
                p.srno.toLowerCase().includes(q) ||
                p.projectid.toLowerCase().includes(q) ||
                vendorName.includes(q) ||
                clientName.includes(q) ||
                (p.created_by && p.created_by.toLowerCase().includes(q))
            );
        });
    }, [purchases, searchQuery]);

    // Filtered Pending Plates with search query, mould filter, and material filter
    const filteredPendingPlates = useMemo(() => {
        return pendingPlates.filter((sp) => {
            const { mouldCode, custName } = getPlateScanAndCustomer(sp);

            if (mouldFilter !== "ALL" && mouldCode !== mouldFilter) return false;
            if (materialFilter !== "ALL" && (sp.material || "").trim() !== materialFilter) return false;

            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                sp.platename.toLowerCase().includes(q) ||
                mouldCode.toLowerCase().includes(q) ||
                custName.toLowerCase().includes(q) ||
                (sp.material && sp.material.toLowerCase().includes(q)) ||
                (sp.subprojectid && sp.subprojectid.toLowerCase().includes(q))
            );
        });
    }, [pendingPlates, searchQuery, mouldFilter, materialFilter, getPlateScanAndCustomer]);

    // KPI metrics across all pending plates
    const pendingMetrics = useMemo(() => {
        let totalWeightKg = 0;
        let totalPendingUnits = 0;
        const distinctMoulds = new Set<string>();
        const materialCounts: Record<string, number> = {};

        pendingPlates.forEach((sp) => {
            const rem = getPlateRemainingQty(sp.id) ?? sp.sqty ?? 1;
            totalPendingUnits += rem;

            const { mouldCode } = getPlateScanAndCustomer(sp);
            if (mouldCode) distinctMoulds.add(mouldCode);

            const mat = sp.material?.trim() || "Unspecified";
            materialCounts[mat] = (materialCounts[mat] || 0) + rem;

            const w = calculateSubplateWeight({
                shape: sp.shape || "Rectangle",
                material: sp.material || "",
                length: sp.length ?? undefined,
                width: sp.width ?? undefined,
                height: sp.height ?? undefined,
                unit: sp.unit || "mm",
                quantity: rem,
            });
            totalWeightKg += w;
        });

        // Sorted material breakdown (top materials)
        const sortedMaterials = Object.entries(materialCounts).sort((a, b) => b[1] - a[1]);

        return {
            totalPlates: pendingPlates.length,
            totalUnits: totalPendingUnits,
            totalMoulds: distinctMoulds.size,
            totalWeightKg: Math.round(totalWeightKg * 10) / 10,
            sortedMaterials,
        };
    }, [pendingPlates, getPlateRemainingQty, getPlateScanAndCustomer]);

    // Distinct Moulds with pending plates for filter dropdown
    const pendingMouldOptions = useMemo(() => {
        const mouldsMap = new Map<string, number>();
        pendingPlates.forEach((sp) => {
            const { mouldCode } = getPlateScanAndCustomer(sp);
            mouldsMap.set(mouldCode, (mouldsMap.get(mouldCode) || 0) + 1);
        });
        return Array.from(mouldsMap.entries()).map(([code, count]) => ({
            code,
            count,
        }));
    }, [pendingPlates, getPlateScanAndCustomer]);

    // Distinct Materials for filter dropdown
    const pendingMaterialOptions = useMemo(() => {
        const mats = new Map<string, number>();
        pendingPlates.forEach((sp) => {
            const mat = sp.material?.trim() || "Unspecified";
            mats.set(mat, (mats.get(mat) || 0) + 1);
        });
        return Array.from(mats.entries()).map(([name, count]) => ({
            name,
            count,
        }));
    }, [pendingPlates]);

    // Group pending plates by mould project for Grouped View
    const pendingByMould = useMemo(() => {
        const groups: Record<
            string,
            {
                mouldCode: string;
                scan: ScanProject | undefined;
                customerName: string;
                customerId: number | null;
                description: string;
                plates: Subplate[];
                totalPendingUnits: number;
                totalWeightKg: number;
            }
        > = {};

        filteredPendingPlates.forEach((sp) => {
            const { mouldCode, scan, custName, custId, description } = getPlateScanAndCustomer(sp);
            if (!groups[mouldCode]) {
                groups[mouldCode] = {
                    mouldCode,
                    scan,
                    customerName: custName,
                    customerId: custId,
                    description,
                    plates: [],
                    totalPendingUnits: 0,
                    totalWeightKg: 0,
                };
            }
            const rem = getPlateRemainingQty(sp.id) ?? sp.sqty ?? 1;
            const w = calculateSubplateWeight({
                shape: sp.shape || "Rectangle",
                material: sp.material || "",
                length: sp.length ?? undefined,
                width: sp.width ?? undefined,
                height: sp.height ?? undefined,
                unit: sp.unit || "mm",
                quantity: rem,
            });
            groups[mouldCode].plates.push(sp);
            groups[mouldCode].totalPendingUnits += rem;
            groups[mouldCode].totalWeightKg += w;
        });

        return Object.values(groups).sort((a, b) => b.plates.length - a.plates.length);
    }, [filteredPendingPlates, getPlateScanAndCustomer, getPlateRemainingQty]);

    // Batch Selection calculations
    const selectedPlates = useMemo(() => {
        const set = new Set(selectedPlateIds);
        return pendingPlates.filter((sp) => set.has(sp.id));
    }, [selectedPlateIds, pendingPlates]);

    const selectedPlatesMoulds = useMemo(() => {
        const set = new Set<string>();
        selectedPlates.forEach((sp) => {
            const { mouldCode } = getPlateScanAndCustomer(sp);
            set.add(mouldCode);
        });
        return Array.from(set);
    }, [selectedPlates, getPlateScanAndCustomer]);

    const isSingleMouldSelected = selectedPlatesMoulds.length === 1;

    const selectedTotalWeightKg = useMemo(() => {
        return (
            Math.round(
                selectedPlates.reduce((acc, sp) => {
                    const rem = getPlateRemainingQty(sp.id) ?? sp.sqty ?? 1;
                    return (
                        acc +
                        calculateSubplateWeight({
                            shape: sp.shape || "Rectangle",
                            material: sp.material || "",
                            length: sp.length ?? undefined,
                            width: sp.width ?? undefined,
                            height: sp.height ?? undefined,
                            unit: sp.unit || "mm",
                            quantity: rem,
                        })
                    );
                }, 0) * 10,
            ) / 10
        );
    }, [selectedPlates, getPlateRemainingQty]);

    const toggleSelectPlate = (id: number) => {
        setSelectedPlateIds((prev) =>
            prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
        );
    };

    const toggleSelectMouldPlates = (plates: Subplate[]) => {
        const plateIds = plates.map((p) => p.id);
        const allSelected = plateIds.every((id) => selectedPlateIds.includes(id));
        if (allSelected) {
            setSelectedPlateIds((prev) => prev.filter((id) => !plateIds.includes(id)));
        } else {
            setSelectedPlateIds((prev) => Array.from(new Set([...prev, ...plateIds])));
        }
    };

    const clearSelectedPlates = () => {
        setSelectedPlateIds([]);
    };

    const selectOnlyMould = (targetMould: string) => {
        const platesForMould = pendingPlates.filter((sp) => {
            const { mouldCode } = getPlateScanAndCustomer(sp);
            return mouldCode === targetMould;
        });
        setSelectedPlateIds(platesForMould.map((p) => p.id));
    };

    // Pagination
    const totalPages =
        activeTab === "orders"
            ? Math.ceil(filteredPurchases.length / pageSize) || 1
            : Math.ceil(filteredPendingPlates.length / pageSize) || 1;

    const paginatedPurchases = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPurchases.slice(start, start + pageSize);
    }, [filteredPurchases, currentPage, pageSize]);

    const paginatedPendingPlates = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPendingPlates.slice(start, start + pageSize);
    }, [filteredPendingPlates, currentPage, pageSize]);

    // Auto-scroll and highlight matching search row
    const { getRowHighlightClass } = useTableHighlight(filteredPurchases, pageSize, setCurrentPage);

    // Add line item row to PO
    const handleAddPlateRow = () => {
        setFormData((prev) => ({
            ...prev,
            items: [
                ...prev.items,
                { plateid: "", material: "", materialtype: "", qty: 1, rate: "" },
            ],
        }));
    };

    // Remove line item row
    const handleRemovePlateRow = (index: number) => {
        if (formData.items.length <= 1) return;
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
        }));
    };

    // Update specific item field
    const handleUpdateItem = (
        index: number,
        field: "plateid" | "material" | "materialtype" | "qty" | "rate",
        value: string | number,
    ) => {
        setFormData((prev) => {
            const updated = [...prev.items];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, items: updated };
        });
    };

    // Select plate handler: auto-populates readonly materialtype & prefilled dimensions
    const handleSelectPlate = (index: number, plateId: number | "") => {
        if (plateId === "") {
            setFormData((prev) => {
                const updated = [...prev.items];
                updated[index] = {
                    ...updated[index],
                    plateid: "",
                    material: "",
                    materialtype: "",
                    qty: 1,
                };
                return { ...prev, items: updated };
            });
            return;
        }
        const foundPlate = allSubplates.find(
            (sp: Subplate) => sp.id === Number(plateId),
        );
        const remQty = getPlateRemainingQty(plateId);
        const defaultQty = remQty !== null && remQty > 0 ? remQty : (foundPlate?.sqty || 1);

        setFormData((prev) => {
            const updated = [...prev.items];
            if (foundPlate) {
                const formattedDims = formatSubplateDimensions(foundPlate);
                const dims =
                    formattedDims !== "—"
                        ? formattedDims
                        : [
                              foundPlate.width ?? "",
                              foundPlate.height ?? "",
                              foundPlate.length ?? "",
                          ]
                              .filter(Boolean)
                              .join(" x ") +
                          (foundPlate.unit ? ` ${foundPlate.unit}` : " mm");

                updated[index] = {
                    ...updated[index],
                    plateid: foundPlate.id,
                    materialtype: foundPlate.material || "",
                    material: dims,
                    qty: defaultQty,
                };
            } else {
                updated[index] = {
                    ...updated[index],
                    plateid: Number(plateId),
                    qty: defaultQty,
                };
            }
            return { ...prev, items: updated };
        });
    };

    // Open modal for creating PO (supports single subplate or multiple subplates array, plus optional presetMouldCode)
    const handleOpenAddModal = useCallback(
        (presetPlates?: Subplate | Subplate[], presetMouldCode?: string) => {
            setEditingPO(null);
            const platesArray: Subplate[] = presetPlates
                ? Array.isArray(presetPlates)
                    ? presetPlates
                    : [presetPlates]
                : [];

            let defaultMould = presetMouldCode || "";
            let defaultCustomer: number | "" = "";

            if (platesArray.length > 0) {
                const firstPlate = platesArray[0];
                const { mouldCode, custId } = getPlateScanAndCustomer(firstPlate);
                defaultMould = mouldCode !== "Unassigned" ? mouldCode : (presetMouldCode || "");
                defaultCustomer = custId !== null && !isNaN(Number(custId)) ? Number(custId) : "";
            } else if (presetMouldCode) {
                const matchingScan = scans.find((s) => s.projectid === presetMouldCode);
                if (matchingScan) {
                    let rawCustId: number | null = null;
                    if (matchingScan.customer_id) {
                        rawCustId = Number(matchingScan.customer_id);
                    } else if (matchingScan.cname && !isNaN(Number(matchingScan.cname))) {
                        rawCustId = Number(matchingScan.cname);
                    }
                    const customer = rawCustId
                        ? clients.find((c: any) => c.id === rawCustId)
                        : matchingScan?.cname
                          ? clients.find(
                                (c: any) =>
                                    c.customername?.toLowerCase().trim() ===
                                    String(matchingScan.cname).toLowerCase().trim(),
                            )
                          : null;
                    const resolvedCustId = rawCustId || (customer ? customer.id : null);
                    defaultCustomer = resolvedCustId || "";
                }
            }

            const items =
                platesArray.length > 0
                    ? platesArray.map((sp) => {
                          const remQty = getPlateRemainingQty(sp.id);
                          const initialQty =
                              remQty !== null && remQty > 0
                                  ? remQty
                                  : sp.sqty || 1;
                          const formattedDims = formatSubplateDimensions(sp);
                          const dims =
                              formattedDims !== "—"
                                  ? formattedDims
                                  : [
                                        sp.length ?? "",
                                        sp.width ?? "",
                                        sp.height ?? "",
                                    ]
                                        .filter(Boolean)
                                        .join(" x ") +
                                    (sp.unit ? ` ${sp.unit}` : " mm");

                          return {
                              plateid: sp.id,
                              material: dims,
                              materialtype: sp.material || "",
                              qty: initialQty,
                              rate: "" as const,
                          };
                      })
                    : [
                          {
                              plateid: "" as const,
                              material: "",
                              materialtype: "",
                              qty: 1,
                              rate: "" as const,
                          },
                      ];

            setFormData({
                odate: new Date().toISOString().slice(0, 10),
                vname: "",
                cname: defaultCustomer,
                projectid: defaultMould,
                items,
            });
            setFormError(null);
            setIsModalOpen(true);
        },
        [getPlateScanAndCustomer, getPlateRemainingQty, scans, clients],
    );

    // Automatically trigger Add PO modal when routed from Mould Table (?tab=pending&mould=...&create=true)
    const handledCreateRef = useRef(false);
    useEffect(() => {
        if (!shouldCreate || handledCreateRef.current || !hasLoadedData) return;
        handledCreateRef.current = true;

        if (mouldParam) {
            // Find all pending plates belonging to this mould
            const mouldPlates = pendingPlates.filter((sp) => {
                const { mouldCode } = getPlateScanAndCustomer(sp);
                return mouldCode === mouldParam;
            });
            handleOpenAddModal(mouldPlates.length > 0 ? mouldPlates : undefined, mouldParam);
        } else {
            handleOpenAddModal();
        }

        // Clean create query parameter from URL so subsequent refresh won't reopen modal
        const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
        params.delete("create");
        const nextUrl = params.toString() ? `/purchase?${params.toString()}` : "/purchase";
        router.replace(nextUrl, { scroll: false });
    }, [shouldCreate, hasLoadedData, mouldParam, pendingPlates, getPlateScanAndCustomer, handleOpenAddModal, searchParams, router]);

    // Calculate live estimated total weight of items inside modal
    const modalEstimatedWeightKg = useMemo(() => {
        let total = 0;
        formData.items.forEach((item) => {
            if (!item.plateid) return;
            const sp = allSubplates.find((p) => p.id === Number(item.plateid));
            if (!sp) return;
            total += calculateSubplateWeight({
                shape: sp.shape || "Rectangle",
                material: item.materialtype || sp.material || "",
                length: sp.length ?? undefined,
                width: sp.width ?? undefined,
                height: sp.height ?? undefined,
                unit: sp.unit || "mm",
                quantity: item.qty || 1,
            });
        });
        return Math.round(total * 10) / 10;
    }, [formData.items, allSubplates]);

    // Open modal for editing existing PO (Source: PurchaseController.php store() edit mode)
    const handleOpenEditModal = (po: PurchaseOrder) => {
        if (po.is_fully_received) {
            alert(`Purchase Order ${po.srno} cannot be edited because all items have already been fully received at the workshop.`);
            return;
        }
        setEditingPO(po);
        setFormData({
            odate: po.odate ? po.odate.slice(0, 10) : new Date().toISOString().slice(0, 10),
            vname: po.vname,
            cname: po.cname,
            projectid: po.projectid,
            items: po.items && po.items.length > 0
                ? po.items.map((it: any) => ({
                      id: it.id,
                      plateid: it.plateid,
                      material: it.material || "",
                      materialtype: it.materialtype || "",
                      qty: it.qty || 1,
                      rate: it.rate !== null && it.rate !== undefined ? it.rate : "",
                  }))
                : [
                      {
                          plateid: "",
                          material: "",
                          materialtype: "",
                          qty: 1,
                          rate: "",
                      },
                  ],
        });
        setFormError(null);
        setIsModalOpen(true);
    };

    const handleClosePOModal = useCallback(() => {
        setIsModalOpen(false);
        setEditingPO(null);
        setFormError(null);
        const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
        const hadMouldParam = params.has("mould");
        const hadCreateParam = params.has("create");
        if (hadMouldParam || hadCreateParam) {
            params.delete("mould");
            params.delete("create");
            setMouldFilter("ALL");
            const nextQuery = params.toString();
            router.replace(nextQuery ? `/purchase?${nextQuery}` : "/purchase", { scroll: false });
        }
    }, [searchParams, router]);

    // Submit Purchase Order (Source: PurchaseController.php store() lines 403-561)
    const handleSubmitPO = async (e: React.FormEvent) => {
        e.preventDefault();
        if (createPurchaseMutation.isPending || updatePurchaseMutation.isPending) return;
        if (editingPO?.is_fully_received) {
            setFormError("This purchase order cannot be edited because all items have already been fully received at the workshop gate.");
            return;
        }
        if (!formData.vname) {
            setFormError("Please select a supplier/vendor.");
            return;
        }
        if (!formData.cname) {
            setFormError("Please select a customer.");
            return;
        }
        if (!formData.projectid) {
            setFormError("Please select a mould project.");
            return;
        }
        if (formData.items.some((it) => !it.plateid || Number(it.qty) <= 0)) {
            setFormError(
                "All line items must have a selected plate and quantity greater than 0.",
            );
            return;
        }

        // Validate that order quantity does not exceed remaining quantity limit
        const plateTotalOrdered = new Map<number, number>();
        for (const it of formData.items) {
            if (it.plateid) {
                const pid = Number(it.plateid);
                plateTotalOrdered.set(pid, (plateTotalOrdered.get(pid) || 0) + (Number(it.qty) || 0));
            }
        }

        for (const [pid, totalQty] of plateTotalOrdered.entries()) {
            const rem = getPlateRemainingQty(pid);
            if (rem !== null && totalQty > rem) {
                const plate = allSubplates.find((p) => p.id === pid);
                setFormError(
                    `Order quantity for "${plate?.platename || "Selected plate"}" (${totalQty}) cannot exceed remaining required limit (${rem}).`
                );
                return;
            }
        }

        try {
            if (editingPO) {
                await updatePurchaseMutation.mutateAsync({
                    id: editingPO.id,
                    odate: formData.odate,
                    vname: Number(formData.vname),
                    cname: Number(formData.cname),
                    projectid: formData.projectid,
                    items: formData.items,
                });
            } else {
                await createPurchaseMutation.mutateAsync({
                    odate: formData.odate,
                    vname: Number(formData.vname),
                    cname: Number(formData.cname),
                    projectid: formData.projectid,
                    items: formData.items,
                });
            }
            setIsModalOpen(false);
            setEditingPO(null);
            const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
            if (params.has("mould") || params.has("create")) {
                params.delete("mould");
                params.delete("create");
                setMouldFilter("ALL");
                const nextQuery = params.toString();
                router.replace(nextQuery ? `/purchase?${nextQuery}` : "/purchase", { scroll: false });
            }
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Error saving PO";
            setFormError(message);
        }
    };

    // Handle Soft Delete
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.has_inward) {
            alert("This purchase order cannot be deleted because material inward has already been recorded.");
            setDeleteTarget(null);
            return;
        }
        try {
            await deletePurchaseMutation.mutateAsync(deleteTarget.id);
        } catch (err: any) {
            console.error("Failed to delete PO:", err);
            alert(err?.message || "Failed to delete PO");
        } finally {
            setDeleteTarget(null);
        }
    };

    // Export CSV
    const handleExportCSV = () => {
        const headers = [
            "PO No.",
            "Order Date",
            "Supplier",
            "Customer",
            "Mould",
            "Created By",
            "Total Items",
        ];
        const rows = filteredPurchases.map((p) => [
            `"${p.srno}"`,
            `"${p.odate}"`,
            `"${getVendorName(p.vname).replace(/"/g, '""')}"`,
            `"${getCustomerName(p.cname).replace(/"/g, '""')}"`,
            `"${p.projectid}"`,
            `"${p.created_by}"`,
            p.items ? p.items.length : 0,
        ]);
        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute(
            "download",
            `starmould_purchase_orders_${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Module Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                            <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                            <span>Procurement</span>
                            <span>/</span>
                            <span className="text-slate-600 ">
                                Purchase Orders
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            Purchase Management
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Raw material procurement, multi-item plate orders &
                            pending vendor pipeline
                        </p>
                    </div>
                </div>

                {/* Top Control Bar: Tabs & Action Buttons */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
                    {/* Main Navigation Tabs */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-xl w-full lg:w-auto">
                        <button
                            onClick={() => handleTabChange("orders")}
                            className={`flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                activeTab === "orders"
                                    ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/80"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <ShoppingCart className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="hidden sm:inline">Purchase Order Register</span>
                            <span className="sm:hidden font-semibold">PO Register</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-blue-50 text-blue-700">
                                {filteredPurchases.length}
                            </span>
                        </button>

                        <button
                            onClick={() => handleTabChange("pending_plates")}
                            className={`flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                                activeTab === "pending_plates"
                                    ? "bg-white text-slate-900 shadow-sm font-semibold border border-slate-200/80"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="hidden sm:inline">Pending Purchase (Plates Needing PO)</span>
                            <span className="sm:hidden font-semibold">Plates Needing PO</span>
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-amber-50 text-amber-700">
                                {pendingPlates.length}
                            </span>
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                        <button
                            onClick={() => handleOpenAddModal()}
                            className="order-first sm:order-last inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer w-full sm:w-auto"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Purchase PO</span>
                        </button>

                        <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <button
                                onClick={() => refetch()}
                                disabled={isMounted && isFetching}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                                title="Fetch latest data directly from database"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isMounted && isFetching ? "animate-spin text-blue-600" : ""}`} />
                                <span>Refresh</span>
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                                title="Export POs to CSV matching legacy export()"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Export</span>
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                            >
                                <Printer className="w-3.5 h-3.5 text-slate-500" />
                                <span>Print</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toolbar for Orders Register tab */}
                {activeTab === "orders" && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder="Search PO no, supplier, customer, mould project..."
                                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 "
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 ">
                                    Rows per page:
                                </span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none "
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 1: PURCHASE ORDER REGISTER (with expandable multi-item rows) */}
                {/* ========================================================================= */}
                {activeTab === "orders" && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[1100px] text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="py-3 px-3 w-[4%] text-center"></th>
                                        <th className="py-3 px-4 w-[11%]">
                                            PO. No.
                                        </th>
                                        <th className="py-3 px-3 w-[10%]">
                                            Order Date
                                        </th>
                                        <th className="py-3 px-4 w-[20%]">
                                            Supplier Name
                                        </th>
                                        <th className="py-3 px-4 w-[20%]">
                                            Customer Name
                                        </th>
                                        <th className="py-3 px-4 w-[15%]">
                                            Mould Project
                                        </th>
                                        <th className="py-3 px-3 w-[10%]">
                                            Created By
                                        </th>
                                        <th className="py-3 px-4 w-[10%] text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 ">
                                    {isLoading ? (
                                        <TableSkeletonRows
                                            rows={8}
                                            columns={8}
                                        />
                                    ) : paginatedPurchases.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="py-12 text-center text-slate-400"
                                            >
                                                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p>No purchase orders found.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedPurchases.map((po) => {
                                            const isExpanded = Boolean(
                                                expandedRows[po.id],
                                            );
                                            const vendorName = getVendorName(
                                                po.vname,
                                            );
                                            const clientName = getCustomerName(
                                                po.cname,
                                            );
                                            const itemCount = po.items
                                                ? po.items.length
                                                : 0;

                                            return (
                                                <React.Fragment key={po.id}>
                                                    {/* Main PO Row */}
                                                    <tr
                                                        id={`row-${po.id}`}
                                                        onClick={(e) => {
                                                            const target = e.target as HTMLElement;
                                                            // Do not trigger toggle if user clicked on interactive elements
                                                            if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
                                                                return;
                                                            }
                                                            toggleRow(po.id);
                                                        }}
                                                        className={`hover:bg-slate-50/70 transition-all duration-300 cursor-pointer ${getRowHighlightClass(po.id)}`}
                                                        title="Click row to view PO line items"
                                                    >
                                                        {/* Details Control toggle icon */}
                                                        <td className="py-3 px-3 text-center">
                                                            <button
                                                                onClick={() =>
                                                                    toggleRow(
                                                                        po.id,
                                                                    )
                                                                }
                                                                className="p-1 rounded text-slate-400 hover:text-slate-700 transition"
                                                                title="Expand line items"
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                                                )}
                                                            </button>
                                                        </td>

                                                        {/* PO No. */}
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-mono font-bold text-[12px] text-blue-700 ">
                                                                    {po.srno}
                                                                </span>
                                                                {po.is_fully_received && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="All items in this purchase order have been received">
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                        <span>Fully Received</span>
                                                                    </span>
                                                                )}
                                                                {!po.is_fully_received && po.is_partially_received && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title={`Partially inwarded: ${po.total_inward_qty || 0} of ${po.total_ordered_qty || 0} received`}>
                                                                        <Clock className="w-3 h-3 text-amber-600" />
                                                                        <span>Partial Inward</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {itemCount}{" "}
                                                                {itemCount === 1
                                                                    ? "plate"
                                                                    : "plates"}
                                                            </div>
                                                        </td>

                                                        {/* Order Date */}
                                                        <td className="py-3 px-3 text-slate-700 ">
                                                            <div className="flex items-center gap-1.5">
                                                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                                <span className="font-mono">
                                                                    {po.odate}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Supplier Name */}
                                                        <td className="py-3 px-4 font-medium text-slate-800 ">
                                                            <div className="flex items-center gap-1.5">
                                                                <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                                <span
                                                                    className="truncate max-w-[200px]"
                                                                    title={
                                                                        vendorName
                                                                    }
                                                                >
                                                                    {vendorName}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* Customer Name */}
                                                        <td className="py-3 px-4 text-slate-700 ">
                                                            <span
                                                                className="truncate max-w-[200px] block"
                                                                title={
                                                                    clientName
                                                                }
                                                            >
                                                                {clientName}
                                                            </span>
                                                        </td>

                                                        {/* Mould Project */}
                                                        <td className="py-3 px-4">
                                                            <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200 ">
                                                                {po.projectid}
                                                            </span>
                                                        </td>

                                                        {/* Created By */}
                                                        <td className="py-3 px-3 text-slate-600 ">
                                                            {po.created_by ||
                                                                "Admin"}
                                                        </td>

                                                        {/* Action Buttons */}
                                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    onClick={() =>
                                                                        handleOpenVoucherTab(
                                                                            po,
                                                                        )
                                                                    }
                                                                    className="px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                                                                    title="Open PO Voucher in new tab"
                                                                >
                                                                    <Printer className="w-3 h-3" />
                                                                    <span>Voucher</span>
                                                                </button>
                                                                {po.is_fully_received ? (
                                                                    <button
                                                                        type="button"
                                                                        disabled
                                                                        className="px-2 py-1 text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded cursor-not-allowed opacity-60 flex items-center gap-1"
                                                                        title="Cannot edit: All items in this Purchase Order have already been fully received at the workshop gate"
                                                                    >
                                                                        <Lock className="w-3 h-3 text-slate-400" />
                                                                        <span>Edit</span>
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() =>
                                                                            handleOpenEditModal(
                                                                                po,
                                                                            )
                                                                        }
                                                                        className="px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition flex items-center gap-1 cursor-pointer"
                                                                        title="Edit Purchase Order"
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                        <span>Edit</span>
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() =>
                                                                        toggleRow(
                                                                            po.id,
                                                                        )
                                                                    }
                                                                    className="px-2 py-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition"
                                                                >
                                                                    {isExpanded
                                                                        ? "Hide"
                                                                        : "Items"}
                                                                </button>
                                                                {po.has_inward ? (
                                                                    <button
                                                                        type="button"
                                                                        disabled
                                                                        className="px-2 py-1 text-[11px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded cursor-not-allowed opacity-60"
                                                                        title="Cannot delete: Material has already been inwarded against this Purchase Order"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() =>
                                                                            setDeleteTarget(
                                                                                po,
                                                                            )
                                                                        }
                                                                        className="px-2 py-1 text-[11px] font-medium text-rose-600 border border-rose-200 rounded hover:bg-rose-50 transition cursor-pointer"
                                                                        title="Delete Purchase Order"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Expanded Child Table: Line Items (replicates purchaseitems format(d)) */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/90 ">
                                                            <td
                                                                colSpan={8}
                                                                className="p-4 pl-12 border-y border-slate-200 "
                                                            >
                                                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-inner">
                                                                    <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700 ">
                                                                        <span className="flex items-center gap-1.5">
                                                                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                                                                            Line
                                                                            Items
                                                                            for{" "}
                                                                            {
                                                                                po.srno
                                                                            }
                                                                        </span>
                                                                        <span className="text-[11px] text-slate-500 font-normal">
                                                                            {
                                                                                itemCount
                                                                            }{" "}
                                                                            subplates
                                                                            ordered
                                                                        </span>
                                                                    </div>
                                                                    <div className="overflow-x-auto w-full">
                                                                        <table className="w-full text-xs text-left">
                                                                            <thead className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200 ">
                                                                                <tr>
                                                                                    <th className="py-2 px-4">
                                                                                        Plate
                                                                                        Name
                                                                                    </th>
                                                                                    <th className="py-2 px-4">
                                                                                        Material
                                                                                        /
                                                                                        Dimensions
                                                                                    </th>
                                                                                    <th className="py-2 px-4">
                                                                                        Material
                                                                                        Type
                                                                                    </th>
                                                                                    <th className="py-2 px-4 text-center">
                                                                                        Ordered
                                                                                        Qty
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-slate-100 ">
                                                                                {po.items &&
                                                                                po
                                                                                    .items
                                                                                    .length >
                                                                                    0 ? (
                                                                                    po.items.map(
                                                                                        (
                                                                                            item,
                                                                                        ) => (
                                                                                            <tr
                                                                                                key={
                                                                                                    item.id
                                                                                                }
                                                                                                className="hover:bg-slate-50/50"
                                                                                            >
                                                                                                <td className="py-2 px-4 font-semibold text-slate-800 ">
                                                                                                    {item.platename ||
                                                                                                        `Plate #${item.plateid}`}
                                                                                                </td>
                                                                                                <td className="py-2 px-4 font-mono text-[11px] text-slate-600 ">
                                                                                                    {item.material ||
                                                                                                        "—"}
                                                                                                </td>
                                                                                                <td className="py-2 px-4 text-slate-600 ">
                                                                                                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200 ">
                                                                                                        {
                                                                                                            item.materialtype
                                                                                                        }
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="py-2 px-4 text-center font-bold text-slate-800 ">
                                                                                                    {
                                                                                                        item.qty
                                                                                                    }
                                                                                                </td>
                                                                                            </tr>
                                                                                        ),
                                                                                    )
                                                                                ) : (
                                                                                    <tr>
                                                                                        <td
                                                                                            colSpan={
                                                                                                4
                                                                                            }
                                                                                            className="py-4 text-center text-slate-400 italic"
                                                                                        >
                                                                                            No
                                                                                            line
                                                                                            items
                                                                                            attached
                                                                                            to
                                                                                            this
                                                                                            order.
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </tbody>
                                                                        </table>
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
                            {paginatedPurchases.length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-xs">
                                    No purchase orders found.
                                </div>
                            ) : (
                                paginatedPurchases.map((po) => {
                                    const isExpanded = Boolean(
                                        expandedRows[po.id],
                                    );
                                    const vendorName = getVendorName(
                                        po.vname,
                                    );
                                    const clientName = getCustomerName(
                                        po.cname,
                                    );
                                    const itemCount = po.items
                                        ? po.items.length
                                        : 0;

                                    return (
                                        <div
                                            key={po.id}
                                            id={`m-row-${po.id}`}
                                            onClick={(e) => {
                                                const target = e.target as HTMLElement;
                                                // Do not trigger toggle if user clicked on interactive elements
                                                if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
                                                    return;
                                                }
                                                toggleRow(po.id);
                                            }}
                                            className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2.5 text-xs shadow-2xs cursor-pointer"
                                            title="Tap card to view PO line items"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono font-bold text-blue-700 ">
                                                        {po.srno}
                                                    </span>
                                                    {po.is_fully_received && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Fully Received</span>
                                                        </span>
                                                    )}
                                                    {!po.is_fully_received && po.is_partially_received && (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            <span>Partial</span>
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] text-slate-400 ml-1 font-mono">
                                                        {po.odate}
                                                    </span>
                                                </div>
                                                <span className="px-2 py-0.5 rounded font-mono font-semibold text-[10px] bg-slate-100 text-slate-700 border border-slate-200 ">
                                                    {po.projectid}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 ">
                                                <div>
                                                    <span className="text-slate-400 block text-[10px]">
                                                        Supplier:
                                                    </span>
                                                    <span className="font-medium text-slate-800 truncate block">
                                                        {vendorName}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 block text-[10px]">
                                                        Customer:
                                                    </span>
                                                    <span className="font-medium text-slate-800 truncate block">
                                                        {clientName}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-200 space-y-2">
                                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                    <span className="font-medium text-slate-600">
                                                        {itemCount}{" "}
                                                        {itemCount === 1
                                                            ? "subplate"
                                                            : "subplates"}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">
                                                        PO Actions
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-4 gap-1.5">
                                                    <button
                                                        onClick={() =>
                                                            handleOpenVoucherTab(po)
                                                        }
                                                        className="min-h-[36px] px-1 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition flex items-center justify-center gap-1 cursor-pointer"
                                                        title="Open PO Voucher in new tab"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        <span>Voucher</span>
                                                    </button>
                                                    {po.is_fully_received ? (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="min-h-[36px] px-1 py-1 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed opacity-60 flex items-center justify-center gap-1"
                                                            title="Cannot edit: All items in this Purchase Order have already been fully received at the workshop gate"
                                                        >
                                                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>Edit</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                handleOpenEditModal(po)
                                                            }
                                                            className="min-h-[36px] px-1 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition flex items-center justify-center gap-1 cursor-pointer"
                                                            title="Edit PO"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            <span>Edit</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() =>
                                                            toggleRow(po.id)
                                                        }
                                                        className="min-h-[36px] px-1 py-1 text-xs font-semibold text-blue-600 bg-blue-50/50 border border-blue-200 rounded-lg hover:bg-blue-100 transition flex items-center justify-center cursor-pointer"
                                                    >
                                                        {isExpanded
                                                            ? "Hide"
                                                            : "Items"}
                                                    </button>
                                                    {po.has_inward ? (
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className="min-h-[36px] px-1 py-1 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg cursor-not-allowed opacity-60 flex items-center justify-center"
                                                            title="Cannot delete: Material has already been inwarded against this Purchase Order"
                                                        >
                                                            Delete
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                setDeleteTarget(po)
                                                            }
                                                            className="min-h-[36px] px-1 py-1 text-xs font-semibold text-rose-600 bg-rose-50/50 border border-rose-200 rounded-lg hover:bg-rose-100 transition flex items-center justify-center cursor-pointer"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Mobile Expanded Items */}
                                            {isExpanded &&
                                                po.items &&
                                                po.items.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                                                        {po.items.map((it) => (
                                                            <div
                                                                key={it.id}
                                                                className="p-2 rounded bg-white border border-slate-200 text-[11px] flex items-center justify-between"
                                                            >
                                                                <div>
                                                                    <span className="font-semibold text-slate-800 block">
                                                                        {it.platename ||
                                                                            `Plate #${it.plateid}`}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {it.material ||
                                                                            "—"}{" "}
                                                                        (
                                                                        {
                                                                            it.materialtype
                                                                        }
                                                                        )
                                                                    </span>
                                                                </div>
                                                                <span className="font-bold text-slate-800 ">
                                                                    Qty:{" "}
                                                                    {it.qty}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500 ">
                            <div>
                                Showing{" "}
                                <span className="font-semibold text-slate-800 ">
                                    {filteredPurchases.length === 0
                                        ? 0
                                        : (currentPage - 1) * pageSize + 1}
                                </span>{" "}
                                to{" "}
                                <span className="font-semibold text-slate-800 ">
                                    {Math.min(
                                        currentPage * pageSize,
                                        filteredPurchases.length,
                                    )}
                                </span>{" "}
                                of{" "}
                                <span className="font-semibold text-slate-800 ">
                                    {filteredPurchases.length}
                                </span>{" "}
                                purchase orders
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.max(1, p - 1),
                                        )
                                    }
                                    disabled={currentPage === 1}
                                    className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 "
                                >
                                    Previous
                                </button>
                                <span className="px-3 py-1 font-mono text-xs">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    onClick={() =>
                                        setCurrentPage((p) =>
                                            Math.min(totalPages, p + 1),
                                        )
                                    }
                                    disabled={currentPage === totalPages}
                                    className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 "
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* TAB 2: PENDING PURCHASE LIST (Plates from registered moulds needing PO) */}
                {/* Modernized for high-volume tooling ERP with Mould Grouping, Weight & Bulk PO */}
                {/* ========================================================================= */}
                {activeTab === "pending_plates" && (
                    <div className="space-y-4">
                        {/* 1. Executive Procurement KPI Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {/* Card 1: Pending Plates */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                                    <Boxes className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Pending Plates
                                    </span>
                                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                                        {pendingMetrics.totalPlates}{" "}
                                        <span className="text-xs font-normal text-slate-500">
                                            plates
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-amber-700 font-medium">
                                        {pendingMetrics.totalUnits} required pcs to procure
                                    </span>
                                </div>
                            </div>

                            {/* Card 2: Mould Projects */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                                    <Building2 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Mould Projects
                                    </span>
                                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                                        {pendingMetrics.totalMoulds}{" "}
                                        <span className="text-xs font-normal text-slate-500">
                                            active moulds
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-blue-700 font-medium">
                                        Awaiting raw steel POs
                                    </span>
                                </div>
                            </div>

                            {/* Card 3: Est. Raw Material Weight */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                                    <Scale className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                                        Est. Steel Weight
                                    </span>
                                    <div className="text-xl font-bold text-slate-900 tracking-tight">
                                        {pendingMetrics.totalWeightKg.toLocaleString()}{" "}
                                        <span className="text-xs font-normal text-slate-500">
                                            kg
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-emerald-700 font-medium">
                                        ~{(pendingMetrics.totalWeightKg / 1000).toFixed(2)} Metric Tons
                                    </span>
                                </div>
                            </div>

                            {/* Card 4: Material Grades Mix Chips */}
                            <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                        Steel Grades Mix
                                    </span>
                                    {materialFilter !== "ALL" && (
                                        <button
                                            type="button"
                                            onClick={() => setMaterialFilter("ALL")}
                                            className="text-[10px] text-blue-600 hover:underline font-medium"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-[44px] custom-scrollbar">
                                    {pendingMetrics.sortedMaterials.length === 0 ? (
                                        <span className="text-xs text-slate-400">None</span>
                                    ) : (
                                        pendingMetrics.sortedMaterials.map(([mat, count]) => {
                                            const isSelected = materialFilter === mat;
                                            return (
                                                <button
                                                    key={mat}
                                                    type="button"
                                                    onClick={() =>
                                                        setMaterialFilter(isSelected ? "ALL" : mat)
                                                    }
                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition cursor-pointer ${
                                                        isSelected
                                                            ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                                                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                                    }`}
                                                    title={`Filter by ${mat}`}
                                                >
                                                    {mat}: {count}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 2. Pending Plates Filter & Control Toolbar */}
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-3">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                {/* Search */}
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        placeholder="Search plate name, mould, customer, material, size..."
                                        className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Filters & View Mode */}
                                <div className="flex flex-wrap items-center gap-2.5">
                                    {/* Mould Filter */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                                            Mould:
                                        </span>
                                        <select
                                            value={mouldFilter}
                                            onChange={(e) => {
                                                setMouldFilter(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-medium"
                                        >
                                            <option value="ALL">All Moulds ({pendingMouldOptions.length})</option>
                                            {pendingMouldOptions.map((opt) => (
                                                <option key={opt.code} value={opt.code}>
                                                    {opt.code} ({opt.count})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Material Grade Filter */}
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                                            Material:
                                        </span>
                                        <select
                                            value={materialFilter}
                                            onChange={(e) => {
                                                setMaterialFilter(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-slate-700 font-medium"
                                        >
                                            <option value="ALL">All Materials</option>
                                            {pendingMaterialOptions.map((opt) => (
                                                <option key={opt.name} value={opt.name}>
                                                    {opt.name} ({opt.count})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Reset Filters */}
                                    {(searchQuery || mouldFilter !== "ALL" || materialFilter !== "ALL") && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery("");
                                                setMouldFilter("ALL");
                                                setMaterialFilter("ALL");
                                                setCurrentPage(1);
                                            }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                                            title="Clear all filters"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>Reset</span>
                                        </button>
                                    )}

                                    <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                                    {/* View Mode Toggle */}
                                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("grouped")}
                                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                                                viewMode === "grouped"
                                                    ? "bg-white text-blue-700 shadow-2xs"
                                                    : "text-slate-600 hover:text-slate-900"
                                            }`}
                                            title="Group pending plates by mould project"
                                        >
                                            <LayoutGrid className="w-3.5 h-3.5" />
                                            <span>By Mould</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode("flat")}
                                            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                                                viewMode === "flat"
                                                    ? "bg-white text-blue-700 shadow-2xs"
                                                    : "text-slate-600 hover:text-slate-900"
                                            }`}
                                            title="View flat table of all plates"
                                        >
                                            <List className="w-3.5 h-3.5" />
                                            <span>Flat Table</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. VIEW MODE A: GROUPED BY MOULD (Recommended for Tooling Incharges) */}
                        {viewMode === "grouped" && (
                            <div className="space-y-4">
                                {isLoading ? (
                                    <div className="bg-white border border-slate-200 rounded-xl p-8">
                                        <TableSkeletonRows rows={6} columns={6} />
                                    </div>
                                ) : pendingByMould.length === 0 ? (
                                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500 opacity-60" />
                                        <h3 className="text-sm font-semibold text-slate-800 mb-1">
                                            No Pending Plates Found
                                        </h3>
                                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                                            {searchQuery || mouldFilter !== "ALL" || materialFilter !== "ALL"
                                                ? "No pending plates match your active filters. Try clearing your search or filter selections."
                                                : "All registered subplates currently have active purchase orders raised! Raw material procurement is completely up to date."}
                                        </p>
                                    </div>
                                ) : (
                                    pendingByMould.map((group) => {
                                        const isCollapsed = Boolean(collapsedMoulds[group.mouldCode]);
                                        const groupPlateIds = group.plates.map((p) => p.id);
                                        const isAllMouldPlatesSelected =
                                            groupPlateIds.length > 0 &&
                                            groupPlateIds.every((id) => selectedPlateIds.includes(id));
                                        const someMouldPlatesSelected =
                                            groupPlateIds.some((id) => selectedPlateIds.includes(id)) &&
                                            !isAllMouldPlatesSelected;

                                        return (
                                            <div
                                                key={group.mouldCode}
                                                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs transition-all hover:border-slate-300"
                                            >
                                                {/* Mould Card Header */}
                                                <div
                                                    onClick={(e) => {
                                                        const target = e.target as HTMLElement;
                                                        if (target.closest("button, a, input, select, [role='button'], [data-no-row-toggle]")) {
                                                            return;
                                                        }
                                                        toggleCollapseMould(group.mouldCode);
                                                    }}
                                                    className="p-3.5 sm:p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                                                    title={isCollapsed ? "Click to expand mould plates" : "Click to collapse mould plates"}
                                                >
                                                    {/* Left: Mould Identification & Customer */}
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {/* Checkbox to select all plates of this mould */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSelectMouldPlates(group.plates)}
                                                            className="text-slate-400 hover:text-blue-600 transition p-1"
                                                            title={
                                                                isAllMouldPlatesSelected
                                                                    ? "Deselect all plates for this mould"
                                                                    : "Select all plates for this mould"
                                                            }
                                                        >
                                                            {isAllMouldPlatesSelected ? (
                                                                <CheckSquare className="w-4 h-4 text-blue-600" />
                                                            ) : someMouldPlatesSelected ? (
                                                                <div className="w-4 h-4 rounded border-2 border-blue-600 bg-blue-50 flex items-center justify-center">
                                                                    <div className="w-2 h-0.5 bg-blue-600" />
                                                                </div>
                                                            ) : (
                                                                <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                                                            )}
                                                        </button>

                                                        {/* Mould Code Badge */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-bold text-sm text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                                                                Mould #{group.mouldCode}
                                                            </span>
                                                        </div>

                                                        {/* Customer Name & Description */}
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-xs text-slate-800 truncate" title={group.customerName}>
                                                                    {group.customerName}
                                                                </span>
                                                                {group.description && (
                                                                    <span className="text-[11px] text-slate-500 truncate hidden sm:inline" title={group.description}>
                                                                        • {group.description}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {group.scan?.worktype && (
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    Work: {group.scan.worktype}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Right: Quick Stats & Bulk PO Action */}
                                                    <div className="flex items-center justify-between md:justify-end gap-2.5">
                                                        {/* Stats Badges */}
                                                        <div className="flex items-center gap-2 text-xs">
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                                                                {group.plates.length} Plates ({group.totalPendingUnits} pcs)
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-semibold flex items-center gap-1">
                                                                <Scale className="w-3 h-3 text-emerald-600" />
                                                                ~{group.totalWeightKg.toFixed(1)} kg
                                                            </span>
                                                        </div>

                                                        {/* One-Click: Order All Plates for this Mould */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenAddModal(group.plates)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition active:scale-95 shrink-0"
                                                            title={`Create single PO for all ${group.plates.length} plates of Mould ${group.mouldCode}`}
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                            <span>PO for Mould ({group.plates.length})</span>
                                                        </button>

                                                        {/* Accordion Collapse/Expand Chevron */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCollapseMould(group.mouldCode)}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
                                                            title={isCollapsed ? "Expand plates" : "Collapse plates"}
                                                        >
                                                            {isCollapsed ? (
                                                                <ChevronDown className="w-4 h-4 text-slate-600" />
                                                            ) : (
                                                                <ChevronUp className="w-4 h-4 text-slate-600" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Plate Table (visible when expanded) */}
                                                {!isCollapsed && (
                                                    <div className="overflow-x-auto custom-scrollbar">
                                                        <table className="w-full min-w-[950px] text-left text-xs">
                                                            <thead className="bg-white border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                                                                <tr>
                                                                    <th className="py-2.5 px-3 w-[4%] text-center">
                                                                        <span className="sr-only">Select</span>
                                                                    </th>
                                                                    <th className="py-2.5 px-3 w-[24%]">Plate Name</th>
                                                                    <th className="py-2.5 px-3 w-[22%]">Dimensions (L × W × H)</th>
                                                                    <th className="py-2.5 px-3 w-[15%]">Material Grade</th>
                                                                    <th className="py-2.5 px-3 w-[13%] text-right">Est. Weight</th>
                                                                    <th className="py-2.5 px-3 w-[10%] text-center">Qty Pending</th>
                                                                    <th className="py-2.5 px-3 w-[12%] text-right">Action</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {group.plates.map((sp) => {
                                                                    const isSelected = selectedPlateIds.includes(sp.id);
                                                                    const remQty = getPlateRemainingQty(sp.id) ?? sp.sqty ?? 1;
                                                                    const plateWeight = calculateSubplateWeight({
                                                                        shape: sp.shape || "Rectangle",
                                                                        material: sp.material || "",
                                                                        length: sp.length ?? undefined,
                                                                        width: sp.width ?? undefined,
                                                                        height: sp.height ?? undefined,
                                                                        unit: sp.unit || "mm",
                                                                        quantity: remQty,
                                                                    });
                                                                    const formattedDims = formatSubplateDimensions(sp);

                                                                    return (
                                                                        <tr
                                                                            key={sp.id}
                                                                            className={`transition-colors ${
                                                                                isSelected
                                                                                    ? "bg-blue-50/50 hover:bg-blue-50/80"
                                                                                    : "hover:bg-slate-50/80"
                                                                            }`}
                                                                        >
                                                                            {/* Checkbox */}
                                                                            <td className="py-2.5 px-3 text-center">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleSelectPlate(sp.id)}
                                                                                    className="text-slate-400 hover:text-blue-600 transition"
                                                                                >
                                                                                    {isSelected ? (
                                                                                        <CheckSquare className="w-4 h-4 text-blue-600" />
                                                                                    ) : (
                                                                                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                                                                                    )}
                                                                                </button>
                                                                            </td>

                                                                            {/* Plate Name & Code */}
                                                                            <td className="py-2.5 px-3">
                                                                                <div className="font-semibold text-slate-800">
                                                                                    {sp.platename}
                                                                                </div>
                                                                                {sp.subprojectid && (
                                                                                    <div className="font-mono text-[10px] text-slate-400">
                                                                                        {sp.subprojectid}
                                                                                    </div>
                                                                                )}
                                                                            </td>

                                                                            {/* Dimensions */}
                                                                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                                                                {formattedDims !== "—" ? (
                                                                                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                                                                        {formattedDims}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-slate-400">—</span>
                                                                                )}
                                                                            </td>

                                                                            {/* Material */}
                                                                            <td className="py-2.5 px-3">
                                                                                <span
                                                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getMaterialBadgeClass(
                                                                                        sp.material,
                                                                                    )}`}
                                                                                >
                                                                                    {sp.material || "Steel/Alu"}
                                                                                </span>
                                                                            </td>

                                                                            {/* Est. Weight */}
                                                                            <td className="py-2.5 px-3 text-right font-mono text-[11px] font-medium text-slate-700">
                                                                                {plateWeight > 0 ? (
                                                                                    <span title="Theoretical weight calculated from density & dimensions">
                                                                                        {plateWeight.toFixed(2)} kg
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-slate-400">—</span>
                                                                                )}
                                                                            </td>

                                                                            {/* Qty Pending */}
                                                                            <td className="py-2.5 px-3 text-center">
                                                                                <span className="font-mono font-bold text-slate-800">
                                                                                    {remQty}
                                                                                </span>
                                                                                {sp.sqty && remQty !== sp.sqty && (
                                                                                    <span className="block text-[10px] text-slate-400">
                                                                                        of {sp.sqty}
                                                                                    </span>
                                                                                )}
                                                                            </td>

                                                                            {/* Single PO Action */}
                                                                            <td className="py-2.5 px-3 text-right">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleOpenAddModal(sp)}
                                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition shadow-2xs"
                                                                                    title="Create PO for this plate only"
                                                                                >
                                                                                    <Plus className="w-3 h-3" />
                                                                                    <span>PO</span>
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* 4. VIEW MODE B: FLAT TABLE (Across all moulds) */}
                        {viewMode === "flat" && (
                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                                <div className="p-3.5 bg-amber-50/70 border-b border-amber-200/70 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-amber-900 font-medium">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>
                                            Showing {filteredPendingPlates.length} plates awaiting raw material procurement.
                                        </span>
                                    </div>
                                    <span className="font-mono font-bold text-amber-800">
                                        {pendingPlates.length} Total Needing PO
                                    </span>
                                </div>

                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full min-w-[1100px] text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="py-3 px-3 w-[4%] text-center">
                                                    <span className="sr-only">Select</span>
                                                </th>
                                                <th className="py-3 px-4 w-[20%]">Plate Name</th>
                                                <th className="py-3 px-3 w-[12%]">Mould Project</th>
                                                <th className="py-3 px-3 w-[16%]">Customer</th>
                                                <th className="py-3 px-3 w-[18%]">Dimensions (L × W × H)</th>
                                                <th className="py-3 px-3 w-[12%]">Material</th>
                                                <th className="py-3 px-3 w-[8%] text-right">Est. Wt</th>
                                                <th className="py-3 px-3 w-[7%] text-center">Qty</th>
                                                <th className="py-3 px-4 w-[8%] text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {isLoading ? (
                                                <TableSkeletonRows rows={8} columns={9} />
                                            ) : paginatedPendingPlates.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-60" />
                                                        <p className="font-medium text-slate-700">No pending plates found</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            Try adjusting your search or filters
                                                        </p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                paginatedPendingPlates.map((sp) => {
                                                    const isSelected = selectedPlateIds.includes(sp.id);
                                                    const { mouldCode, custName } = getPlateScanAndCustomer(sp);
                                                    const remQty = getPlateRemainingQty(sp.id) ?? sp.sqty ?? 1;
                                                    const plateWeight = calculateSubplateWeight({
                                                        shape: sp.shape || "Rectangle",
                                                        material: sp.material || "",
                                                        length: sp.length ?? undefined,
                                                        width: sp.width ?? undefined,
                                                        height: sp.height ?? undefined,
                                                        unit: sp.unit || "mm",
                                                        quantity: remQty,
                                                    });
                                                    const formattedDims = formatSubplateDimensions(sp);

                                                    return (
                                                        <tr
                                                            key={sp.id}
                                                            className={`transition-colors ${
                                                                isSelected
                                                                    ? "bg-blue-50/50 hover:bg-blue-50/80"
                                                                    : "hover:bg-slate-50/80"
                                                            }`}
                                                        >
                                                            {/* Checkbox */}
                                                            <td className="py-3 px-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleSelectPlate(sp.id)}
                                                                    className="text-slate-400 hover:text-blue-600 transition"
                                                                >
                                                                    {isSelected ? (
                                                                        <CheckSquare className="w-4 h-4 text-blue-600" />
                                                                    ) : (
                                                                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                                                                    )}
                                                                </button>
                                                            </td>

                                                            {/* Plate Name */}
                                                            <td className="py-3 px-4 font-semibold text-slate-800">
                                                                {sp.platename}
                                                                {sp.subprojectid && (
                                                                    <div className="font-mono text-[10px] text-slate-400 font-normal">
                                                                        {sp.subprojectid}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Mould */}
                                                            <td className="py-3 px-3">
                                                                <span className="px-2 py-0.5 rounded font-mono font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                                                    {mouldCode}
                                                                </span>
                                                            </td>

                                                            {/* Customer */}
                                                            <td className="py-3 px-3 text-slate-700 truncate max-w-[160px]" title={custName}>
                                                                {custName}
                                                            </td>

                                                            {/* Dimensions */}
                                                            <td className="py-3 px-3 font-mono text-[11px] text-slate-700">
                                                                {formattedDims !== "—" ? (
                                                                    <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                                                                        {formattedDims}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </td>

                                                            {/* Material */}
                                                            <td className="py-3 px-3">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getMaterialBadgeClass(
                                                                        sp.material,
                                                                    )}`}
                                                                >
                                                                    {sp.material || "Steel/Alu"}
                                                                </span>
                                                            </td>

                                                            {/* Weight */}
                                                            <td className="py-3 px-3 text-right font-mono text-[11px] font-medium text-slate-700">
                                                                {plateWeight > 0 ? `${plateWeight.toFixed(1)} kg` : "—"}
                                                            </td>

                                                            {/* Qty */}
                                                            <td className="py-3 px-3 text-center font-bold text-slate-800">
                                                                {remQty}
                                                                {sp.sqty && remQty !== sp.sqty && (
                                                                    <span className="block text-[10px] text-slate-400 font-normal">
                                                                        of {sp.sqty}
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Action */}
                                                            <td className="py-3 px-4 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenAddModal(sp)}
                                                                    className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition shadow-2xs"
                                                                >
                                                                    <Plus className="w-3 h-3" />
                                                                    <span>Create PO</span>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Footer */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                                    <div>
                                        Showing{" "}
                                        <span className="font-semibold text-slate-800">
                                            {filteredPendingPlates.length === 0
                                                ? 0
                                                : (currentPage - 1) * pageSize + 1}
                                        </span>{" "}
                                        to{" "}
                                        <span className="font-semibold text-slate-800">
                                            {Math.min(currentPage * pageSize, filteredPendingPlates.length)}
                                        </span>{" "}
                                        of{" "}
                                        <span className="font-semibold text-slate-800">
                                            {filteredPendingPlates.length}
                                        </span>{" "}
                                        pending plates
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-3 py-1 font-mono text-xs">
                                            {currentPage} / {totalPages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 5. Sticky Floating Batch Action Bar for Multi-Select */}
                        {selectedPlateIds.length > 0 && (
                            <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] sm:w-auto max-w-3xl bg-slate-900/95 backdrop-blur-xl text-slate-100 p-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-2xl shadow-slate-950/50 border border-slate-700/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4 text-xs animate-in fade-in slide-in-from-bottom-4 duration-200">
                                {/* Left Section: Selection Count, Mould & Weight Badges */}
                                <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 flex-wrap">
                                    {/* Selection Count Pill */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                                            {selectedPlateIds.length}
                                        </div>
                                        <span className="font-semibold text-white tracking-tight whitespace-nowrap">
                                            {selectedPlateIds.length === 1 ? "1 Plate Selected" : `${selectedPlateIds.length} Plates Selected`}
                                        </span>
                                    </div>

                                    {isSingleMouldSelected && (
                                        <>
                                            <div className="h-4 w-px bg-slate-700/80 hidden sm:block" />

                                            {/* Mould Badge - clean dark pill */}
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 text-[11px]">
                                                <span className="text-slate-400 font-medium">Mould:</span>
                                                <span className="font-mono font-semibold text-white">
                                                    {selectedPlatesMoulds[0]}
                                                </span>
                                            </div>

                                            {/* Weight Badge - clean pill with scale icon */}
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-200 text-[11px] font-mono">
                                                <Scale className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                <span className="text-slate-400 font-sans">Est:</span>
                                                <span className="font-semibold text-emerald-300">{selectedTotalWeightKg} kg</span>
                                            </div>
                                        </>
                                    )}

                                    {/* Mobile Clear Button on top row */}
                                    <button
                                        type="button"
                                        onClick={clearSelectedPlates}
                                        className="sm:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition ml-auto"
                                        title="Clear selection"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Right Section: Primary Action CTA & Desktop Clear */}
                                {isSingleMouldSelected ? (
                                    <div className="flex items-center gap-2 sm:ml-auto">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleOpenAddModal(selectedPlates);
                                                clearSelectedPlates();
                                            }}
                                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95 cursor-pointer"
                                        >
                                            <Plus className="w-4 h-4 stroke-[2.5]" />
                                            <span>Create Purchase PO ({selectedPlateIds.length})</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={clearSelectedPlates}
                                            className="hidden sm:inline-flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                                            title="Clear selection"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px]">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <span>Multiple moulds ({selectedPlatesMoulds.length}). PO must be per mould.</span>
                                        </div>
                                        {selectedPlatesMoulds[0] && (
                                            <button
                                                type="button"
                                                onClick={() => selectOnlyMould(selectedPlatesMoulds[0])}
                                                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-medium rounded-lg border border-blue-500/30 transition text-xs"
                                            >
                                                Keep Mould {selectedPlatesMoulds[0]}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={clearSelectedPlates}
                                            className="hidden sm:inline-flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
                                            title="Clear selection"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ========================================================================= */}
                {/* ADD PURCHASE PO MODAL (Multi-item entry replicating purchaseitems UX) */}
                {/* Source: purchase/index.blade.php lines 76-161 & PurchaseController::store */}
                {/* ========================================================================= */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={handleClosePOModal}
                    title={
                        editingPO
                            ? `Edit Purchase Order (${editingPO.srno})`
                            : "Create Raw Material Purchase Order"
                    }
                    description={
                        editingPO
                            ? "Modify purchase order details, supplier, and plate line items"
                            : "Generate a new raw material purchase order with vendor details and line items"
                    }
                    size="3xl"
                    className="sm:max-w-[760px] w-full"
                >
                    <form
                        onSubmit={handleSubmitPO}
                        className="space-y-5 text-xs"
                    >
                        {editingPO?.is_fully_received && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-2">
                                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>This purchase order has already been fully received at the workshop gate and cannot be modified.</span>
                            </div>
                        )}
                        {formError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{formError}</span>
                            </div>
                        )}

                        {/* Header Fields (2x2 on desktop, stacked on mobile) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                            {/* Order Date */}
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Order Date{" "}
                                    <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="date"
                                        required
                                        value={formData.odate}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                odate: e.target.value,
                                            }))
                                        }
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 "
                                    />
                                </div>
                            </div>

                            {/* Supplier Name */}
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Supplier Name (vname){" "}
                                    <span className="text-rose-500">*</span>
                                </label>
                                <ERPSelect
                                    required
                                    value={formData.vname}
                                    onChange={(val) =>
                                        setFormData((p) => ({
                                            ...p,
                                            vname: val ? Number(val) : "",
                                        }))
                                    }
                                    options={vendorOptions}
                                    placeholder="Select Supplier / Vendor"
                                    searchPlaceholder="Search supplier or initials..."
                                />
                            </div>

                            {/* Customer Name */}
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Customer Name (cname){" "}
                                    <span className="text-rose-500">*</span>
                                </label>
                                <ERPSelect
                                    required
                                    value={formData.cname}
                                    onChange={(val) => {
                                        const newCid = val ? Number(val) : "";
                                        setFormData((p) => {
                                            const selectedCustomer = clients.find((c: any) => c.id === Number(newCid));
                                            const selectedCustName = selectedCustomer?.customername?.toLowerCase().trim();

                                            // Check if current projectid belongs to the newly selected customer
                                            const currentMouldMatchesCustomer = scans.some((s) => {
                                                const matchesCust =
                                                    (s.customer_id && Number(s.customer_id) === Number(newCid)) ||
                                                    (s.cname && (String(s.cname) === String(newCid) || (selectedCustName && String(s.cname).toLowerCase().trim() === selectedCustName)));
                                                return matchesCust && (s.projectid === p.projectid || String(s.id) === p.projectid);
                                            });

                                            // If the mould matches or we have pre-populated items for this mould project, preserve them!
                                            const hasPrepopulatedItems = Boolean(p.projectid && p.items.some((it) => it.plateid));

                                            if (currentMouldMatchesCustomer || hasPrepopulatedItems) {
                                                return {
                                                    ...p,
                                                    cname: newCid,
                                                };
                                            }

                                            return {
                                                ...p,
                                                cname: newCid,
                                                projectid: "",
                                                items: [
                                                    {
                                                        plateid: "",
                                                        material: "",
                                                        materialtype: "",
                                                        qty: 1,
                                                        rate: "",
                                                    },
                                                ],
                                            };
                                        });
                                    }}
                                    options={customerOptions}
                                    placeholder="Select Customer"
                                    searchPlaceholder="Search customer..."
                                />
                            </div>

                            {/* Mould Name (projectid) */}
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Mould Name (projectid){" "}
                                    <span className="text-rose-500">*</span>
                                </label>
                                <ERPSelect
                                    required
                                    value={formData.projectid}
                                    onChange={(val) => {
                                        const newProj = String(val || "");
                                        setFormData((p) => {
                                            if (p.projectid === newProj) return p;
                                            return {
                                                ...p,
                                                projectid: newProj,
                                                // Reset plate selection only when switching to a different mould
                                                items: p.items.map((it) => ({
                                                    ...it,
                                                    plateid: "",
                                                })),
                                            };
                                        });
                                    }}
                                    options={mouldOptions}
                                    placeholder={
                                        availableMoulds.length === 0 && !formData.projectid
                                            ? !formData.cname
                                                ? "Select Customer First"
                                                : "No active moulds found for this customer"
                                            : "Select Mould Project"
                                    }
                                    searchPlaceholder="Search mould project ID..."
                                    disabled={!formData.cname && !formData.projectid}
                                />
                            </div>
                        </div>

                        {/* Dynamic Line Items Section (Multi-Item Repeater) */}
                        <div className="pt-3 border-t border-slate-200 ">
                            <div className="flex items-center justify-between mb-2">
                                <label className="font-semibold text-slate-900 flex items-center gap-1.5">
                                    <Layers className="w-4 h-4 text-blue-600" />
                                    <span>PO Subplate Line Items</span>
                                    <span className="text-slate-400 font-normal">
                                        ({formData.items.length}{" "}
                                        {formData.items.length === 1
                                            ? "line"
                                            : "lines"}
                                        )
                                    </span>
                                </label>
                                <div className="flex items-center gap-2">
                                    {modalEstimatedWeightKg > 0 && (
                                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-semibold flex items-center gap-1">
                                            <Scale className="w-3.5 h-3.5 text-emerald-600" />
                                            Est. Total: ~{modalEstimatedWeightKg.toLocaleString()} kg
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleAddPlateRow}
                                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition shadow-sm"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Plate Line</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item, idx) => {
                                    const rowSubplateOptions = subplateOptions.map((opt) => {
                                        const isSelectedInOtherRow = formData.items.some(
                                            (it, i) => i !== idx && Number(it.plateid) === Number(opt.value)
                                        );
                                        return {
                                            ...opt,
                                            disabled: opt.disabled || isSelectedInOtherRow,
                                            disabledReason: isSelectedInOtherRow ? "Already added" : opt.disabledReason,
                                        };
                                    });

                                    // If current item.plateid is not in rowSubplateOptions, add it so ERPSelect displays it properly
                                    if (item.plateid && !rowSubplateOptions.some((opt) => Number(opt.value) === Number(item.plateid))) {
                                        const foundSp = allSubplates.find((sp) => sp.id === Number(item.plateid));
                                        if (foundSp) {
                                            rowSubplateOptions.unshift({
                                                value: foundSp.id,
                                                label: foundSp.platename,
                                                badge: `Qty: ${foundSp.sqty}`,
                                                badgeVariant: "amber" as const,
                                                disabled: false,
                                                disabledReason: undefined,
                                            });
                                        }
                                    }

                                    const itemPlateRemQty = item.plateid ? getPlateRemainingQty(item.plateid) : null;
                                    const otherLinesQty = formData.items
                                        .filter((it, i) => i !== idx && it.plateid && Number(it.plateid) === Number(item.plateid))
                                        .reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
                                    const maxAllowedQty = itemPlateRemQty !== null ? Math.max(0, itemPlateRemQty - otherLinesQty) : null;
                                    const isExceeding = maxAllowedQty !== null && Number(item.qty) > maxAllowedQty;

                                    return (
                                        <div
                                            key={idx}
                                            className="p-3 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 relative shadow-2xs"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                                                        #{String(idx + 1).padStart(2, "0")}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                                                        Line Item
                                                    </span>
                                                </div>
                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRemovePlateRow(
                                                                idx,
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md transition"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline font-medium">Remove</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Row 1: Subplate Selector & Material Type */}
                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-start">
                                                {/* 1. Subplate Selector */}
                                                <div className="sm:col-span-7">
                                                    <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                                                        Subplate{" "}
                                                        <span className="text-rose-500">
                                                            *
                                                        </span>
                                                    </label>
                                                    <ERPSelect
                                                        required
                                                        value={item.plateid}
                                                        onChange={(val) =>
                                                            handleSelectPlate(
                                                                idx,
                                                                val ? Number(val) : "",
                                                            )
                                                        }
                                                        options={rowSubplateOptions}
                                                        placeholder={
                                                            !formData.projectid
                                                                ? "Select Mould first"
                                                                : platesForSelectedProject.length === 0
                                                                  ? "No plates found for this mould"
                                                                  : "Select Subplate"
                                                        }
                                                        searchPlaceholder="Search subplate..."
                                                        disabled={
                                                            !formData.projectid ||
                                                            platesForSelectedProject.length === 0
                                                        }
                                                    />
                                                </div>

                                                {/* 2. Material Type (READONLY) */}
                                                <div className="sm:col-span-5">
                                                    <label className="block text-[11px] text-slate-600 mb-1 font-medium truncate" title="Material Type (Auto-populated)">
                                                        Material Type{" "}
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            (Readonly)
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={item.materialtype}
                                                        placeholder="Auto from plate"
                                                        className="w-full h-9 px-2.5 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-700 text-xs cursor-not-allowed font-medium select-none truncate"
                                                        title="Material type is read-only and auto-populated from the selected subplate"
                                                    />
                                                </div>
                                            </div>

                                            {/* Row 2: Dimensions, Remaining Qty, Order Qty, Rate */}
                                            <div className="grid grid-cols-12 gap-2.5 sm:gap-3 items-start">
                                                {/* 3. Dimensions / Required Material */}
                                                <div className="col-span-12 sm:col-span-6">
                                                    <label className="block text-[11px] text-slate-600 mb-1 font-medium truncate" title="Required Material / Dimensions">
                                                        Req. Material / Dims
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.material}
                                                        onChange={(e) =>
                                                            handleUpdateItem(
                                                                idx,
                                                                "material",
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="e.g. 955 x 955 x 65 mm"
                                                        className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs text-slate-800"
                                                    />
                                                </div>

                                                {/* 4. Remaining Qty (sqty) */}
                                                <div className="col-span-4 sm:col-span-2">
                                                    <label className="block text-[11px] text-slate-600 mb-1 font-medium text-center truncate" title="Remaining Quantity">
                                                        Rem. Qty
                                                    </label>
                                                    <input
                                                        type="text"
                                                        disabled
                                                        value={
                                                            item.plateid
                                                                ? (getPlateRemainingQty(item.plateid) ?? "—")
                                                                : "—"
                                                        }
                                                        className="w-full h-9 px-2 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-700 text-xs cursor-not-allowed font-mono font-bold text-center select-none"
                                                        title="Remaining quantity to order"
                                                    />
                                                </div>

                                                {/* 5. Order Qty (qty) */}
                                                <div className="col-span-4 sm:col-span-2">
                                                    <label className="block text-[11px] text-slate-600 mb-1 font-medium text-center truncate">
                                                        Order Qty{" "}
                                                        <span className="text-rose-500">
                                                            *
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={maxAllowedQty !== null && maxAllowedQty > 0 ? maxAllowedQty : undefined}
                                                        required
                                                        value={item.qty}
                                                        onWheel={(e) => {
                                                            // Mouse wheel adjustment bounded between 1 and maxAllowedQty
                                                            const currentQty = Number(item.qty) || 1;
                                                            const maxLimit = maxAllowedQty !== null && maxAllowedQty > 0 ? maxAllowedQty : 99999;
                                                            if (e.deltaY < 0) {
                                                                // Wheel UP -> increment up to maxLimit
                                                                if (currentQty < maxLimit) {
                                                                    handleUpdateItem(idx, "qty", currentQty + 1);
                                                                }
                                                            } else if (e.deltaY > 0) {
                                                                // Wheel DOWN -> decrement down to 1
                                                                if (currentQty > 1) {
                                                                    handleUpdateItem(idx, "qty", currentQty - 1);
                                                                }
                                                            }
                                                        }}
                                                        onInput={(e) => {
                                                            // Synchronously clamp native DOM value immediately if mouse wheel or stepper exceeds limit
                                                            const target = e.currentTarget;
                                                            const val = Number(target.value);
                                                            if (maxAllowedQty !== null && maxAllowedQty > 0 && val > maxAllowedQty) {
                                                                target.value = String(maxAllowedQty);
                                                                handleUpdateItem(idx, "qty", maxAllowedQty);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => {
                                                            // Disallow negative, plus, exponential, and decimal
                                                            if (["e", "E", "+", "-", "."].includes(e.key)) {
                                                                e.preventDefault();
                                                                return;
                                                            }
                                                            // ArrowUp increments by 1 up to maxAllowedQty
                                                            if (e.key === "ArrowUp") {
                                                                e.preventDefault();
                                                                const current = Number(item.qty) || 1;
                                                                const maxLimit = maxAllowedQty !== null && maxAllowedQty > 0 ? maxAllowedQty : 99999;
                                                                if (current < maxLimit) {
                                                                    handleUpdateItem(idx, "qty", current + 1);
                                                                }
                                                                return;
                                                            }
                                                            // ArrowDown decrements by 1 down to 1
                                                            if (e.key === "ArrowDown") {
                                                                e.preventDefault();
                                                                const current = Number(item.qty) || 1;
                                                                if (current > 1) {
                                                                    handleUpdateItem(idx, "qty", current - 1);
                                                                }
                                                                return;
                                                            }
                                                            // Block typing any digit that would cause the number to exceed maxAllowedQty
                                                            if (/^[0-9]$/.test(e.key)) {
                                                                const input = e.currentTarget;
                                                                const start = input.selectionStart ?? 0;
                                                                const end = input.selectionEnd ?? 0;
                                                                const currentVal = input.value;
                                                                const nextValStr = currentVal.slice(0, start) + e.key + currentVal.slice(end);
                                                                const nextNum = Number(nextValStr);
                                                                if (maxAllowedQty !== null && maxAllowedQty > 0 && nextNum > maxAllowedQty) {
                                                                    e.preventDefault();
                                                                    return;
                                                                }
                                                            }
                                                        }}
                                                        onPaste={(e) => {
                                                            const pasteText = e.clipboardData.getData("text").trim();
                                                            const pasteNum = Number(pasteText);
                                                            if (isNaN(pasteNum) || (maxAllowedQty !== null && maxAllowedQty > 0 && pasteNum > maxAllowedQty)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            if (raw === "") {
                                                                handleUpdateItem(idx, "qty", "");
                                                                return;
                                                            }
                                                            const val = Number(raw);
                                                            if (isNaN(val)) return;
                                                            // If wheel, stepper, or typing ever exceeds maxAllowedQty, clamp to maxAllowedQty
                                                            if (maxAllowedQty !== null && maxAllowedQty > 0 && val > maxAllowedQty) {
                                                                handleUpdateItem(idx, "qty", maxAllowedQty);
                                                                return;
                                                            }
                                                            handleUpdateItem(idx, "qty", Math.max(1, val));
                                                        }}
                                                        onBlur={(e) => {
                                                            const current = Number(e.target.value);
                                                            if (!e.target.value || isNaN(current) || current < 1) {
                                                                handleUpdateItem(idx, "qty", 1);
                                                            } else if (maxAllowedQty !== null && maxAllowedQty > 0 && current > maxAllowedQty) {
                                                                handleUpdateItem(idx, "qty", maxAllowedQty);
                                                            }
                                                        }}
                                                        className={`w-full h-9 px-2 bg-white border rounded-lg focus:outline-none focus:ring-2 text-xs text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition ${
                                                            isExceeding
                                                                ? "border-rose-400 bg-rose-50/40 text-rose-700 ring-1 ring-rose-400 focus:ring-rose-500/20 focus:border-rose-500"
                                                                : "border-slate-200 text-slate-800 focus:ring-blue-500/20 focus:border-blue-500"
                                                        }`}
                                                    />
                                                </div>

                                                {/* 6. Rate (₹) / Price (Optional) */}
                                                <div className="col-span-4 sm:col-span-2">
                                                    <label className="block text-[11px] text-slate-600 mb-1 font-medium text-right truncate">
                                                        Rate (₹){" "}
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            (Opt)
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={item.rate !== undefined && item.rate !== null ? item.rate : ""}
                                                        onChange={(e) =>
                                                            handleUpdateItem(
                                                                idx,
                                                                "rate",
                                                                e.target.value === "" ? "" : Number(e.target.value),
                                                            )
                                                        }
                                                        placeholder=""
                                                        className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs text-right font-medium text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    title="Leave empty to display '—' in the PO voucher"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 ">
                            <button
                                type="button"
                                onClick={handleClosePOModal}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition btn-interactive"
                            >
                                Cancel
                            </button>
                            <MotionButton
                                type="submit"
                                disabled={Boolean(editingPO?.is_fully_received)}
                                loading={
                                    createPurchaseMutation.isPending ||
                                    updatePurchaseMutation.isPending
                                }
                                variant="primary"
                                size="sm"
                            >
                                {editingPO
                                    ? "Update Purchase Order"
                                    : "Submit Purchase Order"}
                            </MotionButton>
                        </div>
                    </form>
                </Modal>

                {/* Delete Confirmation Modal */}
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Confirm Purchase Order Deletion"
                    description="Safely cancel and archive this purchase order record"
                    size="sm"
                >
                    {deleteTarget && (
                        <div className="text-xs space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 ">
                                        Confirm Purchase Order Deletion
                                    </h4>
                                    <p className="text-slate-500">
                                        This action will soft-delete the order
                                    </p>
                                </div>
                            </div>
                            {deleteTarget.has_inward ? (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2.5">
                                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                                    <div>
                                        <span className="font-bold block">Deletion Blocked</span>
                                        <span>This purchase order cannot be deleted because raw material has already been inwarded at the workshop gate.</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-600 leading-relaxed">
                                    Do you really want to delete Purchase Order{" "}
                                    <span className="font-semibold text-slate-900 ">
                                        &quot;{deleteTarget.srno}&quot;
                                    </span>{" "}
                                    for mould {deleteTarget.projectid}? This will
                                    soft-delete the order.
                                </p>
                            )}
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 ">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition btn-interactive"
                                >
                                    Cancel
                                </button>
                                {!deleteTarget.has_inward && (
                                    <MotionButton
                                        type="button"
                                        onClick={handleConfirmDelete}
                                        loading={deletePurchaseMutation.isPending}
                                        variant="danger"
                                        size="sm"
                                        loadingText="Deleting..."
                                        successText="PO Deleted!"
                                    >
                                        Yes, Delete PO
                                    </MotionButton>
                                )}
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </AppLayout>
    );
}

export default function PurchasePage() {
    return (
        <Suspense
            fallback={
                <AppLayout>
                    <div className="p-6 space-y-4">
                        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
                        <TableSkeletonRows rows={8} columns={6} />
                    </div>
                </AppLayout>
            }
        >
            <PurchasePageContent />
        </Suspense>
    );
}
