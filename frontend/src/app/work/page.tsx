"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Briefcase,
  Search,
  Plus,
  Calendar,
  Clock,
  Building2,
  Layers,
  UserCheck,
  CheckCircle2,
  FileSpreadsheet,
  X,
  Filter,
  BarChart3,
  History,
  AlertCircle,
  Wrench,
  ChevronRight,
} from "lucide-react";
import type {
  Worklog,
  Customer,
  ScanProject,
  Subplate,
  User,
} from "@/lib/supabase/types";

// Helper to format ISO or datetime to YYYY-MM-DD
const formatDateStr = (dateVal: string | null | undefined): string => {
  if (!dateVal) return "—";
  try {
    return dateVal.split("T")[0];
  } catch {
    return String(dateVal);
  }
};

// Helper to parse HH:MM:SS to total minutes
const parseDurationMinutes = (duration: string | null | undefined): number => {
  if (!duration) return 0;
  const parts = String(duration).split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return Number(duration) * 60 || 0;
};

// Helper to format minutes to HH:MM (Source: WorkController.php:53-55)
const formatMinutesToHHMM = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export default function WorkPage() {
  const [worklogs, setWorklogs] = useState<Worklog[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scans, setScans] = useState<ScanProject[]>([]);
  const [subplates, setSubplates] = useState<Subplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [kpis, setKpis] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Active Tab: 1. Daily Worklog, 2. Master Worklist (workdata), 3. Dept Breakdown (pendingwork)
  const [activeTab, setActiveTab] = useState<"daily" | "history" | "breakdown">(
    "daily"
  );

  // Daily Filter State
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("ALL");
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("");

  // History Tab Filter States (Source: workdata.blade.php)
  const [historySearch, setHistorySearch] = useState("");
  const [historyCustomer, setHistoryCustomer] = useState("ALL");
  const [historyProject, setHistoryProject] = useState("ALL");
  const [historyUser, setHistoryUser] = useState("ALL");

  // Modal State - Add Work
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    rdate: new Date().toISOString().split("T")[0],
    customerid: "",
    projectid: "",
    subplateid: "",
    workdescription: "",
    sdate: new Date().toISOString().split("T")[0],
    edate: new Date().toISOString().split("T")[0],
    starttime: "09:00",
    endtime: "17:30",
    design_hr: "0",
    program_hr: "0",
    machine_hr: "0",
    driltap_hr: "0",
    qc_hr: "0",
  });

  const fetchWorklogs = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await fetch("/api/worklog");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load worklogs");
      setWorklogs(data.worklogs || []);
      setCustomers(data.customers || []);
      setUsers(data.users || []);
      setScans(data.scans || []);
      setSubplates(data.subplates || []);
      if (data.kpis) setKpis(data.kpis);
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch worklogs");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchWorklogs();
  }, []);

  // Active staff
  const activeStaff = useMemo(() => {
    return users.filter((u) => String(u.status) === "1");
  }, [users]);

  // Moulds filtered for selected customer in modal
  const customerMoulds = useMemo(() => {
    if (!modalForm.customerid) return [];
    return scans.filter(
      (s) =>
        String(s.cname) === modalForm.customerid ||
        (s as any).customername === modalForm.customerid
    );
  }, [modalForm.customerid, scans]);

  // Selected mould data for read-only auto-fill
  const selectedMould = useMemo(() => {
    if (!modalForm.projectid) return null;
    return scans.find((s) => s.projectid === modalForm.projectid || String(s.id) === modalForm.projectid);
  }, [modalForm.projectid, scans]);

  // Subplates for selected mould in modal
  const mouldSubplates = useMemo(() => {
    if (!modalForm.projectid) return [];
    return subplates.filter(
      (sp) =>
        sp.projectid === modalForm.projectid ||
        sp.projectid === String(selectedMould?.id)
    );
  }, [modalForm.projectid, subplates, selectedMould]);

  // Auto-calculated work duration based on start/end date & time
  const calculatedDuration = useMemo(() => {
    try {
      const start = new Date(`${modalForm.sdate}T${modalForm.starttime}`);
      const end = new Date(`${modalForm.edate}T${modalForm.endtime}`);
      const diffMs = end.getTime() - start.getTime();
      if (diffMs > 0) {
        const diffMinutes = Math.floor(diffMs / 60000);
        return formatMinutesToHHMM(diffMinutes);
      }
    } catch {
      // fallback
    }
    return "08:30";
  }, [modalForm.sdate, modalForm.edate, modalForm.starttime, modalForm.endtime]);

  // Daily tab filtered worklogs
  const dailyWorklogs = useMemo(() => {
    return worklogs.filter((w) => {
      const matchUser =
        selectedUserFilter === "ALL" || String(w.userid) === selectedUserFilter;
      const matchDate =
        !selectedDateFilter ||
        formatDateStr(w.rdate) === selectedDateFilter;
      return matchUser && matchDate;
    });
  }, [worklogs, selectedUserFilter, selectedDateFilter]);

  // Daily total hours calculated for KPI (Source: WorkController.php:43-55)
  const dailyTotalHours = useMemo(() => {
    const totalMinutes = dailyWorklogs.reduce(
      (sum, w) => sum + parseDurationMinutes(w.work_hr),
      0
    );
    return formatMinutesToHHMM(totalMinutes);
  }, [dailyWorklogs]);

  // History tab filtered worklogs
  const historyWorklogs = useMemo(() => {
    return worklogs.filter((w) => {
      const q = historySearch.toLowerCase();
      const matchQuery =
        !historySearch ||
        w.projectid?.toLowerCase().includes(q) ||
        w.subplateid?.toLowerCase().includes(q) ||
        w.workdescription?.toLowerCase().includes(q) ||
        (w as any).customername?.toLowerCase().includes(q) ||
        (w as any).workername?.toLowerCase().includes(q) ||
        w.username?.toLowerCase().includes(q);

      const matchCust =
        historyCustomer === "ALL" || String(w.customerid) === historyCustomer;
      const matchProj =
        historyProject === "ALL" || w.projectid === historyProject;
      const matchUsr =
        historyUser === "ALL" || String(w.userid) === historyUser;

      return matchQuery && matchCust && matchProj && matchUsr;
    });
  }, [worklogs, historySearch, historyCustomer, historyProject, historyUser]);

  // Department breakdown user summary (Source: pendingwork.blade.php)
  const departmentBreakdown = useMemo(() => {
    const userMap = new Map<
      number,
      {
        userId: number;
        username: string;
        userinitials: string;
        workMinutes: number;
        designHr: number;
        programHr: number;
        machineHr: number;
        driltapHr: number;
        qcHr: number;
        entryCount: number;
      }
    >();

    worklogs.forEach((w) => {
      const uid = w.userid || 0;
      const current = userMap.get(uid) || {
        userId: uid,
        username: (w as any).workername || w.username || `User #${uid}`,
        userinitials: (w as any).worker_initials || w.userinitials || "SM",
        workMinutes: 0,
        designHr: 0,
        programHr: 0,
        machineHr: 0,
        driltapHr: 0,
        qcHr: 0,
        entryCount: 0,
      };

      current.workMinutes += parseDurationMinutes(w.work_hr);
      current.designHr += Number(w.design_hr || 0);
      current.programHr += Number(w.program_hr || 0);
      current.machineHr += Number(w.machine_hr || 0);
      current.driltapHr += Number(w.driltap_hr || 0);
      current.qcHr += Number(w.qc_hr || 0);
      current.entryCount += 1;

      userMap.set(uid, current);
    });

    return Array.from(userMap.values());
  }, [worklogs]);

  // Handle Add Work Form Submit (Live API POST)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.customerid || !modalForm.projectid) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...modalForm,
          work_hr: calculatedDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create worklog");

      await fetchWorklogs();
      setIsModalOpen(false);
      setModalForm({
        rdate: new Date().toISOString().split("T")[0],
        customerid: "",
        projectid: "",
        subplateid: "",
        workdescription: "",
        sdate: new Date().toISOString().split("T")[0],
        edate: new Date().toISOString().split("T")[0],
        starttime: "09:00",
        endtime: "17:30",
        design_hr: "0",
        program_hr: "0",
        machine_hr: "0",
        driltap_hr: "0",
        qc_hr: "0",
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const dataToExport = activeTab === "history" ? historyWorklogs : dailyWorklogs;
    const headers = [
      "ID",
      "Date",
      "Customer",
      "Mould Code",
      "Subplate",
      "Worker",
      "Duration",
      "Start Time",
      "End Time",
      "Description",
    ];
    const rows = dataToExport.map((w) => [
      w.id,
      formatDateStr(w.rdate),
      `"${w.customername || ""}"`,
      w.projectid,
      w.subplateid || "—",
      `"${w.username || ""}"`,
      w.work_hr,
      w.starttime,
      w.endtime,
      `"${(w.workdescription || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Worklogs_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AppLayout>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Briefcase className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Work Log & Production Hours
              </h1>
              <p className="text-sm text-slate-500">
                Record machine times, VMC cycles, designing sessions, and staff departmental work logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition shadow-sm text-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-sm shadow-indigo-500/20 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Work Entry
            </button>
          </div>
        </div>

        {/* Navigation Tabs (3 Authentic Blade Views) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeTab === "daily"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Clock className="w-4 h-4" />
            Daily Work Log
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4" />
            Work Register (Master List)
          </button>
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeTab === "breakdown"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Department Breakdown
          </button>
        </div>

        {/* TAB 1: DAILY WORK LOG (index.blade.php) */}
        {activeTab === "daily" && (
          <div className="space-y-4">
            {/* Filter Bar & KPI Badge */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {/* User Filter (Source: index.blade.php:61-66) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Worker:
                  </span>
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
                  >
                    <option value="ALL">All Workers</option>
                    {users.map((u) => (
                      <option key={u.id} value={String(u.id)}>
                        {u.name} ({u.initials})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Filter (Source: index.blade.php:70) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase">
                    Date:
                  </span>
                  <input
                    type="date"
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                  {selectedDateFilter && (
                    <button
                      onClick={() => setSelectedDateFilter("")}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Total Hours Badge matching legacy index.blade.php:46 */}
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-mono font-bold text-sm">
                  Total Logged: {dailyTotalHours} Hrs
                </span>
                <span className="text-xs text-slate-400">
                  {dailyWorklogs.length} entries
                </span>
              </div>
            </div>

            {/* Daily Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4"># ID</th>
                      <th className="py-3.5 px-4">Worker</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Mould Code</th>
                      <th className="py-3.5 px-4">Subplate</th>
                      <th className="py-3.5 px-4">Work Description</th>
                      <th className="py-3.5 px-4">Start Time</th>
                      <th className="py-3.5 px-4">End Time</th>
                      <th className="py-3.5 px-4 text-right font-bold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyWorklogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          className="py-12 text-center text-slate-400 text-sm"
                        >
                          No daily work records found for this selection.
                        </td>
                      </tr>
                    ) : (
                      dailyWorklogs.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50/60 transition group"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-slate-400">
                            #{row.id}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {row.username || `User #${row.userid}`}
                          </td>
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {row.customername || "—"}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-xs text-indigo-600 whitespace-nowrap">
                            {row.projectid}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600">
                            {row.subplateid || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {row.workdescription || "—"}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                            {row.starttime}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                            {row.endtime}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {row.work_hr}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER WORKLIST REGISTER (workdata.blade.php) */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search mould, subplate, description, customer..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                <select
                  value={historyCustomer}
                  onChange={(e) => setHistoryCustomer(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
                >
                  <option value="ALL">All Customers</option>
                  {customers
                    .filter((c) => c.usertype === "Customer")
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.customername}
                      </option>
                    ))}
                </select>

                <select
                  value={historyUser}
                  onChange={(e) => setHistoryUser(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 font-medium"
                >
                  <option value="ALL">All Staff</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="text-xs text-slate-400">
                Showing {historyWorklogs.length} recorded worklogs
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Worker</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Mould Code</th>
                      <th className="py-3.5 px-4">Subplate</th>
                      <th className="py-3.5 px-4">Work Description</th>
                      <th className="py-3.5 px-4 text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyWorklogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-slate-400 text-sm"
                        >
                          No worklogs found matching your filters.
                        </td>
                      </tr>
                    ) : (
                      historyWorklogs.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50/60 transition group"
                        >
                          <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-xs">
                            {formatDateStr(row.rdate)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {row.username || `User #${row.userid}`}
                          </td>
                          <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                            {row.customername}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-xs text-indigo-600 whitespace-nowrap">
                            {row.projectid}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600">
                            {row.subplateid || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-md truncate">
                            {row.workdescription}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {row.work_hr}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DEPARTMENT BREAKDOWN SUMMARY (pendingwork.blade.php) */}
        {activeTab === "breakdown" && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Staff Departmental Work Distribution
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aggregated hours across Designing, Programming, Machining, Drill Tap, and QC stages
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                  {departmentBreakdown.length} active contributors
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Staff Member</th>
                      <th className="py-3.5 px-4 text-center">Initials</th>
                      <th className="py-3.5 px-4 text-right">Designing Hr</th>
                      <th className="py-3.5 px-4 text-right">Programming Hr</th>
                      <th className="py-3.5 px-4 text-right">Machining Hr</th>
                      <th className="py-3.5 px-4 text-right">Drill Tap Hr</th>
                      <th className="py-3.5 px-4 text-right">QC Hr</th>
                      <th className="py-3.5 px-4 text-right font-bold text-indigo-700">
                        Total Logged
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {departmentBreakdown.map((row) => (
                      <tr
                        key={row.userId}
                        className="hover:bg-slate-50/60 transition"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {row.username}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500">
                          <span className="px-2 py-0.5 bg-slate-100 rounded">
                            {row.userinitials}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600">
                          {row.designHr}h
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600">
                          {row.programHr}h
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600">
                          {row.machineHr}h
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600">
                          {row.driltapHr}h
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-600">
                          {row.qcHr}h
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-indigo-600">
                          {formatMinutesToHHMM(row.workMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add Work Entry */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Record Mould Work
                    </h3>
                    <p className="text-xs text-slate-500">
                      Submit task duration, VMC operations, and subplate activity
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleCreate}
                className="p-6 space-y-4 overflow-y-auto flex-1"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Submission Date
                    </label>
                    <input
                      type="date"
                      required
                      value={modalForm.rdate}
                      onChange={(e) =>
                        setModalForm({ ...modalForm, rdate: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={modalForm.customerid}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          customerid: e.target.value,
                          projectid: "",
                          subplateid: "",
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Customer</option>
                      {customers
                        .filter((c) => c.usertype === "Customer")
                        .map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.customername}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mould Name / Code <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!modalForm.customerid}
                      value={modalForm.projectid}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          projectid: e.target.value,
                          subplateid: "",
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Mould</option>
                      {customerMoulds.map((m) => (
                        <option
                          key={m.id}
                          value={m.projectid || String(m.id)}
                        >
                          {m.projectid} — {m.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Subplate <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      disabled={!modalForm.projectid}
                      value={modalForm.subplateid}
                      onChange={(e) =>
                        setModalForm({
                          ...modalForm,
                          subplateid: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Subplate</option>
                      {mouldSubplates.length === 0 ? (
                        <option value="GENERAL">Default / Main Plate</option>
                      ) : (
                        mouldSubplates.map((sp) => (
                          <option
                            key={sp.id}
                            value={sp.subprojectid || String(sp.id)}
                          >
                            {sp.platename} ({sp.material})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Read-Only Details from selected mould matching legacy work/index.blade.php:158-173 */}
                {selectedMould && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
                    <div>
                      <span className="font-semibold text-slate-400 uppercase">
                        Work Type:
                      </span>
                      <p className="font-bold text-slate-800">
                        {selectedMould.worktype || "Standard Machining"}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 uppercase">
                        Part Description:
                      </span>
                      <p className="text-slate-700 truncate">
                        {selectedMould.description}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Task / Operation Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe specific work done (e.g. drilling, rough milling, face grinding)..."
                    value={modalForm.workdescription}
                    onChange={(e) =>
                      setModalForm({
                        ...modalForm,
                        workdescription: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Start Date & Time
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        required
                        value={modalForm.sdate}
                        onChange={(e) =>
                          setModalForm({ ...modalForm, sdate: e.target.value })
                        }
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="time"
                        required
                        value={modalForm.starttime}
                        onChange={(e) =>
                          setModalForm({
                            ...modalForm,
                            starttime: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      End Date & Time
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        required
                        value={modalForm.edate}
                        onChange={(e) =>
                          setModalForm({ ...modalForm, edate: e.target.value })
                        }
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        type="time"
                        required
                        value={modalForm.endtime}
                        onChange={(e) =>
                          setModalForm({
                            ...modalForm,
                            endtime: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Calculated Hours Preview */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-200/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-900 text-xs">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Calculated Work Duration:</span>
                  </div>
                  <span className="font-mono text-base font-black text-indigo-700">
                    {calculatedDuration} Hrs
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-50 font-medium rounded-xl text-sm transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-sm transition"
                  >
                    Save Work Entry
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
