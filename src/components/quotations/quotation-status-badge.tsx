"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  Check,
} from "lucide-react";

export const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Draft: {
    label: "Draft",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-300",
    dot: "bg-slate-400",
    icon: Clock,
  },
  Sent: {
    label: "Sent",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
    icon: Send,
  },
  Accepted: {
    label: "Accepted",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  Rejected: {
    label: "Rejected",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    icon: XCircle,
  },
  Expired: {
    label: "Expired",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    icon: AlertCircle,
  },
};

export const STATUS_OPTIONS = ["Draft", "Sent", "Accepted", "Rejected", "Expired"] as const;

export interface QuotationStatusBadgeProps {
  quotationId: number;
  status: string;
  onStatusChange?: (newStatus: string) => void;
  size?: "sm" | "md";
}

export function QuotationStatusBadge({
  quotationId,
  status: initialStatus,
  onStatusChange,
  size = "md",
}: QuotationStatusBadgeProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(initialStatus || "Draft");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
    placeAbove: boolean;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keep in sync if parent changes
  useEffect(() => {
    setCurrentStatus(initialStatus || "Draft");
  }, [initialStatus]);

  // Click outside & Escape key listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Dynamically calculate fixed coordinates to prevent table overflow clipping & z-index issues
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popoverHeight = 185; // 5 options * ~32px + padding
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < popoverHeight && rect.top > popoverHeight;

      const popoverWidth = 144; // w-36 (144px)
      // Center horizontally relative to badge trigger
      let left = rect.left + rect.width / 2 - popoverWidth / 2;
      // Keep within viewport boundaries with 8px margin
      left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));

      const top = placeAbove ? rect.top - 6 : rect.bottom + 6;
      setPopoverCoords({ top, left, placeAbove });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.Draft;
  const StatusIcon = cfg.icon;

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus || isUpdating) return;

    const previousStatus = currentStatus;
    // Optimistic UI update
    setCurrentStatus(newStatus);
    setIsUpdating(true);

    try {
      const res = await fetch("/api/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quotationId,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update quotation status");
      }

      onStatusChange?.(newStatus);
    } catch (err) {
      console.error("Status update error:", err);
      // Revert on failure
      setCurrentStatus(previousStatus);
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const isSmall = size === "sm";

  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Interactive Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!isUpdating) setIsOpen((prev) => !prev);
        }}
        disabled={isUpdating}
        className={`inline-flex items-center gap-1 font-bold border rounded-full transition-all duration-150 select-none cursor-pointer ${
          isSmall ? "px-2 py-0.5 text-[9.5px]" : "px-2.5 py-1 text-[10.5px]"
        } ${cfg.bg} ${cfg.text} ${cfg.border} hover:shadow-xs hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed`}
        title="Click to change quotation status"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {isUpdating ? (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          <StatusIcon className={`${isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} shrink-0`} />
        )}
        <span className="truncate">{cfg.label}</span>
        <ChevronDown
          className={`${
            isSmall ? "w-2.5 h-2.5" : "w-3 h-3"
          } opacity-60 transition-transform duration-200 shrink-0 ml-0.5 ${
            isOpen ? "rotate-180 opacity-100" : ""
          }`}
        />
      </button>

      {/* StarMould Theme Custom Popover Menu rendered via Portal to avoid table overflow-hidden and z-index clipping */}
      {isOpen &&
        isMounted &&
        popoverCoords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            style={{
              position: "fixed",
              top: popoverCoords.placeAbove ? "auto" : `${popoverCoords.top}px`,
              bottom: popoverCoords.placeAbove
                ? `${Math.max(8, window.innerHeight - popoverCoords.top)}px`
                : "auto",
              left: `${popoverCoords.left}px`,
              width: "144px",
              zIndex: 99999,
            }}
            className="bg-white border border-slate-200/90 rounded-2xl shadow-xl p-1 text-xs animate-in fade-in zoom-in-95 duration-100 space-y-0.5 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = opt === currentStatus;
              const optCfg = STATUS_CONFIG[opt];
              const OptIcon = optCfg.icon;

              return (
                <button
                  key={opt}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    handleChange(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-100 font-bold text-slate-900"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${optCfg.dot}`} />
                    <span className="flex items-center gap-1.5 font-medium truncate">
                      <OptIcon className="w-3.5 h-3.5 opacity-70 shrink-0" />
                      <span className="truncate">{optCfg.label}</span>
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
