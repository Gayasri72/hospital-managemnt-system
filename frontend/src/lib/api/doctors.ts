import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { Doctor, CreateDoctorRequest } from '../../types/doctor';

export const doctorsApi = {
  getDoctors: async (params?: { page?: number; limit?: number; specialization?: string; search?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Doctor>>('/doctors', { params });
    return data;
  },

  getDoctorById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Doctor>>(`/doctors/${id}`);
    return data;
  },

  createDoctor: async (doctorData: CreateDoctorRequest) => {
    const { data } = await apiClient.post<ApiResponse<Doctor>>('/doctors', doctorData);
    return data;
  },

  getDoctorFees: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any[]>>(`/doctors/${id}/fees`);
    return data;
  },
  
  getDoctorAvailability: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any[]>>(`/doctors/${id}/availability`);
    return data;
  },
  
  getDoctorSessions: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any[]>>(`/doctors/${id}/sessions`);
    return data;
  },

  updateDoctor: async (id: string, doctorData: any) => {
    const { data } = await apiClient.put<ApiResponse<Doctor>>(`/doctors/${id}`, doctorData);
    return data;
  },

  addFee: async (id: string, feeData: { consultation_fee: number; effective_from?: string }) => {
    const { data } = await apiClient.post<ApiResponse<any>>(`/doctors/${id}/fees`, feeData);
    return data;
  },

  updateStatus: async (id: string, status: 'active' | 'inactive' | 'on_leave') => {
    const { data } = await apiClient.put<ApiResponse<Doctor>>(`/doctors/${id}`, { status });
    return data;
  }
};
