// ──────────────────────────────────────────────────────────────────────────────
// Appointment Controller — thin HTTP handlers.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/apiError';
import * as appointmentService from './appointment.service';
import type {
  CreateAppointmentInput,
  UpdateStatusInput,
  RescheduleInput,
  ListAppointmentsQuery,
} from './appointment.validation';

function requireUser(req: Request) {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return req.user;
}

/** POST /api/v1/appointments */
export const createAppointment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const input = req.body as CreateAppointmentInput;

  const appointment = await appointmentService.createAppointment(input, user.hospitalId, user.userId);

  sendSuccess({ res, statusCode: 201, message: 'Appointment booked successfully', data: appointment });
});

/** GET /api/v1/appointments */
export const listAppointments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as ListAppointmentsQuery;

  const result = await appointmentService.listAppointments(user.hospitalId, query, user.role);

  sendSuccess({
    res,
    message: 'Appointments retrieved successfully',
    data: result.data,
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

/** GET /api/v1/appointments/today */
export const getTodayAppointments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);

  const result = await appointmentService.getTodayAppointments(user.hospitalId, user.role);

  sendSuccess({ res, message: "Today's appointments retrieved successfully", data: result });
});

/** GET /api/v1/appointments/:id */
export const getAppointmentById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const appointmentId = String(req.params['id']);

  const appointment = await appointmentService.getAppointmentById(
    appointmentId,
    user.hospitalId,
    user.role,
  );

  sendSuccess({ res, message: 'Appointment retrieved successfully', data: appointment });
});

/** PATCH /api/v1/appointments/:id/status */
export const updateAppointmentStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const appointmentId = String(req.params['id']);
  const input = req.body as UpdateStatusInput;

  const appointment = await appointmentService.updateAppointmentStatus(
    appointmentId,
    input,
    user.hospitalId,
    user.userId,
    user.role,
  );

  sendSuccess({ res, message: 'Appointment status updated successfully', data: appointment });
});

/** POST /api/v1/appointments/:id/reschedule */
export const rescheduleAppointment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const appointmentId = String(req.params['id']);
  const input = req.body as RescheduleInput;

  const appointment = await appointmentService.rescheduleAppointment(
    appointmentId,
    input,
    user.hospitalId,
    user.userId,
  );

  sendSuccess({ res, message: 'Appointment rescheduled successfully', data: appointment });
});

/** GET /api/v1/sessions/:id/queue */
export const getSessionQueue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const sessionId = String(req.params['id']);

  const queue = await appointmentService.getSessionQueue(sessionId, user.hospitalId);

  sendSuccess({ res, message: 'Session queue retrieved successfully', data: queue });
});

/** GET /api/v1/appointments/:id/receipt-data */
export const getReceiptData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const appointmentId = String(req.params['id']);

  const receipt = await appointmentService.getReceiptData(appointmentId, user.hospitalId);

  sendSuccess({ res, message: 'Receipt data retrieved successfully', data: receipt });
});
