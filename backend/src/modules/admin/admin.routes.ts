// ──────────────────────────────────────────────────────────────────────────────
// Admin Routes — role management, user management, permissions.
//
// Mounted at: /api/v1/admin
//
// Access control:
//   - Permissions:   Super Admin only
//   - Roles:         Super Admin only (create, update, delete)
//   - Users:         Super Admin + Hospital Admin
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  resetPasswordSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from './admin.validation';
import * as ctrl from './admin.controller';

const router = Router();
router.use(authenticate);

// ── Permissions ──────────────────────────────────────────────────────────────

// GET /api/v1/admin/permissions — list all available permissions
router.get(
  '/permissions',
  authorize('Super Admin'),
  ctrl.getAllPermissions,
);

// ── Roles ────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/roles — list all roles with permissions
router.get(
  '/roles',
  authorize('Super Admin', 'Hospital Admin'),
  ctrl.getAllRoles,
);

// GET /api/v1/admin/roles/:id — get single role details
router.get(
  '/roles/:id',
  authorize('Super Admin'),
  validate({ params: roleIdParamSchema }),
  ctrl.getRoleById,
);

// POST /api/v1/admin/roles — create custom role with permissions
router.post(
  '/roles',
  authorize('Super Admin'),
  validate({ body: createRoleSchema }),
  ctrl.createRole,
);

// PUT /api/v1/admin/roles/:id — update role name and/or permissions
router.put(
  '/roles/:id',
  authorize('Super Admin'),
  validate({ params: roleIdParamSchema, body: updateRoleSchema }),
  ctrl.updateRole,
);

// DELETE /api/v1/admin/roles/:id — delete custom role
router.delete(
  '/roles/:id',
  authorize('Super Admin'),
  validate({ params: roleIdParamSchema }),
  ctrl.deleteRole,
);

// ── Users ────────────────────────────────────────────────────────────────────

// GET /api/v1/admin/users — list users (paginated)
router.get(
  '/users',
  authorize('Super Admin', 'Hospital Admin'),
  validate({ query: listUsersQuerySchema }),
  ctrl.listUsers,
);

// GET /api/v1/admin/users/:id — get user details
router.get(
  '/users/:id',
  authorize('Super Admin', 'Hospital Admin'),
  validate({ params: userIdParamSchema }),
  ctrl.getUserById,
);

// POST /api/v1/admin/users — create new user
router.post(
  '/users',
  authorize('Super Admin', 'Hospital Admin'),
  validate({ body: createUserSchema }),
  ctrl.createUser,
);

// PUT /api/v1/admin/users/:id — update user details
router.put(
  '/users/:id',
  authorize('Super Admin', 'Hospital Admin'),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  ctrl.updateUser,
);

// PATCH /api/v1/admin/users/:id/status — activate/deactivate
router.patch(
  '/users/:id/status',
  authorize('Super Admin', 'Hospital Admin'),
  validate({ params: userIdParamSchema, body: updateUserStatusSchema }),
  ctrl.updateUserStatus,
);

// PATCH /api/v1/admin/users/:id/password — reset user's password
router.patch(
  '/users/:id/password',
  authorize('Super Admin', 'Hospital Admin'),
  validate({ params: userIdParamSchema, body: resetPasswordSchema }),
  ctrl.resetPassword,
);

export default router;
