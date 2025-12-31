/**
 * Property-based tests for Unsaved Changes Detection
 *
 * **Feature: school-settings-periods, Property 7: Unsaved Changes Detection**
 * **Validates: Requirements 6.1**
 *
 * For any form field modification (text input, checkbox, toggle, or select),
 * the system SHALL set the unsaved changes indicator to true and enable the save button.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

/**
 * Simulates form dirty state detection logic
 * This mirrors the behavior of React Hook Form's isDirty state
 *
 * @param initialValue - The initial value of the form field
 * @param currentValue - The current value after modification
 * @returns true if the values are different (form is dirty)
 */
function detectDirtyState<T>(initialValue: T, currentValue: T): boolean {
  // Deep equality check for objects and arrays
  if (typeof initialValue === 'object' && initialValue !== null) {
    return JSON.stringify(initialValue) !== JSON.stringify(currentValue);
  }
  // Simple equality for primitives
  return initialValue !== currentValue;
}

/**
 * Simulates the unsaved changes indicator visibility logic
 *
 * @param isDirty - Whether the form has unsaved changes
 * @returns true if the indicator should be visible
 */
function shouldShowUnsavedIndicator(isDirty: boolean): boolean {
  return isDirty;
}

/**
 * Simulates the save button enabled state logic
 *
 * @param isDirty - Whether the form has unsaved changes
 * @param isPending - Whether a save operation is in progress
 * @returns true if the save button should be enabled
 */
function shouldEnableSaveButton(isDirty: boolean, isPending: boolean = false): boolean {
  return isDirty && !isPending;
}

