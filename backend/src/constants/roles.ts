// Centralized role identifiers. The values must match seeded role names exactly,
// since RBAC checks compare against the role name embedded in the JWT.
//
// Why: a typo like authorize('Super admin') silently denies everyone instead of
// failing loudly. Importing from this module makes typos compile errors.

export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  HOSPITAL_ADMIN: 'Hospital Admin',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
  ACCOUNTANT: 'Accountant',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: RoleName[] = Object.values(ROLES);
