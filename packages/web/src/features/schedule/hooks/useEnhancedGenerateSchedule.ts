/**
 * Enhanced hook for managing schedule generation with comprehensive error handling
 *
 * Extends the base useGenerateSchedule hook with:
 * - Full SolverResponse parsing with errors, warnings, quality_score
 * - Specific handling for SOLVER_TIMEOUT, NO_FEASIBLE_SOLUTION, TEACHER_OVERLOAD
 * - Storage of full solver response for detailed error display
 *
 * Requirements: 11.1, 11.6, 11.7, 11.8, 11.9
 */

import { SCHEDULE_QUERY_KEYS } from '@/features/schedule/constants';
import { useSaveSchedule } from '@/features/schedule/hooks/useSchedule';
import type { SolverStrategy } from '@/features/schedule/types';
import { useCanGenerate } from '@/hooks/useLicense';
import { useLicenseStore } from '@/stores/licenseStore';
import type { QualityScore, SolverErrorDetail, SolverResponse } from '@/types/solver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Input structure for the generate API
 * Frontend only sends strategy and config - API fetches entities from database
 */
interface GenerateInput {
  strategy: SolverStrategy;
  config: {
    schoolId?: number | null;
    strategy?: SolverStrategy;
  };
}

/**
 * Enhanced generation error with solver details
 */
export interface EnhancedGenerationError {
  /** Error type code */
  type: string;
  /** English error message */
  message: string;
  /** Persian error message */
  messageFa: string;
  /** Detailed errors from solver */
  errors: SolverErrorDetail[];
  /** Warnings from solver */
  warnings: SolverErrorDetail[];
  /** Suggestion for recovery */
  suggestion?: string;
  /** Suggestion in Persian */
  suggestionFa?: string;
}

/**
 * Error messages in Persian
 */
const ERROR_MESSAGES: Record<string, string> = {
  generateFailed: 'خطا در تولید جدول زمانی',
  solverBusy: 'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
  solverTimeout: 'تولید جدول زمانی زمان‌بر شد',
  solverError: 'خطا در تولید جدول زمانی',
  noFeasibleSolution: 'امکان تولید جدول زمانی با محدودیت‌های فعلی وجود ندارد',
  teacherOverload: 'یک یا چند استاد بیش از حد مجاز ساعت دارند',
  saveFailed: 'خطا در ذخیره جدول زمانی',
};

/**
 * Suggestions for specific error types
 */
const ERROR_SUGGESTIONS: Record<string, { en: string; fa: string }> = {
  SOLVER_TIMEOUT: {
    en: 'Try using a faster strategy or simplify constraints',
    fa: 'استراتژی سریع‌تر را امتحان کنید یا محدودیت‌ها را ساده‌تر کنید',
  },
  NO_FEASIBLE_SOLUTION: {
    en: 'Review teacher availability and class requirements',
    fa: 'دسترسی استادان و نیازمندی‌های صنف‌ها را بررسی کنید',
  },
  TEACHER_OVERLOAD: {
    en: 'Reduce teacher workload or add more teachers',
    fa: 'ساعات کاری استاد را کاهش دهید یا استاد جدید اضافه کنید',
  },
  NO_QUALIFIED_TEACHER: {
    en: 'Assign a teacher to the subject or add a new teacher',
    fa: 'یک استاد به مضمون اختصاص دهید یا استاد جدید اضافه کنید',
  },
};

/**
 * Toast messages in Persian
 */
const TOAST_MESSAGES = {
  generateSuccess: 'جدول زمانی با موفقیت تولید شد',
  generatePartial: 'جدول زمانی با هشدار تولید شد',
} as const;

/**
 * Custom error class for API errors with status code
 */
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string,
    public solverResponse?: SolverResponse
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Calls the generate API endpoint and parses the full solver response
 */
