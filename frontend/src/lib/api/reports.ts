import { apiClient } from './client';
import { ApiResponse } from '../../types/api';

// ── Revenue reports (from payment.routes.ts) ──────────────────────────────────

export const reportsApi = {
  getRevenueSummary: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/revenue/summary');
    return data;
  },

  getDailyRevenue: async (params?: { start_date?: string; end_date?: string }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/revenue/daily', { params });
    return data;
  },

  getMonthlyRevenue: async (params?: { year?: number }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/revenue/monthly', { params });
    return data;
  },

  getDoctorRevenue: async (params?: { start_date?: string; end_date?: string; doctor_id?: string }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/revenue/doctor', { params });
    return data;
  },

  // ── Appointment reports (from report.routes.ts) ─────────────────────────────

  getDailyAppointments: async (params?: { date?: string }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/appointments/daily', { params });
    return data;
  },

  getMonthlyAppointments: async (params?: { year?: number; month?: number }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/appointments/monthly', { params });
    return data;
  },

  getDoctorWiseAppointments: async (params?: { start_date?: string; end_date?: string }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/appointments/doctor-wise', { params });
    return data;
  },

  getCancelledAppointments: async (params?: { start_date?: string; end_date?: string }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/appointments/cancelled', { params });
    return data;
  },

  // ── Patient & doctor reports ────────────────────────────────────────────────

  getPatientSummary: async () => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/patients/summary');
    return data;
  },

  getDoctorPerformance: async (params?: { start_date?: string; end_date?: string }) => {
    const { data } = await apiClient.get<ApiResponse<any>>('/reports/doctors/performance', { params });
    return data;
  },
};
