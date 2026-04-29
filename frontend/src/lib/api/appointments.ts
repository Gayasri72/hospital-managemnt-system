import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { Appointment, CreateAppointmentRequest } from '../../types/appointment';

export const appointmentsApi = {
  getAppointments: async (params?: { page?: number; limit?: number; status?: string; patient_id?: string; doctor_id?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Appointment>>('/appointments', { params });
    return data;
  },

  getAppointmentById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Appointment>>(`/appointments/${id}`);
    return data;
  },

  createAppointment: async (appointmentData: CreateAppointmentRequest) => {
    const { data } = await apiClient.post<ApiResponse<Appointment>>('/appointments', appointmentData);
    return data;
  },

  updateAppointmentStatus: async (id: string, status: string) => {
    const { data } = await apiClient.patch<ApiResponse<Appointment>>(`/appointments/${id}/status`, { status });
    return data;
  },

  rescheduleAppointment: async (id: string, rescheduleData: { session_id: string; slot_id?: string }) => {
    const { data } = await apiClient.post<ApiResponse<Appointment>>(`/appointments/${id}/reschedule`, rescheduleData);
    return data;
  },
  
  getReceiptData: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any>>(`/appointments/${id}/receipt-data`);
    return data;
  }
};
