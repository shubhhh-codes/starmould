"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/dialog";
import { principalFetch } from "@/lib/query/principal-fetch";
import { formatPhotoUploadTime, photoHistoryKey, type PhotoHistoryPage, type PhotoHistoryScope } from "@/lib/photos/history-types";
import { PhotoViewer } from "./photo-viewer";

export function PhotoHistoryDialog({ scope, onClose, onSummary }: { scope: PhotoHistoryScope; onClose: () => void; onSummary: (page: PhotoHistoryPage) => void }) {
  const [page, setPage] = useState<PhotoHistoryPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const summaryRef = useRef(onSummary);
  useEffect(() => { summaryRef.current = onSummary; }, [onSummary]);
  const load = async (options: { groupOffset?: number; groupId?: string; photoOffset?: number } = {}) => {
    const controller = new AbortController(); controllers.current.add(controller);
    setLoading(true); setError("");
    try {
      const res = await principalFetch("/api/photos/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, ...options }), signal: controller.signal });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Photos could not be loaded");
      if (controller.signal.aborted) return;
      const next = result as PhotoHistoryPage;
      summaryRef.current(next);
      setPage(previous => {
        if (!previous || (!options.groupId && !options.groupOffset)) return next;
        if (options.groupId) return { ...previous, summary: next.summary, groups: previous.groups.map(group => {
          const updated = next.groups.find(g => g.id === group.id);
          return updated ? { ...updated, photos: [...new Map([...group.photos, ...updated.photos].map(p => [p.id, p])).values()] } : group;
        }) };
        return { ...next, groups: [...previous.groups, ...next.groups] };
      });
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Photos could not be loaded"); }
    finally { controllers.current.delete(controller); if (!controller.signal.aborted) setLoading(false); }
  };
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });
  useEffect(() => {
    const active = controllers.current;
    void loadRef.current();
    return () => { for (const controller of active) controller.abort(); active.clear(); };
  }, []);
  const photos = [...new Map((page?.groups || []).flatMap(g => g.photos).map(photo => [photo.id, photo])).values()];
  const selectedIndex = photos.findIndex(p => p.id === selected);
  const unavailable = (page?.summary.expiredCount || 0) + (page?.summary.removedCount || 0);
  return <>
    <Modal isOpen onClose={onClose} title={page?.title || "Movement photos"} description={page ? `${page.summary.availableCount} available photos · View only` : "Loading saved photo history"} maxWidth="5xl">
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{error}</p><button type="button" className="mt-2 underline" disabled={loading} onClick={() => void load()}>Retry</button></div>}
      {!page && loading && <p role="status" className="py-10 text-center text-sm text-slate-500">Loading photos...</p>}
      {unavailable > 0 && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{page!.summary.expiredCount} photos expired under the retention policy; {page!.summary.removedCount} photos removed. Removed files are no longer available.</p>}
      {page && page.summary.availableCount === 0 && !unavailable && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">No photos are linked to this record. An older unlinked upload may need administrator review in Photo Storage.</p>}
      {page?.groups.map(group => <section key={group.id} className="mb-6 rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-slate-900">{group.title}</h4><p className="mt-1 text-xs text-slate-500">{group.party}{group.eventDate ? ` · Movement date: ${group.eventDate}` : ""}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{group.availableCount} photos</span></div>
        {!!(group.expiredCount + group.removedCount) && <p className="mb-3 text-xs text-amber-800">{group.expiredCount} expired · {group.removedCount} removed</p>}
        {!group.availableCount && <p className="py-2 text-xs text-slate-500">{group.expiredCount || group.removedCount ? "These photos are no longer available." : "No photos recorded for this entry."}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{group.photos.map(photo => <button key={photo.id} type="button" className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => setSelected(photo.id)} aria-label={`View photo uploaded by ${photo.uploader_name} on ${formatPhotoUploadTime(photo.server_uploaded_at)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/view/${photo.id}`} alt={photo.original_filename} loading="lazy" className="aspect-[4/3] w-full bg-slate-100 object-cover" onError={event => { event.currentTarget.alt = "Preview unavailable. Open photo to retry."; }} />
          <span className="block p-2"><span className="block truncate text-xs font-semibold text-slate-800">{photo.uploader_name}</span><span className="mt-1 block text-[11px] text-slate-500">{formatPhotoUploadTime(photo.server_uploaded_at)}</span></span>
        </button>)}</div>
        {group.nextPhotoOffset !== null && <button type="button" disabled={loading} onClick={() => void load({ groupId: group.id, photoOffset: group.nextPhotoOffset! })} className="mt-3 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">Load more photos</button>}
      </section>)}
      {page?.nextGroupOffset != null && <button type="button" disabled={loading} onClick={() => void load({ groupOffset: page.nextGroupOffset! })} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Load more entries</button>}
      {!!page?.summary.availableCount && <p className="mt-3 text-xs text-slate-500">Photos shared by multiple receipts can appear in each group. The total counts each image once.</p>}
      {page && loading && <p role="status" className="mt-3 text-xs text-slate-500">Loading...</p>}
    </Modal>
    {selectedIndex >= 0 && <PhotoViewer key={`${photoHistoryKey(scope)}:${selected}`} photo={photos[selectedIndex]} onClose={() => setSelected(null)} onPrevious={selectedIndex > 0 ? () => setSelected(photos[selectedIndex - 1].id) : undefined} onNext={selectedIndex < photos.length - 1 ? () => setSelected(photos[selectedIndex + 1].id) : undefined} />}
  </>;
}
