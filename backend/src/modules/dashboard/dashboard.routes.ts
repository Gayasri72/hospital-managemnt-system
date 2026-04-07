// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Routes
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as dashboardController from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', dashboardController.getDashboard);

export default router;
