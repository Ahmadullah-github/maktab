/**
 * Schedule Storage Utility
 *
 * Provides localStorage backup for schedule edits to prevent data loss.
 * Automatically expires after 24 hours.
 *
 * Phase 7: Task 7.1
 */

import type { ScheduledLesson } from '../types';
import { logger } from './logger';

const STORAGE_KEY_PREFIX = 'maktab_schedule_';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Stored schedule state structure
 */
export interface StoredScheduleState {
  scheduleId: number;
  lessons: ScheduledLesson[];
  timestamp: number;
}

/**
 * Schedule Storage Manager
 *
 * Handles localStorage backup for schedule edits with:
 * - Automatic 24-hour expiration
 * - Error handling for quota exceeded
 * - Type-safe storage and retrieval
 */
export class ScheduleStorage {
  /**
   * Save schedule state to localStorage
   *
   * @param scheduleId - Schedule ID
   * @param lessons - Current lessons array
   */
  static save(scheduleId: number, lessons: ScheduledLesson[]): void {
    try {
      const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
      const state: StoredScheduleState = {
        scheduleId,
        lessons,
        timestamp: Date.now(),
      };

      localStorage.setItem(key, JSON.stringify(state));
      logger.debug('Saved schedule to localStorage', { scheduleId, lessonCount: lessons.length });
    } catch (error) {
      // Handle quota exceeded or other localStorage errors
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        logger.warn('localStorage quota exceeded, clearing old data');
        this.clearOldEntries();

        // Try again after clearing
        try {
          const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
          const state: StoredScheduleState = {
            scheduleId,
            lessons,
            timestamp: Date.now(),
          };
          localStorage.setItem(key, JSON.stringify(state));
        } catch (retryError) {
          logger.error('Failed to save to localStorage after clearing', { error: retryError });
        }
      } else {
        logger.error('Failed to save to localStorage', { error });
      }
    }
  }

  /**
   * Load schedule state from localStorage
   *
   * @param scheduleId - Schedule ID
   * @returns Stored state or null if not found/expired
   */
  static load(scheduleId: number): StoredScheduleState | null {
    try {
      const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
      const stored = localStorage.getItem(key);

      if (!stored) {
        return null;
      }

      const state: StoredScheduleState = JSON.parse(stored);

      // Check if stored data is less than 24 hours old
      const age = Date.now() - state.timestamp;

      if (age > MAX_AGE_MS) {
        logger.debug('Stored schedule expired, clearing', {
          scheduleId,
          ageHours: age / (60 * 60 * 1000),
        });
        this.clear(scheduleId);
        return null;
      }

      logger.debug('Loaded schedule from localStorage', {
        scheduleId,
        lessonCount: state.lessons.length,
      });
      return state;
    } catch (error) {
      logger.error('Failed to load from localStorage', { error });
      return null;
    }
  }

  /**
   * Clear stored state for a specific schedule
   *
   * @param scheduleId - Schedule ID
   */
  static clear(scheduleId: number): void {
    try {
      const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
      localStorage.removeItem(key);
      logger.debug('Cleared schedule from localStorage', { scheduleId });
    } catch (error) {
      logger.error('Failed to clear localStorage', { error });
    }
  }

  /**
   * Check if there's unsaved data in localStorage
   *
   * @param scheduleId - Schedule ID
   * @returns True if unsaved data exists
   */
  static hasUnsavedData(scheduleId: number): boolean {
    const stored = this.load(scheduleId);
    return stored !== null;
  }

  /**
   * Clear all old entries (older than 24 hours)
   * Used when quota is exceeded
   */
  private static clearOldEntries(): void {
    try {
      const keysToRemove: string[] = [];

      // Find all schedule storage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              const state: StoredScheduleState = JSON.parse(stored);
              const age = Date.now() - state.timestamp;

              if (age > MAX_AGE_MS) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // Invalid JSON, remove it
            keysToRemove.push(key);
          }
        }
      }

      // Remove old entries
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      logger.info('Cleared old localStorage entries', { count: keysToRemove.length });
    } catch (error) {
      logger.error('Failed to clear old entries', { error });
    }
  }

  /**
   * Get all stored schedule IDs
   * Useful for debugging or cleanup
   *
   * @returns Array of schedule IDs with stored data
   */
  static getAllStoredScheduleIds(): number[] {
    const scheduleIds: number[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          const scheduleId = parseInt(key.replace(STORAGE_KEY_PREFIX, ''), 10);
          if (!isNaN(scheduleId)) {
            scheduleIds.push(scheduleId);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to get stored schedule IDs', { error });
    }

    return scheduleIds;
  }
}
