/**
 * Export Error Service
 *
 * Provides comprehensive error handling for export operations including:
 * - Specific error messages for PDF/Excel generation failures
 * - Network timeout handling
 * - Graceful degradation for font/formatting issues
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

/**
 * Export error types for categorization
 */
export enum ExportErrorType {
  PDF_GENERATION = 'PDF_GENERATION',
  EXCEL_GENERATION = 'EXCEL_GENERATION',
  FONT_EMBEDDING = 'FONT_EMBEDDING',
  FILE_WRITE = 'FILE_WRITE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  VALIDATION = 'VALIDATION',
  BATCH_LIMIT = 'BATCH_LIMIT',
  SCHEDULE_NOT_FOUND = 'SCHEDULE_NOT_FOUND',
  CANCELLED = 'CANCELLED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Export error with additional context
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
export class ExportError extends Error {
  public readonly type: ExportErrorType;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    type: ExportErrorType,
    message: string,
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = 'ExportError';
    this.type = type;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
    this.originalError = options?.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExportError);
    }
  }

  /**
   * Get localized error message
   * Requirements: 10.5
   */
  getLocalizedMessage(language: 'fa' | 'en'): string {
    const messages: Record<ExportErrorType, { fa: string; en: string }> = {
      [ExportErrorType.PDF_GENERATION]: {
        fa: 'خطا در تولید فایل PDF',
        en: 'Error generating PDF file',
      },
      [ExportErrorType.EXCEL_GENERATION]: {
        fa: 'خطا در تولید فایل Excel',
        en: 'Error generating Excel file',
      },
      [ExportErrorType.FONT_EMBEDDING]: {
        fa: 'خطا در جاسازی فونت - از فونت پیش‌فرض استفاده می‌شود',
        en: 'Font embedding error - using default font',
      },
      [ExportErrorType.FILE_WRITE]: {
        fa: 'خطا در ذخیره فایل',
        en: 'Error saving file',
      },
      [ExportErrorType.NETWORK_TIMEOUT]: {
        fa: 'زمان صادرات به پایان رسید. لطفاً دوباره تلاش کنید.',
        en: 'Export timed out. Please try again.',
      },
      [ExportErrorType.VALIDATION]: {
        fa: 'داده‌های ورودی نامعتبر است',
        en: 'Invalid input data',
      },
      [ExportErrorType.BATCH_LIMIT]: {
        fa: 'حداکثر ۵۰ برنامه قابل صادرات است',
        en: 'Maximum 50 schedules can be exported',
      },
      [ExportErrorType.SCHEDULE_NOT_FOUND]: {
        fa: 'برنامه زمانی یافت نشد',
        en: 'Schedule not found',
      },
      [ExportErrorType.CANCELLED]: {
        fa: 'صادرات لغو شد',
        en: 'Export cancelled',
      },
      [ExportErrorType.UNKNOWN]: {
        fa: 'خطای ناشناخته در صادرات',
        en: 'Unknown export error',
      },
    };

    return messages[this.type]?.[language] || messages[ExportErrorType.UNKNOWN][language];
  }

  /**
   * Convert to JSON for API response
   */
  toJSON(): Record<string, unknown> {
    return {
      error: this.type,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

/**
 * Error handler utility functions
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
export const ExportErrorHandler = {
  /**
   * Create PDF generation error
   * Requirements: 10.1
   */
  pdfGenerationError(originalError?: Error, details?: Record<string, unknown>): ExportError {
    return new ExportError(ExportErrorType.PDF_GENERATION, 'PDF generation failed', {
      retryable: true,
      details,
      originalError,
    });
  },

  /**
   * Create Excel generation error
   * Requirements: 10.2
   */
  excelGenerationError(originalError?: Error, details?: Record<string, unknown>): ExportError {
    return new ExportError(ExportErrorType.EXCEL_GENERATION, 'Excel generation failed', {
      retryable: true,
      details,
      originalError,
    });
  },

  /**
   * Create font embedding error (graceful degradation)
   */
  fontEmbeddingError(originalError?: Error): ExportError {
    return new ExportError(
      ExportErrorType.FONT_EMBEDDING,
      'Font embedding failed - using fallback font',
      {
        retryable: false,
        originalError,
      }
    );
  },

  /**
   * Create file write error
   */
  fileWriteError(originalError?: Error, filePath?: string): ExportError {
    return new ExportError(ExportErrorType.FILE_WRITE, 'Failed to write export file', {
      retryable: true,
      details: { filePath },
      originalError,
    });
  },

  /**
   * Create network timeout error
   * Requirements: 10.3
   */
  networkTimeoutError(timeoutMs?: number): ExportError {
    return new ExportError(ExportErrorType.NETWORK_TIMEOUT, 'Export operation timed out', {
      retryable: true,
      details: { timeoutMs },
    });
  },

  /**
   * Create validation error
   */
  validationError(message: string, details?: Record<string, unknown>): ExportError {
    return new ExportError(ExportErrorType.VALIDATION, message, {
      retryable: false,
      details,
    });
  },

  /**
   * Create batch limit error
   * Requirements: 3.5
   */
  batchLimitError(requestedCount: number, maxCount: number = 50): ExportError {
    return new ExportError(
      ExportErrorType.BATCH_LIMIT,
      `Batch export limited to ${maxCount} schedules (requested: ${requestedCount})`,
      {
        retryable: false,
        details: { requestedCount, maxCount },
      }
    );
  },

  /**
   * Create schedule not found error
   */
  scheduleNotFoundError(scheduleId: number): ExportError {
    return new ExportError(ExportErrorType.SCHEDULE_NOT_FOUND, 'Schedule not found', {
      retryable: false,
      details: { scheduleId },
    });
  },

  /**
   * Create cancelled error
   */
  cancelledError(): ExportError {
    return new ExportError(ExportErrorType.CANCELLED, 'Export was cancelled by user', {
      retryable: false,
    });
  },

  /**
   * Wrap unknown error
   */
  wrapError(error: unknown): ExportError {
    if (error instanceof ExportError) {
      return error;
    }

    const originalError = error instanceof Error ? error : new Error(String(error));
    return new ExportError(ExportErrorType.UNKNOWN, originalError.message, {
      retryable: true,
      originalError,
    });
  },

  /**
   * Check if error is retryable
   */
  isRetryable(error: unknown): boolean {
    if (error instanceof ExportError) {
      return error.retryable;
    }
    return true; // Default to retryable for unknown errors
  },

  /**
   * Get error type from error
   */
  getErrorType(error: unknown): ExportErrorType {
    if (error instanceof ExportError) {
      return error.type;
    }
    return ExportErrorType.UNKNOWN;
  },
};

/**
 * Retry configuration for export operations
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Execute operation with retry logic
 * Requirements: 10.3
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if error is not retryable
      if (!ExportErrorHandler.isRetryable(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Increase delay for next attempt
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Execute operation with timeout
 * Requirements: 10.3
 */
export async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(ExportErrorHandler.networkTimeoutError(timeoutMs));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}
