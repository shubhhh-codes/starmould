"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Modal } from "@/components/ui/dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { principalFetch as fetch } from "@/lib/query/principal-fetch";
import { DatabaseBackupPanel } from "@/components/backup/database-backup-panel";
import { GenerateBackupButton } from "@/components/backup/generate-backup-button";
import { Database, Download, RefreshCw, Trash2, FileCode2, ShieldCheck } from "lucide-react";

type Archive = { key: string; filename?: string; size: number; modified: string | null };
export function ExportPage() {
  const { currentUser } = useAuth();
  const admin = currentUser?.role_id === 0;
  const [files, setFiles] = useState<Archive[]>([]);
  const [bucket, setBucket] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Archive | null>(null);
  const [generationMessage, setGenerationMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFilename, setDownloadFilename] = useState('starmould_backup.sql');

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
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/backup/archives', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: file.key }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete backup');
      setFiles(previous => previous.filter(item => item.key !== file.key));
      setPendingDelete(null);
      if (!data.metadataUpdated) setError('File deleted. Backup job history could not be updated for this environment.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not delete backup'); }
    finally { setBusy(false); }
  }
  function actions(file: Archive) {
    return <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">
      <a className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:flex-none" href={`/api/backup/archives?key=${encodeURIComponent(file.key)}`} referrerPolicy="no-referrer"><Download className="h-4 w-4 shrink-0" />Download</a>
      <button type="button" disabled={busy} onClick={() => { setError(''); setPendingDelete(file); }} aria-label={`Delete ${file.filename || file.key}`} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50 lg:flex-none"><Trash2 className="h-4 w-4 shrink-0" /><span className="lg:sr-only">Delete</span></button>
    </div>;
  }
  return <AppLayout><div className="w-full min-w-0 max-w-full space-y-4 p-3 sm:space-y-5 sm:p-6">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"><Database className="h-5 w-5" /></div>
        <div className="min-w-0"><h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Database Backups</h1><p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">Your saved SQL backups, ready to download.</p></div>
      </div>
      {admin && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <GenerateBackupButton disabled={busy} onMessage={setGenerationMessage} onError={setError} onDownload={(url,filename)=>{setDownloadUrl(url);setDownloadFilename(filename);}} onComplete={()=>void load()} />
        <button type="button" disabled={busy} onClick={() => void load()} className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh backups</button>
      </div>}
    </div>
    {!admin ? <p role="alert" className="rounded-xl border bg-white p-5">Only administrators can access database backups.</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-slate-200/70 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-700">{files.length} {files.length === 1 ? 'backup' : 'backups'}{cursor ? ' loaded' : ''}</span><span className="h-1 w-1 rounded-full bg-slate-300" /><span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600">SQL files</span>{bucket && <span className="max-w-full break-all text-slate-500">{bucket}</span>}</div>
        <span className="inline-flex items-center gap-1.5 text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Private storage</span>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Automatic backup schedule & history</summary><div className="mt-3"><DatabaseBackupPanel /></div></details>
      {generationMessage && <div role="status" className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">{generationMessage}{downloadUrl && <a href={downloadUrl} download={downloadFilename} className="font-semibold underline">Download SQL again</a>}</div>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="w-full table-fixed text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><tr><th className="w-[48%] px-5 py-3.5">SQL backup file</th><th className="w-[22%] px-4 py-3.5">Uploaded (IST)</th><th className="w-[10%] px-4 py-3.5">Size</th><th className="w-[24%] p-4">Actions</th></tr></thead>
          <tbody>{files.map(file => <tr key={file.key} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"><td className="px-5 py-4 align-middle"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500"><FileCode2 className="h-4 w-4" /></span><span className="break-all text-xs font-semibold leading-5 text-slate-800">{file.filename || file.key.split('/').at(-1)}</span></div></td>
            <td className="px-4 py-4 align-middle text-xs tabular-nums text-slate-500">{file.modified ? new Date(file.modified).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
            <td className="p-4 align-top text-xs">{(file.size / 1024).toLocaleString("en-IN", { maximumFractionDigits: 1 })} KB</td>
            <td className="py-3 pl-2 pr-4 align-middle">{actions(file)}</td></tr>)}</tbody></table>
      </div>
      <div className="min-w-0 space-y-3 lg:hidden" aria-label="Backup files">
        {files.map(file => <article key={file.key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold tracking-wide text-blue-700"><FileCode2 className="h-3.5 w-3.5" />SQL BACKUP</div><h2 className="break-words text-sm font-semibold leading-6 text-slate-900">{(file.filename || file.key.split('/').at(-1) || '').split('_').map((part, index, parts) => <span key={index}>{part}{index < parts.length - 1 && <>_<wbr /></>}</span>)}</h2>
          <dl className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 text-xs min-[400px]:grid-cols-[1fr_auto]">
            <div className="min-w-0"><dt className="text-slate-500">Uploaded (IST)</dt><dd className="mt-1 break-words font-medium text-slate-800">{file.modified ? new Date(file.modified).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}) : '—'}</dd></div>
            <div><dt className="text-slate-500">File size</dt><dd className="mt-1 font-medium text-slate-800">{(file.size / 1024).toLocaleString('en-IN', {maximumFractionDigits:1})} KB</dd></div>
          </dl>
          <div className="mt-4">{actions(file)}</div>
        </article>)}
      </div>
      {!files.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">{busy ? 'Loading saved backups…' : error ? 'Backups could not be loaded. Refresh to try again.' : 'No database backup files found in this bucket.'}</p>}
      {cursor && <button type="button" disabled={busy} onClick={() => void load(cursor)} className="min-h-11 w-full rounded-lg border bg-white px-4 py-2 text-sm disabled:opacity-50 sm:w-auto">{busy ? "Loading…" : "Load more backups"}</button>}
    </>}
  </div>
    <Modal isOpen={!!pendingDelete} onClose={() => { if (!busy) setPendingDelete(null); }} title="Delete backup?" size="sm" showCloseButton={!busy}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">This permanently removes the SQL backup from storage. This action cannot be undone.</p>
        <p className="break-all rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-medium leading-5 text-slate-800">{pendingDelete?.filename || pendingDelete?.key.split('/').at(-1)}</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3">
          <button type="button" data-autofocus disabled={busy} onClick={() => setPendingDelete(null)} className="min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={() => { if (pendingDelete) void deleteBackup(pendingDelete); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white disabled:opacity-50"><Trash2 className="h-4 w-4" />{busy ? 'Deleting…' : 'Delete backup'}</button>
        </div>
      </div>
    </Modal>
  </AppLayout>;
}