async function generateScheduleApi(input: GenerateInput): Promise<SolverResponse> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();

  // DEBUG: Log raw API response
  console.log('=== RAW API RESPONSE ===');
  console.log('HTTP Status:', response.status);
  console.log('Response data:', JSON.stringify(data, null, 2));
  console.log('data.errors:', data.errors);
  if (data.errors && data.errors.length > 0) {
    console.log('First error:', JSON.stringify(data.errors[0], null, 2));
    console.log('First error message_farsi:', data.errors[0].message_farsi);
  }

  // Parse as SolverResponse
  const solverResponse: SolverResponse = {
    status: data.status || (data.success ? 'success' : 'failed'),
    data: data.data || null,
    errors: data.errors || [],
    warnings: data.warnings || [],
    quality_score: data.quality_score || null,
    metadata: data.metadata || {
      solveTimeSeconds: 0,
      strategy: input.strategy,
      numConstraintsApplied: 0,
      timestamp: new Date().toISOString(),
    },
  };

  // DEBUG: Log parsed solver response
  console.log('=== PARSED SOLVER RESPONSE ===');
  console.log('solverResponse.errors:', solverResponse.errors);

  // Handle HTTP errors
  if (!response.ok) {
    // Get error type from the errors array first, then fall back to error.type
    const errorType =
      (data.errors && data.errors.length > 0 && data.errors[0].error_code) ||
      data.error?.type ||
      'VALIDATION_ERROR';
    const errorMessage = data.error?.message || data.error || data.message || response.statusText;

    console.log('=== HTTP ERROR PATH ===');
    console.log('errorType:', errorType);
    console.log('errorMessage:', errorMessage);
    console.log('solverResponse.errors.length:', solverResponse.errors.length);

    // If no structured errors, create one from the error message
    if (solverResponse.errors.length === 0 && errorMessage) {
      console.log('Creating synthetic error (no errors in response)');
      solverResponse.errors = [
        {
          error_code: errorType,
          severity: 'error',
          message_key: `error.${errorType.toLowerCase()}`,
          message_farsi: 'خطا در اعتبارسنجی داده‌ها',
          message_english: errorMessage,
          affected_entities: [],
          context: { details: errorMessage },
        },
      ];
    } else {
      console.log('Using errors from API response');
    }

    throw new ApiError(errorMessage, response.status, errorType, solverResponse);
  }

  // Handle solver failures (status = 'failed')
  if (solverResponse.status === 'failed') {
    const errorType = getErrorTypeFromResponse(solverResponse);
    const errorMessage = getErrorMessageFromResponse(solverResponse);
    console.log('=== SOLVER FAILED PATH ===');
    console.log('errorType:', errorType);
    console.log('errorMessage:', errorMessage);
    throw new ApiError(errorMessage, 200, errorType, solverResponse);
  }

  return solverResponse;
}

/**
 * Extract primary error type from solver response
 */
function getErrorTypeFromResponse(response: SolverResponse): string {
  if (response.errors.length > 0) {
    return response.errors[0].error_code;
  }
  return 'UNKNOWN';
}

/**
 * Extract error message from solver response
 */
function getErrorMessageFromResponse(response: SolverResponse): string {
  if (response.errors.length > 0) {
    return response.errors[0].message_english || response.errors[0].message_farsi;
  }
  return 'An unknown error occurred';
}

/**
 * Parse API error into EnhancedGenerationError structure
 * Requirements: 11.6, 11.7, 11.8, 11.9
 */
