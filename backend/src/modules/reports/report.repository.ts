// ──────────────────────────────────────────────────────────────────────────────
// Report Repository — Executes complex analytical queries for reports.
//
// RULES:
// - All queries use raw SQL for performance and exact aggregations via Prisma.$queryRaw
// - All queries strictly filtered by hospital_id
// - Percentages calculated in SQL, not JS
// ──────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

// ── GET DAILY APPOINTMENTS ───────────────────────────────────────────────────
export async function getDailyAppointments(hospitalId: string, date: string) {
  const [summary] = await prisma.$queryRaw<any[]>`
    SELECT
      CAST(COUNT(*) AS INTEGER) as total,
      CAST(COUNT(*) FILTER (WHERE a.status = 'booked') AS INTEGER) as booked,
      CAST(COUNT(*) FILTER (WHERE a.status = 'confirmed') AS INTEGER) as confirmed,
      CAST(COUNT(*) FILTER (WHERE a.status = 'arrived') AS INTEGER) as arrived,
      CAST(COUNT(*) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(*) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(*) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND cs.session_date = ${date}::date
  `;

  const by_session = await prisma.$queryRaw<any[]>`
    SELECT
      cs.session_id,
      d.name as doctor_name,
      d.specialization,
      b.name as branch_name,
      cs.start_time,
      cs.end_time,
      cs.max_patients,
      cs.booked_count,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed_count,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled_count,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show_count
    FROM channel_sessions cs
    JOIN doctors d ON cs.doctor_id = d.doctor_id
    JOIN branches b ON cs.branch_id = b.branch_id
    LEFT JOIN appointments a ON a.session_id = cs.session_id
    WHERE cs.hospital_id = ${hospitalId}::uuid
      AND cs.session_date = ${date}::date
    GROUP BY cs.session_id, d.name, d.specialization, b.name, cs.start_time, cs.end_time, cs.max_patients, cs.booked_count
    ORDER BY cs.start_time ASC
  `;

  const by_doctor = await prisma.$queryRaw<any[]>`
    SELECT
      d.doctor_id,
      d.name as doctor_name,
      d.specialization,
      CAST(COUNT(a.appointment_id) AS INTEGER) as total,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND cs.session_date = ${date}::date
    GROUP BY d.doctor_id, d.name, d.specialization
    ORDER BY total DESC
  `;

  const appointments = await prisma.$queryRaw<any[]>`
    SELECT
      a.appointment_id,
      a.queue_number as queue_display,
      ss.slot_time,
      p.name as patient_name,
      p.phone as patient_phone,
      d.name as doctor_name,
      b.name as branch_name,
      a.status
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    LEFT JOIN session_slots ss ON a.slot_id = ss.slot_id
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    JOIN branches b ON cs.branch_id = b.branch_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND cs.session_date = ${date}::date
    ORDER BY cs.start_time ASC, a.queue_number ASC
  `;

  return { date, summary: summary || {}, by_session, by_doctor, appointments };
}

