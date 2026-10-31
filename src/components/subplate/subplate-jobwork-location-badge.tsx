"use client";

import React from "react";
import { MapPin, Building2 } from "lucide-react";

export interface SubplateLocationInfo {
  sqty?: number;
  location?: string | null;
  jobwork_balance?: {
    outward_jobwork_qty: number;
    available_sm_qty: number;
    customer_dispatched_qty?: number;
    active_vendors: string | null;
    active_vendor_initials: string | null;
  } | null;
}

interface SubplateJobworkLocationBadgeProps {
  subplate: SubplateLocationInfo;
  className?: string;
  size?: "sm" | "md";
}

export function SubplateJobworkLocationBadge({
  subplate,
  className = "",
  size = "md",
}: SubplateJobworkLocationBadgeProps) {
  const totalQty = Math.max(1, Number(subplate.sqty) || 1);
  const bal = subplate.jobwork_balance;

  // Derive outward, dispatched, and SM quantities
  let outwardQty = 0;
  let smQty = totalQty;
  let dispatchedQty = 0;
  let vendorTag = "";

  if (bal) {
    outwardQty = Number(bal.outward_jobwork_qty) || 0;
    smQty = Number(bal.available_sm_qty) || 0;
    dispatchedQty = Number((bal as any).customer_dispatched_qty) || 0;
    vendorTag = bal.active_vendor_initials || bal.active_vendors || "";
  } else {
    // Fallback from legacy comma-separated string
    const rawLoc = (subplate.location || "SM").trim();
    if (rawLoc === "Customer") {
      dispatchedQty = totalQty;
      smQty = 0;
      outwardQty = 0;
    } else if (rawLoc === "SM" || !rawLoc) {
      outwardQty = 0;
      smQty = totalQty;
    } else if (rawLoc.includes("SM")) {
      // Split location legacy
      const parts = rawLoc.split(",").map((p) => p.trim()).filter((p) => p && p !== "SM");
      vendorTag = parts.join(", ");
      outwardQty = Math.floor(totalQty / 2) || 1;
      smQty = Math.max(0, totalQty - outwardQty);
    } else {
      vendorTag = rawLoc;
      outwardQty = totalQty;
      smQty = 0;
    }
  }

  // Ensure Customer location string is honored even if balance view didn't aggregate
  if ((subplate.location || "").trim() === "Customer" && dispatchedQty === 0 && outwardQty === 0) {
    dispatchedQty = totalQty;
    smQty = 0;
  }

  const isSmall = size === "sm";
  const padClass = isSmall ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  const vendorFullName = bal?.active_vendors || vendorTag;

  // Case 0: 100% Dispatched to Customer
  if (dispatchedQty > 0 && outwardQty === 0 && smQty === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs ${padClass} ${className}`}
        title={`All ${totalQty} pcs dispatched to Customer`}
      >
        <MapPin className="w-2.5 h-2.5 text-blue-600 shrink-0" />
        <span>Dispatched (Customer)</span>
        {totalQty > 1 && <span className="opacity-75 font-mono text-[9px]">({totalQty})</span>}
      </span>
    );
  }

  // Case 1: Split location (Some in SM, some out for Job Work)
  if (smQty > 0 && outwardQty > 0) {
    return (
      <div className={`inline-flex items-center gap-1.5 flex-wrap justify-center ${className}`}>
        <span
          className={`inline-flex items-center gap-1 rounded-md font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs ${padClass}`}
          title={`${smQty} pcs currently inside Star Mould premises`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>{smQty} in SM</span>
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs cursor-help ${padClass}`}
          title={`${outwardQty} pcs on Job Work with ${vendorFullName}${vendorTag && vendorTag !== vendorFullName ? ` (${vendorTag})` : ""}`}
        >
          <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
          <span>
            {outwardQty} in Job Work{vendorTag ? ` (${vendorTag})` : ""}
          </span>
        </span>
      </div>
    );
  }

  // Case 2: 100% Outward on Job Work
  if (outwardQty > 0 && smQty === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs cursor-help ${padClass} ${className}`}
        title={`All ${totalQty} pcs on Job Work with ${vendorFullName}${vendorTag && vendorTag !== vendorFullName ? ` (${vendorTag})` : ""}`}
      >
        <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
        <span>Job Work{vendorTag ? ` (${vendorTag})` : ""}</span>
        {totalQty > 1 && <span className="opacity-75 font-mono text-[9px]">({totalQty})</span>}
      </span>
    );
  }

  // Case 3: 100% In-House Star Mould (SM)
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs ${padClass} ${className}`}
      title={`All ${totalQty} pcs in-house at Star Mould`}
    >
      <Building2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
      <span>In-House (SM)</span>
      {totalQty > 1 && <span className="opacity-75 font-mono text-[9px]">({totalQty})</span>}
    </span>
  );
}
