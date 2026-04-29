import { apiClient } from './client';
import { ApiResponse } from '../../types/api';

export const dashboardApi = {
  getDashboardData: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/dashboard');
    return data;
  },
};
