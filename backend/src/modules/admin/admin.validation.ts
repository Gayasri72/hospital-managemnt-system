// ──────────────────────────────────────────────────────────────────────────────
// Admin Validation — Zod schemas for role and user management endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Params ───────────────────────────────────────────────────────────────────

export const roleIdParamSchema = z.object({
  id: z.coerce.number().int().positive('Invalid role ID'),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

// ── POST /api/v1/roles ───────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z
    .string({ required_error: 'Role name is required' })
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must be 50 characters or less'),
  permission_ids: z
    .array(z.number().int().positive(), {
      required_error: 'Permission IDs are required',
    })
    .min(1, 'At least one permission is required'),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// ── PUT /api/v1/roles/:id ────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must be 50 characters or less')
    .optional(),
  permission_ids: z
    .array(z.number().int().positive())
    .min(1, 'At least one permission is required')
    .optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ── POST /api/v1/users ───────────────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
  role_id: z
    .number({ required_error: 'Role ID is required', invalid_type_error: 'Role ID must be a number' })
    .int()
    .positive(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ── PUT /api/v1/users/:id ────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .optional(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .optional(),
  role_id: z
    .number({ invalid_type_error: 'Role ID must be a number' })
    .int()
    .positive()
    .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ── PATCH /api/v1/users/:id/status ───────────────────────────────────────────

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    errorMap: () => ({ message: 'Status must be ACTIVE or INACTIVE' }),
  }),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// ── PATCH /api/v1/users/:id/password ─────────────────────────────────────────

export const resetPasswordSchema = z.object({
  new_password: z
    .string({ required_error: 'New password is required' })
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ── GET /api/v1/users ────────────────────────────────────────────────────────

export const listUsersQuerySchema = z.object({
  search: z.string().optional(),
  role_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
