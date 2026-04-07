// ──────────────────────────────────────────────────────────────────────────────
// Report Routes
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get(
  '/appointments/daily',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  reportController.getDailyAppointments
);

router.get(
  '/appointments/monthly',
  authorize('Hospital Admin', 'Super Admin'),
  reportController.getMonthlyAppointments
);

router.get(
  '/appointments/doctor-wise',
  authorize('Hospital Admin', 'Super Admin'),
  reportController.getDoctorWiseAppointments
);

router.get(
  '/appointments/cancelled',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  reportController.getCancelledAppointments
);

router.get(
  '/patients/summary',
  authorize('Hospital Admin', 'Super Admin'),
  reportController.getPatientSummary
);

router.get(
  '/doctors/performance',
  authorize('Hospital Admin', 'Super Admin'),
  reportController.getDoctorPerformance
);

export default router;
