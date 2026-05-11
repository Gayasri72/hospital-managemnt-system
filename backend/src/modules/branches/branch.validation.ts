import { z } from 'zod';

export const branchIdParamSchema = z.object({
  id: z.string().uuid('Branch ID must be a valid UUID'),
});

export type BranchIdParam = z.infer<typeof branchIdParamSchema>;

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  location: z.string().max(1000).optional(),
});

export const updateBranchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  location: z.string().max(1000).optional().nullable(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
