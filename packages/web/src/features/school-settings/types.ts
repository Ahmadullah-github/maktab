/**
 * Types for the School Settings feature module
 * Updated to match full SchoolConfig entity and Afghanistan features
 * Requirements: 9.1
 */

import type { ShiftMode, TimezoneValue, WeekDay } from './constants/defaults';
import type { MinistryValidationMode } from './schemas/schoolSettings.schema';

/**
 * Shift time configuration for morning/afternoon shifts
 */
export interface ShiftTimeConfig {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

/**
 * Multi-shift configuration with morning and afternoon times
 */
export interface ShiftsConfig {
  morning: ShiftTimeConfig;
  afternoon: ShiftTimeConfig;
}

/**
 * Break period configuration
 */
export interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number;
}

/**
 * Form data for School Settings page
 * Matches SchoolSettingsFormValues from schema
 */
export interface SchoolSettingsFormData {
  // School Identity
  schoolName?: string;

  // Academic Structure
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;

  // Days & Time
  daysOfWeek: WeekDay[];
  startTime: string;
  timezone: TimezoneValue;

  // Periods (basic - detailed config in /periods)
  periodsPerDay: number;

  // Shifts
  shiftMode: ShiftMode;
  shifts?: ShiftsConfig;

  // Afghanistan Features - Ramadan
  ramadanModeEnabled: boolean;
  ramadanPeriodDuration: number;

  // Afghanistan Features - Ministry Validation
  enableMinistryValidation: boolean;
  ministryValidationMode: MinistryValidationMode;
  customCurriculumMode: boolean;

  // Afghanistan Features - Low Resource
  lowResourceMode: boolean;
}

/**
 * API response for school settings
 * Matches the SchoolConfig entity structure
 */
export interface SchoolSettingsResponse {
  id: number;
  schoolId: number | null;
  schoolName: string | null;

  // Academic Structure
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;

  // Days & Time
  daysOfWeek: string[];
  daysOfWeekJson: string | null;
  daysPerWeek: number;
  schoolStartTime: string;
  timezone: string;

  // Periods
  periodsPerDay: number;
  defaultPeriodsPerDay: number;
  periodDuration: number;
  breakPeriods: string | null;

  // Shifts
  shiftMode: string;
  shiftsConfig: ShiftsConfig | null;
  shiftsConfigJson: string | null;

  // Afghanistan Features - Ramadan
  ramadanModeEnabled: boolean;
  ramadanPeriodDuration: number;
  ramadanBreakConfigJson: string | null;

  // Afghanistan Features - Ministry Validation
  enableMinistryValidation: boolean;
  ministryValidationMode: string;
  customCurriculumMode: boolean;

  // Afghanistan Features - Low Resource
  lowResourceMode: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for updating school settings
 */
export interface UpdateSchoolSettingsPayload {
  // School Identity
  schoolName?: string;

  // Academic Structure
  enablePrimary?: boolean;
  enableMiddle?: boolean;
  enableHigh?: boolean;

  // Days & Time
  daysOfWeekJson?: string;
  daysPerWeek?: number;
  schoolStartTime?: string;
  timezone?: string;

  // Periods
  defaultPeriodsPerDay?: number;
  periodsPerDay?: number;
  periodDuration?: number;
  breakPeriods?: string;

  // Dynamic periods
  dynamicPeriodsEnabled?: boolean;
  periodsPerDayMapJson?: string | null;

  // Category periods
  categoryPeriodsEnabled?: boolean;
  categoryPeriodsMapJson?: string | null;

  // Shifts
  shiftMode?: string;
  shiftsConfigJson?: string | null;

  // Afghanistan Features - Ramadan
  ramadanModeEnabled?: boolean;
  ramadanPeriodDuration?: number;

  // Afghanistan Features - Ministry Validation
  enableMinistryValidation?: boolean;
  ministryValidationMode?: string;
  customCurriculumMode?: boolean;

  // Afghanistan Features - Low Resource
  lowResourceMode?: boolean;
}
