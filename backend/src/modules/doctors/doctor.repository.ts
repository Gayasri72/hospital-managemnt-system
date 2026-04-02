// ──────────────────────────────────────────────────────────────────────────────
// Doctor Repository — all database queries for doctor management.
//
// Only this file touches Prisma for doctor-related data.
// No business logic here — just data access.
//
// IMPORTANT: All queries are scoped by hospital_id to enforce data isolation.
// Fee/charge rows are NEVER updated — always INSERT new ones.
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';
import type { Decimal } from '@prisma/client/runtime/library';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateDoctorData {
  hospital_id: string;
  name: string;
  specialization: string;
}

interface CreateProfileData {
  contact_number?: string;
  email?: string;
  qualifications?: string;
  experience?: string;
  bio?: string;
}

interface CreateFeeData {
  doctor_id: string;
  hospital_id: string;
  consultation_fee: number;
  effective_from: Date;
}

interface UpdateDoctorData {
  name?: string;
  specialization?: string;
  status?: string;
}

interface UpdateProfileData {
  contact_number?: string;
  email?: string;
  qualifications?: string;
  experience?: string;
  bio?: string;
}

interface ScheduleItem {
  day_of_week: string;
  start_time: string;
  end_time: string;
}

// ── Doctor CRUD ──────────────────────────────────────────────────────────────

/**
 * Create doctor + profile + first fee record in a single transaction.
 */
export async function createWithProfileAndFee(
  doctorData: CreateDoctorData,
  profileData: CreateProfileData,
  feeData: Omit<CreateFeeData, 'doctor_id'>,
) {
  return prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.create({
      data: {
        hospital_id: doctorData.hospital_id,
        name: doctorData.name,
        specialization: doctorData.specialization,
      },
    });

    const profile = await tx.doctorProfile.create({
      data: {
        doctor_id: doctor.doctor_id,
        contact_number: profileData.contact_number || null,
        email: profileData.email || null,
        qualifications: profileData.qualifications || null,
        experience: profileData.experience || null,
        bio: profileData.bio || null,
      },
    });

    const fee = await tx.doctorFee.create({
      data: {
        doctor_id: doctor.doctor_id,
        hospital_id: feeData.hospital_id,
        consultation_fee: feeData.consultation_fee,
        effective_from: feeData.effective_from,
      },
    });

    return { ...doctor, profile, currentFee: fee };
  });
}

/**
 * Find doctors by hospital with search, filters, and pagination.
 * Includes profile and current fee (most recent effective fee <= today).
 */
export async function findByHospital(
  hospitalId: string,
  options: {
    search?: string;
    specialization?: string;
    status: string;
    page: number;
    limit: number;
  },
) {
  const { search, specialization, status, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    hospital_id: hospitalId,
    status,
  };

  if (search) {
    where['name'] = { contains: search, mode: 'insensitive' };
  }
  if (specialization) {
    where['specialization'] = specialization;
  }

  const [data, total] = await Promise.all([
    prisma.doctor.findMany({
      where,
      include: { profile: true },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.doctor.count({ where }),
  ]);

  // Fetch current fee for each doctor
  const doctorIds = data.map((d) => d.doctor_id);
  const today = new Date();

  const fees = doctorIds.length > 0
    ? await prisma.doctorFee.findMany({
        where: {
          doctor_id: { in: doctorIds },
          effective_from: { lte: today },
        },
        orderBy: { effective_from: 'desc' },
      })
    : [];

  // Get latest fee per doctor
  const feeMap = new Map<string, { consultation_fee: Decimal; effective_from: Date }>();
  for (const fee of fees) {
    if (!feeMap.has(fee.doctor_id)) {
      feeMap.set(fee.doctor_id, {
        consultation_fee: fee.consultation_fee,
        effective_from: fee.effective_from,
      });
    }
  }

  const dataWithFees = data.map((doctor) => ({
    ...doctor,
    currentFee: feeMap.get(doctor.doctor_id) || null,
  }));

  return { data: dataWithFees, total, page, limit };
}

/**
 * Find a single doctor by ID — scoped to hospital_id.
 * Includes profile, availability, and upcoming exceptions.
 */
export async function findByIdInHospital(doctorId: string, hospitalId: string) {
  return prisma.doctor.findFirst({
    where: {
      doctor_id: doctorId,
      hospital_id: hospitalId,
    },
    include: {
      profile: true,
      availability: { orderBy: { day_of_week: 'asc' } },
      exceptions: {
        where: { exception_date: { gte: new Date() } },
        orderBy: { exception_date: 'asc' },
      },
    },
  });
}

/**
 * Update doctor + profile in a single transaction.
 */
export async function updateWithProfile(
  doctorId: string,
  doctorData: UpdateDoctorData,
  profileData: UpdateProfileData,
) {
  return prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.update({
      where: { doctor_id: doctorId },
      data: {
        ...(doctorData.name !== undefined && { name: doctorData.name }),
        ...(doctorData.specialization !== undefined && { specialization: doctorData.specialization }),
        ...(doctorData.status !== undefined && { status: doctorData.status }),
      },
    });

    const profile = await tx.doctorProfile.upsert({
      where: { doctor_id: doctorId },
      create: {
        doctor_id: doctorId,
        contact_number: profileData.contact_number || null,
        email: profileData.email || null,
        qualifications: profileData.qualifications || null,
        experience: profileData.experience || null,
        bio: profileData.bio || null,
      },
      update: {
        ...(profileData.contact_number !== undefined && { contact_number: profileData.contact_number || null }),
        ...(profileData.email !== undefined && { email: profileData.email || null }),
        ...(profileData.qualifications !== undefined && { qualifications: profileData.qualifications || null }),
        ...(profileData.experience !== undefined && { experience: profileData.experience || null }),
        ...(profileData.bio !== undefined && { bio: profileData.bio || null }),
      },
    });

    return { ...doctor, profile };
  });
}

