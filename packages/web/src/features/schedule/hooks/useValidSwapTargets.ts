/**
 * Hook for validating swap targets on demand.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type {
  CellValidationStatus,
  DayOfWeek,
  ScheduledLesson,
  SwapValidationResult,
} from '../types';
import { validateSwap } from '../utils/constraintChecker';
import { createSlotKey } from '../utils/indexBuilder';
import {
  canExecuteSwap,
  createClassConstraintMap,
  createRoomConstraintMap,
  createSubjectConstraintMap,
  createSwapOperation,
  createTeacherConstraintMap,
  getSwapValidationStatus,
  rankSwapValidationResult,
} from '../utils/swapValidation';
import { validateSwapWithSolver } from './useSwapValidation';

interface SwapTargetCandidate {
  slotKey: string;
  targetSlot: {
    day: DayOfWeek;
    period: number;
  };
  targetLesson: ScheduledLesson | null;
}

/**
 * Options for the useValidSwapTargets hook.
 */
export interface UseValidSwapTargetsOptions {
  /** View scope: 'class' or 'teacher'. */
  viewScope: 'class' | 'teacher';
  /** ID of the class or teacher being viewed. */
  scopeId: string;
}

/**
 * Return type for the useValidSwapTargets hook.
 */
export interface UseValidSwapTargetsReturn {
  /** Best validation result per slot, for aggregate cell status and dialogs. */
  validationResults: Map<string, SwapValidationResult>;
  /** All candidate validation results for a slot. */
  getSlotValidationResults: (day: DayOfWeek, period: number) => SwapValidationResult[];
  /** Get validation status for a specific slot. */
  getValidationStatus: (day: DayOfWeek, period: number) => CellValidationStatus;
  /** Validate one slot on demand when the user acts before prefetch completes. */
  validateSlot: (day: DayOfWeek, period: number) => Promise<SwapValidationResult[]>;
  /** Whether any valid targets exist. */
  hasValidTargets: boolean;
  /** Whether solver-backed validation is still loading. */
  isLoading: boolean;
  /** Slot currently being validated, if any. */
  validatingSlotKey: string | null;
  /** Last validation error, if any. */
  error: Error | null;
}

/**
 * Converts a SwapValidationResult to a CellValidationStatus.
 */
export function getValidationStatusFromResult(
  result: SwapValidationResult | undefined
): CellValidationStatus {
  return getSwapValidationStatus(result);
}

function getResultRank(result: SwapValidationResult): number {
  return rankSwapValidationResult(result);
}

