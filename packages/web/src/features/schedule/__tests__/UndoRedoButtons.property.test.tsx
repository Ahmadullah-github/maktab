/**
 * Property tests for UndoRedoButtons component
 *
 * **Property 7: Button Disabled States**
 * For any canUndo and canRedo values, the undo button should be disabled
 * when !canUndo and the redo button should be disabled when !canRedo.
 *
 * **Validates: Requirements 10.3, 10.4**
 */

import { cleanup, render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';

import { UndoRedoButtons } from '../components/edit/UndoRedoButtons';
import { getCanRedo, getCanUndo, useScheduleStore } from '../stores/scheduleStore';

// Mock the schedule store
vi.mock('../stores/scheduleStore', () => ({
  useScheduleStore: vi.fn(),
  getCanUndo: vi.fn(),
  getCanRedo: vi.fn(),
}));

// Wrapper component with TooltipProvider
function TestWrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

describe('UndoRedoButtons Property Tests', () => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const setupMockStore = (canUndo: boolean, canRedo: boolean) => {
    (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: unknown) => {
        if (selector === getCanUndo) return canUndo;
        if (selector === getCanRedo) return canRedo;
        // Handle function selectors for undo/redo actions and counts
        if (typeof selector === 'function') {
          const mockState = {
            undo: mockUndo,
            redo: mockRedo,
            undoStack: canUndo ? [{}] : [],
            redoStack: canRedo ? [{}] : [],
          };
          return selector(mockState);
        }
        return undefined;
      }
    );
  };

  describe('Property 7: Button Disabled States', () => {
    // **Feature: schedule-phase8, Property 7: Button Disabled States**
    // **Validates: Requirements 10.3, 10.4**

    it('undo button is disabled when canUndo is false (Requirement: 10.3)', () => {
      fc.assert(
        fc.property(fc.boolean(), (canRedo) => {
          cleanup();
          setupMockStore(false, canRedo);
          render(<UndoRedoButtons />, { wrapper: TestWrapper });

          const undoButton = screen.getByRole('button', { name: /بازگشت/i });
          expect(undoButton).toBeDisabled();
        }),
        { numRuns: 10 }
      );
    });

    it('undo button is enabled when canUndo is true (Requirement: 10.3)', () => {
      fc.assert(
        fc.property(fc.boolean(), (canRedo) => {
          cleanup();
          setupMockStore(true, canRedo);
          render(<UndoRedoButtons />, { wrapper: TestWrapper });

          const undoButton = screen.getByRole('button', { name: /بازگشت/i });
          expect(undoButton).not.toBeDisabled();
        }),
        { numRuns: 10 }
      );
    });

    it('redo button is disabled when canRedo is false (Requirement: 10.4)', () => {
      fc.assert(
        fc.property(fc.boolean(), (canUndo) => {
          cleanup();
          setupMockStore(canUndo, false);
          render(<UndoRedoButtons />, { wrapper: TestWrapper });

          const redoButton = screen.getByRole('button', { name: /انجام مجدد/i });
          expect(redoButton).toBeDisabled();
        }),
        { numRuns: 10 }
      );
    });

    it('redo button is enabled when canRedo is true (Requirement: 10.4)', () => {
      fc.assert(
        fc.property(fc.boolean(), (canUndo) => {
          cleanup();
          setupMockStore(canUndo, true);
          render(<UndoRedoButtons />, { wrapper: TestWrapper });

          const redoButton = screen.getByRole('button', { name: /انجام مجدد/i });
          expect(redoButton).not.toBeDisabled();
        }),
        { numRuns: 10 }
      );
    });

    it('button states are independent of each other', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (canUndo, canRedo) => {
          cleanup();
          setupMockStore(canUndo, canRedo);
          render(<UndoRedoButtons />, { wrapper: TestWrapper });

          const undoButton = screen.getByRole('button', { name: /بازگشت/i });
          const redoButton = screen.getByRole('button', { name: /انجام مجدد/i });

          // Undo button state depends only on canUndo
          if (canUndo) {
            expect(undoButton).not.toBeDisabled();
          } else {
            expect(undoButton).toBeDisabled();
          }

          // Redo button state depends only on canRedo
          if (canRedo) {
            expect(redoButton).not.toBeDisabled();
          } else {
            expect(redoButton).toBeDisabled();
          }
        }),
        { numRuns: 20 }
      );
    });
  });
});
