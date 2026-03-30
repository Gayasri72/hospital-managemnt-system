// ──────────────────────────────────────────────────────────────────────────────
// Appointment Validation — Zod schemas for all appointment endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid appointment ID format'),
});

// ── POST /api/v1/appointments ────────────────────────────────────────────────

export const createAppointmentSchema = z.object({
  patient_id: z.string({ required_error: 'Patient ID is required' }).uuid('Invalid patient ID'),
  session_id: z.string({ required_error: 'Session ID is required' }).uuid('Invalid session ID'),
  slot_id: z.string().uuid('Invalid slot ID').optional(),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// ── PATCH /api/v1/appointments/:id/status ────────────────────────────────────

export const updateStatusSchema = z.object({
  status: z.enum(
    ['confirmed', 'arrived', 'completed', 'cancelled', 'no_show'],
    { errorMap: () => ({ message: 'Status must be confirmed, arrived, completed, cancelled, or no_show' }) },
  ),
  reason: z.string().max(255, 'Reason must be 255 characters or less').optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

// ── POST /api/v1/appointments/:id/reschedule ─────────────────────────────────

export const rescheduleSchema = z.object({
  new_session_id: z.string({ required_error: 'New session ID is required' }).uuid('Invalid session ID'),
  new_slot_id: z.string().uuid('Invalid slot ID').optional(),
});

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

// ── GET /api/v1/appointments ─────────────────────────────────────────────────

export const listAppointmentsQuerySchema = z.object({
  patient_id: z.string().uuid().optional(),
  doctor_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  status: z.string().optional(),
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

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

// ── GET /api/v1/sessions/:id/queue (reuse session param) ─────────────────────

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session ID format'),
});
