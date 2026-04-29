import { Appointment } from './appointment';

export interface PaymentTransaction {
  transaction_id: string;
  payment_id: string;
  amount: number;
  payment_method: 'CASH' | 'CARD' | 'INSURANCE' | 'ONLINE';
  reference_number?: string;
  created_at: string;
}

export interface Payment {
  payment_id: string;
  hospital_id: string;
  appointment_id: string;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  created_at: string;
  updated_at: string;
  appointment?: Appointment;
  transactions?: PaymentTransaction[];
}

export interface CreatePaymentRequest {
  appointment_id: string;
  amount: number;
  payment_method: 'CASH' | 'CARD' | 'INSURANCE' | 'ONLINE';
  reference_number?: string;
}

export interface RefundRequest {
  amount: number;
  reason: string;
}
