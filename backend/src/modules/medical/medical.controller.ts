import { Request, Response, NextFunction } from 'express';
import * as medicalService from './medical.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function createMedicalRecord(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const record = await medicalService.createMedicalRecord(req.body, req.user as any);
    sendSuccess({ res, statusCode: 201, message: 'Medical record created successfully', data: record });
  } catch (error) {
    next(error);
  }
}

export async function getMedicalRecordById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const record = await medicalService.getMedicalRecordById(req.params.id as string, req.user as any);
    sendSuccess({ res, statusCode: 200, message: 'Medical record retrieved successfully', data: record });
  } catch (error) {
    next(error);
  }
}

export async function getMedicalRecordByAppointmentId(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const record = await medicalService.getMedicalRecordByAppointmentId(
      req.params.appointment_id as string,
      req.user as any
    );
    sendSuccess({ res, statusCode: 200, message: 'Medical record retrieved successfully', data: record });
  } catch (error) {
    next(error);
  }
}

export async function updateMedicalRecord(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updated = await medicalService.updateMedicalRecord(req.params.id as string, req.body, req.user as any);
    sendSuccess({ res, statusCode: 200, message: 'Medical record updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
}

export async function getPatientMedicalHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const options = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      from: req.query.from as string,
      to: req.query.to as string,
      doctor_id: req.query.doctor_id as string,
    };
    
    const result = await medicalService.getPatientMedicalHistory(req.params.patient_id as string, options, req.user as any);
    sendSuccess({ res, statusCode: 200, message: 'Patient medical history retrieved successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getPatientPrescriptions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const options = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      from: req.query.from as string,
      to: req.query.to as string,
    };
    
    const result = await medicalService.getPatientPrescriptions(req.params.patient_id as string, options, req.user as any);
    sendSuccess({ res, statusCode: 200, message: 'Patient prescriptions retrieved successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorMedicalRecords(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const options = {
      doctor_id: req.params.doctor_id as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      from: req.query.from as string,
      to: req.query.to as string,
      patient_id: req.query.patient_id as string,
    };
    
    const result = await medicalService.getDoctorMedicalRecords(options, req.user as any);
    sendSuccess({ res, statusCode: 200, message: 'Doctor medical records retrieved successfully', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getPrintData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await medicalService.getPrintData(req.params.id as string, req.user as any);
    sendSuccess({ res, statusCode: 200, message: 'Medical record print data retrieved successfully', data: result });
  } catch (error) {
    next(error);
  }
}
