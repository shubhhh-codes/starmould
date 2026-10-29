"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
    Users,
    Plus,
    Search,
    Building2,
    Phone,
    Mail,
    MapPin,
    Pencil,
    Trash2,
    FileSpreadsheet,
    Printer,
    X,
    AlertCircle,
    CheckCircle2,
    Truck,
    Layers,
    RefreshCw,
    Loader2,
    ShieldCheck,
    Lock,
    Landmark,
    CreditCard,
    FileText,
} from "lucide-react";
import type { Customer, Vendor } from "@/lib/supabase/types";
import { TableSkeletonRows, CardGridSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { motion, AnimatePresence } from "motion/react";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useIsRestoring } from "@tanstack/react-query";
import {
    useVendorsQuery,
    useCreateVendorMutation,
    useUpdateVendorMutation,
    useDeleteVendorMutation,
} from "@/lib/query/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";

// Supported exact usertypes derived directly from legacy customer/index.blade.php & CustomerController.php
export type UsertypeOption = "Customer" | "Vendor" | "Transport" | "Other";

const USERTYPE_CONFIG: Record<
    string,
    { label: string; badge: string; icon: React.ElementType }
> = {
    Customer: {
        label: "Customer",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: Building2,
    },
    Vendor: {
        label: "Vendor",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        icon: Layers,
    },
    Transport: {
        label: "Transport",
        badge: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Truck,
    },
    Other: {
        label: "Other",
        badge: "bg-slate-100 text-slate-700 border-slate-200",
        icon: Users,
    },
};

function CustomerPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role_id === 0;
    const { hasPermission } = useRolePermissions();
    const canCreateVendor = hasPermission("action_create_vendor");
    const canEditVendor = hasPermission("action_edit_vendor");
    const canDeleteVendor = hasPermission("action_delete_vendor");

    const tabParam = searchParams?.get("tab") as UsertypeOption | "All" | null;
    const urlSearch = searchParams?.get("search") || searchParams?.get("q") || "";

    const isCustomerMode = false;

    const [activeTab, setActiveTab] = useState<"All" | UsertypeOption>(
        tabParam && ["All", "Vendor", "Transport", "Other"].includes(tabParam)
            ? tabParam
            : "All"
    );
    const [searchQuery, setSearchQuery] = useState(urlSearch);
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    // Sync tab and search when search params change in URL
    useEffect(() => {
        const currentParam = searchParams?.get("tab") as UsertypeOption | "All" | null;
        if (currentParam && ["All", "Vendor", "Transport", "Other"].includes(currentParam)) {
            setActiveTab(currentParam);
            setCurrentPage(1);
        } else {
            setActiveTab("All");
            setCurrentPage(1);
        }
        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [searchParams, urlSearch]);

    // TanStack Query hooks: fetch all vendor records from public.vendors
    const vendorsQuery = useVendorsQuery({
        pageSize: 2000,
    });

    const createVendorMutation = useCreateVendorMutation();
    const updateVendorMutation = useUpdateVendorMutation();
    const deleteVendorMutation = useDeleteVendorMutation();

    const isRestoring = useIsRestoring();
    const rawVendors = vendorsQuery.data?.vendors || [];
    type VendorRow = Vendor & { customername: string; usertype: UsertypeOption };
    const customers = useMemo<VendorRow[]>(() => {
        return (rawVendors as Vendor[]).map((v: Vendor) => ({
            ...v,
            customername: v.vendor_name,
            mobile: v.mobile || null,
            mobile1: v.mobile1 || null,
            email: v.email || null,
            address: v.address || null,
            initials: v.initials || "",
            usertype: (v.vendor_type === "Transporter" ? "Transport" : "Vendor") as UsertypeOption,
        }));
    }, [rawVendors]);
    const hasLoadedData = customers.length > 0 || (!!vendorsQuery.data && !vendorsQuery.isLoading);
    const isLoading = isRestoring || (!hasLoadedData && vendorsQuery.isLoading);

    const showNotification = useCallback(
        (type: "success" | "error", message: string) => {
            setNotification({ type, message });
            setTimeout(() => {
                setNotification((curr) =>
                    curr?.message === message ? null : curr,
                );
            }, 4000);
        },
        [],
    );

    const fetchCustomers = () => {
        vendorsQuery.refetch();
    };

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"add" | "edit">("add");
    const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

    // Form states
    const [formData, setFormData] = useState<{
        id?: number;
        customername: string;
        initials: string;
        mobile: string;
        mobile1: string;
        email: string;
        address: string;
        usertype: UsertypeOption;
        vendor_code: string;
        city: string;
        gstin: string;
        pan: string;
        bank_name: string;
        account_no: string;
        ifsc_code: string;
        contact_person: string;
    }>({
        customername: "",
        initials: "",
        mobile: "",
        mobile1: "",
        email: "",
        address: "",
        usertype: "Customer",
        vendor_code: "",
        city: "",
        gstin: "",
        pan: "",
        bank_name: "",
        account_no: "",
        ifsc_code: "",
        contact_person: "",
    });

    // Validation messages (replicates legacy checkusername & checkinitials & checkvendorcode)
    const [initialError, setInitialError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [vendorCodeError, setVendorCodeError] = useState<string | null>(null);
    const [modalFormError, setModalFormError] = useState<string | null>(null);

    // Delete modal state
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter and search
    const filteredCustomers = useMemo(() => {
        return customers.filter((c) => {
            // Module Mode Isolation
            if (isCustomerMode) {
                if (c.usertype !== "Customer") return false;
            } else {
                // In Vendor / Transport mode, strictly exclude Customer records
                if (c.usertype === "Customer") return false;
                if (activeTab !== "All" && c.usertype !== activeTab) {
                    return false;
                }
            }
            // Search query
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (c.customername && c.customername.toLowerCase().includes(q)) ||
                (c.initials && c.initials.toLowerCase().includes(q)) ||
                (c.vendor_code && c.vendor_code.toLowerCase().includes(q)) ||
                (c.city && c.city.toLowerCase().includes(q)) ||
                (c.gstin && c.gstin.toLowerCase().includes(q)) ||
                (c.pan && c.pan.toLowerCase().includes(q)) ||
                (c.bank_name && c.bank_name.toLowerCase().includes(q)) ||
                (c.mobile && c.mobile.toLowerCase().includes(q)) ||
                (c.mobile1 && c.mobile1.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q))
            );
        });
    }, [customers, isCustomerMode, activeTab, searchQuery]);

    const { getRowHighlightClass } = useTableHighlight(filteredCustomers, {
        currentPage,
        pageSize,
        onPageChange: setCurrentPage,
    });

    // Counts by category
    const counts = useMemo(() => {
        const map: Record<string, number> = {
            All: customers.length,
            Customer: 0,
            Vendor: 0,
            Transport: 0,
            Other: 0,
        };
        customers.forEach((c) => {
            if (map[c.usertype] !== undefined) {
                map[c.usertype]++;
            }
        });
        return map;
    }, [customers]);

    // Pagination slice
    const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredCustomers.slice(start, start + pageSize);
    }, [filteredCustomers, currentPage, pageSize]);

    // Handle open Add modal with RBAC aware default
    const handleOpenAdd = (preferredType?: UsertypeOption) => {
        setModalMode("add");
        setSelectedCustomer(null);

        let defaultType: UsertypeOption = "Customer";
        if (isCustomerMode) {
            defaultType = "Customer";
        } else {
            if (preferredType && preferredType !== "Customer") {
                defaultType = preferredType;
            } else if (activeTab === "Transport" || activeTab === "Other") {
                defaultType = activeTab;
            } else {
                defaultType = "Vendor";
            }
        }

        setFormData({
            customername: "",
            initials: "",
            mobile: "",
            mobile1: "",
            email: "",
            address: "",
            usertype: defaultType,
            vendor_code: "",
            city: "",
            gstin: "",
            pan: "",
            bank_name: "",
            account_no: "",
            ifsc_code: "",
            contact_person: "",
        });
        setInitialError(null);
        setNameError(null);
        setVendorCodeError(null);
        setModalFormError(null);
        setIsModalOpen(true);
    };

    // Handle open Edit modal
    const handleOpenEdit = (customer: any) => {
        if (!canEditVendor) {
            return;
        }
        setModalMode("edit");
        setSelectedCustomer(customer);
        setFormData({
            id: customer.id,
            customername: customer.customername || "",
            initials: customer.initials || "",
            mobile: customer.mobile || "",
            mobile1: customer.mobile1 || "",
            email: customer.email || "",
            address: customer.address || "",
            usertype: (customer.usertype as UsertypeOption) || "Customer",
            vendor_code: customer.vendor_code || "",
            city: customer.city || "",
            gstin: customer.gstin || "",
            pan: customer.pan || "",
            bank_name: customer.bank_name || "",
            account_no: customer.account_no || "",
            ifsc_code: customer.ifsc_code || "",
            contact_person: customer.contact_person || "",
        });
        setInitialError(null);
        setNameError(null);
        setVendorCodeError(null);
        setModalFormError(null);
        setIsModalOpen(true);
    };

    // Legacy validation: checkinitials
    const validateInitials = (val: string) => {
        const clean = val.replace(/\s+/g, "").toUpperCase().slice(0, 5);
        setFormData((prev) => ({ ...prev, initials: clean }));
        if (!clean) {
            setInitialError("Initials are required (max 5 characters).");
            return false;
        }
        if (modalMode === "add") {
            const exists = customers.some(
                (c) => c.initials && c.initials.toUpperCase() === clean,
            );
            if (exists) {
                setInitialError("Initial already exists!");
                return false;
            }
        }
        setInitialError(null);
        return true;
    };

    // Legacy validation: checkusername
    const validateCustomerName = (val: string) => {
        const clean = val.trim();
        if (!clean) {
            setNameError("Name is required.");
            return false;
        }
        const currentId = selectedCustomer?.id;
        const exists = customers.some(
            (c) =>
                c.customername &&
                c.customername.trim().toLowerCase() === clean.toLowerCase() &&
                c.id !== currentId,
        );
        if (exists) {
            setNameError("Name already exists.");
            return false;
        }
        setNameError(null);
        return true;
    };

    // Real-time vendor code validation
    const validateVendorCode = (val: string) => {
        const clean = val.trim().toUpperCase();
        const isRequired = formData.usertype === "Vendor";
        if (!clean) {
            if (isRequired) {
                setVendorCodeError("Vendor code is required.");
                return false;
            }
            setVendorCodeError(null);
            return true;
        }
        const currentId = selectedCustomer?.id;
        const exists = customers.some(
            (c) =>
                c.vendor_code &&
                c.vendor_code.trim().toUpperCase() === clean &&
                c.id !== currentId,
        );
        if (exists) {
            setVendorCodeError("Vendor code already exists.");
            return false;
        }
        setVendorCodeError(null);
        return true;
    };

    const checkVendorCodeRemote = async (val: string) => {
        const clean = val.trim().toUpperCase();
        if (!clean) return true;
        try {
            const currentId = selectedCustomer?.id;
            const excludeParam = currentId ? `&excludeId=${currentId}` : "";
            const res = await fetch(`/api/vendors?checkVendorCode=${encodeURIComponent(clean)}${excludeParam}`);
            const data = await res.json();
            if (data.exists) {
                setVendorCodeError("Vendor code already exists.");
                return false;
            }
        } catch {
            // fallback to local check
        }
        return true;
    };

    // Handle form submission (Add / Update via live Supabase API)
    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setModalFormError(null);
        setIsSubmitting(true);

        try {
            const isNameValid = validateCustomerName(formData.customername);
            const isInitialValid =
                modalMode === "edit" ? true : validateInitials(formData.initials);
            const isCodeValidLocal = validateVendorCode(formData.vendor_code);
            let isCodeValidRemote = true;
            if (isCodeValidLocal && formData.vendor_code?.trim()) {
                isCodeValidRemote = await checkVendorCodeRemote(formData.vendor_code);
            }

            if (!isNameValid || !isInitialValid || !isCodeValidLocal || !isCodeValidRemote) {
                if (!formData.vendor_code?.trim() && formData.usertype === "Vendor") {
                    setModalFormError("Vendor code is required.");
                } else if (!isCodeValidLocal || !isCodeValidRemote) {
                    setModalFormError("Vendor code already exists.");
                }
                setIsSubmitting(false);
                return;
            }

            // Mobile 1 & 2 validation (if provided, must be exactly 10 digits)
            const cleanMobile = formData.mobile ? formData.mobile.replace(/\D/g, "").slice(0, 10) : "";
            if (formData.mobile && cleanMobile.length !== 10) {
                setModalFormError("Mobile No. 1 must be exactly 10 numeric digits.");
                showNotification("error", "Mobile No. 1 must be exactly 10 numeric digits.");
                setIsSubmitting(false);
                return;
            }
            const cleanMobile1 = formData.mobile1 ? formData.mobile1.replace(/\D/g, "").slice(0, 10) : "";
            if (formData.mobile1 && cleanMobile1.length !== 10) {
                setModalFormError("Mobile No. 2 must be exactly 10 numeric digits.");
                showNotification("error", "Mobile No. 2 must be exactly 10 numeric digits.");
                setIsSubmitting(false);
                return;
            }

            // RBAC client-side guard
            if (!isAdmin && formData.usertype === "Customer") {
                showNotification(
                    "error",
                    "Access Denied: Only Administrators are authorized to create Customer records.",
                );
                setIsSubmitting(false);
                return;
            }
            if (modalMode === "add") {
                const result =
                    await createVendorMutation.mutateAsync({
                    ...formData,
                    vendor_name: formData.customername,
                    vendor_type: formData.usertype === "Transport" ? "Transporter" : "Supplier",
                });
                showNotification(
                    "success",
                    `${formData.usertype} "${result.customer?.customername || formData.customername}" added successfully.`,
                );
                setIsModalOpen(false);
            } else if (modalMode === "edit" && selectedCustomer) {
                const result =
                    await updateVendorMutation.mutateAsync({
                    ...formData,
                    vendor_name: formData.customername,
                    vendor_type: formData.usertype === "Transport" ? "Transporter" : "Supplier",
                });
                showNotification(
                    "success",
                    `${formData.usertype} "${result.customer?.customername || formData.customername}" updated successfully.`,
                );
                setIsModalOpen(false);
            }
        } catch (err: unknown) {
            let msg =
                err instanceof Error ? err.message : "Error saving record";
            if (
                msg.toLowerCase().includes("vendor code already exists") ||
                msg.includes("idx_vendors_vendor_code_unique") ||
                msg.includes("vendor_code")
            ) {
                msg = "Vendor code already exists.";
                setVendorCodeError("Vendor code already exists.");
            } else if (msg.includes("idx_vendors_initials_unique") || msg.toLowerCase().includes("initial already exists")) {
                msg = "Initial already exists!";
                setInitialError("Initial already exists!");
            } else if (msg.includes("vendor_name") || msg.toLowerCase().includes("vendor name already exists")) {
                msg = "Vendor name already exists.";
                setNameError("Vendor name already exists.");
            }
            setModalFormError(msg);
            showNotification("error", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle soft delete via live Supabase API
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        if (!canDeleteVendor) {
            setDeleteTarget(null);
            return;
        }
        try {
            setIsDeleting(true);
            await deleteVendorMutation.mutateAsync(deleteTarget.id);
            showNotification(
                "success",
                `${deleteTarget.usertype || "Record"} "${deleteTarget.customername}" deleted successfully.`,
            );
            setDeleteTarget(null);
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Error deleting record";
            showNotification("error", msg);
        } finally {
            setIsDeleting(false);
        }
    };

    // Export CSV function
    const handleExportCSV = () => {
        const headers = [
            "ID",
            "Name",
            "Initials",
            "Vendor Code",
            "City",
            "GSTIN",
            "PAN",
            "Bank Name",
            "Account No",
            "IFSC Code",
            "Contact Person",
            "Mobile 1",
            "Mobile 2",
            "Email",
            "Address",
            "Type",
        ];
        const rows = filteredCustomers.map((c) => [
            c.id,
            `"${(c.customername || "").replace(/"/g, '""')}"`,
            `"${c.initials || ""}"`,
            `"${c.vendor_code || ""}"`,
            `"${(c.city || "").replace(/"/g, '""')}"`,
            `"${c.gstin || ""}"`,
            `"${c.pan || ""}"`,
            `"${(c.bank_name || "").replace(/"/g, '""')}"`,
            `"${c.account_no || ""}"`,
            `"${c.ifsc_code || ""}"`,
            `"${(c.contact_person || "").replace(/"/g, '""')}"`,
            `"${c.mobile || ""}"`,
            `"${c.mobile1 || ""}"`,
            `"${c.email || ""}"`,
            `"${(c.address || "").replace(/"/g, '""')}"`,
            `"${c.usertype || ""}"`,
        ]);
        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute(
            "download",
            `starmould_entities_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <AppLayout>
            <div className="space-y-6 w-full">
                {/* Toast Notification */}
                {notification && (
                    <div
                        className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 text-xs font-medium ${
                            notification.type === "success"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                    >
                        {notification.type === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span>{notification.message}</span>
                        <button
                            onClick={() => setNotification(null)}
                            className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                {/* Module Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="overflow-hidden">
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1"
                            >
                                {isCustomerMode ? (
                                    <>
                                        <Building2 className="h-3.5 w-3.5 text-blue-600" />
                                        <span>Master Data</span>
                                        <span>/</span>
                                        <span className="text-slate-600">Customer Creator</span>
                                    </>
                                ) : (
                                    <>
                                        <Truck className="h-3.5 w-3.5 text-blue-600" />
                                        <span>Master Data</span>
                                        <span>/</span>
                                        <span className="text-slate-600">Vendor / Transport</span>
                                    </>
                                )}
                            </motion.div>
                        </div>
                        <div className="overflow-hidden">
                            <motion.h1
                                initial={{ opacity: 0, y: "100%" }}
                                animate={{ opacity: 1, y: "0%" }}
                                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                                className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2"
                            >
                                {isCustomerMode ? "Customer Creator" : "Vendor & Transport Management"}
                            </motion.h1>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isCustomerMode
                                ? "Central directory for client customers and workpiece mould owners (Admin restricted)"
                                : "Manage registered suppliers, logistics transporters, and outsourced service providers"}
                        </p>
                    </div>
                </div>

                {/* Top Action Bar & Stat Tabs */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Filter Category Tabs with Fluid Sliding Pill */}
                    <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-xl relative select-none">
                        {(["All", "Vendor", "Transport", "Other"] as const).map((tab) => {
                            const isActive = activeTab === tab;
                            const count = tab === "All"
                                ? (counts.Vendor || 0) + (counts.Transport || 0) + (counts.Other || 0)
                                : counts[tab] || 0;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab);
                                        setCurrentPage(1);
                                        router.replace(tab === "All" ? "/vendors" : `/vendors?tab=${tab}`, { scroll: false });
                                    }}
                                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer ${
                                        isActive
                                            ? "text-slate-900 font-semibold"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="vendor-filter-pill"
                                            transition={{
                                                duration: 0.18,
                                                ease: [0.16, 1, 0.3, 1],
                                            }}
                                            className="absolute inset-0 bg-white rounded-lg shadow-xs border border-slate-200/80 z-0 pointer-events-none"
                                        />
                                    )}
                                    <span className="relative z-10">{tab}</span>
                                    <span
                                        className={`relative z-10 px-1.5 py-0.5 rounded-md text-[10px] font-mono transition-colors duration-150 ${
                                            isActive
                                                ? "bg-slate-100 text-slate-800"
                                                : "bg-slate-200/60 text-slate-500"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={fetchCustomers}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs disabled:opacity-50 cursor-pointer"
                            title="Refresh customer data from Supabase"
                        >
                            <RefreshCw
                                className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`}
                            />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs cursor-pointer"
                            title="Export filtered records to CSV/Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs cursor-pointer"
                            title="Print data table"
                        >
                            <Printer className="w-4 h-4 text-slate-500" />
                            <span>Print</span>
                        </button>

                        {/* Dedicated Admin-Only Customer Creation Button */}
                        {isCustomerMode && isAdmin && (
                            <button
                                onClick={() => handleOpenAdd("Customer")}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs shadow-blue-600/30 transition active:scale-95 cursor-pointer"
                                title="Add a new client customer (Admin Exclusive)"
                            >
                                <Building2 className="w-4 h-4" />
                                <span>Add Customer</span>
                                <span className="text-[10px] bg-blue-500/50 px-1.5 py-0.2 rounded font-normal">Admin</span>
                            </button>
                        )}

                        {/* Creation Button for Vendors / Transporters / Others */}
                        {!isCustomerMode && canCreateVendor && (
                            <button
                                onClick={() => handleOpenAdd(activeTab === "Transport" ? "Transport" : activeTab === "Other" ? "Other" : "Vendor")}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs shadow-indigo-600/30 transition active:scale-95 cursor-pointer"
                                title="Add a supplier, transport provider, or external partner"
                            >
                                <Truck className="w-4 h-4" />
                                <span>Add {activeTab === "Transport" ? "Transporter" : activeTab === "Other" ? "Partner" : "Vendor"}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Read-Only Notice on Customer Tab for Non-Admins */}
                {activeTab === "Customer" && !isAdmin && (
                    <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in">
                        <div className="flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                <strong>Customer Directory (Read-Only)</strong>: Customer creation and modifications are restricted exclusively to System Administrators. You can view contact and billing details.
                            </span>
                        </div>
                        {canCreateVendor && (
                            <button
                                onClick={() => handleOpenAdd("Vendor")}
                                className="px-3 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] rounded-lg border border-amber-300 transition shrink-0 cursor-pointer self-start sm:self-auto"
                            >
                                + Add Vendor / Partner Instead
                            </button>
                        )}
                    </div>
                )}

                {/* Search & Filter Toolbar */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
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
                                placeholder="Search by name, initials, phone, email, address..."
                                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="text-xs text-slate-500">
                                Rows per page:
                            </span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto w-full custom-scrollbar">
                        <table className="w-full min-w-[1100px] text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-3 px-4 w-[24%]">Vendor / Partner</th>
                                    <th className="py-3 px-3 w-[8%] text-center">
                                        Initials
                                    </th>
                                    <th className="py-3 px-3 w-[14%]">
                                        City & Address
                                    </th>
                                    <th className="py-3 px-3 w-[15%]">
                                        Tax & Banking
                                    </th>
                                    <th className="py-3 px-3 w-[14%]">Contact</th>
                                    <th className="py-3 px-3 w-[9%] text-center">
                                        Type
                                    </th>
                                    <th className="py-3 px-4 w-[10%] text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <motion.tbody
                                key={`${activeTab}-${currentPage}-${searchQuery ? "q" : ""}`}
                                initial={{ opacity: 0.4 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                                className="divide-y divide-slate-100"
                            >
                                {isLoading ? (
                                    <TableSkeletonRows columns={8} rows={8} />
                                ) : paginatedCustomers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="py-12 text-center text-slate-400"
                                        >
                                            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p>
                                                No customer or vendor records
                                                found.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedCustomers.map((c) => {
                                        const typeCfg =
                                            USERTYPE_CONFIG[c.usertype] ||
                                            USERTYPE_CONFIG["Other"];
                                        const TypeIcon = typeCfg.icon;
                                        const isCustomerRecord = c.usertype === "Customer";

                                        return (
                                            <tr
                                                key={c.id}
                                                id={`row-${c.id}`}
                                                className={`hover:bg-slate-50/70 transition-colors ${getRowHighlightClass(c.id)}`}
                                            >
                                                {/* Name & Vendor Code */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-200/60">
                                                            {(
                                                                c.initials ||
                                                                "CO"
                                                            ).slice(0, 2)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-semibold text-slate-800 line-clamp-1">
                                                                {c.customername}
                                                            </span>
                                                            {c.vendor_code && (
                                                                <span className="inline-block mt-0.5 font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200/80">
                                                                    Code: {c.vendor_code}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Initials */}
                                                <td className="py-3 px-3 text-center">
                                                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                                        {c.initials || "—"}
                                                    </span>
                                                </td>

                                                {/* City & Address */}
                                                <td className="py-3 px-3 text-slate-600 max-w-[180px]">
                                                    {c.city ? (
                                                        <div className="font-medium text-slate-800 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="truncate">{c.city}</span>
                                                        </div>
                                                    ) : null}
                                                    {c.address ? (
                                                        <div
                                                            className="text-[11px] text-slate-500 truncate"
                                                            title={c.address}
                                                        >
                                                            {c.address}
                                                        </div>
                                                    ) : !c.city ? (
                                                        <span className="text-slate-400 text-[11px]">—</span>
                                                    ) : null}
                                                </td>

                                                {/* Tax & Banking */}
                                                <td className="py-3 px-3">
                                                    <div className="space-y-1">
                                                        {c.gstin ? (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold"
                                                                title={`GSTIN: ${c.gstin}${c.pan ? ` | PAN: ${c.pan}` : ''}`}
                                                            >
                                                                GST: {c.gstin.slice(0, 10)}...
                                                            </span>
                                                        ) : null}
                                                        {c.bank_name ? (
                                                            <div
                                                                className="flex items-center gap-1 text-[10px] text-slate-600 truncate"
                                                                title={`Bank: ${c.bank_name}${c.account_no ? ` | A/C: ${c.account_no}` : ''}${c.ifsc_code ? ` | IFSC: ${c.ifsc_code}` : ''}`}
                                                            >
                                                                <Landmark className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span className="truncate max-w-[130px] font-medium">{c.bank_name}</span>
                                                            </div>
                                                        ) : null}
                                                        {!c.gstin && !c.bank_name && (
                                                            <span className="text-slate-400 text-[11px]">—</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Contact: Phone & Email */}
                                                <td className="py-3 px-3 text-slate-700">
                                                    {c.mobile ? (
                                                        <div className="flex items-center gap-1 text-[11px]">
                                                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="font-mono">{c.mobile}</span>
                                                        </div>
                                                    ) : null}
                                                    {c.email ? (
                                                        <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-[140px]" title={c.email}>
                                                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="truncate">{c.email}</span>
                                                        </div>
                                                    ) : null}
                                                    {!c.mobile && !c.email && (
                                                        <span className="text-slate-400 text-[11px]">—</span>
                                                    )}
                                                </td>

                                                {/* Type */}
                                                <td className="py-3 px-3 text-center">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${typeCfg.badge}`}
                                                    >
                                                        <TypeIcon className="w-3 h-3 shrink-0" />
                                                        <span>
                                                            {typeCfg.label}
                                                        </span>
                                                    </span>
                                                </td>

                                                {/* Actions: Edit & Delete with RBAC Guards */}
                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canEditVendor && (
                                                            <button
                                                                onClick={() =>
                                                                    handleOpenEdit(c)
                                                                }
                                                                className="px-2.5 py-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition cursor-pointer"
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                        {canDeleteVendor && (
                                                            <button
                                                                onClick={() =>
                                                                    setDeleteTarget(c)
                                                                }
                                                                className="px-2 py-1 text-[11px] font-medium text-rose-600 border border-rose-200 rounded hover:bg-rose-50 transition cursor-pointer"
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </motion.tbody>
                        </table>
                    </div>

                    {/* Mobile Card-List Fallback (< md) */}
                    <div className="block md:hidden p-3 space-y-3">
                        {isLoading ? (
                            <CardGridSkeleton count={4} />
                        ) : paginatedCustomers.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                No customer or vendor records found.
                            </div>
                        ) : (
                            paginatedCustomers.map((c) => {
                                const typeCfg =
                                    USERTYPE_CONFIG[c.usertype] ||
                                    USERTYPE_CONFIG["Other"];
                                const TypeIcon = typeCfg.icon;
                                const isCustomerRecord = c.usertype === "Customer";

                                return (
                                    <div
                                        key={c.id}
                                        id={`row-mob-${c.id}`}
                                        className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs ${getRowHighlightClass(c.id)}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-200/60">
                                                    {(c.initials || "CO").slice(
                                                        0,
                                                        2,
                                                    )}
                                                </div>
                                                <span className="font-semibold text-slate-900 line-clamp-1">
                                                    {c.customername}
                                                </span>
                                            </div>
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${typeCfg.badge}`}
                                            >
                                                <TypeIcon className="w-2.5 h-2.5 shrink-0" />
                                                <span>{typeCfg.label}</span>
                                            </span>
                                        </div>

                                        {(c.vendor_code || c.city) && (
                                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                                                {c.vendor_code && (
                                                    <span className="font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                                                        Code: {c.vendor_code}
                                                    </span>
                                                )}
                                                {c.city && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700">
                                                        <MapPin className="w-3 h-3 text-slate-400" />
                                                        {c.city}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {(c.gstin || c.bank_name) && (
                                            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/40 text-[10px]">
                                                {c.gstin && (
                                                    <span className="font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                                        GST: {c.gstin}
                                                    </span>
                                                )}
                                                {c.bank_name && (
                                                    <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                                                        <Landmark className="w-3 h-3 text-slate-400" />
                                                        {c.bank_name}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">
                                                    Mobile:
                                                </span>
                                                <span className="font-mono text-slate-700">
                                                    {c.mobile || "—"}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">
                                                    Alt Mobile:
                                                </span>
                                                <span className="font-mono text-slate-700">
                                                    {c.mobile1 || "—"}
                                                </span>
                                            </div>
                                        </div>

                                        {c.email && (
                                            <div className="text-[11px] text-slate-600 truncate">
                                                <span className="text-slate-400 text-[10px]">
                                                    Email:{" "}
                                                </span>
                                                {c.email}
                                            </div>
                                        )}

                                        {c.address && (
                                            <div className="text-[11px] text-slate-500 line-clamp-1">
                                                <span className="text-slate-400 text-[10px]">
                                                    Address:{" "}
                                                </span>
                                                {c.address}
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                                            {canEditVendor && (
                                                <button
                                                    onClick={() =>
                                                        handleOpenEdit(c)
                                                    }
                                                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {canDeleteVendor && (
                                                <button
                                                    onClick={() =>
                                                        setDeleteTarget(c)
                                                    }
                                                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Table Footer / Pagination */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500">
                        <div>
                            Showing{" "}
                            <span className="font-semibold text-slate-800">
                                {filteredCustomers.length === 0
                                    ? 0
                                    : (currentPage - 1) * pageSize + 1}
                            </span>{" "}
                            to{" "}
                            <span className="font-semibold text-slate-800">
                                {Math.min(
                                    currentPage * pageSize,
                                    filteredCustomers.length,
                                )}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-slate-800">
                                {filteredCustomers.length}
                            </span>{" "}
                            entries
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() =>
                                    setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage === 1}
                                className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-700 cursor-pointer"
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
                                className="px-2.5 py-1 text-xs border border-slate-200 rounded bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-slate-700 cursor-pointer"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* ADD / EDIT MODAL */}
                {/* ========================================================================= */}
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={
                        modalMode === "add"
                            ? formData.usertype === "Customer"
                                ? "Add New Customer (Admin Only)"
                                : "Add New Vendor / Logistics Partner"
                            : formData.usertype === "Customer"
                              ? "Edit Customer Profile (Admin Only)"
                              : "Edit Partner Profile"
                    }
                    description={
                        formData.usertype === "Customer"
                            ? "Configure customer organization profile, billing contact, and master initials"
                            : "Register suppliers, transport logistics providers, or external workshop services"
                    }
                    size="lg"
                >
                    <form
                        onSubmit={handleSubmitForm}
                        className="space-y-4 text-xs"
                    >
                        {modalFormError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span className="font-medium">{modalFormError}</span>
                            </div>
                        )}
                        {/* Name */}
                        <div>
                            <label className="block font-medium text-slate-700 mb-1">
                                Name <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.customername}
                                onChange={(e) => {
                                    setFormData((p) => ({
                                        ...p,
                                        customername: e.target.value,
                                    }));
                                    if (nameError) validateCustomerName(e.target.value);
                                }}
                                onBlur={(e) => validateCustomerName(e.target.value)}
                                placeholder="Enter organization or provider name"
                                className={`w-full px-3 py-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 ${
                                    nameError
                                        ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                                        : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                                }`}
                            />
                            {nameError && (
                                <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{nameError}</span>
                                </p>
                            )}
                        </div>

                        {/* Initials */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="font-medium text-slate-700">
                                    Initials <span className="text-rose-500">*</span>{" "}
                                    <span className="text-[11px] text-slate-400 font-normal">
                                        (Max 5 letters, uppercase)
                                    </span>
                                </label>
                                {modalMode === "edit" && (
                                    <span className="text-[10px] text-amber-600 font-medium">
                                        Readonly on existing records
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                required
                                maxLength={5}
                                readOnly={modalMode === "edit"}
                                value={formData.initials}
                                onChange={(e) => {
                                    const clean = e.target.value
                                        .replace(/\s+/g, "")
                                        .toUpperCase()
                                        .slice(0, 5);
                                    setFormData((p) => ({ ...p, initials: clean }));
                                    if (initialError) validateInitials(clean);
                                }}
                                onBlur={(e) => validateInitials(e.target.value)}
                                placeholder="e.g. BSK, SSPOL, BIPLT"
                                className={`w-full px-3 py-2 font-mono uppercase bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 ${
                                    modalMode === "edit"
                                        ? "bg-slate-100 cursor-not-allowed text-slate-500"
                                        : ""
                                } ${
                                    initialError
                                        ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                                        : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                                }`}
                            />
                            {initialError && (
                                <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{initialError}</span>
                                </p>
                            )}
                        </div>

                        {/* Contact Person */}
                        <div>
                            <label className="block font-medium text-slate-700 mb-1">
                                Contact Person Name
                            </label>
                            <input
                                type="text"
                                value={formData.contact_person}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        contact_person: e.target.value,
                                    }))
                                }
                                placeholder="Primary executive, owner, or liaison name"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Mobile No. 1 & Mobile No. 2 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Mobile No. 1 <span className="text-[11px] text-slate-400 font-normal">(10 digits)</span>
                                </label>
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={formData.mobile}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                                        }))
                                    }
                                    placeholder="10-digit primary mobile"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Mobile No. 2 <span className="text-[11px] text-slate-400 font-normal">(10 digits)</span>
                                </label>
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={formData.mobile1}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            mobile1: e.target.value.replace(/\D/g, "").slice(0, 10),
                                        }))
                                    }
                                    placeholder="10-digit secondary mobile"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block font-medium text-slate-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        email: e.target.value,
                                    }))
                                }
                                placeholder="official.email@company.com"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Address */}
                        <div>
                            <label className="block font-medium text-slate-700 mb-1">
                                Address
                            </label>
                            <textarea
                                rows={2}
                                value={formData.address}
                                onChange={(e) =>
                                    setFormData((p) => ({
                                        ...p,
                                        address: e.target.value,
                                    }))
                                }
                                placeholder="Factory, office, or workshop address"
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>

                        {/* Financial, Tax & Location Information (Optional) */}
                        <div className="pt-3 border-t border-slate-200 space-y-3">
                            <div className="flex items-center gap-2">
                                <Landmark className="w-4 h-4 text-indigo-600" />
                                <span className="font-semibold text-slate-800 text-xs">
                                    Tax, Banking & Location Details
                                </span>
                            </div>

                            {/* Vendor Code & City */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        Vendor Code {formData.usertype === "Vendor" && <span className="text-rose-500">*</span>}
                                        <span className="text-[11px] text-slate-400 font-normal ml-1">
                                            (e.g. SM14YZ6D)
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        required={formData.usertype === "Vendor"}
                                        value={formData.vendor_code}
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase();
                                            setFormData((p) => ({
                                                ...p,
                                                vendor_code: val,
                                            }));
                                            if (vendorCodeError) validateVendorCode(val);
                                        }}
                                        onPaste={(e) => {
                                            const pasted = e.clipboardData.getData("text").trim().toUpperCase();
                                            validateVendorCode(pasted);
                                            checkVendorCodeRemote(pasted);
                                        }}
                                        onBlur={(e) => {
                                            if (validateVendorCode(e.target.value)) {
                                                checkVendorCodeRemote(e.target.value);
                                            }
                                        }}
                                        placeholder="SM______"
                                        className={`w-full px-3 py-2 uppercase font-mono bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 ${
                                            vendorCodeError
                                                ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500 text-rose-700 bg-rose-50/50"
                                                : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                                        }`}
                                    />
                                    {vendorCodeError && (
                                        <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span>{vendorCodeError}</span>
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        City / Location
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                city: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Rajkot, Ahmedabad"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* GSTIN & PAN */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        GSTIN Number
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={15}
                                        value={formData.gstin}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                gstin: e.target.value.toUpperCase(),
                                            }))
                                        }
                                        placeholder="24AAXFD0282E1ZG"
                                        className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        PAN Number
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={10}
                                        value={formData.pan}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                pan: e.target.value.toUpperCase(),
                                            }))
                                        }
                                        placeholder="AAXFD0282E"
                                        className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Bank Name, Account No & IFSC */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.bank_name}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                bank_name: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. HDFC Bank, Axis Bank"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.account_no}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                account_no: e.target.value,
                                            }))
                                        }
                                        placeholder="Account number"
                                        className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-slate-700 mb-1">
                                        IFSC Code
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={11}
                                        value={formData.ifsc_code}
                                        onChange={(e) =>
                                            setFormData((p) => ({
                                                ...p,
                                                ifsc_code: e.target.value.toUpperCase(),
                                            }))
                                        }
                                        placeholder="HDFC0009028"
                                        className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Usertype Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="font-medium text-slate-700">
                                    Account Type <span className="text-rose-500">*</span>
                                </label>
                                {modalMode === "edit" ? (
                                    <span className="text-[10px] text-amber-600 font-medium">
                                        Type cannot be modified once created
                                    </span>
                                ) : null}
                            </div>
                            {isCustomerMode ? (
                                <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-blue-50/70 border-blue-200 text-blue-900 text-xs font-semibold">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    <span>Client Customer (Mould Owner / Billing Entity)</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2">
                                    {(["Vendor", "Transport", "Other"] as UsertypeOption[]).map((type) => {
                                        const isChecked = formData.usertype === type;
                                        const isEditDisabled = modalMode === "edit";
                                        return (
                                            <label
                                                key={type}
                                                className={`flex items-center gap-2 p-2.5 rounded-lg border transition text-xs ${
                                                    isEditDisabled
                                                        ? isChecked
                                                            ? "bg-slate-100 border-slate-300 text-slate-700 font-semibold cursor-not-allowed"
                                                            : "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400"
                                                        : isChecked
                                                        ? "bg-blue-50 border-blue-500 text-blue-800 font-semibold cursor-pointer"
                                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="usertype"
                                                    value={type}
                                                    disabled={isEditDisabled}
                                                    checked={isChecked}
                                                    onChange={() =>
                                                        setFormData((p) => ({
                                                            ...p,
                                                            usertype: type,
                                                        }))
                                                    }
                                                    className="text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                                                />
                                                <span>{type}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <MotionButton
                                type="submit"
                                loading={isSubmitting}
                                disabled={isSubmitting}
                                variant="primary"
                                size="sm"
                            >
                                {modalMode === "add"
                                    ? formData.usertype === "Customer"
                                        ? "Save Customer"
                                        : "Save Partner"
                                    : "Update Record"}
                            </MotionButton>
                        </div>
                    </form>
                </Modal>

                {/* ========================================================================= */}
                {/* DELETE CONFIRMATION MODAL */}
                {/* ========================================================================= */}
                <Modal
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Confirm Soft Deletion"
                    description="Safely archive this customer or partner record"
                    size="sm"
                >
                    {deleteTarget && (
                        <div className="text-xs space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900">
                                        Confirm Soft Deletion
                                    </h4>
                                    <p className="text-slate-500">
                                        This action will soft-delete the record
                                    </p>
                                </div>
                            </div>
                            <p className="text-slate-600 leading-relaxed">
                                Do you really want to delete{" "}
                                <span className="font-semibold text-slate-900">
                                    &quot;{deleteTarget.customername}&quot;
                                </span>{" "}
                                ({deleteTarget.initials})? This will mark the record with{" "}
                                <code className="px-1 bg-slate-100 rounded">
                                    deleted_at
                                </code>{" "}
                                timestamp.
                            </p>
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <MotionButton
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    loading={isDeleting}
                                    variant="danger"
                                    size="sm"
                                >
                                    Yes, Delete Record
                                </MotionButton>
                            </div>
                        </div>
                    )}
                </Modal>
            </div>
        </AppLayout>
    );
}

export function VendorsPage() {
    return (
        <Suspense
            fallback={
                <AppLayout>
                    <div className="p-6 space-y-4">
                        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
                        <CardGridSkeleton count={4} />
                    </div>
                </AppLayout>
            }
        >
            <CustomerPageContent />
        </Suspense>
    );
}

export { VendorsPage as CustomerPage };
