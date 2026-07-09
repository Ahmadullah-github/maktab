/**
 * Hook for cell selection in the schedule grid
 *
 * Handles:
 * - Enter/Space key on focused cell to select lesson
 * - Click on cell with lesson to select
 * - Escape to cancel selection
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { useCallback, useEffect, type RefObject } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type { DayOfWeek, FocusedSlot, ScheduledLesson } from '../types';

/**
 * Options for the useCellSelection hook
 */
export interface UseCellSelectionOptions {
  /** Reference to the grid container element for keyboard events */
  gridRef: RefObject<HTMLElement | null>;
  /** Callback when a swap operation is initiated (Phase 7) */
  onSwapInitiated?: (source: ScheduledLesson, target: FocusedSlot) => void;
  /** Optional grid-owned slot action handler for keyboard activation */
  onCellActionRequested?: (slot: FocusedSlot) => void;
}

/**
 * Return type for the useCellSelection hook
 */
export interface UseCellSelectionReturn {
  /**
   * Handle cell action (click or Enter/Space on focused cell)
   * @param day - Day of the cell
   * @param period - Period index of the cell
   * @param lesson - Lesson in the cell (null if empty)
   */
  handleCellAction: (day: DayOfWeek, period: number, lesson: ScheduledLesson | null) => void;
  /** Handle Escape key to cancel selection */
  handleEscape: () => void;
}

/**
 * Check if a key is Enter or Space
 */
export function isSelectionKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}

/**
 * Check if a key is Escape
 */
export function isEscapeKey(key: string): boolean {
  return key === 'Escape';
}

/**
 * Hook for cell selection in the schedule grid
 *
 * Manages lesson selection through keyboard (Enter/Space) and mouse (click).
 * Handles Escape to cancel selection.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.5
 *
 * @param options - Selection configuration
 * @returns Object with handleCellAction and handleEscape functions
 */
export function useCellSelection(options: UseCellSelectionOptions): UseCellSelectionReturn {
  const { gridRef, onSwapInitiated, onCellActionRequested } = options;

  // Get store state and actions
  const focusedSlot = useScheduleStore((state) => state.focusedSlot);
  const selectedLesson = useScheduleStore((state) => state.selectedLesson);
  const isLocked = useScheduleStore((state) => state.isLocked);
  const indexes = useScheduleStore((state) => state.indexes);
  const selectLesson = useScheduleStore((state) => state.selectLesson);
  const cancelSelection = useScheduleStore((state) => state.cancelSelection);

  /**
   * Get lesson at a specific slot from indexes
   */
  const getLessonAtSlot = useCallback(
    (day: DayOfWeek, period: number): ScheduledLesson | null => {
      const slotKey = `${day}-${period}`;
      const lessons = indexes.bySlot.get(slotKey);
      return lessons && lessons.length > 0 ? lessons[0] : null;
    },
    [indexes]
  );

  /**
   * Handle cell action (click or Enter/Space on focused cell)
   * Requirements: 3.1, 3.2, 3.5
   */
  const handleCellAction = useCallback(
    (day: DayOfWeek, period: number, lesson: ScheduledLesson | null) => {
      // Ignore if locked
      if (isLocked) {
        return;
      }

      // If there's already a selected lesson and we're clicking on a different slot,
      // initiate the swap flow even when the target cell is empty.
      if (selectedLesson !== null && onSwapInitiated) {
        const isSameSlot = selectedLesson.day === day && selectedLesson.periodIndex === period;
        if (!isSameSlot) {
          onSwapInitiated(selectedLesson, { day, period });
          return;
        }
      }

      // If cell has no lesson and there is no active selection, do nothing.
      if (lesson === null) {
        return;
      }

      // Select the lesson (Requirement 3.1, 3.2, 3.5)
      selectLesson(lesson);
    },
    [isLocked, selectedLesson, selectLesson, onSwapInitiated]
  );

  /**
   * Handle Escape key to cancel selection
   * Requirement: 3.3
   */
  const handleEscape = useCallback(() => {
    cancelSelection();
  }, [cancelSelection]);

  /**
   * Handle keydown events for selection
   * Memoized to prevent frequent event listener updates
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle Escape key (Requirement 3.3)
      if (isEscapeKey(event.key)) {
        event.preventDefault();
        handleEscape();
        return;
      }

      // Handle Enter/Space on focused cell (Requirement 3.1)
      if (isSelectionKey(event.key)) {
        // Ignore if locked
        if (isLocked) {
          return;
        }

        // Need a focused slot to select
        if (focusedSlot === null) {
          return;
        }

        event.preventDefault();

        if (onCellActionRequested) {
          onCellActionRequested(focusedSlot);
          return;
        }

        // Get lesson at focused slot
        const lesson = getLessonAtSlot(focusedSlot.day, focusedSlot.period);

        // Handle the cell action
        handleCellAction(focusedSlot.day, focusedSlot.period, lesson);
      }
    },
    [
      focusedSlot,
      isLocked,
      getLessonAtSlot,
      handleCellAction,
      handleEscape,
      onCellActionRequested,
    ]
  );

  /**
   * Attach keydown listener to the grid container
   * Uses stable reference to prevent frequent re-renders
   */
  useEffect(() => {
    const gridElement = gridRef.current;
    if (!gridElement) {
      return;
    }

    // Add event listener
    gridElement.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      gridElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]); // Only re-attach when handleKeyDown reference changes

  return { handleCellAction, handleEscape };
}
