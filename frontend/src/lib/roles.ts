/**
 * System Roles & Permission Mapping
 * Source: supabase/migrations/001_init.sql (roles table) & app/Http/Controllers/UserController.php
 *
 * Implemented via the Phase 1 Postgres `roles` table definition.
 * Replaces old legacy inline role comparisons with structured role entities and RLS.
 */

export interface RoleDefinition {
  id: number;
  name: 'admin' | 'manager' | 'supervisor' | 'designer' | 'worker';
  display_name: string;
  description: string;
  badge_color: string;
}

export const ROLES_TABLE: Record<number, RoleDefinition> = {
  0: {
    id: 0,
    name: 'admin',
    display_name: 'Admin',
    description: 'Full administrative access across all modules and financial settings',
    badge_color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
  },
  1: {
    id: 1,
    name: 'manager',
    display_name: 'Manager',
    description: 'Procurement, movement documents, dispatch, and reports access',
    badge_color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900',
  },
  2: {
    id: 2,
    name: 'supervisor',
    display_name: 'Supervisor',
    description: 'Floor and workshop supervision, worklog, and QC approval',
    badge_color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  },
  3: {
    id: 3,
    name: 'designer',
    display_name: 'Designer',
    description: 'CAD/CAM design, plate programming, and scan assignments',
    badge_color: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900',
  },
  4: {
    id: 4,
    name: 'worker',
    display_name: 'Worker',
    description: 'Machine operator, workpiece progression, and personal worklog tracking',
    badge_color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  },
};

export const ALL_ROLES: RoleDefinition[] = Object.values(ROLES_TABLE);

export const USER_TYPES = ['Admin', 'Manager', 'Supervisor', 'Designer', 'User'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_SUBTYPES = ['Skilled MP', 'Unskilled MP', 'Machine'] as const;
export type UserSubtype = (typeof USER_SUBTYPES)[number];

/**
 * Maps legacy usertype to the exact Role entity from the roles table.
 * Source: UserController.php store() role assignment logic.
 *
 * Admin => Role 0 (admin)
 * Manager => Role 1 (manager)
 * Supervisor => Role 2 (supervisor)
 * Designer => Role 3 (designer)
 * User / Else => Role 4 (worker)
 */
export function getRoleForUserType(usertype: string): RoleDefinition {
  switch (usertype) {
    case 'Admin':
      return ROLES_TABLE[0];
    case 'Manager':
      return ROLES_TABLE[1];
    case 'Supervisor':
      return ROLES_TABLE[2];
    case 'Designer':
      return ROLES_TABLE[3];
    default:
      return ROLES_TABLE[4];
  }
}

/**
 * Look up a role definition by role_id from the roles table.
 */
export function getRoleById(roleId: number): RoleDefinition {
  return ROLES_TABLE[roleId] ?? ROLES_TABLE[4];
}

/**
 * Replicates the legacy usertype -> usersubtype auto-set logic.
 * Source: UserController.php store() lines 75-80:
 * "if ($request->usertype == 'Admin' || $request->usertype == 'Manager' ||
 *      $request->usertype == 'Supervisor' || $request->usertype == 'Designer') {
 *     $model->usersubtype = 'Skilled MP';
 *  }"
 */
export function getAutoUserSubtype(usertype: string): UserSubtype | null {
  if (['Admin', 'Manager', 'Supervisor', 'Designer'].includes(usertype)) {
    return 'Skilled MP';
  }
  return null;
}
