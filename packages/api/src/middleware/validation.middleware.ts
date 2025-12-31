/**
 * Request validation middleware using Zod schemas
 * @module middleware/validation
 * 
 * Requirements: 9.5
 * - Validates request bodies against Zod schemas
 * - Returns 400 with field-level errors on validation failure
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ErrorResponse } from '../types/common.types';

/**
 * Formats Zod validation errors into field-level error details
 * @param error - ZodError from schema validation
 * @returns Record mapping field paths to error messages
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }
  
  return details;
}

/**
 * Creates a validation middleware for request body validation
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.body
 * 
 * @example
 * ```typescript
 * router.post('/', validateRequest(createTeacherSchema), async (req, res) => {
 *   // req.body is now validated and typed
 * });
 * ```
 */
export function validateRequest<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: formatZodErrors(result.error),
        },
      };
      
      res.status(400).json(errorResponse);
      return;
    }
    
    // Replace req.body with parsed/transformed data
    req.body = result.data;
    next();
  };
}

/**
 * Creates a validation middleware for query parameters
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.query
 */
export function validateQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Query parameter validation failed',
          details: formatZodErrors(result.error),
        },
      };
      
      res.status(400).json(errorResponse);
      return;
    }
    
    // Store validated query params
    (req as any).validatedQuery = result.data;
    next();
  };
}

/**
 * Creates a validation middleware for route parameters
 * 
 * @param schema - Zod schema to validate against
 * @returns Express middleware that validates req.params
 */
export function validateParams<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Route parameter validation failed',
          details: formatZodErrors(result.error),
        },
      };
      
      res.status(400).json(errorResponse);
      return;
    }
    
    // Store validated params
    (req as any).validatedParams = result.data;
    next();
  };
}
