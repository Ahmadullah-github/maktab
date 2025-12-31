/**
 * Property tests for UnsavedChangesDialog component
 *
 * **Property 9: Dialog Message Count**
 * For any unsaved changes count X, the UnsavedChangesDialog message
 * should contain the number X in the Persian message format.
 *
 * **Validates: Requirements 14.4**
 */

import { cleanup, render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UnsavedChangesDialog } from '../components/edit/UnsavedChangesDialog';

describe('UnsavedChangesDialog Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Property 9: Dialog Message Count', () => {
    // **Feature: schedule-phase8, Property 9: Dialog Message Count**
    // **Validates: Requirements 14.4**

    it('dialog message contains the correct count (Requirement: 14.4)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
          cleanup();
          render(
            <UnsavedChangesDialog
              open={true}
              onOpenChange={vi.fn()}
              count={count}
              onSaveAndLeave={vi.fn()}
              onLeaveWithoutSaving={vi.fn()}
              onCancel={vi.fn()}
            />
          );

          // The message should contain the count
          const description = screen.getByText(new RegExp(`شما ${count} تغییر ذخیره نشده دارید`));
          expect(description).toBeInTheDocument();
        }),
        { numRuns: 20 }
      );
    }, 10000);

    it('dialog shows correct title', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          cleanup();
          render(
            <UnsavedChangesDialog
              open={true}
              onOpenChange={vi.fn()}
              count={count}
              onSaveAndLeave={vi.fn()}
              onLeaveWithoutSaving={vi.fn()}
              onCancel={vi.fn()}
            />
          );

          expect(screen.getByText('تغییرات ذخیره نشده')).toBeInTheDocument();
        }),
        { numRuns: 10 }
      );
    });

    it('dialog shows all three buttons', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
          cleanup();
          render(
            <UnsavedChangesDialog
              open={true}
              onOpenChange={vi.fn()}
              count={count}
              onSaveAndLeave={vi.fn()}
              onLeaveWithoutSaving={vi.fn()}
              onCancel={vi.fn()}
            />
          );

          // Check for all three buttons
          expect(screen.getByRole('button', { name: /ذخیره و خروج/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /خروج بدون ذخیره/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /لغو/i })).toBeInTheDocument();
        }),
        { numRuns: 10 }
      );
    });

    it('dialog is not rendered when open is false', () => {
      cleanup();
      render(
        <UnsavedChangesDialog
          open={false}
          onOpenChange={vi.fn()}
          count={5}
          onSaveAndLeave={vi.fn()}
          onLeaveWithoutSaving={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Dialog content should not be visible
      expect(screen.queryByText('تغییرات ذخیره نشده')).not.toBeInTheDocument();
    });
  });
});
