"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Eye, CheckCircle2, Trash2, ArrowUpRight } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  subtext?: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "default" | "primary" | "success" | "danger";
  separator?: boolean;
  disabled?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  title?: string;
}

export function ContextMenu({
  x,
  y,
  isOpen,
  onClose,
  items,
  title,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // Close on outside click, outside touch, or escape key
  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("touchstart", handleOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Precise dynamic viewport collision detection - NEVER CROP!
  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const updatePosition = () => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      let top = y;
      let left = x;

      // Vertical clamping / flipping
      if (top + rect.height > winH - 12) {
        if (y - rect.height >= 12) {
          top = y - rect.height;
        } else {
          top = Math.max(12, winH - rect.height - 12);
        }
      }

      // Horizontal clamping / flipping
      if (left + rect.width > winW - 12) {
        if (x - rect.width >= 12) {
          left = x - rect.width;
        } else {
          left = Math.max(12, winW - rect.width - 12);
        }
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, x, y, items.length]);

  if (!isOpen) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Mobile Bottom Sheet */}
        <div
          ref={menuRef}
          className="relative z-10 w-full bg-white rounded-t-3xl shadow-2xl p-4 pb-8 space-y-2 border-t border-slate-200 animate-in slide-in-from-bottom duration-200 select-none"
        >
          {/* Pull grabber indicator */}
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

          {title && (
            <div className="px-3 pb-2.5 border-b border-slate-100 mb-1 flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800 truncate">
                {title}
              </p>
              <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Options
              </span>
            </div>
          )}

          <div className="space-y-1">
            {items.map((item, idx) => {
              const Icon = item.icon;
              const variantClasses = item.disabled
                ? "text-slate-400 opacity-60 cursor-not-allowed"
                : {
                    default: "text-slate-700 active:bg-slate-100",
                    primary: "text-blue-700 active:bg-blue-50 bg-blue-50/50",
                    success: "text-emerald-700 active:bg-emerald-50",
                    danger: "text-rose-600 active:bg-rose-50",
                  }[item.variant || "default"];

              return (
                <React.Fragment key={idx}>
                  {item.separator && <div className="h-px bg-slate-100 my-1 mx-2" />}
                  <button
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      if (!item.disabled) {
                        item.onClick();
                        onClose();
                      }
                    }}
                    className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-3 transition-colors min-h-[48px] ${
                      item.disabled ? "cursor-not-allowed" : "cursor-pointer"
                    } ${variantClasses}`}
                  >
                    {Icon && <Icon className="w-5 h-5 shrink-0 stroke-[2.2]" />}
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{item.label}</div>
                      {item.subtext && (
                        <div className="text-[11px] font-normal text-slate-500 truncate mt-0.5">
                          {item.subtext}
                        </div>
                      )}
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-3 py-3 text-center text-xs font-bold text-slate-500 bg-slate-100 rounded-2xl active:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const desktopContent = (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: `${coords ? coords.top : Math.max(12, Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 350))}px`,
        left: `${coords ? coords.left : Math.max(12, Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 280))}px`,
        zIndex: 99999,
      }}
      className="fixed z-[99999] min-w-[250px] max-w-[340px] max-h-[calc(100vh-24px)] overflow-y-auto bg-white border border-slate-200/90 rounded-2xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md select-none"
    >
      {title && (
        <div className="px-3.5 py-1.5 border-b border-slate-100 mb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
        </div>
      )}

      <div className="space-y-0.5 px-1">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const variantClasses = item.disabled
            ? "text-slate-400 opacity-60 cursor-not-allowed"
            : {
                default: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                primary: "text-blue-700 hover:bg-blue-50 hover:text-blue-900",
                success: "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900",
                danger: "text-rose-600 hover:bg-rose-50 hover:text-rose-800",
              }[item.variant || "default"];

          return (
            <React.Fragment key={idx}>
              {item.separator && <div className="h-px bg-slate-100 my-1 mx-2" />}
              <button
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    onClose();
                  }
                }}
                className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                  item.disabled ? "cursor-not-allowed" : "cursor-pointer"
                } ${variantClasses}`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.label}</div>
                  {item.subtext && (
                    <div className="text-[10px] font-normal text-slate-500 truncate">
                      {item.subtext}
                    </div>
                  )}
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(desktopContent, document.body) : desktopContent;
}
