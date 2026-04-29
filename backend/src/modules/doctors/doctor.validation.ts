// ──────────────────────────────────────────────────────────────────────────────
// Doctor Validation — Zod schemas for all doctor-related endpoint inputs.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// ── Shared ───────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

/** HH:MM format */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const doctorIdParamSchema = z.object({
  id: z.string().uuid('Invalid doctor ID format'),
});

export const exceptionIdParamSchema = z.object({
  id: z.string().uuid('Invalid doctor ID format'),
  exception_id: z.string().uuid('Invalid exception ID format'),
});

// ── POST /api/v1/doctors ─────────────────────────────────────────────────────

export const createDoctorSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(2, 'Name must be at least 2 characters'),
  specialization: z
    .string({ required_error: 'Specialization is required' })
    .min(1, 'Specialization is required'),
  contact_number: z.string().optional(),
  email: z
    .string()
    .email('Please provide a valid email address')
    .optional()
    .or(z.literal('')),
  qualifications: z.string().optional(),
  experience: z.string().optional(),
  bio: z.string().optional(),
  consultation_fee: z
    .number({ required_error: 'Consultation fee is required', invalid_type_error: 'Fee must be a number' })
    .min(0, 'Fee must be 0 or greater'),
  effective_from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  // ── Optional login account creation ──
  create_login: z.boolean().optional().default(false),
  login_email: z
    .string()
    .email('Please provide a valid login email')
    .transform((val) => val.toLowerCase().trim())
    .optional(),
  login_password: z
    .string()
    .min(6, 'Login password must be at least 6 characters')
    .optional(),
}).refine(
  (data) => {
    if (data.create_login) {
      return !!data.login_email && !!data.login_password;
    }
    return true;
  },
  {
    message: 'login_email and login_password are required when create_login is true',
    path: ['login_email'],
  },
);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

// ── PUT /api/v1/doctors/:id ──────────────────────────────────────────────────

export const updateDoctorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  specialization: z.string().min(1).optional(),
  contact_number: z.string().optional(),
  email: z.string().email('Please provide a valid email').optional().or(z.literal('')),
  qualifications: z.string().optional(),
  experience: z.string().optional(),
  bio: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

// ── GET /api/v1/doctors ──────────────────────────────────────────────────────

export const listDoctorsQuerySchema = z.object({
  search: z.string().optional(),
  specialization: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListDoctorsQuery = z.infer<typeof listDoctorsQuerySchema>;

// ── POST /api/v1/doctors/:id/fees ────────────────────────────────────────────

export const createFeeSchema = z.object({
  consultation_fee: z
    .number({ required_error: 'Consultation fee is required', invalid_type_error: 'Fee must be a number' })
    .min(0, 'Fee must be 0 or greater'),
  effective_from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
});

export type CreateFeeInput = z.infer<typeof createFeeSchema>;

// ── POST /api/v1/hospital/charges ────────────────────────────────────────────

export const createHospitalChargeSchema = z.object({
  charge_amount: z
    .number({ required_error: 'Charge amount is required', invalid_type_error: 'Charge must be a number' })
    .min(0, 'Charge must be 0 or greater'),
  effective_from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
});

export type CreateHospitalChargeInput = z.infer<typeof createHospitalChargeSchema>;

// ── POST /api/v1/doctors/:id/availability ────────────────────────────────────

const scheduleItemSchema = z.object({
  day_of_week: z.enum(DAYS_OF_WEEK, {
    errorMap: () => ({ message: 'Must be a valid day (Monday–Sunday)' }),
  }),
  start_time: z
    .string({ required_error: 'Start time is required' })
    .regex(timeRegex, 'Must be HH:MM format (e.g., 18:00)'),
  end_time: z
    .string({ required_error: 'End time is required' })
    .regex(timeRegex, 'Must be HH:MM format (e.g., 21:00)'),
});

export const setAvailabilitySchema = z.object({
  schedule: z
    .array(scheduleItemSchema)
    .min(1, 'At least one schedule item is required')
    .refine(
      (items) => {
        // Check for duplicate days
        const days = items.map((i) => i.day_of_week);
        return new Set(days).size === days.length;
      },
      { message: 'Duplicate days are not allowed in the same schedule' },
    )
    .refine(
      (items) => {
        // Check end_time > start_time for each item
        return items.every((i) => i.end_time > i.start_time);
      },
      { message: 'end_time must be after start_time for all schedule items' },
    ),
});

export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;

// ── POST /api/v1/doctors/:id/exceptions ──────────────────────────────────────

export const createExceptionSchema = z.object({
  exception_date: z
    .string({ required_error: 'Exception date is required' })
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .refine(
      (val) => new Date(val) > new Date(new Date().toDateString()),
      'Exception date must be in the future',
    ),
  reason: z.string().optional(),
});

export type CreateExceptionInput = z.infer<typeof createExceptionSchema>;

// ── GET /api/v1/doctors/:id/exceptions ───────────────────────────────────────

export const listExceptionsQuerySchema = z.object({
  from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  to: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
});

export type ListExceptionsQuery = z.infer<typeof listExceptionsQuerySchema>;
