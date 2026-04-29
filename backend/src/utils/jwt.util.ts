// ──────────────────────────────────────────────────────────────────────────────
// JWT Utilities — sign and verify access & refresh tokens.
//
// Access token:  short-lived (15m), signed with JWT_SECRET
// Refresh token: long-lived (7d), signed with JWT_REFRESH_SECRET
// ──────────────────────────────────────────────────────────────────────────────

import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config/index';
import type { JwtPayload } from '../types/index';

/** Payload shape used when signing tokens (excludes iat/exp — JWT adds those). */
interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  hospitalId: string;
  doctorId?: string;
}

/**
 * Sign a short-lived access token (15 minutes).
 * @param payload - User claims to embed in the token.
 * @returns Signed JWT string.
 */
export function signAccessToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: config.jwt.expiresIn as string & jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.secret, options);
}

/**
 * Sign a long-lived refresh token (7 days).
 * @param payload - User claims to embed in the token.
 * @returns Signed JWT string.
 */
export function signRefreshToken(payload: TokenPayload): string {
  const options: SignOptions = { expiresIn: config.jwt.refreshExpiresIn as string & jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
}

/**
 * Verify and decode an access token.
 * @param token - The JWT string to verify.
 * @returns Decoded payload.
 * @throws JsonWebTokenError if invalid or expired.
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

/**
 * Verify and decode a refresh token.
 * @param token - The JWT string to verify.
 * @returns Decoded payload.
 * @throws JsonWebTokenError if invalid or expired.
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
}
