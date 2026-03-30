// ──────────────────────────────────────────────────────────────────────────────
// Session Service — business logic for session management.
//
// Enforces:
// - Doctor/branch ownership in same hospital
// - Doctor active status check
// - Exception date guard
// - Availability warning (soft, not blocking)
// - Overlap detection
// - Status transition rules
// - Capacity reduction guard
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import * as sessionRepo from './session.repository';
import { generateSlots, calculateMaxPatients } from './slot.util';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  UpdateStatusInput,
  ListSessionsQuery,
  AvailableSessionsQuery,
  DoctorSessionsQuery,
} from './session.validation';

// ── Status Transition Map ────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['open', 'cancelled'],
  open: ['closed', 'cancelled'],
  full: ['closed'],
  closed: [],     // terminal
  cancelled: [],  // terminal
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ── Session CRUD ─────────────────────────────────────────────────────────────

/**
 * Create a new session with generated slots.
 */
export async function createSession(
  input: CreateSessionInput,
  hospitalId: string,
  userId: string,
) {
  // Step 1 — Validate doctor belongs to this hospital
  const doctor = await sessionRepo.findDoctorInHospital(input.doctor_id, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found in your hospital.', 404, 'DOCTOR_NOT_FOUND');
  }

  // Step 2 — Validate branch belongs to this hospital
  const branch = await sessionRepo.findBranchInHospital(input.branch_id, hospitalId);
  if (!branch) {
    throw new AppError('Branch not found in your hospital.', 404, 'BRANCH_NOT_FOUND');
  }

  // Step 3 — Check doctor is active
  if (doctor.status !== 'active') {
    throw new AppError('Cannot create session for an inactive doctor.', 409, 'DOCTOR_INACTIVE');
  }

  // Step 4 — Check session_date is not in the past
  const sessionDate = new Date(input.session_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (sessionDate < today) {
    throw new AppError('Session date cannot be in the past.', 400, 'INVALID_TIME_RANGE');
  }

  // Step 5 — Check doctor exceptions
  const exception = await sessionRepo.findDoctorExceptionOnDate(input.doctor_id, sessionDate);
  if (exception) {
    throw new AppError(
      `Doctor is unavailable on this date.${exception.reason ? ` Reason: ${exception.reason}` : ''}`,
      409,
      'SESSION_ON_EXCEPTION_DATE',
    );
  }

  // Step 6 — Check doctor availability (soft warning)
  const dayOfWeek = DAYS_OF_WEEK[sessionDate.getDay()]!;
  const availability = await sessionRepo.findDoctorAvailabilityForDay(input.doctor_id, dayOfWeek);
  let warning: string | undefined;
  if (!availability) {
    warning = `Outside doctor's regular schedule. ${dayOfWeek} is not in their availability.`;
  }

  // Step 7 — Check for overlapping sessions
  const overlaps = await sessionRepo.findOverlappingSessions(
    input.doctor_id,
    sessionDate,
    input.start_time,
    input.end_time,
  );
  if (overlaps.length > 0) {
    throw new AppError(
      'Doctor already has a session at this time.',
      409,
      'SESSION_OVERLAP',
    );
  }

  // Step 8 — Calculate max_patients
  const slotDuration = input.slot_duration ?? 10;
  const maxPatients = input.max_patients ?? calculateMaxPatients(
    input.start_time,
    input.end_time,
    slotDuration,
  );

  // Step 9 — Generate slots
  const slots = generateSlots('placeholder', input.start_time, slotDuration, maxPatients);

  // Step 10 + 11 — Create session + slots in transaction
  const session = await sessionRepo.createSessionWithSlots(
    {
      doctor_id: input.doctor_id,
      branch_id: input.branch_id,
      hospital_id: hospitalId,
      session_date: sessionDate,
      start_time: input.start_time,
      end_time: input.end_time,
      slot_duration: slotDuration,
      max_patients: maxPatients,
      created_by: userId,
    },
    slots,
  );

  // Step 12 — Audit log
  await sessionRepo.createAuditLog(userId, 'CREATE_SESSION', 'channel_sessions', session.session_id);

  // Step 13 — Return with optional warning
  return { ...session, ...(warning ? { warning } : {}) };
}

/**
 * List sessions with filters and pagination.
 */
export async function listSessions(
  hospitalId: string,
  options: ListSessionsQuery,
) {
  return sessionRepo.findByHospital(hospitalId, options);
}

/**
 * Get a single session with full details.
 * Includes doctor info, branch info, fee, charge, total_fee, and all slots.
 */
export async function getSessionById(sessionId: string, hospitalId: string) {
  const session = await sessionRepo.findByIdInHospital(sessionId, hospitalId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  return session;
}

/**
 * Update session details.
 * Guards: cannot edit once open/full/cancelled, cannot reduce capacity below bookings.
 */
export async function updateSession(
  sessionId: string,
  input: UpdateSessionInput,
  hospitalId: string,
  userId: string,
) {
  const session = await sessionRepo.findByIdInHospital(sessionId, hospitalId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  // Only allow updates when status is 'scheduled'
  if (session.status !== 'scheduled') {
    throw new AppError(
      `Cannot update session with status '${session.status}'. Only scheduled sessions can be edited.`,
      409,
      'SESSION_ALREADY_OPEN',
    );
  }

  // Check capacity reduction
  if (input.max_patients !== undefined && input.max_patients < session.booked_count) {
    throw new AppError(
      `Cannot reduce capacity below current bookings (${session.booked_count} already booked).`,
      409,
      'CAPACITY_BELOW_BOOKINGS',
    );
  }

  // Check time/slot changes with existing bookings
  const timeChanged = (input.start_time && input.start_time !== session.start_time) ||
                      (input.end_time && input.end_time !== session.end_time) ||
                      (input.slot_duration && input.slot_duration !== session.slot_duration);

  if (timeChanged && session.booked_count > 0) {
    throw new AppError(
      'Cannot change times after bookings exist.',
      409,
      'SESSION_HAS_BOOKINGS',
    );
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (input.start_time) updateData['start_time'] = input.start_time;
  if (input.end_time) updateData['end_time'] = input.end_time;
  if (input.slot_duration) updateData['slot_duration'] = input.slot_duration;
  if (input.max_patients !== undefined) updateData['max_patients'] = input.max_patients;

  await sessionRepo.updateSession(sessionId, updateData);

  // Regenerate slots if time/duration changed and no bookings
  if (timeChanged && session.booked_count === 0) {
    const newStartTime = input.start_time || session.start_time;
    const newEndTime = input.end_time || session.end_time;
    const newSlotDuration = input.slot_duration || session.slot_duration;
    const newMaxPatients = input.max_patients ?? calculateMaxPatients(newStartTime, newEndTime, newSlotDuration);

    const slots = generateSlots(sessionId, newStartTime, newSlotDuration, newMaxPatients);
    await sessionRepo.regenerateSlots(sessionId, slots);

    // Also update max_patients if auto-calculated
    if (input.max_patients === undefined) {
      await sessionRepo.updateSession(sessionId, { max_patients: newMaxPatients });
    }
  }

  await sessionRepo.createAuditLog(userId, 'UPDATE_SESSION', 'channel_sessions', sessionId);

  // Re-fetch the updated session
  return sessionRepo.findByIdInHospital(sessionId, hospitalId);
}

/**
 * Update session status with transition validation.
 */
export async function updateSessionStatus(
  sessionId: string,
  input: UpdateStatusInput,
  hospitalId: string,
  userId: string,
) {
  const session = await sessionRepo.findByIdInHospital(sessionId, hospitalId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  const allowed = ALLOWED_TRANSITIONS[session.status] || [];
  if (!allowed.includes(input.status)) {
    throw new AppError(
      `Cannot transition from '${session.status}' to '${input.status}'.`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  // Special guard: open → cancelled only if no bookings
  if (session.status === 'open' && input.status === 'cancelled' && session.booked_count > 0) {
    throw new AppError(
      'Cannot cancel session with existing bookings. Cancel appointments first.',
      409,
      'SESSION_HAS_BOOKINGS',
    );
  }

  const updated = await sessionRepo.updateSession(sessionId, { status: input.status });

  await sessionRepo.createAuditLog(
    userId,
    'UPDATE_SESSION_STATUS',
    'channel_sessions',
    sessionId,
  );

  return updated;
}

/**
 * Delete a session.
 * Only allowed when status is 'scheduled' AND booked_count = 0.
 */
export async function deleteSession(
  sessionId: string,
  hospitalId: string,
  userId: string,
) {
  const session = await sessionRepo.findByIdInHospital(sessionId, hospitalId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  if (session.status !== 'scheduled') {
    throw new AppError(
      `Cannot delete session with status '${session.status}'. Only scheduled sessions can be deleted.`,
      409,
      'SESSION_ALREADY_OPEN',
    );
  }

  if (session.booked_count > 0) {
    throw new AppError(
      'Cannot delete session with bookings. Use cancel instead.',
      409,
      'SESSION_HAS_BOOKINGS',
    );
  }

  await sessionRepo.deleteSessionWithSlots(sessionId);
  await sessionRepo.createAuditLog(userId, 'DELETE_SESSION', 'channel_sessions', sessionId);
}

/**
 * Get all slots for a session.
 */
export async function getSessionSlots(sessionId: string, hospitalId: string) {
  const session = await sessionRepo.findByIdInHospital(sessionId, hospitalId);
  if (!session) {
    throw new AppError('Session not found.', 404, 'SESSION_NOT_FOUND');
  }

  return sessionRepo.getSessionSlots(sessionId);
}

/**
 * Get available sessions for booking.
 */
export async function getAvailableSessions(
  hospitalId: string,
  options: AvailableSessionsQuery,
) {
  return sessionRepo.findAvailableSessions(hospitalId, options);
}

/**
 * Get all sessions for a specific doctor.
 */
export async function getDoctorSessions(
  doctorId: string,
  hospitalId: string,
  options: DoctorSessionsQuery,
) {
  // Verify doctor belongs to hospital
  const doctor = await sessionRepo.findDoctorInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  return sessionRepo.findDoctorSessions(doctorId, hospitalId, options);
}
