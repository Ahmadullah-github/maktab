/**
 * Enhanced hook for schedule generation with shared server-side status polling.
 */

import { SCHEDULE_QUERY_KEYS } from '@/features/schedule/constants';
import type { SolverStrategy } from '@/features/schedule/types';
import { useCanGenerate } from '@/hooks/useLicense';
import { useLicenseStore } from '@/stores/licenseStore';
import type {
  AffectedEntity,
  QualityScore,
  SavedTimetableSummary,
  SolverErrorDetail,
  SolverResponse,
  SolverResponseMetadata,
  SolverStatus,
} from '@/types/solver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cancelSolverGeneration, normalizeSolverStatus, useSolverStatus } from './useSolverStatus';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface GenerateInput {
  strategy: SolverStrategy;
  config: {
    schoolId?: number | null;
    strategy?: SolverStrategy;
  };
}

export interface EnhancedGenerationError {
  type: string;
  message: string;
  messageFa: string;
  errors: SolverErrorDetail[];
  warnings: SolverErrorDetail[];
  suggestion?: string;
  suggestionFa?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  generateFailed: 'خطا در تولید جدول زمانی',
  solverBusy: 'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
  solverCancelled: 'تولید جدول زمانی لغو شد',
  solverTimeout: 'تولید جدول زمانی زمان‌بر شد',
  solverError: 'خطا در تولید جدول زمانی',
  noFeasibleSolution: 'امکان تولید جدول زمانی با محدودیت‌های فعلی وجود ندارد',
  teacherOverload: 'یک یا چند استاد بیش از حد مجاز ساعت دارند',
};

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
  TEACHER_OVERLOAD_PREDICTED: {
    en: 'Reduce teacher workload or add more teachers',
    fa: 'ساعات کاری استاد را کاهش دهید یا استاد جدید اضافه کنید',
  },
  NO_QUALIFIED_TEACHER: {
    en: 'Assign a teacher to the subject or add a new teacher',
    fa: 'یک استاد به مضمون اختصاص دهید یا استاد جدید اضافه کنید',
  },
};

const TOAST_MESSAGES = {
  generateSuccess: 'جدول زمانی با موفقیت تولید شد',
  generatePartial: 'جدول زمانی با هشدار تولید شد',
  cancelRequested: 'درخواست لغو ثبت شد',
} as const;

const GENERIC_SOLVER_ERROR = 'خطا در تولید جدول زمانی';
const GENERIC_VALIDATION_ERROR = 'خطا در اعتبارسنجی داده‌ها';

class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType?: string,
    public solverResponse?: SolverResponse,
    public solverStatus?: SolverStatus
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeAffectedEntities(raw: unknown): AffectedEntity[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entity) => {
    if (!isRecord(entity)) {
      return [];
    }

    const entityType = entity.entity_type;
    const entityId = entity.entity_id;
    const entityName = entity.entity_name;
    if (
      (entityType === 'teacher' ||
        entityType === 'class' ||
        entityType === 'room' ||
        entityType === 'subject') &&
      entityId !== undefined &&
      entityName !== undefined
    ) {
      return [
        {
          entity_type: entityType,
          entity_id: String(entityId),
          entity_name: String(entityName),
        },
      ];
    }

    return [];
  });
}

