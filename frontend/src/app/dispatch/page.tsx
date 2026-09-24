"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Truck,
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

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subplates, setSubplates] = useState<Subplate[]>([]);
  const [scans, setScans] = useState<ScanProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Live Supabase fetch for dispatches, customers, subplates, scans
  const fetchDispatchData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/dispatch?limit=200");
      const data = await res.json();
      if (data.dispatches) {
        setDispatches(data.dispatches);
      }
      if (data.customers) {
        setCustomers(data.customers);
      }
      if (data.subplates) {
        setSubplates(data.subplates);
      }
      if (data.scans) {
        setScans(data.scans);
      }
    } catch (err) {
      console.error("Failed to load live dispatch data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDispatchData();
  }, []);

  // Add Dispatch Challan Modal State (Source: dispatch/index.blade.php lines 96-280)
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    freightcharge: "N/A",
    noofcases: "1",
    items: [],
  });

  const [formError, setFormError] = useState<string | null>(null);

  // Filtered dropdown lists strictly based on legacy usertype
  const customersList = useMemo(() => customers.filter((c) => c.usertype === "Customer"), [customers]);
  const transporters = useMemo(() => customers.filter((c) => c.usertype === "Transport"), [customers]);

  // Mould projects for selected customer
  const availableProjects = useMemo(() => {
    if (!modalForm.customerid) return [];
    const custId = String(modalForm.customerid);
    return scans.filter((s) => String(s.cname) === custId || String(s.cname) === "0" || !s.cname);
  }, [scans, modalForm.customerid]);

  // Available subplates for selected project that are ready for dispatch (location = 'SM')
  const availablePlates = useMemo(() => {
    if (!modalForm.projectid) return [];
    return subplates.filter(
      (sp) =>
        String(sp.projectid) === String(modalForm.projectid) ||
        sp.subprojectid?.includes(modalForm.projectid)
    );
  }, [subplates, modalForm.projectid]);

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
          customer: cust?.customername || "",
          project: prev.projectid,
          particulars: "",
          condition: "NEW",
          work: "NEW MADE",
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
    if (!modalForm.invoiceno.trim()) {
      setFormError("Invoice No is required (enter N/A if not generated yet).");
      return;
    }
    if (!modalForm.vehicleno.trim()) {
      setFormError("Vehicle No is required (enter N/A if not assigned).");
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
      setIsLoading(true);
      const res = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chdate: modalForm.chdate,
          customerid: Number(modalForm.customerid),
          vendortid: Number(modalForm.vendortid),
          projectid: modalForm.projectid,
          invoiceno: modalForm.invoiceno,
          vehicleno: modalForm.vehicleno,
          deliverytype: modalForm.deliverytype,
          freightmode: modalForm.freightmode,
          freightcharge: modalForm.freightcharge,
          noofcases: modalForm.noofcases,
          items: modalForm.items,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to create dispatch challan");
        return;
      }

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
        freightcharge: "N/A",
        noofcases: "1",
        items: [],
      });
      await fetchDispatchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error creating dispatch";
      setFormError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDispatch = async (id: number) => {
    if (!confirm("Are you sure you want to delete this dispatch challan?")) return;
    try {
      const res = await fetch(`/api/dispatch?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDispatches((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete dispatch:", err);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
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

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Dispatch Challan</span>
            </button>
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

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Customers ({customersList.length})</option>
              {customersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customername}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Dispatches Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto w-full">
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
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => toggleRow(d.id)}
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
                            <button
                              onClick={() => handleDeleteDispatch(d.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                              title="Delete Challan"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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
                                            {it.work || "NEW MADE"}
                                          </td>
                                          <td className="px-3 py-2 text-slate-700">
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
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
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
                      <button
                        onClick={() => toggleRow(d.id)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition flex items-center justify-center cursor-pointer"
                      >
                        {isExpanded ? "Hide Items" : "View Items"}
                      </button>
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
                                {it.condition || "NEW"} • {it.work || "NEW MADE"}
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
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Add Dispatch Challan
                    </h3>
                    <p className="text-xs text-slate-500">
                      Customer Delivery Document (SM/DC/xxxx format)
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
              <form onSubmit={handleSubmitDispatch} className="flex-1 overflow-y-auto p-6 space-y-6">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Compact Row 1: Dispatch Logistics Fields (Source: dispatch/index.blade.php lines 175-251) */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Today&apos;s Date *
                    </label>
                    <input
                      type="date"
                      value={modalForm.chdate}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, chdate: e.target.value }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Invoice No *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. STPL/43/25-26"
                      value={modalForm.invoiceno}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, invoiceno: e.target.value }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vehicle No *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. GJ03CU1839"
                      value={modalForm.vehicleno}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, vehicleno: e.target.value }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Freight Charge *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1500 or N/A"
                      value={modalForm.freightcharge}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, freightcharge: e.target.value }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. of Cases *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 02"
                      value={modalForm.noofcases}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, noofcases: e.target.value }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Delivery Type *
                    </label>
                    <select
                      value={modalForm.deliverytype}
                      onChange={(e) =>
                        setModalForm((prev) => ({
                          ...prev,
                          deliverytype: e.target.value as any,
                        }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Door Delivery">Door Delivery</option>
                      <option value="Godown Delivery">Godown Delivery</option>
                      <option value="Door Pickup">Door Pickup</option>
                      <option value="Hand To Hand">Hand To Hand</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Freight Mode *
                    </label>
                    <select
                      value={modalForm.freightmode}
                      onChange={(e) =>
                        setModalForm((prev) => ({
                          ...prev,
                          freightmode: e.target.value as any,
                        }))
                      }
                      required
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="To Pay">To Pay</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                </div>

                {/* Big Dropdowns: Customer, Transporter, Mould */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Customer Name</option>
                      {customersList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customername}
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      <option value="">
                        {!modalForm.customerid
                          ? "Select Customer first"
                          : "Select Mould Project"}
                      </option>
                      {availableProjects.map((p) => (
                        <option key={p.id} value={p.projectid || ""}>
                          {p.projectid} - {p.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dispatch Line Items Repeater */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Dispatch Items ({modalForm.items.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddItemRow("regular")}
                        disabled={!modalForm.projectid}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Subplate</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddItemRow("custom")}
                        disabled={!modalForm.projectid}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 text-xs font-semibold transition disabled:opacity-50"
                      >
                        <Box className="h-3.5 w-3.5" />
                        <span>Add Custom Mould Set</span>
                      </button>
                    </div>
                  </div>

                  {modalForm.items.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                      No dispatch items added. Add either standard subplates or custom tooling sets above.
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
                              {item.itemType === "regular"
                                ? "Subplate (Completed) *"
                                : "Custom Mould Set Name *"}
                            </label>
                            {item.itemType === "regular" ? (
                              <select
                                value={item.plateid}
                                onChange={(e) =>
                                  handleItemChange(idx, "plateid", e.target.value)
                                }
                                required
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                              >
                                <option value="">Select Subplate</option>
                                {availablePlates.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.platename} ({p.material || "Steel"})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                placeholder="e.g. 104x104 Square Hotpress Set"
                                value={item.custom_plate_name}
                                onChange={(e) =>
                                  handleItemChange(idx, "custom_plate_name", e.target.value)
                                }
                                required
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium focus:ring-1 focus:ring-indigo-500"
                              />
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Condition *
                            </label>
                            <input
                              type="text"
                              value={item.condition}
                              onChange={(e) =>
                                handleItemChange(idx, "condition", e.target.value)
                              }
                              placeholder="e.g. NEW"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs uppercase focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Nature of Work *
                            </label>
                            <input
                              type="text"
                              value={item.work}
                              onChange={(e) =>
                                handleItemChange(idx, "work", e.target.value)
                              }
                              placeholder="e.g. NEW MADE"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs uppercase focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Particulars *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Polished and Quality Checked"
                              value={item.particulars}
                              onChange={(e) =>
                                handleItemChange(idx, "particulars", e.target.value)
                              }
                              required
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div className="md:col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition"
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
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm"
                  >
                    Generate Dispatch Challan
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
