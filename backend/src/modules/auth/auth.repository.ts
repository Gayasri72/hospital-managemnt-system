// ──────────────────────────────────────────────────────────────────────────────
// Auth Repository — all database queries for authentication.
//
// Only this file touches Prisma for auth-related data.
// No business logic here — just data access.
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';
import { writeAuditLog, type AuditEntry } from '../../utils/audit';

/**
 * Find a user by email, including their role.
 * @param email - The user's email address.
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { role: true, doctor: true },
  });
}

/**
 * Find a user by ID, including role and hospital.
 * Excludes password_hash from the result.
 * @param userId - The user's UUID.
 */
export async function findUserById(userId: string) {
  return prisma.user.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      name: true,
      email: true,
      status: true,
      hospital_id: true,
      created_at: true,
      role: { select: { role_id: true, name: true } },
      hospital: { select: { hospital_id: true, name: true } },
      doctor: { select: { doctor_id: true, name: true, specialization: true, status: true } },
    },
  });
}

/**
 * Store a hashed refresh token in the database.
 * @param userId - The user's UUID.
 * @param tokenHash - The bcrypt hash of the refresh token.
 * @param expiresAt - When the token expires.
 */
export async function createRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  audit?: Omit<AuditEntry, 'entity_id'>,
) {
  return prisma.$transaction(async (tx) => {
    const token = await tx.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    if (audit) {
      await writeAuditLog({ ...audit, entity_id: userId }, tx);
    }

    return token;
  });
}

/**
 * Find all refresh tokens for a user (for comparison during refresh).
 * @param userId - The user's UUID.
 */
export async function findRefreshTokensByUserId(userId: string) {
  return prisma.refreshToken.findMany({
    where: { user_id: userId },
    include: {
      user: {
        include: { role: true },
      },
    },
  });
}

/**
 * Delete a specific refresh token by its ID.
 * @param tokenId - The refresh token's UUID.
 */
export async function deleteRefreshToken(tokenId: string) {
  return prisma.refreshToken.delete({
    where: { token_id: tokenId },
  });
}

/**
 * Delete all refresh tokens for a user (e.g., on logout-all or account compromise).
 * @param userId - The user's UUID.
 */
export async function deleteAllRefreshTokensForUser(userId: string) {
  return prisma.refreshToken.deleteMany({
    where: { user_id: userId },
  });
}

