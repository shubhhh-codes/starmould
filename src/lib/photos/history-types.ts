export type PhotoHistoryKind = "purchase_order" | "purchase_receipt" | "jobwork_outward" | "jobwork_receipt" | "dispatch" | "stage";
export type PhotoStageKey = "vmc_qcby" | "final_qcby" | "packing_workby";
export interface PhotoHistoryScope { kind: PhotoHistoryKind; id: number; stageKey?: PhotoStageKey }
export interface PhotoHistorySummary {
  availableCount: number; expiredCount: number; removedCount: number;
}
export interface PhotoHistoryItem {
  id: number; original_filename: string; server_uploaded_at: string;
  uploader_name: string; width: number | null; height: number | null;
}
export interface PhotoHistoryGroup extends PhotoHistorySummary {
  id: string; title: string; eventDate: string | null; party: string | null;
  photos: PhotoHistoryItem[]; nextPhotoOffset: number | null;
}
export interface PhotoHistoryPage {
  title: string; summary: PhotoHistorySummary; groups: PhotoHistoryGroup[];
  nextGroupOffset: number | null;
}
const kinds: PhotoHistoryKind[] = ["purchase_order", "purchase_receipt", "jobwork_outward", "jobwork_receipt", "dispatch", "stage"];
const stages: PhotoStageKey[] = ["vmc_qcby", "final_qcby", "packing_workby"];
export function parsePhotoHistoryScope(value: unknown): PhotoHistoryScope {
  if (!value || typeof value !== "object") throw new Error("Photo history scope required");
  const v = value as Record<string, unknown>;
  if (!kinds.includes(v.kind as PhotoHistoryKind) || !Number.isSafeInteger(v.id) || Number(v.id) <= 0 ||
    (v.kind === "stage" && !stages.includes(v.stageKey as PhotoStageKey))) throw new Error("Invalid photo history scope");
  return { kind: v.kind as PhotoHistoryKind, id: Number(v.id), ...(v.kind === "stage" ? { stageKey: v.stageKey as PhotoStageKey } : {}) };
}
export function photoHistoryKey(scope: PhotoHistoryScope) { return `${scope.kind}:${scope.id}:${scope.stageKey || ""}`; }
export function formatPhotoUploadTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) + " IST";
}
export function photoHistoryLabel(summary: PhotoHistorySummary) {
  if (summary.availableCount > 0) return `Images (${summary.availableCount})`;
  if (summary.expiredCount > 0 && summary.removedCount === 0) return "Photos expired";
  if (summary.removedCount > 0 && summary.expiredCount === 0) return "Photos removed";
  if (summary.removedCount + summary.expiredCount > 0) return "Photos unavailable";
  return "Images (0)";
}
