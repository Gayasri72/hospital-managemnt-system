export interface PatientProfile {
  patient_id: string;
  address?: string;
  emergency_contact?: string;
  gender?: string;
  age?: number;
}

export interface Patient {
  patient_id: string;
  hospital_id: string;
  name: string;
  nic: string;
  phone: string;
  email?: string;
  created_at: string;
  profile?: PatientProfile;
}

export interface CreatePatientRequest {
  name: string;
  nic: string;
  phone: string;
  email?: string;
  address?: string;
  emergency_contact?: string;
  gender?: 'Male' | 'Female' | 'Other';
  age?: number;
}

export interface UpdatePatientRequest extends Partial<CreatePatientRequest> {}
