// ──────────────────────────────────────────────────────────────────────────────
// Patient Controller — thin HTTP handlers for patient endpoints.
//
// Controllers only:
//   1. Extract data from the request (body, params, query, req.user)
//   2. Call the service layer
//   3. Send the response
// No business logic lives here.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/apiError';
import * as patientService from './patient.service';
import type { CreatePatientInput, UpdatePatientInput, ListPatientsQuery } from './patient.validation';

/**
 * POST /api/v1/patients
 * Create a new patient with profile.
 */
export const createPatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const input = req.body as CreatePatientInput;
  const hospitalId = req.user.hospitalId;
  const userId = req.user.userId;

  const patient = await patientService.createPatient(input, hospitalId, userId);

  sendSuccess({
    res,
    statusCode: 201,
    message: 'Patient created successfully',
    data: patient,
  });
});

/**
 * GET /api/v1/patients
 * List patients with search and pagination.
 */
export const listPatients = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const { search, page, limit } = req.query as unknown as ListPatientsQuery;
  const hospitalId = req.user.hospitalId;

  const result = await patientService.listPatients(hospitalId, { search, page, limit });

  sendSuccess({
    res,
    message: 'Patients retrieved successfully',
    data: result.data,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
    },
  });
});

/**
 * GET /api/v1/patients/:id
 * Get a single patient with profile.
 */
export const getPatientById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const patientId = String(req.params['id']);
  const hospitalId = req.user.hospitalId;

  const patient = await patientService.getPatientById(patientId, hospitalId);

  sendSuccess({
    res,
    message: 'Patient retrieved successfully',
    data: patient,
  });
});

/**
 * PUT /api/v1/patients/:id
 * Update patient + profile details.
 */
export const updatePatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const patientId = String(req.params['id']);
  const input = req.body as UpdatePatientInput;
  const hospitalId = req.user.hospitalId;
  const userId = req.user.userId;

  const patient = await patientService.updatePatient(patientId, input, hospitalId, userId);

  sendSuccess({
    res,
    message: 'Patient updated successfully',
    data: patient,
  });
});

/**
 * GET /api/v1/patients/:id/appointments
 * Get appointment history for a patient.
 */
export const getPatientAppointments = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const patientId = String(req.params['id']);
  const hospitalId = req.user.hospitalId;

  const appointments = await patientService.getPatientAppointments(patientId, hospitalId);

  sendSuccess({
    res,
    message: 'Patient appointments retrieved successfully',
    data: appointments,
  });
});

/**
 * DELETE /api/v1/patients/:id
 * Permanently delete a patient (blocked if they have appointment records).
 */
export const deletePatient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401);
  }

  const patientId = String(req.params['id']);

  await patientService.deletePatient(patientId, req.user.hospitalId, req.user.userId);

  sendSuccess({
    res,
    message: 'Patient deleted successfully',
    data: null,
  });
});
