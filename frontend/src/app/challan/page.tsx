"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
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
import { useChallansQuery, useCreateChallanMutation, useDeleteChallanMutation } from "@/lib/query/hooks";

export default function ChallanPage() {
  const { data, isLoading, error: fetchQueryError, refetch } = useChallansQuery();
  const createChallanMutation = useCreateChallanMutation();
  const deleteChallanMutation = useDeleteChallanMutation();

  const challans = (data?.challans || []) as Challan[];
  const customers = (data?.customers || []) as Customer[];
  const subplates = (data?.subplates || []) as Subplate[];
  const scans = (data?.scans || []) as ScanProject[];
  const [extraSubplates, setExtraSubplates] = useState<Subplate[]>([]);

  const allSubplates = useMemo(() => {
    const map = new Map<number, Subplate>();
    subplates.forEach((s) => map.set(s.id, s));
    extraSubplates.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [subplates, extraSubplates]);

  const kpis = data?.kpis || { totalChallans: 0, activeCount: 0 };
  const fetchError = fetchQueryError ? (fetchQueryError as Error).message : null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Navigation Tabs: Job Work Challan Register vs Pending Outward Items
  const [activeTab, setActiveTab] = useState<"challan_list" | "pending_outward">("challan_list");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Filtered dropdown lists strictly based on legacy usertype
  const vendors = useMemo(() => customers.filter((c: Customer) => c.usertype === "Vendor"), [customers]);
  const customersList = useMemo(() => customers.filter((c: Customer) => c.usertype === "Customer"), [customers]);
  const transporters = useMemo(() => customers.filter((c: Customer) => c.usertype === "Transport"), [customers]);

  // Mould projects for selected customer (Source: challan/index.blade.php getproject())
  const availableProjects = useMemo(() => {
    if (!modalForm.customerid) return [];
    const custId = String(modalForm.customerid);
    return scans.filter((s: ScanProject) => String(s.cname) === custId || String(s.cname) === "0" || !s.cname);
  }, [scans, modalForm.customerid]);

  // Selected scan record for subplate resolution
  const selectedScan = useMemo(() => {
    if (!modalForm.projectid) return null;
    return scans.find((s: ScanProject) => s.projectid === modalForm.projectid || String(s.id) === modalForm.projectid);
  }, [scans, modalForm.projectid]);

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

  // Dynamically load subplates for chosen mould if not present in client cache
  React.useEffect(() => {
    if (!modalForm.projectid) return;
    const scan = selectedScan || scans.find((s: ScanProject) => s.projectid === modalForm.projectid || String(s.id) === modalForm.projectid);
    const lookupId = scan ? scan.id : modalForm.projectid;
    
    fetch(`/api/subplate?projectid=${lookupId}&limit=500`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.subplates && data.subplates.length > 0) {
          setExtraSubplates((prev) => {
            const existing = new Set(prev.map((p) => p.id));
            const fresh = data.subplates.filter((p: Subplate) => !existing.has(p.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
      })
      .catch((err) => console.error("Error loading project subplates:", err));
  }, [modalForm.projectid, selectedScan, scans]);

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

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition shadow-sm shadow-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Job Work Challan</span>
            </button>
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
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => toggleRow(c.id)}
                                className="p-1 hover:bg-slate-200 rounded transition text-slate-400 hover:text-slate-700"
                                title="Expand line items"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
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
                              <button
                                type="button"
                                onClick={() => handleCancelChallan(c.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Cancel / Delete Challan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
                      className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
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
                            onClick={() => handleCancelChallan(c.id)}
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
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Add Delivery / Job Work Challan
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sequential Outward Movement Challan (SM/JW/xx)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Form Content */}
              <form onSubmit={handleSubmitChallan} className="flex-1 overflow-y-auto p-6 space-y-6">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Header Fields (Source: challan/index.blade.php lines 86-143) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Today’s Date *
                    </label>
                    <input
                      type="date"
                      value={modalForm.chdate}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, chdate: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vendor Name *
                    </label>
                    <select
                      value={modalForm.vendorid}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, vendorid: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Vendor Name</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.customername}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Transporter Name *
                    </label>
                    <select
                      value={modalForm.vendortid}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, vendortid: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Transporter Name</option>
                      {transporters.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.customername}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Name *
                    </label>
                    <select
                      value={modalForm.customerid}
                      onChange={(e) =>
                        setModalForm((prev) => ({
                          ...prev,
                          customerid: e.target.value,
                          projectid: "",
                          items: [],
                        }))
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Customer Name</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customername}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mould Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mould Name *
                  </label>
                  <select
                    value={modalForm.projectid}
                    onChange={(e) =>
                      setModalForm((prev) => ({
                        ...prev,
                        projectid: e.target.value,
                        items: [],
                      }))
                    }
                    disabled={!modalForm.customerid}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">
                      {!modalForm.customerid
                        ? "First select Customer above"
                        : "Select Mould Project"}
                    </option>
                    {availableProjects.map((p) => (
                      <option key={p.id} value={p.projectid || ""}>
                        {p.projectid} - {p.description}
                      </option>
                    ))}
                  </select>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition disabled:opacity-50"
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
                            <select
                              value={item.plateid}
                              onChange={(e) =>
                                handleItemChange(idx, "plateid", e.target.value)
                              }
                              required
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">Select Subplate</option>
                              {availablePlates.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.platename} ({p.material || "Steel"})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Customer
                            </label>
                            <input
                              type="text"
                              value={item.customer}
                              readOnly
                              className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500"
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
                              className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500 font-mono"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Particulars (Instructions) *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Grinding 23mm final size"
                              value={item.particulars}
                              onChange={(e) =>
                                handleItemChange(idx, "particulars", e.target.value)
                              }
                              required
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div className="md:col-span-1">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Qty *
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) =>
                                handleItemChange(idx, "qty", Number(e.target.value))
                              }
                              required
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition"
                              title="Delete plate"
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
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition shadow-sm"
                  >
                    Generate Job Work Challan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