function parseGenerationError(error: unknown): EnhancedGenerationError {
  console.log('=== parseGenerationError ===');
  console.log('error type:', error?.constructor?.name);

  if (error instanceof ApiError && error.solverResponse) {
    const response = error.solverResponse;
    const errorType = error.errorType || 'UNKNOWN';
    const suggestion = ERROR_SUGGESTIONS[errorType];

    console.log('ApiError with solverResponse');
    console.log('errorType:', errorType);
    console.log('response.errors:', response.errors);
    console.log('response.errors.length:', response.errors.length);
    if (response.errors.length > 0) {
      console.log('First error message_farsi:', response.errors[0].message_farsi);
    }

    // Get Persian message based on error type
    let messageFa = ERROR_MESSAGES.generateFailed;
    switch (errorType) {
      case 'SOLVER_BUSY':
        messageFa = ERROR_MESSAGES.solverBusy;
        break;
      case 'SOLVER_TIMEOUT':
        messageFa = ERROR_MESSAGES.solverTimeout;
        break;
      case 'NO_FEASIBLE_SOLUTION':
        messageFa = ERROR_MESSAGES.noFeasibleSolution;
        break;
      case 'TEACHER_OVERLOAD':
      case 'TEACHER_OVERLOAD_PREDICTED':
        messageFa = ERROR_MESSAGES.teacherOverload;
        break;
      default:
        console.log('Using default case for errorType:', errorType);
        if (response.errors.length > 0 && response.errors[0].message_farsi) {
          messageFa = response.errors[0].message_farsi;
          console.log('Using message_farsi from errors[0]:', messageFa);
        } else {
          messageFa = ERROR_MESSAGES.solverError;
          console.log('Using generic solverError message');
        }
    }

    const result = {
      type: errorType,
      message: error.message,
      messageFa,
      errors: response.errors,
      warnings: response.warnings,
      suggestion: suggestion?.en,
      suggestionFa: suggestion?.fa,
    };

    console.log('Returning EnhancedGenerationError:', result);
    return result;
  }

  if (error instanceof ApiError) {
    const errorType = error.errorType || 'UNKNOWN';
    const suggestion = ERROR_SUGGESTIONS[errorType];

    // Create a synthetic error detail for display
    const syntheticError: SolverErrorDetail = {
      error_code: errorType,
      severity: 'error',
      message_key: `error.${errorType.toLowerCase()}`,
      message_farsi: ERROR_MESSAGES.solverError,
      message_english: error.message,
      affected_entities: [],
      context: { details: error.message },
    };

    return {
      type: errorType,
      message: error.message,
      messageFa: ERROR_MESSAGES.solverError,
      errors: [syntheticError],
      warnings: [],
      suggestion: suggestion?.en,
      suggestionFa: suggestion?.fa,
    };
  }

  if (error instanceof Error) {
    // Create a synthetic error detail for display
    const syntheticError: SolverErrorDetail = {
      error_code: 'UNKNOWN',
      severity: 'error',
      message_key: 'error.unknown',
      message_farsi: ERROR_MESSAGES.generateFailed,
      message_english: error.message,
      affected_entities: [],
      context: { details: error.message },
    };

    return {
      type: 'UNKNOWN',
      message: error.message,
      messageFa: ERROR_MESSAGES.generateFailed,
      errors: [syntheticError],
      warnings: [],
    };
  }

  // Fallback for unknown error types
  const syntheticError: SolverErrorDetail = {
    error_code: 'UNKNOWN',
    severity: 'error',
    message_key: 'error.unknown',
    message_farsi: ERROR_MESSAGES.generateFailed,
    message_english: 'An unknown error occurred',
    affected_entities: [],
    context: {},
  };

  return {
    type: 'UNKNOWN',
    message: 'An unknown error occurred',
    messageFa: ERROR_MESSAGES.generateFailed,
    errors: [syntheticError],
    warnings: [],
  };
}

/**
 * Return type for useEnhancedGenerateSchedule hook
 */
export interface UseEnhancedGenerateScheduleReturn {
  /** Trigger schedule generation with selected strategy */
  generate: (strategy: SolverStrategy) => void;
  /** Cancel ongoing generation (if supported) */
  cancel: () => void;
  /** Whether generation is currently in progress */
  isGenerating: boolean;
  /** Elapsed time in seconds since generation started */
  elapsedTime: number;
  /** Current generation error with full details */
  error: EnhancedGenerationError | null;
  /** Full solver response (available on success or partial) */
  solverResponse: SolverResponse | null;
  /** Quality score from successful generation */
  qualityScore: QualityScore | null;
  /** Warnings from partial success */
  warnings: SolverErrorDetail[];
  /** Reset all state */
  reset: () => void;
  /** Whether input data is still loading */
  isLoadingInputData: boolean;
  /** Whether generation is allowed (license check) */
  canGenerate: boolean;
  /** Reason why generation is blocked (if blocked) */
  blockedReason: string | null;
  /** Retry generation with same strategy */
  retry: () => void;
  /** Last used strategy */
  lastStrategy: SolverStrategy | null;
}

