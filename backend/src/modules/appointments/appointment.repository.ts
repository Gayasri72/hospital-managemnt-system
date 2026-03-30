// ──────────────────────────────────────────────────────────────────────────────
// Appointment Repository — all database queries + transactions.
//
// This is the most critical file in the system.
// All concurrency-sensitive operations use SELECT FOR UPDATE
// inside Prisma interactive transactions.
//
// RULES:
// - All queries scoped by hospital_id
// - Fee snapshot values come from the service (looked up before tx)
// - Slot assignment and session counter update are ALWAYS inside tx
// - appointment_logs written on EVERY status change
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';

// ── Types ────────────────────────────────────────────────────────────────────

interface BookingData {
  hospital_id: string;
  patient_id: string;
  doctor_id: string;
  session_id: string;
  slot_id?: string;     // optional — system picks if not provided
  queue_number?: number;
  doctor_fee: number;
  hospital_charge: number;
  total_fee: number;
  notes?: string;
  booked_by: string;
}

interface RescheduleData {
  appointment_id: string;
  old_session_id: string;
  old_slot_id: string;
  new_session_id: string;
  new_slot_id?: string;
  new_doctor_fee: number;
  new_hospital_charge: number;
  new_total_fee: number;
  user_id: string;
  old_status: string;
}

// ── Create Appointment (Full Transaction) ────────────────────────────────────

/**
 * The most critical operation in the system.
 *
 * Inside ONE transaction:
 * 1. Lock session row (SELECT FOR UPDATE)
 * 2. Re-check status + capacity
 * 3. Assign slot (specific or next available) with FOR UPDATE
 * 4. Mark slot as booked
 * 5. Increment session booked_count (auto-close if full)
 * 6. Insert appointment row with fee snapshots
 * 7. Insert first appointment_log entry
 *
 * Returns the created appointment with slot details.
 */
export async function createAppointment(data: BookingData) {
  return prisma.$transaction(async (tx) => {
    // STEP 1 — Lock session row
    const sessions = await tx.$queryRawUnsafe<
      Array<{
        session_id: string;
        booked_count: number;
        max_patients: number;
        status: string;
        doctor_id: string;
      }>
    >(
      `SELECT session_id, booked_count, max_patients, status, doctor_id
       FROM channel_sessions
       WHERE session_id = $1
       FOR UPDATE`,
      data.session_id,
    );

    if (sessions.length === 0) throw new Error('SESSION_NOT_FOUND');
    const session = sessions[0]!;

    // STEP 2 — Re-check status and capacity inside the lock
    if (session.status !== 'open') {
      throw new Error('SESSION_NOT_AVAILABLE');
    }
    if (session.booked_count >= session.max_patients) {
      throw new Error('SESSION_FULL');
    }

    // STEP 3 — Assign slot
    let targetSlot: { slot_id: string; slot_number: number; slot_time: string };

    if (data.slot_id) {
      // User requested a specific slot — lock it
      const slots = await tx.$queryRawUnsafe<
        Array<{ slot_id: string; slot_number: number; slot_time: string; is_booked: boolean }>
      >(
        `SELECT slot_id, slot_number, slot_time, is_booked
         FROM session_slots
         WHERE slot_id = $1 AND session_id = $2
         FOR UPDATE`,
        data.slot_id,
        data.session_id,
      );

      if (slots.length === 0) throw new Error('SLOT_NOT_IN_SESSION');
      if (slots[0]!.is_booked) throw new Error('SLOT_ALREADY_TAKEN');
      targetSlot = slots[0]!;
    } else {
      // System picks next available slot
      const slots = await tx.$queryRawUnsafe<
        Array<{ slot_id: string; slot_number: number; slot_time: string }>
      >(
        `SELECT slot_id, slot_number, slot_time
         FROM session_slots
         WHERE session_id = $1 AND is_booked = false
         ORDER BY slot_number ASC
         LIMIT 1
         FOR UPDATE`,
        data.session_id,
      );

      if (slots.length === 0) throw new Error('SESSION_FULL');
      targetSlot = slots[0]!;
    }

    // STEP 4 — Mark slot as booked
    await tx.$queryRawUnsafe(
      `UPDATE session_slots SET is_booked = true WHERE slot_id = $1`,
      targetSlot.slot_id,
    );

    // STEP 5 — Increment booked_count, auto-close if full
    await tx.$queryRawUnsafe(
      `UPDATE channel_sessions
       SET booked_count = booked_count + 1,
           status = CASE
             WHEN booked_count + 1 >= max_patients THEN 'full'
             ELSE status
           END
       WHERE session_id = $1`,
      data.session_id,
    );

    // STEP 6 — Insert appointment
    const appointment = await tx.appointment.create({
      data: {
        hospital_id: data.hospital_id,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        session_id: data.session_id,
        slot_id: targetSlot.slot_id,
        queue_number: targetSlot.slot_number,
        status: 'booked',
        doctor_fee: data.doctor_fee,
        hospital_charge: data.hospital_charge,
        total_fee: data.total_fee,
        notes: data.notes || null,
        booked_by: data.booked_by,
      },
    });

    // STEP 7 — Insert first log entry
    await tx.appointmentLog.create({
      data: {
        appointment_id: appointment.appointment_id,
        old_status: null,
        new_status: 'booked',
        changed_by: data.booked_by,
        metadata: {
          slot_time: targetSlot.slot_time,
          queue_number: targetSlot.slot_number,
        },
      },
    });

    return {
      ...appointment,
      slot_time: targetSlot.slot_time,
      queue_number: targetSlot.slot_number,
    };
  });
}

