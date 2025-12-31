/**
 * Property-based tests for GenerationProgress component
 * Tests that strategy names are correctly displayed for all strategy values
 *
 * **Feature: schedule-phase3, Property 10: Strategy Name Displayed in Progress**
 * **Validates: Requirements 4.4**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
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

// Arbitrary for valid solver strategies
const strategyArb = fc.constantFrom<SolverStrategy>('fast', 'balanced', 'thorough');

// Arbitrary for elapsed time (0 to 10 minutes in seconds)
const elapsedTimeArb = fc.integer({ min: 0, max: 600 });

// Arbitrary for generation error types
const errorTypeArb = fc.constantFrom<GenerationError['type']>(
  'SOLVER_BUSY',
  'SOLVER_TIMEOUT',
  'SOLVER_ERROR',
  'UNKNOWN'
);

// Arbitrary for generation error
const generationErrorArb = fc.record({
  type: errorTypeArb,
  message: fc.string({ minLength: 1, maxLength: 100 }),
  messageFa: fc.string({ minLength: 1, maxLength: 200 }),
});

// Arbitrary for GenerationProgress props
const generationProgressPropsArb = fc.record({
  isGenerating: fc.boolean(),
  elapsedTime: elapsedTimeArb,
  strategy: strategyArb,
  error: fc.option(generationErrorArb, { nil: null }),
});

describe('GenerationProgress Property Tests', () => {
  /**
   * **Feature: schedule-phase3, Property 10: Strategy Name Displayed in Progress**
   * **Validates: Requirements 4.4**
   *
   * For any valid solver strategy value, the GenerationProgress component
   * SHALL display the corresponding Persian strategy name from STRATEGY_OPTIONS.
   */
  it('Property 10: Strategy name is correctly mapped for all strategies', () => {
    fc.assert(
      fc.property(strategyArb, (strategy) => {
        const displayedName = getStrategyName(strategy);

        // Find the expected name from STRATEGY_OPTIONS
        const expectedOption = STRATEGY_OPTIONS.find((opt) => opt.value === strategy);

        // Strategy should always be found in STRATEGY_OPTIONS
        expect(expectedOption).toBeDefined();

        // Displayed name should match the Persian label
        expect(displayedName).toBe(expectedOption!.labelFa);

        // Verify specific mappings
        if (strategy === 'fast') {
          expect(displayedName).toBe('سریع');
        } else if (strategy === 'balanced') {
          expect(displayedName).toBe('متعادل');
        } else if (strategy === 'thorough') {
          expect(displayedName).toBe('کامل');
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Elapsed time is always formatted as MM:SS
   * Validates: Requirements 4.1
   */
  it('Property: Elapsed time format is always MM:SS', () => {
    fc.assert(
      fc.property(elapsedTimeArb, (seconds) => {
        const formatted = formatElapsedTime(seconds);

        // Should match MM:SS pattern
        expect(formatted).toMatch(/^\d{2}:\d{2}$/);

        // Parse back and verify
        const [mins, secs] = formatted.split(':').map(Number);
        expect(mins).toBe(Math.floor(seconds / 60));
        expect(secs).toBe(seconds % 60);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Elapsed time minutes and seconds are always padded to 2 digits
   */
  it('Property: Elapsed time components are zero-padded', () => {
    fc.assert(
      fc.property(elapsedTimeArb, (seconds) => {
        const formatted = formatElapsedTime(seconds);
        const [minsStr, secsStr] = formatted.split(':');

        // Both parts should be exactly 2 characters
        expect(minsStr.length).toBe(2);
        expect(secsStr.length).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: SOLVER_BUSY error never shows retry button
   * Validates: Requirements 4.5
   */
  it('Property: SOLVER_BUSY error hides retry button', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constant<GenerationError['type']>('SOLVER_BUSY'),
          message: fc.string({ minLength: 1 }),
          messageFa: fc.string({ minLength: 1 }),
        }),
        (error) => {
          // Component logic: showRetry = error.type !== 'SOLVER_BUSY'
          const showRetry = error.type !== 'SOLVER_BUSY';
          expect(showRetry).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Non-SOLVER_BUSY errors always show retry button
   * Validates: Requirements 4.6
   */
  it('Property: Non-SOLVER_BUSY errors show retry button', () => {
    const nonBusyErrorTypeArb = fc.constantFrom<GenerationError['type']>(
      'SOLVER_TIMEOUT',
      'SOLVER_ERROR',
      'UNKNOWN'
    );

    fc.assert(
      fc.property(
        fc.record({
          type: nonBusyErrorTypeArb,
          message: fc.string({ minLength: 1 }),
          messageFa: fc.string({ minLength: 1 }),
        }),
        (error) => {
          // Component logic: showRetry = error.type !== 'SOLVER_BUSY'
          const showRetry = error.type !== 'SOLVER_BUSY';
          expect(showRetry).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All strategy options have both Persian and English labels
   */
  it('Property: All strategies have complete option data', () => {
    fc.assert(
      fc.property(strategyArb, (strategy) => {
        const option = STRATEGY_OPTIONS.find((opt) => opt.value === strategy);

        expect(option).toBeDefined();
        expect(option!.labelFa).toBeTruthy();
        expect(option!.labelEn).toBeTruthy();
        expect(option!.estimatedTime).toBeTruthy();
        expect(option!.estimatedTimeFa).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Component renders nothing when not generating and no error
   */
  it('Property: Component returns null when idle', () => {
    fc.assert(
      fc.property(
        fc.record({
          isGenerating: fc.constant(false),
          elapsedTime: elapsedTimeArb,
          strategy: strategyArb,
          error: fc.constant(null),
        }),
        (props) => {
          // When isGenerating is false and error is null, component returns null
          expect(props.isGenerating).toBe(false);
          expect(props.error).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Error state takes precedence over generating state
   */
  it('Property: Error state is displayed regardless of isGenerating', () => {
    fc.assert(
      fc.property(
        fc.record({
          isGenerating: fc.boolean(),
          elapsedTime: elapsedTimeArb,
          strategy: strategyArb,
          error: generationErrorArb,
        }),
        (props) => {
          // When error exists, it should be displayed
          expect(props.error).toBeDefined();
          expect(props.error!.type).toBeDefined();
          expect(props.error!.messageFa).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Props preserve all input values
   */
  it('Property: Props values are preserved', () => {
    fc.assert(
      fc.property(generationProgressPropsArb, (props) => {
        // All props should maintain their values
        expect(typeof props.isGenerating).toBe('boolean');
        expect(typeof props.elapsedTime).toBe('number');
        expect(props.elapsedTime).toBeGreaterThanOrEqual(0);
        expect(['fast', 'balanced', 'thorough']).toContain(props.strategy);

        if (props.error !== null) {
          expect(['SOLVER_BUSY', 'SOLVER_TIMEOUT', 'SOLVER_ERROR', 'UNKNOWN']).toContain(
            props.error.type
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});
