"use client";

import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { overlayStack } from "@/lib/overlay-stack";
import { X, AlertTriangle, Trash2 } from "lucide-react";
import { MotionButton } from "@/components/ui/motion-button";
import { Drawer as InteriorDrawer } from "@/components/interior/drawer";

/* =========================================================================
   1. MODAL DIALOG
   ========================================================================= */

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";
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
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      overlayStack.push(modalId, () => {
        onCloseRef.current();
      }, triggerRef.current, containerRef.current?.closest<HTMLElement>("[data-overlay-root]"));

      // Focus first interactive input or container on initial open only
      const timer = setTimeout(() => {
        // 1. Look for explicit autofocus element
        const autoFocusEl = containerRef.current?.querySelector<HTMLElement>(
          '[data-autofocus]:not([disabled]):not([tabindex="-1"]), [autofocus]:not([disabled]):not([tabindex="-1"])'
        );
        if (autoFocusEl) {
          autoFocusEl.focus();
          return;
        }

        // 2. Look for first interactive element inside modal body content
        const bodyContent = containerRef.current?.querySelector<HTMLElement>('.overflow-y-auto');
        const bodyInput = bodyContent?.querySelector<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([readonly]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"])'
        );
        if (bodyInput) {
          bodyInput.focus();
          return;
        }

        // 3. Fallback to any focusable element or container
        const firstInput = containerRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]):not([readonly]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          containerRef.current?.focus();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        overlayStack.pop(modalId);
      };
    } else {
      overlayStack.pop(modalId);
    }
  }, [isOpen, modalId]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    "5xl": "sm:max-w-5xl",
    "6xl": "sm:max-w-6xl",
  };

  const modalContent = (
    <div data-overlay-root className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden min-h-full w-full max-w-[100vw]">
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

      {/* Modal Surface with Spring Entry & Mobile Viewport Constraints */}
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full max-w-[calc(100vw-1rem)] ${maxWidthClasses[effectiveMaxWidth]} bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] my-auto animate-modal-spring focus:outline-none min-w-0 select-none ${className}`}
      >
        {/* Header (Sticky, shrink-0, never clipped) */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-100 shrink-0 bg-white sticky top-0 z-10 min-w-0">
            <div className="pr-2 min-w-0 flex-1">
              {typeof title === "string" ? (
                <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">{title}</h3>
              ) : (
                title
              )}
              {description && (
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="btn-interactive p-1.5 sm:p-2 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 outline-none cursor-pointer transition shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body Content (Smooth inner scroll, never overflows screen) */}
        <div className="p-3.5 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 overscroll-contain w-full min-w-0">{children}</div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
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
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | number;
  side?: "right" | "left";
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  beforeBody?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}

const DRAWER_WIDTHS = { sm: 384, md: 448, lg: 512, xl: 576, "2xl": 672, "3xl": 768, "4xl": 896 };

// Existing detail panels share the supplied interior drawer.
export function Drawer({ isOpen, onClose, title = "Details", width = "lg", ...props }: DrawerProps) {
  return <InteriorDrawer
    {...props}
    open={isOpen}
    onOpenChange={(open) => { if (!open) onClose(); }}
    title={title}
    width={typeof width === "number" ? width : DRAWER_WIDTHS[width]}
  />;
}

/* =========================================================================
   3. CONFIRMATION DIALOG
   ========================================================================= */

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  loadingText?: string;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
  loadingText,
}: ConfirmDialogProps) {
  const onConfirmRef = useRef(onConfirm);
  const onCloseRef = useRef(onClose);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCloseRef.current = onClose;
    isLoadingRef.current = isLoading;
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoadingRef.current) return;

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onConfirmRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              variant === "danger"
                ? "bg-rose-50 text-rose-600"
                : variant === "warning"
                  ? "bg-amber-50 text-amber-600"
                  : "bg-blue-50 text-blue-600"
            }`}
          >
            {variant === "danger" ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">{title}</h4>
            <p className="text-xs text-slate-500">Please confirm this action</p>
          </div>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed">{description}</div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <MotionButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <span>{cancelLabel}</span>
            <kbd className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
              Esc
            </kbd>
          </MotionButton>
          <MotionButton
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={isLoading}
            loadingText={loadingText || (variant === "danger" ? "Deleting..." : "Saving...")}
            className="flex items-center gap-1.5"
          >
            <span>{confirmLabel}</span>
            <kbd
              className={`text-[9px] font-mono px-1 py-0.5 rounded border ${
                variant === "danger"
                  ? "bg-rose-700 text-white border-rose-800"
                  : "bg-blue-700 text-white border-blue-800"
              }`}
            >
              ↵ Enter
            </kbd>
          </MotionButton>
        </div>
      </div>
    </Modal>
  );
}
