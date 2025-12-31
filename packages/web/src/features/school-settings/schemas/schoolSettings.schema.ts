/**
 * Zod validation schema for School Settings form
 * Requirements: 1.3, 1.4, 1.5, 1.6, 9.3
 */

import { z } from 'zod';
import { ALL_WEEK_DAYS, SHIFT_MODES, VALID_TIMEZONES } from '../constants/defaults';

/**
 * Time format regex for HH:mm validation
 */
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Extract valid timezone values for schema validation
 */
const validTimezoneValues = VALID_TIMEZONES.map((tz) => tz.value) as [string, ...string[]];

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
export const shiftsConfigSchema = z.object({
  morning: shiftTimeConfigSchema,
  afternoon: shiftTimeConfigSchema,
});

/**
 * Main school settings form schema
 * Validates days of week, start time, timezone, and shift configuration
 */
export const schoolSettingsSchema = z
  .object({
    daysOfWeek: z.array(z.enum(ALL_WEEK_DAYS)).min(1, 'schoolSettings.validation.noDaysSelected'),

    startTime: z.string().regex(TIME_FORMAT_REGEX, 'schoolSettings.validation.invalidTimeFormat'),

    timezone: z.enum(validTimezoneValues, {
      errorMap: () => ({
        message: 'schoolSettings.validation.invalidTimezone',
      }),
    }),

    shiftMode: z.enum(SHIFT_MODES, {
      errorMap: () => ({
        message: 'schoolSettings.validation.invalidShiftMode',
      }),
    }),

    shifts: shiftsConfigSchema.optional(),
  })
  .refine(
    (data) => {
      // If multi-shift mode, shifts configuration is required
      if (data.shiftMode === 'multi') {
        return data.shifts !== undefined;
      }
      return true;
    },
    {
      message: 'schoolSettings.validation.shiftsRequired',
      path: ['shifts'],
    }
  );

/**
 * Type inference from schema
 */
export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;

/**
 * Helper to transform form values to API payload
 */
export const toSchoolSettingsApiPayload = (values: SchoolSettingsFormValues) => {
  return {
    daysOfWeek: values.daysOfWeek,
    schoolStartTime: values.startTime,
    timezone: values.timezone,
    shiftMode: values.shiftMode,
    shiftsConfigJson: values.shifts ? JSON.stringify(values.shifts) : undefined,
  };
};

/**
 * Helper to parse API response to form values
 */
export const fromSchoolSettingsApiResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): SchoolSettingsFormValues => {
  let shifts: z.infer<typeof shiftsConfigSchema> | undefined;

  // Parse shifts configuration
  if (response.shiftsConfig) {
    if (typeof response.shiftsConfig === 'string') {
      try {
        shifts = JSON.parse(response.shiftsConfig);
      } catch {
        console.warn('Failed to parse shiftsConfig JSON', response.shiftsConfig);
      }
    } else {
      shifts = response.shiftsConfig;
    }
  }

  return {
    daysOfWeek: response.daysOfWeek || [],
    startTime: response.schoolStartTime || '07:30',
    timezone: response.timezone || 'Asia/Kabul',
    shiftMode: response.shiftMode || 'single',
    shifts,
  };
};
