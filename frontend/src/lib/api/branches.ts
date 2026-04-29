import { apiClient } from './client';
import { ApiResponse } from '../../types/api';

export interface Branch {
  branch_id: string;
  name: string;
  location: string | null;
}

export const branchesApi = {
  getBranches: async () => {
    const { data } = await apiClient.get<ApiResponse<Branch[]>>('/branches');
    return data;
  },

  getBranchById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Branch>>(`/branches/${id}`);
    return data;
  },
};
