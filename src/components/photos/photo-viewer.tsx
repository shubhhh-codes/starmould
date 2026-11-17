"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { principalFetch } from "@/lib/query/principal-fetch";
import { formatPhotoUploadTime, type PhotoHistoryItem } from "@/lib/photos/history-types";

export function PhotoViewer({ photo, onClose, onPrevious, onNext }: {
  photo: PhotoHistoryItem; onClose: () => void; onPrevious?: () => void; onNext?: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [transform, setTransform] = useState({ zoom: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const transformRef = useRef(transform);
  useEffect(() => { transformRef.current = transform; }, [transform]);
  const pinch = useRef(0);
  const fitted = useRef({ width: 0, height: 0 });
  const update = (next: typeof transform) => {
    const box = viewport.current;
    if (!box) return;
    const zoom = Math.min(6, Math.max(1, next.zoom));
    const maxX = Math.max(0, (fitted.current.width * zoom - box.clientWidth) / 2);
    const maxY = Math.max(0, (fitted.current.height * zoom - box.clientHeight) / 2);
    setTransform({ zoom, x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) });
  };
  const updateRef = useRef(update);
  useEffect(() => { updateRef.current = update; });
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    setSource(""); setError(""); setTransform({ zoom: 1, x: 0, y: 0 });
    principalFetch(`/api/photos/view/${photo.id}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 410 ? "This photo has expired or been removed." : response.status === 403 ? "You no longer have permission to view this photo." : "Photo could not be loaded. Please retry.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
      }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.id, attempt]);
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const current = transformRef.current;
        updateRef.current({ ...current, zoom: current.zoom * Math.exp(-event.deltaY * 0.005) });
      } else if (transformRef.current.zoom > 1) {
        event.preventDefault();
        const current = transformRef.current;
        updateRef.current({ ...current, x: current.x - (event.shiftKey ? event.deltaY : event.deltaX), y: current.y - (event.shiftKey ? 0 : event.deltaY) });
      }
    };
    box.addEventListener("wheel", wheel, { passive: false });
    const resize = new ResizeObserver(() => {
      const image = box.querySelector("img");
      if (image) fitted.current = { width: image.clientWidth, height: image.clientHeight };
      setTransform({ zoom: 1, x: 0, y: 0 });
    });
    resize.observe(box);
    return () => { box.removeEventListener("wheel", wheel); resize.disconnect(); };
  }, []);
  return <Modal isOpen onClose={onClose} title="Photo preview" description={`${photo.uploader_name} · ${formatPhotoUploadTime(photo.server_uploaded_at)}`} maxWidth="6xl">
    <div onKeyDown={event => { if (event.key === "ArrowLeft") onPrevious?.(); if (event.key === "ArrowRight") onNext?.(); }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-3 py-2 text-xs font-semibold">Back to photos</button>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Zoom out" onClick={() => update({ ...transform, zoom: transform.zoom / 1.3 })} className="rounded-lg border p-2"><Minus size={18} /></button>
          <span className="w-12 text-center text-xs tabular-nums">{Math.round(transform.zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => update({ ...transform, zoom: transform.zoom * 1.3 })} className="rounded-lg border p-2"><Plus size={18} /></button>
          <button type="button" onClick={() => setTransform({ zoom: 1, x: 0, y: 0 })} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs"><RotateCcw size={14} /> Fit / reset</button>
          <button type="button" aria-label="Previous photo" disabled={!onPrevious} onClick={onPrevious} className="rounded-lg border p-2 disabled:opacity-30"><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next photo" disabled={!onNext} onClick={onNext} className="rounded-lg border p-2 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div ref={viewport} className="relative flex h-[60dvh] min-h-48 items-center justify-center overflow-hidden rounded-xl bg-slate-950" style={{ touchAction: "none" }}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); pinch.current = 0; }}
        onPointerMove={event => {
          const old = pointers.current.get(event.pointerId);
          if (!old) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const points = [...pointers.current.values()];
          if (points.length === 2) {
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            if (pinch.current) update({ ...transform, zoom: transform.zoom * distance / pinch.current });
            pinch.current = distance;
          } else update({ ...transform, x: transform.x + event.clientX - old.x, y: transform.y + event.clientY - old.y });
        }}
        onPointerUp={event => { pointers.current.delete(event.pointerId); pinch.current = 0; }}
        onPointerCancel={event => { pointers.current.delete(event.pointerId); pinch.current = 0; }}>
        {error ? <div role="alert" className="p-5 text-center text-sm text-white"><p>{error}</p><button type="button" onClick={() => setAttempt(a => a + 1)} className="mt-3 rounded-lg bg-white px-4 py-2 text-slate-800">Retry</button></div> : !source ? <p role="status" className="text-sm text-white">Loading photo...</p> :
          // The same authorized, already-compressed object is used without storing another image variant.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={source} alt={photo.original_filename} draggable={false} className="max-h-full max-w-full select-none object-contain" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` }} onLoad={event => { fitted.current = { width: event.currentTarget.clientWidth, height: event.currentTarget.clientHeight }; }} />}
      </div>
      <p className="mt-2 text-xs text-slate-500">Pinch or use Ctrl/Cmd + wheel to zoom. Drag to inspect. Preview uses the uploaded photo.</p>
    </div>
  </Modal>;
}
