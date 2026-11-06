"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import {
  Building2,
  MapPin,
  Compass,
  Package,
} from "lucide-react";
import { KpiCardSkeleton } from "@/components/ui/skeleton";

type Props = Pick<SubplatePageContext,
  | "isLoading"
  | "totalCount"
  | "inHouseCount"
  | "vendorCount"
  | "uniqueProjects"
>;

export function SubplateSummaryCards({
  isLoading,
  totalCount,
  inHouseCount,
  vendorCount,
  uniqueProjects,
}: Props) {
  return (
    isLoading ? (
      <KpiCardSkeleton count={4} />
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Subplates
            </p>
            <p className="text-2xl font-black text-slate-900">
              {totalCount.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              In-House (At Workshop &apos;SM&apos;)
            </p>
            <p className="text-2xl font-black text-emerald-600">
              {inHouseCount.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              On Job Work (Vendor)
            </p>
            <p className="text-2xl font-black text-amber-600">
              {vendorCount.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Projects Linked
            </p>
            <p className="text-2xl font-black text-indigo-600">
              {uniqueProjects}
            </p>
          </div>
        </div>
      </div>
    )
  );
}
