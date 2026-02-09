/**
 * Zod validation schema for School Settings form
 *
 * Includes all Afghanistan-specific features:
 * - School identity
 * - Academic structure (grade levels)
 * - Days & time configuration
 * - Shift configuration
 * - Ramadan mode
 * - Ministry validation
 * - Low-resource mode
 *
 * Note: Period configuration (periods per day, duration, breaks, dynamic periods, category periods)
 * is handled exclusively in the Period Structure page (/settings/periods)
 *
 * Requirements: 1.3, 1.4, 1.5, 1.6, 7.1, 9.3
 */

import { z } from 'zod';
import { ALL_WEEK_DAYS, SHIFT_MODES, VALID_TIMEZONES } from '../constants/defaults';

/**
 * Time format regex for HH:mm validation
 */
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convert time string (HH:MM) to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Extract valid timezone values for schema validation
 */
const validTimezoneValues = VALID_TIMEZONES.map((tz) => tz.value) as [string, ...string[]];

/**
 * Ministry validation modes
 */
export const MINISTRY_VALIDATION_MODES = ['off', 'warn', 'strict'] as const;
export type MinistryValidationMode = (typeof MINISTRY_VALIDATION_MODES)[number];

/**
 * Shift time configuration schema
 */
export const shiftTimeConfigSchema = z.object({
  start: z.string().regex(TIME_FORMAT_REGEX, 'schoolSettings.validation.invalidTimeFormat'),
  end: z.string().regex(TIME_FORMAT_REGEX, 'schoolSettings.validation.invalidTimeFormat'),
});

/**
 * Shifts configuration schema for multi-shift mode
 */
export const shiftsConfigSchema = z
  .object({
    morning: shiftTimeConfigSchema,
    afternoon: shiftTimeConfigSchema,
  })
  .refine(
    (data) => {
      const morningStart = timeToMinutes(data.morning.start);
      const morningEnd = timeToMinutes(data.morning.end);
      return morningEnd > morningStart;
    },
    {
      message: 'schoolSettings.validation.morningEndBeforeStart',
      path: ['morning', 'end'],
    }
  )
  .refine(
    (data) => {
      const afternoonStart = timeToMinutes(data.afternoon.start);
      const afternoonEnd = timeToMinutes(data.afternoon.end);
      return afternoonEnd > afternoonStart;
    },
    {
      message: 'schoolSettings.validation.afternoonEndBeforeStart',
      path: ['afternoon', 'end'],
    }
  )
  .refine(
    (data) => {
      const morningEnd = timeToMinutes(data.morning.end);
      const afternoonStart = timeToMinutes(data.afternoon.start);
      return afternoonStart >= morningEnd;
    },
    {
      message: 'schoolSettings.validation.shiftsOverlap',
      path: ['afternoon', 'start'],
    }
  );

/**
 * Main school settings form schema
 *
 * Note: Period-related fields (periodsPerDay, periodDuration, breakPeriods,
 * dynamicPeriodsEnabled, periodsPerDayMap, categoryPeriodsEnabled, categoryPeriods)
 * are managed exclusively by PeriodStructurePage
 */
export const schoolSettingsSchema = z
  .object({
    // =========================================
    // School Identity
    // =========================================
    schoolName: z.string().optional(),

    // =========================================
    // Academic Structure (Grade Levels)
    // =========================================
    enablePrimary: z.boolean(),
    enableMiddle: z.boolean(),
    enableHigh: z.boolean(),

    // =========================================
    // Days & Time Configuration
    // =========================================
    daysOfWeek: z.array(z.enum(ALL_WEEK_DAYS)).min(1, 'schoolSettings.validation.noDaysSelected'),
    startTime: z.string().regex(TIME_FORMAT_REGEX, 'schoolSettings.validation.invalidTimeFormat'),
    timezone: z.enum(validTimezoneValues, {
      message: 'schoolSettings.validation.invalidTimezone',
    }),

    // =========================================
    // Shift Configuration
    // =========================================
    shiftMode: z.enum(SHIFT_MODES, {
      message: 'schoolSettings.validation.invalidShiftMode',
    }),
    shifts: shiftsConfigSchema.optional(),

    // =========================================
    // Afghanistan Features - Ramadan Mode
    // =========================================
    ramadanModeEnabled: z.boolean(),
    ramadanPeriodDuration: z.number().min(20).max(60),

    // =========================================
    // Afghanistan Features - Ministry Validation
    // =========================================
    enableMinistryValidation: z.boolean(),
    ministryValidationMode: z.enum(MINISTRY_VALIDATION_MODES),
    customCurriculumMode: z.boolean(),

    // =========================================
    // Afghanistan Features - Low Resource Mode
    // =========================================
    lowResourceMode: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.shiftMode === 'multi') {
        return data.shifts !== undefined;
      }
      return true;
    },
    {
      message: 'schoolSettings.validation.shiftsRequired',
      path: ['shifts'],
    }
  )
  .refine(
    (data) => {
      // At least one grade level must be enabled
      return data.enablePrimary || data.enableMiddle || data.enableHigh;
    },
    {
      message: 'schoolSettings.validation.noGradeLevels',
      path: ['enablePrimary'],
    }
  );

