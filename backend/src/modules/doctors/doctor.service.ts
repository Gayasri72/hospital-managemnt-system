// ──────────────────────────────────────────────────────────────────────────────
// Doctor Service — business logic for doctor management.
//
// Enforces:
// - hospital_id always from req.user, never from body
// - Fee/charge rows are NEVER updated — always INSERT new
// - Deactivation guard: cannot deactivate with future sessions
// - Exception guard: cannot add leave on dates with existing bookings
// - All DB access delegated to doctor.repository
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import * as doctorRepo from './doctor.repository';
import type {
  CreateDoctorInput,
  UpdateDoctorInput,
  CreateFeeInput,
  CreateHospitalChargeInput,
  SetAvailabilityInput,
  CreateExceptionInput,
} from './doctor.validation';

// ── Doctor CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new doctor with profile and initial fee.
 */
export async function createDoctor(
  input: CreateDoctorInput,
  hospitalId: string,
  userId: string,
) {
  const effectiveFrom = input.effective_from
    ? new Date(input.effective_from)
    : new Date();

  const doctor = await doctorRepo.createWithProfileAndFee(
    { hospital_id: hospitalId, name: input.name, specialization: input.specialization },
    {
      contact_number: input.contact_number,
      email: input.email,
      qualifications: input.qualifications,
      experience: input.experience,
      bio: input.bio,
    },
    {
      hospital_id: hospitalId,
      consultation_fee: input.consultation_fee,
      effective_from: effectiveFrom,
    },
  );

  await doctorRepo.createAuditLog(userId, 'CREATE_DOCTOR', 'doctors', doctor.doctor_id);

  return doctor;
}

/**
 * List doctors with search, filters, and pagination.
 */
export async function listDoctors(
  hospitalId: string,
  options: { search?: string; specialization?: string; status: string; page: number; limit: number },
) {
  return doctorRepo.findByHospital(hospitalId, options);
}

/**
 * Get a single doctor with profile, current fee, hospital charge,
 * total_fee, availability, and upcoming exceptions.
 */
export async function getDoctorById(doctorId: string, hospitalId: string) {
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);

  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  // Get current and upcoming fees
  const [currentFee, hospitalCharge, upcomingFee, upcomingHospitalCharge] = await Promise.all([
    doctorRepo.getCurrentFee(doctorId),
    doctorRepo.getCurrentHospitalCharge(hospitalId),
    doctorRepo.getUpcomingFee(doctorId),
    doctorRepo.getUpcomingHospitalCharge(hospitalId),
  ]);

  const consultationFee = currentFee ? Number(currentFee.consultation_fee) : 0;
  const chargeAmount = hospitalCharge ? Number(hospitalCharge.charge_amount) : 0;

  return {
    ...doctor,
    currentFee: currentFee
      ? { consultation_fee: consultationFee, effective_from: currentFee.effective_from }
      : null,
    hospitalCharge: hospitalCharge
      ? { charge_amount: chargeAmount, effective_from: hospitalCharge.effective_from }
      : null,
    upcomingFee: upcomingFee
      ? { consultation_fee: Number(upcomingFee.consultation_fee), effective_from: upcomingFee.effective_from }
      : null,
    upcomingHospitalCharge: upcomingHospitalCharge
      ? { charge_amount: Number(upcomingHospitalCharge.charge_amount), effective_from: upcomingHospitalCharge.effective_from }
      : null,
    total_fee: consultationFee + chargeAmount,
  };
}

/**
 * Update doctor + profile.
 * Guard: cannot deactivate if future sessions exist.
 */
export async function updateDoctor(
  doctorId: string,
  input: UpdateDoctorInput,
  hospitalId: string,
  userId: string,
) {
  // Verify doctor exists and belongs to hospital
  const existing = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!existing) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  // Guard: deactivation check
  if (input.status === 'inactive' && existing.status === 'active') {
    const futureCount = await doctorRepo.countFutureAppointments(doctorId);
    if (futureCount > 0) {
      throw new AppError(
        `Cannot deactivate doctor. ${futureCount} future session(s) exist. Cancel them first.`,
        409,
        'DOCTOR_HAS_FUTURE_SESSIONS',
      );
    }
  }

  const doctorData = {
    name: input.name,
    specialization: input.specialization,
    status: input.status,
  };

  const profileData = {
    contact_number: input.contact_number,
    email: input.email,
    qualifications: input.qualifications,
    experience: input.experience,
    bio: input.bio,
  };

  const updated = await doctorRepo.updateWithProfile(doctorId, doctorData, profileData);

  await doctorRepo.createAuditLog(userId, 'UPDATE_DOCTOR', 'doctors', doctorId);

  return updated;
}

// ── Fees ─────────────────────────────────────────────────────────────────────

