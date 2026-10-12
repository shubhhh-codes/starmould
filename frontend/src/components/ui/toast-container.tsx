"use client";

import React from "react";
import { useAppStore, appStore } from "@/lib/state/store";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
          warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
        };

        const borderStyles = {
          success: "border-emerald-200 bg-white text-emerald-900 shadow-emerald-100",
          error: "border-rose-200 bg-white text-rose-900 shadow-rose-100",
          warning: "border-amber-200 bg-white text-amber-900 shadow-amber-100",
          info: "border-blue-200 bg-white text-blue-900 shadow-blue-100",
        };

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg transition-all animate-in slide-in-from-bottom-2 ${
              borderStyles[toast.type]
            }`}
          >
            {icons[toast.type]}
            <p className="text-sm font-medium leading-snug flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => appStore.removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 p-0.5 rounded-md hover:bg-slate-100"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
