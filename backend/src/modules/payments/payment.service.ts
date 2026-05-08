// ──────────────────────────────────────────────────────────────────────────────
// Payment Service — business logic for payments and billing.
//
// RULES:
// - Service handles all pre-DB validations
// - Fee values come from the appointment row (snapshot)
// - Overpayment is never allowed
// - Refund cannot exceed amount_paid
// - Payment can only be created for completed appointments
// - One payment per appointment (UNIQUE constraint)
// - No SQL in this file — delegates to payment.repository
// ──────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client';
import { AppError } from '../../utils/apiError';
import * as paymentRepo from './payment.repository';
import { formatReceiptNumber } from './receipt.util';

// Helper: convert any Decimal | number | string into a Prisma.Decimal.
// Why: Number(decimal) loses precision past ~15 digits and accumulates rounding
// errors when summing currency values. Use Decimal for all arithmetic and only
// stringify at the API boundary.
const D = (v: Prisma.Decimal | number | string): Prisma.Decimal => new Prisma.Decimal(v);
import type {
  CreatePaymentInput,
  AddTransactionInput,
  RefundInput,
  ListPaymentsQuery,
  DailyRevenueQuery,
  MonthlyRevenueQuery,
  DoctorRevenueQuery,
} from './payment.validation';

// ── Create Payment ───────────────────────────────────────────────────────────

