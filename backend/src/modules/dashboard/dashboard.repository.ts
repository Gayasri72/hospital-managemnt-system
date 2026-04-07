// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Repository — Queries for hospital and doctor dashboards.
//
// RULES:
// - Designed to be executed in parallel (Promise.all)
// - Uses raw SQL for optimized aggregations
// ──────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../config/database';

export async function getTodayStats(hospitalId: string) {
  const [result] = await prisma.$queryRaw<any[]>`
    SELECT
      TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') as date,
      CAST(COUNT(a.appointment_id) AS INTEGER) as total_appointments,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status IN ('booked', 'confirmed')) AS INTEGER) as waiting,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'arrived') AS INTEGER) as in_clinic,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show,
      COALESCE((
        SELECT SUM(pt.amount)
        FROM payment_transactions pt
        WHERE pt.hospital_id = ${hospitalId}::uuid
          AND pt.direction = 'credit'
          AND pt.created_at >= CURRENT_DATE AND pt.created_at < CURRENT_DATE + interval '1 day'
      ), 0.0) as revenue_collected,
      COALESCE((
        SELECT CAST(COUNT(session_id) AS INTEGER)
        FROM channel_sessions
        WHERE hospital_id = ${hospitalId}::uuid 
          AND session_date = CURRENT_DATE 
          AND status = 'open'
      ), 0) as sessions_open,
      COALESCE((
        SELECT CAST(COUNT(session_id) AS INTEGER)
        FROM channel_sessions
        WHERE hospital_id = ${hospitalId}::uuid 
          AND session_date = CURRENT_DATE 
          AND status = 'full'
      ), 0) as sessions_full
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND cs.session_date = CURRENT_DATE
  `;
  return result || {};
}

export async function getThisMonthStats(hospitalId: string) {
  const [result] = await prisma.$queryRaw<any[]>`
    SELECT
      CAST(COUNT(a.appointment_id) AS INTEGER) as total_appointments,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id), 0) * 100, 1), 0.0) as cancellation_rate,
      COALESCE((
        SELECT CAST(COUNT(patient_id) AS INTEGER)
        FROM patients
        WHERE hospital_id = ${hospitalId}::uuid 
          AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0) as new_patients,
      COALESCE((
        SELECT SUM(pt.amount)
        FROM payment_transactions pt
        WHERE pt.hospital_id = ${hospitalId}::uuid
          AND pt.direction = 'credit'
          AND pt.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0.0) as revenue_collected,
      COALESCE((
        SELECT SUM(p.total_amount - p.amount_paid)
        FROM payments p
        JOIN appointments pa ON p.appointment_id = pa.appointment_id
        JOIN channel_sessions pcs ON pa.session_id = pcs.session_id
        WHERE p.hospital_id = ${hospitalId}::uuid
          AND p.status IN ('pending', 'partial')
          AND pcs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0.0) as revenue_pending,
      COALESCE((
        SELECT SUM(p.doctor_amount)
        FROM payments p
        JOIN appointments pa ON p.appointment_id = pa.appointment_id
        JOIN channel_sessions pcs ON pa.session_id = pcs.session_id
        WHERE p.hospital_id = ${hospitalId}::uuid
          AND p.status = 'paid'
          AND pcs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0.0) as doctor_revenue,
      COALESCE((
        SELECT SUM(p.hospital_amount)
        FROM payments p
        JOIN appointments pa ON p.appointment_id = pa.appointment_id
        JOIN channel_sessions pcs ON pa.session_id = pcs.session_id
        WHERE p.hospital_id = ${hospitalId}::uuid
          AND p.status = 'paid'
          AND pcs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0.0) as hospital_revenue
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND cs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
  `;
  return result || {};
}

export async function getActiveSessions(hospitalId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT
      cs.session_id,
      d.name as doctor_name,
      d.specialization,
      b.name as branch_name,
      cs.start_time,
      cs.end_time,
      cs.max_patients,
      cs.booked_count,
      cs.status,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status IN ('booked', 'confirmed')) AS INTEGER) as waiting_count
    FROM channel_sessions cs
    JOIN doctors d ON cs.doctor_id = d.doctor_id
    JOIN branches b ON cs.branch_id = b.branch_id
    LEFT JOIN appointments a ON cs.session_id = a.session_id
    WHERE cs.hospital_id = ${hospitalId}::uuid
      AND cs.session_date = CURRENT_DATE
      AND cs.status IN ('scheduled', 'open', 'full')
    GROUP BY cs.session_id, d.name, d.specialization, b.name, cs.start_time, cs.end_time, cs.max_patients, cs.booked_count, cs.status
    ORDER BY cs.start_time ASC
  `;
}

export async function getTopDoctors(hospitalId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT
      d.doctor_id,
      d.name,
      d.specialization,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed_appointments,
      COALESCE((
        SELECT SUM(p.doctor_amount)
        FROM payments p
        JOIN appointments pa ON p.appointment_id = pa.appointment_id
        JOIN channel_sessions pcs ON pa.session_id = pcs.session_id
        WHERE pa.doctor_id = d.doctor_id
          AND p.status = 'paid'
          AND pcs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0.0) as total_earned
    FROM doctors d
    JOIN channel_sessions cs ON d.doctor_id = cs.doctor_id
    LEFT JOIN appointments a ON cs.session_id = a.session_id
    WHERE d.hospital_id = ${hospitalId}::uuid
      AND cs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY d.doctor_id, d.name, d.specialization
    ORDER BY completed_appointments DESC
    LIMIT 5
  `;
}

