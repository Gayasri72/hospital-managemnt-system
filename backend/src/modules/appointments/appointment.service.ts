// ──────────────────────────────────────────────────────────────────────────────
// Appointment Service — business logic for appointment management.
//
// Responsibilities:
// - Pre-transaction validations (patient, session, duplicate check)
// - Fee snapshot lookups (BEFORE entering any transaction)
// - Status transition enforcement
// - Reschedule validation (same doctor, status check)
// - Delegates all transactional work to appointment.repository
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import * as appointmentRepo from './appointment.repository';
import type {
  CreateAppointmentInput,
  UpdateStatusInput,
  RescheduleInput,
  ListAppointmentsQuery,
} from './appointment.validation';

// ── Status Transition Map ────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  booked:    ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['arrived', 'cancelled', 'no_show'],
  arrived:   ['completed', 'no_show'],
  completed: [],   // terminal
  cancelled: [],   // terminal
  no_show:   [],   // terminal
};

// Role permissions per transition
const TRANSITION_ROLES: Record<string, string[]> = {
  'booked→confirmed':    ['Receptionist', 'Hospital Admin', 'Super Admin'],
  'booked→cancelled':    ['Receptionist', 'Hospital Admin', 'Super Admin'],
  'booked→no_show':      ['Receptionist', 'Hospital Admin', 'Super Admin'],
  'confirmed→arrived':   ['Receptionist', 'Hospital Admin', 'Super Admin'],
  'confirmed→cancelled': ['Receptionist', 'Hospital Admin', 'Super Admin'],
  'confirmed→no_show':   ['Receptionist', 'Hospital Admin', 'Super Admin'],
  'arrived→completed':   ['Doctor', 'Hospital Admin', 'Super Admin'],
  'arrived→no_show':     ['Receptionist', 'Hospital Admin', 'Super Admin'],
};

// ── Create Appointment ───────────────────────────────────────────────────────

export async function createAppointment(
  input: CreateAppointmentInput,
  hospitalId: string,
  userId: string,
) {
  // STEP 1 — Validate patient
  const patient = await appointmentRepo.findPatientInHospital(input.patient_id, hospitalId);
  if (!patient) {
    throw new AppError('Patient not found in your hospital.', 404, 'PATIENT_NOT_FOUND');
  }

  // Validate session
  const session = await appointmentRepo.findSessionInHospital(input.session_id, hospitalId);
  if (!session) {
    throw new AppError('Session not found in your hospital.', 404, 'SESSION_NOT_FOUND');
  }

  // Check session is open
  if (session.status !== 'open') {
    throw new AppError(
      `Session is not available for booking (status: ${session.status}).`,
      409,
      'SESSION_NOT_AVAILABLE',
    );
  }

  // Check duplicate
  const duplicate = await appointmentRepo.findDuplicateAppointment(input.patient_id, input.session_id);
  if (duplicate) {
    throw new AppError(
      'Patient already has an active appointment in this session.',
      409,
      'DUPLICATE_APPOINTMENT',
    );
  }

  // STEP 2 — Fee snapshot (CRITICAL — before any locks)
  const sessionDate = session.session_date;

  const [doctorFeeRow, hospitalChargeRow] = await Promise.all([
    appointmentRepo.getDoctorFeeOnDate(session.doctor.doctor_id, sessionDate),
    appointmentRepo.getHospitalChargeOnDate(hospitalId, sessionDate),
  ]);

  if (!doctorFeeRow) {
    throw new AppError(
      'No doctor fee configured for this session date. Configure fees first.',
      400,
      'FEE_NOT_CONFIGURED',
    );
  }
  if (!hospitalChargeRow) {
    throw new AppError(
      'No hospital charge configured for this session date. Configure charges first.',
      400,
      'FEE_NOT_CONFIGURED',
    );
  }

  const doctorFee = Number(doctorFeeRow.consultation_fee);
  const hospitalCharge = Number(hospitalChargeRow.charge_amount);
  const totalFee = doctorFee + hospitalCharge;

  // STEP 3 — Create appointment (inside transaction in repository)
  const appointment = await appointmentRepo.createAppointment({
    hospital_id: hospitalId,
    patient_id: input.patient_id,
    doctor_id: session.doctor.doctor_id,
    session_id: input.session_id,
    slot_id: input.slot_id,
    doctor_fee: doctorFee,
    hospital_charge: hospitalCharge,
    total_fee: totalFee,
    notes: input.notes,
    booked_by: userId,
  });

  // STEP 4 — Audit log
  await appointmentRepo.createAuditLog(
    userId,
    'CREATE_APPOINTMENT',
    'appointments',
    appointment.appointment_id,
  );

  // STEP 5 — Return enriched response
  return {
    ...appointment,
    patient: { name: patient.name, phone: patient.phone },
    doctor: { name: session.doctor.name, specialization: session.doctor.specialization },
    session: {
      session_date: session.session_date,
      start_time: session.start_time,
      branch_name: session.branch.name,
    },
    doctor_fee: doctorFee,
    hospital_charge: hospitalCharge,
    total_fee: totalFee,
  };
}

