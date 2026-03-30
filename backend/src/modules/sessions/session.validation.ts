// ──────────────────────────────────────────────────────────────────────────────
// Session Validation — Zod schemas for all session endpoint inputs.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
});

// ── POST /api/v1/sessions ────────────────────────────────────────────────────

export const createSessionSchema = z
  .object({
    doctor_id: z.string({ required_error: 'Doctor ID is required' }).uuid('Invalid doctor ID'),
    branch_id: z.string({ required_error: 'Branch ID is required' }).uuid('Invalid branch ID'),
    session_date: z
      .string({ required_error: 'Session date is required' })
      .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date (YYYY-MM-DD)'),
    start_time: z
      .string({ required_error: 'Start time is required' })
      .regex(timeRegex, 'Must be HH:MM format (24hr)'),
    end_time: z
      .string({ required_error: 'End time is required' })
      .regex(timeRegex, 'Must be HH:MM format (24hr)'),
    slot_duration: z
      .number({ invalid_type_error: 'Slot duration must be a number' })
      .int()
      .min(5, 'Slot duration must be at least 5 minutes')
      .max(60, 'Slot duration must be at most 60 minutes')
      .default(10),
    max_patients: z
      .number({ invalid_type_error: 'Max patients must be a number' })
      .int()
      .min(1, 'Must have at least 1 patient slot')
      .optional(),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: 'end_time must be after start_time',
    path: ['end_time'],
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

// ── PUT /api/v1/sessions/:id ─────────────────────────────────────────────────

export const updateSessionSchema = z.object({
  start_time: z.string().regex(timeRegex, 'Must be HH:MM format').optional(),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM format').optional(),
  slot_duration: z.number().int().min(5).max(60).optional(),
  max_patients: z.number().int().min(1).optional(),
  status: z.enum(['scheduled', 'open', 'full', 'closed', 'cancelled']).optional(),
});

export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

// ── PATCH /api/v1/sessions/:id/status ────────────────────────────────────────

export const updateStatusSchema = z.object({
  status: z.enum(['open', 'closed', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be open, closed, or cancelled' }),
  }),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// ── GET /api/v1/sessions ─────────────────────────────────────────────────────

export const listSessionsQuerySchema = z.object({
  doctor_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  to: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

// ── GET /api/v1/sessions/available ───────────────────────────────────────────

export const availableSessionsQuerySchema = z.object({
  doctor_id: z.string().uuid().optional(),
  specialization: z.string().optional(),
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  to: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AvailableSessionsQuery = z.infer<typeof availableSessionsQuerySchema>;

// ── GET /api/v1/doctors/:id/sessions ─────────────────────────────────────────

export const doctorSessionsQuerySchema = z.object({
  from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  to: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  status: z.string().optional(),
});

export type DoctorSessionsQuery = z.infer<typeof doctorSessionsQuerySchema>;