/**
 * Enhanced hook for managing schedule generation with comprehensive error handling
 *
 * @returns Object with generate function, state, error handling, and solver response
 *
 * Requirements: 11.1, 11.6, 11.7, 11.8, 11.9
 */
export function useEnhancedGenerateSchedule(): UseEnhancedGenerateScheduleReturn {
  const queryClient = useQueryClient();
  const saveScheduleMutation = useSaveSchedule();

  // License check
  const canGenerateLicense = useCanGenerate();
  const licenseStatus = useLicenseStore((state) => state.status);

  // State for elapsed time tracking
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<EnhancedGenerationError | null>(null);
  const [solverResponse, setSolverResponse] = useState<SolverResponse | null>(null);
  const [lastStrategy, setLastStrategy] = useState<SolverStrategy | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Generate mutation with enhanced error handling
   * Requirements: 11.1, 11.6, 11.7, 11.8, 11.9
   */
  const mutation = useMutation({
    mutationFn: async (strategy: SolverStrategy) => {
      // API will fetch entities from database - we only send strategy and config
      const input: GenerateInput = {
        strategy,
        config: {
          strategy,
        },
      };

      // DEBUG: Log the data being sent to API
      console.log('=== FRONTEND: Sending to API ===');
      console.log('Strategy:', strategy);
      console.log('Config:', input.config);
      console.log('Note: API will fetch entities from database');

      return generateScheduleApi(input);
    },
    onMutate: (strategy) => {
      setError(null);
      setSolverResponse(null);
      setLastStrategy(strategy);
      startTimer();
    },
    onSuccess: async (response) => {
      stopTimer();
      setSolverResponse(response);

      // Handle partial success (status = 'partial')
      if (response.status === 'partial') {
        toast.warning(TOAST_MESSAGES.generatePartial, {
          description: `${response.warnings.length} هشدار`,
        });
      }

      // Save the generated schedule
      if (response.data) {
        try {
          const scheduleName = `جدول زمانی - ${new Date().toLocaleDateString('fa-IR')}`;
          await saveScheduleMutation.mutateAsync({
            name: scheduleName,
            description: '',
            data: JSON.stringify(response.data),
          });

          // Invalidate schedules cache
          queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });

          // Show success toast
          if (response.status === 'success') {
            const qualityMessage = response.quality_score
              ? ` (کیفیت: ${response.quality_score.overall}%)`
              : '';
            toast.success(TOAST_MESSAGES.generateSuccess + qualityMessage);
          }
        } catch (saveError) {
          toast.error(ERROR_MESSAGES.saveFailed);
        }
      }
    },
    onError: (err: unknown) => {
      stopTimer();
      const parsedError = parseGenerationError(err);
      setError(parsedError);

      // Store solver response from error if available
      if (err instanceof ApiError && err.solverResponse) {
        setSolverResponse(err.solverResponse);
      }

      // Show brief toast - detailed error shown in ErrorDisplay
      toast.error(parsedError.messageFa);

      // Debug log
      console.log('Generation error:', parsedError);
      console.log('Errors array:', parsedError.errors);
    },
  });

  /**
   * Generate function that accepts strategy parameter
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
   * Cancel ongoing generation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopTimer();
    mutation.reset();
  }, [mutation, stopTimer]);

  /**
   * Retry with last strategy
   */
  const retry = useCallback(() => {
    if (lastStrategy) {
      generate(lastStrategy);
    }
  }, [generate, lastStrategy]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setError(null);
    setSolverResponse(null);
    setElapsedTime(0);
    mutation.reset();
  }, [mutation]);

  // Extract quality score and warnings from response
  const qualityScore = solverResponse?.quality_score || null;
  const warnings = solverResponse?.warnings || [];

  return {
    generate,
    cancel,
    isGenerating: mutation.isPending,
    elapsedTime,
    error,
    solverResponse,
    qualityScore,
    warnings,
    reset,
    isLoadingInputData: false, // API fetches data, no loading state needed
    canGenerate: canGenerateLicense,
    blockedReason: getBlockedReason(),
    retry,
    lastStrategy,
  };
}
