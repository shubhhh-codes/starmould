"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";

type Job = { id: string; kind: string; status: string; source: string | null; scheduled_at: string;
  captured_at: string | null; completed_at: string | null; error_code: string | null; attempts?: number };
type Status = { configured: boolean; paused?: boolean; workerHealthy?: boolean; fallbackEnabled?: boolean; jobs: Job[] };
const time = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function DatabaseBackupPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/backup/jobs", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Backup status unavailable");
      if (mounted.current) setStatus(body);
    } catch (error) { if (mounted.current) setMessage(error instanceof Error ? error.message : "Backup status unavailable"); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh(); const interval = setInterval(refresh, 10000);
    return () => { mounted.current = false; clearInterval(interval); };
  }, [refresh]);
  async function togglePause() {
    setBusy(true);
    try {
      const response = await fetch("/api/backup/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused: !status?.paused }) });
      if (!response.ok) throw new Error("Could not update backup pause state");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Backup update failed"); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" aria-label="Saved database backups">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-bold text-slate-900">Saved database backups</h3>
        <p className="text-xs text-slate-600 mt-1">Daily: 10:00 AM, 12:30 PM, 4:00 PM and 7:00 PM IST. Retries stay within 30 minutes of each slot.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void refresh()} className="inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-xs">Refresh</button>
        {status?.configured && <button type="button" disabled={busy} onClick={togglePause} className="inline-flex min-h-11 items-center rounded-lg border px-3 py-2 text-xs disabled:opacity-50">{status.paused ? "Resume backups" : "Pause backups"}</button>}
        <a href="/export" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 text-white px-3 py-2 text-xs font-semibold">Generate & download SQL</a>
      </div>
    </div>
    {!status ? <p className="text-xs text-slate-600">Loading backup status…</p> : !status.configured ?
      <p className="text-xs text-amber-800">Automatic backup tracking is not configured. Generate a fresh SQL export on the Database Backups page.</p> :
      <p className="text-xs text-slate-600">{status.paused ? "Automatic backups are paused." : "Automatic backups run on the app server. Scheduler checks do not create extra backups."}</p>}
    {status?.configured && !status.paused && <p className={`text-xs ${status.workerHealthy ? "text-emerald-700" : "text-amber-800"}`}>{status.workerHealthy ? "Scheduler heartbeat received within the last 3 minutes." : "Scheduler heartbeat missing. Check the scheduler connection."}</p>}
    {message && <p role="status" className="text-xs text-slate-700">{message}</p>}
    <p className="text-xs text-slate-500">Backups are readable SQL files retained privately for 90 days. Photos are backed up separately.</p>
    {!!status?.jobs.length && <div className="overflow-x-auto"><table className="w-full text-left text-xs">
      <thead><tr className="border-b text-slate-500"><th className="py-2">Scheduled / requested (IST)</th><th>Status</th><th>Source</th><th>Captured (IST)</th><th>Attempts</th><th>Download</th></tr></thead>
      <tbody>{status.jobs.map(job => <tr key={job.id} className="border-b border-slate-100">
        <td className="py-3 pr-3">{time(job.scheduled_at)}<span className="block text-slate-500">{job.kind === "manual" ? "Manual snapshot" : "Scheduled backup"}</span></td>
        <td className="pr-3">{job.status === 'queued' ? 'Scheduled' : job.status === 'failed' ? (job.kind === 'scheduled' && (job.attempts || 0) < 3 ? 'Retrying' : 'Failed') : job.status}{job.error_code && <span className="block text-red-700">{job.error_code.replaceAll("_", " ").toLowerCase()}</span>}</td>
        <td className="pr-3">{job.source || "Waiting"}</td><td className="pr-3">{job.captured_at ? time(job.captured_at) : "—"}</td>
        <td className="pr-3">{job.attempts || 0}</td><td>{job.status === "completed" ? <div className="flex gap-3">{["sql"].map(format =>
          <a key={format} className="inline-flex min-h-11 items-center text-blue-700 underline" href={`/api/backup/jobs/download?id=${encodeURIComponent(job.id)}&format=${format}`} referrerPolicy="no-referrer">Download SQL</a>)}</div> : "—"}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
