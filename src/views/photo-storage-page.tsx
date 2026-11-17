"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { UnlinkedPhotoRecovery } from "@/components/photos/unlinked-photo-recovery";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Camera,
  HardDrive,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderArchive,
  Clock,
  Trash2,
  Calendar,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";

interface StorageStats {
  storage: {
    r2Configured: boolean;
    bucketName: string;
    totalBytes: number;
    totalBytesFormatted: string;
    targetLimitBytes: number;
    targetLimitFormatted: string;
    usagePercent: number;
    thresholdStatus: "normal" | "warning" | "urgent" | "critical";
    alertMessage: string | null;
    reconciledAt: string;
  };
  counts: {
    activePhotos: number;
    deletedPhotos: number;
    breakdownByType: Record<string, { count: number; bytes: number }>;
  };
  retention: {
    activeCyclesCount: number;
    upcomingDeletionsCount: number;
    upcomingDeletionsList: any[];
  };
}

interface RetentionCycle {
  id: number;
  project_id: number;
  project_code: string;
  registered_at: string;
  retention_deadline: string;
  is_active: boolean;
  daysRemaining: number | null;
  isExpired: boolean;
  reminder_7d_sent_at?: string | null;
  reminder_3d_sent_at?: string | null;
  reminder_1d_sent_at?: string | null;
}

