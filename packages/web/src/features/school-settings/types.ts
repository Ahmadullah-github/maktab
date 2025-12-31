/**
 * Types for the School Settings feature module
 * Requirements: 9.1
 */

import type { ShiftMode, TimezoneValue, WeekDay } from './constants/defaults';

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
 * Form data for School Settings page
 * Used with React Hook Form
 */
export interface SchoolSettingsFormData {
  daysOfWeek: WeekDay[];
  startTime: string; // HH:mm format
  timezone: TimezoneValue;
  shiftMode: ShiftMode;
  shifts?: ShiftsConfig;
}

/**
 * API response for school settings
 * Matches the SchoolConfig entity structure
 */
export interface SchoolSettingsResponse {
  id: number;
  schoolId: number | null;
  schoolName: string | null;
  daysOfWeek: string[];
  daysPerWeek: number;
  schoolStartTime: string;
  timezone: string;
  shiftMode: string;
  shiftsConfig: ShiftsConfig | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for updating school settings
 */
export interface UpdateSchoolSettingsPayload {
  daysOfWeek?: string[];
  schoolStartTime?: string;
  timezone?: string;
  shiftMode?: string;
  shiftsConfigJson?: string | null;
}
