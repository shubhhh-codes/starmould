"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
} from "lucide-react";
import type { Customer } from "@/lib/supabase/types";

// Supported exact usertypes derived directly from legacy customer/index.blade.php & CustomerController.php
export type UsertypeOption = "Customer" | "Vendor" | "Transport" | "Other";

const USERTYPE_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ElementType }
> = {
  Customer: {
    label: "Customer",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
    icon: Building2,
  },
  Vendor: {
    label: "Vendor",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900",
    icon: Layers,
  },
  Transport: {
    label: "Transport",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
    icon: Truck,
  },
  Other: {
    label: "Other",
    badge: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    icon: Users,
  },
};

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeTab, setActiveTab] = useState<"All" | UsertypeOption>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Live Supabase fetch
  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/customers");
      const data = await res.json();
      if (res.ok && Array.isArray(data.customers)) {
        setCustomers(data.customers);
      } else {
        showNotification("error", data.error || "Failed to load customers.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load customers";
      showNotification("error", msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

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

  // Handle open Add modal
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
    });
    setInitialError(null);
    setNameError(null);
    setIsModalOpen(true);
  };

  // Handle open Edit modal
  const handleOpenEdit = (customer: Customer) => {
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
  // Source: CustomerController.php lines 44-50: CustomerModel::where('initials', $initials)->exists()
  const validateInitials = (val: string) => {
    const clean = val.replace(/\s+/g, "").toUpperCase().slice(0, 3);
    setFormData((prev) => ({ ...prev, initials: clean }));
    if (!clean) {
      setInitialError("Initials are required (max 3 characters).");
      return false;
    }
    // On Add: cannot conflict with existing
    if (modalMode === "add") {
      const exists = customers.some(
        (c) => c.initials && c.initials.toUpperCase() === clean
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
  // Source: CustomerController.php lines 29-43: check if customername exists where id <> currentId
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
        c.id !== currentId
    );
    if (exists) {
      setNameError("Customer name already exists.");
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

    try {
      setIsSubmitting(true);
      if (modalMode === "add") {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (!res.ok) {
          showNotification("error", result.error || "Failed to add customer");
          return;
        }
        setCustomers((prev) => [result.customer, ...prev]);
        showNotification("success", `Customer "${result.customer.customername}" added successfully.`);
        setIsModalOpen(false);
      } else if (modalMode === "edit" && selectedCustomer) {
        const res = await fetch("/api/customers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (!res.ok) {
          showNotification("error", result.error || "Failed to update customer");
          return;
        }
        setCustomers((prev) =>
          prev.map((c) => (c.id === selectedCustomer.id ? result.customer : c))
        );
        showNotification("success", `Customer "${result.customer.customername}" updated successfully.`);
        setIsModalOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving customer";
      showNotification("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle soft delete via live Supabase API
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/customers?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) {
        showNotification("error", result.error || "Failed to delete customer");
        return;
      }
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      showNotification("success", `Customer "${deleteTarget.customername}" deleted successfully.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error deleting customer";
      showNotification("error", msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV function (replicates legacy DataTable buttons Excel/CSV)
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
      `starmould_customers_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 text-xs font-medium ${
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-600"
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
              <span className="text-slate-600 dark:text-slate-300">Customer & Vendor Master</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              Customer / Vendor Management
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Supabase Connected
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Directory for clients, suppliers, transport logistics & accounts
            </p>
          </div>
        </div>

        {/* Top Action Bar & Stat Cards */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Filter Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            {(["All", "Customer", "Vendor", "Transport", "Other"] as const).map(
              (tab) => {
                const isActive = activeTab === tab;
                const count = counts[tab] || 0;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span>{tab}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                        isActive
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* Action Buttons: Refresh, Add Customer, Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCustomers}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
              title="Refresh customer data from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              title="Export filtered records to CSV/Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              title="Print data table"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
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
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
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

            <div className="flex items-center gap-3 self-end sm:self-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Rows per page:
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-[24%]">Name</th>
                  <th className="py-3 px-3 w-[8%] text-center">Initials</th>
                  <th className="py-3 px-3 w-[12%]">Mobile No. 1</th>
                  <th className="py-3 px-3 w-[12%]">Mobile No. 2</th>
                  <th className="py-3 px-4 w-[14%]">Email</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-3 w-[10%] text-center">Type</th>
                  <th className="py-3 px-4 w-[10%] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                      <p className="font-medium text-slate-600 dark:text-slate-300">
                        Loading customer records from Supabase...
                      </p>
                    </td>
                  </tr>
                ) : paginatedCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No customer or vendor records found.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((c) => {
                    const typeCfg =
                      USERTYPE_CONFIG[c.usertype] || USERTYPE_CONFIG["Other"];
                    const TypeIcon = typeCfg.icon;

                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-200/60 dark:border-blue-900">
                              {(c.initials || "CO").slice(0, 2)}
                            </div>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                              {c.customername}
                            </span>
                          </div>
                        </td>

                        {/* Initials */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {c.initials || "—"}
                          </span>
                        </td>

                        {/* Mobile No. 1 */}
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                          {c.mobile ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px]">{c.mobile}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Mobile No. 2 */}
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                          {c.mobile1 ? (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px]">{c.mobile1}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[180px]">
                          {c.email ? (
                            <div className="flex items-center gap-1.5" title={c.email}>
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Address */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs">
                          {c.address ? (
                            <div
                              className="flex items-center gap-1.5 truncate"
                              title={c.address}
                            >
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${typeCfg.badge}`}
                          >
                            <TypeIcon className="w-3 h-3 shrink-0" />
                            <span>{typeCfg.label}</span>
                          </span>
                        </td>

                        {/* Actions: Edit & Delete */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-50 dark:hover:bg-blue-950/60 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(c)}
                              className="px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {filteredCustomers.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min(currentPage * pageSize, filteredCustomers.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {filteredCustomers.length}
              </span>{" "}
              entries
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-mono text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ADD / EDIT MODAL (Replicates legacy #exampleModalScrollable1 & form logic) */}
        {/* ========================================================================= */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {modalMode === "add"
                      ? "Add New Customer / Vendor"
                      : "Edit Customer / Vendor"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Source: CustomerController.php store() / updatecustomer()
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
                {/* Name */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customername}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, customername: e.target.value }));
                      if (nameError) validateCustomerName(e.target.value);
                    }}
                    onBlur={(e) => validateCustomerName(e.target.value)}
                    placeholder="Enter customer, vendor, or transporter name"
                    className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-lg focus:outline-none focus:ring-2 dark:text-white ${
                      nameError
                        ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                        : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 focus:border-blue-500"
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
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Initials <span className="text-rose-500">*</span>{" "}
                      <span className="text-[11px] text-slate-400 font-normal">
                        (Max 3 letters, uppercase)
                      </span>
                    </label>
                    {modalMode === "edit" && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Readonly on existing records
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    readOnly={modalMode === "edit"}
                    value={formData.initials}
                    onChange={(e) => {
                      const clean = e.target.value
                        .replace(/\s+/g, "")
                        .toUpperCase();
                      setFormData((p) => ({ ...p, initials: clean }));
                      if (initialError) validateInitials(clean);
                    }}
                    onBlur={(e) => validateInitials(e.target.value)}
                    placeholder="e.g. BSK, SSP, BIP"
                    className={`w-full px-3 py-2 font-mono uppercase bg-slate-50 dark:bg-slate-950 border rounded-lg focus:outline-none focus:ring-2 dark:text-white ${
                      modalMode === "edit"
                        ? "bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed text-slate-500"
                        : ""
                    } ${
                      initialError
                        ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                        : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 focus:border-blue-500"
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
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mobile No. 1
                    </label>
                    <input
                      type="text"
                      value={formData.mobile}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, mobile: e.target.value }))
                      }
                      placeholder="Primary contact phone"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mobile No. 2
                    </label>
                    <input
                      type="text"
                      value={formData.mobile1}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, mobile1: e.target.value }))
                      }
                      placeholder="Secondary contact phone"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="official.email@company.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Address
                  </label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, address: e.target.value }))
                    }
                    placeholder="Factory, office, or workshop address"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>

                {/* Exact Usertype Radio Selector (Source: customer/index.blade.php lines 98-131, locked on edit lines 388-390) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Type (usertype) <span className="text-rose-500">*</span>
                    </label>
                    {modalMode === "edit" && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Locked on existing records (index.blade.php:391)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(["Customer", "Vendor", "Transport", "Other"] as const).map(
                      (type) => {
                        const isChecked = formData.usertype === type;
                        const isEditDisabled = modalMode === "edit";
                        return (
                          <label
                            key={type}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border transition text-xs ${
                              isEditDisabled
                                ? isChecked
                                  ? "bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-not-allowed"
                                  : "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400"
                                : isChecked
                                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-800 dark:text-blue-300 font-semibold cursor-pointer"
                                : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                            }`}
                          >
                            <input
                              type="radio"
                              name="usertype"
                              value={type}
                              disabled={isEditDisabled}
                              checked={isChecked}
                              onChange={() =>
                                setFormData((p) => ({ ...p, usertype: type }))
                              }
                              className="text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                            />
                            <span>{type}</span>
                          </label>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{modalMode === "add" ? "Save Customer" : "Update Customer"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE CONFIRMATION MODAL */}
        {/* ========================================================================= */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Confirm Soft Deletion
                  </h4>
                  <p className="text-slate-500">
                    Source: CustomerController.php destroy()
                  </p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Do you really want to delete{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  "{deleteTarget.customername}"
                </span>{" "}
                ({deleteTarget.initials})? This will mark the record with{" "}
                <code className="px-1 bg-slate-100 dark:bg-slate-800 rounded">
                  deleted_at
                </code>{" "}
                timestamp.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Yes, Delete Record</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
