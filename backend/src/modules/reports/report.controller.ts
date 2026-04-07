// ──────────────────────────────────────────────────────────────────────────────
// Report Controller
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import * as reportService from './report.service';
import { StatusCodes } from 'http-status-codes';

export async function getDailyAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getDailyAppointments(req.user!.hospital_id, req.query.date as string | undefined);
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getMonthlyAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    
    // Both must be provided together or neither
    if ((year && !month) || (!year && month)) {
      return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Year and month must be provided together', code: 'INVALID_PARAMETERS' });
    }

    const data = await reportService.getMonthlyAppointments(req.user!.hospital_id, year, month);
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorWiseAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getDoctorWiseAppointments(req.user!.hospital_id, req.query as { from?: string; to?: string; doctor_id?: string });
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getCancelledAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const query = {
      from: req.query.from as string,
      to: req.query.to as string,
      doctor_id: req.query.doctor_id as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    };

    const data = await reportService.getCancelledAppointments(req.user!.hospital_id, query);
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getPatientSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getPatientSummary(req.user!.hospital_id, req.query as { from?: string; to?: string });
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorPerformance(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getDoctorPerformance(req.user!.hospital_id, req.query as { from?: string; to?: string });
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}
