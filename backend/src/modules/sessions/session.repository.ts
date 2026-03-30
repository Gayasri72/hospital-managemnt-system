// ──────────────────────────────────────────────────────────────────────────────
// Session Repository — all database queries for session management.
//
// Includes the critical incrementBookedCount with SELECT FOR UPDATE
// to prevent race conditions during concurrent bookings.
//
// IMPORTANT: All queries scoped by hospital_id.
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';
import type { SlotData } from './slot.util';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreateSessionData {
  doctor_id: string;
  branch_id: string;
  hospital_id: string;
  session_date: Date;
  start_time: string;
  end_time: string;
  slot_duration: number;
  max_patients: number;
  created_by: string;
}

// ── Session CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a session + all its slots in a single transaction.
 */
export async function createSessionWithSlots(
  sessionData: CreateSessionData,
  slots: SlotData[],
) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.channelSession.create({
      data: {
        doctor_id: sessionData.doctor_id,
        branch_id: sessionData.branch_id,
        hospital_id: sessionData.hospital_id,
        session_date: sessionData.session_date,
        start_time: sessionData.start_time,
        end_time: sessionData.end_time,
        slot_duration: sessionData.slot_duration,
        max_patients: sessionData.max_patients,
        created_by: sessionData.created_by,
      },
    });

    // Bulk insert slots (use session.session_id, not the placeholder from slot.util)
    const createdSlots = await Promise.all(
      slots.map((slot) =>
        tx.sessionSlot.create({
          data: {
            session_id: session.session_id,
            slot_number: slot.slot_number,
            slot_time: slot.slot_time,
            is_booked: false,
          },
        }),
      ),
    );

    return { ...session, slots: createdSlots };
  });
}

/**
 * Find sessions by hospital with filters and pagination.
 */