/**
 * Type inference from schema
 */
export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;

/**
 * Helper to transform form values to API payload
 *
 * Note: Period-related fields are NOT included here - they are managed
 * exclusively by PeriodStructurePage to avoid sync conflicts
 */
export const toSchoolSettingsApiPayload = (values: SchoolSettingsFormValues) => {
  return {
    // School Identity
    schoolName: values.schoolName,

    // Academic Structure
    enablePrimary: values.enablePrimary,
    enableMiddle: values.enableMiddle,
    enableHigh: values.enableHigh,

    // Days & Time - send as JSON string for backend entity
    daysOfWeekJson: JSON.stringify(values.daysOfWeek),
    daysPerWeek: values.daysOfWeek.length,
    schoolStartTime: values.startTime,
    timezone: values.timezone,

    // Shifts
    shiftMode: values.shiftMode,
    shiftsConfigJson: values.shifts ? JSON.stringify(values.shifts) : null,

    // Afghanistan Features - Ramadan
    ramadanModeEnabled: values.ramadanModeEnabled,
    ramadanPeriodDuration: values.ramadanPeriodDuration,

    // Afghanistan Features - Ministry
    enableMinistryValidation: values.enableMinistryValidation,
    ministryValidationMode: values.ministryValidationMode,
    customCurriculumMode: values.customCurriculumMode,

    // Afghanistan Features - Low Resource
    lowResourceMode: values.lowResourceMode,
  };
};

/**
 * Helper to parse API response to form values
 */
export const fromSchoolSettingsApiResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): SchoolSettingsFormValues => {
  const parseJson = (val: unknown) => {
    if (!val) return undefined;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
      }
    }
    return val;
  };

  // Parse daysOfWeek from JSON string if needed
  let daysOfWeek = response.daysOfWeek || [];
  if (typeof response.daysOfWeekJson === 'string') {
    try {
      daysOfWeek = JSON.parse(response.daysOfWeekJson);
    } catch {
      // Keep default
    }
  }

  return {
    // School Identity
    schoolName: response.schoolName || '',

    // Academic Structure
    enablePrimary: response.enablePrimary ?? true,
    enableMiddle: response.enableMiddle ?? true,
    enableHigh: response.enableHigh ?? true,

    // Days & Time
    daysOfWeek: daysOfWeek,
    startTime: response.schoolStartTime || '07:30',
    timezone: response.timezone || 'Asia/Kabul',

    // Shifts
    shiftMode: response.shiftMode || 'single',
    shifts: parseJson(response.shiftsConfig) || parseJson(response.shiftsConfigJson),

    // Afghanistan Features - Ramadan
    ramadanModeEnabled: response.ramadanModeEnabled || false,
    ramadanPeriodDuration: response.ramadanPeriodDuration || 35,

    // Afghanistan Features - Ministry
    enableMinistryValidation: response.enableMinistryValidation || false,
    ministryValidationMode: response.ministryValidationMode || 'warn',
    customCurriculumMode: response.customCurriculumMode || false,

    // Afghanistan Features - Low Resource
    lowResourceMode: response.lowResourceMode || false,
  };
};
