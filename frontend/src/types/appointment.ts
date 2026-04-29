import { Patient } from './patient';
import { Doctor } from './doctor';
import { Session, SessionSlot } from './session';

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  session_id: string;
  slot_id?: string;
  queue_number: number;
  status: 'booked' | 'confirmed' | 'arrived' | 'completed' | 'cancelled';
  notes?: string;
  hospital_charge: number;
  doctor_fee: number;
  total_amount: number;
  created_at: string;
  patient?: Patient;
  doctor?: Doctor;
  session?: Session;
  slot?: SessionSlot;
  medical_record?: any;
}

export interface CreateAppointmentRequest {
  patient_id: string;
  session_id: string;
  slot_id?: string;
  notes?: string;
}
