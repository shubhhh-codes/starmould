"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import {
  Truck,
  Printer,
  Search,
  Calendar,
  Building2,
  Layers,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  X,
  AlertCircle,
  Clock,
  CheckCircle2,
  Box,
  FileText,
  BadgePercent,
  Compass,
} from "lucide-react";
import type {
  Dispatch,
  DispatchItem,
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
import { useIsRestoring } from "@tanstack/react-query";
import {
  useDispatchQuery,
  useCreateDispatchMutation,
  useDeleteDispatchMutation,
  useCustomerDropdownQuery,
  useVendorDropdownQuery,
  useProjectsQuery,
  useSubplatesByProjectQuery,
} from "@/lib/query/hooks";

export function DispatchPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin";
  const { hasPermission } = useRolePermissions();
  const canCreateDispatch = hasPermission("action_create_dispatch");
  const isRestoring = useIsRestoring();
  const { data, isLoading: queryLoading, error: fetchQueryError, refetch } = useDispatchQuery({ limit: 200 });
  const { data: customerLookup = [] } = useCustomerDropdownQuery("Customer");
  const { data: transporterLookup = [] } = useVendorDropdownQuery("Transporter");
  const { data: projectsLookup } = useProjectsQuery({ pageSize: 500 });
  const [modalForm, setModalForm] = useState<{
    chdate: string;
    customerid: string;
    vendortid: string;
    projectid: string;
    invoiceno: string;
    vehicleno: string;
    deliverytype: "Door Delivery" | "Godown Delivery" | "Door Pickup" | "Hand To Hand";
    freightmode: "To Pay" | "Paid";
    freightcharge: string;
    noofcases: string;
    items: Array<{
      itemType: "regular" | "custom";
      plateid: string;
      custom_plate_name: string;
      customer: string;
      project: string;
      particulars: string;
      condition: string;
      work: string;
      qty: number;
    }>;
  }>({
    chdate: new Date().toISOString().slice(0, 10),
    customerid: "",
    vendortid: "",
    projectid: "",
    invoiceno: "",
    vehicleno: "",
    deliverytype: "Door Delivery",
    freightmode: "To Pay",
    freightcharge: "",
    noofcases: "1",
    items: [],
  });
  const { data: dynamicSubplates = [] } = useSubplatesByProjectQuery(modalForm.projectid || undefined);
  const createDispatchMutation = useCreateDispatchMutation();
  const deleteDispatchMutation = useDeleteDispatchMutation();

  const dispatches = data?.dispatches || [];
  const customers = customerLookup.length > 0 ? customerLookup : (data?.customers || []);
  const scans = projectsLookup?.scans?.length ? projectsLookup.scans : (data?.scans || []);
  const subplates = dynamicSubplates.length > 0 ? dynamicSubplates : (data?.subplates || []);
  const hasLoadedData = dispatches.length > 0 || (!!data && !queryLoading);
  const isLoading = isRestoring || (!hasLoadedData && queryLoading);
  const fetchError = fetchQueryError ? (fetchQueryError as Error).message : null;

  const [searchQuery, setSearchQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Add Dispatch Challan Modal State (Source: dispatch/index.blade.php lines 96-280)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const lastLoadedMouldRef = useRef<string | null>(null);

  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectid");

  useEffect(() => {
    if (urlProjectId && scans.length > 0 && !isModalOpen) {
      const matched = scans.find(
        (s) =>
          String(s.projectid).toLowerCase() === urlProjectId.toLowerCase() ||
          String(s.id) === urlProjectId
      );
      if (matched) {
        setModalForm((prev) => ({
          ...prev,
          customerid: String(matched.customer_id || matched.cname || ""),
          projectid: matched.projectid || String(matched.id),
        }));
        setIsModalOpen(true);
      }
    }
  }, [urlProjectId, scans]);

  // Filtered dropdown lists strictly based on legacy usertype
  const customersList = useMemo(() => customers.filter((c) => c.usertype === "Customer"), [customers]);
  const transporters = useMemo(() => (transporterLookup || []).map((t: any) => ({ id: t.id, customername: t.vendor_name, initials: t.initials })), [transporterLookup]);

  // Selected customer object for robust name/id matching
  const selectedCustomer = useMemo(() => {
    if (!modalForm.customerid) return null;
    return customers.find((c: any) => String(c.id) === String(modalForm.customerid)) || null;
  }, [customers, modalForm.customerid]);

  // Mould projects for selected customer
  // Rule: Moulds are eligible if they have undispatched subplates remaining
  const availableProjects = useMemo(() => {
    const eligibleScans = scans.filter((s: ScanProject) => {
      const plates = s.subplates || [];
      if (plates.length === 0) return true;
      return plates.some(
        (sp: any) => sp.location !== "Customer" && sp.dispatch_status !== "dispatched"
      );
    });

    if (!modalForm.customerid) return eligibleScans;
    const custId = String(modalForm.customerid);
    const selectedCustName = selectedCustomer?.customername?.toLowerCase().trim();
    const selectedCustInitials = selectedCustomer?.initials?.toLowerCase().trim();

    const matched = eligibleScans.filter((s: ScanProject) => {
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

    return matched;
  }, [scans, dispatches, modalForm.customerid, selectedCustomer]);

  // Selected scan record for subplate resolution
  const selectedScan = useMemo(() => {
    if (!modalForm.projectid) return null;
    return scans.find((s: ScanProject) => s.projectid === modalForm.projectid || String(s.id) === modalForm.projectid) || null;
  }, [scans, modalForm.projectid]);

  // Available subplates for selected project that are ready for dispatch (location = 'SM')
  const availablePlates = useMemo(() => {
    if (!modalForm.projectid) return [];
    const targetCode = selectedScan?.projectid || modalForm.projectid;
    const targetId = selectedScan ? String(selectedScan.id) : null;
    return subplates.filter(
      (sp) =>
        (targetId && String(sp.projectid) === targetId) ||
        (targetId && String((sp as any).mold_id) === targetId) ||
        String(sp.projectid) === targetCode ||
        (sp as any).mold_code === targetCode ||
        (sp.subprojectid && targetCode && sp.subprojectid.includes(targetCode))
    );
  }, [subplates, modalForm.projectid, selectedScan]);

  // Automatically populate all subplates of the mould into Dispatch Items
  useEffect(() => {
    if (!modalForm.projectid) {
      lastLoadedMouldRef.current = null;
      return;
    }

    if (availablePlates.length > 0 && lastLoadedMouldRef.current !== modalForm.projectid) {
      lastLoadedMouldRef.current = modalForm.projectid;
      const cust = customers.find((c) => c.id === Number(modalForm.customerid));
      const customerVal = cust?.id ? String(cust.id) : (modalForm.customerid || "");

      const autoPopulatedItems = availablePlates.map((plate) => ({
        itemType: "regular" as const,
        plateid: String(plate.id),
        custom_plate_name: "",
        customer: customerVal,
        project: modalForm.projectid,
        particulars: "",
        condition: "",
        work: "",
        qty: plate.sqty || 1,
        sqty: plate.sqty || 1,
      }));

      setModalForm((prev) => ({
        ...prev,
        items: autoPopulatedItems,
      }));
    }
  }, [availablePlates, modalForm.projectid, modalForm.customerid, customers]);

  const transporterOptions: ERPSelectOption[] = useMemo(() => {
    return transporters.map((t) => ({
      value: String(t.id),
      label: t.customername,
      subtitle: t.initials ? `Code: ${t.initials}` : undefined,
    }));
  }, [transporters]);

  const deliveryTypeOptions: ERPSelectOption[] = useMemo(
    () => [
      { value: "Door Delivery", label: "Door Delivery" },
      { value: "Godown Delivery", label: "Godown Delivery" },
      { value: "Door Pickup", label: "Door Pickup" },
      { value: "Hand To Hand", label: "Hand To Hand" },
    ],
    []
  );

  const freightModeOptions: ERPSelectOption[] = useMemo(
    () => [
      { value: "To Pay", label: "To Pay" },
      { value: "Paid", label: "Paid" },
    ],
    []
  );

  const subplateOptions: ERPSelectOption[] = useMemo(() => {
    return availablePlates.map((p) => {
      const seq = p.subprojectid ? p.subprojectid.split("_").pop() : "";
      return {
        value: String(p.id),
        label: p.platename,
        subtitle: [
          p.subprojectid ? `Code: ${p.subprojectid}` : "",
          p.material ? `Material: ${p.material}` : "",
        ]
          .filter(Boolean)
          .join(" • ") || undefined,
        badge: seq ? `#${seq}` : undefined,
        badgeVariant: "blue" as const,
      };
    });
  }, [availablePlates]);

  const customerFilterOptions: ERPSelectOption[] = useMemo(() => {
    return [
      { value: "ALL", label: `All Customers (${customersList.length})` },
      ...customersList.map((c) => ({
        value: String(c.id),
        label: c.customername,
        badge: c.initials || undefined,
        badgeVariant: "blue" as const,
      })),
    ];
  }, [customersList]);

  // Expand / collapse child rows
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // KPI Calculations
  const totalDispatches = dispatches.length;
  const activeDispatches = dispatches.filter((d) => String(d.status) === "1" || (d as any).status === 1).length;
  const totalItemsDispatched = dispatches.reduce(
    (acc, d) => acc + (d.items?.reduce((sum, it) => sum + (it.qty || 0), 0) || 0),
    0
  );
  const uniqueCustomersCount = new Set(dispatches.map((d) => d.customerid)).size;

  // Filtered Dispatch List
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        d.challanno.toLowerCase().includes(q) ||
        (d.customername || "").toLowerCase().includes(q) ||
        (d.transportername || "").toLowerCase().includes(q) ||
        (d.invoiceno || "").toLowerCase().includes(q) ||
        (d.vehicleno || "").toLowerCase().includes(q) ||
        (d.projectid || "").toLowerCase().includes(q) ||
        (d.items || []).some(
          (it) =>
            (it.particulars || "").toLowerCase().includes(q) ||
            (it.platename || "").toLowerCase().includes(q) ||
            (it.custom_plate_name || "").toLowerCase().includes(q)
        );

      const matchCustomer = customerFilter === "ALL" || String(d.customerid) === customerFilter;
      return matchSearch && matchCustomer;
    });
  }, [dispatches, searchQuery, customerFilter]);

  // Line Item Handlers
  const handleAddItemRow = (type: "regular" | "custom") => {
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
          itemType: type,
          plateid: "",
          custom_plate_name: "",
          customer: cust?.id ? String(cust.id) : (prev.customerid || ""),
          project: prev.projectid,
          particulars: "",
          condition: "",
          work: "",
          qty: 1,
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
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return { ...prev, items: updated };
    });
  };

  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createDispatchMutation.isPending) return;
    setFormError(null);

    if (!modalForm.customerid) {
      setFormError("Customer Name is required.");
      return;
    }
    if (!modalForm.vendortid) {
      setFormError("Transporter Name is required.");
      return;
    }
    if (!modalForm.projectid) {
      setFormError("Mould Name is required.");
      return;
    }

    const alreadyDispatched = dispatches.find(
      (d) =>
        (String(d.status) === "1" || (d as any).status === 1) &&
        String(d.projectid).trim().toLowerCase() === String(modalForm.projectid).trim().toLowerCase()
    );
    if (alreadyDispatched && availablePlates.length === 0) {
      setFormError(
        `All subplates for mould "${modalForm.projectid}" have already been dispatched (${alreadyDispatched.challanno}).`
      );
      return;
    }

    if (modalForm.items.length === 0) {
      setFormError("Please add at least one dispatch line item.");
      return;
    }

    for (let i = 0; i < modalForm.items.length; i++) {
      const item = modalForm.items[i];
      if (item.itemType === "regular" && !item.plateid) {
        setFormError(`Row ${i + 1}: Please select a subplate.`);
        return;
      }
      if (item.itemType === "custom" && !item.custom_plate_name.trim()) {
        setFormError(`Row ${i + 1}: Please specify the custom tooling / set name.`);
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
      await createDispatchMutation.mutateAsync({
        chdate: modalForm.chdate,
        customerid: Number(modalForm.customerid),
        vendortid: Number(modalForm.vendortid),
        projectid: modalForm.projectid,
        invoiceno: modalForm.invoiceno.trim() || "N/A",
        vehicleno: modalForm.vehicleno.trim() || "N/A",
        deliverytype: modalForm.deliverytype,
        freightmode: modalForm.freightmode,
        freightcharge: modalForm.freightcharge.trim() || "N/A",
        noofcases: modalForm.noofcases,
        items: modalForm.items,
      });

      setIsModalOpen(false);
      setModalForm({
        chdate: new Date().toISOString().slice(0, 10),
        customerid: "",
        vendortid: "",
        projectid: "",
        invoiceno: "",
        vehicleno: "",
        deliverytype: "Door Delivery",
        freightmode: "To Pay",
        freightcharge: "",
        noofcases: "1",
        items: [],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error creating dispatch";
      setFormError(message);
    }
  };

  // Open Voucher directly in new tab with encrypted secure print token
  const handleOpenPrintTab = async (dispatchId: number) => {
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const res = await fetch("/api/print-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "dispatch", id: dispatchId }),
      });
      if (res.ok) {
        const data = await res.json();
        const targetUrl = data.url || `/print/dispatch/${dispatchId}`;
        if (win) {
          win.location.href = targetUrl;
        } else {
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        const fallbackUrl = `/print/dispatch/${dispatchId}`;
        if (win) {
          win.location.href = fallbackUrl;
        } else {
          window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      const fallbackUrl = `/print/dispatch/${dispatchId}`;
      if (win) {
        win.location.href = fallbackUrl;
      } else {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleDeleteDispatch = async (id: number) => {
    if (!confirm("Are you sure you want to delete this dispatch challan?")) return;
    try {
      await deleteDispatchMutation.mutateAsync(id);
    } catch (err) {
      console.error("Failed to delete dispatch:", err);
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
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Finished Mould Dispatch
                </h1>
                <p className="text-sm text-slate-500">
                  Customer final dispatch challans (SM/DC/xxxx) & delivery tracking
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
              <span>Export Dispatch Challans</span>
            </Link>

            {canCreateDispatch && (<button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Dispatch Challan</span>
            </button>)}
          </div>
        </div>

        {/* KPI Counter Cards */}
        {isLoading ? (
          <KpiCardSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Dispatches</p>
                <h3 className="text-2xl font-bold text-slate-900">{totalDispatches.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Dispatches</p>
                <h3 className="text-2xl font-bold text-emerald-600">{activeDispatches.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Box className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Mould Sets & Plates</p>
                <h3 className="text-2xl font-bold text-blue-600">{totalItemsDispatched.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Clients Served</p>
                <h3 className="text-2xl font-bold text-slate-900">{uniqueCustomersCount}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Controls Bar: Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Challan No (SM/DC/xxxx), Client, Invoice, Vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-64">
            <ERPSelect
              value={customerFilter}
              onChange={(val) => setCustomerFilter(String(val))}
              options={customerFilterOptions}
              placeholder="Filter by customer..."
              searchPlaceholder="Search customer..."
              showSearch={true}
            />
          </div>
        </div>

        {/* Main Dispatches Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full custom-scrollbar">
            <table className="w-full min-w-[1200px] text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-4 py-3.5">Dispatch No</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Customer Name</th>
                  <th className="px-4 py-3.5">Transporter</th>
                  <th className="px-4 py-3.5">Invoice No</th>
                  <th className="px-4 py-3.5">Vehicle No</th>
                  <th className="px-4 py-3.5">Delivery Type</th>
                  <th className="px-4 py-3.5">Freight Mode</th>
                  <th className="px-4 py-3.5 text-center">Cases</th>
                  <th className="px-4 py-3.5">Created By</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <TableSkeletonRows rows={8} columns={12} />
                ) : filteredDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-slate-400">
                      No finished mould dispatches found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredDispatches.map((d) => {
                    const isExpanded = !!expandedRows[d.id];
                    return (
                      <React.Fragment key={d.id}>
                        <tr
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("button") || target.closest("a") || target.closest("input")) return;
                            toggleRow(d.id);
                          }}
                          className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
                        >
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(d.id);
                              }}
                              className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-700 cursor-pointer"
                              title={isExpanded ? "Collapse line items" : "Expand line items"}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-indigo-600" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>

                          <td className="px-4 py-3.5 font-bold text-indigo-600 whitespace-nowrap">
                            {d.challanno}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{d.chdate}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 font-medium text-slate-900">
                            {d.customername}
                          </td>

                          <td className="px-4 py-3.5 text-slate-600 text-xs">
                            {d.transportername}
                          </td>

                          <td className="px-4 py-3.5 font-mono text-xs text-slate-700">
                            {d.invoiceno}
                          </td>

                          <td className="px-4 py-3.5 font-mono text-xs text-slate-700">
                            {d.vehicleno}
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                              {d.deliverytype}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                d.freightmode === "Paid"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {d.freightmode}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                            {d.noofcases}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {d.created_by}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPrintTab(d.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                title="Print / View Delivery Challan"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDispatch(d.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete Challan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Child Rows: Sub-table for Dispatched Line Items */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-y border-slate-200">
                            <td colSpan={12} className="p-4 pl-14">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Dispatched Tooling & Components in {d.challanno}
                                  </h4>
                                  <span className="text-xs text-slate-400 font-mono">
                                    Project: {d.projectid}
                                  </span>
                                </div>

                                <div className="overflow-x-auto w-full">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                      <tr>
                                        <th className="px-3 py-2">Component / Tooling Set</th>
                                        <th className="px-3 py-2">Condition</th>
                                        <th className="px-3 py-2">Nature of Work</th>
                                        <th className="px-3 py-2">Particulars / Specifications</th>
                                        <th className="px-3 py-2 text-right">Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(d.items || []).map((it, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-semibold text-slate-900">
                                            {it.custom_plate_name || it.platename || `Plate #${it.plateid}`}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                                              {it.condition || "NEW"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-slate-600 font-medium">
                                            {it.work || "—"}
                                          </td>
                                          <td className="px-3 py-2 text-slate-700 whitespace-pre-line text-xs">
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
            {filteredDispatches.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No finished mould dispatches found matching your search.
              </div>
            ) : (
              filteredDispatches.map((d) => {
                const isExpanded = !!expandedRows[d.id];
                return (
                  <div
                    key={d.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest("button") || target.closest("a") || target.closest("input")) return;
                      toggleRow(d.id);
                    }}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs cursor-pointer hover:border-slate-300 transition select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-600 font-mono">
                        {d.challanno}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {d.chdate}
                      </span>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {d.customername}
                      </span>
                      {d.transportername && (
                        <p className="text-[11px] text-slate-500">
                          Transporter: {d.transportername}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Invoice No:</span>
                        <span className="font-mono text-slate-700">{d.invoiceno || "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Vehicle No:</span>
                        <span className="font-mono text-slate-700">{d.vehicleno || "—"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[11px]">
                        {(d.items || []).length} items
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenPrintTab(d.id)}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>Print</span>
                        </button>
                        <button
                          onClick={() => toggleRow(d.id)}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition flex items-center justify-center cursor-pointer"
                        >
                          {isExpanded ? "Hide Items" : "View Items"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (d.items || []).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                        {d.items?.map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-white border border-slate-200 text-[11px] flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-slate-800 block">
                                {it.custom_plate_name || it.platename || `Plate #${it.plateid}`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {[it.condition, it.work].filter(Boolean).join(" • ") || "—"}
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

        {/* Add Dispatch Challan Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Add Dispatch Challan"
          description="Customer Delivery Document (SM/DC/xxxx format)"
          size="4xl"
        >
          <form onSubmit={handleSubmitDispatch} className="space-y-5">
            {formError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* 1. Dispatch Logistics Details Card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Truck className="h-3.5 w-3.5" />
                </div>
                <span>1. Dispatch & Delivery Logistics</span>
              </div>

              {/* Row 1: Document details (Date, Invoice No, Vehicle No, Cases) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Today&apos;s Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={modalForm.chdate}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, chdate: e.target.value }))
                    }
                    required
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Invoice No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. STPL/43/25-26"
                    value={modalForm.invoiceno}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, invoiceno: e.target.value }))
                    }
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Vehicle No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GJ03CU1839"
                    value={modalForm.vehicleno}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, vehicleno: e.target.value }))
                    }
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    No. of Cases <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 02"
                    value={modalForm.noofcases}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, noofcases: e.target.value }))
                    }
                    required
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-xs"
                  />
                </div>
              </div>

              {/* Row 2: Delivery & Freight Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Delivery Type <span className="text-rose-500">*</span>
                  </label>
                  <ERPSelect
                    value={modalForm.deliverytype}
                    onChange={(val) =>
                      setModalForm((prev) => ({
                        ...prev,
                        deliverytype: val as any,
                      }))
                    }
                    options={deliveryTypeOptions}
                    placeholder="Select Delivery Type"
                    showSearch={false}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Freight Mode <span className="text-rose-500">*</span>
                  </label>
                  <ERPSelect
                    value={modalForm.freightmode}
                    onChange={(val) =>
                      setModalForm((prev) => ({
                        ...prev,
                        freightmode: val as any,
                      }))
                    }
                    options={freightModeOptions}
                    placeholder="Select Freight Mode"
                    showSearch={false}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Freight Charge
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1500"
                    value={modalForm.freightcharge}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, freightcharge: e.target.value }))
                    }
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* 2. Customer, Transporter & Project Selection Card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <span>2. Customer, Transporter & Mould Selection</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <CustomerSelect
                    customers={customers as Customer[]}
                    value={modalForm.customerid}
                    onChange={(val) => {
                      lastLoadedMouldRef.current = null;
                      setModalForm((prev) => ({
                        ...prev,
                        customerid: val,
                        projectid: "",
                        items: [],
                      }));
                    }}
                    filterUserType="Customer"
                    placeholder="Search or pick customer..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Transporter Name <span className="text-rose-500">*</span>
                  </label>
                  <ERPSelect
                    icon={<Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    value={modalForm.vendortid}
                    onChange={(val) =>
                      setModalForm((prev) => ({ ...prev, vendortid: String(val) }))
                    }
                    options={transporterOptions}
                    placeholder="Search or select transporter..."
                    searchPlaceholder="Filter transporter..."
                    showSearch={true}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mould Name <span className="text-rose-500">*</span>
                  </label>
                  <ProjectSelect
                    projects={availableProjects}
                    value={modalForm.projectid}
                    onChange={(val, project) => {
                      lastLoadedMouldRef.current = null;
                      const newProjectId = project?.projectid || val;
                      const targetId = project ? String(project.id) : null;

                      const matchingPlates = subplates.filter(
                        (sp) =>
                          (targetId && String(sp.projectid) === targetId) ||
                          (targetId && String((sp as any).mold_id) === targetId) ||
                          String(sp.projectid) === newProjectId ||
                          (sp as any).mold_code === newProjectId ||
                          (sp.subprojectid && newProjectId && sp.subprojectid.includes(newProjectId))
                      );

                      const cust = customers.find((c) => c.id === Number(modalForm.customerid));
                      const customerVal = cust?.id ? String(cust.id) : (modalForm.customerid || "");

                      const autoItems = matchingPlates.map((plate) => ({
                        itemType: "regular" as const,
                        plateid: String(plate.id),
                        custom_plate_name: "",
                        customer: customerVal,
                        project: newProjectId,
                        particulars: "",
                        condition: "",
                        work: "",
                        qty: plate.sqty || 1,
                        sqty: plate.sqty || 1,
                      }));

                      if (matchingPlates.length > 0) {
                        lastLoadedMouldRef.current = newProjectId;
                      }

                      setModalForm((prev) => ({
                        ...prev,
                        projectid: newProjectId,
                        items: autoItems,
                      }));
                    }}
                    disabled={!modalForm.customerid}
                    placeholder={
                      !modalForm.customerid
                        ? "Select Customer first"
                        : "Search or select mould project..."
                    }
                    required
                  />
                  {!modalForm.customerid && (
                    <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Select customer above to load mould projects</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Dispatch Line Items Section */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Dispatch Items
                  </h4>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                    {modalForm.items.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAddItemRow("regular")}
                    disabled={!modalForm.projectid}
                    title={!modalForm.projectid ? "Select Customer & Mould first" : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Subplate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddItemRow("custom")}
                    disabled={!modalForm.projectid}
                    title={!modalForm.projectid ? "Select Customer & Mould first" : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    <Box className="h-3.5 w-3.5" />
                    <span>Add Custom Mould Set</span>
                  </button>
                </div>
              </div>

              {modalForm.items.length === 0 ? (
                <div className="text-center py-8 sm:py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-2.5">
                    <Layers className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">No dispatch items added yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                    {modalForm.projectid
                      ? "Click 'Add Subplate' to dispatch finished mould plates, or 'Add Custom Mould Set' for complete tooling assemblies."
                      : "Select a Customer and Mould above to begin adding dispatch items."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {modalForm.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 sm:p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3 relative group hover:border-slate-300 transition"
                    >
                      {/* Item Top bar with index, type badge, and delete button */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              item.itemType === "regular"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                                : "bg-violet-50 text-violet-700 border border-violet-200/60"
                            }`}
                          >
                            {item.itemType === "regular" ? "Finished Subplate" : "Custom Mould Set"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline text-[11px] font-medium">Remove</span>
                        </button>
                      </div>

                      {/* Responsive Grid Layout for Item Fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start">
                        {/* Plate Selection or Custom Plate Name */}
                        <div className="sm:col-span-2 lg:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            {item.itemType === "regular"
                              ? "Subplate (Completed) *"
                              : "Custom Mould Set Name *"}
                          </label>
                          {item.itemType === "regular" ? (
                            <ERPSelect
                              value={item.plateid}
                              onChange={(val) =>
                                handleItemChange(idx, "plateid", String(val))
                              }
                              options={subplateOptions}
                              placeholder="Search or select subplate..."
                              searchPlaceholder="Filter subplate..."
                              showSearch={subplateOptions.length > 5}
                              required
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="e.g. 104x104 Square Hotpress Set"
                              value={item.custom_plate_name}
                              onChange={(e) =>
                                handleItemChange(idx, "custom_plate_name", e.target.value)
                              }
                              required
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                          )}
                        </div>

                        {/* Condition */}
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Condition *
                          </label>
                          <input
                            type="text"
                            value={item.condition}
                            onChange={(e) =>
                              handleItemChange(idx, "condition", e.target.value)
                            }
                            placeholder="e.g. New"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Nature of Work */}
                        <div className="lg:col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Nature of Work *
                          </label>
                          <input
                            type="text"
                            value={item.work}
                            onChange={(e) =>
                              handleItemChange(idx, "work", e.target.value)
                            }
                            placeholder="e.g. New made"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                          />
                        </div>

                        {/* Specifications / Particulars */}
                        <div className="lg:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Specifications / Particulars *
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Enter tooling specs (Press Enter for new line)..."
                            value={item.particulars}
                            onChange={(e) =>
                              handleItemChange(idx, "particulars", e.target.value)
                            }
                            required
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-y min-h-[42px]"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="lg:col-span-1">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Qty *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) =>
                              handleItemChange(idx, "qty", Math.max(1, Number(e.target.value) || 1))
                            }
                            required
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition text-center"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                Total Items: <span className="font-bold text-slate-800">{modalForm.items.length}</span>
                {modalForm.items.length > 0 && (
                  <> • Total Qty: <span className="font-bold text-slate-800">{modalForm.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)}</span></>
                )}
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition btn-interactive cursor-pointer"
                >
                  Close
                </button>
                <MotionButton
                  type="submit"
                  loading={createDispatchMutation.isPending}
                  disabled={createDispatchMutation.isPending || modalForm.items.length === 0}
                  variant="primary"
                  size="md"
                >
                  Generate Dispatch Challan
                </MotionButton>
              </div>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}
