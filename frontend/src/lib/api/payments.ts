import { apiClient } from './client';
import { ApiResponse, PaginatedResponse } from '../../types/api';
import { Payment, CreatePaymentRequest, RefundRequest } from '../../types/payment';

export const paymentsApi = {
  getPayments: async (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const { data } = await apiClient.get<PaginatedResponse<Payment>>('/payments', { params });
    return data;
  },

  getPaymentById: async (id: string) => {
    const { data } = await apiClient.get<ApiResponse<Payment>>(`/payments/${id}`);
    return data;
  },

  getPaymentByAppointmentId: async (appointmentId: string) => {
    const { data } = await apiClient.get<ApiResponse<Payment>>(`/payments/appointment/${appointmentId}`);
    return data;
  },

  createPayment: async (paymentData: CreatePaymentRequest) => {
    const { data } = await apiClient.post<ApiResponse<Payment>>('/payments', paymentData);
    return data;
  },

  addTransaction: async (id: string, transactionData: { amount: number; payment_method: string; reference_number?: string }) => {
    const { data } = await apiClient.post<ApiResponse<Payment>>(`/payments/${id}/transactions`, transactionData);
    return data;
  },

  issueRefund: async (id: string, refundData: RefundRequest) => {
    const { data } = await apiClient.post<ApiResponse<Payment>>(`/payments/${id}/refund`, refundData);
    return data;
  }
};
