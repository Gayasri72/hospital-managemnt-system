// ──────────────────────────────────────────────────────────────────────────────
// Admin Controller — HTTP handlers for role and user management.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/apiError';
import * as adminService from './admin.service';
import type {
  CreateRoleInput,
  UpdateRoleInput,
  CreateUserInput,
  UpdateUserInput,
  UpdateUserStatusInput,
  ResetPasswordInput,
  ListUsersQuery,
} from './admin.validation';

function requireUser(req: Request) {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return req.user;
}

// ── Permissions ──────────────────────────────────────────────────────────────

/** GET /api/v1/admin/permissions */
export const getAllPermissions = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const permissions = await adminService.getAllPermissions();
  sendSuccess({ res, message: 'Permissions retrieved successfully', data: permissions });
});

// ── Roles ────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/roles */
export const getAllRoles = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const roles = await adminService.getAllRoles();
  sendSuccess({ res, message: 'Roles retrieved successfully', data: roles });
});

/** GET /api/v1/admin/roles/:id */
export const getRoleById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const roleId = Number(req.params['id']);
  const role = await adminService.getRoleById(roleId);
  sendSuccess({ res, message: 'Role retrieved successfully', data: role });
});

/** POST /api/v1/admin/roles */
export const createRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const input = req.body as CreateRoleInput;
  const role = await adminService.createRole(input, user.userId);
  sendSuccess({ res, statusCode: 201, message: 'Role created successfully', data: role });
});

/** PUT /api/v1/admin/roles/:id */
export const updateRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const roleId = Number(req.params['id']);
  const input = req.body as UpdateRoleInput;
  const role = await adminService.updateRole(roleId, input, user.userId);
  sendSuccess({ res, message: 'Role updated successfully', data: role });
});

/** DELETE /api/v1/admin/roles/:id */
export const deleteRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const roleId = Number(req.params['id']);
  await adminService.deleteRole(roleId, user.userId);
  sendSuccess({ res, message: 'Role deleted successfully' });
});

// ── Users ────────────────────────────────────────────────────────────────────

/** GET /api/v1/admin/users */
export const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as ListUsersQuery;
  const result = await adminService.listUsers(user.hospitalId, query);
  sendSuccess({
    res,
    message: 'Users retrieved successfully',
    data: result.data,
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

/** GET /api/v1/admin/users/:id */
export const getUserById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const targetUserId = String(req.params['id']);
  const result = await adminService.getUserById(targetUserId, user.hospitalId);
  sendSuccess({ res, message: 'User retrieved successfully', data: result });
});

/** POST /api/v1/admin/users */
export const createUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const input = req.body as CreateUserInput;
  const newUser = await adminService.createUser(input, user.hospitalId, user.userId);
  sendSuccess({ res, statusCode: 201, message: 'User created successfully', data: newUser });
});

/** PUT /api/v1/admin/users/:id */
export const updateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const targetUserId = String(req.params['id']);
  const input = req.body as UpdateUserInput;
  const updated = await adminService.updateUser(targetUserId, input, user.hospitalId, user.userId);
  sendSuccess({ res, message: 'User updated successfully', data: updated });
});

/** PATCH /api/v1/admin/users/:id/status */
export const updateUserStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const targetUserId = String(req.params['id']);
  const { status } = req.body as UpdateUserStatusInput;
  const updated = await adminService.updateUserStatus(targetUserId, status, user.hospitalId, user.userId);
  sendSuccess({ res, message: `User ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`, data: updated });
});

/** PATCH /api/v1/admin/users/:id/password */
export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const targetUserId = String(req.params['id']);
  const { new_password } = req.body as ResetPasswordInput;
  await adminService.resetUserPassword(targetUserId, new_password, user.hospitalId, user.userId);
  sendSuccess({ res, message: 'Password reset successfully' });
});
