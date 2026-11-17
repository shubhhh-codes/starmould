"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuth } from "@/components/providers/auth-provider";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { Database, Download, RefreshCw, Trash2 } from "lucide-react";

type Archive = { key: string; filename?: string; size: number; modified: string | null };
export function ExportPage() {
  const { currentUser } = useAuth();
  const admin = currentUser?.role_id === 0;
  const [files, setFiles] = useState<Archive[]>([]);
  const [bucket, setBucket] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (next?: string) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/backup/archives${next ? `?cursor=${encodeURIComponent(next)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load saved backups");
      setFiles(previous => next ? [...new Map([...previous, ...data.files].map((file: Archive) => [file.key, file])).values()] : data.files);
      setBucket(data.bucket); setCursor(data.nextCursor || null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load backups"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { if (admin) void load(); }, [admin, load]);
  async function deleteBackup(file: Archive) {
    if (!window.confirm('Permanently delete this SQL backup? ' + (file.filename || file.key.split('/').at(-1)))) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/backup/archives', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: file.key }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete backup');
      setFiles(previous => previous.filter(item => item.key !== file.key));
      if (!data.metadataUpdated) setError('File deleted. Backup job history could not be updated for this environment.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete backup'); }
    finally { setBusy(false); }
  }
  return <AppLayout><div className="space-y-5 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><Database className="h-5 w-5 text-blue-600" />Database Backups</h1>
        <p className="mt-1 text-sm text-slate-500">Saved backup files from {bucket ? `R2 bucket: ${bucket}` : "your R2 bucket"}.</p></div>
      {admin && <button type="button" disabled={busy} onClick={() => void load()} className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh backups</button>}
    </div>
    {!admin ? <p role="alert" className="rounded-xl border bg-white p-5">Only administrators can access database backups.</p> : <>
      <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">Download readable SQL backups directly, without a password. Files are stored in your private backup bucket.</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm"><thead className="border-b bg-slate-50 text-slate-600"><tr><th className="p-4">SQL backup file</th><th className="p-4">Uploaded (IST)</th><th className="p-4">Size</th><th className="p-4">Actions</th></tr></thead>
          <tbody>{files.map(file => <tr key={file.key} className="border-b border-slate-100 last:border-0"><td className="p-4"><span className="font-semibold text-slate-900">{file.filename || file.key.split("/").at(-1)}</span><span className="mt-1 block max-w-xl break-all text-xs text-slate-500">{file.key}</span></td>
            <td className="whitespace-nowrap p-4 text-xs">{file.modified ? new Date(file.modified).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
            <td className="whitespace-nowrap p-4">{(file.size / 1024).toLocaleString("en-IN", { maximumFractionDigits: 1 })} KB</td>
            <td className="p-4"><a className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white" href={`/api/backup/archives?key=${encodeURIComponent(file.key)}`} referrerPolicy="no-referrer"><Download className="h-4 w-4" />Download</a><button type="button" disabled={busy} onClick={() => void deleteBackup(file)} aria-label={`Delete ${file.filename || file.key}`} className="ml-2 inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />Delete</button></td></tr>)}</tbody></table>
        {!files.length && <p className="p-8 text-center text-sm text-slate-500">{busy ? "Loading saved backups…" : error ? "Backups could not be loaded. Refresh to try again." : "No database backup files found in this bucket."}</p>}
      </div>
      {cursor && <button type="button" disabled={busy} onClick={() => void load(cursor)} className="rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50">{busy ? "Loading…" : "Load more backups"}</button>}
    </>}
  </div></AppLayout>;
}