// ── List Appointments ────────────────────────────────────────────────────────

export async function listAppointments(
  hospitalId: string,
  options: ListAppointmentsQuery,
  userRole: string,
  userDoctorId?: string,
) {
  // Doctor role: force filter to their own appointments
  const effectiveOptions = { ...options };
  if (userRole === 'Doctor' && userDoctorId) {
    effectiveOptions.doctor_id = userDoctorId;
  }

  return appointmentRepo.findByHospital(hospitalId, effectiveOptions);
}

// ── Today's Appointments ─────────────────────────────────────────────────────

export async function getTodayAppointments(
  hospitalId: string,
  userRole: string,
  userDoctorId?: string,
) {
  const doctorId = userRole === 'Doctor' ? userDoctorId : undefined;
  const appointments = await appointmentRepo.findTodayByHospital(hospitalId, doctorId);

  // Group by session
  const sessionMap = new Map<string, { session: unknown; appointments: typeof appointments }>();

  for (const appt of appointments) {
    const sessionId = appt.session_id || 'no-session';
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, { session: appt.session, appointments: [] });
    }
    sessionMap.get(sessionId)!.appointments.push(appt);
  }

  // Calculate waiting count per session
  const grouped = Array.from(sessionMap.entries()).map(([sessionId, group]) => ({
    session_id: sessionId,
    session: group.session,
    appointments: group.appointments,
    waiting_count: group.appointments.filter(
      (a) => ['booked', 'confirmed', 'arrived'].includes(a.status),
    ).length,
  }));

  return grouped;
}

// ── Get Appointment by ID ────────────────────────────────────────────────────

export async function getAppointmentById(
  appointmentId: string,
  hospitalId: string,
  userRole: string,
  userDoctorId?: string,
) {
  const appointment = await appointmentRepo.findByIdInHospital(appointmentId, hospitalId);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // Doctor role: verify this is their appointment
  if (userRole === 'Doctor' && userDoctorId && appointment.doctor_id !== userDoctorId) {
    throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
  }

  return appointment;
}

// ── Update Appointment Status ────────────────────────────────────────────────

export async function updateAppointmentStatus(
  appointmentId: string,
  input: UpdateStatusInput,
  hospitalId: string,
  userId: string,
  userRole: string,
) {
  const appointment = await appointmentRepo.findByIdInHospital(appointmentId, hospitalId);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // Check transition is allowed
  const allowed = ALLOWED_TRANSITIONS[appointment.status] || [];
  if (!allowed.includes(input.status)) {
    throw new AppError(
      `Cannot transition from '${appointment.status}' to '${input.status}'.`,
      409,
      'INVALID_STATUS_TRANSITION',
    );
  }

  // Check role permission for this specific transition
  const transitionKey = `${appointment.status}→${input.status}`;
  const allowedRoles = TRANSITION_ROLES[transitionKey] || [];
  if (!allowedRoles.includes(userRole)) {
    throw new AppError(
      `Your role (${userRole}) cannot perform this status transition.`,
      403,
      'INVALID_STATUS_TRANSITION',
    );
  }

  const updated = await appointmentRepo.updateAppointmentStatus(
    appointmentId,
    input.status,
    userId,
    input.reason,
  );

  await appointmentRepo.createAuditLog(
    userId,
    'UPDATE_APPOINTMENT_STATUS',
    'appointments',
    appointmentId,
  );

  return updated;
}

