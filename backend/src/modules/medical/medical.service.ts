// ──────────────────────────────────────────────────────────────────────────────
// Medical Service — Business logic for medical records
//
// Enforces rules:
// - One record per appointment
// - Appointment must be 'completed'
// - Doctor access guard (ownership)
// - 24-hour edit window
// - Follow-up future date validation
// ──────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../utils/apiError';
import * as medicalRepo from './medical.repository';
import * as appointmentRepo from '../appointments/appointment.repository';

// ── Types ────────────────────────────────────────────────────────────────────

interface UserContext {
  user_id: string;
  role: string;
  hospital_id: string;
}

interface CreateRecordInput {
  appointment_id: string;
  diagnosis: string;
  notes?: string;
  follow_up_date?: string;
  prescriptions?: Array<{
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
}

interface UpdateRecordInput {
  diagnosis?: string;
  notes?: string;
  follow_up_date?: string | null;
  prescriptions?: Array<{
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates doctor ownership for actions requiring Doctor role.
 * Throws if user is not linked to doctor profile, or if record belongs to a different doctor.
 */
async function enforceDoctorOwnership(
  user: UserContext,
  targetDoctorId: string
) {
  if (user.role === 'Doctor') {
    const doctorId = await medicalRepo.getUserDoctorId(user.user_id, user.hospital_id);
    if (!doctorId) {
      throw new AppError(
        'Your account is not linked to a doctor profile. Contact your administrator.',
        403,
        'DOCTOR_PROFILE_NOT_FOUND'
      );
    }
    if (doctorId !== targetDoctorId) {
      throw new AppError(
        'You do not have permission to access records for another doctor.',
        403,
        'ACCESS_DENIED'
      );
    }
  }
}

/**
 * Reusable doctor ID lookup for querying their own records.
 */
async function getSelfDoctorId(user: UserContext): Promise<string> {
  const doctorId = await medicalRepo.getUserDoctorId(user.user_id, user.hospital_id);
  if (!doctorId) {
    throw new AppError(
      'Your account is not linked to a doctor profile. Contact your administrator.',
      403,
      'DOCTOR_PROFILE_NOT_FOUND'
    );
  }
  return doctorId;
}

// ── Services ─────────────────────────────────────────────────────────────────

export async function createMedicalRecord(input: CreateRecordInput, user: UserContext) {
  // 1. Validate follow-up date
  let followUpDate: Date | undefined;
  if (input.follow_up_date) {
    followUpDate = new Date(input.follow_up_date);
    if (followUpDate < new Date()) {
      throw new AppError('Follow-up date must be in the future.', 400, 'INVALID_FOLLOW_UP_DATE');
    }
  }

  // 2. Validate appointment
  const appointment = await appointmentRepo.findByIdInHospital(input.appointment_id, user.hospital_id);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, 'RECORD_NOT_FOUND');
  }

  if (appointment.status !== 'completed') {
    throw new AppError('Medical records can only be created for completed appointments.', 409, 'APPOINTMENT_NOT_COMPLETED');
  }

  // 3. Enforce doctor access guard
  await enforceDoctorOwnership(user, appointment.doctor_id);

  // 4. Ensure no existing record
  const existing = await medicalRepo.getMedicalRecordByAppointmentId(appointment.appointment_id, user.hospital_id);
  if (existing) {
    throw new AppError('A medical record already exists for this appointment.', 409, 'RECORD_ALREADY_EXISTS');
  }

  // 5. Create via repository
  const record = await medicalRepo.createMedicalRecord(
    {
      appointment_id: appointment.appointment_id,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      hospital_id: user.hospital_id,
      diagnosis: input.diagnosis,
      notes: input.notes,
      follow_up_date: followUpDate,
    },
    input.prescriptions || []
  );

  // 6. Audit log
  await medicalRepo.createAuditLog(user.user_id, 'CREATE_MEDICAL_RECORD', 'medical_records', record.record_id);

