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

import { AppError } from '../../utils/apiError';
import * as paymentRepo from './payment.repository';
import { formatReceiptNumber } from './receipt.util';
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
  const totalAmount = Number(appointment.total_fee);
  const doctorAmount = Number(appointment.doctor_fee);
  const hospitalAmount = Number(appointment.hospital_charge);

  // STEP 3 — Insert payment
  const payment = await paymentRepo.createPayment({
    appointment_id: input.appointment_id,
    hospital_id: hospitalId,
    total_amount: totalAmount,
    doctor_amount: doctorAmount,
    hospital_amount: hospitalAmount,
  });

  // STEP 4 — Audit log
  await paymentRepo.createAuditLog(userId, 'CREATE_PAYMENT', 'payments', payment.payment_id);

  return {
    ...payment,
    receipt_number: formatReceiptNumber(payment.payment_id),
    balance_remaining: totalAmount,
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

  // STEP 2 — Validate amount
  const currentPaid = Number(payment.amount_paid);
  const total = Number(payment.total_amount);
  const remaining = total - currentPaid;

  if (input.amount > remaining) {
    throw new AppError(
      `Amount Rs.${input.amount.toFixed(2)} exceeds remaining balance of Rs.${remaining.toFixed(2)}.`,
      400,
      'AMOUNT_EXCEEDS_BALANCE',
    );
  }

  // STEP 3 — Record transaction
  const updated = await paymentRepo.addTransaction(
    paymentId,
    hospitalId,
    {
      method: input.method,
      amount: input.amount,
      reference: input.reference,
      note: input.note,
      processed_by: userId,
    },
    currentPaid,
    total,
  );

  // STEP 4 — Audit log
  await paymentRepo.createAuditLog(userId, 'RECORD_TRANSACTION', 'payment_transactions', paymentId);

  return {
    ...updated,
    receipt_number: formatReceiptNumber(updated.payment_id),
    balance_remaining: Number(updated.total_amount) - Number(updated.amount_paid),
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

  const currentPaid = Number(payment.amount_paid);

  if (input.amount > currentPaid) {
    throw new AppError(
      `Refund amount Rs.${input.amount.toFixed(2)} exceeds amount paid of Rs.${currentPaid.toFixed(2)}.`,
      400,
      'REFUND_EXCEEDS_PAID',
    );
  }

  const updated = await paymentRepo.addRefund(
    paymentId,
    hospitalId,
    {
      method: input.method,
      amount: input.amount,
      reason: input.reason,
      reference: input.reference,
      processed_by: userId,
    },
    currentPaid,
  );

  await paymentRepo.createAuditLog(userId, 'ISSUE_REFUND', 'payment_transactions', paymentId);

  return {
    ...updated,
    receipt_number: formatReceiptNumber(updated.payment_id),
    balance_remaining: Number(updated.total_amount) - Number(updated.amount_paid),
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
    balance_remaining: Number(payment.total_amount) - Number(payment.amount_paid),
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
    balance_remaining: Number(payment.total_amount) - Number(payment.amount_paid),
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
