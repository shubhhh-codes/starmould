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
} from "lucide-react";
import type { Customer } from "@/lib/supabase/types";
import { TableSkeletonRows, CardGridSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import {
    useCustomersQuery,
    useCreateCustomerMutation,
    useUpdateCustomerMutation,
    useDeleteCustomerMutation,
} from "@/lib/query/hooks";
import { useAuth } from "@/components/providers/auth-provider";

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

    const initialTab = searchParams?.get("tab") as UsertypeOption | "All" | null;
    const urlSearch = searchParams?.get("search") || searchParams?.get("q") || "";
    const [activeTab, setActiveTab] = useState<"All" | UsertypeOption>(
        initialTab && ["All", "Customer", "Vendor", "Transport", "Other"].includes(initialTab)
            ? initialTab
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

    // Sync tab and search when search params change in URL (e.g. from sidebar links or global search)
    useEffect(() => {
        const tabParam = searchParams?.get("tab") as UsertypeOption | "All" | null;
        if (tabParam && ["All", "Customer", "Vendor", "Transport", "Other"].includes(tabParam)) {
            setActiveTab(tabParam);
            setCurrentPage(1);
        }
        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [searchParams, urlSearch]);

    // TanStack Query hooks: fetch all records so category counts are accurate across all tabs
    const customersQuery = useCustomersQuery({
        pageSize: 2000,
    });

    const createCustomerMutation = useCreateCustomerMutation();
    const updateCustomerMutation = useUpdateCustomerMutation();
    const deleteCustomerMutation = useDeleteCustomerMutation();

    const customers = customersQuery.data?.customers || [];
    const isLoading = customersQuery.isLoading;

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
        customersQuery.refetch();
    };

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"add" | "edit">("add");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
        null,
    );

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
    }>({
        customername: "",
        initials: "",
        mobile: "",
        mobile1: "",
        email: "",
        address: "",
        usertype: "Customer",
    });

    // Validation messages (replicates legacy checkusername & checkinitials)
    const [initialError, setInitialError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);

    // Delete modal state
    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter and search
    const filteredCustomers = useMemo(() => {
        return customers.filter((c) => {
            // Tab filter
            if (activeTab !== "All" && c.usertype !== activeTab) {
                return false;
            }
            // Search query
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (c.customername && c.customername.toLowerCase().includes(q)) ||
                (c.initials && c.initials.toLowerCase().includes(q)) ||
                (c.mobile && c.mobile.toLowerCase().includes(q)) ||
                (c.mobile1 && c.mobile1.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q))
            );
        });
    }, [customers, activeTab, searchQuery]);

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

        let defaultType: UsertypeOption = "Vendor";
        if (isAdmin) {
            defaultType = preferredType || (activeTab !== "All" ? activeTab : "Customer");
        } else {
            // Non-admin can only create Vendor, Transport, Other
            if (preferredType && preferredType !== "Customer") {
                defaultType = preferredType;
            } else if (activeTab !== "All" && activeTab !== "Customer") {
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
        });
        setInitialError(null);
        setNameError(null);
        setIsModalOpen(true);
    };

    // Handle open Edit modal
    const handleOpenEdit = (customer: Customer) => {
        if (!isAdmin && customer.usertype === "Customer") {
            showNotification(
                "error",
                "Access Denied: Customer records can only be modified by Administrators.",
            );
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
        });
        setInitialError(null);
        setNameError(null);
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

    // Handle form submission (Add / Update via live Supabase API)
    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        const isNameValid = validateCustomerName(formData.customername);
        const isInitialValid =
            modalMode === "edit" ? true : validateInitials(formData.initials);

        if (!isNameValid || !isInitialValid) return;

        // RBAC client-side guard
        if (!isAdmin && formData.usertype === "Customer") {
            showNotification(
                "error",
                "Access Denied: Only Administrators are authorized to create Customer records.",
            );
            return;
        }

        try {
            setIsSubmitting(true);
            if (modalMode === "add") {
                const result =
                    await createCustomerMutation.mutateAsync(formData);
                showNotification(
                    "success",
                    `${formData.usertype} "${result.customer?.customername || formData.customername}" added successfully.`,
                );
                setIsModalOpen(false);
            } else if (modalMode === "edit" && selectedCustomer) {
                const result =
                    await updateCustomerMutation.mutateAsync(formData);
                showNotification(
                    "success",
                    `${formData.usertype} "${result.customer?.customername || formData.customername}" updated successfully.`,
                );
                setIsModalOpen(false);
            }
        } catch (err: unknown) {
            const msg =
                err instanceof Error ? err.message : "Error saving record";
            showNotification("error", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle soft delete via live Supabase API
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        if (!isAdmin && deleteTarget.usertype === "Customer") {
            showNotification(
                "error",
                "Access Denied: Customer records can only be deleted by Administrators.",
            );
            setDeleteTarget(null);
            return;
        }
        try {
            setIsDeleting(true);
            await deleteCustomerMutation.mutateAsync(deleteTarget.id);
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
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                            <Building2 className="h-3.5 w-3.5 text-blue-600" />
                            <span>Master Data</span>
                            <span>/</span>
                            <span className="text-slate-600">
                                {isAdmin ? "Customer & Partner Master" : "Vendors, Transport & Partners"}
                            </span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            {isAdmin ? "Customer / Vendor Management" : "Vendor & Logistics Management"}
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Supabase Connected
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isAdmin
                                ? "Central directory for client customers (Admin restricted), vendors, transport logistics & external accounts"
                                : "Manage registered suppliers, logistics transporters, and outsourced service providers"}
                        </p>
                    </div>
                </div>

                {/* Top Action Bar & Stat Tabs */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Filter Category Tabs */}
                    <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 border border-slate-200 rounded-xl">
                        {(
                            [
                                "All",
                                "Customer",
                                "Vendor",
                                "Transport",
                                "Other",
                            ] as const
                        ).map((tab) => {
                            const isActive = activeTab === tab;
                            const count = counts[tab] || 0;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setActiveTab(tab);
                                        setCurrentPage(1);
                                        router.replace(tab === "All" ? "/customer" : `/customer?tab=${tab}`, { scroll: false });
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                        isActive
                                            ? "bg-white text-slate-900 shadow-xs font-semibold border border-slate-200/80"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <span>{tab}</span>
                                    {tab === "Customer" && !isAdmin && (
                                        <span
                                            className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300/60 font-semibold"
                                            title="Read-only access for non-admin roles"
                                        >
                                            Read-Only
                                        </span>
                                    )}
                                    <span
                                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
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
                        {isAdmin && (
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

                        {/* Creation Button for Vendors / Transporters / Others (Accessible to All Permitted Roles) */}
                        <button
                            onClick={() => handleOpenAdd("Vendor")}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition active:scale-95 cursor-pointer ${
                                isAdmin
                                    ? "text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80"
                                    : "text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30"
                            }`}
                            title="Add a supplier, transport provider, or external partner"
                        >
                            <Truck className="w-4 h-4" />
                            <span>Add Vendor / Partner</span>
                        </button>
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
                        <button
                            onClick={() => handleOpenAdd("Vendor")}
                            className="px-3 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] rounded-lg border border-amber-300 transition shrink-0 cursor-pointer self-start sm:self-auto"
                        >
                            + Add Vendor / Partner Instead
                        </button>
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
                        <table className="w-full min-w-[1000px] text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                                <tr>
                                    <th className="py-3 px-4 w-[24%]">Name</th>
                                    <th className="py-3 px-3 w-[8%] text-center">
                                        Initials
                                    </th>
                                    <th className="py-3 px-3 w-[12%]">
                                        Mobile No. 1
                                    </th>
                                    <th className="py-3 px-3 w-[12%]">
                                        Mobile No. 2
                                    </th>
                                    <th className="py-3 px-4 w-[14%]">Email</th>
                                    <th className="py-3 px-4">Address</th>
                                    <th className="py-3 px-3 w-[10%] text-center">
                                        Type
                                    </th>
                                    <th className="py-3 px-4 w-[10%] text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
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
                                                {/* Name */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-200/60">
                                                            {(
                                                                c.initials ||
                                                                "CO"
                                                            ).slice(0, 2)}
                                                        </div>
                                                        <span className="font-semibold text-slate-800 line-clamp-1">
                                                            {c.customername}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Initials */}
                                                <td className="py-3 px-3 text-center">
                                                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                                        {c.initials || "—"}
                                                    </span>
                                                </td>

                                                {/* Mobile No. 1 */}
                                                <td className="py-3 px-3 text-slate-700">
                                                    {c.mobile ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span className="font-mono text-[11px]">
                                                                {c.mobile}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">
                                                            —
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Mobile No. 2 */}
                                                <td className="py-3 px-3 text-slate-700">
                                                    {c.mobile1 ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span className="font-mono text-[11px]">
                                                                {c.mobile1}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">
                                                            —
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Email */}
                                                <td className="py-3 px-4 text-slate-600 truncate max-w-[180px]">
                                                    {c.email ? (
                                                        <div
                                                            className="flex items-center gap-1.5"
                                                            title={c.email}
                                                        >
                                                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span className="truncate">
                                                                {c.email}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">
                                                            —
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Address */}
                                                <td className="py-3 px-4 text-slate-600 max-w-xs">
                                                    {c.address ? (
                                                        <div
                                                            className="flex items-center gap-1.5 truncate"
                                                            title={c.address}
                                                        >
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                            <span className="truncate">
                                                                {c.address}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">
                                                            —
                                                        </span>
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

                                                {/* Actions: Edit & Delete with Admin RBAC Guards */}
                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {isCustomerRecord && !isAdmin ? (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200"
                                                                title="Only Administrators can edit Customer profiles"
                                                            >
                                                                <Lock className="w-3 h-3" />
                                                                Admin Only
                                                            </span>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={() =>
                                                                        handleOpenEdit(
                                                                            c,
                                                                        )
                                                                    }
                                                                    className="px-2.5 py-1 text-[11px] font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition cursor-pointer"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        setDeleteTarget(
                                                                            c,
                                                                        )
                                                                    }
                                                                    className="px-2 py-1 text-[11px] font-medium text-rose-600 border border-rose-200 rounded hover:bg-rose-50 transition cursor-pointer"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
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
                                            {isCustomerRecord && !isAdmin ? (
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-slate-400 bg-slate-100 rounded-lg border border-slate-200"
                                                    title="Only Administrators can edit Customer profiles"
                                                >
                                                    <Lock className="w-3 h-3" />
                                                    Admin Restricted
                                                </span>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() =>
                                                            handleOpenEdit(c)
                                                        }
                                                        className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setDeleteTarget(c)
                                                        }
                                                        className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition flex items-center justify-center cursor-pointer"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
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

                        {/* Mobile No. 1 & Mobile No. 2 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Mobile No. 1
                                </label>
                                <input
                                    type="text"
                                    value={formData.mobile}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            mobile: e.target.value,
                                        }))
                                    }
                                    placeholder="Primary contact phone"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Mobile No. 2
                                </label>
                                <input
                                    type="text"
                                    value={formData.mobile1}
                                    onChange={(e) =>
                                        setFormData((p) => ({
                                            ...p,
                                            mobile1: e.target.value,
                                        }))
                                    }
                                    placeholder="Secondary contact phone"
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

                        {/* Exact Usertype Radio Selector (Strictly restricted for non-admins) */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="font-medium text-slate-700">
                                    Type (usertype) <span className="text-rose-500">*</span>
                                </label>
                                {modalMode === "edit" ? (
                                    <span className="text-[10px] text-amber-600 font-medium">
                                        Type cannot be modified once created
                                    </span>
                                ) : !isAdmin ? (
                                    <span className="text-[10px] text-indigo-600 font-medium flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" />
                                        Customer role restricted to Admin
                                    </span>
                                ) : null}
                            </div>
                            <div
                                className={`grid gap-2 ${
                                    isAdmin
                                        ? "grid-cols-2 sm:grid-cols-4"
                                        : "grid-cols-1 sm:grid-cols-3"
                                }`}
                            >
                                {(
                                    (isAdmin
                                        ? ["Customer", "Vendor", "Transport", "Other"]
                                        : ["Vendor", "Transport", "Other"]) as UsertypeOption[]
                                ).map((type) => {
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

export default function CustomerPage() {
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
