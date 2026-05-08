// ──────────────────────────────────────────────────────────────────────────────
// Payment Routes — 10 endpoints for billing, payments, and revenue reports.
//
// Mounted at:
//   /api/v1/payments   — payment endpoints (7)
//   /api/v1/reports    — revenue report endpoints (4)
//
// All routes require authentication.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { ROLES } from '../../constants/roles';
import { validate } from '../../middleware/validate';
import {
  createPaymentSchema,
  addTransactionSchema,
  refundSchema,
  listPaymentsQuerySchema,
  paymentIdParamSchema,
  appointmentIdParamSchema,
  dailyRevenueQuerySchema,
  monthlyRevenueQuerySchema,
  doctorRevenueQuerySchema,
} from './payment.validation';
import * as ctrl from './payment.controller';

// ── Payment Router (/api/v1/payments) ────────────────────────────────────────

export const paymentRouter = Router();
paymentRouter.use(authenticate);

// IMPORTANT: /appointment/:appointment_id must come BEFORE /:id
paymentRouter.get(
  '/appointment/:appointment_id',
  authorize(ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: appointmentIdParamSchema }),
  ctrl.getPaymentByAppointment,
);

// POST /api/v1/payments — create payment for completed appointment
paymentRouter.post(
  '/',
  authorize(ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ body: createPaymentSchema }),
  ctrl.createPayment,
);

// GET /api/v1/payments — list with filters
paymentRouter.get(
  '/',
  authorize(ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ query: listPaymentsQuerySchema }),
  ctrl.listPayments,
);

// GET /api/v1/payments/:id — get payment details
paymentRouter.get(
  '/:id',
  authorize(ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: paymentIdParamSchema }),
  ctrl.getPaymentById,
);

// POST /api/v1/payments/:id/transactions — record payment
paymentRouter.post(
  '/:id/transactions',
  authorize(ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: paymentIdParamSchema, body: addTransactionSchema }),
  ctrl.addTransaction,
);

// POST /api/v1/payments/:id/refund — issue refund
paymentRouter.post(
  '/:id/refund',
  authorize(ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: paymentIdParamSchema, body: refundSchema }),
  ctrl.issueRefund,
);

// POST /api/v1/payments/:id/recalculate — fix corrupted fee snapshot on pending payments
paymentRouter.post(
  '/:id/recalculate',
  authorize(ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: paymentIdParamSchema }),
  ctrl.recalculatePayment,
);

// ── Reports Router (/api/v1/reports) ─────────────────────────────────────────

export const reportsRouter = Router();
reportsRouter.use(authenticate);

// GET /api/v1/reports/revenue/summary — dashboard widget
reportsRouter.get(
  '/revenue/summary',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  ctrl.getRevenueSummary,
);

// GET /api/v1/reports/revenue/daily
reportsRouter.get(
  '/revenue/daily',
  authorize(ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ query: dailyRevenueQuerySchema }),
  ctrl.getDailyRevenue,
);

// GET /api/v1/reports/revenue/monthly
reportsRouter.get(
  '/revenue/monthly',
  authorize(ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ query: monthlyRevenueQuerySchema }),
  ctrl.getMonthlyRevenue,
);

// GET /api/v1/reports/revenue/doctor
reportsRouter.get(
  '/revenue/doctor',
  authorize(ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ query: doctorRevenueQuerySchema }),
  ctrl.getDoctorRevenue,
);
