// ──────────────────────────────────────────────────────────────────────────────
// Patient Routes — CRUD + appointments for patients.
//
// Mounted at: /api/v1/patients
//
// Role access:
//   POST   /             → Receptionist, Hospital Admin, Super Admin
//   GET    /             → Receptionist, Doctor, Hospital Admin, Super Admin
//   GET    /:id          → All authenticated roles
//   PUT    /:id          → Receptionist, Hospital Admin, Super Admin
//   GET    /:id/appointments → Receptionist, Doctor, Hospital Admin, Super Admin
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createPatientSchema,
  updatePatientSchema,
  listPatientsQuerySchema,
  patientIdParamSchema,
} from './patient.validation';
import * as patientController from './patient.controller';

const router = Router();

// All patient routes require authentication
router.use(authenticate);

// POST /api/v1/patients — create patient
router.post(
  '/',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  validate({ body: createPatientSchema }),
  patientController.createPatient,
);

// GET /api/v1/patients — list with search + pagination
router.get(
  '/',
  authorize('Receptionist', 'Doctor', 'Hospital Admin', 'Super Admin'),
  validate({ query: listPatientsQuerySchema }),
  patientController.listPatients,
);

// GET /api/v1/patients/:id — get single patient
router.get(
  '/:id',
  validate({ params: patientIdParamSchema }),
  patientController.getPatientById,
);

// PUT /api/v1/patients/:id — update patient
router.put(
  '/:id',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  validate({ params: patientIdParamSchema, body: updatePatientSchema }),
  patientController.updatePatient,
);

// GET /api/v1/patients/:id/appointments — appointment history
router.get(
  '/:id/appointments',
  authorize('Receptionist', 'Doctor', 'Hospital Admin', 'Super Admin'),
  validate({ params: patientIdParamSchema }),
  patientController.getPatientAppointments,
);

export default router;
