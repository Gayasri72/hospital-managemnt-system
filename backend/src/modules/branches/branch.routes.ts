// ──────────────────────────────────────────────────────────────────────────────
// Branch Routes — read-only endpoints for listing hospital branches.
//
// Mounted at: /api/v1/branches
//
// All routes require authentication. Any authenticated role can read branches
// (needed for session and appointment booking flows).
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { branchIdParamSchema } from './branch.validation';
import * as ctrl from './branch.controller';

export const branchRouter = Router();
branchRouter.use(authenticate);

// GET /api/v1/branches — list all branches for the user's hospital
branchRouter.get('/', ctrl.listBranches);

// GET /api/v1/branches/:id — get single branch
branchRouter.get(
  '/:id',
  validate({ params: branchIdParamSchema }),
  ctrl.getBranchById,
);
