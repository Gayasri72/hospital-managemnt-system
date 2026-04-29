import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { MedicalRecord, CreateMedicalRecordRequest, UpdateMedicalRecordRequest, CreatePrescriptionRequest } from '../../types/medical';

export const medicalApi = {
  getRecords: async (params?: { page?: number; limit?: number; patient_id?: string; doctor_id?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<MedicalRecord>>('/medical-records', { params });
    return data;
  },

  getRecordById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<MedicalRecord>>(`/medical-records/${id}`);
    return data;
  },

  getRecordByAppointmentId: async (appointmentId: string) => {
    const { data } = await apiClient.get<ApiResponse<MedicalRecord>>(`/medical-records/appointment/${appointmentId}`);
    return data;
  },

  createRecord: async (recordData: CreateMedicalRecordRequest) => {
    const { data } = await apiClient.post<ApiResponse<MedicalRecord>>('/medical-records', recordData);
    return data;
  },

  updateRecord: async (id: string, recordData: UpdateMedicalRecordRequest) => {
    const { data } = await apiClient.put<ApiResponse<MedicalRecord>>(`/medical-records/${id}`, recordData);
    return data;
  },

  addPrescription: async (recordId: string, prescription: CreatePrescriptionRequest) => {
    const { data } = await apiClient.post<ApiResponse<any>>(`/medical-records/${recordId}/prescriptions`, prescription);
    return data;
  },

  deletePrescription: async (recordId: string, prescriptionId: string) => {
    const { data } = await apiClient.delete<ApiResponse<any>>(`/medical-records/${recordId}/prescriptions/${prescriptionId}`);
    return data;
  },

  getPrintData: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<any>>(`/medical-records/${id}/print`);
    return data;
  }
};
