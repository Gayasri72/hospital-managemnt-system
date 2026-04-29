// ──────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types and interfaces.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * JWT payload shape — extend as your User model grows.
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  hospitalId: string;
  doctorId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Augment the Express Request to include the decoded JWT user payload.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Pagination query parameters.
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
