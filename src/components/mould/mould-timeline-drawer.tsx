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
} from "lucide-react";
import { TimelineEvent } from "@/app/api/projects/[id]/timeline/route";

interface MouldTimelineDrawerProps {
  projectId: number | string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDocument?: (docType: string, docId: number | string) => void;
}

type FilterCategory = "All" | "Stages & QC" | "Jobwork & Inwards" | "Machining Logs" | "Dispatch & Closures";

export function MouldTimelineDrawer({
  projectId,
  isOpen,
  onClose,
  onOpenDocument,
}: MouldTimelineDrawerProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
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

  const toggleExpand = (id: string) => {
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

  // Format relative time helper
  const getRelativeTime = (timestamp: string) => {
    try {
      const now = new Date();
      const past = new Date(timestamp);
      const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return past.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return timestamp;
    }
  };

  // Node Icon Resolver
  const renderNodeIcon = (type: TimelineEvent["eventType"], color: TimelineEvent["badgeColor"]) => {
    switch (type) {
      case "PROJECT_CREATED":
        return <Box className="w-4 h-4 text-purple-600" />;
      case "SUBPLATES_ADDED":
        return <Layers className="w-4 h-4 text-blue-600" />;
      case "PURCHASE_ORDER":
      case "MATERIAL_INWARD":
        return <FileText className="w-4 h-4 text-teal-600" />;
      case "STAGE_MILESTONE":
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case "JOBWORK_OUTWARD":
      case "JOBWORK_INWARD":
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case "WORKLOG_HOURS":
        return <Clock className="w-4 h-4 text-blue-600" />;
      case "DISPATCH_CHALLAN":
        return <Truck className="w-4 h-4 text-emerald-600" />;
      case "DIRECT_CLOSURE":
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-slate-600" />;
    }
  };

  // Node Color Resolver
  const getNodeBorderColor = (color: TimelineEvent["badgeColor"]) => {
    switch (color) {
      case "purple":
        return "border-purple-200 bg-purple-50 text-purple-700";
      case "blue":
        return "border-blue-200 bg-blue-50 text-blue-700";
      case "emerald":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "teal":
        return "border-teal-200 bg-teal-50 text-teal-700";
      case "amber":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "rose":
        return "border-rose-200 bg-rose-50 text-rose-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
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
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
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
                  <span>{data?.project?.customerName || "Customer"}</span>
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
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body (Scrollable, virtual viewport rules) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {isLoading && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Clock className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium">Assembling complete lifecycle timeline...</p>
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
                {/* Executive Summary Metrics Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Duration</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {data.stats?.durationDays || 1} <span className="text-xs font-normal text-slate-500">days</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {data.project?.receivedDate || "N/A"} → {data.project?.dispatchDate || "Active"}
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Machining Time</p>
                    <p className="text-lg font-bold text-blue-600 mt-0.5">
                      {data.stats?.totalMachiningHours || "00:00"} <span className="text-xs font-normal text-slate-500">hr</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Logged operator hours</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Subplates</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">
                      {data.stats?.totalPlates || 0} <span className="text-xs font-normal text-slate-500">plates</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Total components</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dispatch Coverage</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-lg font-bold text-emerald-600">
                        {data.stats?.dispatchCoverage?.percentage || 0}%
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">
                      {data.stats?.dispatchedPlatesCount || 0} Challan • {data.stats?.directClosedPlatesCount || 0} Direct
                    </p>
                  </div>
                </div>

                {/* Subplate Dispatch & Closure Breakdown Card */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Subplates Status Matrix ({data.subplates?.length || 0})
                    </span>
                    <span className="text-xs text-slate-500">
                      {data.stats?.dispatchedPlatesCount} Dispatched / {data.stats?.directClosedPlatesCount} Closed Direct
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {data.subplates?.map((sp: any) => (
                      <div key={sp.id} className="px-4 py-2 text-xs flex items-center justify-between gap-2 hover:bg-slate-50/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-slate-800 truncate">{sp.platename}</span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {sp.length}x{sp.width}x{sp.height}mm
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {sp.isDispatched ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Dispatched
                            </span>
                          ) : sp.isDirectClosed ? (
                            <span
                              title={sp.closureReason || "Closed directly without dispatch challan"}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                            >
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              Closed Direct: {sp.closureReason?.split("-")[0]?.trim() || "No Challan"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <Clock className="w-3 h-3 text-blue-600" />
                              In-House ({sp.location || "SM"})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Filter Chips & Search Bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Lifecycle Event Feed ({filteredEvents.length})
                    </span>
                    <div className="relative w-44 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filter events..."
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

                {/* Vertical GitHub Commit-Style Visual Timeline */}
                <div className="relative pl-6 sm:pl-7 space-y-6 before:absolute before:left-[11px] sm:before:left-[13px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                  {filteredEvents.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No events match the selected filter.
                    </div>
                  ) : (
                    filteredEvents.map((ev: TimelineEvent) => {
                      const isExpanded = !!expandedEvents[ev.id];
                      return (
                        <div key={ev.id} className="relative group">
                          {/* Connected Node Bullet */}
                          <div
                            className={`absolute -left-[23px] sm:-left-[27px] top-1 w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-2xs transition-transform group-hover:scale-110 ${getNodeBorderColor(
                              ev.badgeColor
                            )}`}
                          >
                            {renderNodeIcon(ev.eventType, ev.badgeColor)}
                          </div>

                          {/* Event Card */}
                          <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition-shadow">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900 tracking-tight">
                                    {ev.title}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getNodeBorderColor(
                                      ev.badgeColor
                                    )}`}
                                  >
                                    {ev.badgeLabel}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                  {ev.description}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap block">
                                  {getRelativeTime(ev.timestamp)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {new Date(ev.timestamp).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </span>
                              </div>
                            </div>

                            {/* Author & Action Link Bar */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
                              <div className="flex items-center gap-1.5">
                                {ev.authorInitials && (
                                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center">
                                    {ev.authorInitials}
                                  </span>
                                )}
                                <span>{ev.authorName || "System Staff"}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                {ev.documentLink && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenDocument?.(ev.documentLink!.type, ev.documentLink!.id)
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                  >
                                    <span>{ev.documentLink.label}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </button>
                                )}

                                {ev.meta && Object.keys(ev.meta).length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => toggleExpand(ev.id)}
                                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Expandable Metadata Payload */}
                            {isExpanded && ev.meta && (
                              <div className="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1 font-mono text-slate-600">
                                {Object.entries(ev.meta).map(([k, v]) => (
                                  <div key={k} className="flex items-start justify-between gap-2">
                                    <span className="text-slate-400 uppercase text-[10px]">{k}:</span>
                                    <span className="text-right truncate max-w-[260px]">
                                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500 font-mono">
              Audit Record: {data?.project?.projectid || projectId}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
