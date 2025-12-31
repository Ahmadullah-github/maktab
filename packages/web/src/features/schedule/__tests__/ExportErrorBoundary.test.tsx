/**
 * Unit tests for ExportErrorBoundary Component
 *
 * Tests error catching, categorization, display, and recovery
 *
 * Requirements: 10.3
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportErrorBoundary } from '../components/export/ExportErrorBoundary';

// Import translation files to verify error boundary translations exist
import enTranslations from '@/i18n/locales/en.json';
import faTranslations from '@/i18n/locales/fa.json';

describe('ExportErrorBoundary Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Tests for translation coverage
   * Requirements: 10.3
   */
  describe('Translation Coverage', () => {
    it('should have export error translations in English', () => {
      expect(enTranslations.schedule.export.errors).toBeDefined();
      expect(enTranslations.schedule.export.errors.networkError).toBeDefined();
      expect(enTranslations.schedule.export.errors.networkErrorDesc).toBeDefined();
      expect(enTranslations.schedule.export.errors.timeout).toBeDefined();
      expect(enTranslations.schedule.export.errors.timeoutDesc).toBeDefined();
      expect(enTranslations.schedule.export.errors.validationError).toBeDefined();
      expect(enTranslations.schedule.export.errors.validationErrorDesc).toBeDefined();
      expect(enTranslations.schedule.export.errors.generationError).toBeDefined();
      expect(enTranslations.schedule.export.errors.generationErrorDesc).toBeDefined();
      expect(enTranslations.schedule.export.errors.downloadFailed).toBeDefined();
      expect(enTranslations.schedule.export.errors.downloadFailedDesc).toBeDefined();
      expect(enTranslations.schedule.export.errors.unknownError).toBeDefined();
      expect(enTranslations.schedule.export.errors.unknownErrorDesc).toBeDefined();
    });

    it('should have export error translations in Farsi', () => {
      expect(faTranslations.schedule.export.errors).toBeDefined();
      expect(faTranslations.schedule.export.errors.networkError).toBeDefined();
      expect(faTranslations.schedule.export.errors.networkErrorDesc).toBeDefined();
      expect(faTranslations.schedule.export.errors.timeout).toBeDefined();
      expect(faTranslations.schedule.export.errors.timeoutDesc).toBeDefined();
      expect(faTranslations.schedule.export.errors.validationError).toBeDefined();
      expect(faTranslations.schedule.export.errors.validationErrorDesc).toBeDefined();
      expect(faTranslations.schedule.export.errors.generationError).toBeDefined();
      expect(faTranslations.schedule.export.errors.generationErrorDesc).toBeDefined();
      expect(faTranslations.schedule.export.errors.downloadFailed).toBeDefined();
      expect(faTranslations.schedule.export.errors.downloadFailedDesc).toBeDefined();
      expect(faTranslations.schedule.export.errors.unknownError).toBeDefined();
      expect(faTranslations.schedule.export.errors.unknownErrorDesc).toBeDefined();
    });

    it('should have Farsi translations containing Farsi characters', () => {
      const farsiRegex = /[\u0600-\u06FF]/;
      expect(farsiRegex.test(faTranslations.schedule.export.errors.networkError)).toBe(true);
      expect(farsiRegex.test(faTranslations.schedule.export.errors.timeout)).toBe(true);
      expect(farsiRegex.test(faTranslations.schedule.export.errors.unknownError)).toBe(true);
    });
  });

  /**
   * Tests for error boundary behavior
   * Requirements: 10.3
   */
  describe('Error Boundary Behavior', () => {
    // Component that throws an error
    const ThrowingComponent = ({
      shouldThrow,
      errorMessage = 'Test error',
    }: {
      shouldThrow: boolean;
      errorMessage?: string;
    }) => {
      if (shouldThrow) {
        throw new Error(errorMessage);
      }
      return <div data-testid="child-content">Child content</div>;
    };

    it('should render children when no error occurs', () => {
      render(
        <ExportErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ExportErrorBoundary>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    it('should catch error and display fallback UI', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      // Should not show child content
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

      // Should show error UI with close button
      expect(screen.getByText('بستن')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should render custom fallback when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary fallback={<div data-testid="custom-fallback">Custom fallback</div>}>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should call onReset when reset button is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onReset = vi.fn();

      render(
        <ExportErrorBoundary onReset={onReset}>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      const resetButton = screen.getByText('بستن');
      fireEvent.click(resetButton);

      expect(onReset).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should call onRetry when retry button is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onRetry = vi.fn();

      render(
        <ExportErrorBoundary onRetry={onRetry}>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      const retryButton = screen.getByText('تلاش مجدد');
      fireEvent.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should not show retry button when onRetry is not provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ExportErrorBoundary>
      );

      expect(screen.queryByText('تلاش مجدد')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  /**
   * Tests for error categorization
   * Requirements: 10.3
   */
  describe('Error Categorization', () => {
    const ThrowingComponent = ({ errorMessage }: { errorMessage: string }) => {
      throw new Error(errorMessage);
    };

    it('should categorize network errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent errorMessage="Network error: Failed to fetch" />
        </ExportErrorBoundary>
      );

      // Should show network error message
      expect(screen.getByText('خطای شبکه')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should categorize timeout errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent errorMessage="Request timed out" />
        </ExportErrorBoundary>
      );

      // Should show timeout error message
      expect(screen.getByText('زمان صادرات به پایان رسید')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should categorize validation errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent errorMessage="Validation failed: invalid input" />
        </ExportErrorBoundary>
      );

      // Should show validation error message
      expect(screen.getByText('خطای اعتبارسنجی')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should categorize generation errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent errorMessage="Failed to generate PDF" />
        </ExportErrorBoundary>
      );

      // Should show generation error message
      expect(screen.getByText('خطا در تولید فایل')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should categorize download errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent errorMessage="Download failed" />
        </ExportErrorBoundary>
      );

      // Should show download error message
      expect(screen.getByText('خطا در دانلود')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should show unknown error for unrecognized errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ExportErrorBoundary>
          <ThrowingComponent errorMessage="Some random error" />
        </ExportErrorBoundary>
      );

      // Should show unknown error message
      expect(screen.getByText('خطای ناشناخته')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  /**
   * Tests for error logging
   * Requirements: 10.3
   */
  describe('Error Logging', () => {
    it('should log error to console in development', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowingComponent = () => {
        throw new Error('Test error for logging');
      };

      render(
        <ExportErrorBoundary scheduleId={123}>
          <ThrowingComponent />
        </ExportErrorBoundary>
      );

      // In development mode, error should be logged
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  /**
   * Tests for RTL layout
   * Requirements: 10.3
   */
  describe('RTL Layout', () => {
    it('should have RTL direction on error UI', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const ThrowingComponent = () => {
        throw new Error('Test error');
      };

      render(
        <ExportErrorBoundary>
          <ThrowingComponent />
        </ExportErrorBoundary>
      );

      // Find the container with RTL direction
      const container = screen.getByText('بستن').closest('div[dir="rtl"]');
      expect(container).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  /**
   * Tests for error recovery
   * Requirements: 10.3
   */
  describe('Error Recovery', () => {
    it('should reset error state and render children after reset', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let shouldThrow = true;

      const ConditionalThrowingComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div data-testid="recovered-content">Recovered content</div>;
      };

      const { rerender } = render(
        <ExportErrorBoundary>
          <ConditionalThrowingComponent />
        </ExportErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText('بستن')).toBeInTheDocument();

      // Click reset
      shouldThrow = false;
      const resetButton = screen.getByText('بستن');
      fireEvent.click(resetButton);

      // Re-render with no error
      rerender(
        <ExportErrorBoundary>
          <ConditionalThrowingComponent />
        </ExportErrorBoundary>
      );

      // Should show recovered content
      expect(screen.getByTestId('recovered-content')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});
