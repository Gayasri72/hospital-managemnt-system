export interface RevenueReportData {
  total_revenue: number;
  total_consultation_fees: number;
  total_hospital_charges: number;
  revenue_by_date: { date: string; amount: number }[];
  revenue_by_department: { department: string; amount: number }[];
}

export interface AppointmentReportData {
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  appointments_by_date: { date: string; count: number }[];
  appointments_by_doctor: { doctor: string; count: number }[];
}

export interface DoctorPerformanceData {
  doctor_id: string;
  name: string;
  total_sessions: number;
  total_patients: number;
  total_revenue_generated: number;
  average_patients_per_session: number;
}
