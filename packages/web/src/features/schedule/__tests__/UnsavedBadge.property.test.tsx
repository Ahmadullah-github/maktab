/**
 * Property tests for UnsavedBadge component
 *
 * **Property 8: Badge Visibility**
 * For any unsaved changes count, the UnsavedBadge should be hidden when
 * count is 0 and visible with the correct count otherwise.
 *
 * **Validates: Requirements 12.1, 12.3**
 */

import { cleanup, render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { afterEach, describe, expect, it } from 'vitest';

import { UnsavedBadge } from '../components/edit/UnsavedBadge';

describe('UnsavedBadge Property Tests', () => {
  // Clean up after each test to prevent DOM pollution
  afterEach(() => {
    cleanup();
  });

  describe('Property 8: Badge Visibility', () => {
    // **Feature: schedule-phase8, Property 8: Badge Visibility**
    // **Validates: Requirements 12.1, 12.3**

    it('badge is hidden when count is 0 (Requirement: 12.3)', () => {
      fc.assert(
        fc.property(fc.constant(0), (count) => {
          cleanup(); // Clean up before each property run
          const { container } = render(<UnsavedBadge count={count} />);

          // Badge should not be rendered
          expect(container.firstChild).toBeNull();
        }),
        { numRuns: 1 } // Only need to test once for count=0
      );
    });

    it('badge is visible when count is greater than 0 (Requirement: 12.1)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
          cleanup(); // Clean up before each property run
          const { container } = render(<UnsavedBadge count={count} />);

          // Badge should be rendered
          expect(container.firstChild).not.toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('badge displays correct count for values 1-99 (Requirement: 12.1)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 99 }), (count) => {
          cleanup(); // Clean up before each property run
          render(<UnsavedBadge count={count} />);

          // Badge should display the exact count
          expect(screen.getByText(count.toString())).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('badge displays "99+" for values greater than 99 (Requirement: 12.1)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 100, max: 10000 }), (count) => {
          cleanup(); // Clean up before each property run
          render(<UnsavedBadge count={count} />);

          // Badge should display "99+" for large counts
          expect(screen.getByText('99+')).toBeInTheDocument();
        }),
        { numRuns: 100 }
      );
    });

    it('badge has correct aria-label for accessibility', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          cleanup(); // Clean up before each property run
          render(<UnsavedBadge count={count} />);

          // Badge should have aria-label with count
          const badge = screen.getByLabelText(`${count} تغییر ذخیره نشده`);
          expect(badge).toBeInTheDocument();
        }),
        { numRuns: 50 }
      );
    });
  });
});
