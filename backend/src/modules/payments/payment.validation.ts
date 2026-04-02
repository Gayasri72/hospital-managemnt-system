// ──────────────────────────────────────────────────────────────────────────────
// Payment Validation — Zod schemas for all payment/billing endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

const PAYMENT_METHODS = ['cash', 'card', 'online', 'insurance'] as const;

export const paymentIdParamSchema = z.object({
  id: z.string().uuid('Invalid payment ID format'),
});

export const appointmentIdParamSchema = z.object({
  appointment_id: z.string().uuid('Invalid appointment ID format'),
});

// ── POST /api/v1/payments ────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  appointment_id: z
    .string({ required_error: 'Appointment ID is required' })
    .uuid('Invalid appointment ID'),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ── POST /api/v1/payments/:id/transactions ───────────────────────────────────

export const addTransactionSchema = z.object({
  method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Method must be cash, card, online, or insurance' }),
  }),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .multipleOf(0.01, 'Amount cannot have more than 2 decimal places'),
  reference: z.string().max(100, 'Reference must be 100 characters or less').optional(),
  note: z.string().max(255, 'Note must be 255 characters or less').optional(),
});

export type AddTransactionInput = z.infer<typeof addTransactionSchema>;

// ── POST /api/v1/payments/:id/refund ─────────────────────────────────────────

export const refundSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Refund amount must be greater than 0')
    .multipleOf(0.01, 'Amount cannot have more than 2 decimal places'),
  method: z.enum(PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Method must be cash, card, online, or insurance' }),
  }),
  reason: z
    .string({ required_error: 'Reason is required for refunds' })
    .min(5, 'Reason must be at least 5 characters')
    .max(255, 'Reason must be 255 characters or less'),
  reference: z.string().max(100, 'Reference must be 100 characters or less').optional(),
});

export type RefundInput = z.infer<typeof refundSchema>;

// ── GET /api/v1/payments ─────────────────────────────────────────────────────

export const listPaymentsQuerySchema = z.object({
  status: z.enum(['pending', 'partial', 'paid', 'refunded']).optional(),
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
  doctor_id: z.string().uuid().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

// ── GET /api/v1/reports/revenue/daily ────────────────────────────────────────

export const dailyRevenueQuerySchema = z.object({
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
});

export type DailyRevenueQuery = z.infer<typeof dailyRevenueQuerySchema>;

// ── GET /api/v1/reports/revenue/monthly ──────────────────────────────────────

export const monthlyRevenueQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2030).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export type MonthlyRevenueQuery = z.infer<typeof monthlyRevenueQuerySchema>;

// ── GET /api/v1/reports/revenue/doctor ───────────────────────────────────────

export const doctorRevenueQuerySchema = z.object({
  doctor_id: z.string({ required_error: 'Doctor ID is required' }).uuid('Invalid doctor ID'),
  from: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
  to: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Must be a valid date')
    .optional(),
});

export type DoctorRevenueQuery = z.infer<typeof doctorRevenueQuerySchema>;
