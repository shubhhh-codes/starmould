"use client";

import React, { useEffect, useId, useRef } from "react";
import { overlayStack } from "@/lib/overlay-stack";
import { X } from "lucide-react";

/* =========================================================================
   1. MODAL DIALOG
   ========================================================================= */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  className?: string;
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth,
  size = "lg",
  className = "",
  showCloseButton = true,
}: ModalProps) {
  const effectiveMaxWidth = maxWidth || size;
  const modalId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      overlayStack.push(modalId, () => {
        onClose();
      }, triggerRef.current);

      // Focus first input or container
      setTimeout(() => {
        const firstInput = containerRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          containerRef.current?.focus();
        }
      }, 50);
    } else {
      overlayStack.pop(modalId);
    }

    return () => {
      overlayStack.pop(modalId);
    };
  }, [isOpen, modalId, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop with fade blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-backdrop-fade"
        onClick={() => {
          if (overlayStack.isTopmost(modalId)) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Modal Surface with Spring Entry */}
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-modal-spring focus:outline-none ${maxWidthClasses[effectiveMaxWidth]} ${className}`}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              {typeof title === "string" ? (
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              ) : (
                title
              )}
              {description && (
                <p className="text-xs text-slate-500 mt-0.5">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="btn-interactive p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 outline-none"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Body Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. SLIDE-OVER DRAWER
   ========================================================================= */

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  side?: "right" | "left";
  showCloseButton?: boolean;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  width = "lg",
  side = "right",
  showCloseButton = true,
}: DrawerProps) {
  const drawerId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      overlayStack.push(drawerId, () => {
        onClose();
      }, triggerRef.current);

      setTimeout(() => {
        const firstInput = containerRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          containerRef.current?.focus();
        }
      }, 50);
    } else {
      overlayStack.pop(drawerId);
    }

    return () => {
      overlayStack.pop(drawerId);
    };
  }, [isOpen, drawerId, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-backdrop-fade"
        onClick={() => {
          if (overlayStack.isTopmost(drawerId)) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        className={`fixed inset-y-0 ${side === "right" ? "right-0" : "left-0"} flex max-w-full ${
          side === "right" ? "pl-10" : "pr-10"
        }`}
      >
        <div
          ref={containerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          className={`w-screen ${widthClasses[width]} bg-white shadow-2xl border-l border-slate-200 flex flex-col focus:outline-none ${
            side === "right" ? "animate-drawer-right" : "animate-drawer-left"
          }`}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                {typeof title === "string" ? (
                  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                ) : (
                  title
                )}
                {description && (
                  <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                )}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-interactive p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 outline-none"
                  aria-label="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
