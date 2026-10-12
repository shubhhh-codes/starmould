"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";

export interface MotionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  loading?: boolean;
  isSuccess?: boolean;
  isError?: boolean;
  loadingText?: string;
  successText?: string;
  children: React.ReactNode;
}

export const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading,
      loading,
      isSuccess = false,
      isError = false,
      loadingText = "Saving...",
      successText = "Saved",
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const activeLoading = isLoading ?? loading ?? false;
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
      if (isSuccess) {
        setShowSuccess(true);
        const timer = setTimeout(() => setShowSuccess(false), 1600);
        return () => clearTimeout(timer);
      }
    }, [isSuccess]);

    const sizeClasses = {
      xs: "px-2.5 py-1 text-xs rounded-md gap-1.5",
      sm: "px-3 py-1.5 text-xs font-medium rounded-lg gap-1.5",
      md: "px-4 py-2 text-sm font-medium rounded-lg gap-2",
      lg: "px-5 py-2.5 text-base font-medium rounded-xl gap-2.5",
    };

    const variantClasses = {
      primary:
        "bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-600 active:border-blue-700 focus:ring-2 focus:ring-blue-500/20",
      secondary:
        "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 active:bg-slate-300 focus:ring-2 focus:ring-slate-400/20",
      danger:
        "bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-600 active:border-rose-700 focus:ring-2 focus:ring-rose-500/20",
      outline:
        "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 active:bg-slate-100 focus:ring-2 focus:ring-blue-500/20",
      ghost:
        "bg-transparent hover:bg-slate-100 text-slate-700 active:bg-slate-200 focus:ring-2 focus:ring-slate-400/20",
      success:
        "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600 focus:ring-2 focus:ring-emerald-500/20",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || activeLoading}
        className={`btn-interactive relative inline-flex items-center justify-center font-medium select-none outline-none disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none ${
          sizeClasses[size]
        } ${showSuccess ? variantClasses.success : variantClasses[variant]} ${className}`}
        {...props}
      >
        {/* Loading State */}
        {activeLoading && (
          <span className="inline-flex items-center gap-1.5 animate-in fade-in duration-150">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{loadingText}</span>
          </span>
        )}

        {/* Success State */}
        {!activeLoading && showSuccess && (
          <span className="inline-flex items-center gap-1.5 animate-in zoom-in-95 duration-150 text-white">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{successText}</span>
          </span>
        )}

        {/* Error State */}
        {!activeLoading && !showSuccess && isError && (
          <span className="inline-flex items-center gap-1.5 text-rose-200 animate-in fade-in duration-150">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Error</span>
          </span>
        )}

        {/* Idle Default Content */}
        {!activeLoading && !showSuccess && !isError && children}
      </button>
    );
  }
);

MotionButton.displayName = "MotionButton";
