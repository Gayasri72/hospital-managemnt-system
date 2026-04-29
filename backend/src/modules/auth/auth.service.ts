// ──────────────────────────────────────────────────────────────────────────────
// Auth Service — business logic for authentication.
//
// Handles login, token refresh, logout, and current-user retrieval.
// No HTTP concerns here — that's the controller's job.
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import { comparePassword, hashPassword } from '../../utils/password.util';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.util';
import { writeAuditLog } from '../../utils/audit';
import * as authRepo from './auth.repository';

// ── Types ────────────────────────────────────────────────────────────────────

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    user_id: string;
    name: string;
    email: string;
    role: string;
    hospital_id: string;
    doctor_id?: string;
  };
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Authenticate a user with email and password.
 *
 * Business rules:
 * - User must exist (generic 401 if not)
 * - User must have 'ACTIVE' status (403 if inactive)
 * - Password must match the stored hash (generic 401 if not)
 * - On success: issue access + refresh tokens, log to audit
 *
 * @param email - The user's email address.
 * @param password - The plaintext password to verify.
 * @returns Access token, refresh token, and user info.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  // 1) Find user by email
  const user = await authRepo.findUserByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  // 2) Check if user is active
  if (user.status !== 'ACTIVE') {
    throw new AppError('Your account has been deactivated. Please contact the administrator.', 403);
  }

  // 3) Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  // 4) Build token payload (include doctorId if user is linked to a doctor)
  const doctorId = user.doctor?.doctor_id;
  const tokenPayload = {
    userId: user.user_id,
    email: user.email,
    role: user.role.name,
    hospitalId: user.hospital_id,
    ...(doctorId && { doctorId }),
  };

  // 5) Sign tokens
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  // 6) Store hashed refresh token in DB + audit LOGIN atomically
  const refreshTokenHash = await hashPassword(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await authRepo.createRefreshToken(
    user.user_id,
    refreshTokenHash,
    expiresAt,
    { user_id: user.user_id, action: 'LOGIN', entity: 'USER' },
  );

  return {
    accessToken,
    refreshToken,
    user: {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      hospital_id: user.hospital_id,
      ...(doctorId && { doctor_id: doctorId }),
    },
  };
}

/**
 * Refresh the access token using a valid refresh token.
 *
 * Business rules:
 * - Verify the refresh token JWT signature
 * - Find a matching hashed token in the DB
 * - Check the token hasn't expired
 * - Rotate: delete old token, issue new pair
 *
 * @param oldRefreshToken - The refresh token from the httpOnly cookie.
 * @returns New access token and new refresh token.
 */
export async function refreshToken(oldRefreshToken: string): Promise<RefreshResult> {
  // 1) Verify the JWT signature
  let decoded;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  // 2) Find all refresh tokens for this user and check for a match
  const storedTokens = await authRepo.findRefreshTokensByUserId(decoded.userId);
  if (storedTokens.length === 0) {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  // 3) Find the matching token by comparing hashes
  let matchedToken = null;
  for (const stored of storedTokens) {
    const isMatch = await comparePassword(oldRefreshToken, stored.token_hash);
    if (isMatch) {
      matchedToken = stored;
      break;
    }
  }

  if (!matchedToken) {
    throw new AppError('Invalid or expired refresh token.', 401);
  }

  // 4) Check if the stored token has expired
  if (new Date() > matchedToken.expires_at) {
    await authRepo.deleteRefreshToken(matchedToken.token_id);
    throw new AppError('Refresh token has expired. Please login again.', 401);
  }

  // 5) Delete the old token (rotation)
  await authRepo.deleteRefreshToken(matchedToken.token_id);

  // 6) Issue new token pair
  const tokenPayload = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
    hospitalId: decoded.hospitalId,
  };

  const newAccessToken = signAccessToken(tokenPayload);
  const newRefreshToken = signRefreshToken(tokenPayload);

  // 7) Store new hashed refresh token
  const newTokenHash = await hashPassword(newRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await authRepo.createRefreshToken(decoded.userId, newTokenHash, expiresAt);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout a user by invalidating their refresh token.
 *
 * @param oldRefreshToken - The refresh token from the httpOnly cookie.
 * @param userId - The authenticated user's ID (from JWT).
 */
export async function logout(oldRefreshToken: string, userId: string): Promise<void> {
  // Find and delete the matching refresh token
  const storedTokens = await authRepo.findRefreshTokensByUserId(userId);

  for (const stored of storedTokens) {
    const isMatch = await comparePassword(oldRefreshToken, stored.token_hash);
    if (isMatch) {
      await authRepo.deleteRefreshToken(stored.token_id);
      break;
    }
  }

  // LOGOUT is logged regardless of whether a matching token was found.
  await writeAuditLog({ user_id: userId, action: 'LOGOUT', entity: 'USER', entity_id: userId });
}

/**
 * Get the current authenticated user's details.
 *
 * @param userId - The authenticated user's ID (from JWT).
 * @returns User details (excluding password hash).
 */
export async function getMe(userId: string) {
  const user = await authRepo.findUserById(userId);
  if (!user) {
    throw new AppError('User not found.', 404);
  }
  return user;
}
