"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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
    Upload,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Copy,
    Check,
} from "lucide-react";
import type { Customer } from "@/lib/supabase/types";
import { TableSkeletonRows, CardGridSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useIsRestoring } from "@tanstack/react-query";
import {
    useCustomersQuery,
    useCreateCustomerMutation,
    useUpdateCustomerMutation,
    useDeleteCustomerMutation,
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
    const canCreateCustomer = hasPermission("action_create_customer");
    const canEditCustomer = hasPermission("action_edit_customer");
    const canDeleteCustomer = hasPermission("action_delete_customer");

    const urlSearch = searchParams?.get("search") || searchParams?.get("q") || "";
    const isCustomerMode = true;
    const activeTab: UsertypeOption = "Customer";
    const [searchQuery, setSearchQuery] = useState(urlSearch);
    const [pageSize, setPageSize] = useState(25);
    const [currentPage, setCurrentPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        if (urlSearch) {
            setSearchQuery(urlSearch);
        }
    }, [urlSearch]);

    // TanStack Query hooks: fetch all records so category counts are accurate across all tabs
    const customersQuery = useCustomersQuery({
        pageSize: 2000,
    });

    const createCustomerMutation = useCreateCustomerMutation();
    const updateCustomerMutation = useUpdateCustomerMutation();
    const deleteCustomerMutation = useDeleteCustomerMutation();

    const isRestoring = useIsRestoring();
    const customers = customersQuery.data?.customers || [];
    const hasLoadedData = customers.length > 0 || (!!customersQuery.data && !customersQuery.isLoading);
    const isLoading = isRestoring || (!hasLoadedData && customersQuery.isLoading);

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
        customer_code: string;
        gstin: string;
        pan: string;
        contact_person: string;
    }>({
        customername: "",
        initials: "",
        mobile: "",
        mobile1: "",
        email: "",
        address: "",
        usertype: "Customer",
        customer_code: "",
        gstin: "",
        pan: "",
        contact_person: "",
    });

    // Excel Import states
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importPreviewData, setImportPreviewData] = useState<any[]>([]);
    const [importFileName, setImportFileName] = useState("");
    const [isImporting, setIsImporting] = useState(false);

    // Sorting states
    type SortField =
        | "cusCode"
        | "companyName"
        | "gstin"
        | "pan"
        | "contactPerson"
        | "contactNo"
        | "email";
    type SortOrder = "asc" | "desc";

    const [sortField, setSortField] = useState<SortField | null>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

    // Click-to-copy state
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = (text: string, key: string, label: string = "Copied") => {
        if (!text || text === "—" || text === "-") return;
        if (typeof navigator !== "undefined" && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedKey(key);
            showNotification("success", `${label} copied: ${text}`);
            setTimeout(() => {
                setCopiedKey((prev) => (prev === key ? null : prev));
            }, 1500);
        }
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
        setCurrentPage(1);
    };

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return (
                <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition shrink-0" />
            );
        }
        return sortOrder === "asc" ? (
            <ArrowUp className="w-3 h-3 text-blue-600 shrink-0 font-bold" />
        ) : (
            <ArrowDown className="w-3 h-3 text-blue-600 shrink-0 font-bold" />
        );
    };

    // Validation messages (replicates legacy checkusername & checkinitials & checkcustomercode)
    const [initialError, setInitialError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [customerCodeError, setCustomerCodeError] = useState<string | null>(null);
    const [modalFormError, setModalFormError] = useState<string | null>(null);

    // Delete modal state
    const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Filter, search, and sort
    const filteredCustomers = useMemo(() => {
        const list = customers.filter((c) => {
            // In Customers module, strictly show only Customer records
            if (c.usertype !== "Customer") return false;
            // Search query
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                (c.customername && c.customername.toLowerCase().includes(q)) ||
                (c.initials && c.initials.toLowerCase().includes(q)) ||
                (c.customer_code && c.customer_code.toLowerCase().includes(q)) ||
                (c.pan_code && c.pan_code.toLowerCase().includes(q)) ||
                (c.gstin && c.gstin.toLowerCase().includes(q)) ||
                (c.pan && c.pan.toLowerCase().includes(q)) ||
                (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
                (c.mobile && c.mobile.toLowerCase().includes(q)) ||
                (c.mobile1 && c.mobile1.toLowerCase().includes(q)) ||
                (c.email && c.email.toLowerCase().includes(q)) ||
                (c.address && c.address.toLowerCase().includes(q))
            );
        });

        if (!sortField) return list;

        return [...list].sort((a, b) => {
            let valA: string | number = "";
            let valB: string | number = "";

            switch (sortField) {
                case "cusCode":
                    valA = (a.customer_code || a.pan_code || "").toLowerCase();
                    valB = (b.customer_code || b.pan_code || "").toLowerCase();
                    break;
                case "companyName":
                    valA = (a.customername || "").toLowerCase();
                    valB = (b.customername || "").toLowerCase();
                    break;
                case "gstin":
                    valA = (a.gstin || "").toLowerCase();
                    valB = (b.gstin || "").toLowerCase();
                    break;
                case "pan":
                    valA = (a.pan || "").toLowerCase();
                    valB = (b.pan || "").toLowerCase();
                    break;
                case "contactPerson":
                    valA = (a.contact_person || "").toLowerCase();
                    valB = (b.contact_person || "").toLowerCase();
                    break;
                case "contactNo":
                    valA = (a.mobile || "").toLowerCase();
                    valB = (b.mobile || "").toLowerCase();
                    break;
                case "email":
                    valA = (a.email || "").toLowerCase();
                    valB = (b.email || "").toLowerCase();
                    break;
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });
    }, [customers, searchQuery, sortField, sortOrder]);

    const { getRowHighlightClass } = useTableHighlight(filteredCustomers, {
        currentPage,
        pageSize,
        onPageChange: setCurrentPage,
    });

    // Pagination slice
    const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredCustomers.slice(start, start + pageSize);
    }, [filteredCustomers, currentPage, pageSize]);

    // Handle open Add modal with RBAC aware default
    const handleOpenAdd = () => {
        setModalMode("add");
        setSelectedCustomer(null);

        setFormData({
            customername: "",
            initials: "",
            mobile: "",
            mobile1: "",
            email: "",
            address: "",
            usertype: "Customer",
            customer_code: "",
            gstin: "",
            pan: "",
            contact_person: "",
        });
        setInitialError(null);
        setNameError(null);
        setCustomerCodeError(null);
        setModalFormError(null);
        setIsModalOpen(true);
    };

    // Handle open Edit modal
    const handleOpenEdit = (customer: Customer) => {
        if (!canEditCustomer) {
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
            customer_code: customer.customer_code || customer.pan_code || customer.initials || "",
            gstin: customer.gstin || "",
            pan: customer.pan || "",
            contact_person: customer.contact_person || "",
        });
        setInitialError(null);
        setNameError(null);
        setCustomerCodeError(null);
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

    // Real-time customer code validation
    const validateCustomerCode = (val: string) => {
        const clean = val.trim().toUpperCase();
        if (!clean) {
            setCustomerCodeError("Customer code is required.");
            return false;
        }
        const currentId = selectedCustomer?.id;
        const exists = customers.some(
            (c) =>
                ((c.customer_code && c.customer_code.trim().toUpperCase() === clean) ||
                 (c.pan_code && c.pan_code.trim().toUpperCase() === clean)) &&
                c.id !== currentId,
        );
        if (exists) {
            setCustomerCodeError("Customer code already exists.");
            return false;
        }
        setCustomerCodeError(null);
        return true;
    };

    const checkCustomerCodeRemote = async (val: string) => {
        const clean = val.trim().toUpperCase();
        if (!clean) return true;
        try {
            const currentId = selectedCustomer?.id;
            const excludeParam = currentId ? "&excludeId=" + currentId : "";
            const res = await fetch("/api/customers?checkCustomerCode=" + encodeURIComponent(clean) + excludeParam);
            const data = await res.json();
            if (data.exists) {
                setCustomerCodeError("Customer code already exists.");
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
        const isNameValid = validateCustomerName(formData.customername);
        const isInitialValid =
            modalMode === "edit" ? true : validateInitials(formData.initials);
        const isCodeValidLocal = validateCustomerCode(formData.customer_code);
        let isCodeValidRemote = true;
        if (isCodeValidLocal && formData.customer_code?.trim()) {
            isCodeValidRemote = await checkCustomerCodeRemote(formData.customer_code);
        }

        if (!isNameValid || !isInitialValid || !isCodeValidLocal || !isCodeValidRemote) {
            if (!formData.customer_code?.trim()) {
                setModalFormError("Customer code is required.");
            } else if (!isCodeValidLocal || !isCodeValidRemote) {
                setModalFormError("Customer code already exists.");
            }
            return;
        }

        // Mobile 1 & 2 validation (if provided, must be exactly 10 digits)
        const cleanMobile = formData.mobile ? formData.mobile.replace(/\D/g, "").slice(0, 10) : "";
        if (formData.mobile && cleanMobile.length !== 10) {
            showNotification("error", "Mobile No. 1 must be exactly 10 numeric digits.");
            return;
        }
        const cleanMobile1 = formData.mobile1 ? formData.mobile1.replace(/\D/g, "").slice(0, 10) : "";
        if (formData.mobile1 && cleanMobile1.length !== 10) {
            showNotification("error", "Mobile No. 2 must be exactly 10 numeric digits.");
            return;
        }

        // RBAC client-side guard
        if (modalMode === "add" && !canCreateCustomer) {
            return;
        }
        if (modalMode === "edit" && !canEditCustomer) {
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
            setModalFormError(msg);
            showNotification("error", msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle soft delete via live Supabase API
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        if (!canDeleteCustomer) {
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

    // Export CSV function matching exact Excel layout
    const handleExportCSV = () => {
        const headers = [
            "Sr. No",
            "Cus. Code",
            "Company Name",
            "GSTIN",
            "PAN No",
            "Authorise Person",
            "Contact No",
            "Mail ID",
        ];
        const rows = filteredCustomers.map((c, idx) => [
            idx + 1,
            `"${c.customer_code || c.pan_code || ""}"`,
            `"${(c.customername || "").replace(/"/g, '""')}"`,
            `"${c.gstin || ""}"`,
            `"${c.pan || ""}"`,
            `"${(c.contact_person || "").replace(/"/g, '""')}"`,
            `"${c.mobile || ""}"`,
            `"${c.email || ""}"`,
        ]);
        const csvContent =
            "data:text/csv;charset=utf-8," +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute(
            "download",
            `STPL_Customer_Details_${new Date().toISOString().slice(0, 10)}.csv`,
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Excel / CSV File Import Handler
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const XLSX = await import("xlsx");
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawJson = XLSX.utils.sheet_to_json<any>(worksheet);

            const parsed = rawJson
                .map((row: any) => {
                    const cusCode =
                        row["Cus. Code"] ||
                        row["Cus Code"] ||
                        row["Customer Code"] ||
                        row["Code"] ||
                        "";
                    const companyName =
                        row["Company Name"] ||
                        row["Customer Name"] ||
                        row["Name"] ||
                        "";
                    const gstin =
                        row["GSTIN"] ||
                        row["GST No"] ||
                        row["GST"] ||
                        "";
                    const pan = row["PAN No"] || row["PAN"] || "";
                    const contactPerson =
                        row["Authorise Person"] ||
                        row["Authorised Person"] ||
                        row["Contact Person"] ||
                        "";
                    const contactNo =
                        row["Contact No"] ||
                        row["Mobile"] ||
                        row["Phone"] ||
                        "";
                    const email =
                        row["Mail ID"] || row["Email"] || row["Mail"] || "";

                    return {
                        cusCode: String(cusCode || "").trim(),
                        companyName: String(companyName || "").trim(),
                        gstin: String(gstin || "").trim().toUpperCase(),
                        pan: String(pan || "").trim().toUpperCase(),
                        contactPerson: String(contactPerson || "").trim(),
                        contactNo: String(contactNo || "").trim(),
                        email: String(email || "").trim(),
                    };
                })
                .filter((r: any) => Boolean(r.companyName));

            if (parsed.length === 0) {
                showNotification("error", "No valid customer rows found in file.");
                return;
            }

            setImportFileName(file.name);
            setImportPreviewData(parsed);
            setIsImportModalOpen(true);
        } catch (err: any) {
            showNotification("error", "Failed to parse Excel file: " + (err.message || "Invalid format"));
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleConfirmImport = async () => {
        if (importPreviewData.length === 0) return;
        try {
            setIsImporting(true);
            const res = await fetch("/api/customers/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customers: importPreviewData }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Import failed");
            }

            showNotification(
                "success",
                data.message || `Successfully imported ${importPreviewData.length} customers.`
            );
            setIsImportModalOpen(false);
            setImportPreviewData([]);
            fetchCustomers();
        } catch (err: any) {
            showNotification("error", err.message || "Failed to import customers");
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6 w-full">
                {/* Toast Notification */}
                {notification && typeof document !== "undefined" && createPortal(
                    <div
                        className={`fixed top-4 right-4 z-[99999] pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl transition-all animate-in fade-in slide-in-from-top-2 text-xs font-medium ${
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
                    </div>,
                    document.body
                )}

                {/* Module Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
                            <Building2 className="h-3.5 w-3.5 text-blue-600" />
                            <span>Master Data</span>
                            <span>/</span>
                            <span className="text-slate-600">Customer Creator</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                            Customer Creator
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Central directory for client customers and workpiece mould owners (Admin restricted)
                        </p>
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
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        {canCreateCustomer && (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition shadow-xs cursor-pointer"
                                title="Import customers from Excel or CSV file"
                            >
                                <Upload className="w-4 h-4 text-indigo-600" />
                                <span>Import Excel</span>
                            </button>
                        )}
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

                        {/* Customer Creation Button */}
                        {canCreateCustomer && (
                            <button
                                onClick={() => handleOpenAdd()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs shadow-blue-600/30 transition active:scale-95 cursor-pointer"
                                title="Add a new client customer"
                            >
                                <Building2 className="w-4 h-4" />
                                <span>Add Customer</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Read-Only Notice on Customer Tab for Non-Authorized Roles */}
                {!isAdmin && !canCreateCustomer && !canEditCustomer && (
                    <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 animate-in fade-in">
                        <div className="flex items-center gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                                <strong>Customer Directory (Read-Only)</strong>: Customer creation and modifications are restricted based on your role permissions. You can view contact and billing details.
                            </span>
                        </div>
                        <button
                            onClick={() => router.push("/vendors")}
                            className="px-3 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] rounded-lg border border-amber-300 transition shrink-0 cursor-pointer self-start sm:self-auto"
                        >
                            Go to Vendor / Transport &rarr;
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

                        <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Sort:</span>
                                <select
                                    value={sortField ? `${sortField}-${sortOrder}` : "none"}
                                    onChange={(e) => {
                                        if (e.target.value === "none") {
                                            setSortField(null);
                                            setSortOrder("asc");
                                        } else {
                                            const [f, o] = e.target.value.split("-") as [SortField, SortOrder];
                                            setSortField(f);
                                            setSortOrder(o);
                                        }
                                        setCurrentPage(1);
                                    }}
                                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700"
                                >
                                    <option value="none">Default Order</option>
                                    <option value="companyName-asc">Company Name (A → Z)</option>
                                    <option value="companyName-desc">Company Name (Z → A)</option>
                                    <option value="cusCode-asc">Customer Code (A → Z)</option>
                                    <option value="cusCode-desc">Customer Code (Z → A)</option>
                                    <option value="gstin-asc">GSTIN (A → Z)</option>
                                    <option value="pan-asc">PAN No (A → Z)</option>
                                    <option value="contactPerson-asc">Authorise Person (A → Z)</option>
                                    <option value="contactNo-asc">Contact No (A → Z)</option>
                                    <option value="email-asc">Mail ID (A → Z)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">
                                    Rows:
                                </span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto w-full custom-scrollbar">
                        <table className="w-full min-w-[1000px] text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px] select-none">
                                <tr>
                                    <th className="py-3 px-3 w-[6%] text-center text-slate-700 font-semibold select-none">
                                        Sr. No
                                    </th>
                                    <th
                                        onClick={() => handleSort("cusCode")}
                                        className="py-3 px-3 w-[11%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by Customer Code"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>Cus. Code</span>
                                            {renderSortIcon("cusCode")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("companyName")}
                                        className="py-3 px-4 w-[22%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by Company Name"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>Company Name</span>
                                            {renderSortIcon("companyName")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("gstin")}
                                        className="py-3 px-3 w-[14%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by GSTIN"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>GSTIN</span>
                                            {renderSortIcon("gstin")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("pan")}
                                        className="py-3 px-3 w-[10%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by PAN No"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>PAN No</span>
                                            {renderSortIcon("pan")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("contactPerson")}
                                        className="py-3 px-3 w-[12%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by Authorise Person"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>Authorise Person</span>
                                            {renderSortIcon("contactPerson")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("contactNo")}
                                        className="py-3 px-3 w-[11%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by Contact No"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>Contact No</span>
                                            {renderSortIcon("contactNo")}
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("email")}
                                        className="py-3 px-3 w-[10%] cursor-pointer hover:bg-slate-100 transition group"
                                        title="Click to sort by Mail ID"
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            <span>Mail ID</span>
                                            {renderSortIcon("email")}
                                        </div>
                                    </th>
                                    <th className="py-3 px-3 w-[4%] text-right">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <TableSkeletonRows columns={9} rows={8} />
                                ) : paginatedCustomers.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={9}
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
                                    paginatedCustomers.map((c, idx) => {
                                        return (
                                            <tr
                                                key={c.id}
                                                id={`row-${c.id}`}
                                                className={`hover:bg-slate-50/70 transition-colors ${getRowHighlightClass(c.id)}`}
                                            >
                                                {/* Sr. No */}
                                                <td className="py-3 px-3 text-center font-mono text-[11px] font-semibold text-slate-500">
                                                    {(currentPage - 1) * pageSize + idx + 1}
                                                </td>

                                                {/* Cus. Code */}
                                                <td className="py-3 px-3">
                                                    {(c.customer_code || c.pan_code) ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(c.customer_code || c.pan_code || "", `code-${c.id}`, "Customer Code")}
                                                            title="Click to copy Customer Code"
                                                            className="group/code inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200/80 hover:border-indigo-300 whitespace-nowrap transition cursor-pointer"
                                                        >
                                                            <span>{c.customer_code || c.pan_code}</span>
                                                            {copiedKey === `code-${c.id}` ? (
                                                                <Check className="w-2.5 h-2.5 text-indigo-700 shrink-0" />
                                                            ) : (
                                                                <Copy className="w-2.5 h-2.5 text-indigo-400 opacity-60 group-hover/code:opacity-100 transition shrink-0" />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">—</span>
                                                    )}
                                                </td>

                                                {/* Company Name */}
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 border border-blue-200/60">
                                                            {(c.initials || "CO").slice(0, 2)}
                                                        </div>
                                                        <span className="font-semibold text-slate-900 line-clamp-1" title={c.customername}>
                                                            {c.customername}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* GSTIN */}
                                                <td className="py-3 px-3">
                                                    {c.gstin ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(c.gstin!, `gst-${c.id}`, "GSTIN")}
                                                            title="Click to copy GSTIN"
                                                            className="group/gst font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-200/80 hover:border-emerald-300 inline-flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer text-left"
                                                        >
                                                            <span>{c.gstin}</span>
                                                            {copiedKey === `gst-${c.id}` ? (
                                                                <span className="flex items-center gap-0.5 text-[9px] text-emerald-700 font-sans font-semibold bg-emerald-100 px-1 py-0.2 rounded">
                                                                    <Check className="w-2.5 h-2.5 shrink-0" /> Copied!
                                                                </span>
                                                            ) : (
                                                                <Copy className="w-2.5 h-2.5 text-emerald-500 opacity-60 group-hover/gst:opacity-100 transition shrink-0" />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">—</span>
                                                    )}
                                                </td>

                                                {/* PAN No */}
                                                <td className="py-3 px-3">
                                                    {c.pan ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopy(c.pan!, `pan-${c.id}`, "PAN")}
                                                            title="Click to copy PAN"
                                                            className="group/pan font-mono text-[11px] font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 px-2 py-0.5 rounded border border-slate-200 hover:border-slate-300 inline-flex items-center gap-1.5 whitespace-nowrap transition cursor-pointer text-left"
                                                        >
                                                            <span>{c.pan}</span>
                                                            {copiedKey === `pan-${c.id}` ? (
                                                                <span className="flex items-center gap-0.5 text-[9px] text-blue-700 font-sans font-semibold bg-blue-100 px-1 py-0.2 rounded">
                                                                    <Check className="w-2.5 h-2.5 shrink-0" /> Copied!
                                                                </span>
                                                            ) : (
                                                                <Copy className="w-2.5 h-2.5 text-slate-400 opacity-60 group-hover/pan:opacity-100 transition shrink-0" />
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <span className="text-slate-400 text-[11px]">—</span>
                                                    )}
                                                </td>

                                                {/* Authorise Person */}
                                                <td className="py-3 px-3 text-slate-700 text-[11px] truncate max-w-[130px]" title={c.contact_person || ""}>
                                                    {c.contact_person || "—"}
                                                </td>

                                                {/* Contact No */}
                                                <td className="py-3 px-3 text-slate-700 font-mono text-[11px] whitespace-nowrap">
                                                    {c.mobile ? (
                                                        <div className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span>{c.mobile}</span>
                                                        </div>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>

                                                {/* Mail ID */}
                                                <td className="py-3 px-3 text-slate-600 text-[11px] truncate max-w-[150px]" title={c.email || ""}>
                                                    {c.email ? (
                                                        <div className="flex items-center gap-1">
                                                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                                            <span className="truncate">{c.email}</span>
                                                        </div>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </td>

                                                {/* Action */}
                                                <td className="py-3 px-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {canEditCustomer && (
                                                            <button
                                                                onClick={() => handleOpenEdit(c)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                                title="Edit Customer"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        {canDeleteCustomer && (
                                                            <button
                                                                onClick={() => setDeleteTarget(c)}
                                                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                                title="Delete Customer"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
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
                                                <div className="min-w-0">
                                                    <span className="font-semibold text-slate-900 line-clamp-1">
                                                        {c.customername}
                                                    </span>
                                                    {c.customer_code && (
                                                        <span className="inline-block mt-0.5 font-mono text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200/80">
                                                            Code: {c.customer_code}
                                                        </span>
                                                    )}
                                                </div>
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
                                                <span className="text-slate-400 block text-[10px]">GSTIN:</span>
                                                <span className="font-mono text-slate-700 text-[11px]">{c.gstin || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">PAN No:</span>
                                                <span className="font-mono text-slate-700 text-[11px]">{c.pan || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Authorise Person:</span>
                                                <span className="text-slate-700 text-[11px] truncate block">{c.contact_person || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[10px]">Contact No:</span>
                                                <span className="font-mono text-slate-700 text-[11px]">{c.mobile || "—"}</span>
                                            </div>
                                        </div>

                                        {c.email && (
                                            <div className="text-[11px] text-slate-600 truncate pt-1">
                                                <span className="text-slate-400 text-[10px]">Mail ID: </span>
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
                                            {canEditCustomer && (
                                                <button
                                                    onClick={() =>
                                                        handleOpenEdit(c)
                                                    }
                                                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center cursor-pointer"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            {canDeleteCustomer && (
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
                            ? "Add New Customer (Admin Only)"
                            : "Edit Customer Profile (Admin Only)"
                    }
                    description="Configure customer organization profile, billing contact, and master initials"
                    size="lg"
                >
                    <form
                        onSubmit={handleSubmitForm}
                        className="space-y-4 text-xs"
                    >
                        {modalFormError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{modalFormError}</span>
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

                        {/* Initials & Customer Code */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="font-medium text-slate-700">
                                        Initials <span className="text-rose-500">*</span>{" "}
                                        <span className="text-[11px] text-slate-400 font-normal">
                                            (Max 5)
                                        </span>
                                    </label>
                                    {modalMode === "edit" && (
                                        <span className="text-[10px] text-amber-600 font-medium">
                                            Readonly
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
                                    placeholder="e.g. BSK"
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

                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Customer Code <span className="text-rose-500">*</span>
                                    <span className="text-[11px] text-slate-400 font-normal ml-1">
                                        (e.g. STC52WQ7)
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.customer_code}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setFormData((p) => ({
                                            ...p,
                                            customer_code: val,
                                        }));
                                        if (customerCodeError) validateCustomerCode(val);
                                    }}
                                    onPaste={(e) => {
                                        const pasted = e.clipboardData.getData("text").trim().toUpperCase();
                                        validateCustomerCode(pasted);
                                        checkCustomerCodeRemote(pasted);
                                    }}
                                    onBlur={(e) => {
                                        if (validateCustomerCode(e.target.value)) {
                                            checkCustomerCodeRemote(e.target.value);
                                        }
                                    }}
                                    placeholder="STC_____"
                                    className={`w-full px-3 py-2 uppercase font-mono bg-slate-50 border rounded-lg focus:outline-none focus:ring-2 ${
                                        customerCodeError
                                            ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500 text-rose-700 bg-rose-50/50"
                                            : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-500"
                                    }`}
                                />
                                {customerCodeError && (
                                    <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                        <span>{customerCodeError}</span>
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* GSTIN & PAN No */}
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
                                    placeholder="e.g. 29AATCA9635K1ZR"
                                    className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    PAN No
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
                                    placeholder="e.g. AATCA9635K"
                                    className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Authorise Person & Contact No */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Authorise Person
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
                                    placeholder="e.g. Akash Kesari, Sanjay Patel"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Contact No <span className="text-[11px] text-slate-400 font-normal">(10 digits)</span>
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
                        </div>

                        {/* Mail ID & Alt Mobile */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Mail ID
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
                            <div>
                                <label className="block font-medium text-slate-700 mb-1">
                                    Alt Mobile / Mobile 2
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
                                    placeholder="10-digit alternate mobile"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
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
                            <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-blue-50/70 border-blue-200 text-blue-900 text-xs font-semibold">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <span>Client Customer (Mould Owner / Billing Entity)</span>
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
                {/* EXCEL IMPORT CONFIRMATION MODAL */}
                {/* ========================================================================= */}
                <Modal
                    isOpen={isImportModalOpen}
                    onClose={() => setIsImportModalOpen(false)}
                    title="Import Customers from Excel / CSV"
                    description={`Ready to import ${importPreviewData.length} records from "${importFileName}"`}
                    size="xl"
                >
                    <div className="space-y-4 text-xs">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                            <p className="font-semibold mb-1">
                                File: {importFileName} ({importPreviewData.length} customers detected)
                            </p>
                            <p className="text-[11px] text-blue-700">
                                Existing customers will be safely updated by Customer Code or Name; new customers will be created automatically.
                            </p>
                        </div>

                        {/* Preview Table */}
                        <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-60 custom-scrollbar">
                            <table className="w-full text-left text-xs min-w-[700px]">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[10px] uppercase">
                                    <tr>
                                        <th className="py-2 px-3">Sr. No</th>
                                        <th className="py-2 px-3">Cus. Code</th>
                                        <th className="py-2 px-3">Company Name</th>
                                        <th className="py-2 px-3">GSTIN</th>
                                        <th className="py-2 px-3">PAN No</th>
                                        <th className="py-2 px-3">Authorise Person</th>
                                        <th className="py-2 px-3">Contact No</th>
                                        <th className="py-2 px-3">Mail ID</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                                    {importPreviewData.slice(0, 10).map((r, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="py-1.5 px-3">{i + 1}</td>
                                            <td className="py-1.5 px-3 font-bold text-indigo-700">{r.cusCode || "—"}</td>
                                            <td className="py-1.5 px-3 font-sans font-medium text-slate-900">{r.companyName}</td>
                                            <td className="py-1.5 px-3">{r.gstin || "—"}</td>
                                            <td className="py-1.5 px-3">{r.pan || "—"}</td>
                                            <td className="py-1.5 px-3 font-sans">{r.contactPerson || "—"}</td>
                                            <td className="py-1.5 px-3">{r.contactNo || "—"}</td>
                                            <td className="py-1.5 px-3 font-sans truncate max-w-[120px]">{r.email || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {importPreviewData.length > 10 && (
                            <p className="text-[11px] text-slate-500 italic text-center">
                                ...and {importPreviewData.length - 10} more records
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                disabled={isImporting}
                                onClick={() => setIsImportModalOpen(false)}
                                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <MotionButton
                                type="button"
                                loading={isImporting}
                                onClick={handleConfirmImport}
                                variant="primary"
                                size="sm"
                            >
                                {isImporting ? "Importing Data..." : `Confirm & Import (${importPreviewData.length})`}
                            </MotionButton>
                        </div>
                    </div>
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

export function CustomersPage() {
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

export { CustomersPage as CustomerPage };
