/**
 * Request validation middleware using Zod schemas
 * @module middleware/validation
 *
 * Requirements: 9.5
 * - Validates request bodies against Zod schemas
 * - Returns 400 with field-level errors on validation failure
 */

import { Request, Response, NextFunction, RequestHandler, RequestParamHandler } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { createErrorResponse } from '../errors/localApiError';

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

function sendIntegerValidationError(
  req: Request,
  res: Response,
  field: string,
  message: string
): void {
  res.status(400).json(
    createErrorResponse(req, 400, 'VALIDATION_ERROR', 'Request validation failed', {
      fields: { [field]: [message] },
    })
  );
}

/** Reject malformed route IDs before handlers can partially parse them. */
export const positiveIntegerParam: RequestParamHandler = (req, res, next, value, name): void => {
  if (parsePositiveInteger(value) === null) {
    sendIntegerValidationError(req, res, name, `${name} must be a positive integer`);
    return;
  }

  next();
};

/** Create a strict bounded-integer route parameter validator. */
export function integerParamInRange(minimum: number, maximum: number): RequestParamHandler {
  return (req, res, next, value, name): void => {
    if (parseIntegerInRange(value, minimum, maximum) === null) {
      sendIntegerValidationError(
        req,
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
  return (req, res, next, value, name): void => {
    if (
      typeof value !== 'string' ||
      value.length < minimumLength ||
      value.length > maximumLength ||
      !pattern.test(value)
    ) {
      sendIntegerValidationError(req, res, name, `${name} has an invalid format`);
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
      sendIntegerValidationError(req, res, field, `${field} must be a positive integer`);
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
    const requestSchema = schema instanceof z.ZodObject ? schema.strict() : schema;
    const result = requestSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json(
        createErrorResponse(req, 400, 'VALIDATION_ERROR', 'Request validation failed', {
          fields: formatZodErrors(result.error),
        })
      );
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
    const querySchema = schema instanceof z.ZodObject ? schema.strict() : schema;
    const result = querySchema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json(
        createErrorResponse(req, 400, 'VALIDATION_ERROR', 'Query parameter validation failed', {
          fields: formatZodErrors(result.error),
        })
      );
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
    const paramsSchema = schema instanceof z.ZodObject ? schema.strict() : schema;
    const result = paramsSchema.safeParse(req.params);

    if (!result.success) {
      res.status(400).json(
        createErrorResponse(req, 400, 'VALIDATION_ERROR', 'Route parameter validation failed', {
          fields: formatZodErrors(result.error),
        })
      );
      return;
    }

    // Store validated params
    (req as any).validatedParams = result.data;
    next();
  };
}

/** Reject route-specific bodies after parsing but before expensive work begins. */
export function limitRequestBodyBytes(maximumBytes: number): RequestHandler {
  return (req, res, next): void => {
    const contentLength = Number(req.header('content-length') ?? 0);
    const actualBytes = Buffer.byteLength(JSON.stringify(req.body ?? null), 'utf8');
    if (
      !Number.isFinite(contentLength) ||
      contentLength > maximumBytes ||
      actualBytes > maximumBytes
    ) {
      res.status(413).json(
        createErrorResponse(req, 413, 'REQUEST_TOO_LARGE', 'Request body is too large', {
          maximumBytes,
        })
      );
      return;
    }
    next();
  };
}
