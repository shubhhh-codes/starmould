"use client";

import { useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";
import { photoHistoryKey, photoHistoryLabel, type PhotoHistoryScope } from "@/lib/photos/history-types";
import { usePhotoHistory } from "./photo-history-provider";

export function PhotoHistoryButton({ scope, className = "" }: { scope: PhotoHistoryScope; className?: string }) {
  const history = usePhotoHistory();
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const key = photoHistoryKey(scope);
  const { kind, id, stageKey } = scope;
  const register = history?.register;
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)), { rootMargin: "100px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (visible && register) return register({ kind, id, stageKey }); }, [kind, id, stageKey, visible, register]);
  if (!history || history.denied.has(key)) return null;
  const summary = history.summaries.get(key);
  const label = history.error ? "Images unavailable" : summary ? photoHistoryLabel(summary) : "Images (...)";
  return <button ref={ref} type="button" onClick={event => { event.stopPropagation(); history.open(scope); }}
    aria-label={`${label}. Open saved photos`} title="View photos for this record"
    className={`inline-flex h-8 min-h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-blue-700 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-600 ${className}`}>
    <Images className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="min-w-0 truncate">{label}</span>
  </button>;
}
