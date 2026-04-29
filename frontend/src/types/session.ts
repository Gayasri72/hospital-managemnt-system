export interface SessionSlot {
  slot_id: string;
  session_id: string;
  slot_number: number;
  slot_time: string;
  is_booked: boolean;
}

export interface Session {
  session_id: string;
  hospital_id: string;
  doctor_id: string;
  branch_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  slot_duration: number;
  max_patients: number;
  booked_count: number;
  status: 'scheduled' | 'open' | 'closed';
  created_at: string;
  doctor?: {
    name: string;
    specialization: string;
  };
  branch?: {
    name: string;
  };
  slots?: SessionSlot[];
}

export interface CreateSessionRequest {
  doctor_id: string;
  branch_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  slot_duration?: number;
}
