// ──────────────────────────────────────────────────────────────────────────────
// Admin Repository — database queries for roles, permissions, and users.
//
// RULES:
// - Users always scoped by hospital_id (except Super Admin viewing all)
// - Roles are system-wide (not hospital-scoped)
// - Permissions are system-wide and immutable from API (seeded only)
// - Role-permission assignments use the junction table
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';

// ── Permissions ──────────────────────────────────────────────────────────────

/**
 * Get all available permissions in the system.
 */
export async function getAllPermissions() {
  return prisma.permission.findMany({
    orderBy: { permission_id: 'asc' },
  });
}

// ── Roles ────────────────────────────────────────────────────────────────────

/**
 * Get all roles with their assigned permissions.
 */
export async function getAllRoles() {
  return prisma.role.findMany({
    include: {
      role_permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
    orderBy: { role_id: 'asc' },
  });
}

/**
 * Get a single role by ID with permissions.
 */
export async function getRoleById(roleId: number) {
  return prisma.role.findUnique({
    where: { role_id: roleId },
    include: {
      role_permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
  });
}

/**
 * Check if a role name already exists.
 */
export async function findRoleByName(name: string) {
  return prisma.role.findUnique({
    where: { name },
    select: { role_id: true, name: true },
  });
}

/**
 * Create a new role and assign permissions — all in one transaction.
 */
export async function createRole(name: string, permissionIds: number[]) {
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { name },
    });

    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((pid) => ({
          role_id: role.role_id,
          permission_id: pid,
        })),
      });
    }

    return tx.role.findUnique({
      where: { role_id: role.role_id },
      include: {
        role_permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });
  });
}

/**
 * Update a role name and/or permissions.
 * Replaces ALL permissions (delete old + insert new).
 */
export async function updateRole(
  roleId: number,
  data: { name?: string; permissionIds?: number[] },
) {
  return prisma.$transaction(async (tx) => {
    // Update role name if provided
    if (data.name) {
      await tx.role.update({
        where: { role_id: roleId },
        data: { name: data.name },
      });
    }

    // Replace permissions if provided
    if (data.permissionIds !== undefined) {
      // Remove all existing permissions
      await tx.rolePermission.deleteMany({
        where: { role_id: roleId },
      });

      // Insert new permissions
      if (data.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permissionIds.map((pid) => ({
            role_id: roleId,
            permission_id: pid,
          })),
        });
      }
    }

    return tx.role.findUnique({
      where: { role_id: roleId },
      include: {
        role_permissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });
  });
}

/**
 * Delete a role.
 */
export async function deleteRole(roleId: number) {
  return prisma.role.delete({
    where: { role_id: roleId },
  });
}

/**
 * Count users assigned to a role.
 */
export async function countUsersWithRole(roleId: number) {
  return prisma.user.count({
    where: { role_id: roleId },
  });
}

// ── Users ────────────────────────────────────────────────────────────────────

/**
 * List users with filters and pagination.
 * Scoped by hospital_id.
 */
export async function getUsers(
  hospitalId: string,
  options: {
    search?: string;
    role_id?: number;
    status?: string;
    page: number;
    limit: number;
  },
) {
  const { search, role_id, status, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { hospital_id: hospitalId };

  if (role_id) where['role_id'] = role_id;
  if (status) where['status'] = status;

  if (search) {
    where['OR'] = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        user_id: true,
        name: true,
        email: true,
        status: true,
        created_at: true,
        role: { select: { role_id: true, name: true } },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Get a single user by ID within a hospital.
 */
export async function getUserById(userId: string, hospitalId: string) {
  return prisma.user.findFirst({
    where: { user_id: userId, hospital_id: hospitalId },
    select: {
      user_id: true,
      name: true,
      email: true,
      status: true,
      hospital_id: true,
      created_at: true,
      role: {
        select: {
          role_id: true,
          name: true,
          role_permissions: {
            include: { permission: true },
          },
        },
      },
      hospital: { select: { name: true } },
    },
  });
}

/**
 * Check if email is already taken.
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { user_id: true, email: true },
  });
}

/**
 * Create a new user.
 */
export async function createUser(data: {
  hospital_id: string;
  role_id: number;
  name: string;
  email: string;
  password_hash: string;
}) {
  return prisma.user.create({
    data: {
      hospital_id: data.hospital_id,
      role_id: data.role_id,
      name: data.name,
      email: data.email,
      password_hash: data.password_hash,
      status: 'ACTIVE',
    },
    select: {
      user_id: true,
      name: true,
      email: true,
      status: true,
      created_at: true,
      role: { select: { role_id: true, name: true } },
      hospital: { select: { name: true } },
    },
  });
}

/**
 * Update user details (name, email, role).
 */
export async function updateUser(
  userId: string,
  data: { name?: string; email?: string; role_id?: number },
) {
  return prisma.user.update({
    where: { user_id: userId },
    data,
    select: {
      user_id: true,
      name: true,
      email: true,
      status: true,
      created_at: true,
      role: { select: { role_id: true, name: true } },
    },
  });
}

/**
 * Update user status (ACTIVE/INACTIVE).
 */
export async function updateUserStatus(userId: string, status: string) {
  return prisma.user.update({
    where: { user_id: userId },
    data: { status: status as 'ACTIVE' | 'INACTIVE' },
    select: {
      user_id: true,
      name: true,
      email: true,
      status: true,
      role: { select: { role_id: true, name: true } },
    },
  });
}

/**
 * Reset user's password.
 */
export async function updateUserPassword(userId: string, passwordHash: string) {
  return prisma.user.update({
    where: { user_id: userId },
    data: { password_hash: passwordHash },
    select: { user_id: true },
  });
}

// ── Audit Log ────────────────────────────────────────────────────────────────

export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
) {
  return prisma.auditLog.create({
    data: {
      user_id: userId,
      action,
      entity,
      entity_id: entityId ?? null,
    },
  });
}
