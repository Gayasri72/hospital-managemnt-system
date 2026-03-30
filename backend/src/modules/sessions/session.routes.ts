// ──────────────────────────────────────────────────────────────────────────────
// Session Routes — 9 endpoints for session management.
//
// Mounted at: /api/v1/sessions (session routes)
// Doctor sessions endpoint is added to doctor routes separately.
//
// All routes require authentication.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createSessionSchema,
  updateSessionSchema,
  updateStatusSchema,
  listSessionsQuerySchema,
  availableSessionsQuerySchema,
  sessionIdParamSchema,
} from './session.validation';
import * as ctrl from './session.controller';

export const sessionRouter = Router();
sessionRouter.use(authenticate);

// ── IMPORTANT: /available must come BEFORE /:id to avoid conflict ────────────

// GET /api/v1/sessions/available — find bookable sessions
sessionRouter.get(
  '/available',
  authorize('Receptionist', 'Hospital Admin', 'Super Admin'),
  validate({ query: availableSessionsQuerySchema }),
  ctrl.getAvailableSessions,
);

// POST /api/v1/sessions — create session
sessionRouter.post(
  '/',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ body: createSessionSchema }),
  ctrl.createSession,
);

// GET /api/v1/sessions — list with filters
sessionRouter.get(
  '/',
  validate({ query: listSessionsQuerySchema }),
  ctrl.listSessions,
);

// GET /api/v1/sessions/:id — get single session
sessionRouter.get(
  '/:id',
  validate({ params: sessionIdParamSchema }),
  ctrl.getSessionById,
);

// PUT /api/v1/sessions/:id — update session
sessionRouter.put(
  '/:id',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ params: sessionIdParamSchema, body: updateSessionSchema }),
  ctrl.updateSession,
);

// PATCH /api/v1/sessions/:id/status — update status
sessionRouter.patch(
  '/:id/status',
  authorize('Hospital Admin', 'Super Admin', 'Receptionist'),
  validate({ params: sessionIdParamSchema, body: updateStatusSchema }),
  ctrl.updateSessionStatus,
);

// DELETE /api/v1/sessions/:id — delete session
sessionRouter.delete(
  '/:id',
  authorize('Hospital Admin', 'Super Admin'),
  validate({ params: sessionIdParamSchema }),
  ctrl.deleteSession,
);

// GET /api/v1/sessions/:id/slots — get session slots
sessionRouter.get(
  '/:id/slots',
  validate({ params: sessionIdParamSchema }),
  ctrl.getSessionSlots,
);

// ── Session Queue (from Appointment module) ──────────────────────────────────
import * as appointmentCtrl from '../appointments/appointment.controller';

// GET /api/v1/sessions/:id/queue — live queue board
sessionRouter.get(
  '/:id/queue',
  authorize('Receptionist', 'Doctor', 'Hospital Admin', 'Super Admin'),
  validate({ params: sessionIdParamSchema }),
  appointmentCtrl.getSessionQueue,
);
