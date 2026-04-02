// ──────────────────────────────────────────────────────────────────────────────
// Admin Service — business logic for role and user management.
//
// RULES:
// - Only Super Admin can manage roles
// - Super Admin + Hospital Admin can manage users (within their hospital)
// - Default roles (Super Admin, Hospital Admin, etc.) cannot be deleted
// - Cannot delete a role that has users assigned to it
// - Passwords are always hashed before storage
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import { hashPassword } from '../../utils/password.util';
import * as adminRepo from './admin.repository';
import type {
  CreateRoleInput,
  UpdateRoleInput,
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
} from './admin.validation';

// Default (system) roles that cannot be deleted or renamed
const PROTECTED_ROLES = ['Super Admin', 'Hospital Admin', 'Receptionist', 'Doctor', 'Accountant'];

// ── Permissions ──────────────────────────────────────────────────────────────

export async function getAllPermissions() {
  return adminRepo.getAllPermissions();
}

// ── Roles ────────────────────────────────────────────────────────────────────

export async function getAllRoles() {
  const roles = await adminRepo.getAllRoles();

  return roles.map((role) => ({
    role_id: role.role_id,
    name: role.name,
    is_system_role: PROTECTED_ROLES.includes(role.name),
    user_count: role._count.users,
    permissions: role.role_permissions.map((rp) => ({
      permission_id: rp.permission.permission_id,
      name: rp.permission.name,
    })),
  }));
}

export async function getRoleById(roleId: number) {
  const role = await adminRepo.getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
  }

  return {
    role_id: role.role_id,
    name: role.name,
    is_system_role: PROTECTED_ROLES.includes(role.name),
    user_count: role._count.users,
    permissions: role.role_permissions.map((rp) => ({
      permission_id: rp.permission.permission_id,
      name: rp.permission.name,
    })),
  };
}

export async function createRole(input: CreateRoleInput, userId: string) {
  // Check name uniqueness
  const existing = await adminRepo.findRoleByName(input.name);
  if (existing) {
    throw new AppError(
      `Role '${input.name}' already exists.`,
      409,
      'ROLE_NAME_EXISTS',
    );
  }

  // Validate permission IDs exist
  const allPermissions = await adminRepo.getAllPermissions();
  const validIds = new Set(allPermissions.map((p) => p.permission_id));
  const invalidIds = input.permission_ids.filter((id) => !validIds.has(id));
  if (invalidIds.length > 0) {
    throw new AppError(
      `Invalid permission IDs: ${invalidIds.join(', ')}`,
      400,
      'INVALID_PERMISSION_IDS',
    );
  }

  const role = await adminRepo.createRole(input.name, input.permission_ids);

  await adminRepo.createAuditLog(userId, 'CREATE_ROLE', 'roles', String(role?.role_id));

  return role
    ? {
        role_id: role.role_id,
        name: role.name,
        is_system_role: false,
        user_count: role._count.users,
        permissions: role.role_permissions.map((rp) => ({
          permission_id: rp.permission.permission_id,
          name: rp.permission.name,
        })),
      }
    : null;
}

export async function updateRole(roleId: number, input: UpdateRoleInput, userId: string) {
  const role = await adminRepo.getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
  }

  // Prevent renaming system roles
  if (input.name && PROTECTED_ROLES.includes(role.name)) {
    throw new AppError(
      `Cannot rename the system role '${role.name}'.`,
      403,
      'CANNOT_MODIFY_SYSTEM_ROLE',
    );
  }

  // Check new name uniqueness (if changing)
  if (input.name && input.name !== role.name) {
    const existing = await adminRepo.findRoleByName(input.name);
    if (existing) {
      throw new AppError(`Role '${input.name}' already exists.`, 409, 'ROLE_NAME_EXISTS');
    }
  }

  // Validate permission IDs if provided
  if (input.permission_ids) {
    const allPermissions = await adminRepo.getAllPermissions();
    const validIds = new Set(allPermissions.map((p) => p.permission_id));
    const invalidIds = input.permission_ids.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw new AppError(
        `Invalid permission IDs: ${invalidIds.join(', ')}`,
        400,
        'INVALID_PERMISSION_IDS',
      );
    }
  }

  const updated = await adminRepo.updateRole(roleId, {
    name: input.name,
    permissionIds: input.permission_ids,
  });

  await adminRepo.createAuditLog(userId, 'UPDATE_ROLE', 'roles', String(roleId));

  return updated
    ? {
        role_id: updated.role_id,
        name: updated.name,
        is_system_role: PROTECTED_ROLES.includes(updated.name),
        user_count: updated._count.users,
        permissions: updated.role_permissions.map((rp) => ({
          permission_id: rp.permission.permission_id,
          name: rp.permission.name,
        })),
      }
    : null;
}

