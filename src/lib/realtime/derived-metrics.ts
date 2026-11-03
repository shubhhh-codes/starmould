/**
 * Pure helper for computing subplate-derived metrics on mould projects.
 * Shared between server routes (/api/scanning) and client real-time synchronization.
 */

export interface SubplateDerivedProjectMetrics {
  subplate_count: number;
  total_plates: number;
  completed_plates: number;
  completion_percentage: number;
  is_ready_for_dispatch: boolean;
}

/**
 * Compute total_plates, completed_plates, completion_percentage, and is_ready_for_dispatch
 * from a list of subplates. Matches the exact formula used in /api/scanning.
 */
export function computeSubplateDerivedMetrics(
  subplates: Array<{ packing_workby?: number | string | null } | any>
): SubplateDerivedProjectMetrics {
  const totalPlates = Array.isArray(subplates) ? subplates.length : 0;
  const completedCount = Array.isArray(subplates)
    ? subplates.filter((sp) => sp && sp.packing_workby != null && Number(sp.packing_workby) > 0).length
    : 0;
  const completionPct = totalPlates > 0 ? Math.round((completedCount / totalPlates) * 100) : 0;

  return {
    subplate_count: totalPlates,
    total_plates: totalPlates,
    completed_plates: completedCount,
    completion_percentage: completionPct,
    is_ready_for_dispatch: totalPlates > 0 && completedCount === totalPlates,
  };
}
