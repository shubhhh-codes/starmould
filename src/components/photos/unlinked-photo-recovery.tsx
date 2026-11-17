"use client";

import { useEffect, useRef, useState } from "react";
import { principalFetch } from "@/lib/query/principal-fetch";
import { formatPhotoUploadTime, type PhotoHistoryItem } from "@/lib/photos/history-types";
import { PhotoViewer } from "./photo-viewer";
import { Modal } from "@/components/ui/dialog";

interface UnlinkedPhoto extends PhotoHistoryItem { movement_type: string; party_name: string | null; storageAvailable: boolean | null; draftPending?: boolean }
interface Target { id: number; number: string; date: string; project: string }
export function UnlinkedPhotoRecovery() {
  const [photos, setPhotos] = useState<UnlinkedPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<UnlinkedPhoto | null>(null);
  const [selected, setSelected] = useState<UnlinkedPhoto | null>(null);
  const [search, setSearch] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const load = async (offset = 0, signal?: AbortSignal) => {
    setListLoading(true);
    try {
      const response = await principalFetch(`/api/photos/history/recovery?offset=${offset}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (signal?.aborted) return;
      setPhotos(previous => offset ? [...previous, ...data.photos] : data.photos); setTotal(data.total); setNext(data.nextOffset); setError("");
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Recovery list unavailable"); }
    finally { if (!signal?.aborted) setListLoading(false); }
  };
  const loadRef = useRef(load);
  useEffect(() => { const controller = new AbortController(); void loadRef.current(0, controller.signal); return () => controller.abort(); }, []);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setSearching(true); setTargets([]);
    const timer = setTimeout(() => {
      principalFetch(`/api/photos/history/recovery?photoId=${selected.id}&search=${encodeURIComponent(search)}`, { signal: controller.signal })
        .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (!controller.signal.aborted) setTargets(data.records); })
        .catch(e => { if (!controller.signal.aborted) setError(e.message); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [selected, search]);
  const recover = async () => {
    if (!selected || !chosen.length || reason.trim().length < 5) return;
    if (!window.confirm(`Link this photo to ${chosen.length} selected record(s)? Check the photo and record numbers before continuing.`)) return;
    setBusy(true); setError("");
    try {
      const response = await principalFetch("/api/photos/history/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId: selected.id, documentIds: chosen, reason }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSelected(null); await load(); window.dispatchEvent(new Event("starmould:photo-history-changed"));
    } catch (e) { setError(e instanceof Error ? e.message : "Linking failed"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">Unlinked photo recovery ({listLoading ? "..." : total})</h3><button type="button" disabled={listLoading} onClick={() => void load()} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Refresh</button></div>
    <p className="text-xs text-slate-500">Older uploads may be missing their saved receipt link. Preview the image, then explicitly select the correct record. Photos are never matched by date or supplier automatically.</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{photos.map(photo => <div key={photo.id} className="overflow-hidden rounded-xl border border-slate-200">
      <button type="button" disabled={photo.storageAvailable !== true} className="block w-full" onClick={() => setPreview(photo)} aria-label={`Preview unlinked photo ${photo.id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo.storageAvailable === true ? <img src={`/api/photos/view/${photo.id}`} loading="lazy" alt={photo.original_filename} className="aspect-[4/3] w-full bg-slate-100 object-cover" /> : <span className="flex aspect-[4/3] items-center justify-center bg-amber-50 p-3 text-xs text-amber-900">{photo.storageAvailable === false ? "Photo file missing from storage" : "Storage availability could not be verified"}</span>}
      </button>
      <div className="space-y-1 p-3 text-xs"><p className="font-semibold">{photo.movement_type.replaceAll("_", " ")}</p><p>{photo.party_name}</p><p>{photo.uploader_name}</p><p className="text-slate-500">{formatPhotoUploadTime(photo.server_uploaded_at)}</p>{photo.draftPending && <p className="text-amber-800">Pending movement draft; reassignment unavailable.</p>}<button type="button" disabled={photo.storageAvailable !== true || photo.draftPending} className="mt-2 rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-700 disabled:opacity-40" onClick={() => { setSelected(photo); setChosen([]); setReason(""); setSearch(""); setError(""); }}>Link to saved record</button></div>
    </div>)}</div>
    {listLoading && <p role="status" className="text-xs text-slate-500">Checking unlinked photos and storage availability...</p>}
    {!photos.length && !error && !listLoading && <p className="text-xs text-slate-500">No unlinked movement photos found.</p>}
    {next !== null && <button type="button" disabled={listLoading} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40" onClick={() => void load(next)}>Load more uploads</button>}
    {selected && <Modal isOpen onClose={() => { if (!busy) setSelected(null); }} title="Recover photo association" description="Administrative recovery only. The permanent photo watermark remains unchanged.">
      <div className="space-y-3"><label className="block text-xs font-semibold">Search receipt / challan number<input value={search} onChange={e => setSearch(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" placeholder="Type a record number" /></label>
        <div className="max-h-56 space-y-2 overflow-auto">{targets.map(target => <label key={target.id} className="flex items-center gap-2 rounded-lg border p-3 text-xs"><input type="checkbox" checked={chosen.includes(target.id)} onChange={e => setChosen(previous => e.target.checked ? [...previous, target.id] : previous.filter(id => id !== target.id))} />{target.number} · {target.date} · {target.project}</label>)}{searching ? <p className="text-xs">Searching records...</p> : !targets.length && <p className="text-xs">No matching records. Try a different number.</p>}</div>
        <p className="text-xs text-slate-500">{chosen.length} selected. A shared upload can be linked to multiple receipts.</p>
        <label className="block text-xs font-semibold">Reason<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded-lg border p-2 text-sm" placeholder="Explain how you verified this association" /></label>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        <button type="button" disabled={busy || !chosen.length || reason.trim().length < 5 || chosen.length > 20} onClick={() => void recover()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Linking..." : "Confirm verified association"}</button>
      </div>
    </Modal>}
    {preview && <PhotoViewer photo={preview} onClose={() => setPreview(null)} />}
  </section>;
}