export async function findByHospital(
  hospitalId: string,
  options: {
    doctor_id?: string;
    branch_id?: string;
    date?: string;
    from?: string;
    to?: string;
    status?: string;
    page: number;
    limit: number;
  },
) {
  const { doctor_id, branch_id, date, from, to, status, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { hospital_id: hospitalId };

  if (doctor_id) where['doctor_id'] = doctor_id;
  if (branch_id) where['branch_id'] = branch_id;
  if (status) where['status'] = status;

  if (date) {
    where['session_date'] = new Date(date);
  } else if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter['gte'] = new Date(from);
    if (to) dateFilter['lte'] = new Date(to);
    where['session_date'] = dateFilter;
  }

  const [data, total] = await Promise.all([
    prisma.channelSession.findMany({
      where,
      include: {
        doctor: { select: { name: true, specialization: true } },
        branch: { select: { name: true, location: true } },
      },
      skip,
      take: limit,
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
    }),
    prisma.channelSession.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Find a single session by ID — scoped to hospital_id.
 * Includes doctor, branch, and all slots.
 */
export async function findByIdInHospital(sessionId: string, hospitalId: string) {
  return prisma.channelSession.findFirst({
    where: {
      session_id: sessionId,
      hospital_id: hospitalId,
    },
    include: {
      doctor: { select: { name: true, specialization: true, hospital_id: true } },
      branch: { select: { name: true, location: true, hospital_id: true } },
      slots: { orderBy: { slot_number: 'asc' } },
    },
  });
}

/**
 * Find a session by ID without hospital scoping (for internal use).
 */
export async function findById(sessionId: string) {
  return prisma.channelSession.findUnique({
    where: { session_id: sessionId },
    include: { slots: { orderBy: { slot_number: 'asc' } } },
  });
}

/**
 * Update session fields.
 */
export async function updateSession(
  sessionId: string,
  data: Record<string, unknown>,
) {
  return prisma.channelSession.update({
    where: { session_id: sessionId },
    data,
    include: {
      doctor: { select: { name: true, specialization: true } },
      branch: { select: { name: true, location: true } },
      slots: { orderBy: { slot_number: 'asc' } },
    },
  });
}

/**
 * Delete session + slots in a transaction.
 */
export async function deleteSessionWithSlots(sessionId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.sessionSlot.deleteMany({ where: { session_id: sessionId } });
    await tx.channelSession.delete({ where: { session_id: sessionId } });
  });
}

/**
 * Delete existing slots and regenerate for a session.
 */
export async function regenerateSlots(sessionId: string, slots: SlotData[]) {
  return prisma.$transaction(async (tx) => {
    await tx.sessionSlot.deleteMany({ where: { session_id: sessionId } });

    const created = await Promise.all(
      slots.map((slot) =>
        tx.sessionSlot.create({
          data: {
            session_id: sessionId,
            slot_number: slot.slot_number,
            slot_time: slot.slot_time,
            is_booked: false,
          },
        }),
      ),
    );

    return created;
  });
}

// ── Overlap Detection ────────────────────────────────────────────────────────

/**
 * Check for overlapping sessions for the same doctor on the same date.
 * Uses time comparison since PostgreSQL TIME OVERLAPS isn't available in Prisma.
 */
export async function findOverlappingSessions(
  doctorId: string,
  sessionDate: Date,
  startTime: string,
  endTime: string,
  excludeSessionId?: string,
) {
  const where: Record<string, unknown> = {
    doctor_id: doctorId,
    session_date: sessionDate,
    status: { not: 'cancelled' },
    // Time overlap: existing.start < new.end AND existing.end > new.start
    start_time: { lt: endTime },
    end_time: { gt: startTime },
  };

  if (excludeSessionId) {
    where['session_id'] = { not: excludeSessionId };
  }

  return prisma.channelSession.findMany({ where });
}

// ── Doctor Exception Check ───────────────────────────────────────────────────

/**
 * Check if a doctor has an exception on a specific date.
 */
export async function findDoctorExceptionOnDate(doctorId: string, date: Date) {
  return prisma.doctorException.findFirst({
    where: {
      doctor_id: doctorId,
      exception_date: date,
    },
  });
}

/**
 * Check if a doctor has availability for a specific day of week.
 */
export async function findDoctorAvailabilityForDay(doctorId: string, dayOfWeek: string) {
  return prisma.doctorAvailability.findFirst({
    where: {
      doctor_id: doctorId,
      day_of_week: dayOfWeek,
    },
  });
}

// ── Branch Validation ────────────────────────────────────────────────────────

/**
 * Find a branch by ID — check it belongs to the hospital.
 */
export async function findBranchInHospital(branchId: string, hospitalId: string) {
  return prisma.branch.findFirst({
    where: {
      branch_id: branchId,
      hospital_id: hospitalId,
    },
  });
}

/**
 * Find a doctor by ID — check they belong to the hospital.
 */
export async function findDoctorInHospital(doctorId: string, hospitalId: string) {
  return prisma.doctor.findFirst({
    where: {
      doctor_id: doctorId,
      hospital_id: hospitalId,
    },
  });
}

// ── Available Sessions ───────────────────────────────────────────────────────

/**
 * Find available sessions (open, not full, future date).
 */
export async function findAvailableSessions(
  hospitalId: string,
  options: {
    doctor_id?: string;
    specialization?: string;
    date?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  },
) {
  const { doctor_id, specialization, date, from, to, page, limit } = options;
  const skip = (page - 1) * limit;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: Record<string, unknown> = {
    hospital_id: hospitalId,
    status: 'open',
    session_date: { gte: today },
  };

  if (doctor_id) where['doctor_id'] = doctor_id;

  if (date) {
    where['session_date'] = new Date(date);
  } else if (from || to) {
    const dateFilter: Record<string, Date> = { gte: today };
    if (from && new Date(from) > today) dateFilter['gte'] = new Date(from);
    if (to) dateFilter['lte'] = new Date(to);
    where['session_date'] = dateFilter;
  }

  // Specialization filter via nested doctor relation
  if (specialization) {
    where['doctor'] = { specialization };
  }

  const [data] = await Promise.all([
    prisma.channelSession.findMany({
      where,
      include: {
        doctor: { select: { name: true, specialization: true } },
        branch: { select: { name: true, location: true } },
      },
      skip,
      take: limit,
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
    }),
    prisma.channelSession.count({ where }),
  ]);

  // Filter out full sessions in application layer
  const available = data.filter((s: { booked_count: number; max_patients: number }) => s.booked_count < s.max_patients);

  return { data: available, total: available.length, page, limit };
}

// ── Doctor Sessions ──────────────────────────────────────────────────────────

/**
 * Find all sessions for a specific doctor.
 */
export async function findDoctorSessions(
  doctorId: string,
  hospitalId: string,
  options: { from?: string; to?: string; status?: string },
) {
  const where: Record<string, unknown> = {
    doctor_id: doctorId,
    hospital_id: hospitalId,
  };

  if (options.status) where['status'] = options.status;

  if (options.from || options.to) {
    const dateFilter: Record<string, Date> = {};
    if (options.from) dateFilter['gte'] = new Date(options.from);
    if (options.to) dateFilter['lte'] = new Date(options.to);
    where['session_date'] = dateFilter;
  }

  return prisma.channelSession.findMany({
    where,
    include: {
      branch: { select: { name: true, location: true } },
    },
    orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
  });
}

// ── Slots ────────────────────────────────────────────────────────────────────

/**
 * Get all slots for a session.
 */
export async function getSessionSlots(sessionId: string) {
  return prisma.sessionSlot.findMany({
    where: { session_id: sessionId },
    orderBy: { slot_number: 'asc' },
  });
}

// ── Booking Counter (Race-Condition Safe) ────────────────────────────────────

/**
 * Increment booked_count atomically with SELECT FOR UPDATE.
 * This prevents two concurrent bookings from exceeding max_patients.
 *
 * Uses raw SQL because Prisma doesn't support SELECT FOR UPDATE natively.
 *
 * Returns the booked slot's new count and whether the session became full.
 */
export async function incrementBookedCount(sessionId: string) {
  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE — locks this row until transaction commits
    const rows = await tx.$queryRawUnsafe<
      Array<{ session_id: string; booked_count: number; max_patients: number; status: string }>
    >(
      `SELECT session_id, booked_count, max_patients, status
       FROM channel_sessions
       WHERE session_id = $1
       FOR UPDATE`,
      sessionId,
    );

    if (rows.length === 0) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const session = rows[0]!;

    if (session.status !== 'open') {
      throw new Error('SESSION_NOT_AVAILABLE');
    }

    if (session.booked_count >= session.max_patients) {
      throw new Error('SESSION_FULL');
    }

    const newCount = session.booked_count + 1;
    const becameFull = newCount >= session.max_patients;

    // Atomic update with conditional status change
    await tx.$queryRawUnsafe(
      `UPDATE channel_sessions
       SET booked_count = $1,
           status = CASE WHEN $1 >= max_patients THEN 'full' ELSE status END
       WHERE session_id = $2`,
      newCount,
      sessionId,
    );

    return { newCount, becameFull };
  });
}

/**
 * Decrement booked_count (for appointment cancellation).
 * If session was 'full', revert to 'open'.
 */
export async function decrementBookedCount(sessionId: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<
      Array<{ session_id: string; booked_count: number; status: string }>
    >(
      `SELECT session_id, booked_count, status
       FROM channel_sessions
       WHERE session_id = $1
       FOR UPDATE`,
      sessionId,
    );

    if (rows.length === 0) return;

    const session = rows[0]!;
    const newCount = Math.max(0, session.booked_count - 1);

    await tx.$queryRawUnsafe(
      `UPDATE channel_sessions
       SET booked_count = $1,
           status = CASE WHEN status = 'full' THEN 'open' ELSE status END
       WHERE session_id = $2`,
      newCount,
      sessionId,
    );

    return { newCount };
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