// ── GET MONTHLY APPOINTMENTS ─────────────────────────────────────────────────
export async function getMonthlyAppointments(hospitalId: string, year: number, month: number) {
  const [summary] = await prisma.$queryRaw<any[]>`
    SELECT
      CAST(COUNT(a.appointment_id) AS INTEGER) as total,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id) - COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled'), 0) * 100, 1), 0.0) as completion_rate,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id), 0) * 100, 1), 0.0) as cancellation_rate,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id), 0) * 100, 1), 0.0) as no_show_rate
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND EXTRACT(YEAR FROM cs.session_date) = ${year}
      AND EXTRACT(MONTH FROM cs.session_date) = ${month}
  `;

  const by_day = await prisma.$queryRaw<any[]>`
    SELECT
      TO_CHAR(cs.session_date, 'YYYY-MM-DD') as date,
      CAST(COUNT(a.appointment_id) AS INTEGER) as total,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND EXTRACT(YEAR FROM cs.session_date) = ${year}
      AND EXTRACT(MONTH FROM cs.session_date) = ${month}
    GROUP BY cs.session_date
    ORDER BY cs.session_date ASC
  `;

  const by_doctor = await prisma.$queryRaw<any[]>`
    SELECT
      d.doctor_id,
      d.name as doctor_name,
      d.specialization,
      CAST(COUNT(a.appointment_id) AS INTEGER) as total,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id) - COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled'), 0) * 100, 1), 0.0) as completion_rate
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND EXTRACT(YEAR FROM cs.session_date) = ${year}
      AND EXTRACT(MONTH FROM cs.session_date) = ${month}
    GROUP BY d.doctor_id, d.name, d.specialization
    ORDER BY total DESC
  `;

  const by_specialization = await prisma.$queryRaw<any[]>`
    SELECT
      d.specialization,
      CAST(COUNT(a.appointment_id) AS INTEGER) as total,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND EXTRACT(YEAR FROM cs.session_date) = ${year}
      AND EXTRACT(MONTH FROM cs.session_date) = ${month}
    GROUP BY d.specialization
    ORDER BY total DESC
  `;

  return { year, month, summary: summary || {}, by_day, by_doctor, by_specialization };
}

// ── GET DOCTOR-WISE APPOINTMENTS ─────────────────────────────────────────────
export async function getDoctorWiseAppointments(hospitalId: string, fromDate: string, toDate: string, doctorId?: string) {
  const doctorCondition = doctorId ? Prisma.sql`AND d.doctor_id = ${doctorId}::uuid` : Prisma.empty;

  const doctors = await prisma.$queryRaw<any[]>`
    SELECT
      d.doctor_id,
      d.name,
      d.specialization,
      CAST(COUNT(DISTINCT cs.session_id) AS INTEGER) as total_sessions,
      CAST(COUNT(a.appointment_id) AS INTEGER) as total_appointments,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS INTEGER) as completed,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled') AS INTEGER) as cancelled,
      CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'no_show') AS INTEGER) as no_show,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) FILTER (WHERE a.status = 'completed') AS NUMERIC) / 
        NULLIF(COUNT(a.appointment_id) - COUNT(a.appointment_id) FILTER (WHERE a.status = 'cancelled'), 0) * 100, 1), 0.0) as completion_rate,
      COALESCE(ROUND(CAST(COUNT(a.appointment_id) AS NUMERIC) / NULLIF(COUNT(DISTINCT cs.session_id), 0), 1), 0.0) as avg_patients_per_session,
      (
        SELECT TO_CHAR(inner_cs.session_date, 'Day')
        FROM appointments inner_a
        JOIN channel_sessions inner_cs ON inner_a.session_id = inner_cs.session_id
        WHERE inner_a.doctor_id = d.doctor_id
          AND inner_cs.session_date BETWEEN ${fromDate}::date AND ${toDate}::date
        GROUP BY TO_CHAR(inner_cs.session_date, 'Day')
        ORDER BY COUNT(inner_a.appointment_id) DESC
        LIMIT 1
      ) as busiest_day
    FROM doctors d
    JOIN channel_sessions cs ON d.doctor_id = cs.doctor_id
    JOIN appointments a ON cs.session_id = a.session_id
    WHERE d.hospital_id = ${hospitalId}::uuid
      AND cs.session_date BETWEEN ${fromDate}::date AND ${toDate}::date
      ${doctorCondition}
    GROUP BY d.doctor_id, d.name, d.specialization
    ORDER BY total_appointments DESC
  `;

  return { period: { from: fromDate, to: toDate }, doctors };
}

