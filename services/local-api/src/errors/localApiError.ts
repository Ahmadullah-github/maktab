import type { NextFunction, Request, RequestHandler, Response } from 'express';

export const LOCAL_API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'FORBIDDEN',
  'REQUEST_TOO_LARGE',
  'OPERATION_CANCELLED',
  'OPERATION_TIMEOUT',
  'STORAGE_UNAVAILABLE',
  'ASSIGNMENT_CONFLICT',
  'ASSIGNMENT_VERSION_CONFLICT',
  'SOLVER_BUSY',
  'SOLVER_CANCELLED',
  'SOLVER_TIMEOUT',
  'SOLVER_NOT_FOUND',
  'SOLVER_SPAWN_ERROR',
  'SOLVER_RUNTIME_ERROR',
  'SOLVER_EMPTY_OUTPUT',
  'SOLVER_PARSE_ERROR',
  'SOLVER_INPUT_TOO_LARGE',
  'SOLVER_INVALID_OUTPUT',
  'SOLVER_FAILED',
  'EXPORT_CANCELLED',
  'EXPORT_TIMEOUT',
  'EXPORT_TOO_LARGE',
  'EXPORT_FAILED',
  'INTERNAL_ERROR',
] as const;

export type LocalApiErrorCode = (typeof LOCAL_API_ERROR_CODES)[number] | (string & {});

export interface LocalApiErrorResponse {
  success: false;
  error: {
    code: LocalApiErrorCode;
    message: string;
    correlationId: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export class LocalApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: LocalApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly retryable = false
  ) {
    super(message);
    this.name = 'LocalApiError';
  }
}

function codeForStatus(status: number): LocalApiErrorCode {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 413) return 'REQUEST_TOO_LARGE';
  if (status === 504) return 'OPERATION_TIMEOUT';
  return 'INTERNAL_ERROR';
}

function safeMessage(status: number, candidate: unknown): string {
  if (status >= 500) {
    if (status === 503) return 'The requested local service is temporarily unavailable.';
    if (status === 504) return 'The local operation timed out.';
    return 'The local operation could not be completed.';
  }
  return typeof candidate === 'string' && candidate.trim()
    ? candidate.trim().slice(0, 2_000)
    : status === 404
      ? 'The requested resource was not found.'
      : status === 409
        ? 'The requested operation conflicts with current data.'
        : 'The request could not be processed.';
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function createErrorResponse(
  request: Request,
  status: number,
  code: LocalApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
  retryable = false
): LocalApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message: safeMessage(status, message),
      correlationId: request.requestContext?.requestId ?? 'unavailable',
      retryable,
      ...(details && Object.keys(details).length > 0 ? { details } : {}),
    },
  };
}

export function normalizeErrorBody(
  request: Request,
  status: number,
  body: unknown
): LocalApiErrorResponse {
  const record = objectRecord(body);
  const nested = objectRecord(record?.error);
  if (
    record?.success === false &&
    nested &&
    typeof nested.code === 'string' &&
    typeof nested.message === 'string' &&
    typeof nested.correlationId === 'string' &&
    typeof nested.retryable === 'boolean'
  ) {
    return body as LocalApiErrorResponse;
  }

  const solverErrors = Array.isArray(record?.errors) ? record.errors : null;
  const firstSolverError = solverErrors ? objectRecord(solverErrors[0]) : null;
  const candidateCode =
    (typeof nested?.code === 'string' && nested.code) ||
    (typeof record?.code === 'string' && record.code) ||
    (typeof firstSolverError?.error_code === 'string' && firstSolverError.error_code) ||
    codeForStatus(status);
  const candidateMessage =
    (typeof nested?.message === 'string' && nested.message) ||
    (typeof record?.message === 'string' && record.message) ||
    (typeof record?.error === 'string' && record.error) ||
    (typeof firstSolverError?.message_english === 'string' && firstSolverError.message_english) ||
    undefined;

  const details: Record<string, unknown> = {};
  const explicitDetails = objectRecord(nested?.details) ?? objectRecord(record?.details);
  if (explicitDetails) Object.assign(details, explicitDetails);
  if (nested?.conflicts && Array.isArray(nested.conflicts)) details.conflicts = nested.conflicts;
  else if (record?.conflicts && Array.isArray(record.conflicts)) details.conflicts = record.conflicts;
  if (solverErrors) details.solver = record;
  if (record) {
    for (const [key, value] of Object.entries(record)) {
      if (!['success', 'error', 'code', 'message', 'details', 'conflicts', 'errors'].includes(key)) {
        details[key] = value;
      }
    }
  }

  const retryable =
    candidateCode === 'SOLVER_BUSY' ||
    candidateCode === 'SOLVER_TIMEOUT' ||
    candidateCode === 'OPERATION_TIMEOUT' ||
    status === 503 ||
    status === 504;
  return createErrorResponse(
    request,
    status,
    candidateCode,
    safeMessage(status, candidateMessage),
    details,
    retryable
  );
}

/** Normalize legacy route failures while routes are migrated to LocalApiError. */
export const errorEnvelopeMiddleware: RequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  const originalJson = response.json.bind(response);
  response.json = ((body: unknown) => {
    if (response.statusCode >= 400) return originalJson(normalizeErrorBody(request, response.statusCode, body));
    return originalJson(body);
  }) as Response['json'];
  next();
};
