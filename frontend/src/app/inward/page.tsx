"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ArrowDownLeft,
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
  CheckCircle2,
  Box,
  FileText,
  RotateCcw,
} from "lucide-react";
import type {
  Inward,
  InwardItem,
  Challan,
  Customer,
  Subplate,
} from "@/lib/supabase/types";

export default function InwardPage() {
  const [inwards, setInwards] = useState<Inward[]>([]);
  const [pendingChallans, setPendingChallans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subplates, setSubplates] = useState<Subplate[]>([]);
  const [kpis, setKpis] = useState({ totalInwards: 0, totalPendingChallanItems: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  // Add Inward Receipt Modal State (Source: inward/index.blade.php lines 53-150)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState<{
    chdate: string;
    vendorid: string;
    customerid: string;
    vendortid: string;
    challanid: string; // Outward Challan ID
    items: Array<{
      plateid: number;
      platename: string;
      customer: number;
      customername: string;
      project: string;
      particulars: string;
      qty: number; // Outward dispatched qty
      inward_qty: number; // Inward received qty now
    }>;
  }>({
    chdate: new Date().toISOString().slice(0, 10),
    vendorid: "",
    customerid: "",
    vendortid: "",
    challanid: "",
    items: [],
  });

  const [formError, setFormError] = useState<string | null>(null);

  const fetchInwards = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/inward");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inwards");
      setInwards(data.inwards || []);
      setPendingChallans(data.pendingChallans || []);
      setCustomers(data.customers || []);
      setSubplates(data.subplates || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch inward data");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchInwards();
  }, []);

  // Filtered dropdown lists strictly based on legacy usertype
  const vendors = useMemo(() => customers.filter((c) => c.usertype === "Vendor"), [customers]);
  const customersList = useMemo(() => customers.filter((c) => c.usertype === "Customer"), [customers]);
  const transporters = useMemo(() => customers.filter((c) => c.usertype === "Transport"), [customers]);

  // Outward challans for selected vendor with pending inward items
  const availableOutwardChallans = useMemo(() => {
    if (!modalForm.vendorid) return [];
    const vId = Number(modalForm.vendorid);
    return pendingChallans.filter((c) => c.vendorid === vId);
  }, [pendingChallans, modalForm.vendorid]);

  // Expand / collapse child rows
  const toggleRow = (id: number) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // KPI Calculations
  const totalInwards = kpis.totalInwards || inwards.length;
  const activeInwards = inwards.filter((i) => i.status === "1").length;
  const totalPlatesReceived = inwards.reduce(
    (acc, i) => acc + (i.items?.reduce((sum, it) => sum + (it.inward_qty || 0), 0) || 0),
    0
  );
  const uniqueVendorsCount = new Set(inwards.map((i) => i.vendorid)).size;

  // Filtered Inward List
  const filteredInwards = useMemo(() => {
    return inwards.filter((i) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        i.inchallanno.toLowerCase().includes(q) ||
        (i.challanno || "").toLowerCase().includes(q) ||
        (i.vendorname || "").toLowerCase().includes(q) ||
        (i.customername || "").toLowerCase().includes(q) ||
        (i.transportername || "").toLowerCase().includes(q) ||
        (i.projectid || "").toLowerCase().includes(q) ||
        (i.items || []).some(
          (it) =>
            (it.particulars || "").toLowerCase().includes(q) ||
            (it.platename || "").toLowerCase().includes(q)
        );

      const matchVendor = vendorFilter === "ALL" || String(i.vendorid) === vendorFilter;
      return matchSearch && matchVendor;
    });
  }, [inwards, searchQuery, vendorFilter]);

  // On selecting Outward Challan: auto-populate line items (inward/index.blade.php getichallandata())
  const handleSelectChallan = (challanIdStr: string) => {
    const challanId = Number(challanIdStr);
    const selectedChallan = pendingChallans.find((c) => c.id === challanId);

    if (selectedChallan) {
      const cust = customers.find((c) => c.id === selectedChallan.customer);
      const itemsToLoad = [
        {
          plateid: selectedChallan.plateid,
          platename: selectedChallan.platename || `Plate #${selectedChallan.plateid}`,
          customer: selectedChallan.customer,
          customername: selectedChallan.customername || cust?.customername || `Customer #${selectedChallan.customer}`,
          project: selectedChallan.projectid,
          particulars: selectedChallan.particulars,
          qty: selectedChallan.qty,
          inward_qty: selectedChallan.pending_qty,
        },
      ];

      setModalForm((prev) => ({
        ...prev,
        challanid: challanIdStr,
        customerid: String(selectedChallan.customer || ""),
        vendortid: String(selectedChallan.vendortid || selectedChallan.vendorid || ""),
        items: itemsToLoad,
      }));
    } else {
      setModalForm((prev) => ({
        ...prev,
        challanid: challanIdStr,
        items: [],
      }));
    }
  };

  const handleInwardQtyChange = (index: number, val: number) => {
    setModalForm((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        inward_qty: val,
      };
      return { ...prev, items: updated };
    });
  };

  const handleSubmitInward = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!modalForm.vendorid) {
      setFormError("Vendor Name is required.");
      return;
    }
    if (!modalForm.challanid) {
      setFormError("Please select the Outward Challan No.");
      return;
    }
    if (modalForm.items.length === 0) {
      setFormError("No plates found in this outward challan.");
      return;
    }

    for (let i = 0; i < modalForm.items.length; i++) {
      const it = modalForm.items[i];
      if (it.inward_qty < 0) {
        setFormError(`Row ${i + 1}: Received quantity cannot be negative.`);
        return;
      }
      if (it.inward_qty > it.qty) {
        setFormError(`Row ${i + 1}: Received quantity (${it.inward_qty}) cannot exceed outward dispatched quantity (${it.qty}).`);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/inward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modalForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save inward receipt");

      await fetchInwards();
      setIsModalOpen(false);
      setModalForm({
        chdate: new Date().toISOString().slice(0, 10),
        vendorid: "",
        customerid: "",
        vendortid: "",
        challanid: "",
        items: [],
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to record inward receipt");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInward = async (id: number) => {
    if (window.confirm("Are you sure you want to cancel this inward receipt?")) {
      try {
        const res = await fetch(`/api/inward?id=${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to cancel inward");
        }
        await fetchInwards();
      } catch (err: any) {
        alert("Error: " + err.message);
      }
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <ArrowDownLeft className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Inward Movement (Job Work Return)
                </h1>
                <p className="text-sm text-slate-500">
                  Receive finished plates returning from vendor jobwork (SM/IW/xx)
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
              <span>Export Pending Outward</span>
            </Link>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition shadow-sm shadow-emerald-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Inward Challan (Receive)</span>
            </button>
          </div>
        </div>

        {/* Metric KPI Counters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Inwards</p>
              <h3 className="text-2xl font-bold text-slate-900">{totalInwards.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Receipts</p>
              <h3 className="text-2xl font-bold text-blue-600">{activeInwards.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Plates Received</p>
              <h3 className="text-2xl font-bold text-indigo-600">{totalPlatesReceived.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Vendors</p>
              <h3 className="text-2xl font-bold text-slate-900">{uniqueVendorsCount}</h3>
            </div>
          </div>
        </div>

        {/* Controls Bar: Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Inward No, Outward Challan No, Vendor, Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Vendors ({vendors.length})</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.customername}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Main Inward Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-4 py-3.5">Inward No</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5">Outward Challan</th>
                  <th className="px-4 py-3.5">Vendor Name</th>
                  <th className="px-4 py-3.5">Customer Name</th>
                  <th className="px-4 py-3.5">Transporter</th>
                  <th className="px-4 py-3.5 text-center">Items Received</th>
                  <th className="px-4 py-3.5">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInwards.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      No inward jobwork receipts found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredInwards.map((i) => {
                    const isExpanded = !!expandedRows[i.id];
                    return (
                      <React.Fragment key={i.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3.5 text-center">
                            <button
                              onClick={() => toggleRow(i.id)}
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

                          <td className="px-4 py-3.5 font-bold text-emerald-600">
                            {i.inchallanno}
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              <span>{i.chdate}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 font-semibold text-blue-600">
                            {i.challanno}
                          </td>

                          <td className="px-4 py-3.5 font-medium text-slate-900">
                            {i.vendorname}
                          </td>

                          <td className="px-4 py-3.5 text-slate-700">
                            {i.customername}
                          </td>

                          <td className="px-4 py-3.5 text-slate-600 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Truck className="h-3.5 w-3.5 text-slate-400" />
                              <span>{i.transportername}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {i.items?.reduce((sum, it) => sum + (it.inward_qty || 0), 0) || 0} plates
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {i.created_by}
                          </td>
                        </tr>

                        {/* Child Rows: Sub-table for Received Inward Items */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-y border-slate-200">
                            <td colSpan={9} className="p-4 pl-14">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Plates Received in {i.inchallanno} (against {i.challanno})
                                  </h4>
                                  <span className="text-xs text-slate-400 font-mono">
                                    Project: {i.projectid}
                                  </span>
                                </div>

                                <div className="overflow-x-auto w-full">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                                      <tr>
                                        <th className="px-3 py-2">Plate Name</th>
                                        <th className="px-3 py-2">Mould</th>
                                        <th className="px-3 py-2">Particulars / Status</th>
                                        <th className="px-3 py-2 text-right">Dispatched Qty</th>
                                        <th className="px-3 py-2 text-right">Inward Qty Received</th>
                                        <th className="px-3 py-2 text-right">Pending Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {(i.items || []).map((it, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                          <td className="px-3 py-2 font-semibold text-slate-900">
                                            {it.platename || `Plate #${it.plateid}`}
                                          </td>
                                          <td className="px-3 py-2 text-slate-500 font-mono">
                                            {it.project || i.projectid}
                                          </td>
                                          <td className="px-3 py-2 text-slate-700">
                                            {it.particulars}
                                          </td>
                                          <td className="px-3 py-2 text-right font-medium text-slate-600">
                                            {it.qty}
                                          </td>
                                          <td className="px-3 py-2 text-right font-bold text-emerald-600">
                                            {it.inward_qty}
                                          </td>
                                          <td className="px-3 py-2 text-right font-semibold">
                                            {(it.pending_qty ?? 0) > 0 ? (
                                              <span className="text-amber-600 font-bold">
                                                {it.pending_qty}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400">0 (Completed)</span>
                                            )}
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
            {filteredInwards.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No inward jobwork receipts found matching your search.
              </div>
            ) : (
              filteredInwards.map((i) => {
                const isExpanded = !!expandedRows[i.id];
                return (
                  <div
                    key={i.id}
                    className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 font-mono">
                          {i.inchallanno}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          (Ref: {i.challanno})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {i.chdate}
                      </span>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-900 block">
                        {i.vendorname}
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Customer: {i.customername || "—"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 text-[11px]">
                        {(i.items || []).length} received plates
                      </span>
                      <button
                        onClick={() => toggleRow(i.id)}
                        className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition flex items-center justify-center cursor-pointer"
                      >
                        {isExpanded ? "Hide Plates" : "View Plates"}
                      </button>
                    </div>

                    {isExpanded && (i.items || []).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                        {i.items?.map((it, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-white border border-slate-200 text-[11px] flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-slate-800 block">
                                {it.platename || `Plate #${it.plateid}`}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {it.particulars || "Jobwork Done"}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-600 block">
                                Inward: {it.inward_qty}
                              </span>
                              {(it.pending_qty ?? 0) > 0 && (
                                <span className="text-[10px] text-amber-600">
                                  Pending: {it.pending_qty}
                                </span>
                              )}
                            </div>
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

        {/* Inward Challan Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-none sm:rounded-2xl shadow-xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-scale-up">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Inward Challan (Receive from Vendor)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Receive plates returned against an active outward jobwork challan (SM/IW/xx)
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
              <form onSubmit={handleSubmitInward} className="flex-1 overflow-y-auto p-6 space-y-6">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Form Selection Row (Source: inward/index.blade.php lines 65-115) */}
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Vendor Name *
                    </label>
                    <select
                      value={modalForm.vendorid}
                      onChange={(e) =>
                        setModalForm((prev) => ({
                          ...prev,
                          vendorid: e.target.value,
                          challanid: "",
                          items: [],
                        }))
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
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
                      Outward Challan No *
                    </label>
                    <select
                      value={modalForm.challanid}
                      onChange={(e) => handleSelectChallan(e.target.value)}
                      disabled={!modalForm.vendorid}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    >
                      <option value="">
                        {!modalForm.vendorid
                          ? "Select Vendor first"
                          : "Select Outward Challan"}
                      </option>
                      {availableOutwardChallans.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.challanno} ({c.chdate}) - {c.customername}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Transporter *
                    </label>
                    <select
                      value={modalForm.vendortid}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, vendortid: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Transporter Name</option>
                      {transporters.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.customername}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Auto-populated Outward Plates to Receive */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="text-sm font-bold text-slate-900">
                      Plates in Selected Challan ({modalForm.items.length})
                    </h4>
                    <span className="text-xs text-slate-500">
                      Enter the quantity physically received back in StarMould workshop
                    </span>
                  </div>

                  {modalForm.items.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                      {!modalForm.challanid
                        ? "Select an Outward Challan above to auto-load its dispatched plates."
                        : "No plates found on this outward challan."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {modalForm.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                        >
                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase">
                              Subplate
                            </label>
                            <span className="text-sm font-bold text-slate-900">
                              {it.platename}
                            </span>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase">
                              Mould
                            </label>
                            <span className="text-xs text-slate-600 font-mono">
                              {it.project}
                            </span>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase">
                              Particulars
                            </label>
                            <span className="text-xs text-slate-700">
                              {it.particulars}
                            </span>
                          </div>

                          <div className="md:col-span-2 text-center">
                            <label className="block text-[11px] font-semibold text-slate-500 uppercase">
                              Dispatched Qty
                            </label>
                            <span className="text-sm font-bold text-slate-700">
                              {it.qty}
                            </span>
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-emerald-700 uppercase">
                              Inward Qty (Receiving) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={it.qty}
                              value={it.inward_qty}
                              onChange={(e) =>
                                handleInwardQtyChange(idx, Number(e.target.value))
                              }
                              required
                              className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                            />
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
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition shadow-sm"
                  >
                    Confirm Inward Receipt
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
