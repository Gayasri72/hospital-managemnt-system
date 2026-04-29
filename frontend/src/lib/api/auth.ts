import { apiClient } from './client';
import { ApiResponse } from '../../types/api';
import { LoginResponse } from '../../types/auth';

export const authApi = {
  login: async (credentials: { email: string; password: string }) => {
    const { data } = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', credentials);
    return data;
  },

  logout: async () => {
    const { data } = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return data;
  },

  getMe: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/auth/me');
    return data;
  },
};
