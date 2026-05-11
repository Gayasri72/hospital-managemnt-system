// ──────────────────────────────────────────────────────────────────────────────
// Branch Controller — thin HTTP handlers for branch endpoints.
//
// Controllers only:
//   1. Extract data from the request (params, req.user)
//   2. Call the repository
//   3. Send the response
// No business logic lives here.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/apiError';
import * as branchRepo from './branch.repository';
import type { BranchIdParam, CreateBranchInput, UpdateBranchInput } from './branch.validation';

/**
 * GET /api/v1/branches
 * List all branches for the authenticated user's hospital.
 */
export const listBranches = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const branches = await branchRepo.findByHospital(req.user.hospitalId);

  sendSuccess({
    res,
    message: 'Branches retrieved successfully',
    data: branches,
  });
});

/**
 * GET /api/v1/branches/:id
 * Get a single branch by ID, scoped to the user's hospital.
 */
export const getBranchById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const { id } = req.params as unknown as BranchIdParam;
  const branch = await branchRepo.findByIdInHospital(id, req.user.hospitalId);

  if (!branch) {
    throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
  }

  sendSuccess({
    res,
    message: 'Branch retrieved successfully',
    data: branch,
  });
});

/**
 * POST /api/v1/branches
 * Create a new branch for the authenticated user's hospital.
 */
export const createBranch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Authentication required.', 401);
  const { name, location } = req.body as CreateBranchInput;
  const branch = await branchRepo.createBranch(req.user.hospitalId, name, location);
  sendSuccess({ res, statusCode: 201, message: 'Branch created successfully', data: branch });
});

/**
 * PUT /api/v1/branches/:id
 * Update a branch scoped to the user's hospital.
 */
export const updateBranch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Authentication required.', 401);
  const { id } = req.params as unknown as BranchIdParam;
  const input = req.body as UpdateBranchInput;
  const result = await branchRepo.updateBranch(id, req.user.hospitalId, input);
  if (result.count === 0) throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
  const updated = await branchRepo.findByIdInHospital(id, req.user.hospitalId);
  sendSuccess({ res, message: 'Branch updated successfully', data: updated });
});

/**
 * DELETE /api/v1/branches/:id
 * Delete a branch scoped to the user's hospital.
 */
export const deleteBranch = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Authentication required.', 401);
  const { id } = req.params as unknown as BranchIdParam;
  const result = await branchRepo.deleteBranch(id, req.user.hospitalId);
  if (result.count === 0) throw new AppError('Branch not found.', 404, 'BRANCH_NOT_FOUND');
  sendSuccess({ res, message: 'Branch deleted successfully', data: null });
});
