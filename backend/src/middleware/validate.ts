// ──────────────────────────────────────────────────────────────────────────────
// Zod Validation Middleware — validates request body, params, or query
// against a Zod schema before the handler executes.
//
// Usage:
//   router.post('/patients', validate(createPatientSchema), patientController.create);
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from 'express';
import { type AnyZodObject, type ZodError, ZodSchema } from 'zod';
import { sendError } from '../utils/apiResponse';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        const bodyParsed = schemas.body.parse(req.body);
        Object.defineProperty(req, 'body', { value: bodyParsed, writable: true, enumerable: true, configurable: true });
      }
      if (schemas.params) {
        const paramsParsed = schemas.params.parse(req.params);
        Object.defineProperty(req, 'params', { value: paramsParsed, writable: true, enumerable: true, configurable: true });
      }
      if (schemas.query) {
        const queryParsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: queryParsed, writable: true, enumerable: true, configurable: true });
      }
    } catch (error) {
      const errors: string[] = [];
      if (error && typeof error === 'object' && 'errors' in error) {
        const zodError = error as ZodError;
        if (Array.isArray(zodError.errors)) {
          zodError.errors.forEach((e) => {
            errors.push(`${e.path.join('.')}: ${e.message}`);
          });
        } else {
          errors.push(error.toString());
        }
      } else {
        errors.push((error as Error).message || 'Unknown validation error');
      }
      
      sendError({
        res,
        statusCode: 422,
        message: 'Validation failed',
        errors,
      });
      return;
    }
    next();
  };
};
