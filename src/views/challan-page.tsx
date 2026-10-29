"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ArrowUpRight,
  Search,
  Calendar,
  Building2,
  Layers,
  Truck,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  X,
  AlertCircle,
  Clock,
  Printer,
  ShieldAlert,
  CheckCircle2,
  Box,
  FileText,
} from "lucide-react";
import type {
  Challan,
  ChallanItem,
  Customer,
  Subplate,
  ScanProject,
} from "@/lib/supabase/types";
import { KpiCardSkeleton, TableSkeletonRows } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/dialog";
import { CustomerSelect } from "@/components/ui/customer-select";
import { ProjectSelect } from "@/components/ui/project-select";
import { ERPSelect, type ERPSelectOption } from "@/components/ui/erp-select";
import { MotionButton } from "@/components/ui/motion-button";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import { useTableHighlight } from "@/lib/hooks/use-table-highlight";
import { useIsRestoring } from "@tanstack/react-query";
import {
  useChallansQuery,
  useCreateChallanMutation,
  useDeleteChallanMutation,
  useSubplatesByProjectQuery,
  useCustomerDropdownQuery,
  useVendorDropdownQuery,
  useProjectsQuery,
} from "@/lib/query/hooks";

function ChallanPageContent() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();
  const canCreateChallan = hasPermission("action_create_challan");
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || searchParams.get("q") || "";

  const isRestoring = useIsRestoring();
  const { data, isLoading: queryLoading, error: fetchQueryError, refetch } = useChallansQuery();
  const { data: customerLookup = [] } = useCustomerDropdownQuery("Customer");
  const { data: supplierLookup = [] } = useVendorDropdownQuery("Supplier");
  const { data: transporterLookup = [] } = useVendorDropdownQuery("Transporter");
  const { data: projectsLookup } = useProjectsQuery({ pageSize: 500 });
  const createChallanMutation = useCreateChallanMutation();
  const deleteChallanMutation = useDeleteChallanMutation();

  const challans = (data?.challans || []) as Challan[];
  const customers = (customerLookup.length > 0 ? customerLookup : (data?.customers || [])) as Customer[];
  const subplates = (data?.subplates || []) as Subplate[];
  const scans = (projectsLookup?.scans?.length ? projectsLookup.scans : (data?.scans || [])) as ScanProject[];
  const hasLoadedData = challans.length > 0 || (!!data && !queryLoading);
  const isLoading = isRestoring || (!hasLoadedData && queryLoading);

  const kpis = data?.kpis || { totalChallans: 0, activeCount: 0 };
  const fetchError = fetchQueryError ? (fetchQueryError as Error).message : null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Navigation Tabs: Job Work Challan Register vs Pending Outward Items
  const [activeTab, setActiveTab] = useState<"challan_list" | "pending_outward">("challan_list");
  const [searchQuery, setSearchQuery] = useState(urlSearch);

  useEffect(() => {
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);
  const [vendorFilter, setVendorFilter] = useState("ALL");

  
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Add Challan Modal State (Source: challan/index.blade.php lines 74-165)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<{
    chdate: string;
    vendorid: string;
    vendortid: string;
    customerid: string;
    projectid: string;
    items: Array<{
      plateid: string;
      platename: string;
      customer: string;
      project: string;
      particulars: string;
      qty: number;
      sqty: number; // Available quantity
    }>;
  }>({
    chdate: new Date().toISOString().slice(0, 10),
    vendorid: "",
    vendortid: "",
    customerid: "",
    projectid: "",
    items: [],
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Explicitly separate vendors, transporters, and customers by table
  const vendors = useMemo(() => (supplierLookup || []).map((v: any) => ({ ...v, customername: v.vendor_name })), [supplierLookup]);

  
  const transporters = useMemo(() => (transporterLookup || []).map((v: any) => ({ ...v, customername: v.vendor_name })), [transporterLookup]);
  const customersList = useMemo(() => (customerLookup || []).filter((c: any) => c.usertype === "Customer" || !c.usertype), [customerLookup]);

  const vendorFilterOptions: ERPSelectOption[] = useMemo(() => [
    { value: "ALL", label: `All Vendors (${vendors.length})` },
    ...vendors.map((v) => ({
      value: String(v.id),
      label: v.customername,
      subtitle: v.initials ? `Code: ${v.initials}` : undefined,
    })),
  ], [vendors]);

  // Selected customer object for robust name/id matching
  const selectedCustomer = useMemo(() => {
    if (!modalForm.customerid) return null;
    return (customersList || []).find((c: any) => String(c.id) === String(modalForm.customerid)) || null;
  }, [customersList, modalForm.customerid]);

  // Mould projects for selected customer (Source: challan/index.blade.php getproject())
  const availableProjects = useMemo(() => {
    if (!modalForm.customerid) return scans;
    const custId = String(modalForm.customerid);
    const selectedCustName = selectedCustomer?.customername?.toLowerCase().trim();
    const selectedCustInitials = selectedCustomer?.initials?.toLowerCase().trim();

    const matched = scans.filter((s: ScanProject) => {
      // 1. Direct customer_id match
      if (s.customer_id && String(s.customer_id) === custId) return true;
      // 2. Numeric cname match
      if (s.cname && String(s.cname) === custId) return true;
      // 3. Customer name match against scan cname
      if (selectedCustName && s.cname && String(s.cname).toLowerCase().trim() === selectedCustName) return true;
      // 4. Customer name match against scan customername
      if (selectedCustName && (s as any).customername && String((s as any).customername).toLowerCase().trim() === selectedCustName) return true;
      // 5. Match by Customer Initials / Code in projectid (e.g. 0001_TESTC_001 matches TESTC!)
      if (selectedCustInitials && s.projectid && s.projectid.toLowerCase().includes(selectedCustInitials)) return true;
      // 6. In-house / unassigned project
      if (String(s.cname) === "0" || !s.cname) return true;
      return false;
    });

    // If no project strictly matched this customer, fallback to showing all active scans so the operator is NEVER blocked!
    return matched.length > 0 ? matched : scans;
  }, [scans, modalForm.customerid, selectedCustomer]);

  // Selected scan record for subplate resolution
  const selectedScan = useMemo(() => {
    if (!modalForm.projectid) return null;
    return scans.find((s: ScanProject) => s.projectid === modalForm.projectid || String(s.id) === modalForm.projectid);
  }, [scans, modalForm.projectid]);

  const lookupProjectId = selectedScan ? selectedScan.id : (modalForm.projectid || undefined);
  const { data: dynamicSubplates = [] } = useSubplatesByProjectQuery(lookupProjectId);

  const allSubplates = useMemo(() => {
    const map = new Map<number, Subplate>();
    subplates.forEach((s) => map.set(s.id, s));
    dynamicSubplates.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [subplates, dynamicSubplates]);

  // Available subplates for selected project with pending outward quantity
  const availablePlates = useMemo(() => {
    if (!modalForm.projectid) return [];
    const scanIdStr = selectedScan ? String(selectedScan.id) : "";
    return allSubplates.filter(
      (sp: Subplate) =>
        String(sp.projectid) === String(modalForm.projectid) ||
        (scanIdStr && String(sp.projectid) === scanIdStr) ||
        (sp.subprojectid && sp.subprojectid.includes(modalForm.projectid))
    );
  }, [allSubplates, modalForm.projectid, selectedScan]);

  const vendorOptions: ERPSelectOption[] = useMemo(() => {
    return vendors.map((v: any) => ({
      value: String(v.id),
      label: v.customername,
      subtitle: v.initials ? `Code: ${v.initials}` : undefined,
    }));
  }, [vendors]);

  const transporterOptions: ERPSelectOption[] = useMemo(() => {
    return transporters.map((t: any) => ({
      value: String(t.id),
      label: t.customername,
      subtitle: t.initials ? `Code: ${t.initials}` : undefined,
    }));
  }, [transporters]);

  const subplateOptions: ERPSelectOption[] = useMemo(() => {
    return availablePlates.map((p) => ({
      value: String(p.id),
      label: p.platename,
      subtitle: p.material ? `Material: ${p.material}` : undefined,
      badge: p.subprojectid || undefined,
      badgeVariant: "blue" as const,
    }));
  }, [availablePlates]);

  const customerFilterOptions: ERPSelectOption[] = useMemo(() => {
    return [
      { value: "ALL", label: `All Customers (${customersList.length})` },
      ...customersList.map((c: any) => ({
        value: String(c.id),
        label: c.customername,
        badge: c.initials || undefined,
        badgeVariant: "blue" as const,
      })),
    ];
  }, [customersList]);

  // Expand / collapse child items row
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // KPI Calculations
  const totalChallans = kpis.totalChallans || challans.length;
  const activeChallans = challans.filter((c) => String(c.status) === "1" || (c as any).status === 1).length;
  const totalPlatesDispatched = challans.reduce(
    (acc, c) => acc + (c.items?.reduce((sum, it) => sum + (it.qty || 0), 0) || 0),
    0
  );
  const uniqueVendorsCount = new Set(challans.map((c) => c.vendorid)).size;

  // Filtered Challan List
  const filteredChallans = useMemo(() => {
    return challans.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        c.challanno.toLowerCase().includes(q) ||
        (c.vendorname || "").toLowerCase().includes(q) ||
        (c.customername || "").toLowerCase().includes(q) ||
        (c.transportername || "").toLowerCase().includes(q) ||
        (c.projectid || "").toLowerCase().includes(q) ||
        (c.items || []).some(
          (it) =>
            (it.particulars || "").toLowerCase().includes(q) ||
            (it.platename || "").toLowerCase().includes(q)
        );

      const matchVendor = vendorFilter === "ALL" || String(c.vendorid) === vendorFilter;
      return matchSearch && matchVendor;
    });
  }, [challans, searchQuery, vendorFilter]);

  const { getRowHighlightClass } = useTableHighlight(filteredChallans);

  // Extracted Pending Outward Items from Challans (matching ViewModel view_pending_inward_qty)
  const pendingOutwardItems = useMemo(() => {
    const list: Array<{
      challanid: number;
      challanno: string;
      chdate: string;
      vendorname: string;
      customername: string;
      transportername: string;
      projectid: string;
      platename: string;
      particulars: string;
      qty: number;
    }> = [];

    challans.forEach((c) => {
      (c.items || []).forEach((it) => {
        list.push({
          challanid: c.id,
          challanno: c.challanno,
          chdate: c.chdate,
          vendorname: c.vendorname || `Vendor #${c.vendorid}`,
          customername: c.customername || `Customer #${c.customerid}`,
          transportername: c.transportername || `Transporter #${c.vendortid}`,
          projectid: c.projectid,
          platename: it.platename || `Plate #${it.plateid}`,
          particulars: it.particulars,
          qty: it.qty,
        });
      });
    });

    return list.filter((it) => {
      const q = searchQuery.toLowerCase();
      return (
        it.challanno.toLowerCase().includes(q) ||
        it.vendorname.toLowerCase().includes(q) ||
        it.customername.toLowerCase().includes(q) ||
        it.platename.toLowerCase().includes(q) ||
        it.particulars.toLowerCase().includes(q)
      );
    });
  }, [challans, searchQuery]);

  // Modal Handlers
  const handleAddItemRow = () => {
    if (!modalForm.customerid) {
      setFormError("Please select a Customer first.");
      return;
    }
    if (!modalForm.projectid) {
      setFormError("Please select a Mould Name first.");
      return;
    }

    setFormError(null);
    const cust = customers.find((c) => c.id === Number(modalForm.customerid));
    setModalForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          plateid: "",
          platename: "",
          customer: cust?.customername || "",
          project: prev.projectid,
          particulars: "",
          qty: 1,
          sqty: 1,
        },
      ],
    }));
  };

  const handleRemoveItemRow = (index: number) => {
    setModalForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setModalForm((prev) => {
      const updated = [...prev.items];
      if (field === "plateid") {
        const foundPlate = subplates.find((p) => String(p.id) === String(value));
        updated[index] = {
          ...updated[index],
          plateid: value,
          platename: foundPlate?.platename || `Plate #${value}`,
          sqty: foundPlate?.sqty || 1,
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value,
        };
      }
      return { ...prev, items: updated };
    });
  };

  const handleSubmitChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (!modalForm.vendorid) {
      setFormError("Vendor Name is required.");
      return;
    }
    if (!modalForm.vendortid) {
      setFormError("Transporter Name is required.");
      return;
    }
    if (!modalForm.customerid) {
      setFormError("Customer Name is required.");
      return;
    }
    if (!modalForm.projectid) {
      setFormError("Mould Name is required.");
      return;
    }
    if (modalForm.items.length === 0) {
      setFormError("Please add at least one plate to the challan.");
      return;
    }

    for (let i = 0; i < modalForm.items.length; i++) {
      const item = modalForm.items[i];
      if (!item.plateid) {
        setFormError(`Row ${i + 1}: Please select a subplate.`);
        return;
      }
      if (!item.particulars.trim()) {
        setFormError(`Row ${i + 1}: Particulars description is required.`);
        return;
      }
      if (!item.qty || item.qty <= 0) {
        setFormError(`Row ${i + 1}: Quantity must be greater than zero.`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await createChallanMutation.mutateAsync(modalForm);
      setIsModalOpen(false);
      setModalForm({
        chdate: new Date().toISOString().slice(0, 10),
        vendorid: "",
        vendortid: "",
        customerid: "",
        projectid: "",
        items: [],
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to save challan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelChallan = async (id: number) => {
    if (window.confirm("Are you sure you want to cancel this outward challan?")) {
      try {
        await deleteChallanMutation.mutateAsync(id);
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    }
  };

  const handlePrintChallan = async (challanId: number) => {
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const res = await fetch("/api/print-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "challan", id: challanId }),
      });
      if (res.ok) {
        const data = await res.json();
        const targetUrl = data.url || `/print/challan/${challanId}`;
        if (win) {
          win.location.href = targetUrl;
        } else {
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        const fallbackUrl = `/print/challan/${challanId}`;
        if (win) {
          win.location.href = fallbackUrl;
        } else {
          window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      const fallbackUrl = `/print/challan/${challanId}`;
      if (win) {
        win.location.href = fallbackUrl;
      } else {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 w-full">
        {fetchError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-1 bg-rose-600 text-white rounded-md text-xs font-semibold hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Outward Challan & Job Work
                </h1>
                <p className="text-sm text-slate-500">
                  Manage delivery / job work challans (SM/JW/xx) dispatched to vendors
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/export"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Outward</span>
            </Link>

            {canCreateChallan && (<button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition shadow-sm shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Job Work Challan</span>
            </button>)}
          </div>
        </div>

        {/* Metric KPI Counters */}
        {isLoading ? (
          <KpiCardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Challans</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalChallans.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Challans</p>
                <h3 className="text-2xl font-bold text-emerald-600">{activeChallans.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plates on Job Work</p>
                <h3 className="text-2xl font-bold text-amber-600">{totalPlatesDispatched.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Partner Vendors</p>
                <h3 className="text-2xl font-bold text-slate-900">{uniqueVendorsCount}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("challan_list")}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-2 ${
              activeTab === "challan_list"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Job Work Challan Register</span>
            <span
              className={`ml-1.5 px-2 py-0.5 text-xs rounded-full ${
                activeTab === "challan_list" ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {filteredChallans.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("pending_outward")}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-2 ${
              activeTab === "pending_outward"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-500/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Pending Outward Plates</span>
            <span
              className={`ml-1.5 px-2 py-0.5 text-xs rounded-full ${
                activeTab === "pending_outward" ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-700"
              }`}
            >
              {pendingOutwardItems.length}
            </span>
          </button>
        </div>

        {/* Controls Bar: Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeTab === "challan_list"
                  ? "Search by Challan No, Vendor, Customer, Particulars..."
                  : "Search pending outward plates..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          {activeTab === "challan_list" && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Vendors ({vendors.length})</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.customername}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* TAB 1: Challan Register Table */}
        {activeTab === "challan_list" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1100px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="w-10 px-4 py-3.5"></th>
                    <th className="px-4 py-3.5">Challan No</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Vendor Name</th>
                    <th className="px-4 py-3.5">Transporter</th>
                    <th className="px-4 py-3.5 text-center">Items</th>
                    <th className="px-4 py-3.5">Created By</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {isLoading ? (
                    <TableSkeletonRows rows={8} columns={9} />
                  ) : filteredChallans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        No outward jobwork challans found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredChallans.map((c) => {
                      const isExpanded = !!expandedRows[c.id];
                      return (
                        <React.Fragment key={c.id}>
                          <tr
                            id={`row-${c.id}`}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.closest("button") || target.closest("a") || target.closest("input")) {
                                return;
                              }
                              toggleRow(c.id);
                            }}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer select-none ${getRowHighlightClass(c.id)}`}
                          >
                            <td className="px-4 py-3.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRow(c.id);
                                }}
                                className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-700 cursor-pointer"
                                title={isExpanded ? "Collapse line items" : "Expand line items"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </td>

                            <td className="px-4 py-3.5 font-semibold text-blue-600">
                              {c.challanno}
                            </td>

                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                <span>{c.chdate}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 font-medium text-slate-900">
                              {c.vendorname}
                            </td>

                            <td className="px-4 py-3.5 text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Truck className="h-3.5 w-3.5 text-slate-400" />
                                <span>{c.transportername}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                {c.items?.length || 0} plates
                              </span>
                            </td>

                            <td className="px-4 py-3.5 text-slate-500 text-xs">
                              {c.created_by}
                            </td>

                            <td className="px-4 py-3.5 text-center">
                              {String(c.status) === "1" || (c as any).status === 1 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                  Inactive
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintChallan(c.id);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                  title="Print Outward Challan / Job Work Voucher"
                                >
                                  <Printer className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelChallan(c.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Cancel / Delete Challan"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Sub-table / Child Rows (matching challan/index.blade.php childTable) */}
                          {isExpanded && (
                            <tr className="bg-slate-50/80 border-y border-slate-200">
                              <td colSpan={9} className="p-4 pl-14">
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                      Dispatched Subplates in {c.challanno}
                                    </h4>
                                    <span className="text-xs text-slate-400">
                                      Mould Project: {c.projectid}
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto w-full">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                        <tr>
                                          <th className="px-3 py-2">Plate Name</th>
                                          <th className="px-3 py-2">Customer</th>
                                          <th className="px-3 py-2">Mould</th>
                                          <th className="px-3 py-2">Particulars / Instructions</th>
                                          <th className="px-3 py-2 text-right">Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {(c.items || []).map((it, idx) => (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 font-semibold text-slate-900">
                                              {it.platename || `Plate #${it.plateid}`}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">
                                              {it.customername || c.customername}
                                            </td>
                                            <td className="px-3 py-2 text-slate-500">
                                              {it.project || c.projectid}
                                            </td>
                                            <td className="px-3 py-2 text-slate-700 font-medium">
                                              {it.particulars}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-900">
                                              {it.qty}
                                            </td>
                                          </tr>
                                        ))}
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
              {filteredChallans.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No outward jobwork challans found matching your search.
                </div>
              ) : (
                filteredChallans.map((c) => {
                  const isExpanded = !!expandedRows[c.id];
                  return (
                    <div
                      key={c.id}
                      id={`row-mob-${c.id}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("button") || target.closest("a") || target.closest("input")) {
                          return;
                        }
                        toggleRow(c.id);
                      }}
                      className={`p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs cursor-pointer hover:border-slate-300 transition select-none ${getRowHighlightClass(c.id)}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-blue-600 font-mono">
                            {c.challanno}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            {c.chdate}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Outward
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrintChallan(c.id);
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            title="Print Outward Challan"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelChallan(c.id);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Cancel / Delete Challan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Vendor:</span>
                          <span className="font-medium text-slate-800 truncate block">
                            {c.vendorname}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Transport:</span>
                          <span className="font-medium text-slate-800 truncate block">
                            {c.transportername || "Self"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-slate-500 text-[11px]">
                          {(c.items || []).length} plates
                        </span>
                        <button
                          onClick={() => toggleRow(c.id)}
                          className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition flex items-center justify-center cursor-pointer"
                        >
                          {isExpanded ? "Hide Plates" : "View Plates"}
                        </button>
                      </div>

                      {isExpanded && (c.items || []).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                          {c.items?.map((it, idx) => (
                            <div
                              key={idx}
                              className="p-2 rounded bg-white border border-slate-200 text-[11px] flex items-center justify-between"
                            >
                              <div>
                                <span className="font-semibold text-slate-800 block">
                                  {it.platename || `Plate #${it.plateid}`}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {it.particulars || "Standard Jobwork"}
                                </span>
                              </div>
                              <span className="font-bold text-slate-800">
                                Qty: {it.qty}
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
          </div>
        )}

        {/* TAB 2: Pending Outward Plates Table */}
        {activeTab === "pending_outward" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">Challan No</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Vendor Name</th>
                    <th className="px-4 py-3.5">Customer Name</th>
                    <th className="px-4 py-3.5">Mould</th>
                    <th className="px-4 py-3.5">Plate Name</th>
                    <th className="px-4 py-3.5">Particulars</th>
                    <th className="px-4 py-3.5 text-right">Jobwork Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pendingOutwardItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        No pending outward jobwork records found.
                      </td>
                    </tr>
                  ) : (
                    pendingOutwardItems.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-blue-600">
                          {row.challanno}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {row.chdate}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          {row.vendorname}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {row.customername}
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 font-mono text-xs">
                          {row.projectid}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          {row.platename}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">
                          {row.particulars}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-amber-600">
                          {row.qty}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Delivery / Job Work Challan Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add Delivery / Job Work Challan"
          description="Sequential Outward Movement Challan (SM/JW/xx)"
          size="4xl"
        >
          <form onSubmit={handleSubmitChallan} className="space-y-6">
            {formError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Header Fields (Source: challan/index.blade.php lines 86-143) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Today’s Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={modalForm.chdate}
                  onChange={(e) =>
                    setModalForm((prev) => ({ ...prev, chdate: e.target.value }))
                  }
                  required
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Vendor Name <span className="text-rose-500">*</span>
                </label>
                <ERPSelect
                  value={modalForm.vendorid}
                  onChange={(val) =>
                    setModalForm((prev) => ({ ...prev, vendorid: String(val) }))
                  }
                  options={vendorOptions}
                  placeholder="Select Vendor Name"
                  searchPlaceholder="Search vendor..."
                  showSearch={vendorOptions.length > 5}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Transporter Name <span className="text-rose-500">*</span>
                </label>
                <ERPSelect
                  value={modalForm.vendortid}
                  onChange={(val) =>
                    setModalForm((prev) => ({ ...prev, vendortid: String(val) }))
                  }
                  options={transporterOptions}
                  placeholder="Select Transporter Name"
                  searchPlaceholder="Search transporter..."
                  showSearch={transporterOptions.length > 5}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Customer Name <span className="text-rose-500">*</span>
                </label>
                <CustomerSelect
                  customers={customersList as Customer[]}
                  value={modalForm.customerid}
                  onChange={(val) =>
                    setModalForm((prev) => ({
                      ...prev,
                      customerid: val,
                      projectid: "",
                      items: [],
                    }))
                  }
                  filterUserType="Customer"
                  placeholder="Select Customer Name"
                  required
                />
              </div>
            </div>

            {/* Mould Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mould Name <span className="text-rose-500">*</span>
              </label>
              <ProjectSelect
                projects={availableProjects}
                value={modalForm.projectid}
                onChange={(val, project) =>
                  setModalForm((prev) => ({
                    ...prev,
                    projectid: project?.projectid || val,
                    items: [],
                  }))
                }
                disabled={!modalForm.customerid}
                placeholder={
                  !modalForm.customerid
                    ? "First select Customer above"
                    : "Select Mould Project"
                }
                required
              />
            </div>

            {/* Dynamic Line Items Section (Source: challan/index.blade.php lines 661-796) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Challan Items ({modalForm.items.length})
                </h4>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  disabled={!modalForm.projectid}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Plate</span>
                </button>
              </div>

              {modalForm.items.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  No plates added yet. Click &quot;Add Plate&quot; to append jobwork items.
                </div>
              ) : (
                <div className="space-y-3">
                  {modalForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
                    >
                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Subplate *
                        </label>
                        <ERPSelect
                          value={item.plateid}
                          onChange={(val) =>
                            handleItemChange(idx, "plateid", String(val))
                          }
                          options={subplateOptions}
                          placeholder="Select Subplate"
                          searchPlaceholder="Filter subplate..."
                          showSearch={subplateOptions.length > 5}
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Customer
                        </label>
                        <input
                          type="text"
                          value={item.customer}
                          readOnly
                          className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Mould
                        </label>
                        <input
                          type="text"
                          value={item.project}
                          readOnly
                          className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-mono"
                        />
                      </div>

                      <div className="md:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Particulars *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rough Milling, Hardening"
                          value={item.particulars}
                          onChange={(e) =>
                            handleItemChange(idx, "particulars", e.target.value)
                          }
                          required
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-1">
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Qty *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={item.sqty > 0 ? item.sqty : undefined}
                          value={item.qty}
                          onChange={(e) =>
                            handleItemChange(idx, "qty", Number(e.target.value))
                          }
                          required
                          className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-lg transition cursor-pointer"
                          title="Delete row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition btn-interactive cursor-pointer"
              >
                Close
              </button>
              <MotionButton
                type="submit"
                loading={createChallanMutation.isPending}
                disabled={createChallanMutation.isPending || modalForm.items.length === 0}
                variant="primary"
                size="md"
              >
                Generate Challan
              </MotionButton>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}

export function ChallanPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Challans...</div>}>
      <ChallanPageContent />
    </Suspense>
  );
}

