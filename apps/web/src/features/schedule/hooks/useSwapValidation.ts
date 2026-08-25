import { API_BASE_URL } from '@/lib/apiBase';
/**
 * React hook and helpers for solver-backed swap validation API calls.
 */

import { useMutation } from '@tanstack/react-query';

import type {
  ConstraintViolation,
  DayOfWeek,
  ScheduledLesson,
  SwapAffectedLesson,
  SwapValidationResult,
} from '../types';


/**
 * Request payload for swap validation.
 */
export interface SwapValidationRequest {
  timetableId: number;
  sourceSlot: {
    classId: string;
    day: DayOfWeek;
    period: number;
  };
  targetSlot: {
    classId: string;
    day: DayOfWeek;
    period: number;
  };
}

/**
 * Solver-backed validation payload with the originating swap context restored
 * for the frontend store.
 */
export interface SolverSwapValidationResult extends SwapValidationResult {
  affectedLessons: SwapAffectedLesson[];
  totalMoves: number;
}

export type SwapValidationResponse = SolverSwapValidationResult;

interface ApiConstraintViolation {
  type: string;
  severity: 'hard' | 'soft';
  message: string;
  details: Record<string, unknown>;
}

interface ApiValidationResponse {
  isValid: boolean;
  canProceedWithWarning: boolean;
  errors: ApiConstraintViolation[];
  warnings: ApiConstraintViolation[];
  affectedLessons: SwapAffectedLesson[];
  totalMoves: number;
}

interface SwapValidationContext {
  sourceLesson: ScheduledLesson;
  targetLesson: ScheduledLesson | null;
  targetSlot: {
    day: DayOfWeek;
    period: number;
  };
}

/**
 * Builds the API payload for a specific source lesson and target slot/lesson.
 */
export function createSwapValidationRequest(
  timetableId: number,
  sourceLesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  targetLesson: ScheduledLesson | null
): SwapValidationRequest {
  return {
    timetableId,
    sourceSlot: {
      classId: sourceLesson.classId,
      day: sourceLesson.day,
      period: sourceLesson.periodIndex,
    },
    targetSlot: {
      classId: targetLesson?.classId ?? sourceLesson.classId,
      day: targetSlot.day,
      period: targetSlot.period,
    },
  };
}

function normalizeConstraintType(type: string): ConstraintViolation['type'] {
  switch (type) {
    case 'TEACHER_TIME_PREFERENCE':
      return 'TEACHER_PREFERENCE';
    case 'MAX_CONSECUTIVE_EXCEEDED':
      return 'CONSECUTIVE_EXCEEDED';
    case 'DIFFICULT_SUBJECT_AFTERNOON':
      return 'DIFFICULT_AFTERNOON';
    default:
      return type as ConstraintViolation['type'];
  }
}

function mapViolation(violation: ApiConstraintViolation): ConstraintViolation {
  return {
    type: normalizeConstraintType(violation.type),
    severity: violation.severity,
    message: violation.message,
    details: violation.details,
  };
}

function mapValidationResponse(
  context: SwapValidationContext,
  response: ApiValidationResponse
): SolverSwapValidationResult {
  return {
    isValid: response.isValid,
    canProceedWithWarning: response.canProceedWithWarning,
    errors: response.errors.map(mapViolation),
    warnings: response.warnings.map(mapViolation),
    swap: {
      lessonA: context.sourceLesson,
      lessonB: context.targetLesson,
      slotA: {
        day: context.sourceLesson.day,
        period: context.sourceLesson.periodIndex,
      },
      slotB: context.targetSlot,
    },
    affectedLessons: response.affectedLessons,
    totalMoves: response.totalMoves,
  };
}

/**
 * Executes the raw swap validation request against the API.
 */
export async function fetchSwapValidation(
  request: SwapValidationRequest,
  signal?: AbortSignal
): Promise<ApiValidationResponse> {
  const response = await fetch(`${API_BASE_URL}/swap/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.result as ApiValidationResponse;
}

/**
 * Validates a swap using the backend solver and restores the frontend swap
 * context needed for execution in the local draft store.
 */
export async function validateSwapWithSolver(
  timetableId: number,
  sourceLesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  targetLesson: ScheduledLesson | null,
  signal?: AbortSignal
): Promise<SolverSwapValidationResult> {
  const request = createSwapValidationRequest(timetableId, sourceLesson, targetSlot, targetLesson);
  const response = await fetchSwapValidation(request, signal);

  return mapValidationResponse(
    {
      sourceLesson,
      targetLesson,
      targetSlot,
    },
    response
  );
}

/**
 * Hook for validating an individual swap operation on demand.
 */
export function useSwapValidation() {
  return useMutation({
    mutationFn: async ({
      timetableId,
      sourceLesson,
      targetSlot,
      targetLesson,
    }: {
      timetableId: number;
      sourceLesson: ScheduledLesson;
      targetSlot: { day: DayOfWeek; period: number };
      targetLesson: ScheduledLesson | null;
    }): Promise<SolverSwapValidationResult> =>
      validateSwapWithSolver(timetableId, sourceLesson, targetSlot, targetLesson),
    onError: (error) => {
      console.error('Swap validation failed:', error);
    },
  });
}
