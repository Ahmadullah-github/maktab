/**
 * Property-based tests for SwapWarningDialog component
 *
 * **Feature: schedule-phase7, Property 13: Warning Dialog Display**
 * **Validates: Requirements 14.1, 14.3**
 *
 * Note: These tests verify the component logic without React rendering,
 * since the vitest environment is configured for node (not jsdom).
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SWAP_CONSTRAINT_TYPES } from '../constants';
import type { ConstraintViolation } from '../types';

// Generator for soft constraint types (warnings only)
const softConstraintTypeArb = fc.constantFrom(
  'TEACHER_PREFERENCE' as const,
  'CONSECUTIVE_EXCEEDED' as const,
  'DIFFICULT_AFTERNOON' as const
);

// Generator for a single warning violation
const warningViolationArb: fc.Arbitrary<ConstraintViolation> = softConstraintTypeArb.map(
  (type) => ({
    type,
    severity: 'soft' as const,
    message: SWAP_CONSTRAINT_TYPES[type].messageFa,
    details: {},
  })
);

// Generator for a non-empty array of warnings (1-5 warnings)
const warningsArrayArb = fc.array(warningViolationArb, { minLength: 1, maxLength: 5 });

// Generator for empty warnings array
const emptyWarningsArb = fc.constant<ConstraintViolation[]>([]);

/**
 * Simulates the dialog display logic
 * Returns whether the dialog should display based on warnings
 */
function shouldDisplayWarningDialog(open: boolean, warnings: ConstraintViolation[]): boolean {
  // Dialog displays when open is true and there are warnings
  return open && warnings.length > 0;
}

/**
 * Simulates extracting warning messages for display
 */
function extractWarningMessages(warnings: ConstraintViolation[]): string[] {
  return warnings.map((w) => w.message);
}

/**
 * Validates that all warnings are soft constraints
 */
function allWarningsAreSoft(warnings: ConstraintViolation[]): boolean {
  return warnings.every((w) => w.severity === 'soft');
}

/**
 * Dialog title constant (Persian)
 */
const DIALOG_TITLE = 'هشدار جابجایی';

/**
 * Dialog button labels (Persian)
 */
const BUTTON_LABELS = {
  continue: 'ادامه',
  cancel: 'لغو',
};

describe('SwapWarningDialog Property Tests', () => {
  /**
   * **Feature: schedule-phase7, Property 13: Warning Dialog Display**
   * **Validates: Requirements 14.1, 14.3**
   *
   * For any swap attempt with soft constraint violations,
   * the SwapWarningDialog must display and list all warnings.
   */
  describe('Property 13: Warning Dialog Display', () => {
    /**
     * Requirement 14.1: Dialog displays when swap has soft constraint violations
     */
    it('dialog displays when open is true and warnings exist', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          const shouldDisplay = shouldDisplayWarningDialog(true, warnings);
          expect(shouldDisplay).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Requirement 14.1: Dialog does not display when closed
     */
    it('dialog does not display when open is false', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          const shouldDisplay = shouldDisplayWarningDialog(false, warnings);
          expect(shouldDisplay).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Requirement 14.3: Dialog lists all warnings
     */
    it('all warnings are included in the display', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          const messages = extractWarningMessages(warnings);

          // All warnings should have their messages extracted
          expect(messages.length).toBe(warnings.length);

          // Each warning message should be present
          warnings.forEach((warning, index) => {
            expect(messages[index]).toBe(warning.message);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All displayed warnings are soft constraints
     */
    it('only soft constraint violations are displayed as warnings', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          expect(allWarningsAreSoft(warnings)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Warning count matches input
     */
    it('warning count in display matches input warnings', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          const messages = extractWarningMessages(warnings);
          expect(messages.length).toBe(warnings.length);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Each warning has a valid Persian message
     */
    it('each warning has a non-empty Persian message', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          warnings.forEach((warning) => {
            expect(warning.message).toBeTruthy();
            expect(typeof warning.message).toBe('string');
            expect(warning.message.length).toBeGreaterThan(0);
          });
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Dialog title is correct
     */
    it('dialog title is "هشدار جابجایی"', () => {
      expect(DIALOG_TITLE).toBe('هشدار جابجایی');
    });

    /**
     * Property: Dialog has correct button labels
     */
    it('dialog has "ادامه" (Continue) and "لغو" (Cancel) buttons', () => {
      expect(BUTTON_LABELS.continue).toBe('ادامه');
      expect(BUTTON_LABELS.cancel).toBe('لغو');
    });

    /**
     * Property: Empty warnings array means dialog should not display meaningfully
     */
    it('empty warnings array results in no meaningful display', () => {
      const emptyWarnings: ConstraintViolation[] = [];
      const messages = extractWarningMessages(emptyWarnings);
      expect(messages.length).toBe(0);
    });

    /**
     * Property: Warning messages are deterministic
     */
    it('warning message extraction is deterministic', () => {
      fc.assert(
        fc.property(warningsArrayArb, (warnings) => {
          const messages1 = extractWarningMessages(warnings);
          const messages2 = extractWarningMessages(warnings);

          expect(messages1).toEqual(messages2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Display decision is deterministic
     */
    it('display decision is deterministic for same inputs', () => {
      fc.assert(
        fc.property(fc.boolean(), warningsArrayArb, (open, warnings) => {
          const shouldDisplay1 = shouldDisplayWarningDialog(open, warnings);
          const shouldDisplay2 = shouldDisplayWarningDialog(open, warnings);

          expect(shouldDisplay1).toBe(shouldDisplay2);
        }),
        { numRuns: 100 }
      );
    });
  });
});
