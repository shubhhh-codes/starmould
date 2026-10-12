"use client";

import React, { useEffect, useId, useRef } from "react";
import { overlayStack } from "@/lib/overlay-stack";
import { X, AlertTriangle, Trash2 } from "lucide-react";
import { MotionButton } from "@/components/ui/motion-button";

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
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      overlayStack.push(modalId, () => {
        onCloseRef.current();
      }, triggerRef.current);

      // Focus first interactive input or container on initial open only
      const timer = setTimeout(() => {
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden min-h-full w-full max-w-[100vw]">
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
        className={`relative z-10 w-full max-w-[calc(100vw-1rem)] ${maxWidthClasses[effectiveMaxWidth]} bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] my-auto animate-modal-spring focus:outline-none min-w-0 ${className}`}
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
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      overlayStack.push(drawerId, () => {
        onCloseRef.current();
      }, triggerRef.current);

      // Focus first interactive input or container on initial open only
      const timer = setTimeout(() => {
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
        overlayStack.pop(drawerId);
      };
    } else {
      overlayStack.pop(drawerId);
    }
  }, [isOpen, drawerId]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
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
          side === "right" ? "pl-6 sm:pl-10" : "pr-6 sm:pr-10"
        }`}
      >
        <div
          ref={containerRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          className={`w-screen max-w-[calc(100vw-1.5rem)] ${widthClasses[width]} bg-white shadow-2xl border-l border-slate-200 flex flex-col focus:outline-none min-w-0 ${
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
}: ConfirmDialogProps) {
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
          >
            {cancelLabel}
          </MotionButton>
          <MotionButton
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            loading={isLoading}
          >
            {confirmLabel}
          </MotionButton>
        </div>
      </div>
    </Modal>
  );
}
