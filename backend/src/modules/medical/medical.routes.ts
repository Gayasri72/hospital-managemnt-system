import { Router } from 'express';
import * as controller from './medical.controller';
import * as validator from './medical.validation';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

// Define Role constants based on the prompt access rules
const ROLE_DOCTOR = 'Doctor';
const ROLE_ADMIN = 'Hospital Admin';
const ROLE_SUPER_ADMIN = 'Super Admin';
const ROLE_RECEPTIONIST = 'Receptionist';

// Require Authentication for all routes
router.use(authenticate);

// ── Write Endpoints ──────────────────────────────────────────────────────────

// POST /api/v1/medical-records
router.post(
  '/medical-records',
  authorize(ROLE_DOCTOR, ROLE_ADMIN),
  validator.validateCreateMedicalRecord,
  controller.createMedicalRecord
);

// PUT /api/v1/medical-records/:id
router.put(
  '/medical-records/:id',
  authorize(ROLE_DOCTOR, ROLE_ADMIN),
  validator.validateUpdateMedicalRecord,
  controller.updateMedicalRecord
);

// ── Read Endpoints ───────────────────────────────────────────────────────────

// GET /api/v1/medical-records/appointment/:appointment_id
router.get(
  '/medical-records/appointment/:appointment_id',
  authorize(ROLE_DOCTOR, ROLE_ADMIN, ROLE_SUPER_ADMIN),
  controller.getMedicalRecordByAppointmentId
);

// GET /api/v1/medical-records/:id/print
router.get(
  '/medical-records/:id/print',
  authorize(ROLE_DOCTOR, ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_RECEPTIONIST),
  controller.getPrintData
);

// GET /api/v1/medical-records/:id
router.get(
  '/medical-records/:id',
  authorize(ROLE_DOCTOR, ROLE_ADMIN, ROLE_SUPER_ADMIN),
  controller.getMedicalRecordById
);

// GET /api/v1/patients/:patient_id/medical-records
router.get(
  '/patients/:patient_id/medical-records', 
  authorize(ROLE_DOCTOR, ROLE_ADMIN, ROLE_SUPER_ADMIN),
  controller.getPatientMedicalHistory
);

// GET /api/v1/patients/:patient_id/prescriptions
router.get(
  '/patients/:patient_id/prescriptions', 
  authorize(ROLE_DOCTOR, ROLE_ADMIN, ROLE_SUPER_ADMIN),
  controller.getPatientPrescriptions
);

// GET /api/v1/doctors/:doctor_id/medical-records
router.get(
  '/doctors/:doctor_id/medical-records', 
  authorize(ROLE_DOCTOR, ROLE_ADMIN, ROLE_SUPER_ADMIN),
  controller.getDoctorMedicalRecords
);

export default router;
