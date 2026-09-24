import React from "react";

export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`}
      {...props}
    />
  );
}

export function KpiCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 animate-pulse"
        >
          <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="h-6 w-16 bg-slate-300 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableRowSkeleton({
  rows = 8,
  columns = 7,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <tbody className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-3.5 px-4">
              <div
                className="h-4 bg-slate-200 rounded"
                style={{
                  width: `${Math.max(40, ((rIdx * 17 + cIdx * 23) % 60) + 40)}%`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm animate-pulse mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-300 rounded" />
          <div className="h-3.5 w-72 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-10 w-28 bg-slate-200 rounded-xl" />
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );
}

export function FullPageTableSkeleton({
  columns = 8,
  rows = 10,
  kpiCount = 4,
}: {
  columns?: number;
  rows?: number;
  kpiCount?: number;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <PageHeaderSkeleton />
      {kpiCount > 0 && <KpiCardSkeleton count={kpiCount} />}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 animate-pulse">
        <div className="h-9 w-64 bg-slate-200 rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 bg-slate-200 rounded-xl" />
          <div className="h-9 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/75">
          <div className="h-4 w-full bg-slate-200 rounded" />
        </div>
        <table className="w-full text-left border-collapse">
          <TableRowSkeleton rows={rows} columns={columns} />
        </table>
      </div>
    </div>
  );
}