export function PhotoStoragePage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0 || currentUser?.role?.toLowerCase() === "admin" || currentUser?.role === "Super Admin";

  const [stats, setStats] = useState<StorageStats | null>(null);
  const [cycles, setCycles] = useState<RetentionCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProjectCode, setExportProjectCode] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Manual cleanup modal state
  const [cleanupModalOpen, setCleanupModalOpen] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [folderMessage, setFolderMessage] = useState<string | null>(null);

  const organizeFolders = async () => {
    setIsOrganizing(true);
    setFolderMessage(null);
    try {
      const response = await fetch("/api/photos/retention", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "organize_storage" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not organize photos");
      setFolderMessage(`${data.result.moved} photos organized, ${data.result.cleaned} old copies removed. ${data.result.failed ? `${data.result.failed} need retry. ` : ""}Unlinked photos need a receipt selected below. Runs up to 20 photos per batch.`);
    } catch (error) { setFolderMessage(error instanceof Error ? error.message : "Could not organize photos"); }
    finally { setIsOrganizing(false); }
  };

  const fetchStatsAndCycles = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, cyclesRes] = await Promise.all([
        fetch("/api/photos/stats"),
        fetch("/api/photos/retention"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (cyclesRes.ok) {
        const cyclesData = await cyclesRes.json();
        setCycles(cyclesData.cycles || []);
      }
    } catch (err) {
      console.error("[PhotoStoragePage] Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsAndCycles();
  }, [fetchStatsAndCycles]);

  const handleDownloadBackup = async (projectCode: string) => {
    if (!projectCode.trim()) return;
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const res = await fetch("/api/photos/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectCode: projectCode.trim() }),
      });

      if (!res.ok && res.status !== 202) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Export request failed with status ${res.status}`);
      }

      const postData = await res.json();
      const jobId = postData.jobId;

      if (!jobId) {
        throw new Error("No export job ID received from server.");
      }

      // Poll export job status (Requirement F11)
      let isReady = false;
      let downloadUrl = `/api/photos/export/${jobId}/download`;
      let pollAttempts = 0;
      const maxPollAttempts = 40; // 60 seconds max

      while (!isReady && pollAttempts < maxPollAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        pollAttempts++;

        const statusRes = await fetch(`/api/photos/export/${jobId}`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.status === "failed") {
            throw new Error(statusData.errorMessage || "Export archive generation failed.");
          }
          if (statusData.isReady) {
            isReady = true;
            if (statusData.downloadUrl) downloadUrl = statusData.downloadUrl;
            break;
          }
        }
      }

      if (!isReady) {
        throw new Error("Export archive generation timed out. Please try again.");
      }

      // Download the completed archive
      const dlRes = await fetch(downloadUrl);
      if (!dlRes.ok) {
        throw new Error(`Failed to download completed archive (${dlRes.status})`);
      }

      const blob = await dlRes.blob();
      const contentDisposition = dlRes.headers.get("content-disposition");
      let filename = `${projectCode}_Photo_Backup.zip`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setExportSuccess(`Backup archive "${filename}" generated and downloaded successfully!`);
      setExportProjectCode("");
    } catch (err: any) {
      setExportError(err.message || "Failed to generate backup archive.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunCleanupSweep = async () => {
    setIsCleaning(true);
    try {
      const res = await fetch("/api/photos/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup" }),
      });

      if (res.ok) {
        await fetchStatsAndCycles();
        setCleanupModalOpen(false);
      }
    } catch (err) {
      console.error("[PhotoStoragePage] Cleanup sweep error:", err);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCancelRetention = async (projectCode: string) => {
    if (!confirm(`Reopen retention for project "${projectCode}"? This will cancel pending photo deletion.`)) return;
    try {
      const res = await fetch("/api/photos/retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", projectCode }),
      });
      if (res.ok) {
        await fetchStatsAndCycles();
      }
    } catch (err) {
      console.error("Cancel retention error:", err);
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Administrator Access Required</h2>
          <p className="text-sm text-slate-500 mt-1">
            The Photo Storage Dashboard and ZIP backup archives are restricted to administrators.
          </p>
        </div>
      </AppLayout>
    );
  }

  const storage = stats?.storage;
  const counts = stats?.counts;
  const breakdown = counts?.breakdownByType || {};

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <HardDrive className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Photo Storage & Backup Dashboard
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Cloudflare R2 private storage • 10 GB target threshold • 30-day automated retention • Structured ZIP archives
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={organizeFolders} disabled={isOrganizing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl disabled:opacity-50">
              <FolderArchive className="w-3.5 h-3.5" />{isOrganizing ? "Organizing..." : "Organize Photo Folders"}
            </button>
            <button
              type="button"
              onClick={fetchStatsAndCycles}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Usage
            </button>
            <button
              type="button"
              onClick={() => setCleanupModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Run Cleanup Sweep
            </button>
          </div>
        </div>

        {folderMessage && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">{folderMessage}</p>}
        {/* Threshold Warning Banner (8GB / 9GB / 10GB Alerts) */}
        {storage?.alertMessage && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-xs ${
              storage.thresholdStatus === "critical"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : storage.thresholdStatus === "urgent"
                ? "bg-orange-50 border-orange-200 text-orange-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold">
                {storage.thresholdStatus === "critical"
                  ? "Storage Threshold Alert (10 GB Target Reached)"
                  : storage.thresholdStatus === "urgent"
                  ? "Urgent Storage Warning (9 GB Reached)"
                  : "Storage Warning (8 GB Reached)"}
              </h4>
              <p className="text-xs mt-0.5 leading-relaxed">{storage.alertMessage}</p>
            </div>
          </div>
        )}

        {/* Storage Progress & Metric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main 10GB Quota Gauge */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Measured Cloudflare R2 Storage
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold font-mono text-slate-900">
                    {storage?.totalBytesFormatted || "0 B"}
                  </span>
                  <span className="text-xs text-slate-500">
                    of {storage?.targetLimitFormatted || "10.00 GB"} target allowance
                  </span>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  storage?.thresholdStatus === "critical"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : storage?.thresholdStatus === "urgent"
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : storage?.thresholdStatus === "warning"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {storage?.usagePercent || 0}% Used
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-500 ${
                  storage?.thresholdStatus === "critical"
                    ? "bg-rose-600"
                    : storage?.thresholdStatus === "urgent"
                    ? "bg-orange-500"
                    : storage?.thresholdStatus === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${Math.min(100, storage?.usagePercent || 0)}%` }}
              />
            </div>

            {/* Threshold Guide */}
            <div className="grid grid-cols-3 text-center text-[11px] pt-2 border-t border-slate-100 text-slate-500">
              <div>
                <span className="font-semibold text-slate-700">&lt; 8 GB</span>
                <p className="text-[10px] text-slate-400">Normal</p>
              </div>
              <div className="border-x border-slate-100">
                <span className="font-semibold text-amber-600">8 GB &bull; Warning</span>
                <p className="text-[10px] text-slate-400">Cleanup alert</p>
              </div>
              <div>
                <span className="font-semibold text-rose-600">10 GB &bull; Prominent</span>
                <p className="text-[10px] text-slate-400">Uploads continue</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>Target allowance is an alert threshold (uploads never blocked).</span>
              <span>Reconciled: {storage?.reconciledAt ? new Date(storage.reconciledAt).toLocaleTimeString() : "—"}</span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Photos Stored
              </span>
              <div className="text-3xl font-bold font-mono text-slate-900 mt-1">
                {counts?.activePhotos || 0}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {counts?.deletedPhotos || 0} archived & deleted via retention
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Cloudflare R2 Bucket:</span>
                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                  {storage?.bucketName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">R2 Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {storage?.r2Configured ? "Connected" : "Local Dev Fallback"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Active Retention Cycles:</span>
                <span className="font-bold text-blue-600">{stats?.retention.activeCyclesCount || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Movement Type */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800">Movement Photo Distribution</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: "purchase_inward", label: "Purchase Inward", color: "text-emerald-700 bg-emerald-50" },
              { key: "jobwork_outward", label: "Jobwork Outward", color: "text-blue-700 bg-blue-50" },
              { key: "jobwork_inward", label: "Jobwork Return", color: "text-teal-700 bg-teal-50" },
              { key: "subplate_qc", label: "QC Inspection", color: "text-purple-700 bg-purple-50" },
              { key: "packing", label: "Packing Verification", color: "text-indigo-700 bg-indigo-50" },
              { key: "dispatch", label: "Customer Dispatch", color: "text-rose-700 bg-rose-50" },
            ].map((m) => {
              const item = breakdown[m.key] || { count: 0, bytes: 0 };
              return (
                <div key={m.key} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-semibold text-slate-500 block truncate">
                    {m.label}
                  </span>
                  <div className="text-base font-bold font-mono text-slate-900 mt-1">
                    {item.count}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block">
                    {formatBytes(item.bytes)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Export Backup Section (Section 6: Hierarchical ZIP + Excel CSV Index) */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FolderArchive className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">Download Photo Backup Archive</h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Generates hierarchical folders & Excel-compatible UTF-8 CSV Index
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              placeholder="Enter Project Code (e.g. 0001_TESTC_001)"
              value={exportProjectCode}
              onChange={(e) => setExportProjectCode(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <MotionButton
              type="button"
              onClick={() => handleDownloadBackup(exportProjectCode)}
              loading={isExporting}
              disabled={!exportProjectCode.trim() || isExporting}
              variant="primary"
              size="sm"
              className="px-5 py-2 font-semibold text-xs rounded-xl shadow-2xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Generate & Download ZIP
            </MotionButton>
          </div>

          {exportError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* 30-Day Retention Cycles & Upcoming Deletions */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-800">
                Completed Project Retention Cycles (30-Day Auto Cleanup)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Photos deleted after 30 days unless project is reopened
            </span>
          </div>

          {cycles.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No completed projects currently in retention.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Project Code</th>
                    <th className="py-2.5 px-3">Registered Date</th>
                    <th className="py-2.5 px-3">Deletion Deadline</th>
                    <th className="py-2.5 px-3">Days Remaining</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycles.map((cycle) => (
                    <tr key={cycle.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold font-mono text-slate-800">
                        {cycle.project_code}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(cycle.registered_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">
                        {new Date(cycle.retention_deadline).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3">
                        {cycle.is_active ? (
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              cycle.isExpired
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : cycle.daysRemaining !== null && cycle.daysRemaining <= 3
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : cycle.daysRemaining !== null && cycle.daysRemaining <= 7
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {cycle.isExpired
                              ? "Expired (Eligible for deletion)"
                              : `${cycle.daysRemaining} Day${cycle.daysRemaining === 1 ? "" : "s"} Left`}
                          </span>
                        ) : (
                          <span className="text-slate-400">Reopened / Inactive</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadBackup(cycle.project_code)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                        >
                          Download Backup
                        </button>
                        {cycle.is_active && (
                          <button
                            type="button"
                            onClick={() => handleCancelRetention(cycle.project_code)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          >
                            Reopen Project
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <UnlinkedPhotoRecovery />

        {/* Confirmation Modal for Cleanup Sweep */}
        <Modal
          isOpen={cleanupModalOpen}
          onClose={() => setCleanupModalOpen(false)}
          title="Run Automated Photo Cleanup Sweep"
          description="Removes expired movement photos for projects that have crossed their 30-day retention window."
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              This action will check all completed projects whose 30-day retention deadline has passed.
              Photos shared across active projects are automatically protected and will not be deleted until all linked projects complete retention.
            </p>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCleanupModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <MotionButton
                type="button"
                onClick={handleRunCleanupSweep}
                loading={isCleaning}
                variant="primary"
                size="sm"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Confirm Cleanup Sweep
              </MotionButton>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