export async function deleteRole(roleId: number, userId: string) {
  const role = await adminRepo.getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
  }

  // Prevent deleting system roles
  if (PROTECTED_ROLES.includes(role.name)) {
    throw new AppError(
      `Cannot delete the system role '${role.name}'.`,
      403,
      'CANNOT_DELETE_SYSTEM_ROLE',
    );
  }

  // Prevent deleting roles with assigned users
  const userCount = await adminRepo.countUsersWithRole(roleId);
  if (userCount > 0) {
    throw new AppError(
      `Cannot delete role '${role.name}' — ${userCount} user(s) are still assigned to it. Reassign them first.`,
      409,
      'ROLE_HAS_USERS',
    );
  }

  await adminRepo.deleteRole(roleId);
  await adminRepo.createAuditLog(userId, 'DELETE_ROLE', 'roles', String(roleId));
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function listUsers(hospitalId: string, query: ListUsersQuery) {
  return adminRepo.getUsers(hospitalId, query);
}

export async function getUserById(userId: string, hospitalId: string) {
  const user = await adminRepo.getUserById(userId, hospitalId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  return {
    ...user,
    role: {
      role_id: user.role.role_id,
      name: user.role.name,
      permissions: user.role.role_permissions.map((rp) => ({
        permission_id: rp.permission.permission_id,
        name: rp.permission.name,
      })),
    },
  };
}

export async function createUser(input: CreateUserInput, hospitalId: string, actorUserId: string) {
  // Check email uniqueness
  const existingUser = await adminRepo.findUserByEmail(input.email);
  if (existingUser) {
    throw new AppError(
      'A user with this email already exists.',
      409,
      'EMAIL_ALREADY_EXISTS',
    );
  }

  // Verify role exists
  const role = await adminRepo.getRoleById(input.role_id);
  if (!role) {
    throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  const user = await adminRepo.createUser({
    hospital_id: hospitalId,
    role_id: input.role_id,
    name: input.name,
    email: input.email,
    password_hash: passwordHash,
  });

  await adminRepo.createAuditLog(actorUserId, 'CREATE_USER', 'users', user.user_id);

  return user;
}

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  hospitalId: string,
  actorUserId: string,
) {
  // Verify user exists in this hospital
  const user = await adminRepo.getUserById(userId, hospitalId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  // If changing email, check uniqueness
  if (input.email && input.email !== user.email) {
    const existing = await adminRepo.findUserByEmail(input.email);
    if (existing) {
      throw new AppError('A user with this email already exists.', 409, 'EMAIL_ALREADY_EXISTS');
    }
  }

  // If changing role, verify it exists
  if (input.role_id) {
    const role = await adminRepo.getRoleById(input.role_id);
    if (!role) {
      throw new AppError('Role not found.', 404, 'ROLE_NOT_FOUND');
    }
  }

  const updateData: Record<string, unknown> = {};
  if (input.name) updateData['name'] = input.name;
  if (input.email) updateData['email'] = input.email;
  if (input.role_id) updateData['role_id'] = input.role_id;

  const updated = await adminRepo.updateUser(userId, updateData as {
    name?: string;
    email?: string;
    role_id?: number;
  });

  await adminRepo.createAuditLog(actorUserId, 'UPDATE_USER', 'users', userId);

  return updated;
}

export async function updateUserStatus(
  userId: string,
  status: string,
  hospitalId: string,
  actorUserId: string,
) {
  const user = await adminRepo.getUserById(userId, hospitalId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  // Prevent self-deactivation
  if (userId === actorUserId && status === 'INACTIVE') {
    throw new AppError('You cannot deactivate your own account.', 403, 'CANNOT_DEACTIVATE_SELF');
  }

  const updated = await adminRepo.updateUserStatus(userId, status);

  await adminRepo.createAuditLog(actorUserId, `USER_${status}`, 'users', userId);

  return updated;
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
  hospitalId: string,
  actorUserId: string,
) {
  const user = await adminRepo.getUserById(userId, hospitalId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const passwordHash = await hashPassword(newPassword);
  await adminRepo.updateUserPassword(userId, passwordHash);

  await adminRepo.createAuditLog(actorUserId, 'RESET_USER_PASSWORD', 'users', userId);
}
