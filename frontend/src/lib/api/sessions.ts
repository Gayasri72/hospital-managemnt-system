import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { Session, CreateSessionRequest } from '../../types/session';

export const sessionsApi = {
  getSessions: async (params?: { page?: number; limit?: number; date?: string; doctor_id?: string; status?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Session>>('/sessions', { params });
    return data;
  },

  getSessionById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Session>>(`/sessions/${id}`);
    return data;
  },

  createSession: async (sessionData: CreateSessionRequest) => {
    const { data } = await apiClient.post<ApiResponse<Session>>('/sessions', sessionData);
    return data;
  },

  updateSession: async (id: string, sessionData: any) => {
    const { data } = await apiClient.put<ApiResponse<Session>>(`/sessions/${id}`, sessionData);
    return data;
  },

  deleteSession: async (id: string) => {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/sessions/${id}`);
    return data;
  },

  getSessionSlots: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any[]>>(`/sessions/${id}/slots`);
    return data;
  },

  getSessionQueue: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any>>(`/sessions/${id}/queue`);
    return data;
  },

  updateSessionStatus: async (id: string, status: string) => {
    const { data } = await apiClient.patch<ApiResponse<Session>>(`/sessions/${id}/status`, { status });
    return data;
  }
};
