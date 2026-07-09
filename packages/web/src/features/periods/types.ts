/**
 * Types for the Period Structure feature module
 * Requirements: 9.1
 */

import type { WeekDay } from '../school-settings/constants/defaults';
import type { GradeCategoryKey } from './constants/defaults';

/**
 * Break period configuration
 * Defines a break after a specific period with duration
 */
export interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number; // minutes
}

/**
 * Map of day to break configuration overrides
 * Missing days inherit from the shared default break template.
 */
export type BreaksByDayMap = Partial<Record<WeekDay, BreakPeriodConfig[]>>;

/**
 * Prayer break configuration
 * Defines a prayer break with name, time, and duration
 */
export interface PrayerBreakConfig {
  name: string;
  time: string; // HH:mm format
  duration: number; // minutes
}

/**
 * Map of day to period count for dynamic periods
 */
export type PeriodsPerDayMap = Partial<Record<WeekDay, number>>;

/**
 * Map of grade category to day-period mapping for category-based periods
 */
export type CategoryPeriodsMap = Partial<Record<GradeCategoryKey, PeriodsPerDayMap>>;

/**
 * Form data for Period Structure page
 * Used with React Hook Form
 */
export interface PeriodStructureFormData {
  defaultPeriodsPerDay: number;
  periodDuration: number; // minutes
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: PeriodsPerDayMap;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: CategoryPeriodsMap;
  breaks: BreakPeriodConfig[];
  breaksByDay: BreaksByDayMap;
  prayerBreaksEnabled: boolean;
  prayerBreaks: PrayerBreakConfig[];
}

/**
 * API response for period structure
 * Matches the SchoolConfig entity structure
 */
export interface PeriodStructureResponse {
  id: number;
  schoolId: number | null;
  defaultPeriodsPerDay: number;
  periodsPerDay: number;
  periodDuration: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: PeriodsPerDayMap | null;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: CategoryPeriodsMap | null;
  breakPeriods: BreakPeriodConfig[];
  breakPeriodsByDay?: BreaksByDayMap | null;
  ramadanModeEnabled: boolean;
  prayerBreaks: PrayerBreakConfig[] | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for updating period structure
 */
export interface UpdatePeriodStructurePayload {
  defaultPeriodsPerDay?: number;
  periodDuration?: number;
  dynamicPeriodsEnabled?: boolean;
  periodsPerDayMapJson?: string;
  categoryPeriodsEnabled?: boolean;
  categoryPeriodsMapJson?: string;
  breakPeriods?: string;
  breakPeriodsByDayJson?: string;
  ramadanModeEnabled?: boolean;
  prayerBreaksJson?: string;
}

/**
 * Effective periods calculation result
 * Used to determine actual period count for a given day and category
 */
export interface EffectivePeriodsResult {
  periods: number;
  source: 'default' | 'dynamic' | 'category';
}