// ── GET CANCELLED APPOINTMENTS ───────────────────────────────────────────────
export async function getCancelledAppointments(hospitalId: string, fromDate: string, toDate: string, doctorId?: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;
  const doctorCondition = doctorId ? Prisma.sql`AND a.doctor_id = ${doctorId}::uuid` : Prisma.empty;

  const [totalResult] = await prisma.$queryRaw<any[]>`
    SELECT CAST(COUNT(a.appointment_id) AS INTEGER) as total
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND a.status = 'cancelled'
      AND cs.session_date BETWEEN ${fromDate}::date AND ${toDate}::date
      ${doctorCondition}
  `;

  const data = await prisma.$queryRaw<any[]>`
    SELECT
      a.appointment_id,
      a.queue_number as queue_display,
      TO_CHAR(cs.session_date, 'YYYY-MM-DD') as session_date,
      ss.slot_time,
      p.name as patient_name,
      p.phone as patient_phone,
      d.name as doctor_name,
      b.name as branch_name,
      al.created_at as cancelled_at,
      u.name as cancelled_by_name,
      al.reason
    FROM appointments a
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    LEFT JOIN session_slots ss ON a.slot_id = ss.slot_id
    JOIN patients p ON a.patient_id = p.patient_id
    JOIN doctors d ON a.doctor_id = d.doctor_id
    JOIN branches b ON cs.branch_id = b.branch_id
    LEFT JOIN LATERAL (
      SELECT created_at, changed_by, reason 
      FROM appointment_logs 
      WHERE appointment_id = a.appointment_id AND new_status = 'cancelled' 
      ORDER BY created_at DESC LIMIT 1
    ) al ON true
    LEFT JOIN users u ON u.user_id = al.changed_by
    WHERE a.hospital_id = ${hospitalId}::uuid
      AND a.status = 'cancelled'
      AND cs.session_date BETWEEN ${fromDate}::date AND ${toDate}::date
      ${doctorCondition}
    ORDER BY al.created_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = totalResult?.total || 0;
  return { period: { from: fromDate, to: toDate }, total_cancelled: total, data, total, page, limit };
}

// ── GET PATIENT SUMMARY ──────────────────────────────────────────────────────
export async function getPatientSummary(hospitalId: string, fromDate: string, toDate: string) {
  const [newPatientsResult] = await prisma.$queryRaw<any[]>`
    SELECT CAST(COUNT(patient_id) AS INTEGER) as count
    FROM patients
    WHERE hospital_id = ${hospitalId}::uuid
      AND created_at BETWEEN ${fromDate}::timestamp AND ${toDate}::timestamp + interval '1 day' - interval '1 second'
  `;

  const [returningPatientsResult] = await prisma.$queryRaw<any[]>`
    SELECT CAST(COUNT(DISTINCT patient_id) AS INTEGER) as count
    FROM appointments
    WHERE hospital_id = ${hospitalId}::uuid
      AND created_at BETWEEN ${fromDate}::timestamp AND ${toDate}::timestamp + interval '1 day' - interval '1 second'
      AND status = 'completed'
      AND patient_id IN (
        SELECT patient_id FROM appointments
        WHERE hospital_id = ${hospitalId}::uuid AND created_at < ${fromDate}::timestamp AND status = 'completed'
      )
  `;

  const [totalRegisteredResult] = await prisma.$queryRaw<any[]>`
    SELECT CAST(COUNT(patient_id) AS INTEGER) as count
    FROM patients
    WHERE hospital_id = ${hospitalId}::uuid
  `;

  const [activePatientsResult] = await prisma.$queryRaw<any[]>`
    SELECT CAST(COUNT(DISTINCT patient_id) AS INTEGER) as count
    FROM appointments
    WHERE hospital_id = ${hospitalId}::uuid
      AND status = 'completed'
      AND created_at BETWEEN ${fromDate}::timestamp AND ${toDate}::timestamp + interval '1 day' - interval '1 second'
  `;

  const by_day = await prisma.$queryRaw<any[]>`
    SELECT
      TO_CHAR(created_at, 'YYYY-MM-DD') as date,
      CAST(COUNT(patient_id) AS INTEGER) as new_registrations
    FROM patients
    WHERE hospital_id = ${hospitalId}::uuid
      AND created_at BETWEEN ${fromDate}::timestamp AND ${toDate}::timestamp + interval '1 day' - interval '1 second'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY date ASC
  `;

  const top_patients = await prisma.$queryRaw<any[]>`
    SELECT
      p.patient_id,
      p.name,
      p.phone,
      CAST(COUNT(a.appointment_id) AS INTEGER) as appointment_count,
      MAX(cs.session_date) as last_visit
    FROM patients p
    JOIN appointments a ON p.patient_id = a.patient_id
    JOIN channel_sessions cs ON a.session_id = cs.session_id
    WHERE p.hospital_id = ${hospitalId}::uuid
      AND a.status = 'completed'
    GROUP BY p.patient_id, p.name, p.phone
    ORDER BY appointment_count DESC
    LIMIT 10
  `;

  return {
    period: { from: fromDate, to: toDate },
    total_registered: totalRegisteredResult?.count || 0,
    new_in_period: newPatientsResult?.count || 0,
    returning_in_period: returningPatientsResult?.count || 0,
    active_in_period: activePatientsResult?.count || 0,
    by_day,
    top_patients
  };
}

// ── GET DOCTOR PERFORMANCE ───────────────────────────────────────────────────
export async function getDoctorPerformance(hospitalId: string, fromDate: string, toDate: string) {
  const doctors = await prisma.$queryRaw<any[]>`
    SELECT
      d.doctor_id,
      d.name,
      d.specialization,
      d.status,
      CAST(COUNT(DISTINCT cs.session_id) AS INTEGER) as sessions_conducted,
      CAST(COUNT(DISTINCT a.appointment_id) AS INTEGER) as total_appointments,
      CAST(COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS INTEGER) as completed,
      CAST(COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.appointment_id END) AS INTEGER) as cancelled,
      CAST(COUNT(DISTINCT CASE WHEN a.status = 'no_show' THEN a.appointment_id END) AS INTEGER) as no_show,
      COALESCE(ROUND(CAST(COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.appointment_id END) AS NUMERIC) / 
        NULLIF(COUNT(DISTINCT a.appointment_id) - COUNT(DISTINCT CASE WHEN a.status = 'cancelled' THEN a.appointment_id END), 0) * 100, 1), 0.0) as completion_rate,
      COALESCE(ROUND(CAST(COUNT(DISTINCT CASE WHEN a.status = 'no_show' THEN a.appointment_id END) AS NUMERIC) / 
        NULLIF(COUNT(DISTINCT a.appointment_id), 0) * 100, 1), 0.0) as no_show_rate,
      COALESCE((
        SELECT SUM(p.doctor_amount)
        FROM payments p
        JOIN appointments pa ON p.appointment_id = pa.appointment_id
        JOIN channel_sessions pcs ON pa.session_id = pcs.session_id
        WHERE pa.doctor_id = d.doctor_id
          AND p.status = 'paid'
          AND pcs.session_date BETWEEN ${fromDate}::date AND ${toDate}::date
      ), 0.0) as total_earned,
      COALESCE((
        SELECT CAST(COUNT(mr.record_id) AS INTEGER)
        FROM medical_records mr
        WHERE mr.doctor_id = d.doctor_id
          AND mr.created_at >= ${fromDate}::timestamp AND mr.created_at <= ${toDate}::timestamp + interval '1 day' - interval '1 second'
      ), 0) as medical_records_written,
      COALESCE(ROUND(CAST(COUNT(DISTINCT a.appointment_id) AS NUMERIC) / NULLIF(COUNT(DISTINCT cs.session_id), 0), 1), 0.0) as avg_patients_per_session
    FROM doctors d
    LEFT JOIN channel_sessions cs ON d.doctor_id = cs.doctor_id 
      AND cs.session_date BETWEEN ${fromDate}::date AND ${toDate}::date
      AND cs.status != 'cancelled'
    LEFT JOIN appointments a ON cs.session_id = a.session_id AND a.doctor_id = d.doctor_id
    WHERE d.hospital_id = ${hospitalId}::uuid
      AND d.status = 'active'
    GROUP BY d.doctor_id, d.name, d.specialization, d.status
    ORDER BY completed DESC
  `;

  return { period: { from: fromDate, to: toDate }, doctors };
}
