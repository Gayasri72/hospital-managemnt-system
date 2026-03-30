// ──────────────────────────────────────────────────────────────────────────────
// Doctor Routes — 13 endpoints for doctor management + hospital charges.
//
// Mounted at: /api/v1/doctors (doctor routes)
//             /api/v1/hospital (hospital charge routes)
//
// All routes require authentication.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createDoctorSchema,
  updateDoctorSchema,
  listDoctorsQuerySchema,
  doctorIdParamSchema,
  exceptionIdParamSchema,
  createFeeSchema,
  createHospitalChargeSchema,
  setAvailabilitySchema,
  createExceptionSchema,
  listExceptionsQuerySchema,
} from './doctor.validation';
import * as ctrl from './doctor.controller';

// ── Doctor Routes (/api/v1/doctors) ──────────────────────────────────────────

export const doctorRouter = Router();
doctorRouter.use(authenticate);

// POST /api/v1/doctors
doctorRouter.post(
  '/',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ body: createDoctorSchema }),
  ctrl.createDoctor,
);

// GET /api/v1/doctors
doctorRouter.get(
  '/',
  validate({ query: listDoctorsQuerySchema }),
  ctrl.listDoctors,
);

// GET /api/v1/doctors/:id
doctorRouter.get(
  '/:id',
  validate({ params: doctorIdParamSchema }),
  ctrl.getDoctorById,
);

// PUT /api/v1/doctors/:id
doctorRouter.put(
  '/:id',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ params: doctorIdParamSchema, body: updateDoctorSchema }),
  ctrl.updateDoctor,
);

// ── Fee Routes ───────────────────────────────────────────────────────────────

// POST /api/v1/doctors/:id/fees
doctorRouter.post(
  '/:id/fees',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ params: doctorIdParamSchema, body: createFeeSchema }),
  ctrl.addDoctorFee,
);

// GET /api/v1/doctors/:id/fees
doctorRouter.get(
  '/:id/fees',
  authorize('Hospital Admin', 'Accountant', 'Super Admin'),
  validate({ params: doctorIdParamSchema }),
  ctrl.getDoctorFeeHistory,
);

// ── Availability Routes ──────────────────────────────────────────────────────

// POST /api/v1/doctors/:id/availability
doctorRouter.post(
  '/:id/availability',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ params: doctorIdParamSchema, body: setAvailabilitySchema }),
  ctrl.setAvailability,
);

// GET /api/v1/doctors/:id/availability
doctorRouter.get(
  '/:id/availability',
  validate({ params: doctorIdParamSchema }),
  ctrl.getAvailability,
);

// ── Exception Routes ─────────────────────────────────────────────────────────

// POST /api/v1/doctors/:id/exceptions
doctorRouter.post(
  '/:id/exceptions',
  authorize('Hospital Admin', 'Super Admin', 'Receptionist'),
  validate({ params: doctorIdParamSchema, body: createExceptionSchema }),
  ctrl.addException,
);

// GET /api/v1/doctors/:id/exceptions
doctorRouter.get(
  '/:id/exceptions',
  validate({ params: doctorIdParamSchema, query: listExceptionsQuerySchema }),
  ctrl.getExceptions,
);

// DELETE /api/v1/doctors/:id/exceptions/:exception_id
doctorRouter.delete(
  '/:id/exceptions/:exception_id',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ params: exceptionIdParamSchema }),
  ctrl.removeException,
);

// ── Doctor Sessions Route ────────────────────────────────────────────────────
// This endpoint is on the doctor router because it's /api/v1/doctors/:id/sessions
import * as sessionCtrl from '../sessions/session.controller';
import { doctorSessionsQuerySchema } from '../sessions/session.validation';

// GET /api/v1/doctors/:id/sessions
doctorRouter.get(
  '/:id/sessions',
  validate({ params: doctorIdParamSchema, query: doctorSessionsQuerySchema }),
  sessionCtrl.getDoctorSessions,
);

// ── Hospital Charge Routes (/api/v1/hospital) ────────────────────────────────

export const hospitalChargeRouter = Router();
hospitalChargeRouter.use(authenticate);

// POST /api/v1/hospital/charges
hospitalChargeRouter.post(
  '/charges',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ body: createHospitalChargeSchema }),
  ctrl.addHospitalCharge,
);

// GET /api/v1/hospital/charges/current
hospitalChargeRouter.get(
  '/charges/current',
  ctrl.getCurrentHospitalCharge,
);