// ── Fees ─────────────────────────────────────────────────────────────────────

/**
 * Get the current fee for a doctor (most recent effective fee <= today).
 */
export async function getCurrentFee(doctorId: string) {
  return prisma.doctorFee.findFirst({
    where: {
      doctor_id: doctorId,
      effective_from: { lte: new Date() },
    },
    orderBy: { effective_from: 'desc' },
  });
}

/**
 * Get the upcoming scheduled fee for a doctor (if any).
 */
export async function getUpcomingFee(doctorId: string) {
  return prisma.doctorFee.findFirst({
    where: {
      doctor_id: doctorId,
      effective_from: { gt: new Date() },
    },
    orderBy: { effective_from: 'asc' },
  });
}

/**
 * Insert a new fee record (never update old ones — preserves history).
 */
export async function createFee(data: CreateFeeData) {
  return prisma.doctorFee.create({
    data: {
      doctor_id: data.doctor_id,
      hospital_id: data.hospital_id,
      consultation_fee: data.consultation_fee,
      effective_from: data.effective_from,
    },
  });
}

/**
 * Get full fee history for a doctor.
 */
export async function getFeeHistory(doctorId: string) {
  return prisma.doctorFee.findMany({
    where: { doctor_id: doctorId },
    orderBy: { effective_from: 'desc' },
  });
}

// ── Hospital Charges ─────────────────────────────────────────────────────────

/**
 * Get the current hospital charge (most recent effective <= today).
 */
export async function getCurrentHospitalCharge(hospitalId: string) {
  return prisma.hospitalCharge.findFirst({
    where: {
      hospital_id: hospitalId,
      effective_from: { lte: new Date() },
    },
    orderBy: { effective_from: 'desc' },
  });
}

/**
 * Get the upcoming hospital charge (if any).
 */
export async function getUpcomingHospitalCharge(hospitalId: string) {
  return prisma.hospitalCharge.findFirst({
    where: {
      hospital_id: hospitalId,
      effective_from: { gt: new Date() },
    },
    orderBy: { effective_from: 'asc' },
  });
}

/**
 * Insert a new hospital charge row (never update old ones).
 */
export async function createHospitalCharge(
  hospitalId: string,
  chargeAmount: number,
  effectiveFrom: Date,
) {
  return prisma.hospitalCharge.create({
    data: {
      hospital_id: hospitalId,
      charge_amount: chargeAmount,
      effective_from: effectiveFrom,
    },
  });
}

// ── Availability ─────────────────────────────────────────────────────────────

/**
 * Replace entire availability schedule for a doctor in a transaction.
 * Deletes all existing rows, inserts new ones.
 */
export async function replaceAvailability(doctorId: string, schedule: ScheduleItem[]) {
  return prisma.$transaction(async (tx) => {
    await tx.doctorAvailability.deleteMany({
      where: { doctor_id: doctorId },
    });

    const created = await Promise.all(
      schedule.map((item) =>
        tx.doctorAvailability.create({
          data: {
            doctor_id: doctorId,
            day_of_week: item.day_of_week,
            start_time: item.start_time,
            end_time: item.end_time,
          },
        }),
      ),
    );

    return created;
  });
}

/**
 * Get full weekly schedule for a doctor.
 */
export async function getAvailability(doctorId: string) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const results = await prisma.doctorAvailability.findMany({
    where: { doctor_id: doctorId },
  });

  return results.sort(
    (a, b) => dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week),
  );
}

// ── Exceptions ───────────────────────────────────────────────────────────────

/**
 * Create a doctor exception (leave/unavailability).
 */
export async function createException(
  doctorId: string,
  exceptionDate: Date,
  reason?: string,
) {
  return prisma.doctorException.create({
    data: {
      doctor_id: doctorId,
      exception_date: exceptionDate,
      reason: reason || null,
    },
  });
}

/**
 * Get exceptions for a doctor within a date range.
 */
export async function getExceptions(
  doctorId: string,
  from: Date,
  to: Date,
) {
  return prisma.doctorException.findMany({
    where: {
      doctor_id: doctorId,
      exception_date: { gte: from, lte: to },
    },
    orderBy: { exception_date: 'asc' },
  });
}

/**
 * Find a specific exception by ID.
 */
export async function findExceptionById(exceptionId: string) {
  return prisma.doctorException.findUnique({
    where: { exception_id: exceptionId },
    include: { doctor: true },
  });
}

/**
 * Delete a specific exception.
 */
export async function deleteException(exceptionId: string) {
  return prisma.doctorException.delete({
    where: { exception_id: exceptionId },
  });
}

// ── Guard Queries ────────────────────────────────────────────────────────────

/**
 * Count future appointments for a doctor (for deactivation guard).
 */
export async function countFutureAppointments(doctorId: string) {
  return prisma.appointment.count({
    where: {
      doctor_id: doctorId,
      session: { session_date: { gt: new Date() } },
      status: { in: ['SCHEDULED', 'Booked', 'Confirmed', 'booked', 'confirmed'] },
    },
  });
}

/**
 * Count appointments for a doctor on a specific date (for exception guard).
 */
export async function countAppointmentsOnDate(doctorId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return prisma.appointment.count({
    where: {
      doctor_id: doctorId,
      session: { session_date: { gte: startOfDay, lte: endOfDay } },
      status: { in: ['SCHEDULED', 'Booked', 'Confirmed', 'booked', 'confirmed'] },
    },
  });
}

// ── Audit Log ────────────────────────────────────────────────────────────────

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