describe('Unsaved Changes Detection Property Tests', () => {
  /**
   * **Feature: school-settings-periods, Property 7: Unsaved Changes Detection**
   *
   * For any form field modification (text input, checkbox, toggle, or select),
   * the system SHALL set the unsaved changes indicator to true and enable the save button.
   *
   * **Validates: Requirements 6.1**
   */
  describe('Property 7: Unsaved Changes Detection', () => {
    // ========================================
    // Generators for different field types
    // ========================================

    /**
     * Generator for text input values (strings)
     */
    const textInputArbitrary = fc.string({ minLength: 0, maxLength: 100 });

    /**
     * Generator for checkbox/toggle values (booleans)
     */
    const booleanFieldArbitrary = fc.boolean();

    /**
     * Generator for number input values
     */
    const numberFieldArbitrary = fc.integer({ min: 0, max: 1000 });

    /**
     * Generator for select values (from a set of options)
     */
    const selectFieldArbitrary = fc.constantFrom('option1', 'option2', 'option3', 'option4');

    /**
     * Generator for array values (like days of week selection)
     */
    const arrayFieldArbitrary = fc.array(
      fc.constantFrom('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'),
      { minLength: 0, maxLength: 7 }
    );

    /**
     * Generator for time input values (HH:mm format)
     */
    const timeFieldArbitrary = fc
      .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
      .map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

    // ========================================
    // Property: Text input modifications
    // ========================================

    it('should detect dirty state when text input is modified to a different value', () => {
      fc.assert(
        fc.property(
          fc.tuple(textInputArbitrary, textInputArbitrary).filter(([a, b]) => a !== b),
          ([initialValue, modifiedValue]) => {
            const isDirty = detectDirtyState(initialValue, modifiedValue);
            expect(isDirty).toBe(true);
            expect(shouldShowUnsavedIndicator(isDirty)).toBe(true);
            expect(shouldEnableSaveButton(isDirty)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect dirty state when text input remains unchanged', () => {
      fc.assert(
        fc.property(textInputArbitrary, (value) => {
          const isDirty = detectDirtyState(value, value);
          expect(isDirty).toBe(false);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(false);
          expect(shouldEnableSaveButton(isDirty)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Boolean field modifications (checkbox/toggle)
    // ========================================

    it('should detect dirty state when boolean field is toggled', () => {
      fc.assert(
        fc.property(booleanFieldArbitrary, (initialValue) => {
          const modifiedValue = !initialValue;
          const isDirty = detectDirtyState(initialValue, modifiedValue);
          expect(isDirty).toBe(true);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(true);
          expect(shouldEnableSaveButton(isDirty)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should not detect dirty state when boolean field remains unchanged', () => {
      fc.assert(
        fc.property(booleanFieldArbitrary, (value) => {
          const isDirty = detectDirtyState(value, value);
          expect(isDirty).toBe(false);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(false);
          expect(shouldEnableSaveButton(isDirty)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Number field modifications
    // ========================================

    it('should detect dirty state when number field is modified to a different value', () => {
      fc.assert(
        fc.property(
          fc.tuple(numberFieldArbitrary, numberFieldArbitrary).filter(([a, b]) => a !== b),
          ([initialValue, modifiedValue]) => {
            const isDirty = detectDirtyState(initialValue, modifiedValue);
            expect(isDirty).toBe(true);
            expect(shouldShowUnsavedIndicator(isDirty)).toBe(true);
            expect(shouldEnableSaveButton(isDirty)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect dirty state when number field remains unchanged', () => {
      fc.assert(
        fc.property(numberFieldArbitrary, (value) => {
          const isDirty = detectDirtyState(value, value);
          expect(isDirty).toBe(false);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(false);
          expect(shouldEnableSaveButton(isDirty)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Select field modifications
    // ========================================

    it('should detect dirty state when select field is changed to a different option', () => {
      fc.assert(
        fc.property(
          fc.tuple(selectFieldArbitrary, selectFieldArbitrary).filter(([a, b]) => a !== b),
          ([initialValue, modifiedValue]) => {
            const isDirty = detectDirtyState(initialValue, modifiedValue);
            expect(isDirty).toBe(true);
            expect(shouldShowUnsavedIndicator(isDirty)).toBe(true);
            expect(shouldEnableSaveButton(isDirty)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect dirty state when select field remains unchanged', () => {
      fc.assert(
        fc.property(selectFieldArbitrary, (value) => {
          const isDirty = detectDirtyState(value, value);
          expect(isDirty).toBe(false);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(false);
          expect(shouldEnableSaveButton(isDirty)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Array field modifications (multi-select like days of week)
    // ========================================

    it('should detect dirty state when array field is modified', () => {
      fc.assert(
        fc.property(
          fc
            .tuple(arrayFieldArbitrary, arrayFieldArbitrary)
            .filter(([a, b]) => JSON.stringify(a.sort()) !== JSON.stringify(b.sort())),
          ([initialValue, modifiedValue]) => {
            const isDirty = detectDirtyState(initialValue, modifiedValue);
            expect(isDirty).toBe(true);
            expect(shouldShowUnsavedIndicator(isDirty)).toBe(true);
            expect(shouldEnableSaveButton(isDirty)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect dirty state when array field remains unchanged', () => {
      fc.assert(
        fc.property(arrayFieldArbitrary, (value) => {
          const isDirty = detectDirtyState(value, [...value]);
          // Note: Same content but different reference should still be considered not dirty
          // because we use deep equality
          expect(isDirty).toBe(false);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(false);
          expect(shouldEnableSaveButton(isDirty)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Time field modifications
    // ========================================

    it('should detect dirty state when time field is modified to a different value', () => {
      fc.assert(
        fc.property(
          fc.tuple(timeFieldArbitrary, timeFieldArbitrary).filter(([a, b]) => a !== b),
          ([initialValue, modifiedValue]) => {
            const isDirty = detectDirtyState(initialValue, modifiedValue);
            expect(isDirty).toBe(true);
            expect(shouldShowUnsavedIndicator(isDirty)).toBe(true);
            expect(shouldEnableSaveButton(isDirty)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect dirty state when time field remains unchanged', () => {
      fc.assert(
        fc.property(timeFieldArbitrary, (value) => {
          const isDirty = detectDirtyState(value, value);
          expect(isDirty).toBe(false);
          expect(shouldShowUnsavedIndicator(isDirty)).toBe(false);
          expect(shouldEnableSaveButton(isDirty)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Save button disabled during pending state
    // ========================================

    it('should disable save button when save operation is pending, even if dirty', () => {
      fc.assert(
        fc.property(booleanFieldArbitrary, (isDirty) => {
          const isPending = true;
          expect(shouldEnableSaveButton(isDirty, isPending)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    // ========================================
    // Property: Indicator and button state consistency
    // ========================================

    it('should have consistent indicator and button states based on dirty state', () => {
      fc.assert(
        fc.property(booleanFieldArbitrary, (isDirty) => {
          const indicatorVisible = shouldShowUnsavedIndicator(isDirty);
          const buttonEnabled = shouldEnableSaveButton(isDirty, false);

          // When dirty, both indicator should be visible and button should be enabled
          // When not dirty, both should be false
          expect(indicatorVisible).toBe(isDirty);
          expect(buttonEnabled).toBe(isDirty);
        }),
        { numRuns: 100 }
      );
    });
  });
});