function normalizeSolverErrorDetail(
  raw: unknown,
  fallback?: {
    errorCode?: string;
    messageFa?: string;
    messageEn?: string;
  }
): SolverErrorDetail {
  if (isRecord(raw)) {
    const messageFarsi =
      typeof raw.message_farsi === 'string' && raw.message_farsi.trim()
        ? raw.message_farsi
        : fallback?.messageFa || GENERIC_SOLVER_ERROR;
    const messageEnglish =
      typeof raw.message_english === 'string' && raw.message_english.trim()
        ? raw.message_english
        : fallback?.messageEn || 'An unknown error occurred';

    return {
      error_code:
        typeof raw.error_code === 'string' && raw.error_code.trim()
          ? raw.error_code
          : fallback?.errorCode || 'SOLVER_ERROR',
      severity:
        raw.severity === 'warning' || raw.severity === 'info' || raw.severity === 'error'
          ? raw.severity
          : 'error',
      message_key:
        typeof raw.message_key === 'string' && raw.message_key.trim()
          ? raw.message_key
          : `error.${fallback?.errorCode?.toLowerCase() || 'solver_error'}`,
      message_farsi: messageFarsi,
      message_english: messageEnglish,
      affected_entities: normalizeAffectedEntities(raw.affected_entities),
      context: isRecord(raw.context) ? raw.context : {},
    };
  }

  const rawMessage =
    typeof raw === 'string' || typeof raw === 'number'
      ? String(raw)
      : fallback?.messageEn || 'An unknown error occurred';

  return {
    error_code: fallback?.errorCode || 'SOLVER_ERROR',
    severity: 'error',
    message_key: `error.${(fallback?.errorCode || 'solver_error').toLowerCase()}`,
    message_farsi: fallback?.messageFa || GENERIC_SOLVER_ERROR,
    message_english: rawMessage,
    affected_entities: [],
    context: { raw_error: rawMessage },
  };
}

function normalizeSolverErrors(
  raw: unknown,
  fallback?: {
    errorCode?: string;
    messageFa?: string;
    messageEn?: string;
  }
): SolverErrorDetail[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeSolverErrorDetail(item, fallback));
  }

  if (raw === undefined || raw === null) {
    return [];
  }

  return [normalizeSolverErrorDetail(raw, fallback)];
}