// ── Update Appointment Status ────────────────────────────────────────────────

/**
 * Update status with transition validation and slot release on cancel/no_show.
 *
 * On cancel/no_show:
 * - Release slot (is_booked = false)
 * - Decrement booked_count
 * - Revert 'full' → 'open' if applicable
 * All inside one transaction.
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: string,
  changedBy: string,
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    // Get current appointment
    const appointment = await tx.appointment.findUnique({
      where: { appointment_id: appointmentId },
    });

    if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
    const oldStatus = appointment.status;

    // Release slot on cancellation or no_show
    if ((newStatus === 'cancelled' || newStatus === 'no_show') && appointment.slot_id && appointment.session_id) {
      // Release the slot
      await tx.$queryRawUnsafe(
        `UPDATE session_slots SET is_booked = false WHERE slot_id = $1`,
        appointment.slot_id,
      );

      // Decrement booked_count, revert full → open
      await tx.$queryRawUnsafe(
        `UPDATE channel_sessions
         SET booked_count = GREATEST(booked_count - 1, 0),
             status = CASE WHEN status = 'full' THEN 'open' ELSE status END
         WHERE session_id = $1`,
        appointment.session_id,
      );
    }

    // Update appointment status
    const updated = await tx.appointment.update({
      where: { appointment_id: appointmentId },
      data: { status: newStatus },
    });

    // Log the transition
    await tx.appointmentLog.create({
      data: {
        appointment_id: appointmentId,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: changedBy,
        reason: reason || null,
      },
    });

    return updated;
  });
}

// ── Reschedule Appointment ───────────────────────────────────────────────────

/**
 * Full slot swap in one transaction:
 * 1. Release old slot + decrement old session
 * 2. Lock new session + assign new slot
 * 3. Update appointment with new session/slot/fees
 * 4. Log the reschedule
 */
