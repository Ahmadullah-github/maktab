/**
 * Hook for auto-saving schedule changes to localStorage
 *
 * Automatically backs up schedule edits to localStorage every 30 seconds
 * to prevent data loss in case of browser crash or accidental navigation.
 *
 * Phase 7: Task 7.2
 * Requirements: 7.1, 7.2, 7.3
 */

import { useEffect, useRef } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import { logger } from '../utils/logger';
import { ScheduleStorage } from '../utils/scheduleStorage';

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Hook for auto-saving schedule changes to localStorage
 *
 * Features:
 * - Saves every 30 seconds when changes exist (Requirement: 7.1)
 * - Immediate save on first change (Requirement: 7.2)
 * - Cleans up interval on unmount (Requirement: 7.3)
 * - No saves when no changes
 * - Only active when schedule is loaded
 *
 * @example
 * ```tsx
 * function ScheduleView() {
 *   useAutoSave(); // Automatically backs up changes
 *   // ...
 * }
 * ```
 */
export function useAutoSave(): void {
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const lessons = useScheduleStore((state) => state.lessons);
  const hasUnsavedChanges = useScheduleStore((state) => state.undoStack.length > 0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(0);

  useEffect(() => {
    // Don't auto-save if no schedule loaded or no changes
    if (!scheduleId || !hasUnsavedChanges) {
      // Clear interval if it exists
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Save immediately on first change (Requirement: 7.2)
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveRef.current;

    if (timeSinceLastSave > AUTO_SAVE_INTERVAL || lastSaveRef.current === 0) {
      ScheduleStorage.save(scheduleId, lessons);
      lastSaveRef.current = now;
      logger.debug('Auto-saved schedule to localStorage', { scheduleId });
    }

    // Set up interval for subsequent saves (Requirement: 7.1)
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (hasUnsavedChanges) {
          ScheduleStorage.save(scheduleId, lessons);
          lastSaveRef.current = Date.now();
          logger.debug('Auto-saved schedule to localStorage (interval)', { scheduleId });
        }
      }, AUTO_SAVE_INTERVAL);
    }

    // Cleanup interval on unmount (Requirement: 7.3)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scheduleId, lessons, hasUnsavedChanges]);
}
