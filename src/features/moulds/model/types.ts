import type { ReactNode } from "react";
import type { ScanProject, Subplate } from "@/lib/supabase/types";

export interface MouldProjectsTableProps {
  initialData?: ScanProject[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onDeleteProject?: (id: number | string, force?: boolean) => Promise<boolean>;
  onDeleteProjects?: (ids: (number | string)[], force?: boolean) => Promise<boolean>;
}

export interface ConfirmationState {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => Promise<void> | void;
}

export interface ProjectMenuState {
  x: number;
  y: number;
  isOpen: boolean;
  project: ScanProject | null;
}

export interface SubplateMenuState {
  x: number;
  y: number;
  isOpen: boolean;
  subplate: Subplate | null;
  project?: ScanProject | null;
}

export interface SubplateFormState {
  platename: string;
  subprojectid: string;
  material: string;
  shape: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  unit: string;
  sqty: string;
  location: string;
}
