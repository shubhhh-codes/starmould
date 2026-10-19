"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home, Copy, Check, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(process.env.NODE_ENV !== "production");
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error("App-level error boundary caught:", error);
  }, [error]);

  const handleCopy = () => {
    const errorPayload = `Error: ${error.message}\nDigest: ${error.digest || "N/A"}\nStack:\n${error.stack || "No stack trace available"}`;
    navigator.clipboard.writeText(errorPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      reset();
      setIsRetrying(false);
    }, 600);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-xl w-full bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-6">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-rose-600 shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>

        {/* Header Text */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {error.message || "An unexpected system error occurred while processing your request."}
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-slate-400">
              Digest: <span className="text-slate-600 font-semibold">{error.digest}</span>
            </p>
          )}
        </div>

        {/* Collapsible Error Diagnostics Box (Stack & Logs) */}
        <div className="text-left">
          <div className="flex items-center justify-between gap-2 border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 rounded-xl">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-blue-600 transition cursor-pointer select-none"
            >
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Diagnostic Logs & Stack</span>
              {showDetails ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition shadow-2xs cursor-pointer"
              title="Copy error details"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {showDetails && (
            <div className="mt-2 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 select-text space-y-2">
              <div className="text-rose-400 font-bold">
                {error.name || "Error"}: {error.message}
              </div>
              {error.stack && (
                <pre className="text-[10px] text-slate-400 leading-normal whitespace-pre-wrap break-all font-mono">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs shadow-blue-600/30 transition cursor-pointer disabled:opacity-75"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin-fast" : ""}`} />
            <span>{isRetrying ? "Retrying..." : "Try Again"}</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
