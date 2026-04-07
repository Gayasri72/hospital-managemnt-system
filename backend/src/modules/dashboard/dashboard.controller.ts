// ──────────────────────────────────────────────────────────────────────────────
// Dashboard Controller
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import * as dashboardService from './dashboard.service';
import { StatusCodes } from 'http-status-codes';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getDashboardData({
      user_id: req.user!.userId,
      role: req.user!.role,
      hospital_id: req.user!.hospitalId
    });
    
    res.status(StatusCodes.OK).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
}
