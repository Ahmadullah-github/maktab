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
import { logger } from '../utils/logger';
import { useScheduleStore } from '../stores/scheduleStore';

/**
 * Request payload for swap validation.
 */
export interface SwapValidationRequest {
  timetableId: number;
  expectedRevision: number;
  draftLessons: ScheduledLesson[];
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
  message_farsi?: string;
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
  expectedRevision: number,
  draftLessons: ScheduledLesson[],
  sourceLesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  targetLesson: ScheduledLesson | null
): SwapValidationRequest {
  return {
    timetableId,
    expectedRevision,
    draftLessons,
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
    messageFarsi: violation.message_farsi,
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
      error: response.statusText,
    }));
    throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`);
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
  expectedRevision: number,
  draftLessons: ScheduledLesson[],
  sourceLesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  targetLesson: ScheduledLesson | null,
  signal?: AbortSignal
): Promise<SolverSwapValidationResult> {
  const request = createSwapValidationRequest(
    timetableId,
    expectedRevision,
    draftLessons,
    sourceLesson,
    targetSlot,
    targetLesson
  );
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
  const expectedRevision = useScheduleStore((state) => state.scheduleRevision);
  const draftLessons = useScheduleStore((state) => state.lessons);

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
    }): Promise<SolverSwapValidationResult> => {
      if (expectedRevision === null) {
        throw new Error('No timetable revision is loaded');
      }
      return validateSwapWithSolver(
        timetableId,
        expectedRevision,
        draftLessons,
        sourceLesson,
        targetSlot,
        targetLesson
      );
    },
    onError: (error) => {
      logger.error('Swap validation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
}
