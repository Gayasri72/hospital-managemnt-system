// ──────────────────────────────────────────────────────────────────────────────
// Payment Controller — thin HTTP handlers for billing endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/apiError';
import * as paymentService from './payment.service';
import type {
  CreatePaymentInput,
  AddTransactionInput,
  RefundInput,
  ListPaymentsQuery,
  DailyRevenueQuery,
  MonthlyRevenueQuery,
  DoctorRevenueQuery,
} from './payment.validation';

function requireUser(req: Request) {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return req.user;
}

/** POST /api/v1/payments */
export const createPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const input = req.body as CreatePaymentInput;

  const payment = await paymentService.createPayment(input, user.hospitalId, user.userId);

  sendSuccess({ res, statusCode: 201, message: 'Payment created successfully', data: payment });
});

/** POST /api/v1/payments/:id/transactions */
export const addTransaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const paymentId = String(req.params['id']);
  const input = req.body as AddTransactionInput;

  const payment = await paymentService.addTransaction(paymentId, input, user.hospitalId, user.userId);

  sendSuccess({ res, statusCode: 200, message: 'Transaction recorded successfully', data: payment });
});

/** POST /api/v1/payments/:id/refund */
export const issueRefund = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const paymentId = String(req.params['id']);
  const input = req.body as RefundInput;

  const payment = await paymentService.issueRefund(paymentId, input, user.hospitalId, user.userId);

  sendSuccess({ res, statusCode: 200, message: 'Refund issued successfully', data: payment });
});

/** GET /api/v1/payments/:id */
export const getPaymentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const paymentId = String(req.params['id']);

  const payment = await paymentService.getPaymentById(paymentId, user.hospitalId);

  sendSuccess({ res, message: 'Payment retrieved successfully', data: payment });
});

/** GET /api/v1/payments/appointment/:appointment_id */
export const getPaymentByAppointment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const appointmentId = String(req.params['appointment_id']);

  const payment = await paymentService.getPaymentByAppointmentId(appointmentId, user.hospitalId);

  sendSuccess({ res, message: 'Payment retrieved successfully', data: payment });
});

/** GET /api/v1/payments */
export const listPayments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as ListPaymentsQuery;

  const result = await paymentService.listPayments(user.hospitalId, query);

  sendSuccess({
    res,
    message: 'Payments retrieved successfully',
    data: result.data,
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

/** GET /api/v1/reports/revenue/daily */
export const getDailyRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as DailyRevenueQuery;

  const report = await paymentService.getDailyRevenue(user.hospitalId, query);

  sendSuccess({ res, message: 'Daily revenue report retrieved successfully', data: report });
});

/** GET /api/v1/reports/revenue/monthly */
export const getMonthlyRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as MonthlyRevenueQuery;

  const report = await paymentService.getMonthlyRevenue(user.hospitalId, query);

  sendSuccess({ res, message: 'Monthly revenue report retrieved successfully', data: report });
});

/** GET /api/v1/reports/revenue/doctor */
export const getDoctorRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as DoctorRevenueQuery;

  const report = await paymentService.getDoctorRevenue(user.hospitalId, query);

  sendSuccess({ res, message: 'Doctor revenue report retrieved successfully', data: report });
});

/** GET /api/v1/reports/revenue/summary */
export const getRevenueSummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);

  const summary = await paymentService.getRevenueSummary(user.hospitalId);

  sendSuccess({ res, message: 'Revenue summary retrieved successfully', data: summary });
});
