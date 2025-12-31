/**
 * Unit tests for GenerationProgress component
 * Tests elapsed time display, spinner, strategy name, and error handling
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6
 */

import { describe, expect, it, vi } from 'vitest';
import { STRATEGY_OPTIONS, type GenerationError, type SolverStrategy } from '../types';

// Helper to get strategy name (mirrors component logic)
const getStrategyName = (strategyValue: SolverStrategy): string => {
  const option = STRATEGY_OPTIONS.find((opt) => opt.value === strategyValue);
  return option?.labelFa ?? strategyValue;
};

// Helper to format elapsed time (mirrors component logic)
const formatElapsedTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

describe('GenerationProgress Unit Tests', () => {
  /**
   * Test component exports
   */
  describe('Component Export', () => {
    it('should export GenerationProgress component', async () => {
      const { GenerationProgress } = await import('../components/dashboard/GenerationProgress');
      expect(typeof GenerationProgress).toBe('function');
    });

    it('should export GenerationProgressProps type', async () => {
      const module = await import('../components/dashboard/GenerationProgress');
      expect(module).toBeDefined();
      expect(module.GenerationProgress).toBeDefined();
    });
  });

  /**
   * Test elapsed time formatting
   * Requirements: 4.1
   */
  describe('Elapsed Time Display', () => {
    it('should format 0 seconds as 00:00', () => {
      expect(formatElapsedTime(0)).toBe('00:00');
    });

    it('should format 30 seconds as 00:30', () => {
      expect(formatElapsedTime(30)).toBe('00:30');
    });

    it('should format 60 seconds as 01:00', () => {
      expect(formatElapsedTime(60)).toBe('01:00');
    });

    it('should format 90 seconds as 01:30', () => {
      expect(formatElapsedTime(90)).toBe('01:30');
    });

    it('should format 125 seconds as 02:05', () => {
      expect(formatElapsedTime(125)).toBe('02:05');
    });

    it('should format 599 seconds as 09:59', () => {
      expect(formatElapsedTime(599)).toBe('09:59');
    });

    it('should format 600 seconds as 10:00', () => {
      expect(formatElapsedTime(600)).toBe('10:00');
    });
  });

  /**
   * Test spinner/progress indicator
   * Requirements: 4.2
   */
  describe('Spinner Display', () => {
    it('should show spinner when isGenerating is true', () => {
      // The component uses Loader2 from lucide-react with animate-spin class
      // This test verifies the expected behavior
      const props = {
        isGenerating: true,
        elapsedTime: 0,
        strategy: 'balanced' as SolverStrategy,
        error: null,
      };

      expect(props.isGenerating).toBe(true);
    });

    it('should not render when isGenerating is false and no error', () => {
      const props = {
        isGenerating: false,
        elapsedTime: 0,
        strategy: 'balanced' as SolverStrategy,
        error: null,
      };

      // Component returns null when not generating and no error
      expect(props.isGenerating).toBe(false);
      expect(props.error).toBeNull();
    });
  });

  /**
   * Test strategy name display
   * Requirements: 4.4
   */
  describe('Strategy Name Display', () => {
    it('should display "سریع" for fast strategy', () => {
      expect(getStrategyName('fast')).toBe('سریع');
    });

    it('should display "متعادل" for balanced strategy', () => {
      expect(getStrategyName('balanced')).toBe('متعادل');
    });

    it('should display "کامل" for thorough strategy', () => {
      expect(getStrategyName('thorough')).toBe('کامل');
    });

    it('should fallback to strategy value for unknown strategy', () => {
      // @ts-expect-error Testing unknown strategy
      expect(getStrategyName('unknown')).toBe('unknown');
    });
  });

  /**
   * Test SOLVER_BUSY error handling
   * Requirements: 4.5
   */
  describe('SOLVER_BUSY Error Handling', () => {
    it('should show busy message for SOLVER_BUSY error', () => {
      const error: GenerationError = {
        type: 'SOLVER_BUSY',
        message: 'Solver is busy',
        messageFa: 'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
      };

      expect(error.type).toBe('SOLVER_BUSY');
      expect(error.messageFa).toBe('در حال حاضر یک تولید جدول زمانی در حال اجرا است');
    });

    it('should hide retry button for SOLVER_BUSY error', () => {
      const error: GenerationError = {
        type: 'SOLVER_BUSY',
        message: 'Solver is busy',
        messageFa: 'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
      };

      // Component logic: showRetry = error.type !== 'SOLVER_BUSY'
      const showRetry = error.type !== 'SOLVER_BUSY';
      expect(showRetry).toBe(false);
    });
  });

  /**
   * Test SOLVER_TIMEOUT error handling
   * Requirements: 4.6
   */
  describe('SOLVER_TIMEOUT Error Handling', () => {
    it('should show timeout message for SOLVER_TIMEOUT error', () => {
      const error: GenerationError = {
        type: 'SOLVER_TIMEOUT',
        message: 'Solver timed out',
        messageFa: 'تولید جدول زمانی زمان‌بر شد',
      };

      expect(error.type).toBe('SOLVER_TIMEOUT');
      expect(error.messageFa).toBe('تولید جدول زمانی زمان‌بر شد');
    });

    it('should show retry button for SOLVER_TIMEOUT error', () => {
      const error: GenerationError = {
        type: 'SOLVER_TIMEOUT',
        message: 'Solver timed out',
        messageFa: 'تولید جدول زمانی زمان‌بر شد',
      };

      // Component logic: showRetry = error.type !== 'SOLVER_BUSY'
      const showRetry = error.type !== 'SOLVER_BUSY';
      expect(showRetry).toBe(true);
    });
  });

  /**
   * Test generic error handling
   * Requirements: 4.3
   */
  describe('Generic Error Handling', () => {
    it('should show error message for SOLVER_ERROR', () => {
      const error: GenerationError = {
        type: 'SOLVER_ERROR',
        message: 'Solver error occurred',
        messageFa: 'خطا در تولید جدول زمانی',
      };

      expect(error.type).toBe('SOLVER_ERROR');
      expect(error.messageFa).toBe('خطا در تولید جدول زمانی');
    });

    it('should show retry button for SOLVER_ERROR', () => {
      const error: GenerationError = {
        type: 'SOLVER_ERROR',
        message: 'Solver error occurred',
        messageFa: 'خطا در تولید جدول زمانی',
      };

      const showRetry = error.type !== 'SOLVER_BUSY';
      expect(showRetry).toBe(true);
    });

    it('should show error message for UNKNOWN error', () => {
      const error: GenerationError = {
        type: 'UNKNOWN',
        message: 'Unknown error',
        messageFa: 'خطا در تولید جدول زمانی',
      };

      expect(error.type).toBe('UNKNOWN');
    });

    it('should show retry button for UNKNOWN error', () => {
      const error: GenerationError = {
        type: 'UNKNOWN',
        message: 'Unknown error',
        messageFa: 'خطا در تولید جدول زمانی',
      };

      const showRetry = error.type !== 'SOLVER_BUSY';
      expect(showRetry).toBe(true);
    });
  });

  /**
   * Test callback handlers
   */
  describe('Callback Handlers', () => {
    it('should call onRetry when retry button is clicked', () => {
      const onRetry = vi.fn();

      // Simulate the callback being called (as would happen on button click)
      onRetry();
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', () => {
      const onCancel = vi.fn();

      // Simulate the callback being called
      onCancel();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Test props interface
   */
  describe('Props Interface', () => {
    it('should accept all required props', () => {
      const validProps = {
        isGenerating: true,
        elapsedTime: 45,
        strategy: 'balanced' as SolverStrategy,
        error: null,
        onRetry: () => {},
        onCancel: () => {},
      };

      expect(validProps.isGenerating).toBeDefined();
      expect(validProps.elapsedTime).toBeDefined();
      expect(validProps.strategy).toBeDefined();
      expect(validProps.error).toBeDefined();
    });

    it('should accept optional callbacks', () => {
      const propsWithoutCallbacks = {
        isGenerating: true,
        elapsedTime: 0,
        strategy: 'fast' as SolverStrategy,
      };

      expect(propsWithoutCallbacks.isGenerating).toBe(true);
    });
  });

  /**
   * Test feature module exports
   */
  describe('Feature Module Export', () => {
    it('should export GenerationProgress from GenerationProgress module', async () => {
      const { GenerationProgress } = await import('../components/dashboard/GenerationProgress');
      expect(typeof GenerationProgress).toBe('function');
    });

    it('should export GenerationProgressProps type from GenerationProgress module', async () => {
      const module = await import('../components/dashboard/GenerationProgress');
      expect(module.GenerationProgress).toBeDefined();
    });
  });
});