function pickBestResult(results: SwapValidationResult[]): SwapValidationResult | undefined {
  let best: SwapValidationResult | undefined;
  let bestRank = -1;

  for (const result of results) {
    const rank = getResultRank(result);
    if (rank > bestRank) {
      best = result;
      bestRank = rank;
    }
  }

  return best;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

/**
 * Hook for validating swap targets for a selected lesson one slot at a time.
 */
export function useValidSwapTargets(
  selectedLesson: ScheduledLesson | null,
  options: UseValidSwapTargetsOptions
): UseValidSwapTargetsReturn {
  const { viewScope, scopeId } = options;

  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const indexes = useScheduleStore((state) => state.indexes);
  const metadata = useScheduleStore((state) => state.metadata);
  const teachers = useScheduleStore((state) => state.teachers);
  const rooms = useScheduleStore((state) => state.rooms);
  const subjects = useScheduleStore((state) => state.subjects);
  const classes = useScheduleStore((state) => state.classes);

  const [validationResultsBySlot, setValidationResultsBySlot] = useState<
    Map<string, SwapValidationResult[]>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [validatingSlotKey, setValidatingSlotKey] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const activeValidationRef = useRef<{
    slotKey: string;
    promise: Promise<SwapValidationResult[]>;
    cancel: () => void;
  } | null>(null);

  const teacherConstraints = useMemo(() => createTeacherConstraintMap(teachers), [teachers]);
  const roomConstraints = useMemo(() => createRoomConstraintMap(rooms), [rooms]);
  const subjectConstraints = useMemo(() => createSubjectConstraintMap(subjects), [subjects]);
  const classConstraints = useMemo(() => createClassConstraintMap(classes), [classes]);

  const slotCandidates = useMemo(() => {
    const candidatesBySlot = new Map<string, SwapTargetCandidate[]>();

    if (!selectedLesson || !scheduleId || !scopeId || !metadata?.periodConfiguration) {
      return candidatesBySlot;
    }

    const { periodsPerDayMap, daysOfWeek } = metadata.periodConfiguration;
    const scopeLessons =
      viewScope === 'class'
        ? (indexes.byClass.get(scopeId) ?? [])
        : (indexes.byTeacher.get(scopeId) ?? []);

    const lessonsBySlot = new Map<string, ScheduledLesson[]>();
    for (const lesson of scopeLessons) {
      const slotKey = createSlotKey(lesson.day, lesson.periodIndex);
      const existing = lessonsBySlot.get(slotKey) ?? [];
      existing.push(lesson);
      lessonsBySlot.set(slotKey, existing);
    }

    for (const rawDay of daysOfWeek) {
      const day = rawDay as DayOfWeek;
      const periodsForDay = periodsPerDayMap[day] ?? 0;

      for (let period = 0; period < periodsForDay; period++) {
        if (selectedLesson.day === day && selectedLesson.periodIndex === period) {
          continue;
        }

        const slotKey = createSlotKey(day, period);
        const lessonsAtSlot = lessonsBySlot.get(slotKey) ?? [];

        if (lessonsAtSlot.length === 0) {
          candidatesBySlot.set(slotKey, [
            {
              slotKey,
              targetSlot: { day, period },
              targetLesson: null,
            },
          ]);
          continue;
        }

        candidatesBySlot.set(
          slotKey,
          lessonsAtSlot.map((targetLesson) => ({
            slotKey,
            targetSlot: { day, period },
            targetLesson,
          }))
        );
      }
    }

    return candidatesBySlot;
  }, [indexes, metadata, scheduleId, scopeId, selectedLesson, viewScope]);

  const cancelPendingValidation = useCallback(() => {
    requestIdRef.current += 1;

    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeValidationRef.current?.cancel();
    activeValidationRef.current = null;
    setValidatingSlotKey(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setValidationResultsBySlot(new Map());
    setError(null);
    cancelPendingValidation();
  }, [cancelPendingValidation, scheduleId, scopeId, selectedLesson, viewScope]);

  useEffect(() => cancelPendingValidation, [cancelPendingValidation]);

  const validateSlot = useCallback(
    async (day: DayOfWeek, period: number): Promise<SwapValidationResult[]> => {
      if (!scheduleId || !selectedLesson) {
        return [];
      }

      const slotKey = createSlotKey(day, period);
      if (activeValidationRef.current?.slotKey === slotKey) {
        return activeValidationRef.current.promise;
      }

      if (validatingSlotKey !== null && validatingSlotKey !== slotKey) {
        cancelPendingValidation();
      }

      const cachedResults = validationResultsBySlot.get(slotKey);
      if (cachedResults) {
        return cachedResults;
      }

      cancelPendingValidation();
      setError(null);

      const candidates = slotCandidates.get(slotKey) ?? [];
      if (candidates.length === 0) {
        return [];
      }

      const localResults = candidates.map((candidate) =>
        validateSwap(
          createSwapOperation(selectedLesson, candidate.targetSlot, candidate.targetLesson),
          indexes,
          teacherConstraints,
          roomConstraints,
          subjectConstraints,
          classConstraints
        )
      );

      if (localResults.every((result) => !canExecuteSwap(result))) {
        setValidationResultsBySlot((previousResults) => {
          const nextResults = new Map(previousResults);
          nextResults.set(slotKey, localResults);
          return nextResults;
        });
        return localResults;
      }

      setValidatingSlotKey(slotKey);
      setIsLoading(true);

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      let cancelActiveValidation = () => {};

      const validationPromise = new Promise<SwapValidationResult[]>((resolve, reject) => {
        let settled = false;

        const resolveIfPending = (results: SwapValidationResult[]) => {
          if (settled) {
            return;
          }

          settled = true;
          resolve(results);
        };

        const rejectIfPending = (validationError: Error) => {
          if (settled) {
            return;
          }

          settled = true;
          reject(validationError);
        };

        cancelActiveValidation = () => {
          resolveIfPending([]);
        };

        debounceTimeoutRef.current = setTimeout(async () => {
          const controller = new AbortController();
          abortControllerRef.current = controller;

          try {
            const results = await Promise.all(
              candidates.map((candidate) =>
                validateSwapWithSolver(
                  scheduleId,
                  selectedLesson,
                  candidate.targetSlot,
                  candidate.targetLesson,
                  controller.signal
                )
              )
            );

            if (requestIdRef.current !== requestId) {
              resolveIfPending([]);
              return;
            }

            setValidationResultsBySlot((previousResults) => {
              const nextResults = new Map(previousResults);
              nextResults.set(slotKey, results);
              return nextResults;
            });
            setValidatingSlotKey(null);
            setIsLoading(false);
            activeValidationRef.current = null;
            resolveIfPending(results);
          } catch (validationError) {
            if (requestIdRef.current !== requestId || isAbortError(validationError)) {
              resolveIfPending([]);
              return;
            }

            const normalizedError =
              validationError instanceof Error
                ? validationError
                : new Error(String(validationError));

            setValidatingSlotKey(null);
            setIsLoading(false);
            setError(normalizedError);
            activeValidationRef.current = null;
            rejectIfPending(normalizedError);
          } finally {
            if (abortControllerRef.current === controller) {
              abortControllerRef.current = null;
            }

            if (debounceTimeoutRef.current !== null) {
              clearTimeout(debounceTimeoutRef.current);
              debounceTimeoutRef.current = null;
            }
          }
        }, 200);
      });

      activeValidationRef.current = {
        slotKey,
        promise: validationPromise,
        cancel: () => {
          if (activeValidationRef.current?.slotKey === slotKey) {
            activeValidationRef.current = null;
          }
          cancelActiveValidation();
        },
      };

      return validationPromise;
    },
    [
      cancelPendingValidation,
      classConstraints,
      indexes,
      roomConstraints,
      scheduleId,
      selectedLesson,
      slotCandidates,
      subjectConstraints,
      teacherConstraints,
      validatingSlotKey,
      validationResultsBySlot,
    ]
  );

  const validationResults = useMemo(() => {
    const bestResults = new Map<string, SwapValidationResult>();

    for (const [slotKey, results] of validationResultsBySlot) {
      const bestResult = pickBestResult(results);
      if (bestResult) {
        bestResults.set(slotKey, bestResult);
      }
    }

    return bestResults;
  }, [validationResultsBySlot]);

  const getSlotValidationResults = useCallback(
    (day: DayOfWeek, period: number): SwapValidationResult[] =>
      validationResultsBySlot.get(createSlotKey(day, period)) ?? [],
    [validationResultsBySlot]
  );

  const getValidationStatus = useCallback(
    (day: DayOfWeek, period: number): CellValidationStatus => {
      const slotKey = createSlotKey(day, period);
      if (validatingSlotKey === slotKey) {
        return 'checking';
      }

      return getValidationStatusFromResult(validationResults.get(slotKey));
    },
    [validationResults, validatingSlotKey]
  );

  const hasValidTargets = useMemo(() => {
    for (const results of validationResultsBySlot.values()) {
      if (results.some((result) => canExecuteSwap(result))) {
        return true;
      }
    }

    return false;
  }, [validationResultsBySlot]);

  return {
    validationResults,
    getSlotValidationResults,
    getValidationStatus,
    validateSlot,
    hasValidTargets,
    isLoading,
    validatingSlotKey,
    error,
  };
}
