// ──────────────────────────────────────────────────────────────────────────────
// Report Routes
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as reportController from './report.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { ROLES } from '../../constants/roles';

const router = Router();

router.use(authenticate);

router.get(
  '/appointments/daily',
  authorize(ROLES.RECEPTIONIST, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  reportController.getDailyAppointments
);

router.get(
  '/appointments/monthly',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  reportController.getMonthlyAppointments
);

router.get(
  '/appointments/doctor-wise',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  reportController.getDoctorWiseAppointments
);

router.get(
  '/appointments/cancelled',
  authorize(ROLES.RECEPTIONIST, ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  reportController.getCancelledAppointments
);

router.get(
  '/patients/summary',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  reportController.getPatientSummary
);

router.get(
  '/doctors/performance',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  reportController.getDoctorPerformance
);

export default router;
