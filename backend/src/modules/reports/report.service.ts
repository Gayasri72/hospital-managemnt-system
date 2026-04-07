// ──────────────────────────────────────────────────────────────────────────────
// Report Service — Business logic for report endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import * as reportRepo from './report.repository';
import { AppError } from '../../utils/apiError';
import { StatusCodes } from 'http-status-codes';

// Helper to get ISO date strings locally
function getTodayString() {
  const d = new Date();
  // Simple hack to get local YYYY-MM-DD
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getFirstDayOfMonthString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function validateDateRange(from: string, to: string) {
  if (new Date(from) > new Date(to)) {
    throw new AppError('"from" date must be before or equal to "to" date', StatusCodes.BAD_REQUEST, 'INVALID_DATE_RANGE');
  }
}

export async function getDailyAppointments(hospitalId: string, date?: string) {
  const queryDate = date || getTodayString();
  return reportRepo.getDailyAppointments(hospitalId, queryDate);
}

export async function getMonthlyAppointments(hospitalId: string, year?: number, month?: number) {
  const d = new Date();
  const queryYear = year || d.getFullYear();
  const queryMonth = month || (d.getMonth() + 1);

  if (queryMonth < 1 || queryMonth > 12) {
    throw new AppError('Month must be between 1 and 12', StatusCodes.BAD_REQUEST, 'INVALID_MONTH');
  }

  return reportRepo.getMonthlyAppointments(hospitalId, queryYear, queryMonth);
}

export async function getDoctorWiseAppointments(hospitalId: string, query: { from?: string; to?: string; doctor_id?: string }) {
  const from = query.from || getFirstDayOfMonthString();
  const to = query.to || getTodayString();
  validateDateRange(from, to);

  return reportRepo.getDoctorWiseAppointments(hospitalId, from, to, query.doctor_id);
}

export async function getCancelledAppointments(hospitalId: string, query: { from?: string; to?: string; doctor_id?: string; page?: number; limit?: number }) {
  const from = query.from || getFirstDayOfMonthString();
  const to = query.to || getTodayString();
  validateDateRange(from, to);

  const page = query.page || 1;
  const limit = query.limit || 20;

  return reportRepo.getCancelledAppointments(hospitalId, from, to, query.doctor_id, page, limit);
}

export async function getPatientSummary(hospitalId: string, query: { from?: string; to?: string }) {
  const from = query.from || getFirstDayOfMonthString();
  const to = query.to || getTodayString();
  validateDateRange(from, to);

  return reportRepo.getPatientSummary(hospitalId, from, to);
}

export async function getDoctorPerformance(hospitalId: string, query: { from?: string; to?: string }) {
  const from = query.from || getFirstDayOfMonthString();
  const to = query.to || getTodayString();
  validateDateRange(from, to);

  return reportRepo.getDoctorPerformance(hospitalId, from, to);
}
