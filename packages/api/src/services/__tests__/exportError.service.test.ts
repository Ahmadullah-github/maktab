/**
 * Unit Tests for ExportErrorService
 *
 * Tests error handling, retry logic, and localized error messages.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_CONFIG,
  ExportError,
  ExportErrorHandler,
  ExportErrorType,
  withRetry,
  withTimeout,
} from '../exportError.service';

describe('ExportError', () => {
  describe('Constructor', () => {
    it('should create error with type and message', () => {
      const error = new ExportError(ExportErrorType.PDF_GENERATION, 'PDF generation failed');

      expect(error.type).toBe(ExportErrorType.PDF_GENERATION);
      expect(error.message).toBe('PDF generation failed');
      expect(error.name).toBe('ExportError');
    });

    it('should create error with retryable flag', () => {
      const error = new ExportError(ExportErrorType.NETWORK_TIMEOUT, 'Timeout', {
        retryable: true,
      });

      expect(error.retryable).toBe(true);
    });

    it('should create error with details', () => {
      const error = new ExportError(ExportErrorType.BATCH_LIMIT, 'Too many schedules', {
        details: { requestedCount: 60, maxCount: 50 },
      });

      expect(error.details).toEqual({ requestedCount: 60, maxCount: 50 });
    });

    it('should create error with original error', () => {
      const originalError = new Error('Original error');
      const error = new ExportError(ExportErrorType.UNKNOWN, 'Wrapped error', { originalError });

      expect(error.originalError).toBe(originalError);
    });
  });

  describe('getLocalizedMessage', () => {
    it('should return Persian message for PDF generation error', () => {
      const error = new ExportError(ExportErrorType.PDF_GENERATION, 'PDF failed');

      expect(error.getLocalizedMessage('fa')).toBe('خطا در تولید فایل PDF');
    });

    it('should return English message for PDF generation error', () => {
      const error = new ExportError(ExportErrorType.PDF_GENERATION, 'PDF failed');

      expect(error.getLocalizedMessage('en')).toBe('Error generating PDF file');
    });

    it('should return Persian message for Excel generation error', () => {
      const error = new ExportError(ExportErrorType.EXCEL_GENERATION, 'Excel failed');

      expect(error.getLocalizedMessage('fa')).toBe('خطا در تولید فایل Excel');
    });

    it('should return English message for timeout error', () => {
      const error = new ExportError(ExportErrorType.NETWORK_TIMEOUT, 'Timeout');

      expect(error.getLocalizedMessage('en')).toBe('Export timed out. Please try again.');
    });

    it('should return Persian message for batch limit error', () => {
      const error = new ExportError(ExportErrorType.BATCH_LIMIT, 'Too many');

      expect(error.getLocalizedMessage('fa')).toBe('حداکثر ۵۰ برنامه قابل صادرات است');
    });
  });

  describe('toJSON', () => {
    it('should convert error to JSON format', () => {
      const error = new ExportError(ExportErrorType.PDF_GENERATION, 'PDF failed', {
        retryable: true,
        details: { page: 5 },
      });

      const json = error.toJSON();

      expect(json).toEqual({
        error: ExportErrorType.PDF_GENERATION,
        message: 'PDF failed',
        retryable: true,
        details: { page: 5 },
      });
    });
  });
});

describe('ExportErrorHandler', () => {
  describe('Factory Methods', () => {
    it('should create PDF generation error', () => {
      const error = ExportErrorHandler.pdfGenerationError();

      expect(error.type).toBe(ExportErrorType.PDF_GENERATION);
      expect(error.retryable).toBe(true);
    });

    it('should create Excel generation error', () => {
      const error = ExportErrorHandler.excelGenerationError();

      expect(error.type).toBe(ExportErrorType.EXCEL_GENERATION);
      expect(error.retryable).toBe(true);
    });

    it('should create font embedding error (not retryable)', () => {
      const error = ExportErrorHandler.fontEmbeddingError();

      expect(error.type).toBe(ExportErrorType.FONT_EMBEDDING);
      expect(error.retryable).toBe(false);
    });

    it('should create file write error with path', () => {
      const error = ExportErrorHandler.fileWriteError(undefined, '/tmp/export.pdf');

      expect(error.type).toBe(ExportErrorType.FILE_WRITE);
      expect(error.details?.filePath).toBe('/tmp/export.pdf');
    });

    it('should create network timeout error with timeout value', () => {
      const error = ExportErrorHandler.networkTimeoutError(30000);

      expect(error.type).toBe(ExportErrorType.NETWORK_TIMEOUT);
      expect(error.details?.timeoutMs).toBe(30000);
      expect(error.retryable).toBe(true);
    });

    it('should create validation error (not retryable)', () => {
      const error = ExportErrorHandler.validationError('Invalid format');

      expect(error.type).toBe(ExportErrorType.VALIDATION);
      expect(error.retryable).toBe(false);
    });

    it('should create batch limit error with counts', () => {
      const error = ExportErrorHandler.batchLimitError(60, 50);

      expect(error.type).toBe(ExportErrorType.BATCH_LIMIT);
      expect(error.details?.requestedCount).toBe(60);
      expect(error.details?.maxCount).toBe(50);
      expect(error.retryable).toBe(false);
    });

    it('should create schedule not found error', () => {
      const error = ExportErrorHandler.scheduleNotFoundError(123);

      expect(error.type).toBe(ExportErrorType.SCHEDULE_NOT_FOUND);
      expect(error.details?.scheduleId).toBe(123);
    });

    it('should create cancelled error', () => {
      const error = ExportErrorHandler.cancelledError();

      expect(error.type).toBe(ExportErrorType.CANCELLED);
      expect(error.retryable).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('should return ExportError unchanged', () => {
      const original = new ExportError(ExportErrorType.PDF_GENERATION, 'PDF failed');

      const wrapped = ExportErrorHandler.wrapError(original);

      expect(wrapped).toBe(original);
    });

    it('should wrap regular Error', () => {
      const original = new Error('Something went wrong');

      const wrapped = ExportErrorHandler.wrapError(original);

      expect(wrapped.type).toBe(ExportErrorType.UNKNOWN);
      expect(wrapped.message).toBe('Something went wrong');
      expect(wrapped.originalError).toBe(original);
    });

    it('should wrap string error', () => {
      const wrapped = ExportErrorHandler.wrapError('String error');

      expect(wrapped.type).toBe(ExportErrorType.UNKNOWN);
      expect(wrapped.message).toBe('String error');
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable ExportError', () => {
      const error = new ExportError(ExportErrorType.NETWORK_TIMEOUT, 'Timeout', {
        retryable: true,
      });

      expect(ExportErrorHandler.isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable ExportError', () => {
      const error = new ExportError(ExportErrorType.VALIDATION, 'Invalid', { retryable: false });

      expect(ExportErrorHandler.isRetryable(error)).toBe(false);
    });

    it('should return true for unknown errors (default)', () => {
      const error = new Error('Unknown error');

      expect(ExportErrorHandler.isRetryable(error)).toBe(true);
    });
  });

  describe('getErrorType', () => {
    it('should return type for ExportError', () => {
      const error = new ExportError(ExportErrorType.PDF_GENERATION, 'PDF failed');

      expect(ExportErrorHandler.getErrorType(error)).toBe(ExportErrorType.PDF_GENERATION);
    });

    it('should return UNKNOWN for regular Error', () => {
      const error = new Error('Regular error');

      expect(ExportErrorHandler.getErrorType(error)).toBe(ExportErrorType.UNKNOWN);
    });
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      return 'success';
    };

    const result = await withRetry(operation);

    expect(result).toBe('success');
    expect(attempts).toBe(1);
  });

  it('should retry on failure and succeed', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    };

    const result = await withRetry(operation, {
      maxRetries: 3,
      initialDelayMs: 10,
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      throw new Error('Persistent failure');
    };

    await expect(withRetry(operation, { maxRetries: 2, initialDelayMs: 10 })).rejects.toThrow(
      'Persistent failure'
    );

    expect(attempts).toBe(3); // Initial + 2 retries
  });

  it('should not retry non-retryable errors', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      throw new ExportError(ExportErrorType.VALIDATION, 'Invalid', {
        retryable: false,
      });
    };

    await expect(withRetry(operation, { maxRetries: 3, initialDelayMs: 10 })).rejects.toThrow(
      'Invalid'
    );

    expect(attempts).toBe(1);
  });
});

describe('withTimeout', () => {
  it('should return result before timeout', async () => {
    const operation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return 'success';
    };

    const result = await withTimeout(operation, 1000);

    expect(result).toBe('success');
  });

  it('should throw timeout error when operation exceeds timeout', async () => {
    const operation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'success';
    };

    await expect(withTimeout(operation, 10)).rejects.toThrow();
  });

  it('should throw ExportError with NETWORK_TIMEOUT type', async () => {
    const operation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'success';
    };

    try {
      await withTimeout(operation, 10);
    } catch (error) {
      expect(error).toBeInstanceOf(ExportError);
      expect((error as ExportError).type).toBe(ExportErrorType.NETWORK_TIMEOUT);
    }
  });
});

describe('DEFAULT_RETRY_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(1000);
    expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(10000);
    expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
  });
});
