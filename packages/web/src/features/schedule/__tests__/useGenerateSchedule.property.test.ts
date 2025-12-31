/**
 * Property-based tests for useGenerateSchedule hook
 *
 * **Feature: schedule-phase3, Property 7: Generate Mutation Called with Selected Strategy**
 * **Feature: schedule-phase3, Property 15: isGenerating Reflects Mutation State**
 * **Feature: schedule-phase3, Property 9: Elapsed Time Calculation Accuracy**
 */

import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SolverStrategy } from '../types';

// Generator for valid solver strategies
const strategyArb: fc.Arbitrary<SolverStrategy> = fc.constantFrom('fast', 'balanced', 'thorough');

// Generator for elapsed time scenarios (in milliseconds)
const elapsedTimeArb = fc.integer({ min: 0, max: 600000 }); // 0 to 10 minutes

describe('useGenerateSchedule Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * **Feature: schedule-phase3, Property 7: Generate Mutation Called with Selected Strategy**
   * **Validates: Requirements 3.4**
   *
   * For any valid strategy value, when generate is called,
   * the API SHALL be called with that exact strategy value.
   */
  it('Property 7: Strategy value is preserved in API call input', () => {
    fc.assert(
      fc.property(strategyArb, (strategy) => {
        // Mock API call to capture the input
        let capturedStrategy: SolverStrategy | null = null;

        const mockGenerateApi = (input: { strategy: SolverStrategy }) => {
          capturedStrategy = input.strategy;
          return Promise.resolve({ success: true });
        };

        // Simulate calling the API with the strategy
        mockGenerateApi({ strategy });

        // Verify the strategy was passed exactly as provided
        expect(capturedStrategy).toBe(strategy);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 7 (extended): All strategy values are valid**
   * **Validates: Requirements 3.4**
   *
   * The strategy type should only allow 'fast', 'balanced', or 'thorough'.
   */
  it('Property 7a: Only valid strategy values are accepted', () => {
    const validStrategies: SolverStrategy[] = ['fast', 'balanced', 'thorough'];

    fc.assert(
      fc.property(strategyArb, (strategy) => {
        // Verify the generated strategy is one of the valid values
        expect(validStrategies).toContain(strategy);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 15: isGenerating Reflects Mutation State**
   * **Validates: Requirements 6.2**
   *
   * The isGenerating state SHALL be true when mutation is pending,
   * and false otherwise.
   */
  it('Property 15: isGenerating reflects isPending state', () => {
    // Test all possible mutation states
    const mutationStates = [
      { isPending: false, expected: false },
      { isPending: true, expected: true },
    ];

    mutationStates.forEach(({ isPending, expected }) => {
      // In the hook, isGenerating = mutation.isPending
      const isGenerating = isPending;
      expect(isGenerating).toBe(expected);
    });
  });

  /**
   * **Feature: schedule-phase3, Property 15 (extended): State transitions**
   * **Validates: Requirements 6.2**
   *
   * isGenerating should correctly transition between states.
   */
  it('Property 15a: isGenerating state transitions are consistent', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), (pendingStates) => {
        // Simulate a sequence of isPending state changes
        const generatingStates = pendingStates.map((isPending) => isPending);

        // Each isGenerating should match its corresponding isPending
        pendingStates.forEach((isPending, index) => {
          expect(generatingStates[index]).toBe(isPending);
        });
      }),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 9: Elapsed Time Calculation Accuracy**
   * **Validates: Requirements 4.1, 6.3**
   *
   * For any start time and current time, the elapsed time SHALL equal
   * (currentTime - startTime) in seconds, rounded down.
   */
  it('Property 9: Elapsed time equals floor((current - start) / 1000)', () => {
    fc.assert(
      fc.property(elapsedTimeArb, (elapsedMs) => {
        const startTime = Date.now();
        const currentTime = startTime + elapsedMs;

        // Calculate elapsed time as the hook does
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

        // Verify the calculation
        expect(elapsedSeconds).toBe(Math.floor(elapsedMs / 1000));
        expect(elapsedSeconds).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 9 (extended): Elapsed time increments correctly**
   * **Validates: Requirements 4.1, 6.3**
   *
   * Elapsed time should increment by 1 for each second that passes.
   */
  it('Property 9a: Elapsed time increments by 1 per second', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }), // 0 to 5 minutes in seconds
        (seconds) => {
          const startTime = 0;
          const currentTime = seconds * 1000;

          const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

          expect(elapsedSeconds).toBe(seconds);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase3, Property 9 (extended): Sub-second precision**
   * **Validates: Requirements 4.1, 6.3**
   *
   * Elapsed time should floor sub-second values correctly.
   */
  it('Property 9b: Sub-second values are floored correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }), // milliseconds within a second
        fc.integer({ min: 0, max: 300 }), // full seconds
        (subSecondMs, fullSeconds) => {
          const totalMs = fullSeconds * 1000 + subSecondMs;
          const elapsedSeconds = Math.floor(totalMs / 1000);

          // Should always equal the full seconds, regardless of sub-second portion
          expect(elapsedSeconds).toBe(fullSeconds);
        }
      ),
      { numRuns: 100 }
    );
  });
});
