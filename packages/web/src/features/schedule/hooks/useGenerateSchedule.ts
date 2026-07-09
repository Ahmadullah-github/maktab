/**
 * Hook for managing schedule generation process
 *
 * Provides mutation for triggering the solver, tracking generation state,
 * elapsed time, and error handling with Persian messages
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 * Requirements: License System - Block generation when trial expired or no license
 */

import { useClasses } from '@/features/classes';
import { useRooms } from '@/features/rooms';
import { useSubjects } from '@/features/subjects';
import { useTeachers } from '@/features/teachers';
import { useCanGenerate } from '@/hooks/useLicense';
import { useLicenseStore } from '@/stores/licenseStore';
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
  status?: 'success' | 'partial' | 'failed';
  data?: {
    schedule: unknown[];
    metadata: unknown;
    statistics: unknown;
  };
  savedTimetable?: {
    id: number;
    name: string;
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
  /** Whether generation is allowed (license check) */
  canGenerate: boolean;
  /** Reason why generation is blocked (if blocked) */
  blockedReason: string | null;
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

  // License check
  const canGenerateLicense = useCanGenerate();
  const licenseStatus = useLicenseStore((state) => state.status);

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

  // Determine blocked reason
  const getBlockedReason = (): string | null => {
    if (canGenerateLicense) return null;

    const mode = licenseStatus?.mode;
    if (mode === 'trial_expired') {
      return 'دوره آزمایشی به پایان رسیده است. برای تولید جدول زمانی، لایسنس فعال کنید.';
    }
    if (mode === 'license_expired') {
      return 'لایسنس شما منقضی شده است. برای تولید جدول زمانی، لایسنس خود را تمدید کنید.';
    }
    return 'برای تولید جدول زمانی، لایسنس فعال کنید.';
  };

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

      if (response.savedTimetable) {
        queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });
      }

      // Show success toast in Persian (Requirements: 3.7)
      toast.success(TOAST_MESSAGES.generateSuccess);
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
   * Requirements: License System - Check license before generating
   */
  const generate = useCallback(
    (strategy: SolverStrategy) => {
      // Check license before generating
      if (!canGenerateLicense) {
        const reason = getBlockedReason();
        toast.error(reason || 'تولید جدول زمانی مجاز نیست');
        return;
      }
      mutation.mutate(strategy);
    },
    [mutation, canGenerateLicense]
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
    canGenerate: canGenerateLicense,
    blockedReason: getBlockedReason(),
  };
}
