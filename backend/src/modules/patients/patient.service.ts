// ──────────────────────────────────────────────────────────────────────────────
// Patient Service — business logic for patient management.
//
// Enforces:
// - NIC uniqueness per hospital (not global)
// - hospital_id always comes from req.user, never from body
// - No direct DB access — delegates to patient.repository
// - Creates audit log entries for mutations
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import * as patientRepo from './patient.repository';
import type { CreatePatientInput, UpdatePatientInput } from './patient.validation';

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new patient with profile.
 *
 * Business rules:
 * - NIC must be unique within the hospital (composite check)
 * - hospital_id comes from the authenticated user's token
 * - Patient + profile created in a single DB transaction
 * - Audit log entry written
 */
export async function createPatient(
  input: CreatePatientInput,
  hospitalId: string,
  userId: string,
) {
  // 1) Check NIC uniqueness within this hospital
  const nicExists = await patientRepo.existsByNicInHospital(hospitalId, input.nic);
  if (nicExists) {
    throw new AppError(
      'A patient with this NIC already exists in your hospital.',
      409,
      'PATIENT_NIC_EXISTS',
    );
  }

  // 2) Separate patient data from profile data
  const patientData = {
    hospital_id: hospitalId,
    name: input.name,
    nic: input.nic,
    phone: input.phone,
    email: input.email,
  };

  const profileData = {
    address: input.address,
    emergency_contact: input.emergency_contact,
    gender: input.gender,
    age: input.age,
  };

  // 3) Create in transaction (audit log written inside the same tx)
  const patient = await patientRepo.createWithProfile(patientData, profileData, {
    user_id: userId,
    action: 'CREATE_PATIENT',
    entity: 'patients',
  });

  return patient;
}

/**
 * List patients for a hospital with search and pagination.
 *
 * - Always filtered by hospital_id from the authenticated user
 * - Search is case-insensitive across name, nic, phone
 */
export async function listPatients(
  hospitalId: string,
  options: { search?: string; page: number; limit: number },
) {
  const result = await patientRepo.findByHospital(hospitalId, options);

  return {
    data: result.data,
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

/**
 * Get a single patient by ID.
 *
 * - Returns 404 if patient doesn't exist OR belongs to another hospital
 *   (never 403 — to avoid revealing that the patient exists elsewhere)
 */
export async function getPatientById(patientId: string, hospitalId: string) {
  const patient = await patientRepo.findByIdInHospital(patientId, hospitalId);

  if (!patient) {
    throw new AppError(
      'Patient not found.',
      404,
      'PATIENT_NOT_FOUND',
    );
  }

  return patient;
}

/**
 * Update patient + profile.
 *
 * Business rules:
 * - NIC is NOT updatable (excluded in validation schema)
 * - Patient must belong to the authenticated user's hospital
 * - Patient + profile updated in a single DB transaction
 * - Audit log entry written
 */
export async function updatePatient(
  patientId: string,
  input: UpdatePatientInput,
  hospitalId: string,
  userId: string,
) {
  // 1) Verify patient exists and belongs to this hospital
  const existing = await patientRepo.findByIdInHospital(patientId, hospitalId);
  if (!existing) {
    throw new AppError(
      'Patient not found.',
      404,
      'PATIENT_NOT_FOUND',
    );
  }

  // 2) Separate patient data from profile data
  const patientData = {
    name: input.name,
    phone: input.phone,
    email: input.email,
  };

  const profileData = {
    address: input.address,
    emergency_contact: input.emergency_contact,
    gender: input.gender,
    age: input.age,
  };

  // 3) Update in transaction (audit log written inside the same tx)
  const updated = await patientRepo.updateWithProfile(patientId, patientData, profileData, {
    user_id: userId,
    action: 'UPDATE_PATIENT',
    entity: 'patients',
  });

  return updated;
}

/**
 * Get appointment history for a patient.
 *
 * - Verifies patient belongs to the authenticated user's hospital
 */
export async function getPatientAppointments(patientId: string, hospitalId: string) {
  // Verify patient exists and belongs to this hospital
  const patient = await patientRepo.findByIdInHospital(patientId, hospitalId);
  if (!patient) {
    throw new AppError(
      'Patient not found.',
      404,
      'PATIENT_NOT_FOUND',
    );
  }

  return patientRepo.findAppointmentsByPatient(patientId, hospitalId);
}
