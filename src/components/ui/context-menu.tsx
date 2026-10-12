"use client";

import React, { useEffect, useRef } from "react";
import { Plus, Eye, CheckCircle2, Trash2, ArrowUpRight } from "lucide-react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  variant?: "default" | "primary" | "success" | "danger";
  separator?: boolean;
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

  // Close on outside click or escape key
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
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
      document.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Collision adjustment: ensure menu doesn't overflow screen viewport
  const menuWidth = 220;
  const menuHeight = items.length * 36 + (title ? 40 : 10);
  const adjustedX = Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - menuWidth - 16);
  const adjustedY = Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - menuHeight - 16);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 min-w-[210px] bg-white border border-slate-200/90 rounded-2xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md select-none"
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
          const variantClasses = {
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
                onClick={() => {
                  item.onClick();
                  onClose();
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${variantClasses}`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />}
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
