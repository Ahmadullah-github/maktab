/**
 * Navigation utility functions for keyboard navigation in the schedule grid
 *
 * Implements RTL-aware navigation:
 * - ArrowLeft = forward (next day) in RTL
 * - ArrowRight = backward (previous day) in RTL
 * - ArrowUp = previous period
 * - ArrowDown = next period
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import type { DayOfWeek, FocusedSlot } from '../types';

/**
 * Arrow key types for navigation
 */
export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

/**
 * Navigation configuration
 */
export interface NavigationConfig {
  /** Ordered array of days in the schedule */
  days: DayOfWeek[];
  /** Number of periods per day (can be uniform or per-day) */
  periodsPerDay: number | Map<DayOfWeek, number>;
}

/**
 * Gets the number of periods for a specific day
 */
export function getPeriodsForDay(
  day: DayOfWeek,
  periodsPerDay: number | Map<DayOfWeek, number>
): number {
  if (typeof periodsPerDay === 'number') {
    return periodsPerDay;
  }
  return periodsPerDay.get(day) ?? 0;
}

/**
 * Gets the index of a day in the days array
 */
export function getDayIndex(day: DayOfWeek, days: DayOfWeek[]): number {
  return days.indexOf(day);
}

/**
 * Calculates the next slot based on arrow key navigation
 *
 * RTL-aware navigation:
 * - ArrowUp: same day, period - 1 (clamped to 0)
 * - ArrowDown: same day, period + 1 (clamped to max periods - 1)
 * - ArrowLeft: next day in array (RTL: left = forward)
 * - ArrowRight: previous day in array (RTL: right = backward)
 *
 * Boundary behavior: stops at boundaries without wrapping
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * @param currentSlot - The current focused slot
 * @param key - The arrow key pressed
 * @param config - Navigation configuration with days and periods
 * @returns The new focused slot after navigation
 */
export function getNextSlot(
  currentSlot: FocusedSlot,
  key: ArrowKey,
  config: NavigationConfig
): FocusedSlot {
  const { days, periodsPerDay } = config;
  const { day, period } = currentSlot;

  const currentDayIndex = getDayIndex(day, days);
  const maxPeriods = getPeriodsForDay(day, periodsPerDay);

  switch (key) {
    case 'ArrowUp': {
      // Move to previous period (period - 1), clamped to 0
      // Requirement: 1.1
      const newPeriod = Math.max(0, period - 1);
      return { day, period: newPeriod };
    }

    case 'ArrowDown': {
      // Move to next period (period + 1), clamped to max periods - 1
      // Requirement: 1.2
      const newPeriod = Math.min(maxPeriods - 1, period + 1);
      return { day, period: newPeriod };
    }

    case 'ArrowLeft': {
      // RTL: left = forward = next day
      // Requirement: 1.3
      const newDayIndex = Math.min(days.length - 1, currentDayIndex + 1);
      const newDay = days[newDayIndex];
      // Clamp period to the new day's max periods
      const newDayMaxPeriods = getPeriodsForDay(newDay, periodsPerDay);
      const newPeriod = Math.min(period, newDayMaxPeriods - 1);
      return { day: newDay, period: newPeriod };
    }

    case 'ArrowRight': {
      // RTL: right = backward = previous day
      // Requirement: 1.4
      const newDayIndex = Math.max(0, currentDayIndex - 1);
      const newDay = days[newDayIndex];
      // Clamp period to the new day's max periods
      const newDayMaxPeriods = getPeriodsForDay(newDay, periodsPerDay);
      const newPeriod = Math.min(period, newDayMaxPeriods - 1);
      return { day: newDay, period: newPeriod };
    }

    default:
      return currentSlot;
  }
}

/**
 * Checks if a key is a valid arrow key for navigation
 */
export function isArrowKey(key: string): key is ArrowKey {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
}

/**
 * Creates a cell ID from day and period
 * Format: "${day}-${period}"
 */
export function createCellId(day: DayOfWeek, period: number): string {
  return `${day}-${period}`;
}

/**
 * Parses a cell ID into day and period
 */
export function parseCellId(id: string): FocusedSlot | null {
  const parts = id.split('-');
  if (parts.length < 2) return null;

  // Day might contain hyphens, so join all but the last part
  const period = parseInt(parts[parts.length - 1], 10);
  const day = parts.slice(0, -1).join('-') as DayOfWeek;

  if (isNaN(period) || period < 0) return null;

  return { day, period };
}

/**
 * Gets the first slot in the grid (first day, period 0)
 * Used for initial focus when grid receives focus
 *
 * Requirement: 6.2
 */
export function getFirstSlot(days: DayOfWeek[]): FocusedSlot | null {
  if (days.length === 0) return null;
  return { day: days[0], period: 0 };
}
