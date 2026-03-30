// ──────────────────────────────────────────────────────────────────────────────
// Session Controller — thin HTTP handlers for session endpoints.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/apiError';
import * as sessionService from './session.service';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  UpdateStatusInput,
  ListSessionsQuery,
  AvailableSessionsQuery,
  DoctorSessionsQuery,
} from './session.validation';

// ── Helper ───────────────────────────────────────────────────────────────────

function requireUser(req: Request) {
  if (!req.user) throw new AppError('Authentication required.', 401);
  return req.user;
}

// ── Session CRUD ─────────────────────────────────────────────────────────────

/** POST /api/v1/sessions */
export const createSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const input = req.body as CreateSessionInput;

  const session = await sessionService.createSession(input, user.hospitalId, user.userId);

  sendSuccess({ res, statusCode: 201, message: 'Session created successfully', data: session });
});

/** GET /api/v1/sessions */
export const listSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as ListSessionsQuery;

  const result = await sessionService.listSessions(user.hospitalId, query);

  sendSuccess({
    res,
    message: 'Sessions retrieved successfully',
    data: result.data,
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

/** GET /api/v1/sessions/available */
export const getAvailableSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const query = req.query as unknown as AvailableSessionsQuery;

  const result = await sessionService.getAvailableSessions(user.hospitalId, query);

  sendSuccess({
    res,
    message: 'Available sessions retrieved successfully',
    data: result.data,
    meta: { total: result.total, page: result.page, limit: result.limit },
  });
});

/** GET /api/v1/sessions/:id */
export const getSessionById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const sessionId = String(req.params['id']);

  const session = await sessionService.getSessionById(sessionId, user.hospitalId);

  sendSuccess({ res, message: 'Session retrieved successfully', data: session });
});

/** PUT /api/v1/sessions/:id */
export const updateSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const sessionId = String(req.params['id']);
  const input = req.body as UpdateSessionInput;

  const session = await sessionService.updateSession(sessionId, input, user.hospitalId, user.userId);

  sendSuccess({ res, message: 'Session updated successfully', data: session });
});

/** PATCH /api/v1/sessions/:id/status */
export const updateSessionStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const sessionId = String(req.params['id']);
  const input = req.body as UpdateStatusInput;

  const session = await sessionService.updateSessionStatus(sessionId, input, user.hospitalId, user.userId);

  sendSuccess({ res, message: 'Session status updated successfully', data: session });
});

/** DELETE /api/v1/sessions/:id */
export const deleteSession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const sessionId = String(req.params['id']);

  await sessionService.deleteSession(sessionId, user.hospitalId, user.userId);

  sendSuccess({ res, message: 'Session deleted successfully' });
});

/** GET /api/v1/sessions/:id/slots */
export const getSessionSlots = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const sessionId = String(req.params['id']);

  const slots = await sessionService.getSessionSlots(sessionId, user.hospitalId);

  sendSuccess({ res, message: 'Session slots retrieved successfully', data: slots });
});

/** GET /api/v1/doctors/:id/sessions */
export const getDoctorSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const doctorId = String(req.params['id']);
  const query = req.query as unknown as DoctorSessionsQuery;

  const sessions = await sessionService.getDoctorSessions(doctorId, user.hospitalId, query);

  sendSuccess({ res, message: 'Doctor sessions retrieved successfully', data: sessions });
});