/**
 * Add a new fee record for a doctor (never update old ones).
 */
export async function addDoctorFee(
  doctorId: string,
  input: CreateFeeInput,
  hospitalId: string,
  userId: string,
) {
  // Verify doctor exists and belongs to hospital
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  const effectiveFrom = input.effective_from
    ? new Date(input.effective_from)
    : new Date();

  const fee = await doctorRepo.createFee({
    doctor_id: doctorId,
    hospital_id: hospitalId,
    consultation_fee: input.consultation_fee,
    effective_from: effectiveFrom,
  });

  await doctorRepo.createAuditLog(userId, 'UPDATE_DOCTOR_FEE', 'doctor_fees', fee.fee_id);

  return fee;
}

/**
 * Get full fee history for a doctor.
 */
export async function getDoctorFeeHistory(
  doctorId: string,
  hospitalId: string,
) {
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  return doctorRepo.getFeeHistory(doctorId);
}

// ── Hospital Charges ─────────────────────────────────────────────────────────

/**
 * Add a new hospital charge (never update old ones).
 */
export async function addHospitalCharge(
  input: CreateHospitalChargeInput,
  hospitalId: string,
  userId: string,
) {
  const effectiveFrom = input.effective_from
    ? new Date(input.effective_from)
    : new Date();

  const charge = await doctorRepo.createHospitalCharge(
    hospitalId,
    input.charge_amount,
    effectiveFrom,
  );

  await doctorRepo.createAuditLog(userId, 'UPDATE_HOSPITAL_CHARGE', 'hospital_charges', charge.charge_id);

  return charge;
}

/**
 * Get the current hospital charge.
 */
export async function getCurrentHospitalCharge(hospitalId: string) {
  return doctorRepo.getCurrentHospitalCharge(hospitalId);
}

// ── Availability ─────────────────────────────────────────────────────────────

/**
 * Replace entire availability schedule for a doctor.
 */
export async function setAvailability(
  doctorId: string,
  input: SetAvailabilityInput,
  hospitalId: string,
  userId: string,
) {
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  const schedule = await doctorRepo.replaceAvailability(doctorId, input.schedule);

  await doctorRepo.createAuditLog(userId, 'UPDATE_DOCTOR_AVAILABILITY', 'doctor_availability', doctorId);

  return schedule;
}

/**
 * Get weekly availability schedule for a doctor.
 */
export async function getAvailability(doctorId: string, hospitalId: string) {
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  return doctorRepo.getAvailability(doctorId);
}

// ── Exceptions ───────────────────────────────────────────────────────────────

/**
 * Add an exception (leave) for a doctor.
 * Guard: cannot add on dates with existing booked appointments.
 */
export async function addException(
  doctorId: string,
  input: CreateExceptionInput,
  hospitalId: string,
  userId: string,
) {
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  const exceptionDate = new Date(input.exception_date);

  // Guard: check for existing bookings on this date
  const bookingCount = await doctorRepo.countAppointmentsOnDate(doctorId, exceptionDate);
  if (bookingCount > 0) {
    throw new AppError(
      `Cannot add leave. ${bookingCount} appointment(s) are already booked on this date. Cancel them first.`,
      409,
      'DOCTOR_EXCEPTION_CONFLICT',
    );
  }

  const exception = await doctorRepo.createException(doctorId, exceptionDate, input.reason);

  await doctorRepo.createAuditLog(userId, 'ADD_DOCTOR_EXCEPTION', 'doctor_exceptions', exception.exception_id);

  return exception;
}

/**
 * Get exceptions for a doctor within a date range.
 * Defaults: from=today, to=today+30days.
 */
export async function getExceptions(
  doctorId: string,
  hospitalId: string,
  fromStr?: string,
  toStr?: string,
) {
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  const from = fromStr ? new Date(fromStr) : new Date();
  const to = toStr ? new Date(toStr) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return doctorRepo.getExceptions(doctorId, from, to);
}

/**
 * Delete an exception.
 * Verifies the exception belongs to the doctor and hospital.
 */
export async function removeException(
  doctorId: string,
  exceptionId: string,
  hospitalId: string,
  userId: string,
) {
  // Verify doctor belongs to hospital
  const doctor = await doctorRepo.findByIdInHospital(doctorId, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  // Verify exception belongs to this doctor
  const exception = await doctorRepo.findExceptionById(exceptionId);
  if (!exception || exception.doctor_id !== doctorId) {
    throw new AppError('Exception not found.', 404, 'DOCTOR_NOT_FOUND');
  }

  await doctorRepo.deleteException(exceptionId);

  await doctorRepo.createAuditLog(userId, 'REMOVE_DOCTOR_EXCEPTION', 'doctor_exceptions', exceptionId);
}
