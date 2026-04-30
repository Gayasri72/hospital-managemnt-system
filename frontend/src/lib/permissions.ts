/**
 * Centralized Role-Based Access Control (RBAC) definitions.
 * Matches backend seed configurations.
 */

export const ROLE_ACCESS = {
  dashboard: ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor', 'Accountant'],
  patients: ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor', 'Accountant'],
  doctors: ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor', 'Accountant'],
  sessions: ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor'],
  appointments: ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor', 'Accountant'],
  payments: ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor', 'Accountant'],
  medicalRecords: ['Super Admin', 'Hospital Admin', 'Doctor'],
  reports: ['Super Admin', 'Hospital Admin', 'Accountant'],
  admin: ['Super Admin', 'Hospital Admin']
} as const;

export type ModuleName = keyof typeof ROLE_ACCESS;

/**
 * Helper function to check if a role has access to a specific module.
 */
export const hasPermission = (role: string | undefined | null, module: ModuleName): boolean => {
  if (!role) return false;
  return (ROLE_ACCESS[module] as readonly string[]).includes(role);
};
