// ──────────────────────────────────────────────────────────────────────────────
// Appointment Routes — 8 endpoints for appointment booking and management.
//
// Mounted at: /api/v1/appointments
// Session queue endpoint is added to session routes separately.
//
// All routes require authentication.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createAppointmentSchema,
  updateStatusSchema,
  rescheduleSchema,
  listAppointmentsQuerySchema,
  appointmentIdParamSchema,
} from './appointment.validation';
import * as ctrl from './appointment.controller';

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);

// ── IMPORTANT: /today must come BEFORE /:id to avoid route conflict ──────────

// GET /api/v1/appointments/today
appointmentRouter.get(
  '/today',
  authorize('Receptionist', 'Doctor', 'Hospital Admin', 'Super Admin'),
  ctrl.getTodayAppointments,
);

// POST /api/v1/appointments
appointmentRouter.post(
  '/',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  validate({ body: createAppointmentSchema }),
  ctrl.createAppointment,
);

// GET /api/v1/appointments
appointmentRouter.get(
  '/',
  validate({ query: listAppointmentsQuerySchema }),
  ctrl.listAppointments,
);

// GET /api/v1/appointments/:id
appointmentRouter.get(
  '/:id',
  validate({ params: appointmentIdParamSchema }),
  ctrl.getAppointmentById,
);

// PATCH /api/v1/appointments/:id/status
appointmentRouter.patch(
  '/:id/status',
  validate({ params: appointmentIdParamSchema, body: updateStatusSchema }),
  ctrl.updateAppointmentStatus,
);

// POST /api/v1/appointments/:id/reschedule
appointmentRouter.post(
  '/:id/reschedule',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  validate({ params: appointmentIdParamSchema, body: rescheduleSchema }),
  ctrl.rescheduleAppointment,
);

// GET /api/v1/appointments/:id/receipt-data
appointmentRouter.get(
  '/:id/receipt-data',
  authorize('Receptionist', 'Accountant', 'Hospital Admin', 'Super Admin'),
  validate({ params: appointmentIdParamSchema }),
  ctrl.getReceiptData,
);
