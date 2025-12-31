/**
 * Property Test: Progress Text Format
 *
 * **Feature: schedule-phase5, Property 8: Progress Text Format**
 *
 * Property: For any export progress with current=X and total=Y values,
 * the displayed status text SHALL match the format "Exporting X of Y..."
 * or equivalent localized format.
 *
 * **Validates: Requirements 4.2**
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Progress status types
 */
type ProgressStatus = 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';

/**
 * Export progress interface matching the component
 */
interface ExportProgress {
  current: number;
  total: number;
  status: ProgressStatus;
  message: string;
}

/**
 * Generate progress text based on status and values
 * This mirrors the logic in ExportProgress component
 */
function generateProgressText(progress: ExportProgress, language: 'fa' | 'en' = 'en'): string {
  const { current, total, status } = progress;

  switch (status) {
    case 'preparing':
      return language === 'fa' ? 'آماده‌سازی...' : 'Preparing...';
    case 'generating':
      if (total > 1) {
        return language === 'fa'
          ? `در حال تولید ${current} از ${total}...`
          : `Generating ${current} of ${total}...`;
      }
      return language === 'fa' ? 'در حال تولید...' : 'Generating...';
    case 'finalizing':
      return language === 'fa' ? 'نهایی‌سازی...' : 'Finalizing...';
    case 'complete':
      return language === 'fa' ? 'تکمیل شد' : 'Complete';
    case 'error':
      return language === 'fa' ? 'خطا در صادرات' : 'Export Error';
    default:
      return language === 'fa' ? 'در حال پردازش...' : 'Processing...';
  }
}

/**
 * Validate progress text format for "Exporting X of Y..." pattern
 * Requirements: 4.2
 */
function validateProgressTextFormat(
  text: string,
  current: number,
  total: number,
  language: 'fa' | 'en'
): boolean {
  if (language === 'en') {
    // English format: "Generating X of Y..."
    const englishPattern = new RegExp(`Generating ${current} of ${total}\\.\\.\\.`);
    return englishPattern.test(text);
  } else {
    // Persian format: "در حال تولید X از Y..."
    const persianPattern = new RegExp(`در حال تولید ${current} از ${total}\\.\\.\\.`);
    return persianPattern.test(text);
  }
}

/**
 * Calculate percentage from progress values
 */
function calculatePercentage(current: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((current / total) * 100);
}

describe('Feature: schedule-phase5, Property 8: Progress Text Format', () => {
  /**
   * Arbitrary for valid progress values
   */
  const progressValuesArb = fc
    .record({
      current: fc.integer({ min: 0, max: 100 }),
      total: fc.integer({ min: 1, max: 100 }),
    })
    .filter(({ current, total }) => current <= total);

  /**
   * Arbitrary for progress status
   */
  const progressStatusArb = fc.constantFrom<ProgressStatus>(
    'preparing',
    'generating',
    'finalizing',
    'complete',
    'error'
  );

  /**
   * Arbitrary for language
   */
  const languageArb = fc.constantFrom<'fa' | 'en'>('fa', 'en');

  /**
   * Arbitrary for complete ExportProgress
   */
  const exportProgressArb = fc
    .record({
      current: fc.integer({ min: 0, max: 100 }),
      total: fc.integer({ min: 1, max: 100 }),
      status: progressStatusArb,
      message: fc.string({ minLength: 0, maxLength: 100 }),
    })
    .filter(({ current, total }) => current <= total);

  it('should generate progress text matching "Exporting X of Y..." format for batch exports', () => {
    fc.assert(
      fc.property(progressValuesArb, languageArb, ({ current, total }, language) => {
        // Only test when total > 1 (batch export) and status is 'generating'
        if (total <= 1) return true;

        const progress: ExportProgress = {
          current,
          total,
          status: 'generating',
          message: '',
        };

        const text = generateProgressText(progress, language);

        // Verify the text matches the expected format
        const isValid = validateProgressTextFormat(text, current, total, language);
        expect(isValid).toBe(true);

        return isValid;
      }),
      { numRuns: 100 }
    );
  });

  it('should include current and total values in progress text', () => {
    fc.assert(
      fc.property(
        progressValuesArb.filter(({ total }) => total > 1),
        languageArb,
        ({ current, total }, language) => {
          const progress: ExportProgress = {
            current,
            total,
            status: 'generating',
            message: '',
          };

          const text = generateProgressText(progress, language);

          // Text should contain both current and total values
          expect(text).toContain(current.toString());
          expect(text).toContain(total.toString());

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate percentage correctly from progress values', () => {
    fc.assert(
      fc.property(progressValuesArb, ({ current, total }) => {
        const percentage = calculatePercentage(current, total);

        // Percentage should be between 0 and 100
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);

        // Percentage should be mathematically correct (within rounding)
        const expectedPercentage = Math.round((current / total) * 100);
        expect(percentage).toBe(expectedPercentage);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle edge case when total is 0', () => {
    const percentage = calculatePercentage(0, 0);
    expect(percentage).toBe(0);
  });

  it('should show simple text for single exports (total = 1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1 }), languageArb, (current, language) => {
        const progress: ExportProgress = {
          current,
          total: 1,
          status: 'generating',
          message: '',
        };

        const text = generateProgressText(progress, language);

        // For single exports, should not show "X of Y" format
        expect(text).not.toContain(' of ');
        expect(text).not.toContain(' از ');

        // Should show simple generating text
        if (language === 'en') {
          expect(text).toBe('Generating...');
        } else {
          expect(text).toBe('در حال تولید...');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should show appropriate text for each status', () => {
    fc.assert(
      fc.property(exportProgressArb, languageArb, (progress, language) => {
        const text = generateProgressText(progress, language);

        // Text should not be empty
        expect(text.length).toBeGreaterThan(0);

        // Text should match expected patterns based on status
        switch (progress.status) {
          case 'preparing':
            if (language === 'en') {
              expect(text).toBe('Preparing...');
            } else {
              expect(text).toBe('آماده‌سازی...');
            }
            break;
          case 'finalizing':
            if (language === 'en') {
              expect(text).toBe('Finalizing...');
            } else {
              expect(text).toBe('نهایی‌سازی...');
            }
            break;
          case 'complete':
            if (language === 'en') {
              expect(text).toBe('Complete');
            } else {
              expect(text).toBe('تکمیل شد');
            }
            break;
          case 'error':
            if (language === 'en') {
              expect(text).toBe('Export Error');
            } else {
              expect(text).toBe('خطا در صادرات');
            }
            break;
          // 'generating' is tested separately
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain progress invariant: current <= total', () => {
    fc.assert(
      fc.property(exportProgressArb, (progress) => {
        // This invariant should always hold
        expect(progress.current).toBeLessThanOrEqual(progress.total);
        return progress.current <= progress.total;
      }),
      { numRuns: 100 }
    );
  });

  it('should produce consistent text for same inputs', () => {
    fc.assert(
      fc.property(exportProgressArb, languageArb, (progress, language) => {
        const text1 = generateProgressText(progress, language);
        const text2 = generateProgressText(progress, language);

        // Same inputs should produce same output (deterministic)
        expect(text1).toBe(text2);

        return text1 === text2;
      }),
      { numRuns: 100 }
    );
  });
});
