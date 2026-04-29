export interface DoctorProfile {
  doctor_id: string;
  qualifications?: string;
  experience_years?: number;
  bio?: string;
}

export interface DoctorFee {
  fee_id: string;
  doctor_id: string;
  consultation_fee: number;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
}

export interface Doctor {
  doctor_id: string;
  hospital_id: string;
  user_id?: string;
  name: string;
  specialization: string;
  contact_number?: string;
  email?: string;
  status: 'active' | 'inactive' | 'on_leave';
  created_at: string;
  profile?: DoctorProfile;
  current_fee?: DoctorFee;
}

export interface CreateDoctorRequest {
  name: string;
  specialization: string;
  contact_number?: string;
  email?: string;
  qualifications?: string;
  experience_years?: number;
  bio?: string;
  consultation_fee: number;
  effective_from: string;
}
