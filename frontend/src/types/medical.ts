import { Appointment } from './appointment';

export interface Prescription {
  prescription_id: string;
  record_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
}

export interface MedicalRecord {
  record_id: string;
  hospital_id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string;
  diagnosis: string;
  symptoms: string | string[];
  notes?: string;
  treatment_plan?: string;
  follow_up_date?: string;
  created_at: string;
  updated_at: string;
  appointment?: Appointment;
  prescriptions?: Prescription[];
}

export interface CreatePrescriptionRequest {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
}

export interface CreateMedicalRecordRequest {
  appointment_id: string;
  diagnosis: string;
  symptoms: string;
  notes?: string;
  follow_up_date?: string;
  prescriptions?: CreatePrescriptionRequest[];
}

export interface UpdateMedicalRecordRequest {
  diagnosis?: string;
  symptoms?: string;
  notes?: string;
  follow_up_date?: string;
}
