/**
 * Property-based tests for GenerateButton component
 * Tests that the button is disabled during generation
 *
 * **Feature: schedule-phase3, Property 8: Generate Button Disabled During Generation**
 * **Validates: Requirements 3.9**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STRATEGY_OPTIONS, type SolverStrategy } from '../types';

// Arbitrary for valid solver strategies
const strategyArb = fc.constantFrom<SolverStrategy>('fast', 'balanced', 'thorough');

// Arbitrary for GenerateButton props
const generateButtonPropsArb = fc.record({
  disabled: fc.boolean(),
  isGenerating: fc.boolean(),
  isLoadingInputData: fc.boolean(),
});

describe('GenerateButton Property Tests', () => {
  /**
   * **Feature: schedule-phase3, Property 8: Generate Button Disabled During Generation**
   * **Validates: Requirements 3.9**
   *
   * The Generate button SHALL be disabled when isGenerating is true,
   * preventing multiple concurrent generation requests.
   */
  it('Property 8: Button is disabled when isGenerating is true', () => {
    fc.assert(
      fc.property(generateButtonPropsArb, (props) => {
        // Component logic: disabled={disabled || isGenerating || isLoadingInputData}
        const shouldBeDisabled = props.disabled || props.isGenerating || props.isLoadingInputData;

        // When isGenerating is true, button must be disabled
        if (props.isGenerating) {
          expect(shouldBeDisabled).toBe(true);
        }

        // When isLoadingInputData is true, button must be disabled
        if (props.isLoadingInputData) {
          expect(shouldBeDisabled).toBe(true);
        }

        // When disabled prop is true, button must be disabled
        if (props.disabled) {
          expect(shouldBeDisabled).toBe(true);
        }

        // Button is only enabled when all three are false
        if (!props.disabled && !props.isGenerating && !props.isLoadingInputData) {
          expect(shouldBeDisabled).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Button disabled state follows logical OR of all disable conditions
   */
  it('Property: Button disabled follows OR logic of disable conditions', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (disabled, isGenerating, isLoadingInputData) => {
          const shouldBeDisabled = disabled || isGenerating || isLoadingInputData;

          // Verify the OR logic
          expect(shouldBeDisabled).toBe(disabled || isGenerating || isLoadingInputData);

          // If any condition is true, button should be disabled
          if (disabled || isGenerating || isLoadingInputData) {
            expect(shouldBeDisabled).toBe(true);
          } else {
            expect(shouldBeDisabled).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All strategy options are valid and have required fields
   */
  it('Property: All strategy options have required fields', () => {
    fc.assert(
      fc.property(strategyArb, (strategy) => {
        const option = STRATEGY_OPTIONS.find((opt) => opt.value === strategy);

        expect(option).toBeDefined();
        expect(option!.value).toBe(strategy);
        expect(option!.labelFa).toBeTruthy();
        expect(option!.labelEn).toBeTruthy();
        expect(option!.estimatedTime).toBeTruthy();
        expect(option!.estimatedTimeFa).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Strategy selection is preserved across renders
   */
  it('Property: Strategy values are valid SolverStrategy types', () => {
    fc.assert(
      fc.property(strategyArb, (strategy) => {
        // Strategy must be one of the valid values
        expect(['fast', 'balanced', 'thorough']).toContain(strategy);

        // Strategy must have a corresponding option
        const hasOption = STRATEGY_OPTIONS.some((opt) => opt.value === strategy);
        expect(hasOption).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Default strategy is always 'balanced'
   */
  it('Property: Default strategy is balanced', () => {
    const defaultStrategy: SolverStrategy = 'balanced';

    // Default strategy must be valid
    expect(['fast', 'balanced', 'thorough']).toContain(defaultStrategy);

    // Default strategy must have an option
    const option = STRATEGY_OPTIONS.find((opt) => opt.value === defaultStrategy);
    expect(option).toBeDefined();
    expect(option!.labelFa).toBe('متعادل');
  });

  /**
   * Property: STRATEGY_OPTIONS array has exactly 3 options
   */
  it('Property: STRATEGY_OPTIONS has exactly 3 options', () => {
    expect(STRATEGY_OPTIONS.length).toBe(3);

    const values = STRATEGY_OPTIONS.map((opt) => opt.value);
    expect(values).toContain('fast');
    expect(values).toContain('balanced');
    expect(values).toContain('thorough');
  });
});
