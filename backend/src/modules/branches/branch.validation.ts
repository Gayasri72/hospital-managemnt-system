import { z } from 'zod';

export const branchIdParamSchema = z.object({
  id: z.string().uuid('Branch ID must be a valid UUID'),
});

export type BranchIdParam = z.infer<typeof branchIdParamSchema>;
