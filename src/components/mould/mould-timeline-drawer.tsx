"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Wrench,
  ShieldCheck,
  Layers,
  FileText,
  Printer,
  Calendar,
  Building2,
  Box,
  Tag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Check,
  Sparkles,
  ArrowRight,
  Package,
} from "lucide-react";
import { TimelineEvent, LifecycleMilestone } from "@/app/api/projects/[id]/timeline/route";

interface MouldTimelineDrawerProps {
  projectId: number | string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDocument?: (docType: string, docId: number | string) => void;
}

type FilterCategory = "All" | "Stages & QC" | "Jobwork & Inwards" | "Machining Logs" | "Dispatch & Closures";
type DrawerTab = "story" | "matrix" | "audit";

export function MouldTimelineDrawer({
  projectId,
  isOpen,
  onClose,
  onOpenDocument,
}: MouldTimelineDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("story");
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["project_timeline", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/timeline`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load project timeline");
      }
      return res.json();
    },
    enabled: !!projectId && isOpen,
    staleTime: 10_000,
  });

  const toggleMilestoneExpand = (id: string) => {
    setExpandedMilestones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEventExpand = (id: string) => {
    setExpandedEvents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    return data.events.filter((ev: TimelineEvent) => {
      const matchesCategory = selectedFilter === "All" || ev.category === selectedFilter;
      if (!matchesCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        ev.title.toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        (ev.authorName && ev.authorName.toLowerCase().includes(q)) ||
        (ev.badgeLabel && ev.badgeLabel.toLowerCase().includes(q))
      );
    });
  }, [data?.events, selectedFilter, searchQuery]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "N/A";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const getNodeBorderColor = (color: LifecycleMilestone["badgeColor"]) => {
    switch (color) {
      case "purple":
        return "border-purple-300 bg-purple-50 text-purple-700";
      case "blue":
        return "border-blue-300 bg-blue-50 text-blue-700";
      case "emerald":
        return "border-emerald-300 bg-emerald-50 text-emerald-700";
      case "teal":
        return "border-teal-300 bg-teal-50 text-teal-700";
      case "amber":
        return "border-amber-300 bg-amber-50 text-amber-700";
      case "rose":
        return "border-rose-300 bg-rose-50 text-rose-700";
      default:
        return "border-slate-300 bg-slate-50 text-slate-700";
    }
  };

  const handlePrintDossier = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        />

        {/* Slide-over Content Drawer */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-slate-200 z-10"
        >
          {/* Top Sticky Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                <Box className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {data?.project?.projectid || projectId}
                  </h3>
                  {data?.stats?.isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <Clock className="w-3.5 h-3.5" />
                      Active Pipeline
                    </span>
                  )}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                    {data?.project?.worktype || "Tooling"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium text-slate-700">{data?.project?.customerName || "Customer"}</span>
                  <span>•</span>
                  <span>{data?.project?.description || "Mould Set"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrintDossier}
                title="Print Mould Audit Dossier"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar (Compact, high-density) */}
          {data && (
            <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0 overflow-x-auto">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400">Duration:</span>
                <span className="font-bold text-slate-800">{data.stats?.durationDays || 1}d</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({data.project?.receivedDate || "N/A"} → {data.project?.dispatchDate || "Active"})
                </span>
              </div>
              <div className="h-3 w-px bg-slate-300 shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400">Machining:</span>
                <span className="font-bold text-blue-700">{data.stats?.totalMachiningHours || "00:00"} hr</span>
              </div>
              <div className="h-3 w-px bg-slate-300 shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400">Components:</span>
                <span className="font-bold text-slate-800">{data.stats?.totalPlates || 0} plates</span>
              </div>
              <div className="h-3 w-px bg-slate-300 shrink-0" />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-slate-400">Coverage:</span>
                <span className="font-bold text-emerald-700">{data.stats?.dispatchCoverage?.percentage || 0}%</span>
                <span className="text-[10px] text-slate-500">
                  ({data.stats?.dispatchedPlatesCount || 0} Disp • {data.stats?.directClosedPlatesCount || 0} Direct)
                </span>
              </div>
            </div>
          )}

          {/* View Mode Switcher Pills */}
          <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("story")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === "story"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ⚡ Clean Lifecycle Story ({data?.milestones?.length || 0} Steps)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("matrix")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === "matrix"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🧩 Subplates ({data?.subplates?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeTab === "audit"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📜 Raw Audit Events ({data?.events?.length || 0})
              </button>
            </div>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {isLoading && (
              <div className="py-24 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Clock className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Assembling mould lifecycle summary...</p>
              </div>
            )}

            {isError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error instanceof Error ? error.message : "Failed to load timeline events"}</span>
              </div>
            )}

            {!isLoading && data && (
              <>
                {/* TAB 1: CLEAN LIFECYCLE STORY (STEP 1, STEP 2, STEP 3...) */}
                {activeTab === "story" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                      <span>Simple, chronological milestone overview of this mould tooling:</span>
                      <span className="font-semibold text-slate-700">
                        {data.milestones?.length || 0} Sequential Milestones
                      </span>
                    </div>

                    <div className="relative pl-7 space-y-5 before:absolute before:left-[13px] before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-200">
                      {data.milestones?.map((ms: LifecycleMilestone) => {
                        const isExpanded = !!expandedMilestones[ms.id];
                        const hasExpandableContent = (ms.subItems && ms.subItems.length > 0) || (ms.details && ms.details.length > 0);

                        return (
                          <div key={ms.id} className="relative group">
                            {/* Step Badge Bullet on Line */}
                            <div
                              className={`absolute -left-[27px] top-1.5 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center text-[10px] font-bold shadow-2xs ${getNodeBorderColor(
                                ms.badgeColor
                              )}`}
                            >
                              {ms.step}
                            </div>

                            {/* Milestone Card */}
                            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all space-y-2.5">
                              {/* Header row */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900">{ms.title}</h4>
                                    <span
                                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getNodeBorderColor(
                                        ms.badgeColor
                                      )}`}
                                    >
                                      {ms.badgeLabel}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">{ms.description}</p>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-400 shrink-0 whitespace-nowrap">
                                  {formatDate(ms.timestamp)}
                                </span>
                              </div>

                              {/* Document Action Pill Link (e.g. View Challan / PO) */}
                              {ms.documentLink && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenDocument?.(ms.documentLink!.type, ms.documentLink!.id)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200/80 transition-colors cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Open Document: {ms.documentLink.label}</span>
                                    <ExternalLink className="w-3 h-3 text-blue-500" />
                                  </button>
                                </div>
                              )}

                              {/* Inset Sub-items Preview */}
                              {ms.subItems && ms.subItems.length > 0 && !isExpanded && (
                                <div className="pt-1 flex flex-wrap gap-1.5">
                                  {ms.subItems.slice(0, 4).map((sub, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-700"
                                    >
                                      <span className="font-semibold">{sub.name}</span>
                                      <span className="text-slate-400">({sub.status})</span>
                                    </span>
                                  ))}
                                  {ms.subItems.length > 4 && (
                                    <span className="text-[11px] text-blue-600 font-medium self-center">
                                      +{ms.subItems.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Expand/Collapse Toggle */}
                              {hasExpandableContent && (
                                <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                                  <button
                                    type="button"
                                    onClick={() => toggleMilestoneExpand(ms.id)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                                  >
                                    <span>{isExpanded ? "Hide Details" : "View Breakdown & Details"}</span>
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>

                                  {ms.authorName && (
                                    <span className="text-[10px] text-slate-400">
                                      Recorded by: <span className="font-medium text-slate-600">{ms.authorName}</span>
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Expanded Payload Content */}
                              {isExpanded && (
                                <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                                  {ms.details && ms.details.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200/80">
                                      {ms.details.map((d, dIdx) => (
                                        <div key={dIdx}>
                                          <p className="text-[10px] font-medium text-slate-400">{d.label}</p>
                                          <p className="font-semibold text-slate-800">{d.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {ms.subItems && ms.subItems.length > 0 && (
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                                        Component Breakdown ({ms.subItems.length}):
                                      </p>
                                      <div className="divide-y divide-slate-200/70 border border-slate-200/80 rounded-md bg-white overflow-hidden max-h-48 overflow-y-auto">
                                        {ms.subItems.map((sub, sIdx) => (
                                          <div key={sIdx} className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                                            <span className="font-semibold text-slate-800">{sub.name}</span>
                                            <span className="text-slate-600 text-right">{sub.status}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 2: SUBPLATE MATRIX TABLE */}
                {activeTab === "matrix" && (
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Subplates Tooling Matrix ({data.subplates?.length || 0})
                        </span>
                        <span className="text-xs text-slate-500">
                          {data.stats?.dispatchedPlatesCount} Dispatched • {data.stats?.directClosedPlatesCount} Closed Direct
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {data.subplates?.map((sp: any) => (
                          <div key={sp.id} className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-bold text-slate-900 truncate">{sp.platename}</p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {sp.length}x{sp.width}x{sp.height}mm • {sp.material || "Steel"} • {sp.shape || "Rectangle"}
                              </p>
                              {sp.closureReason && (
                                <p className="text-[10px] text-amber-700 font-medium">
                                  Closure: {sp.closureReason}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {sp.isDispatched ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Dispatched
                                </span>
                              ) : sp.isDirectClosed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                  Direct Closed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  In-House ({sp.location || "SM"})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: GRANULAR AUDIT FEED */}
                {activeTab === "audit" && (
                  <div className="space-y-4">
                    {/* Filter Chips & Search Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          Granular Log ({filteredEvents.length} events)
                        </span>
                        <div className="relative w-44 sm:w-56">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter audit events..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                        {(["All", "Stages & QC", "Jobwork & Inwards", "Machining Logs", "Dispatch & Closures"] as FilterCategory[]).map(
                          (cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedFilter(cat)}
                              className={`px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all text-xs cursor-pointer ${
                                selectedFilter === cat
                                  ? "bg-slate-900 text-white shadow-2xs"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                              }`}
                            >
                              {cat}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Vertical Event Cards */}
                    <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                      {filteredEvents.length === 0 ? (
                        <div className="py-10 text-center text-xs text-slate-400">
                          No events match the selected filter.
                        </div>
                      ) : (
                        filteredEvents.map((ev: TimelineEvent) => {
                          const isExpanded = !!expandedEvents[ev.id];
                          return (
                            <div key={ev.id} className="relative group">
                              <div
                                className={`absolute -left-[23px] top-1.5 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center shadow-2xs ${getNodeBorderColor(
                                  ev.badgeColor
                                )}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              </div>

                              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-all space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-xs font-bold text-slate-900">{ev.title}</h4>
                                      <span
                                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${getNodeBorderColor(
                                          ev.badgeColor
                                        )}`}
                                      >
                                        {ev.badgeLabel}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{ev.description}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {formatDate(ev.timestamp)}
                                  </span>
                                </div>

                                {ev.documentLink && (
                                  <div className="pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => onOpenDocument?.(ev.documentLink!.type, ev.documentLink!.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 cursor-pointer"
                                    >
                                      <span>View {ev.documentLink.label}</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="font-mono text-[11px]">Audit Record: {data?.project?.projectid || projectId}</span>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
