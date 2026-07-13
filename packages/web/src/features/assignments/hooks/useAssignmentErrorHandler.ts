/**
 * useAssignmentErrorHandler Hook
 *
 * Phase 4.5: Unified Error Handling Across Views
 *
 * Provides consistent error handling, toast notifications, and retry logic
 * for all assignment operations across teacher, subject, and class views.
 *
 * Features:
 * - Consistent Farsi error messages
 * - Automatic retry for transient failures
 * - Toast notifications with resolution suggestions
 * - Error categorization and logging
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AssignmentErrorCode,
  AssignmentErrorHandler,
  getAssignmentErrorMessage,
} from '../services/errorHandler';
import type { AssignmentConflict } from '../types';
import { notifyAssignmentError, notifyConflict, notifyConflicts } from '../utils/notifications';

// ============================================================================
// Types
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in ms */
  baseDelay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

export interface ErrorState {
  /** Whether there's an active error */
  hasError: boolean;
  /** The error message */
  message: string;
  /** The error message in Farsi */
  messageFa: string;
  /** Error code if available */
  code: AssignmentErrorCode | null;
  /** Number of retry attempts made */
  retryCount: number;
  /** Whether a retry is in progress */
  isRetrying: boolean;
  /** The original error object */
  originalError: Error | null;
}

export interface UseAssignmentErrorHandlerOptions {
  /** Retry configuration */
  retry?: Partial<RetryConfig>;
  /** Whether to show toast notifications automatically */
  showToasts?: boolean;
  /** Callback when error occurs */
  onError?: (error: Error, code: AssignmentErrorCode) => void;
  /** Callback when retry succeeds */
  onRetrySuccess?: () => void;
}

export interface UseAssignmentErrorHandlerResult {
  /** Current error state */
  errorState: ErrorState;
  /** Handle an error from an operation */
  handleError: (error: unknown, context?: string) => void;
  /** Handle conflicts from validation */
  handleConflicts: (conflicts: AssignmentConflict[]) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Execute an operation with automatic retry */
  withRetry: <T>(operation: () => Promise<T>, context?: string) => Promise<T>;
  /** Show success notification */
  notifySuccess: (message?: string, description?: string) => void;
  /** Show error notification */
  notifyError: (message?: string, description?: string) => void;
  /** Show warning notification */
  notifyWarning: (message: string, description?: string) => void;
  /** Get error message for a code */
  getErrorMessage: (code: AssignmentErrorCode) => string;
  /** Map error to error code */
  mapErrorToCode: (error: unknown) => AssignmentErrorCode;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  exponentialBackoff: true,
};

const INITIAL_ERROR_STATE: ErrorState = {
  hasError: false,
  message: '',
  messageFa: '',
  code: null,
  retryCount: 0,
  isRetrying: false,
  originalError: null,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if an error is retryable (transient)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors are retryable
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('504')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Map an error to an AssignmentErrorCode
 */
function mapErrorToCode(error: unknown): AssignmentErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection')
    ) {
      return AssignmentErrorCode.NETWORK_ERROR;
    }
    if (message.includes('incompatible') || message.includes('cannot teach')) {
      return AssignmentErrorCode.TEACHER_SUBJECT_INCOMPATIBLE;
    }
    if (
      message.includes('workload') ||
      message.includes('exceed') ||
      message.includes('capacity')
    ) {
      return AssignmentErrorCode.WORKLOAD_EXCEEDED;
    }
    if (message.includes('duplicate') || message.includes('already')) {
      return AssignmentErrorCode.DUPLICATE_ASSIGNMENT;
    }
    if (message.includes('availability') || message.includes('available')) {
      return AssignmentErrorCode.AVAILABILITY_CONFLICT;
    }
    if (message.includes('teacher') && message.includes('not found')) {
      return AssignmentErrorCode.TEACHER_NOT_FOUND;
    }
    if (message.includes('class') && message.includes('not found')) {
      return AssignmentErrorCode.CLASS_NOT_FOUND;
    }
    if (message.includes('subject') && message.includes('not found')) {
      return AssignmentErrorCode.SUBJECT_NOT_FOUND;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return AssignmentErrorCode.VALIDATION_ERROR;
    }
  }
  return AssignmentErrorCode.UNKNOWN_ERROR;
}

