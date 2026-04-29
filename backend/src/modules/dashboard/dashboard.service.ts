// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Service — Orchestrates dashboard data resolution in parallel.
// ──────────────────────────────────────────────────────────────────────────────

import * as dashboardRepo from './dashboard.repository';
import { prisma } from '../../config/database';
import { ROLES } from '../../constants/roles';

export async function getDashboardData(user: { user_id: string; role: string; hospital_id: string }) {
  const generated_at = new Date().toISOString();

  // If the user is a DOCTOR, fetch scoped personal dashboard
  if (user.role === ROLES.DOCTOR) {
    const doctor = await prisma.doctor.findUnique({
      where: { user_id: user.user_id },
      select: { doctor_id: true }
    });

    if (!doctor) {
      // Return empty stats gracefully instead of throwing a 404
      // This happens if an Admin creates a User with 'Doctor' role, but hasn't created the Doctor profile yet.
      return {
        generated_at,
        personal_stats: {
          appointments_today: 0,
          pending_appointments: 0,
          completed_appointments: 0,
        },
        my_sessions_today: [],
        next_appointment: null,
        missing_profile: true
      };
    }

    const [personal_stats, my_sessions_today, next_appointment] = await Promise.all([
      dashboardRepo.getDoctorPersonalStats(doctor.doctor_id, user.hospital_id),
      dashboardRepo.getDoctorSessionsToday(doctor.doctor_id, user.hospital_id),
      dashboardRepo.getDoctorNextAppointment(doctor.doctor_id, user.hospital_id)
    ]);

    return {
      generated_at,
      personal_stats,
      my_sessions_today,
      next_appointment
    };
  }

  // All other roles get the FULL HOSPITAL DASHBOARD
  const [
    todayStats,
    thisMonthStats,
    activeSessionsToday,
    topDoctorsThisMonth,
    monthlyTrend,
    recentAppointments
  ] = await Promise.all([
    dashboardRepo.getTodayStats(user.hospital_id),
    dashboardRepo.getThisMonthStats(user.hospital_id),
    dashboardRepo.getActiveSessions(user.hospital_id),
    dashboardRepo.getTopDoctors(user.hospital_id),
    dashboardRepo.getMonthlyTrend(user.hospital_id),
    dashboardRepo.getRecentAppointments(user.hospital_id)
  ]);

  return {
    generated_at,
    today: todayStats,
    this_month: thisMonthStats,
    active_sessions_today: activeSessionsToday,
    top_doctors_this_month: topDoctorsThisMonth,
    monthly_trend: monthlyTrend,
    recent_appointments: recentAppointments
  };
}
