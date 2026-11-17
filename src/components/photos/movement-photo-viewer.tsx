"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Calendar,
  User,
  ShieldCheck,
  Building2,
  Layers,
} from "lucide-react";
import type { UploadedPhoto } from "./movement-photo-uploader";

export interface MovementPhotoViewerProps {
  photos: UploadedPhoto[];
  currentIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

const HUMAN_MOVEMENT_LABELS: Record<string, string> = {
  purchase_inward: "Material Gate Inward",
  jobwork_outward: "Job Work Outward Challan",
  jobwork_inward: "Job Work Inward Return",
  subplate_qc: "QC Inspection Verification",
  packing: "Packing & Dispatch Verification",
  dispatch: "Customer Goods Dispatch",
};

export function MovementPhotoViewer({
  photos,
  currentIndex = 0,
  isOpen,
  onClose,
  onIndexChange,
}: MovementPhotoViewerProps) {
  const [index, setIndex] = useState(currentIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    setIndex(currentIndex);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex, isOpen]);

  const activePhoto = photos[index];

  const handleNext = useCallback(() => {
    if (photos.length <= 1) return;
    const next = (index + 1) % photos.length;
    setIndex(next);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onIndexChange?.(next);
  }, [index, photos.length, onIndexChange]);

  const handlePrev = useCallback(() => {
    if (photos.length <= 1) return;
    const prev = (index - 1 + photos.length) % photos.length;
    setIndex(prev);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onIndexChange?.(prev);
  }, [index, photos.length, onIndexChange]);

  // Global keyboard shortcuts (Escape, Left, Right, +/-)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Bounded clamping rule (AGENTS.md):
  // Wheel only zooms when Ctrl/Cmd is held down. Normal wheel pans naturally.
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.2 : -0.2;
      setZoom((prev) => {
        const next = Math.max(0.5, Math.min(4, Number((prev + delta).toFixed(2))));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    } else {
      // Natural bounded vertical / horizontal pan
      setPan((p) => {
        const container = containerRef.current;
        const maxPanX = container ? (container.clientWidth * (zoom - 1)) / 2 + 100 : 200;
        const maxPanY = container ? (container.clientHeight * (zoom - 1)) / 2 + 100 : 200;

        const newX = e.shiftKey ? p.x - e.deltaY : p.x - e.deltaX;
        const newY = e.shiftKey ? p.y : p.y - e.deltaY;

        return {
          x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
        };
      });
    }
  };

  // Mouse drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const container = containerRef.current;
    const maxPanX = container ? (container.clientWidth * (zoom - 1)) / 2 + 150 : 300;
    const maxPanY = container ? (container.clientHeight * (zoom - 1)) / 2 + 150 : 300;

    const targetX = e.clientX - dragStartRef.current.x;
    const targetY = e.clientY - dragStartRef.current.y;

    setPan({
      x: Math.max(-maxPanX, Math.min(maxPanX, targetX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, targetY)),
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch Pinch-to-Zoom & Pan (Mobile UX)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    } else if (e.touches.length === 1) {
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDistanceRef.current;
      setZoom((z) => Math.max(0.75, Math.min(3.5, Number((z * ratio).toFixed(2)))));
      touchDistanceRef.current = dist;
    } else if (e.touches.length === 1 && isDragging) {
      const container = containerRef.current;
      const maxPanX = container ? (container.clientWidth * (zoom - 1)) / 2 + 100 : 200;
      const maxPanY = container ? (container.clientHeight * (zoom - 1)) / 2 + 100 : 200;

      const targetX = e.touches[0].clientX - dragStartRef.current.x;
      const targetY = e.touches[0].clientY - dragStartRef.current.y;

      setPan({
        x: Math.max(-maxPanX, Math.min(maxPanX, targetX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, targetY)),
      });
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
    setIsDragging(false);
  };

  if (!isOpen || !activePhoto) return null;

  const movementLabel =
    HUMAN_MOVEMENT_LABELS[activePhoto.movement_type] ||
    activePhoto.movement_type?.replace(/_/g, " ").toUpperCase() ||
    "Movement Evidence";

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white z-20 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-slate-100 truncate">
                {movementLabel}
              </h4>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {index + 1} of {photos.length}
              </span>
            </div>
            <p className="text-[10px] text-cyan-400 font-mono truncate">
              {activePhoto.watermark_text || activePhoto.original_filename}
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1 text-slate-300 min-w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 text-slate-300 hover:text-white rounded hover:bg-slate-700 cursor-pointer"
              title="Reset Zoom (0)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download button */}
          <a
            href={activePhoto.download_url || activePhoto.view_url}
            download={activePhoto.original_filename}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            title="Download Watermarked Photo"
          >
            <Download className="w-4 h-4" />
          </a>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            title="Close Viewer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-950"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Navigation Previous Button */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white backdrop-blur-sm border border-slate-700/80 transition shadow-lg cursor-pointer z-30"
            title="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Image with virtual pan and zoom */}
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transition: isDragging ? "none" : "transform 0.1s ease-out",
          }}
          className="max-w-[90vw] max-h-[75vh] flex items-center justify-center pointer-events-none select-none"
        >
          <img
            src={activePhoto.view_url}
            alt={activePhoto.original_filename}
            className="max-h-[75vh] max-w-[90vw] object-contain rounded shadow-2xl pointer-events-auto"
            draggable={false}
          />
        </div>

        {/* Navigation Next Button */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/80 hover:bg-blue-600 text-white backdrop-blur-sm border border-slate-700/80 transition shadow-lg cursor-pointer z-30"
            title="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Footer Info Bar */}
      <div
        className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs z-20 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-4">
          {activePhoto.party_name && (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{activePhoto.party_name}</span>
            </div>
          )}
          {activePhoto.movement_number && (
            <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Ref: {activePhoto.movement_number}</span>
            </div>
          )}
          {activePhoto.server_uploaded_at && (
            <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>{new Date(activePhoto.server_uploaded_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>
            </div>
          )}
        </div>

        <div className="text-[10px] text-slate-500 font-mono hidden sm:block">
          Use Mouse Wheel to Scroll • Ctrl + Wheel to Zoom • Drag to Pan
        </div>
      </div>
    </div>
  );
}

