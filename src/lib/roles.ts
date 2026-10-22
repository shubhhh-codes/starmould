/**
 * System Roles & Permission Mapping
 * Source: supabase/migrations/001_init.sql (roles table) & app/Http/Controllers/UserController.php
 *
 * Implemented via the Phase 1 Postgres `roles` table definition.
 * Replaces old legacy inline role comparisons with structured role entities and RLS.
 */

export interface RoleDefinition {
  id: number;
  name: string;
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
    badge_color: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  1: {
    id: 1,
    name: 'manager',
    display_name: 'Manager',
    description: 'Procurement, movement documents, dispatch, and reports access',
    badge_color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  2: {
    id: 2,
    name: 'supervisor',
    display_name: 'Supervisor',
    description: 'Floor and workshop supervision, worklog, and QC approval',
    badge_color: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  3: {
    id: 3,
    name: 'designer',
    display_name: 'Designer',
    description: 'CAD/CAM design, plate programming, and scan assignments',
    badge_color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  4: {
    id: 4,
    name: 'worker',
    display_name: 'Worker',
    description: 'Machine operator, workpiece progression, and personal worklog tracking',
    badge_color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  5: {
    id: 5,
    name: 'purchase_incharge',
    display_name: 'Purchase Incharge',
    description: 'Raw material procurement, supplier orders, purchase inwards, and inventory receiving',
    badge_color: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  6: {
    id: 6,
    name: 'bmc',
    display_name: 'BMC Department',
    description: 'Machining floor, BMC/VMC work order execution, tool offsets, and program loading',
    badge_color: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  7: {
    id: 7,
    name: 'qc',
    display_name: 'Quality Checking (QC)',
    description: 'Inward inspection, in-process VMC dimension checks, and final dispatch QC sign-offs',
    badge_color: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  8: {
    id: 8,
    name: 'assembly',
    display_name: 'Assembly',
    description: 'Fitting, drilling & tapping, guide pillar installation, and mould die assembly',
    badge_color: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  9: {
    id: 9,
    name: 'dispatch',
    display_name: 'Dispatch',
    description: 'Delivery challans, transport vehicle coordination, client packaging, and gate passes',
    badge_color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  10: {
    id: 10,
    name: 'programmer',
    display_name: 'Programmer',
    description: 'CAD/CAM NC programming, machining path generation, and cutting tool parameters',
    badge_color: 'bg-sky-50 text-sky-700 border-sky-200',
  },
};

export const ALL_ROLES: RoleDefinition[] = Object.values(ROLES_TABLE);

export const USER_TYPES = [
  'Admin',
  'Manager',
  'Supervisor',
  'Designer',
  'Programmer',
  'Purchase Incharge',
  'BMC Department',
  'Quality Checking (QC)',
  'Assembly',
  'Dispatch',
  'User',
] as const;
export type UserType = (typeof USER_TYPES)[number];

export const USER_SUBTYPES = ['Skilled MP', 'Unskilled MP', 'Machine'] as const;
export type UserSubtype = (typeof USER_SUBTYPES)[number];

/**
 * Maps legacy usertype to the exact Role entity from the roles table.
 * Source: UserController.php store() role assignment logic.
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
    case 'Programmer':
      return ROLES_TABLE[10];
    case 'Purchase Incharge':
      return ROLES_TABLE[5];
    case 'BMC Department':
      return ROLES_TABLE[6];
    case 'Quality Checking (QC)':
      return ROLES_TABLE[7];
    case 'Assembly':
      return ROLES_TABLE[8];
    case 'Dispatch':
      return ROLES_TABLE[9];
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
 * Source: UserController.php store() lines 75-80
 */
export function getAutoUserSubtype(usertype: string): UserSubtype | null {
  if ([
    'Admin',
    'Manager',
    'Supervisor',
    'Designer',
    'Programmer',
    'Purchase Incharge',
    'BMC Department',
    'Quality Checking (QC)',
    'Assembly',
    'Dispatch',
  ].includes(usertype)) {
    return 'Skilled MP';
  }
  return null;
}
