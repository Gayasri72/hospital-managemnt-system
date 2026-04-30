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
import { ROLES } from '../../constants/roles';
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
  authorize(ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  ctrl.getTodayAppointments,
);

// POST /api/v1/appointments
appointmentRouter.post(
  '/',
  authorize(ROLES.RECEPTIONIST, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ body: createAppointmentSchema }),
  ctrl.createAppointment,
);

// GET /api/v1/appointments
appointmentRouter.get(
  '/',
  authorize(ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT),
  validate({ query: listAppointmentsQuerySchema }),
  ctrl.listAppointments,
);

// GET /api/v1/appointments/:id
appointmentRouter.get(
  '/:id',
  authorize(ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT),
  validate({ params: appointmentIdParamSchema }),
  ctrl.getAppointmentById,
);

// PATCH /api/v1/appointments/:id/status
appointmentRouter.patch(
  '/:id/status',
  authorize(ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: appointmentIdParamSchema, body: updateStatusSchema }),
  ctrl.updateAppointmentStatus,
);

// POST /api/v1/appointments/:id/reschedule
appointmentRouter.post(
  '/:id/reschedule',
  authorize(ROLES.RECEPTIONIST, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: appointmentIdParamSchema, body: rescheduleSchema }),
  ctrl.rescheduleAppointment,
);

// GET /api/v1/appointments/:id/receipt-data
appointmentRouter.get(
  '/:id/receipt-data',
  authorize(ROLES.RECEPTIONIST, ROLES.ACCOUNTANT, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: appointmentIdParamSchema }),
  ctrl.getReceiptData,
);
