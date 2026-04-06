import { z } from 'zod';
import { validate } from '../../middleware/validate';

// ── Prescription Schema ──────────────────────────────────────────────────────

const prescriptionSchema = z.object({
  medicine_name: z.string().min(2, 'Medicine name must be at least 2 characters').max(200),
  dosage: z.string().min(1, 'Dosage is required').max(100),
  frequency: z.string().min(1, 'Frequency is required').max(100),
  duration: z.string().min(1, 'Duration is required').max(100),
  instructions: z.string().max(500).optional().nullable(),
});

// ── Create Medical Record ────────────────────────────────────────────────────

const createMedicalRecordSchema = z.object({
  appointment_id: z.string().uuid('Invalid appointment ID'),
  diagnosis: z.string().min(5, 'Diagnosis must be at least 5 characters').max(2000),
  notes: z.string().max(5000).optional().nullable(),
  follow_up_date: z.string().date().optional().nullable(),
  prescriptions: z.array(prescriptionSchema).optional(),
});

export const validateCreateMedicalRecord = validate({ body: createMedicalRecordSchema });

// ── Update Medical Record ────────────────────────────────────────────────────

const updateMedicalRecordSchema = z.object({
  diagnosis: z.string().min(5, 'Diagnosis must be at least 5 characters').max(2000).optional(),
  notes: z.string().max(5000).optional().nullable(),
  follow_up_date: z.string().date().optional().nullable(),
  prescriptions: z.array(prescriptionSchema).optional(),
});

export const validateUpdateMedicalRecord = validate({ body: updateMedicalRecordSchema });