export async function createPayment(
  input: CreatePaymentInput,
  hospitalId: string,
  userId: string,
) {
  // STEP 1 — Validate appointment
  const appointment = await paymentRepo.findAppointmentInHospital(
    input.appointment_id,
    hospitalId,
  );

  if (!appointment) {
    throw new AppError('Appointment not found in your hospital.', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (appointment.status !== 'completed') {
    throw new AppError(
      `Cannot create payment — appointment status is '${appointment.status}'. Must be 'completed'.`,
      409,
      'APPOINTMENT_NOT_COMPLETED',
    );
  }

  // Check for duplicate payment
  const existingPayment = await paymentRepo.findPaymentByAppointment(input.appointment_id);
  if (existingPayment) {
    throw new AppError(
      'Payment already exists for this appointment.',
      409,
      'PAYMENT_ALREADY_EXISTS',
    );
  }

  // STEP 2 — Copy fee snapshot from appointment (NEVER recalculate)
  const totalAmount = D(appointment.total_fee);
  const doctorAmount = D(appointment.doctor_fee);
  const hospitalAmount = D(appointment.hospital_charge);

  // STEP 3 — Insert payment + audit atomically
  const payment = await paymentRepo.createPayment(
    {
      appointment_id: input.appointment_id,
      hospital_id: hospitalId,
      total_amount: totalAmount,
      doctor_amount: doctorAmount,
      hospital_amount: hospitalAmount,
    },
    { user_id: userId, action: 'CREATE_PAYMENT', entity: 'payments' },
  );

  return {
    ...payment,
    receipt_number: formatReceiptNumber(payment.payment_id),
    balance_remaining: totalAmount.toFixed(2),
  };
}

// ── Add Transaction ──────────────────────────────────────────────────────────

export async function addTransaction(
  paymentId: string,
  input: AddTransactionInput,
  hospitalId: string,
  userId: string,
) {
  // STEP 1 — Validate payment
  const payment = await paymentRepo.getPaymentById(paymentId, hospitalId);
  if (!payment) {
    throw new AppError('Payment not found.', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.status === 'paid') {
    throw new AppError('Payment is already fully paid.', 409, 'PAYMENT_ALREADY_COMPLETED');
  }
  if (payment.status === 'refunded') {
    throw new AppError('Payment has been refunded.', 409, 'PAYMENT_REFUNDED');
  }

  // STEP 2 — Validate amount (all Decimal math — no float drift)
  const currentPaid = D(payment.amount_paid);
  const total = D(payment.total_amount);
  const remaining = total.minus(currentPaid);
  const inputAmount = D(input.amount);

  if (inputAmount.greaterThan(remaining)) {
    throw new AppError(
      `Amount Rs.${inputAmount.toFixed(2)} exceeds remaining balance of Rs.${remaining.toFixed(2)}.`,
      400,
      'AMOUNT_EXCEEDS_BALANCE',
    );
  }

  // STEP 3 — Record transaction + audit atomically
  const updated = await paymentRepo.addTransaction(
    paymentId,
    hospitalId,
    {
      method: input.method,
      amount: inputAmount,
      reference: input.reference,
      note: input.note,
      processed_by: userId,
    },
    currentPaid,
    total,
    { user_id: userId, action: 'RECORD_TRANSACTION', entity: 'payment_transactions' },
  );

  return {
    ...updated,
    receipt_number: formatReceiptNumber(updated.payment_id),
    balance_remaining: D(updated.total_amount).minus(D(updated.amount_paid)).toFixed(2),
  };
}

// ── Refund ────────────────────────────────────────────────────────────────────

export async function issueRefund(
  paymentId: string,
  input: RefundInput,
  hospitalId: string,
  userId: string,
) {
  const payment = await paymentRepo.getPaymentById(paymentId, hospitalId);
  if (!payment) {
    throw new AppError('Payment not found.', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.status === 'pending') {
    throw new AppError(
      'Cannot refund a pending payment — no money has been received.',
      409,
      'CANNOT_REFUND_PENDING',
    );
  }

  const currentPaid = D(payment.amount_paid);
  const inputAmount = D(input.amount);

  if (inputAmount.greaterThan(currentPaid)) {
    throw new AppError(
      `Refund amount Rs.${inputAmount.toFixed(2)} exceeds amount paid of Rs.${currentPaid.toFixed(2)}.`,
      400,
      'REFUND_EXCEEDS_PAID',
    );
  }

  const updated = await paymentRepo.addRefund(
    paymentId,
    hospitalId,
    {
      method: input.method,
      amount: inputAmount,
      reason: input.reason,
      reference: input.reference,
      processed_by: userId,
    },
    currentPaid,
    { user_id: userId, action: 'ISSUE_REFUND', entity: 'payment_transactions' },
  );

  return {
    ...updated,
    receipt_number: formatReceiptNumber(updated.payment_id),
    balance_remaining: D(updated.total_amount).minus(D(updated.amount_paid)).toFixed(2),
  };
}

// ── Get Payment by ID ────────────────────────────────────────────────────────

export async function getPaymentById(paymentId: string, hospitalId: string) {
  const payment = await paymentRepo.getPaymentById(paymentId, hospitalId);
  if (!payment) {
    throw new AppError('Payment not found.', 404, 'PAYMENT_NOT_FOUND');
  }

  return {
    ...payment,
    receipt_number: formatReceiptNumber(payment.payment_id),
    balance_remaining: D(payment.total_amount).minus(D(payment.amount_paid)).toFixed(2),
  };
}

// ── Get Payment by Appointment ID ────────────────────────────────────────────

export async function getPaymentByAppointmentId(
  appointmentId: string,
  hospitalId: string,
) {
  const payment = await paymentRepo.getPaymentByAppointmentId(appointmentId, hospitalId);
  if (!payment) {
    throw new AppError('Payment not found for this appointment.', 404, 'PAYMENT_NOT_FOUND');
  }

  return {
    ...payment,
    receipt_number: formatReceiptNumber(payment.payment_id),
    balance_remaining: D(payment.total_amount).minus(D(payment.amount_paid)).toFixed(2),
  };
}

// ── List Payments ────────────────────────────────────────────────────────────

export async function listPayments(hospitalId: string, query: ListPaymentsQuery) {
  return paymentRepo.getPayments(hospitalId, query);
}

// ── Revenue Reports ──────────────────────────────────────────────────────────

export async function getDailyRevenue(hospitalId: string, query: DailyRevenueQuery) {
  const date = query.date || new Date().toISOString().split('T')[0]!;
  return paymentRepo.getDailyRevenue(hospitalId, date);
}

export async function getMonthlyRevenue(hospitalId: string, query: MonthlyRevenueQuery) {
  const now = new Date();
  const year = query.year || now.getFullYear();
  const month = query.month || now.getMonth() + 1;
  return paymentRepo.getMonthlyRevenue(hospitalId, year, month);
}

export async function getDoctorRevenue(
  hospitalId: string,
  query: DoctorRevenueQuery,
) {
  // Validate doctor belongs to hospital
  const doctor = await paymentRepo.findDoctorInHospital(query.doctor_id, hospitalId);
  if (!doctor) {
    throw new AppError('Doctor not found in your hospital.', 404, 'DOCTOR_NOT_FOUND');
  }

  const now = new Date();
  const from = query.from || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]!;
  const to = query.to || now.toISOString().split('T')[0]!;

  const revenue = await paymentRepo.getDoctorRevenue(hospitalId, query.doctor_id, from, to);

  return {
    doctor: {
      doctor_id: doctor.doctor_id,
      name: doctor.name,
      specialization: doctor.specialization,
    },
    ...revenue,
  };
}

export async function getRevenueSummary(hospitalId: string) {
  return paymentRepo.getSummary(hospitalId);
}

// ── Recalculate Payment Totals ────────────────────────────────────────────────

export async function recalculatePayment(
  paymentId: string,
  hospitalId: string,
  userId: string,
) {
  const payment = await paymentRepo.getPaymentById(paymentId, hospitalId);
  if (!payment) {
    throw new AppError('Payment not found.', 404, 'PAYMENT_NOT_FOUND');
  }

  if (payment.status !== 'pending') {
    throw new AppError(
      'Only pending payments (no transactions recorded) can be recalculated.',
      409,
      'PAYMENT_NOT_PENDING',
    );
  }

  const appointment = await paymentRepo.findAppointmentInHospital(
    payment.appointment_id,
    hospitalId,
  );
  if (!appointment) {
    throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // Derive correct totals from the appointment's individual fee fields.
  // We do NOT trust appointment.total_fee here — it may be the corrupted snapshot
  // that caused this mismatch in the first place.
  const doctorAmount = D(appointment.doctor_fee);
  const hospitalAmount = D(appointment.hospital_charge);
  const totalAmount = doctorAmount.plus(hospitalAmount);

  const currentTotal = D(payment.total_amount);
  if (totalAmount.equals(currentTotal)) {
    return {
      ...payment,
      receipt_number: formatReceiptNumber(payment.payment_id),
      balance_remaining: totalAmount.minus(D(payment.amount_paid)).toFixed(2),
      recalculated: false,
    };
  }

  const updated = await paymentRepo.recalculatePaymentTotals(
    paymentId,
    hospitalId,
    {
      total_amount: totalAmount,
      doctor_amount: doctorAmount,
      hospital_amount: hospitalAmount,
    },
    { user_id: userId, action: 'RECALCULATE_PAYMENT', entity: 'payments' },
  );

  return {
    ...updated,
    receipt_number: formatReceiptNumber(updated.payment_id),
    balance_remaining: totalAmount.minus(D(updated.amount_paid)).toFixed(2),
    recalculated: true,
  };
}
