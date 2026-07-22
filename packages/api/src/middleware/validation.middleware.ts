/**
 * Request validation middleware using Zod schemas
 * @module middleware/validation
 *
 * Requirements: 9.5
 * - Validates request bodies against Zod schemas
 * - Returns 400 with field-level errors on validation failure
 */

import { Request, Response, NextFunction, RequestHandler, RequestParamHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ErrorResponse } from '../types/common.types';
import { createOperationIssue, createOperationResponse } from '../types/operation.types';

/** Parse an entire value as a safe positive integer; partial strings are rejected. */
export function parsePositiveInteger(value: unknown): number | null {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (!/^[1-9]\d*$/.test(text)) return null;

  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function parseIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  const parsed = parsePositiveInteger(value);
  return parsed !== null && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function sendIntegerValidationError(res: Response, field: string, message: string): void {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: { [field]: [message] },
    },
  };

  res.status(400).json(errorResponse);
}

/** Reject malformed route IDs before handlers can partially parse them. */
export const positiveIntegerParam: RequestParamHandler = (_req, res, next, value, name): void => {
  if (parsePositiveInteger(value) === null) {
    sendIntegerValidationError(res, name, `${name} must be a positive integer`);
    return;
  }

  next();
};

/** Create a strict bounded-integer route parameter validator. */
export function integerParamInRange(minimum: number, maximum: number): RequestParamHandler {
  return (_req, res, next, value, name): void => {
    if (parseIntegerInRange(value, minimum, maximum) === null) {
      sendIntegerValidationError(
        res,
        name,
        `${name} must be an integer between ${minimum} and ${maximum}`
      );
      return;
    }

    next();
  };
}

/** Create a bounded route-key validator for configuration keys, codes, and job tokens. */
export function textParam(
  minimumLength = 1,
  maximumLength = 128,
  pattern: RegExp = /^[\p{L}\p{N}_.:-]+$/u
): RequestParamHandler {
  return (_req, res, next, value, name): void => {
    if (
      typeof value !== 'string' ||
      value.length < minimumLength ||
      value.length > maximumLength ||
      !pattern.test(value)
    ) {
      sendIntegerValidationError(res, name, `${name} has an invalid format`);
      return;
    }
    next();
  };
}

/** Validate an optional positive-integer query parameter without coercion. */
export function validateOptionalPositiveIntegerQuery(field: string): RequestHandler {
  return (req, res, next): void => {
    const value = req.query[field];
    if (value !== undefined && parsePositiveInteger(value) === null) {
      sendIntegerValidationError(res, field, `${field} must be a positive integer`);
      return;
    }

    next();
  };
}

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

/** Validate an operation request without leaking schema-library messages to clients. */
export function validateOperationRequest<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fieldIssues = result.error.issues.map((issue) => ({
        path: issue.path.length > 0 ? issue.path.join('.') : '_root',
        code: issue.code,
      }));
      const diagnosticId = req.requestContext?.requestId ?? 'untracked';

      res.status(400).json(
        createOperationResponse('failed', diagnosticId, {
          issues: [
            createOperationIssue('VALIDATION_ERROR', 'request', {
              messageParams: { fieldCount: fieldIssues.length },
              fieldIssues,
            }),
          ],
        })
      );
      return;
    }

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
