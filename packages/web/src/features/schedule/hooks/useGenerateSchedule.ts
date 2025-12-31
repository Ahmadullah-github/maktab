/**
 * Hook for managing schedule generation process
 *
 * Provides mutation for triggering the solver, tracking generation state,
 * elapsed time, and error handling with Persian messages
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { useClasses } from '@/features/classes';
import { useRooms } from '@/features/rooms';
import { useSubjects } from '@/features/subjects';
import { useTeachers } from '@/features/teachers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SCHEDULE_QUERY_KEYS } from '../constants';
import {
  ERROR_MESSAGES,
  TOAST_MESSAGES,
  type GenerationError,
  type SolverStrategy,
} from '../types';
import { logger } from '../utils/logger';
import { useSaveSchedule } from './useSchedule';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Input structure for the generate API
 */
interface GenerateInput {
  strategy: SolverStrategy;
  config: {
    schoolId?: number | null;
    strategy?: SolverStrategy;
  };
  teachers: unknown[];
  subjects: unknown[];
  classes: unknown[];
  rooms: unknown[];
}

/**
 * Response structure from the generate API
 */
interface GenerateResponse {
  success: boolean;
  data?: {
    schedule: unknown[];
    metadata: unknown;
    statistics: unknown;
  };
  error?: {
    type: string;
    message: string;
    details?: string;
  };
  message?: string;
}

/**
 * Custom error class for API errors with status code
 */
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calls the generate API endpoint
 */
async function generateScheduleApi(input: GenerateInput): Promise<GenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorType = data.error?.type || 'UNKNOWN';
    const errorMessage = data.error?.message || data.message || response.statusText;
    throw new ApiError(errorMessage, response.status, errorType);
  }

  return data;
}

/**
 * Parses API error into GenerationError structure
 */
function parseGenerationError(error: unknown): GenerationError {
  if (error instanceof ApiError) {
    switch (error.errorType) {
      case 'SOLVER_BUSY':
        return {
          type: 'SOLVER_BUSY',
          message: error.message,
          messageFa: ERROR_MESSAGES.solverBusy,
        };
      case 'SOLVER_TIMEOUT':
        return {
          type: 'SOLVER_TIMEOUT',
          message: error.message,
          messageFa: ERROR_MESSAGES.solverTimeout,
        };
      default:
        return {
          type: 'SOLVER_ERROR',
          message: error.message,
          messageFa: ERROR_MESSAGES.solverError,
        };
    }
  }

  if (error instanceof Error) {
    return {
      type: 'UNKNOWN',
      message: error.message,
      messageFa: ERROR_MESSAGES.generateFailed,
    };
  }

  return {
    type: 'UNKNOWN',
    message: 'An unknown error occurred',
    messageFa: ERROR_MESSAGES.generateFailed,
  };
}

/**
 * Return type for useGenerateSchedule hook
 */
export interface UseGenerateScheduleReturn {
  /** Trigger schedule generation with selected strategy */
  generate: (strategy: SolverStrategy) => void;
  /** Whether generation is currently in progress */
  isGenerating: boolean;
  /** Elapsed time in seconds since generation started */
  elapsedTime: number;
  /** Current generation error, if any */
  error: GenerationError | null;
  /** Reset error state */
  reset: () => void;
  /** Whether input data is still loading */
  isLoadingInputData: boolean;
}

/**
 * Hook for managing schedule generation
 *
 * Collects input data from teachers, subjects, classes, and rooms hooks,
 * triggers the solver API, tracks progress, and handles success/error states.
 *
 * @returns Object with generate function, state, and error handling
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export function useGenerateSchedule(): UseGenerateScheduleReturn {
  const queryClient = useQueryClient();
  const saveScheduleMutation = useSaveSchedule();

  // Input data hooks
  const { data: teachers, isLoading: isLoadingTeachers } = useTeachers();
  const { data: subjects, isLoading: isLoadingSubjects } = useSubjects();
  const { data: classes, isLoading: isLoadingClasses } = useClasses();
  const { data: rooms, isLoading: isLoadingRooms } = useRooms();

  // State for elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<GenerationError | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isLoadingInputData =
    isLoadingTeachers || isLoadingSubjects || isLoadingClasses || isLoadingRooms;

  /**
   * Start elapsed time tracking
   */
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedTime(0);

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsedTime(elapsed);
      }
    }, 1000);
  }, []);

  /**
   * Stop elapsed time tracking
   */
  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  /**
   * Generate mutation
   * Requirements: 6.1, 6.5, 6.6, 6.7
   */
  const mutation = useMutation({
    mutationFn: async (strategy: SolverStrategy) => {
      // Build input from collected data
      const input: GenerateInput = {
        strategy,
        config: {
          strategy,
        },
        teachers: teachers || [],
        subjects: subjects || [],
        classes: classes || [],
        rooms: rooms || [],
      };

      logger.info('Starting schedule generation', { strategy });
      return generateScheduleApi(input);
    },
    onMutate: () => {
      setError(null);
      startTimer();
    },
    onSuccess: async (response) => {
      stopTimer();
      logger.info('Schedule generation successful');

      // Save the generated schedule
      if (response.data) {
        try {
          const scheduleName = `جدول زمانی - ${new Date().toLocaleDateString('fa-IR')}`;
          await saveScheduleMutation.mutateAsync({
            name: scheduleName,
            description: '',
            data: JSON.stringify(response.data),
          });

          // Invalidate schedules cache (Requirements: 6.5)
          queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });

          // Show success toast in Persian (Requirements: 3.7)
          toast.success(TOAST_MESSAGES.generateSuccess);
        } catch (saveError) {
          logger.error('Failed to save generated schedule', { error: saveError });
          toast.error(ERROR_MESSAGES.saveFailed);
        }
      }
    },
    onError: (err: unknown) => {
      stopTimer();
      const parsedError = parseGenerationError(err);
      setError(parsedError);
      logger.error('Schedule generation failed', { error: parsedError });

      // Show error toast in Persian (Requirements: 3.8)
      toast.error(parsedError.messageFa, {
        description: parsedError.message,
      });
    },
  });

  /**
   * Generate function that accepts strategy parameter
   * Requirements: 6.1
   */
  const generate = useCallback(
    (strategy: SolverStrategy) => {
      mutation.mutate(strategy);
    },
    [mutation]
  );

  /**
   * Reset error state
   */
  const reset = useCallback(() => {
    setError(null);
    setElapsedTime(0);
    mutation.reset();
  }, [mutation]);

  return {
    generate,
    isGenerating: mutation.isPending,
    elapsedTime,
    error,
    reset,
    isLoadingInputData,
  };
}
