// ──────────────────────────────────────────────────────────────────────────────
// Branch Routes — read-only endpoints for listing hospital branches.
//
// Mounted at: /api/v1/branches
//
// All routes require authentication. Any authenticated role can read branches
// (needed for session and appointment booking flows).
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { ROLES } from '../../constants/roles';
import { branchIdParamSchema, createBranchSchema, updateBranchSchema } from './branch.validation';
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

// POST /api/v1/branches — create a branch (admin only)
branchRouter.post(
  '/',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ body: createBranchSchema }),
  ctrl.createBranch,
);

// PUT /api/v1/branches/:id — update a branch (admin only)
branchRouter.put(
  '/:id',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: branchIdParamSchema, body: updateBranchSchema }),
  ctrl.updateBranch,
);

// DELETE /api/v1/branches/:id — delete a branch (admin only)
branchRouter.delete(
  '/:id',
  authorize(ROLES.HOSPITAL_ADMIN, ROLES.SUPER_ADMIN),
  validate({ params: branchIdParamSchema }),
  ctrl.deleteBranch,
);
