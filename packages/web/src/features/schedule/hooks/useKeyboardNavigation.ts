/**
 * Hook for keyboard navigation in the schedule grid
 *
 * Implements RTL-aware navigation:
 * - ArrowLeft = forward (next day) in RTL
 * - ArrowRight = backward (previous day) in RTL
 * - ArrowUp = previous period
 * - ArrowDown = next period
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { useCallback, useEffect, type RefObject } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type { DayOfWeek } from '../types';
import {
  getFirstSlot,
  getNextSlot,
  isArrowKey,
} from '../utils/navigationUtils';

/**
 * Options for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationOptions {
  /** Ordered array of days in the schedule */
  days: DayOfWeek[];
  /** Number of periods per day (can be uniform or per-day) */
  periodsPerDay: number | Map<DayOfWeek, number>;
  /** Reference to the grid container element */
  gridRef: RefObject<HTMLElement | null>;
}

/**
 * Return type for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationReturn {
  /** Handler for keydown events */
  handleKeyDown: (event: KeyboardEvent) => void;
}

/**
 * Hook for keyboard navigation in the schedule grid
 *
 * Listens for arrow key events on the grid container and updates
 * the focused slot in the store accordingly.
 *
 * Respects the isLocked state - when locked, navigation is disabled.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 *
 * @param options - Navigation configuration
 * @returns Object with handleKeyDown function
 */
export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions
): UseKeyboardNavigationReturn {
  const { days, periodsPerDay, gridRef } = options;

  // Get store state and actions
  const focusedSlot = useScheduleStore((state) => state.focusedSlot);
  const isLocked = useScheduleStore((state) => state.isLocked);
  const setFocusedSlot = useScheduleStore((state) => state.setFocusedSlot);

  /**
   * Handle keydown events for navigation
   * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Requirement 1.6: Ignore navigation when locked
      if (isLocked) {
        return;
      }

      // Only handle arrow keys
      if (!isArrowKey(event.key)) {
        return;
      }

      // Prevent default scrolling behavior
      event.preventDefault();

      // If no slot is focused, focus the first slot
      // Requirement: 6.2 (initial focus behavior)
      if (focusedSlot === null) {
        const firstSlot = getFirstSlot(days);
        if (firstSlot) {
          setFocusedSlot(firstSlot);
        }
        return;
      }

      // Calculate the next slot based on the arrow key
      const nextSlot = getNextSlot(focusedSlot, event.key, { days, periodsPerDay });

      // Update the focused slot
      setFocusedSlot(nextSlot);
    },
    [focusedSlot, isLocked, days, periodsPerDay, setFocusedSlot]
  );

  /**
   * Attach keydown listener to the grid container
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
  }, [gridRef, handleKeyDown]);

  return { handleKeyDown };
}
