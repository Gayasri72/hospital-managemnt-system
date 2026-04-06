// ──────────────────────────────────────────────────────────────────────────────
// Medical Repository — Data access layer for medical records and prescriptions
//
// Rules enforced here:
// - All records are scoped by hospital_id
// - Prescriptions are fully replaced on update
// - Transactions are used for atomic create/update
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PrescriptionData {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface CreateMedicalRecordData {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  hospital_id: string;
  diagnosis: string;
  notes?: string;
  follow_up_date?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateMedicalRecordData {
  diagnosis?: string;
  notes?: string;
  follow_up_date?: Date | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the doctor_id associated with a user account.
 */
export async function getUserDoctorId(
  user_id: string,
  hospital_id: string
): Promise<string | null> {
  const doctor = await prisma.doctor.findUnique({
    where: {
      user_id: user_id,
      hospital_id: hospital_id,
      status: 'active',
    },
    select: { doctor_id: true },
  });
  return doctor?.doctor_id ?? null;
}

/**
 * Write an entry to the audit log.
 */
export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string
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

// ── CRUD Operations ──────────────────────────────────────────────────────────

/**
 * Create a complete medical record with all prescriptions in a single transaction.
 */
export async function createMedicalRecord(
  data: CreateMedicalRecordData,
  prescriptions: PrescriptionData[]
) {
  return prisma.$transaction(async (tx) => {
    // 1. Create the base record
    const record = await tx.medicalRecord.create({
      data: {
        appointment_id: data.appointment_id,
        patient_id: data.patient_id,
        doctor_id: data.doctor_id,
        hospital_id: data.hospital_id,
        diagnosis: data.diagnosis,
        notes: data.notes || null,
        follow_up_date: data.follow_up_date || null,
        metadata: data.metadata || {},
      },
    });

    // 2. Create prescriptions if any
    let createdPrescriptions: any[] = [];
    if (prescriptions && prescriptions.length > 0) {
      const pData = prescriptions.map((p) => ({
        record_id: record.record_id,
        patient_id: data.patient_id,
        hospital_id: data.hospital_id,
        medicine_name: p.medicine_name,
        dosage: p.dosage,
        frequency: p.frequency,
        duration: p.duration,
        instructions: p.instructions || null,
      }));

      await tx.prescription.createMany({
        data: pData,
      });

      // Fetch them back since createMany doesn't return created rows
      createdPrescriptions = await tx.prescription.findMany({
        where: { record_id: record.record_id },
        orderBy: { created_at: 'asc' },
      });
    }

    return { ...record, prescriptions: createdPrescriptions };
  });
}

/**
 * Update medical record and fully replace prescriptions.
 */
export async function updateMedicalRecord(
  recordId: string,
  hospitalId: string,
  data: UpdateMedicalRecordData,
  prescriptions?: PrescriptionData[]
) {
  return prisma.$transaction(async (tx) => {
    // Update record fields
    const record = await tx.medicalRecord.update({
      where: {
        record_id: recordId,
        hospital_id: hospitalId, // scope check
      },
      data: {
        ...(data.diagnosis !== undefined && { diagnosis: data.diagnosis }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.follow_up_date !== undefined && { follow_up_date: data.follow_up_date }),
      },
    });

    // If prescriptions array is provided, replace all
    if (prescriptions !== undefined) {
      // Delete old prescriptions
      await tx.prescription.deleteMany({
        where: { record_id: recordId },
      });

      // Insert new ones
      if (prescriptions.length > 0) {
        const pData = prescriptions.map((p) => ({
          record_id: record.record_id,
          patient_id: record.patient_id,
          hospital_id: record.hospital_id,
          medicine_name: p.medicine_name,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: p.duration,
          instructions: p.instructions || null,
        }));

        await tx.prescription.createMany({
          data: pData,
        });
      }
    }

    // Fetch the updated full record
    return tx.medicalRecord.findUniqueOrThrow({
      where: { record_id: recordId },
      include: {
        prescriptions: { orderBy: { created_at: 'asc' } },
      },
    });
  });
}

/**
 * Get single record by ID with full relations.
 */
export async function getMedicalRecordById(recordId: string, hospitalId: string) {
  return prisma.medicalRecord.findFirst({
    where: {
      record_id: recordId,
      hospital_id: hospitalId,
    },
    include: {
      prescriptions: { orderBy: { created_at: 'asc' } },
      appointment: {
        include: {
          session: {
            include: { branch: true },
          },
          slot: true,
        },
      },
      patient: true,
      doctor: true,
    },
  });
}

/**
 * Lookup medical record by appointment ID.
 */
export async function getMedicalRecordByAppointmentId(appointmentId: string, hospitalId: string) {
  return prisma.medicalRecord.findUnique({
    where: { appointment_id: appointmentId, hospital_id: hospitalId },
    include: {
      prescriptions: { orderBy: { created_at: 'asc' } },
      appointment: {
        include: {
          session: {
            include: { branch: true },
          },
          slot: true,
        },
      },
      patient: true,
      doctor: true,
    },
  });
}

// ── Query Operations ─────────────────────────────────────────────────────────

export async function getPatientMedicalHistory(
  patientId: string,
  hospitalId: string,
  options: {
    page: number;
    limit: number;
    from?: Date;
    to?: Date;
    doctor_id?: string;
  }
) {
  const { page, limit, from, to, doctor_id } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {
    patient_id: patientId,
    hospital_id: hospitalId,
  };

  if (doctor_id) {
    where.doctor_id = doctor_id;
  }

  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = from;
    if (to) where.created_at.lte = to;
  }

  const [records, total] = await Promise.all([
    prisma.medicalRecord.findMany({
      where,
      include: {
        _count: { select: { prescriptions: true } },
        doctor: { select: { name: true, specialization: true } },
        appointment: {
          include: {
            session: { include: { branch: { select: { name: true } } } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.medicalRecord.count({ where }),
  ]);

  return { data: records, total, page, limit };
}

export async function getPatientPrescriptions(
  patientId: string,
  hospitalId: string,
  options: {
    page: number;
    limit: number;
    from?: Date;
    to?: Date;
  }
) {
  const { page, limit, from, to } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {
    patient_id: patientId,
    hospital_id: hospitalId,
  };

  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = from;
    if (to) where.created_at.lte = to;
  }

  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      include: {
        medical_record: {
          select: {
            created_at: true,
            doctor: { select: { name: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prescription.count({ where }),
  ]);

  return { data: prescriptions, total, page, limit };
}

export async function getDoctorMedicalRecords(
  doctorId: string,
  hospitalId: string,
  options: {
    page: number;
    limit: number;
    from?: Date;
    to?: Date;
    patient_id?: string;
  }
) {
  const { page, limit, from, to, patient_id } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, any> = {
    doctor_id: doctorId,
    hospital_id: hospitalId,
  };

  if (patient_id) {
    where.patient_id = patient_id;
  }

  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = from;
    if (to) where.created_at.lte = to;
  }

  const [records, total] = await Promise.all([
    prisma.medicalRecord.findMany({
      where,
      include: {
        _count: { select: { prescriptions: true } },
        patient: { select: { name: true, nic: true } },
        appointment: {
          include: {
            session: { select: { session_date: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.medicalRecord.count({ where }),
  ]);

  return { data: records, total, page, limit };
}

export async function getPrintData(recordId: string, hospitalId: string) {
  return prisma.medicalRecord.findFirst({
    where: {
      record_id: recordId,
      hospital_id: hospitalId, // explicit scope!
    },
    include: {
      prescriptions: { orderBy: { created_at: 'asc' } },
      hospital: true,
      patient: {
        include: { profile: true },
      },
      doctor: {
        include: { profile: true },
      },
      appointment: {
        include: {
          session: {
            include: { branch: true },
          },
          slot: true,
        },
      },
    },
  });
}