export async function getMonthlyTrend(hospitalId: string) {
  return prisma.$queryRaw<any[]>`
    WITH RECURSIVE days AS (
      SELECT DATE_TRUNC('month', CURRENT_DATE)::date AS date
      UNION ALL
      SELECT (date + interval '1 day')::date
      FROM days
      WHERE date < CURRENT_DATE
    )
    SELECT
      TO_CHAR(days.date, 'YYYY-MM-DD') as date,
      CAST(COUNT(a.appointment_id) AS INTEGER) as appointments,
      COALESCE(SUM(pt.amount), 0.0) as revenue
    FROM days
    LEFT JOIN (
      SELECT a2.appointment_id, cs.session_date
      FROM appointments a2
      JOIN channel_sessions cs ON a2.session_id = cs.session_id
      WHERE a2.hospital_id = ${hospitalId}::uuid
    ) a ON a.session_date = days.date
    LEFT JOIN payment_transactions pt ON CAST(pt.created_at AS date) = days.date 
      AND pt.hospital_id = ${hospitalId}::uuid 
      AND pt.direction = 'credit'
    GROUP BY days.date
    ORDER BY days.date ASC
  `;
}

export async function getRecentAppointments(hospitalId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT
      a.appointment_id,
      a.queue_number as queue_display,
      p.name as patient_name,
      d.name as doctor_name,
      ss.slot_time,
      a.status,
      TO_CHAR(cs.session_date, 'YYYY-MM-DD') as session_date
    FROM appointments a
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    LEFT JOIN session_slots ss ON a.slot_id = ss.slot_id
    WHERE a.hospital_id = ${hospitalId}::uuid
    ORDER BY a.created_at DESC
    LIMIT 10
  `;
}

// ── GET DOCTOR DASHBOARD STATS ───────────────────────────────────────────────

export async function getDoctorPersonalStats(doctorId: string, hospitalId: string) {
  const [today] = await prisma.$queryRaw<any[]>`
    SELECT
      CAST(COUNT(a.appointment_id) AS INTEGER) as total_appointments,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status IN ('booked', 'confirmed')) AS INTEGER) as waiting,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'arrived') AS INTEGER) as in_clinic,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND a.doctor_id = ${doctorId}::uuid
      AND cs.session_date = CURRENT_DATE
  `;

  const [thisMonth] = await prisma.$queryRaw<any[]>`
    SELECT
      CAST(COUNT(a.appointment_id) AS INTEGER) as total_appointments,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id) - COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled'), 0) * 100, 1), 0.0) as completion_rate,
      COALESCE((
        SELECT CAST(COUNT(mr.record_id) AS INTEGER)
        FROM medical_records mr
        WHERE mr.doctor_id = ${doctorId}::uuid
          AND mr.hospital_id = ${hospitalId}::uuid
          AND mr.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ), 0) as medical_records_written
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND a.doctor_id = ${doctorId}::uuid
      AND cs.session_date >= DATE_TRUNC('month', CURRENT_DATE)
  `;

  return { today: today || {}, this_month: thisMonth || {} };
}

export async function getDoctorSessionsToday(doctorId: string, hospitalId: string) {
  return prisma.$queryRaw<any[]>`
    SELECT
      cs.session_id,
      b.name as branch_name,
      cs.start_time,
      cs.end_time,
      cs.max_patients,
      cs.booked_count,
      cs.status
    FROM channel_sessions cs
    JOIN branches b ON cs.branch_id = b.branch_id
    WHERE cs.hospital_id = ${hospitalId}::uuid
      AND cs.doctor_id = ${doctorId}::uuid
      AND cs.session_date = CURRENT_DATE
    ORDER BY cs.start_time ASC
  `;
}

export async function getDoctorNextAppointment(doctorId: string, hospitalId: string) {
  const [result] = await prisma.$queryRaw<any[]>`
    SELECT
      a.appointment_id,
      a.queue_number as queue_display,
      ss.slot_time,
      p.name as patient_name,
      pp.age as patient_age,
      pp.gender as patient_gender,
      a.status
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    LEFT JOIN session_slots ss ON a.slot_id = ss.slot_id
    JOIN patients p ON a.patient_id = p.patient_id
    LEFT JOIN patient_profiles pp ON p.patient_id = pp.patient_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND a.doctor_id = ${doctorId}::uuid
      AND cs.session_date = CURRENT_DATE
      AND a.status IN ('booked', 'confirmed', 'arrived')
    ORDER BY cs.start_time ASC, a.queue_number ASC
    LIMIT 1
  `;
  return result || null;
}
