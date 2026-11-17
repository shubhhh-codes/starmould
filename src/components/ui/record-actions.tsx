import type { ReactNode } from "react";

/** Keeps row actions aligned; cards can wrap without squeezing labels or touch targets. */
export function RecordActions({ children, layout = "row", className = "" }: {
  children: ReactNode;
  layout?: "row" | "card" | "grid";
  className?: string;
}) {
  return <div data-record-actions={layout} className={`record-actions record-actions--${layout} ${className}`}>{children}</div>;
}