// ── Reschedule Appointment ───────────────────────────────────────────────────

export async function rescheduleAppointment(
  appointmentId: string,
  input: RescheduleInput,
  hospitalId: string,
  userId: string,
) {
  // Validate current appointment
  const appointment = await appointmentRepo.findById(appointmentId);
  if (!appointment || appointment.session?.hospital_id !== hospitalId) {
    throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // Only allow reschedule when booked or confirmed
  if (!['booked', 'confirmed'].includes(appointment.status)) {
    throw new AppError(
      `Cannot reschedule appointment with status '${appointment.status}'.`,
      409,
      'RESCHEDULE_NOT_ALLOWED',
    );
  }

  // Validate new session
  const newSession = await appointmentRepo.findSessionInHospital(input.new_session_id, hospitalId);
  if (!newSession) {
    throw new AppError('New session not found in your hospital.', 404, 'SESSION_NOT_FOUND');
  }

  if (newSession.status !== 'open') {
    throw new AppError('New session is not available for booking.', 409, 'SESSION_NOT_AVAILABLE');
  }

  // Must be same doctor
  if (newSession.doctor.doctor_id !== appointment.doctor_id) {
    throw new AppError(
      'Cannot reschedule to a session with a different doctor. Create a new booking instead.',
      409,
      'RESCHEDULE_DOCTOR_MISMATCH',
    );
  }

  // Check patient doesn't already have appointment in new session
  const duplicate = await appointmentRepo.findDuplicateAppointment(
    appointment.patient_id,
    input.new_session_id,
  );
  if (duplicate && duplicate.appointment_id !== appointmentId) {
    throw new AppError(
      'Patient already has an appointment in the new session.',
      409,
      'DUPLICATE_APPOINTMENT',
    );
  }

  // Re-snapshot fees for new session date
  const [doctorFeeRow, hospitalChargeRow] = await Promise.all([
    appointmentRepo.getDoctorFeeOnDate(appointment.doctor_id, newSession.session_date),
    appointmentRepo.getHospitalChargeOnDate(hospitalId, newSession.session_date),
  ]);

  if (!doctorFeeRow || !hospitalChargeRow) {
    throw new AppError('Fees not configured for the new session date.', 400, 'FEE_NOT_CONFIGURED');
  }

  const newDoctorFee = Number(doctorFeeRow.consultation_fee);
  const newHospitalCharge = Number(hospitalChargeRow.charge_amount);
  const newTotalFee = newDoctorFee + newHospitalCharge;

  // Execute reschedule transaction
  const updated = await appointmentRepo.rescheduleAppointment({
    appointment_id: appointmentId,
    old_session_id: appointment.session_id!,
    old_slot_id: appointment.slot_id!,
    new_session_id: input.new_session_id,
    new_slot_id: input.new_slot_id,
    new_doctor_fee: newDoctorFee,
    new_hospital_charge: newHospitalCharge,
    new_total_fee: newTotalFee,
    user_id: userId,
    old_status: appointment.status,
  });

  await appointmentRepo.createAuditLog(userId, 'RESCHEDULE_APPOINTMENT', 'appointments', appointmentId);

  return updated;
}

// ── Session Queue ────────────────────────────────────────────────────────────

export async function getSessionQueue(sessionId: string, hospitalId: string) {
  const appointments = await appointmentRepo.findSessionQueue(sessionId, hospitalId);

  const waiting = appointments.filter((a) => ['booked', 'confirmed'].includes(a.status));
  const in_clinic = appointments.filter((a) => a.status === 'arrived');
  const done = appointments.filter((a) => ['completed', 'no_show', 'cancelled'].includes(a.status));

  return { waiting, in_clinic, done };
}

// ── Receipt Data ─────────────────────────────────────────────────────────────

export async function getReceiptData(appointmentId: string, hospitalId: string) {
  const receipt = await appointmentRepo.getReceiptData(appointmentId, hospitalId);
  if (!receipt) {
    throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
  }
  return receipt;
}