function normalizeSolverMetadata(raw: unknown, strategy: SolverStrategy): SolverResponseMetadata {
  if (!isRecord(raw)) {
    return {
      solveTimeSeconds: 0,
      strategy,
      numConstraintsApplied: 0,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    solveTimeSeconds:
      typeof raw.solveTimeSeconds === 'number'
        ? raw.solveTimeSeconds
        : typeof raw.solve_time_seconds === 'number'
          ? raw.solve_time_seconds
          : 0,
    strategy:
      typeof raw.strategy === 'string'
        ? raw.strategy
        : typeof raw.strategy_selected === 'string'
          ? raw.strategy_selected
          : strategy,
    numConstraintsApplied:
      typeof raw.numConstraintsApplied === 'number'
        ? raw.numConstraintsApplied
        : typeof raw.num_constraints_applied === 'number'
          ? raw.num_constraints_applied
          : 0,
    timestamp:
      typeof raw.timestamp === 'string'
        ? raw.timestamp
        : typeof raw.finished_at === 'string'
          ? raw.finished_at
          : new Date().toISOString(),
  };
}

function normalizeSavedTimetable(raw: unknown): SavedTimetableSummary | undefined {
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'number' ||
    typeof raw.name !== 'string' ||
    typeof raw.createdAt !== 'string' ||
    typeof raw.updatedAt !== 'string'
  ) {
    return undefined;
  }

  return {
    id: raw.id,
    name: raw.name,
    description: typeof raw.description === 'string' ? raw.description : '',
    data: raw.data,
    schoolId: typeof raw.schoolId === 'number' || raw.schoolId === null ? raw.schoolId : null,
    academicYearId:
      typeof raw.academicYearId === 'number' || raw.academicYearId === null
        ? raw.academicYearId
        : null,
    termId: typeof raw.termId === 'number' || raw.termId === null ? raw.termId : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function hasBlockingPartialWarning(response: SolverResponse): boolean {
  return (
    response.status === 'partial' &&
    response.warnings.some((warning) => warning.error_code === 'NO_FEASIBLE_SOLUTION')
  );
}

function promoteWarningsToErrors(warnings: SolverErrorDetail[]): SolverErrorDetail[] {
  return warnings.map((warning) => ({
    ...warning,
    severity: 'error',
  }));
}

function getErrorTypeFromResponse(response: SolverResponse): string {
  if (response.errors.length > 0) {
    return response.errors[0].error_code;
  }
  return 'UNKNOWN';
}

function getErrorMessageFromResponse(response: SolverResponse): string {
  if (response.errors.length > 0) {
    return response.errors[0].message_english || response.errors[0].message_farsi;
  }
  return 'An unknown error occurred';
}

async function generateScheduleApi(
  input: GenerateInput,
  signal?: AbortSignal
): Promise<SolverResponse> {
  const response = await fetch(`${API_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal,
  });

  const data = await response.json().catch(() => ({}));
  const solverStatus =
    isRecord(data) && 'solverStatus' in data ? normalizeSolverStatus(data.solverStatus) : undefined;
  const fallbackErrorType = response.status >= 500 ? 'SOLVER_ERROR' : 'VALIDATION_ERROR';
  const fallbackErrorMessage =
    (isRecord(data.error) && typeof data.error.message === 'string' && data.error.message) ||
    (typeof data.error === 'string' && data.error) ||
    (typeof data.message === 'string' && data.message) ||
    response.statusText;

  const solverResponse: SolverResponse = {
    status:
      isRecord(data) && typeof data.status === 'string'
        ? (data.status as SolverResponse['status'])
        : isRecord(data) && data.success
          ? 'success'
          : 'failed',
    data: isRecord(data) && 'data' in data ? (data.data as SolverResponse['data']) : null,
    errors: normalizeSolverErrors(isRecord(data) ? data.errors : undefined, {
      errorCode: fallbackErrorType,
      messageFa: response.status >= 500 ? GENERIC_SOLVER_ERROR : GENERIC_VALIDATION_ERROR,
      messageEn: fallbackErrorMessage,
    }),
    warnings: normalizeSolverErrors(isRecord(data) ? data.warnings : undefined),
    quality_score:
      isRecord(data) && 'quality_score' in data
        ? (data.quality_score as SolverResponse['quality_score'])
        : null,
    metadata: normalizeSolverMetadata(isRecord(data) ? data.metadata : undefined, input.strategy),
    savedTimetable: normalizeSavedTimetable(isRecord(data) ? data.savedTimetable : undefined),
  };

  if (!response.ok) {
    const errorType =
      solverResponse.errors[0]?.error_code ||
      (isRecord(data.error) && typeof data.error.type === 'string' ? data.error.type : undefined) ||
      fallbackErrorType;
    const errorMessage = fallbackErrorMessage;

    if (solverResponse.errors.length === 0 && errorMessage) {
      solverResponse.errors = [
        normalizeSolverErrorDetail(null, {
          errorCode: errorType,
          messageFa: response.status >= 500 ? GENERIC_SOLVER_ERROR : GENERIC_VALIDATION_ERROR,
          messageEn: errorMessage,
        }),
      ];
    }

    throw new ApiError(errorMessage, response.status, errorType, solverResponse, solverStatus);
  }

  if (hasBlockingPartialWarning(solverResponse)) {
    const blockingErrors = promoteWarningsToErrors(solverResponse.warnings);
    const primaryError = blockingErrors[0];

    throw new ApiError(
      primaryError?.message_english || primaryError?.message_farsi || 'An unknown error occurred',
      200,
      primaryError?.error_code || 'NO_FEASIBLE_SOLUTION',
      {
        ...solverResponse,
        status: 'failed',
        data: null,
        errors: blockingErrors,
      }
    );
  }

  if (solverResponse.status === 'failed') {
    throw new ApiError(
      getErrorMessageFromResponse(solverResponse),
      200,
      getErrorTypeFromResponse(solverResponse),
      solverResponse,
      solverStatus
    );
  }

  return solverResponse;
}

function buildSyntheticError(
  errorCode: string,
  messageFa: string,
  messageEn: string
): SolverErrorDetail[] {
  return [
    {
      error_code: errorCode,
      severity: 'error',
      message_key: `error.${errorCode.toLowerCase()}`,
      message_farsi: messageFa,
      message_english: messageEn,
      affected_entities: [],
      context: {},
    },
  ];
}

function buildErrorFromLastRun(lastRun: SolverStatus['lastRun']): EnhancedGenerationError | null {
  if (!lastRun || (lastRun.outcome !== 'failed' && lastRun.outcome !== 'cancelled')) {
    return null;
  }

  const errorCode = lastRun.outcome === 'cancelled' ? 'SOLVER_CANCELLED' : 'SOLVER_ERROR';
  const messageFa =
    lastRun.messageFarsi ||
    (lastRun.outcome === 'cancelled' ? ERROR_MESSAGES.solverCancelled : ERROR_MESSAGES.solverError);
  const messageEn =
    lastRun.messageEnglish ||
    (lastRun.outcome === 'cancelled'
      ? 'Timetable generation was cancelled'
      : 'Timetable generation failed');

  return {
    type: errorCode,
    message: messageEn,
    messageFa,
    errors: buildSyntheticError(errorCode, messageFa, messageEn),
    warnings: [],
  };
}

function parseGenerationError(error: unknown): EnhancedGenerationError | null {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return null;
  }

  if (error instanceof ApiError && error.errorType === 'SOLVER_BUSY') {
    return null;
  }

  if (error instanceof ApiError && error.errorType === 'SOLVER_CANCELLED') {
    return {
      type: 'SOLVER_CANCELLED',
      message: error.message,
      messageFa: ERROR_MESSAGES.solverCancelled,
      errors:
        error.solverResponse?.errors ||
        buildSyntheticError('SOLVER_CANCELLED', ERROR_MESSAGES.solverCancelled, error.message),
      warnings: error.solverResponse?.warnings || [],
    };
  }

  if (error instanceof ApiError && error.solverResponse) {
    const response = error.solverResponse;
    const errorType = error.errorType || 'UNKNOWN';
    const suggestion = ERROR_SUGGESTIONS[errorType];

    let messageFa = ERROR_MESSAGES.generateFailed;
    switch (errorType) {
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
        if (response.errors.length > 0 && response.errors[0].message_farsi) {
          messageFa = response.errors[0].message_farsi;
        } else {
          messageFa = ERROR_MESSAGES.solverError;
        }
    }

    return {
      type: errorType,
      message: error.message,
      messageFa,
      errors: response.errors,
      warnings: response.warnings,
      suggestion: suggestion?.en,
      suggestionFa: suggestion?.fa,
    };
  }

  if (error instanceof ApiError) {
    const errorType = error.errorType || 'UNKNOWN';
    const suggestion = ERROR_SUGGESTIONS[errorType];

    return {
      type: errorType,
      message: error.message,
      messageFa: ERROR_MESSAGES.solverError,
      errors: buildSyntheticError(errorType, ERROR_MESSAGES.solverError, error.message),
      warnings: [],
      suggestion: suggestion?.en,
      suggestionFa: suggestion?.fa,
    };
  }

  if (error instanceof Error) {
    return {
      type: 'UNKNOWN',
      message: error.message,
      messageFa: ERROR_MESSAGES.generateFailed,
      errors: buildSyntheticError('UNKNOWN', ERROR_MESSAGES.generateFailed, error.message),
      warnings: [],
    };
  }

  return {
    type: 'UNKNOWN',
    message: 'An unknown error occurred',
    messageFa: ERROR_MESSAGES.generateFailed,
    errors: buildSyntheticError('UNKNOWN', ERROR_MESSAGES.generateFailed, 'An unknown error occurred'),
    warnings: [],
  };
}

export interface UseEnhancedGenerateScheduleReturn {
  generate: (strategy: SolverStrategy) => void;
  cancel: () => void;
  isGenerating: boolean;
  elapsedTime: number;
  error: EnhancedGenerationError | null;
  solverResponse: SolverResponse | null;
  qualityScore: QualityScore | null;
  warnings: SolverErrorDetail[];
  reset: () => void;
  isLoadingInputData: boolean;
  canGenerate: boolean;
  blockedReason: string | null;
  retry: () => void;
  lastStrategy: SolverStrategy | null;
  solverStatus: SolverStatus | null;
}

function buildLastRunSignature(lastRun: SolverStatus['lastRun']): string | null {
  if (!lastRun) {
    return null;
  }

  return `${lastRun.outcome}:${lastRun.finishedAt}:${lastRun.timetableId ?? 'none'}`;
}

function buildTerminalStatus(
  current: SolverStatus | undefined,
  outcome: 'success' | 'partial' | 'failed' | 'cancelled',
  options?: {
    messageFarsi?: string;
    messageEnglish?: string;
    timetableId?: number;
  }
): SolverStatus {
  return {
    isRunning: false,
    processId: undefined,
    startedAt: undefined,
    phase: 'idle',
    phaseFarsi: undefined,
    strategy: current?.strategy,
    percentComplete: undefined,
    estimatedSecondsRemaining: undefined,
    canCancel: false,
    lastRun: {
      outcome,
      finishedAt: new Date().toISOString(),
      messageFarsi: options?.messageFarsi,
      messageEnglish: options?.messageEnglish,
      timetableId: options?.timetableId,
    },
  };
}

export function useEnhancedGenerateSchedule(): UseEnhancedGenerateScheduleReturn {
  const queryClient = useQueryClient();
  const statusQuery = useSolverStatus();

  const canGenerateLicense = useCanGenerate();
  const licenseStatus = useLicenseStore((state) => state.status);

  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<EnhancedGenerationError | null>(null);
  const [solverResponse, setSolverResponse] = useState<SolverResponse | null>(null);
  const [lastStrategy, setLastStrategy] = useState<SolverStrategy | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const dismissedLastRunRef = useRef<string | null>(null);
  const observedLastRunRef = useRef<string | null>(null);

  const solverStatus = statusQuery.data ?? null;

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

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
  }, []);

  const startTimer = useCallback((startedAtMs: number) => {
    startTimeRef.current = startedAtMs;
    setElapsedTime(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedTime(Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000)));
      }
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      abortControllerRef.current?.abort();
    };
  }, [stopTimer]);

  useEffect(() => {
    const startedAt = solverStatus?.startedAt ? Date.parse(solverStatus.startedAt) : NaN;

    if (solverStatus?.isRunning && Number.isFinite(startedAt)) {
      startTimer(startedAt);
      return;
    }

    if (solverStatus?.isRunning && startTimeRef.current !== null) {
      startTimer(startTimeRef.current);
      return;
    }

    if (!solverStatus?.isRunning) {
      stopTimer();
    }
  }, [solverStatus?.isRunning, solverStatus?.startedAt, startTimer, stopTimer]);

  useEffect(() => {
    const signature = buildLastRunSignature(solverStatus?.lastRun);
    if (!signature || signature === observedLastRunRef.current) {
      return;
    }

    observedLastRunRef.current = signature;

    if (
      solverStatus?.lastRun &&
      (solverStatus.lastRun.outcome === 'success' || solverStatus.lastRun.outcome === 'partial')
    ) {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });
      if (!solverResponse) {
        setError(null);
      }
      return;
    }

    if (signature !== dismissedLastRunRef.current) {
      const derivedError = buildErrorFromLastRun(solverStatus?.lastRun);
      if (derivedError) {
        setSolverResponse(null);
        setError(derivedError);
      }
    }
  }, [queryClient, solverResponse, solverStatus?.lastRun]);

  const mutation = useMutation({
    mutationFn: async (strategy: SolverStrategy) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      return generateScheduleApi(
        {
          strategy,
          config: {
            strategy,
          },
        },
        controller.signal
      );
    },
    onMutate: (strategy) => {
      dismissedLastRunRef.current = null;
      setError(null);
      setSolverResponse(null);
      setLastStrategy(strategy);
      startTimer(Date.now());
    },
    onSuccess: (response) => {
      abortControllerRef.current = null;
      setSolverResponse(response);
      setError(null);
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });
      queryClient.setQueryData(
        SCHEDULE_QUERY_KEYS.generateStatus(),
        buildTerminalStatus(statusQuery.data, response.status, {
          messageFarsi:
            response.status === 'partial'
              ? 'جدول زمانی با هشدار ذخیره شد'
              : 'جدول زمانی با موفقیت ذخیره شد',
          messageEnglish:
            response.status === 'partial'
              ? 'Timetable saved with warnings'
              : 'Timetable generated successfully',
          timetableId: response.savedTimetable?.id,
        })
      );

      if (response.status === 'partial') {
        toast.warning(TOAST_MESSAGES.generatePartial, {
          description: `${response.warnings.length} هشدار`,
        });
      } else {
        const qualityMessage = response.quality_score
          ? ` (کیفیت: ${response.quality_score.overall}%)`
          : '';
        toast.success(TOAST_MESSAGES.generateSuccess + qualityMessage);
      }
    },
    onError: async (err: unknown) => {
      abortControllerRef.current = null;

      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }

      if (err instanceof ApiError && err.errorType === 'SOLVER_BUSY') {
        setError(null);
        if (err.solverStatus) {
          queryClient.setQueryData(SCHEDULE_QUERY_KEYS.generateStatus(), err.solverStatus);
        }
        await statusQuery.refetch();
        return;
      }

      const parsedError = parseGenerationError(err);
      if (!parsedError) {
        return;
      }

      setError(parsedError);
      setSolverResponse(
        err instanceof ApiError && err.solverResponse ? err.solverResponse : null
      );

      if (err instanceof ApiError && err.errorType !== 'SOLVER_CANCELLED') {
        queryClient.setQueryData(
          SCHEDULE_QUERY_KEYS.generateStatus(),
          buildTerminalStatus(statusQuery.data, 'failed', {
            messageFarsi: parsedError.messageFa,
            messageEnglish: parsedError.message,
          })
        );
      }

      if (!(err instanceof ApiError && err.errorType === 'SOLVER_CANCELLED')) {
        toast.error(parsedError.messageFa);
      }
    },
  });

  const generate = useCallback(
    (strategy: SolverStrategy) => {
      if (!canGenerateLicense) {
        const reason = getBlockedReason();
        toast.error(reason || 'تولید جدول زمانی مجاز نیست');
        return;
      }

      mutation.mutate(strategy);
    },
    [canGenerateLicense, mutation]
  );

  const cancel = useCallback(() => {
    queryClient.setQueryData(SCHEDULE_QUERY_KEYS.generateStatus(), (current: SolverStatus | undefined) => {
      return {
        ...(current || {
          isRunning: true,
          phase: 'cancelling' as const,
          canCancel: false,
        }),
        isRunning: true,
        phase: 'cancelling' as const,
        phaseFarsi: 'در حال لغو تولید جدول زمانی...',
        canCancel: false,
      };
    });

    abortControllerRef.current?.abort();

    void cancelSolverGeneration()
      .then((status) => {
        queryClient.setQueryData(SCHEDULE_QUERY_KEYS.generateStatus(), status);
        toast.info(TOAST_MESSAGES.cancelRequested);
      })
      .catch((cancelError: Error) => {
        toast.error('لغو تولید جدول زمانی ممکن نشد', {
          description: cancelError.message,
        });
      })
      .finally(() => {
        void statusQuery.refetch();
      });
  }, [queryClient, statusQuery]);

  const retry = useCallback(() => {
    if (lastStrategy) {
      generate(lastStrategy);
    }
  }, [generate, lastStrategy]);

  const reset = useCallback(() => {
    mutation.reset();
    setError(null);
    setSolverResponse(null);
    setElapsedTime(0);
    stopTimer();

    const signature = buildLastRunSignature(solverStatus?.lastRun);
    if (signature) {
      dismissedLastRunRef.current = signature;
    }
  }, [mutation, solverStatus?.lastRun, stopTimer]);

  const qualityScore = solverResponse?.quality_score || null;
  const warnings = solverResponse?.warnings || [];
  const isGenerating = mutation.isPending || Boolean(solverStatus?.isRunning);

  return {
    generate,
    cancel,
    isGenerating,
    elapsedTime,
    error,
    solverResponse,
    qualityScore,
    warnings,
    reset,
    isLoadingInputData: statusQuery.isLoading,
    canGenerate: canGenerateLicense,
    blockedReason: getBlockedReason(),
    retry,
    lastStrategy,
    solverStatus,
  };
}
