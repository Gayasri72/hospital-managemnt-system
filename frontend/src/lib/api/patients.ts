import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { Patient, CreatePatientRequest, UpdatePatientRequest } from '../../types/patient';

export const patientsApi = {
  getPatients: async (params?: { page?: number; limit?: number; search?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Patient>>('/patients', { params });
    return data;
  },

  getPatientById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Patient>>(`/patients/${id}`);
    return data;
  },

  createPatient: async (patientData: CreatePatientRequest) => {
    const { data } = await apiClient.post<ApiResponse<Patient>>('/patients', patientData);
    return data;
  },

  updatePatient: async (id: string, patientData: UpdatePatientRequest) => {
    const { data } = await apiClient.put<ApiResponse<Patient>>(`/patients/${id}`, patientData);
    return data;
  },

  getPatientAppointments: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any[]>>(`/patients/${id}/appointments`);
    return data;
  },

  deletePatient: async (id: string) => {
    const { data } = await apiClient.delete<ApiResponse<null>>(`/patients/${id}`);
    return data;
  },
};