/**
 * Calculate delay for retry with optional exponential backoff
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  if (config.exponentialBackoff) {
    return config.baseDelay * Math.pow(2, attempt);
  }
  return config.baseDelay;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAssignmentErrorHandler(
  options: UseAssignmentErrorHandlerOptions = {}
): UseAssignmentErrorHandlerResult {
  const { i18n } = useTranslation();
  const isFarsi = i18n.language === 'fa';

  const retryConfig = useMemo<RetryConfig>(
    () => ({
      ...DEFAULT_RETRY_CONFIG,
      ...options.retry,
    }),
    [options.retry]
  );

  const showToasts = options.showToasts ?? true;

  const [errorState, setErrorState] = useState<ErrorState>(INITIAL_ERROR_STATE);
  const errorHandlerRef = useRef(new AssignmentErrorHandler(isFarsi ? 'fa' : 'en'));

  // Update error handler locale when language changes
  errorHandlerRef.current.setLocale(isFarsi ? 'fa' : 'en');

  /**
   * Handle an error from an operation
   */
  const handleError = useCallback(
    (error: unknown, context?: string) => {
      const code = mapErrorToCode(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      const messageFa = getAssignmentErrorMessage(code, 'fa');

      setErrorState({
        hasError: true,
        message,
        messageFa,
        code,
        retryCount: 0,
        isRetrying: false,
        originalError: error instanceof Error ? error : null,
      });

      // Log error for debugging
      console.error(`[Assignment Error${context ? ` - ${context}` : ''}]:`, error);

      // Show toast notification
      if (showToasts) {
        notifyAssignmentError(
          isFarsi ? messageFa : message,
          context ? (isFarsi ? `در ${context}` : `in ${context}`) : undefined
        );
      }

      // Call error callback
      options.onError?.(error instanceof Error ? error : new Error(message), code);
    },
    [isFarsi, showToasts, options]
  );

  /**
   * Handle conflicts from validation
   */
  const handleConflicts = useCallback(
    (conflicts: AssignmentConflict[]) => {
      if (conflicts.length === 0) return;

      const hasErrors = conflicts.some((c) => c.severity === 'error');

      if (hasErrors) {
        const errorConflict = conflicts.find((c) => c.severity === 'error')!;
        setErrorState({
          hasError: true,
          message: errorConflict.message,
          messageFa: errorConflict.messageFa,
          code: errorHandlerRef.current.conflictTypeToErrorCode(errorConflict.type),
          retryCount: 0,
          isRetrying: false,
          originalError: null,
        });
      }

      // Show toast notifications
      if (showToasts) {
        if (conflicts.length === 1) {
          notifyConflict(conflicts[0], { locale: isFarsi ? 'fa' : 'en', showSuggestions: true });
        } else {
          notifyConflicts(conflicts, { locale: isFarsi ? 'fa' : 'en' });
        }
      }
    },
    [isFarsi, showToasts]
  );

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setErrorState(INITIAL_ERROR_STATE);
  }, []);

  /**
   * Execute an operation with automatic retry
   */
  const withRetry = useCallback(
    async <T>(operation: () => Promise<T>, context?: string): Promise<T> => {
      let lastError: unknown;

      for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
        try {
          // Update retry state
          if (attempt > 0) {
            setErrorState((prev) => ({
              ...prev,
              retryCount: attempt,
              isRetrying: true,
            }));

            // Show retry toast
            if (showToasts) {
              toast.info(
                isFarsi
                  ? `تلاش مجدد ${attempt} از ${retryConfig.maxRetries}...`
                  : `Retry attempt ${attempt} of ${retryConfig.maxRetries}...`,
                { duration: 2000 }
              );
            }
          }

          const result = await operation();

          // Clear error state on success
          if (attempt > 0) {
            clearError();
            options.onRetrySuccess?.();

            if (showToasts) {
              toast.success(
                isFarsi ? 'عملیات با موفقیت انجام شد' : 'Operation completed successfully'
              );
            }
          }

          return result;
        } catch (error) {
          lastError = error;

          // Check if error is retryable
          if (!isRetryableError(error) || attempt === retryConfig.maxRetries) {
            // Not retryable or max retries reached
            handleError(error, context);
            throw error;
          }

          // Wait before retrying
          const delay = calculateRetryDelay(attempt, retryConfig);
          await sleep(delay);
        }
      }

      // Should not reach here, but just in case
      throw lastError;
    },
    [retryConfig, showToasts, isFarsi, handleError, clearError, options]
  );

  /**
   * Show success notification
   */
  const notifySuccess = useCallback(
    (message?: string, description?: string) => {
      const defaultMessage = isFarsi
        ? 'عملیات با موفقیت انجام شد'
        : 'Operation completed successfully';
      toast.success(message || defaultMessage, { description });
    },
    [isFarsi]
  );

  /**
   * Show error notification
   */
  const notifyError = useCallback(
    (message?: string, description?: string) => {
      const defaultMessage = isFarsi ? 'خطا در انجام عملیات' : 'Operation failed';
      toast.error(message || defaultMessage, { description });
    },
    [isFarsi]
  );

  /**
   * Show warning notification
   */
  const notifyWarning = useCallback((message: string, description?: string) => {
    toast.warning(message, { description });
  }, []);

  /**
   * Get error message for a code
   */
  const getErrorMessageFn = useCallback(
    (code: AssignmentErrorCode): string => {
      return getAssignmentErrorMessage(code, isFarsi ? 'fa' : 'en');
    },
    [isFarsi]
  );

  return {
    errorState,
    handleError,
    handleConflicts,
    clearError,
    withRetry,
    notifySuccess,
    notifyError,
    notifyWarning,
    getErrorMessage: getErrorMessageFn,
    mapErrorToCode,
  };
}

export default useAssignmentErrorHandler;