  return record;
}

export async function updateMedicalRecord(recordId: string, input: UpdateRecordInput, user: UserContext) {
  const record = await medicalRepo.getMedicalRecordById(recordId, user.hospital_id);
  if (!record) {
    throw new AppError('Medical record not found.', 404, 'RECORD_NOT_FOUND');
  }

  // 1. Enforce doctor access guard
  await enforceDoctorOwnership(user, record.doctor_id);

  // 2. 24-hour edit window for Doctors
  if (user.role === 'Doctor') {
    const hoursSinceCreation = (new Date().getTime() - record.created_at.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      throw new AppError(
        'Medical records can only be edited within 24 hours of creation. Contact your administrator.',
        409,
        'RECORD_EDIT_WINDOW_EXPIRED'
      );
    }
  }

  // 3. Follow-up date validation
  let followUpDate: Date | null | undefined;
  if (input.follow_up_date === null) {
    followUpDate = null;
  } else if (input.follow_up_date) {
    followUpDate = new Date(input.follow_up_date);
    if (followUpDate < new Date()) {
      throw new AppError('Follow-up date must be in the future.', 400, 'INVALID_FOLLOW_UP_DATE');
    }
  }

  // 4. Update via repository
  const updated = await medicalRepo.updateMedicalRecord(
    recordId,
    user.hospital_id,
    {
      diagnosis: input.diagnosis,
      notes: input.notes,
      follow_up_date: followUpDate,
    },
    input.prescriptions
  );

  // 5. Audit log
  await medicalRepo.createAuditLog(user.user_id, 'UPDATE_MEDICAL_RECORD', 'medical_records', recordId);

  return updated;
}

export async function getMedicalRecordById(recordId: string, user: UserContext) {
  const record = await medicalRepo.getMedicalRecordById(recordId, user.hospital_id);
  
  if (!record) {
    throw new AppError('Medical record not found.', 404, 'RECORD_NOT_FOUND');
  }

  // If Doctor, verify ownership. If failing, throw 404 (not 403) to hide existence.
  if (user.role === 'Doctor') {
    const doctorId = await medicalRepo.getUserDoctorId(user.user_id, user.hospital_id);
    if (record.doctor_id !== doctorId) {
      throw new AppError('Medical record not found.', 404, 'RECORD_NOT_FOUND');
    }
  }

  return formatFullRecord(record);
}

export async function getMedicalRecordByAppointmentId(appointmentId: string, user: UserContext) {
  // First ensure appointment itself belongs to the hospital
  const appointment = await appointmentRepo.findByIdInHospital(appointmentId, user.hospital_id);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, 'RECORD_NOT_FOUND');
  }

  if (user.role === 'Doctor') {
    const doctorId = await medicalRepo.getUserDoctorId(user.user_id, user.hospital_id);
    if (appointment.doctor_id !== doctorId) {
      throw new AppError('Appointment not found.', 404, 'RECORD_NOT_FOUND');
    }
  }

  const record = await medicalRepo.getMedicalRecordByAppointmentId(appointmentId, user.hospital_id);
  if (!record) {
    throw new AppError('No medical record found for this appointment.', 404, 'RECORD_NOT_FOUND');
  }

  return formatFullRecord(record);
}

export async function getPatientMedicalHistory(
  patientId: string,
  options: { page: number; limit: number; from?: string; to?: string; doctor_id?: string },
  user: UserContext
) {
  // All doctors can view any patient's records
  const filters = {
    page: options.page,
    limit: options.limit,
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined,
    doctor_id: options.doctor_id,
  };

  const result = await medicalRepo.getPatientMedicalHistory(patientId, user.hospital_id, filters);
  
  // Format the output
  return {
    ...result,
    data: result.data.map((r: any) => ({
      record_id: r.record_id,
      session_date: r.appointment.session.session_date,
      doctor_name: r.doctor.name,
      specialization: r.doctor.specialization,
      branch_name: r.appointment.session.branch.name,
      diagnosis_preview: r.diagnosis.length > 100 ? r.diagnosis.substring(0, 100) + '...' : r.diagnosis,
      prescription_count: r._count.prescriptions,
      follow_up_date: r.follow_up_date,
      created_at: r.created_at,
    }))
  };
}

export async function getPatientPrescriptions(
  patientId: string,
  options: { page: number; limit: number; from?: string; to?: string },
  user: UserContext
) {
  const filters = {
    page: options.page,
    limit: options.limit,
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined,
  };

  const result = await medicalRepo.getPatientPrescriptions(patientId, user.hospital_id, filters);

  return {
    ...result,
    data: result.data.map((p: any) => ({
      prescription_id: p.prescription_id,
      medicine_name: p.medicine_name,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
      instructions: p.instructions,
      prescribed_by: p.medical_record.doctor.name,
      prescribed_on: p.medical_record.created_at,
      record_id: p.record_id,
    }))
  };
}

