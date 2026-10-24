"use client";

import React, { useEffect, useState, use, useRef, useCallback } from "react";
import {
  Printer,
  Download,
  ArrowLeft,
  Factory,
  Share2,
  Check,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PurchaseOrderVoucher } from "@/components/documents/purchase-order-voucher";

interface PageProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

export default function PrintDocumentPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { type, id } = resolvedParams;
  const router = useRouter();

  const [doc, setDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Responsive & Zoom States (Virtual Viewport 2D Transform Engine)
  const [isMounted, setIsMounted] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasInitializedZoom, setHasInitializedZoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isZoomDropdownOpen, setIsZoomDropdownOpen] = useState(false);

  const mainRef = useRef<HTMLElement>(null);
  const sheetWrapperRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState<number>(1140);

  // Synchronous tracking refs (allows 60/120 FPS GPU transforms without React re-render lag)
  const zoomRef = useRef<number>(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState(false);

  // Gesture refs
  const touchGestureRef = useRef<{
    type: "pinch" | "pan";
    initialDist?: number;
    initialZoom?: number;
    initialPan?: { x: number; y: number };
    midX?: number;
    midY?: number;
    lastTouchX?: number;
    lastTouchY?: number;
  } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const isDraggingMouseRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const updateSize = () => {
      if (typeof window !== "undefined") {
        setViewportWidth(window.innerWidth);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    fetch(`/api/print-doc?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found or unauthorized");
        return res.json();
      })
      .then((data) => {
        setDoc(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [type, id]);

  // Sheet Height Detection via ResizeObserver
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const measure = () => {
      const printableArea = el.querySelector("#po-printable-area") as HTMLElement;
      const h = printableArea?.offsetHeight || el.offsetHeight || el.scrollHeight || 1140;
      if (h > 200) {
        setSheetHeight(Math.max(1140, h));
      }
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(el);
    const printableArea = el.querySelector("#po-printable-area");
    if (printableArea) observer.observe(printableArea);

    return () => observer.disconnect();
  }, [doc]);

  // Fit calculation (centers and fits sheet to container width)
  const getFitZoomAndPan = useCallback(() => {
    const container = mainRef.current;
    const cW = container?.clientWidth || viewportWidth || 800;
    const isMobileView = cW < 840;
    const padX = isMobileView ? 16 : 48;
    const fitZ = Number(Math.min(1.1, Math.max(0.35, (cW - padX) / 794)).toFixed(2));
    const panX = Math.round((cW - 794 * fitZ) / 2);
    const panY = isMobileView ? 8 : 20;
    return { zoom: fitZ, pan: { x: panX, y: panY } };
  }, [viewportWidth]);

  const fitZoom = getFitZoomAndPan().zoom;

  // Boundary clamping (prevents sheet from flying off-screen while preserving cursor focal lock)
  const clampPan = useCallback(
    (newPan: { x: number; y: number }, currentZoom: number) => {
      const container = mainRef.current;
      if (!container) return newPan;
      const cW = container.clientWidth;
      const cH = container.clientHeight;
      const docW = 794 * currentZoom;
      const docH = sheetHeight * currentZoom;

      let x = newPan.x;
      let y = newPan.y;

      // Allow generous margins so focal point under cursor NEVER jumps or gets cut off
      const minX = Math.min(cW - docW - 200, 40);
      const maxX = Math.max(cW - 60, (cW - docW) / 2 + 200);
      x = Math.max(minX, Math.min(maxX, x));

      const minY = Math.min(cH - docH - 250, 40);
      const maxY = Math.max(cH - 60, 100);
      y = Math.max(minY, Math.min(maxY, y));

      return { x, y };
    },
    [sheetHeight]
  );

  // Directly apply hardware-accelerated 2D matrix transformation to DOM
  const applyTransformDirect = useCallback((animate = false) => {
    const el = sheetWrapperRef.current;
    if (!el) return;
    if (animate) {
      el.style.transition = "transform 200ms cubic-bezier(0.2, 0, 0, 1)";
    } else {
      el.style.transition = "none";
    }
    el.style.transform = `translate3d(${panRef.current.x}px, ${panRef.current.y}px, 0) scale(${zoomRef.current})`;
  }, []);

  // Initialize Zoom & Centering on Mount
  useEffect(() => {
    if (isMounted && !hasInitializedZoom) {
      const container = mainRef.current;
      const cW = container?.clientWidth || viewportWidth || 800;
      if (cW < 840) {
        const { zoom: fitZ, pan: fitP } = getFitZoomAndPan();
        setZoom(fitZ);
        zoomRef.current = fitZ;
        setPan(fitP);
        panRef.current = fitP;
        if (sheetWrapperRef.current) {
          sheetWrapperRef.current.style.transform = `translate3d(${fitP.x}px, ${fitP.y}px, 0) scale(${fitZ})`;
        }
      } else {
        const panX = Math.round((cW - 794) / 2);
        const initialPan = { x: panX, y: 20 };
        setZoom(1);
        zoomRef.current = 1;
        setPan(initialPan);
        panRef.current = initialPan;
        if (sheetWrapperRef.current) {
          sheetWrapperRef.current.style.transform = `translate3d(${initialPan.x}px, ${initialPan.y}px, 0) scale(1)`;
        }
      }
      setHasInitializedZoom(true);
    }
  }, [isMounted, viewportWidth, getFitZoomAndPan, hasInitializedZoom]);

  // True Focal Zoom Engine: anchors exact point under pointer or viewport center
  const zoomTo = useCallback(
    (targetZoom: number, focalPoint?: { clientX: number; clientY: number }, animate = true) => {
      const container = mainRef.current;
      const oldZoom = zoomRef.current;
      const clampedZoom = Math.min(3.0, Math.max(0.35, Number(targetZoom.toFixed(2))));
      if (Math.abs(clampedZoom - oldZoom) < 0.005) return;

      let newPan: { x: number; y: number };
      if (container && focalPoint) {
        const rect = container.getBoundingClientRect();
        const focalX = focalPoint.clientX - rect.left;
        const focalY = focalPoint.clientY - rect.top;
        const scaleRatio = clampedZoom / oldZoom;
        newPan = {
          x: focalX - (focalX - panRef.current.x) * scaleRatio,
          y: focalY - (focalY - panRef.current.y) * scaleRatio,
        };
      } else if (container) {
        const focalX = container.clientWidth / 2;
        const focalY = container.clientHeight / 2;
        const scaleRatio = clampedZoom / oldZoom;
        newPan = {
          x: focalX - (focalX - panRef.current.x) * scaleRatio,
          y: focalY - (focalY - panRef.current.y) * scaleRatio,
        };
      } else {
        newPan = panRef.current;
      }

      const boundedPan = clampPan(newPan, clampedZoom);
      zoomRef.current = clampedZoom;
      panRef.current = boundedPan;
      applyTransformDirect(animate);
      setZoom(clampedZoom);
      setPan(boundedPan);
    },
    [clampPan, applyTransformDirect]
  );

  const handleZoomIn = () => {
    zoomTo(zoomRef.current + 0.2, undefined, true);
  };

  const handleZoomOut = () => {
    zoomTo(zoomRef.current - 0.2, undefined, true);
  };

  const handleFit = () => {
    const { zoom: fitZ, pan: fitP } = getFitZoomAndPan();
    zoomRef.current = fitZ;
    panRef.current = fitP;
    applyTransformDirect(true);
    setZoom(fitZ);
    setPan(fitP);
  };

  const handleResetZoom = () => {
    const container = mainRef.current;
    const cW = container?.clientWidth || viewportWidth || 800;
    const panX = Math.round((cW - 794) / 2);
    const targetPan = clampPan({ x: panX, y: 20 }, 1);
    zoomRef.current = 1;
    panRef.current = targetPan;
    applyTransformDirect(true);
    setZoom(1);
    setPan(targetPan);
  };

  const handleToggleFitOr100 = () => {
    const { zoom: fitZ } = getFitZoomAndPan();
    if (Math.abs(zoomRef.current - fitZ) < 0.06) {
      handleResetZoom();
    } else {
      handleFit();
    }
  };

  // Desktop Double-Click to Focal Zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;

    const { zoom: fitZ } = getFitZoomAndPan();
    if (zoomRef.current < 1.3) {
      zoomTo(1.75, { clientX: e.clientX, clientY: e.clientY }, true);
    } else {
      handleFit();
    }
  };

  // Desktop Keyboard Shortcuts (Ctrl++/Ctrl+-, +/-, Ctrl+0, F, Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        handleResetZoom();
      } else if (e.key === "f" || e.key === "F" || ((e.ctrlKey || e.metaKey) && e.key === "9")) {
        e.preventDefault();
        handleFit();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        panRef.current.y += 60;
        panRef.current = clampPan(panRef.current, zoomRef.current);
        applyTransformDirect(true);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        panRef.current.y -= 60;
        panRef.current = clampPan(panRef.current, zoomRef.current);
        applyTransformDirect(true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        panRef.current.x += 60;
        panRef.current = clampPan(panRef.current, zoomRef.current);
        applyTransformDirect(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        panRef.current.x -= 60;
        panRef.current = clampPan(panRef.current, zoomRef.current);
        applyTransformDirect(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom, handleFit, clampPan, applyTransformDirect]);

  // Direct Mouse Wheel Focal Zoom (wheel forward = zoom in, wheel back = zoom out; locked to cursor)
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    let wheelRaf: number | null = null;
    let wheelCommitTimer: NodeJS.Timeout | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.shiftKey) {
        // Shift + Wheel = horizontal pan
        const newPan = clampPan(
          {
            x: panRef.current.x - e.deltaY,
            y: panRef.current.y,
          },
          zoomRef.current
        );
        panRef.current = newPan;
        if (wheelRaf) cancelAnimationFrame(wheelRaf);
        wheelRaf = requestAnimationFrame(() => applyTransformDirect(false));
        if (wheelCommitTimer) clearTimeout(wheelCommitTimer);
        wheelCommitTimer = setTimeout(() => setPan({ ...panRef.current }), 100);
        return;
      }

      // DIRECT MOUSE WHEEL FOCAL ZOOM centered exactly at mouse cursor (e.clientX, e.clientY)
      const rect = container.getBoundingClientRect();
      const focalX = e.clientX - rect.left;
      const focalY = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      // Exponential zoom factor: smooth on trackpads, responsive on discrete wheel clicks
      const zoomFactor = Math.exp(-e.deltaY * 0.002);
      const newZoom = Math.min(3.5, Math.max(0.35, Number((oldZoom * zoomFactor).toFixed(3))));
      if (Math.abs(newZoom - oldZoom) < 0.001) return;

      // Exact focal affine transformation: anchor point under cursor stays 100% locked
      const scaleRatio = newZoom / oldZoom;
      const newPanX = focalX - (focalX - panRef.current.x) * scaleRatio;
      const newPanY = focalY - (focalY - panRef.current.y) * scaleRatio;

      const boundedPan = clampPan({ x: newPanX, y: newPanY }, newZoom);

      zoomRef.current = newZoom;
      panRef.current = boundedPan;

      if (wheelRaf) cancelAnimationFrame(wheelRaf);
      wheelRaf = requestAnimationFrame(() => {
        applyTransformDirect(false);
      });

      // Debounce React state update so UI controls stay in sync without rendering lag
      if (wheelCommitTimer) clearTimeout(wheelCommitTimer);
      wheelCommitTimer = setTimeout(() => {
        setZoom(Number(newZoom.toFixed(2)));
        setPan(boundedPan);
      }, 70);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
      if (wheelRaf) cancelAnimationFrame(wheelRaf);
      if (wheelCommitTimer) clearTimeout(wheelCommitTimer);
    };
  }, [clampPan, applyTransformDirect]);

  // Touch Pinch-to-zoom & 1-finger pan handlers with exact midpoint anchor
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = mainRef.current;
    if (!container) return;

    if (e.touches.length === 2) {
      const rect = container.getBoundingClientRect();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (dist < 8) return;

      const midClientX = (t1.clientX + t2.clientX) / 2;
      const midClientY = (t1.clientY + t2.clientY) / 2;

      touchGestureRef.current = {
        type: "pinch",
        initialDist: dist,
        initialZoom: zoomRef.current,
        initialPan: { ...panRef.current },
        midX: midClientX - rect.left,
        midY: midClientY - rect.top,
      };
      setIsInteracting(true);
      if (sheetWrapperRef.current) {
        sheetWrapperRef.current.style.transition = "none";
      }
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const t = e.touches[0];
      if (
        lastTapRef.current &&
        now - lastTapRef.current.time < 300 &&
        Math.hypot(t.clientX - lastTapRef.current.x, t.clientY - lastTapRef.current.y) < 30
      ) {
        // Double tap: toggle between 1.8x focal zoom and fit
        lastTapRef.current = null;
        if (zoomRef.current < 1.3) {
          zoomTo(1.8, { clientX: t.clientX, clientY: t.clientY }, true);
        } else {
          handleFit();
        }
        return;
      }

      lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };
      touchGestureRef.current = {
        type: "pan",
        lastTouchX: t.clientX,
        lastTouchY: t.clientY,
      };
      setIsInteracting(true);
      if (sheetWrapperRef.current) {
        sheetWrapperRef.current.style.transition = "none";
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const container = mainRef.current;
    const gesture = touchGestureRef.current;
    if (!container || !gesture) return;

    if (gesture.type === "pinch" && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const currMidClientX = (t1.clientX + t2.clientX) / 2;
      const currMidClientY = (t1.clientY + t2.clientY) / 2;
      const rect = container.getBoundingClientRect();
      const currMidX = currMidClientX - rect.left;
      const currMidY = currMidClientY - rect.top;

      if (
        !gesture.initialDist ||
        !gesture.initialZoom ||
        !gesture.initialPan ||
        gesture.midX === undefined ||
        gesture.midY === undefined
      ) {
        return;
      }

      const scale = dist / gesture.initialDist;
      const newZoom = Math.min(3.0, Math.max(0.35, gesture.initialZoom * scale));
      const scaleRatio = newZoom / gesture.initialZoom;

      // Exact focal anchoring: document point under pinch midpoint remains stationary
      const newPanX = currMidX - (gesture.midX - gesture.initialPan.x) * scaleRatio;
      const newPanY = currMidY - (gesture.midY - gesture.initialPan.y) * scaleRatio;

      zoomRef.current = newZoom;
      panRef.current = clampPan({ x: newPanX, y: newPanY }, newZoom);

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        applyTransformDirect(false);
      });
    } else if (gesture.type === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      if (gesture.lastTouchX === undefined || gesture.lastTouchY === undefined) return;
      const dx = t.clientX - gesture.lastTouchX;
      const dy = t.clientY - gesture.lastTouchY;
      gesture.lastTouchX = t.clientX;
      gesture.lastTouchY = t.clientY;

      const newPan = clampPan({ x: panRef.current.x + dx, y: panRef.current.y + dy }, zoomRef.current);
      panRef.current = newPan;

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        applyTransformDirect(false);
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Transition from pinch to single-finger pan seamlessly
      touchGestureRef.current = {
        type: "pan",
        lastTouchX: e.touches[0].clientX,
        lastTouchY: e.touches[0].clientY,
      };
    } else {
      touchGestureRef.current = null;
      setIsInteracting(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setZoom(Number(zoomRef.current.toFixed(2)));
      setPan({ ...panRef.current });
    }
  };

  // Desktop Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;

    isDraggingMouseRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setIsInteracting(true);
    if (sheetWrapperRef.current) {
      sheetWrapperRef.current.style.transition = "none";
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMouseRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const newPan = clampPan({ x: panRef.current.x + dx, y: panRef.current.y + dy }, zoomRef.current);
    panRef.current = newPan;

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      applyTransformDirect(false);
    });
  };

  const handleMouseUp = () => {
    if (isDraggingMouseRef.current) {
      isDraggingMouseRef.current = false;
      setIsInteracting(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setPan({ ...panRef.current });
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    if (doc?.docNumber) {
      document.title = doc.docNumber;
    }
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const fileName = `${doc?.docNumber || "Purchase_Order"}.pdf`;

      // Fetch pristine vector PDF from server Puppeteer engine
      const downloadUrl = `/api/download-po-pdf?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
      const res = await fetch(downloadUrl);

      if (!res.ok) {
        throw new Error("Server PDF generation failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Direct PDF download error:", err);
      // Fallback to browser print if server generation encounters an issue
      handlePrint();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleShare = async () => {
    const title = `PO ${doc?.docNumber || ""} - Star Mould`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Star Mould Purchase Order ${doc?.docNumber || ""} for ${
            doc?.party?.vendor_name || doc?.customerName || ""
          }`,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share dismissed
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard error fallback
      }
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.push("/purchase");
    }
  };

  // ─── 1. ELEGANT SKELETON PREVIEW WHILE OPENING ──────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100/80 py-4 sm:py-6 px-3 sm:px-4 text-slate-900 animate-in fade-in duration-200">
        {/* Skeleton Top Bar */}
        <div className="w-full max-w-[794px] mx-auto mb-4 flex items-center justify-between animate-pulse">
          <div className="h-9 w-24 bg-white/80 rounded-xl border border-slate-200" />
          <div className="h-9 w-44 bg-white/80 rounded-xl border border-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-white/80 rounded-xl border border-slate-200" />
            <div className="h-9 w-24 bg-white/80 rounded-xl border border-slate-200" />
          </div>
        </div>

        {/* Skeleton Document Sheet */}
        <div className="w-full max-w-[794px] mx-auto bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden animate-pulse">
          {/* Top Stripes */}
          <div className="w-full h-2.5 bg-[#006181]/40" />
          <div className="w-full h-1 bg-slate-300" />

          <div className="p-6 sm:p-10 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="h-12 w-48 bg-slate-200 rounded-lg" />
              <div className="space-y-2 text-right">
                <div className="h-7 w-48 bg-slate-200 rounded ml-auto" />
                <div className="h-1.5 w-48 bg-slate-200 rounded ml-auto" />
              </div>
            </div>

            {/* PO Info Bar */}
            <div className="h-14 w-full bg-slate-100 rounded-xl border border-slate-200/60" />

            {/* Two Column Vendor / Buyer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-28 bg-slate-50 rounded-xl border border-slate-200/60 p-3 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-3 w-40 bg-slate-200 rounded" />
              </div>
              <div className="h-28 bg-slate-50 rounded-xl border border-slate-200/60 p-3 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-4 w-48 bg-slate-200 rounded" />
                <div className="h-3 w-40 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2">
              <div className="h-9 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-50 rounded" />
              <div className="h-10 bg-slate-50 rounded" />
              <div className="h-10 bg-slate-50 rounded" />
            </div>

            {/* Loader indicator */}
            <div className="pt-6 flex items-center justify-center gap-2.5 text-slate-500">
              <div className="w-4 h-4 border-2 border-[#006181] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-slate-600">
                Opening Star Mould Document...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── 2. ERROR STATE ────────────────────────────────────────────────────────
  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center space-y-4 max-w-md w-full">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Document Unavailable</h2>
            <p className="text-xs text-slate-500 mt-1">{error || "Failed to load document"}</p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleBack}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Go Back
            </button>
            <Link
              href="/purchase"
              className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
            >
              Return to Purchase
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── 3. PURCHASE ORDER VOUCHER VIEW (Exact Star Mould PDF Geometry) ────────
  if (type === "purchase") {
    return (
      <div className="min-h-screen bg-slate-100/80 py-3 sm:py-6 px-2 sm:px-4 print:p-0 print:bg-white text-slate-900 animate-in fade-in duration-200">
        {/* Print rules override for pristine physical page printing */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                .print\\:hidden { display: none !important; }
                .print\\:shadow-none { box-shadow: none !important; }
                .print\\:border-none { border: none !important; }
                .print\\:transform-none { transform: none !important; position: static !important; width: 794px !important; }
                .print\\:w-auto { width: auto !important; height: auto !important; }
              }
            `,
          }}
        />

        {/* ── STICKY TOP CONTROL & ACTION BAR ──────────────────────────────── */}
        <header className="sticky top-0 z-30 w-full max-w-5xl mx-auto mb-3 sm:mb-4 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xs px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 print:hidden transition-all">
          {/* Left: Back Button & Document Label */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0"
              title="Return to previous screen"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className="w-4 h-4 text-[#006181] shrink-0 hidden sm:inline" />
              <div className="truncate">
                <span className="font-mono font-bold text-xs text-slate-900 truncate block">
                  {doc.docNumber || "Purchase Order"}
                </span>
                {doc.party?.vendor_name && (
                  <span className="text-[10px] text-slate-500 font-medium truncate block hidden sm:block">
                    {doc.party.vendor_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center / Right: Controls & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Zoom Controller */}
            <div className="hidden sm:flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs text-slate-700 shadow-2xs relative">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 hover:text-slate-900 rounded-lg hover:bg-white transition cursor-pointer active:scale-95"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              {/* Slider for smooth native desktop zooming */}
              <div className="flex items-center px-1.5" title="Drag to Zoom">
                <input
                  type="range"
                  min="0.35"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    zoomTo(val, undefined, false);
                  }}
                  className="w-16 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-[#006181]"
                />
              </div>

              {/* Preset Dropdown Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsZoomDropdownOpen(!isZoomDropdownOpen)}
                  className="px-2 font-mono text-[11px] font-bold hover:text-blue-700 hover:bg-white rounded-md py-0.5 transition cursor-pointer flex items-center gap-1"
                  title="Zoom Presets"
                >
                  <span>{Math.round(zoom * 100)}%</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isZoomDropdownOpen && (
                  <div
                    className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 w-36 text-xs text-slate-800 animate-in fade-in zoom-in-95 duration-100"
                    onMouseLeave={() => setIsZoomDropdownOpen(false)}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        handleFit();
                        setIsZoomDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between font-semibold text-slate-700"
                    >
                      <span>Fit to Width</span>
                      <span className="text-[10px] text-slate-400">F</span>
                    </button>
                    <div className="h-px bg-slate-100 my-1" />
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          zoomTo(preset, undefined, true);
                          setIsZoomDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between ${
                          Math.abs(zoom - preset) < 0.05 ? "font-bold text-[#006181] bg-slate-50" : ""
                        }`}
                      >
                        <span>{Math.round(preset * 100)}%</span>
                        {preset === 1.0 && <span className="text-[10px] text-slate-400">100%</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 hover:text-slate-900 rounded-lg hover:bg-white transition cursor-pointer active:scale-95"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleFit}
                className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-white transition cursor-pointer border-l border-slate-200 ml-0.5"
                title="Fit Document to Screen Width (F)"
              >
                Fit
              </button>
            </div>

            {/* Share / Copy Link Button */}
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition active:scale-95 cursor-pointer"
              title="Share or copy document link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline text-emerald-700 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* Desktop Download PDF & Print Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                title="Download vector PDF directly"
              >
                {isDownloading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:py-2 rounded-xl bg-[#006181] hover:bg-[#0d4f68] text-white text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                title="Open browser print dialogue (A4)"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print PO</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── DOCUMENT SHEET CONTAINER (Virtual Viewport 2D Transform Engine) ── */}
        <main
          ref={mainRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          className="w-full relative overflow-hidden select-none touch-none h-[calc(100dvh-135px)] sm:h-[calc(100dvh-95px)] rounded-2xl bg-slate-200/50 border border-slate-200/70 shadow-inner cursor-grab active:cursor-grabbing print:h-auto print:overflow-visible print:border-none print:shadow-none print:bg-white print:cursor-auto"
          style={{ overscrollBehavior: "none" }}
        >
          {/* Scaled Proportional Wrapper with Dynamic 2D Matrix GPU Transform */}
          <div
            ref={sheetWrapperRef}
            style={{
              transformOrigin: "0 0",
              width: "794px",
              minWidth: "794px",
              position: "absolute",
              top: 0,
              left: 0,
              willChange: isInteracting ? "transform" : "auto",
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            }}
            className="print:shadow-none print:border-none print:transform-none print:w-[794px] print:static"
          >
            <div
              ref={sheetRef}
              className="bg-white shadow-xl border border-slate-200/90 rounded-none sm:rounded-xl overflow-hidden print:shadow-none print:border-none print:transform-none print:w-[794px] print:static print:rounded-none"
            >
              <PurchaseOrderVoucher
                po={{
                  id: Number(doc.id || 0),
                  srno: doc.docNumber,
                  odate: doc.docDate,
                  vname: doc.party?.id,
                  cname: 0,
                  projectid: doc.projectCode,
                  items: doc.items,
                }}
                vendor={doc.party}
                customerName={doc.customerName}
                onPrint={handlePrint}
                isModal={false}
              />
            </div>
          </div>
        </main>

        {/* ── FLOATING MOBILE BOTTOM BAR (Zoom In/Out + Fit + PDF + Print) ────── */}
        <nav className="fixed bottom-3 left-3 right-3 z-30 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-2 sm:hidden flex items-center justify-between gap-1.5 print:hidden">
          {/* Mobile Zoom In/Out & Current Percentage */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs text-slate-700 shrink-0">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 hover:text-slate-900 rounded-lg active:bg-white transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={handleToggleFitOr100}
              className="px-2 font-mono text-xs font-bold text-slate-800"
              title="Click to toggle Fit / 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 hover:text-slate-900 rounded-lg active:bg-white transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          {/* Quick Fit / 100% Button */}
          <button
            type="button"
            onClick={handleToggleFitOr100}
            className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer"
          >
            {Math.abs(zoom - fitZoom) < 0.05 ? (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>100%</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Fit</span>
              </>
            )}
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex-1 py-2 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition cursor-pointer disabled:opacity-50 shadow-xs"
          >
            {isDownloading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>PDF</span>
          </button>

          {/* Print PO */}
          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 rounded-xl bg-[#006181] hover:bg-[#0d4f68] text-white text-xs font-bold flex items-center justify-center active:scale-95 transition cursor-pointer shadow-xs"
            title="Print Document"
          >
            <Printer className="w-4 h-4" />
          </button>
        </nav>

        {/* ── FLOATING DESKTOP QUICK CONTROL BAR (Adobe / Chrome PDF style) ────── */}
        <aside className="fixed bottom-5 right-6 z-40 hidden sm:flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 text-xs text-slate-700 print:hidden animate-in fade-in duration-300">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer active:scale-95"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4 text-slate-600" />
          </button>

          <input
            type="range"
            min="0.35"
            max="2.5"
            step="0.05"
            value={zoom}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              zoomTo(val, undefined, false);
            }}
            className="w-20 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#006181]"
            title={`Zoom: ${Math.round(zoom * 100)}%`}
          />

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer active:scale-95"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4 text-slate-600" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={handleToggleFitOr100}
            className="px-2.5 py-1 font-mono text-xs font-bold text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Toggle Fit / 100%"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleFit}
            className="px-2.5 py-1 font-semibold text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="Fit to Width (F)"
          >
            Fit
          </button>
        </aside>
      </div>
    );
  }

  // ─── 4. GENERAL PRINTABLE DOCUMENT VIEW (Challan, Dispatch, Inward) ─────────
  return (
    <div className="min-h-screen bg-slate-100/80 py-4 sm:py-6 px-3 sm:px-4 print:p-0 print:bg-white text-slate-900 animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between gap-2 print:hidden bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-xs">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Print Document</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-6 sm:p-12 rounded-2xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 text-white rounded-xl print:border print:border-slate-900">
              <Factory className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">STAR MOULD</h1>
              <p className="text-xs text-slate-600 font-medium">
                Precision Tooling & Mould Engineering Works
              </p>
              <p className="text-[11px] text-slate-500">
                Plot No. 42, GIDC Industrial Estate, Gujarat, India
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold tracking-wider uppercase rounded-md mb-1.5">
              {doc.docType}
            </span>
            <p className="text-base font-black text-slate-900">{doc.docNumber}</p>
            <p className="text-xs font-semibold text-slate-600">Date: {doc.docDate}</p>
          </div>
        </div>

        {/* Party Details & Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs print:bg-transparent print:border-slate-300">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Billed / Dispatched To
            </p>
            <p className="font-bold text-slate-900 text-sm">
              {doc.party?.customername || doc.party?.vendor_name || "—"}
            </p>
            {doc.party?.vendor_code && (
              <p className="text-[11px] font-mono font-semibold text-slate-600">
                Vendor Code: {doc.party.vendor_code}
              </p>
            )}
            <p className="text-slate-600">
              {doc.party?.address ||
                (doc.party?.city ? `${doc.party.city}, India` : "Registered Factory Address")}
            </p>
            {doc.party?.mobile && <p className="text-slate-600">Phone: {doc.party.mobile}</p>}
            {(doc.party?.gstin || doc.party?.gst) && (
              <p className="text-slate-700 font-mono font-semibold">
                GSTIN: {doc.party.gstin || doc.party.gst}
              </p>
            )}
            {doc.party?.pan && <p className="text-slate-600 font-mono">PAN: {doc.party.pan}</p>}
            {doc.party?.bank_name && (
              <div className="mt-1 pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-700">Bank: {doc.party.bank_name}</p>
                {doc.party.account_no && (
                  <p className="font-mono">A/C: {doc.party.account_no}</p>
                )}
                {doc.party.ifsc_code && (
                  <p className="font-mono">IFSC: {doc.party.ifsc_code}</p>
                )}
              </div>
            )}
          </div>
          <div className="sm:text-right space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Project & Reference
            </p>
            <p className="font-bold text-slate-900 font-mono">
              Project Code: {doc.projectCode || "N/A"}
            </p>
            {doc.transporter && <p className="text-slate-600">Transporter: {doc.transporter}</p>}
            {doc.vehicleNo && <p className="text-slate-600 font-mono">Vehicle No: {doc.vehicleNo}</p>}
            {doc.invoiceNo && <p className="text-slate-600 font-mono">Invoice No: {doc.invoiceNo}</p>}
            {doc.deliveryType && <p className="text-slate-600">Delivery: {doc.deliveryType}</p>}
            {doc.freightMode && (
              <p className="text-slate-600 font-semibold">Freight: {doc.freightMode}</p>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold uppercase">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">Particulars / Specifications</th>
                {type === "challan" && <th className="py-2.5 px-3">Material</th>}
                {type === "challan" && <th className="py-2.5 px-3">Dimensions</th>}
                {type === "dispatch" && <th className="py-2.5 px-3">Condition</th>}
                {type === "dispatch" && <th className="py-2.5 px-3">Work Nature</th>}
                {type === "inward" && <th className="py-2.5 px-3 text-right">Ordered Qty</th>}
                {type === "inward" && <th className="py-2.5 px-3 text-right">Inward Qty</th>}
                {type !== "inward" && <th className="py-2.5 px-3 text-right w-20">Quantity</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(doc.items || []).map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-center text-slate-500 font-mono">
                    {it.srNo || idx + 1}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{it.particulars}</td>
                  {type === "challan" && (
                    <td className="py-2 px-3 text-slate-700">{it.material || "—"}</td>
                  )}
                  {type === "challan" && (
                    <td className="py-2 px-3 text-slate-700 font-mono">{it.dimensions || "—"}</td>
                  )}
                  {type === "dispatch" && (
                    <td className="py-2 px-3 font-medium text-blue-700">{it.condition}</td>
                  )}
                  {type === "dispatch" && (
                    <td className="py-2 px-3 text-slate-700">{it.work}</td>
                  )}
                  {type === "inward" && (
                    <td className="py-2 px-3 text-right font-medium text-slate-600">
                      {it.orderedQty}
                    </td>
                  )}
                  {type === "inward" && (
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {it.inwardQty}
                    </td>
                  )}
                  {type !== "inward" && (
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{it.qty}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Document Footer & Signatures */}
        <div className="pt-8 sm:pt-12 mt-8 sm:mt-12 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
          <div>
            <p className="font-bold text-slate-900 mb-1">Terms & Conditions:</p>
            <p className="text-slate-500 text-[10px] leading-relaxed">
              1. Goods once sold/dispatched will not be accepted back without prior authorization.
              <br />
              2. Subject to Gujarat jurisdiction only.
            </p>
          </div>
          <div className="sm:text-right space-y-8 sm:space-y-12">
            <p className="font-bold text-slate-900">For, STAR MOULD</p>
            <p className="font-bold text-slate-800 border-t border-slate-400 inline-block pt-1 px-8">
              Authorized Signatory
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
