// ──────────────────────────────────────────────────────────────────────────────
// Patient Repository — all database queries for patient management.
//
// Only this file touches Prisma for patient-related data.
// No business logic here — just data access.
//
// IMPORTANT: All queries are scoped by hospital_id to enforce data isolation.
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreatePatientData {
  hospital_id: string;
  name: string;
  nic: string;
  phone: string;
  email?: string;
}

interface CreateProfileData {
  address?: string;
  emergency_contact?: string;
  gender?: string;
  age?: number;
}

interface UpdatePatientData {
  name?: string;
  phone?: string;
  email?: string;
}

interface UpdateProfileData {
  address?: string;
  emergency_contact?: string;
  gender?: string;
  age?: number;
}

// ── Queries ──────────────────────────────────────────────────────────────────

/**
 * Check if a NIC already exists within a specific hospital.
 * Returns true if a patient with this NIC exists in the given hospital.
 */
export async function existsByNicInHospital(hospitalId: string, nic: string): Promise<boolean> {
  const count = await prisma.patient.count({
    where: {
      hospital_id: hospitalId,
      nic,
    },
  });
  return count > 0;
}

/**
 * Create a patient AND their profile in a single transaction.
 * Returns the patient with the profile included.
 */
export async function createWithProfile(
  patientData: CreatePatientData,
  profileData: CreateProfileData,
) {
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.create({
      data: {
        hospital_id: patientData.hospital_id,
        name: patientData.name,
        nic: patientData.nic,
        phone: patientData.phone,
        email: patientData.email || null,
      },
    });

    const profile = await tx.patientProfile.create({
      data: {
        patient_id: patient.patient_id,
        address: profileData.address || null,
        emergency_contact: profileData.emergency_contact || null,
        gender: profileData.gender || null,
        age: profileData.age ?? null,
      },
    });

    return { ...patient, profile };
  });
}

/**
 * Find patients by hospital with search and pagination.
 * Search is case-insensitive across name, nic, and phone.
 */
export async function findByHospital(
  hospitalId: string,
  options: {
    search?: string;
    page: number;
    limit: number;
  },
) {
  const { search, page, limit } = options;
  const skip = (page - 1) * limit;

  // Build search filter (case-insensitive ILIKE via Prisma 'contains' + mode)
  const searchFilter = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { nic: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const where = {
    hospital_id: hospitalId,
    ...searchFilter,
  };

  const [data, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { profile: true },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.patient.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Find a single patient by ID — scoped to hospital_id.
 * Returns null if not found or belongs to another hospital.
 */
export async function findByIdInHospital(patientId: string, hospitalId: string) {
  return prisma.patient.findFirst({
    where: {
      patient_id: patientId,
      hospital_id: hospitalId,
    },
    include: { profile: true },
  });
}

/**
 * Update a patient AND their profile in a single transaction.
 */
export async function updateWithProfile(
  patientId: string,
  patientData: UpdatePatientData,
  profileData: UpdateProfileData,
) {
  return prisma.$transaction(async (tx) => {
    // Update patient (only non-undefined fields)
    const patient = await tx.patient.update({
      where: { patient_id: patientId },
      data: {
        ...(patientData.name !== undefined && { name: patientData.name }),
        ...(patientData.phone !== undefined && { phone: patientData.phone }),
        ...(patientData.email !== undefined && { email: patientData.email || null }),
      },
    });

    // Upsert profile (create if not exists, update if exists)
    const profile = await tx.patientProfile.upsert({
      where: { patient_id: patientId },
      create: {
        patient_id: patientId,
        address: profileData.address || null,
        emergency_contact: profileData.emergency_contact || null,
        gender: profileData.gender || null,
        age: profileData.age ?? null,
      },
      update: {
        ...(profileData.address !== undefined && { address: profileData.address || null }),
        ...(profileData.emergency_contact !== undefined && { emergency_contact: profileData.emergency_contact || null }),
        ...(profileData.gender !== undefined && { gender: profileData.gender || null }),
        ...(profileData.age !== undefined && { age: profileData.age ?? null }),
      },
    });

    return { ...patient, profile };
  });
}

/**
 * Find all appointments for a patient — scoped to hospital_id.
 */
export async function findAppointmentsByPatient(patientId: string, hospitalId: string) {
  return prisma.appointment.findMany({
    where: {
      patient_id: patientId,
      hospital_id: hospitalId,
    },
    orderBy: { created_at: 'desc' },
  });
}

/**
 * Write an entry to the audit log.
 */
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