export async function getDoctorMedicalRecords(
  options: { doctor_id: string; page: number; limit: number; from?: string; to?: string; patient_id?: string },
  user: UserContext
) {
  let targetDoctorId = options.doctor_id;

  // Doctors can only query their own history
  if (user.role === 'Doctor') {
    const ownDoctorId = await getSelfDoctorId(user);
    if (ownDoctorId !== targetDoctorId) {
      throw new AppError('You can only view your own medical records.', 403, 'ACCESS_DENIED');
    }
  }

  const filters = {
    page: options.page,
    limit: options.limit,
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined,
    patient_id: options.patient_id,
  };

  const result = await medicalRepo.getDoctorMedicalRecords(targetDoctorId, user.hospital_id, filters);

  return {
    ...result,
    data: result.data.map((r: any) => ({
      record_id: r.record_id,
      patient_name: r.patient.name,
      session_date: r.appointment.session.session_date,
      diagnosis_preview: r.diagnosis.length > 100 ? r.diagnosis.substring(0, 100) + '...' : r.diagnosis,
      prescription_count: r._count.prescriptions,
      follow_up_date: r.follow_up_date,
      created_at: r.created_at,
    }))
  };
}

export async function getPrintData(recordId: string, user: UserContext) {
  const data = await medicalRepo.getPrintData(recordId, user.hospital_id);
  if (!data) {
    throw new AppError('Medical record not found.', 404, 'RECORD_NOT_FOUND');
  }

  // Apply doctor guard if Doctor role
  if (user.role === 'Doctor') {
    const doctorId = await medicalRepo.getUserDoctorId(user.user_id, user.hospital_id);
    if (data.doctor_id !== doctorId) {
      throw new AppError('Medical record not found.', 404, 'RECORD_NOT_FOUND');
    }
  }

  return {
    hospital: {
      name: data.hospital.name,
      address: data.hospital.address,
      contact_number: data.hospital.contact_number,
    },
    record_id: data.record_id,
    print_reference: `MR-${data.record_id.slice(-8).toUpperCase()}`,
    printed_at: new Date(),
    patient: {
      name: data.patient.name,
      nic: data.patient.nic,
      phone: data.patient.phone,
      // @ts-ignore
      age: data.patient.profile?.age,
      // @ts-ignore
      gender: data.patient.profile?.gender,
      // @ts-ignore
      address: data.patient.profile?.address,
    },
    doctor: {
      name: data.doctor.name,
      specialization: data.doctor.specialization,
      // @ts-ignore
      qualifications: data.doctor.profile?.qualifications,
    },
    appointment: {
      session_date: data.appointment.session?.session_date,
      slot_time: data.appointment.slot?.slot_time,
      // @ts-ignore
      branch_name: data.appointment.session?.branch?.name,
      queue_display: data.appointment.queue_number,
    },
    diagnosis: data.diagnosis,
    notes: data.notes,
    follow_up_date: data.follow_up_date,
    prescriptions: data.prescriptions.map((p: any) => ({
      medicine_name: p.medicine_name,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
      instructions: p.instructions,
    })),
  };
}

// ── Transformers ─────────────────────────────────────────────────────────────

function formatFullRecord(record: any) {
  return {
    record_id: record.record_id,
    appointment: {
      appointment_id: record.appointment.appointment_id,
      queue_display: record.appointment.queue_number,
      session_date: record.appointment.session.session_date,
      slot_time: record.appointment.slot?.slot_time,
      branch_name: record.appointment.session.branch.name,
    },
    patient: {
      patient_id: record.patient.patient_id,
      name: record.patient.name,
      nic: record.patient.nic,
      phone: record.patient.phone,
    },
    doctor: {
      doctor_id: record.doctor.doctor_id,
      name: record.doctor.name,
      specialization: record.doctor.specialization,
    },
    diagnosis: record.diagnosis,
    notes: record.notes,
    follow_up_date: record.follow_up_date,
    metadata: record.metadata,
    prescriptions: record.prescriptions,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}