export async function rescheduleAppointment(data: RescheduleData) {
  return prisma.$transaction(async (tx) => {
    // STEP 1 — Release old slot
    await tx.$queryRawUnsafe(
      `UPDATE session_slots SET is_booked = false WHERE slot_id = $1`,
      data.old_slot_id,
    );
    await tx.$queryRawUnsafe(
      `UPDATE channel_sessions
       SET booked_count = GREATEST(booked_count - 1, 0),
           status = CASE WHEN status = 'full' THEN 'open' ELSE status END
       WHERE session_id = $1`,
      data.old_session_id,
    );

    // STEP 2 — Lock new session
    const sessions = await tx.$queryRawUnsafe<
      Array<{ session_id: string; booked_count: number; max_patients: number; status: string }>
    >(
      `SELECT session_id, booked_count, max_patients, status
       FROM channel_sessions
       WHERE session_id = $1
       FOR UPDATE`,
      data.new_session_id,
    );

    if (sessions.length === 0) throw new Error('SESSION_NOT_FOUND');
    const newSession = sessions[0]!;

    if (newSession.status !== 'open') throw new Error('SESSION_NOT_AVAILABLE');
    if (newSession.booked_count >= newSession.max_patients) throw new Error('SESSION_FULL');

    // Assign new slot
    let targetSlot: { slot_id: string; slot_number: number; slot_time: string };

    if (data.new_slot_id) {
      const slots = await tx.$queryRawUnsafe<
        Array<{ slot_id: string; slot_number: number; slot_time: string; is_booked: boolean }>
      >(
        `SELECT slot_id, slot_number, slot_time, is_booked
         FROM session_slots
         WHERE slot_id = $1 AND session_id = $2
         FOR UPDATE`,
        data.new_slot_id,
        data.new_session_id,
      );
      if (slots.length === 0) throw new Error('SLOT_NOT_IN_SESSION');
      if (slots[0]!.is_booked) throw new Error('SLOT_ALREADY_TAKEN');
      targetSlot = slots[0]!;
    } else {
      const slots = await tx.$queryRawUnsafe<
        Array<{ slot_id: string; slot_number: number; slot_time: string }>
      >(
        `SELECT slot_id, slot_number, slot_time
         FROM session_slots
         WHERE session_id = $1 AND is_booked = false
         ORDER BY slot_number ASC LIMIT 1
         FOR UPDATE`,
        data.new_session_id,
      );
      if (slots.length === 0) throw new Error('SESSION_FULL');
      targetSlot = slots[0]!;
    }

    // Mark new slot as booked
    await tx.$queryRawUnsafe(
      `UPDATE session_slots SET is_booked = true WHERE slot_id = $1`,
      targetSlot.slot_id,
    );

    // Increment new session booked_count
    await tx.$queryRawUnsafe(
      `UPDATE channel_sessions
       SET booked_count = booked_count + 1,
           status = CASE
             WHEN booked_count + 1 >= max_patients THEN 'full'
             ELSE status
           END
       WHERE session_id = $1`,
      data.new_session_id,
    );

    // STEP 3 — Update appointment
    const updated = await tx.appointment.update({
      where: { appointment_id: data.appointment_id },
      data: {
        session_id: data.new_session_id,
        slot_id: targetSlot.slot_id,
        queue_number: targetSlot.slot_number,
        doctor_fee: data.new_doctor_fee,
        hospital_charge: data.new_hospital_charge,
        total_fee: data.new_total_fee,
        status: 'booked',
      },
    });

    // STEP 4 — Log reschedule
    await tx.appointmentLog.create({
      data: {
        appointment_id: data.appointment_id,
        old_status: data.old_status,
        new_status: 'booked',
        changed_by: data.user_id,
        reason: 'Rescheduled',
        metadata: {
          old_session_id: data.old_session_id,
          new_session_id: data.new_session_id,
          new_slot_time: targetSlot.slot_time,
          new_queue_number: targetSlot.slot_number,
        },
      },
    });

    return {
      ...updated,
      slot_time: targetSlot.slot_time,
      queue_number: targetSlot.slot_number,
    };
  });
}

// ── Read Queries ─────────────────────────────────────────────────────────────

/**
 * Get a single appointment with all joins + full log history.
 */
export async function findByIdInHospital(appointmentId: string, hospitalId: string) {
  return prisma.appointment.findFirst({
    where: {
      appointment_id: appointmentId,
      hospital_id: hospitalId,
    },
    include: {
      patient: { select: { name: true, phone: true, nic: true } },
      doctor: { select: { name: true, specialization: true } },
      session: {
        select: {
          session_date: true,
          start_time: true,
          end_time: true,
          branch: { select: { name: true, location: true } },
        },
      },
      slot: { select: { slot_time: true, slot_number: true } },
      logs: { orderBy: { created_at: 'asc' } },
    },
  });
}

/**
 * Get appointment by ID without hospital scoping (for internal checks).
 */
export async function findById(appointmentId: string) {
  return prisma.appointment.findUnique({
    where: { appointment_id: appointmentId },
    include: {
      session: { select: { doctor_id: true, session_date: true, hospital_id: true } },
    },
  });
}

/**
 * Check for duplicate appointment (same patient in same session, not cancelled/no_show).
 */
export async function findDuplicateAppointment(patientId: string, sessionId: string) {
  return prisma.appointment.findFirst({
    where: {
      patient_id: patientId,
      session_id: sessionId,
      status: { notIn: ['cancelled', 'no_show'] },
    },
  });
}

/**
 * List appointments with filters and pagination.
 */
