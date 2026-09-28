"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 useEffect(() => {
 console.error("App-level error boundary caught:", error);
 }, [error]);

 return (
 <div className="min-h-[70vh] flex items-center justify-center p-6">
 <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5">
 <div className="w-14 h-14 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center mx-auto text-rose-600 ">
 <AlertTriangle className="w-7 h-7" />
 </div>

 <div className="space-y-2">
 <h2 className="text-xl font-bold text-slate-900 tracking-tight">
 Something went wrong
 </h2>
 <p className="text-xs sm:text-sm text-slate-500 ">
 {error.message || "An unexpected system error occurred while processing your request."}
 </p>
 {error.digest && (
 <p className="text-[10px] font-mono text-slate-400">
 Error Digest: {error.digest}
 </p>
 )}
 </div>

 <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
 <button
 onClick={() => reset()}
 className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-sm shadow-blue-600/20 transition cursor-pointer"
 >
 <RefreshCw className="w-3.5 h-3.5" />
 <span>Try Again</span>
 </button>
 <Link
 href="/"
 className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
 >
 <Home className="w-3.5 h-3.5" />
 <span>Dashboard</span>
 </Link>
 </div>
 </div>
 </div>
 );
}
