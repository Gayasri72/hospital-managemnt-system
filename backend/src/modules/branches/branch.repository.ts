// ──────────────────────────────────────────────────────────────────────────────
// Branch Repository — all database queries for branch management.
//
// Only this file touches Prisma for branch-related data.
// No business logic here — just data access.
//
// IMPORTANT: All queries are scoped by hospital_id to enforce data isolation.
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';

/**
 * List all branches for a hospital.
 */
export async function findByHospital(hospitalId: string) {
  return prisma.branch.findMany({
    where: { hospital_id: hospitalId },
    select: {
      branch_id: true,
      name: true,
      location: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Find a single branch by ID — scoped to hospital_id.
 */
export async function findByIdInHospital(branchId: string, hospitalId: string) {
  return prisma.branch.findFirst({
    where: {
      branch_id: branchId,
      hospital_id: hospitalId,
    },
    select: {
      branch_id: true,
      name: true,
      location: true,
    },
  });
}