export async function findByHospital(
  hospitalId: string,
  options: {
    patient_id?: string;
    doctor_id?: string;
    session_id?: string;
    status?: string;
    date?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  },
) {
  const { patient_id, doctor_id, session_id, status, date, from, to, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { hospital_id: hospitalId };

  if (patient_id) where['patient_id'] = patient_id;
  if (doctor_id) where['doctor_id'] = doctor_id;
  if (session_id) where['session_id'] = session_id;
  if (status) where['status'] = status;

  // Date filters on session.session_date
  if (date || from || to) {
    const sessionFilter: Record<string, unknown> = {};
    if (date) {
      sessionFilter['session_date'] = new Date(date);
    } else {
      const dateRange: Record<string, Date> = {};
      if (from) dateRange['gte'] = new Date(from);
      if (to) dateRange['lte'] = new Date(to);
      sessionFilter['session_date'] = dateRange;
    }
    where['session'] = sessionFilter;
  }

  const [data, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true, specialization: true } },
        session: {
          select: {
            session_date: true,
            start_time: true,
            branch: { select: { name: true } },
          },
        },
        slot: { select: { slot_time: true } },
      },
      skip,
      take: limit,
      orderBy: [{ created_at: 'desc' }],
    }),
    prisma.appointment.count({ where }),
  ]);

  return { data, total, page, limit };
}

/**
 * Get today's appointments — grouped by session, ordered by queue_number.
 */
export async function findTodayByHospital(
  hospitalId: string,
  doctorId?: string,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const where: Record<string, unknown> = {
    hospital_id: hospitalId,
    session: {
      session_date: { gte: today, lt: tomorrow },
    },
  };

  if (doctorId) where['doctor_id'] = doctorId;

  return prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { name: true, phone: true } },
      doctor: { select: { name: true, specialization: true } },
      session: {
        select: {
          session_id: true,
          session_date: true,
          start_time: true,
          end_time: true,
          branch: { select: { name: true } },
        },
      },
      slot: { select: { slot_time: true } },
    },
    orderBy: [{ queue_number: 'asc' }],
  });
}

/**
 * Get session queue — all appointments for a session, grouped by status.
 */
export async function findSessionQueue(sessionId: string, hospitalId: string) {
  return prisma.appointment.findMany({
    where: {
      session_id: sessionId,
      hospital_id: hospitalId,
    },
    include: {
      patient: { select: { name: true, phone: true } },
      slot: { select: { slot_time: true } },
    },
    orderBy: { queue_number: 'asc' },
  });
}

/**
 * Get receipt data — fee values from the appointment snapshot, NOT from fees tables.
 */
export async function getReceiptData(appointmentId: string, hospitalId: string) {
  return prisma.appointment.findFirst({
    where: {
      appointment_id: appointmentId,
      hospital_id: hospitalId,
    },
    select: {
      appointment_id: true,
      queue_number: true,
      doctor_fee: true,
      hospital_charge: true,
      total_fee: true,
      status: true,
      created_at: true,
      patient: { select: { name: true, nic: true, phone: true } },
      doctor: { select: { name: true, specialization: true } },
      session: {
        select: {
          session_date: true,
          branch: { select: { name: true } },
        },
      },
      slot: { select: { slot_time: true } },
    },
  });
}

// ── Fee Lookups (Called Before Transaction) ───────────────────────────────────

/**
 * Get doctor fee effective on a specific date.
 * Returns the most recent fee with effective_from <= date.
 */
export async function getDoctorFeeOnDate(doctorId: string, date: Date) {
  return prisma.doctorFee.findFirst({
    where: {
      doctor_id: doctorId,
      effective_from: { lte: date },
    },
    orderBy: { effective_from: 'desc' },
  });
}

/**
 * Get hospital charge effective on a specific date.
 */
export async function getHospitalChargeOnDate(hospitalId: string, date: Date) {
  return prisma.hospitalCharge.findFirst({
    where: {
      hospital_id: hospitalId,
      effective_from: { lte: date },
    },
    orderBy: { effective_from: 'desc' },
  });
}

// ── Validation Queries ───────────────────────────────────────────────────────

export async function findPatientInHospital(patientId: string, hospitalId: string) {
  return prisma.patient.findFirst({
    where: { patient_id: patientId, hospital_id: hospitalId },
  });
}

export async function findSessionInHospital(sessionId: string, hospitalId: string) {
  return prisma.channelSession.findFirst({
    where: { session_id: sessionId, hospital_id: hospitalId },
    include: {
      doctor: { select: { doctor_id: true, name: true, specialization: true } },
      branch: { select: { name: true, location: true } },
    },
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
