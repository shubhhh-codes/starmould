export type ExportFormat = "xlsx" | "pdf" | "csv";
export type ExportScope = "filtered" | "selected";

export interface ExportColumn {
  key: string;
  header: string;
  type: "string" | "number" | "currency" | "date" | "status";
  width?: number; // character width for xlsx / percent for pdf
  financial?: boolean; // requires financial_view_amounts
}

export interface ExportDatasetResult {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, any>[];
  totalCount: number;
  generatedAt: string; // ISO date string
  filtersApplied: Record<string, string>;
}

export interface ExportRequestV1 {
  version: 1;
  dataset: "moulds" | "project_register" | "subplates" | "purchases" | "challans" | "dispatches" | "inwards" | "customers" | "vendors" | "worklogs";
  format: ExportFormat;
  scope: ExportScope;
  filters?: Record<string, any>;
  search?: string;
  sort?: { field: string; direction: "asc" | "desc" }[];
  selectedIds?: (string | number)[];
  title?: string;
}
