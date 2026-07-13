import { z } from 'zod';
import { ALL_WEEK_DAYS } from '../constants/defaults';
import type { GeneralSchoolConfigPayload, MinistryValidationMode, SchoolConfigDto } from '../types';

const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const validTimezoneValues = ['Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Karachi'] as const;

export const MINISTRY_VALIDATION_MODES = ['off', 'warn', 'strict'] as const;
export type { MinistryValidationMode };

export const schoolSettingsSchema = z
  .object({
    revision: z.number().int().positive(),
    schoolId: z.number().int().positive().nullable(),
    schoolName: z.string().max(255),
    enablePrimary: z.boolean(),
    enableMiddle: z.boolean(),
    enableHigh: z.boolean(),
    daysOfWeek: z
      .array(z.enum(ALL_WEEK_DAYS))
      .min(1, 'schoolSettings.validation.noDaysSelected')
      .refine((days) => new Set(days).size === days.length),
    startTime: z.string().regex(TIME_FORMAT_REGEX, 'schoolSettings.validation.invalidTimeFormat'),
    timezone: z.enum(validTimezoneValues, {
      message: 'schoolSettings.validation.invalidTimezone',
    }),
    ramadanModeEnabled: z.boolean(),
    ramadanPeriodDuration: z.number().int().min(20).max(60),
    enableMinistryValidation: z.boolean(),
    ministryValidationMode: z.enum(MINISTRY_VALIDATION_MODES),
    customCurriculumMode: z.boolean(),
    lowResourceMode: z.boolean(),
  })
  .refine((data) => data.enablePrimary || data.enableMiddle || data.enableHigh, {
    message: 'schoolSettings.validation.noGradeLevels',
    path: ['enablePrimary'],
  });

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;

export function toSchoolSettingsApiPayload(
  values: SchoolSettingsFormValues
): GeneralSchoolConfigPayload {
  return {
    schoolId: values.schoolId,
    revision: values.revision,
    schoolName: values.schoolName.trim() || null,
    enablePrimary: values.enablePrimary,
    enableMiddle: values.enableMiddle,
    enableHigh: values.enableHigh,
    daysOfWeek: values.daysOfWeek,
    schoolStartTime: values.startTime,
    timezone: values.timezone,
    ramadanModeEnabled: values.ramadanModeEnabled,
    ramadanPeriodDuration: values.ramadanPeriodDuration,
    enableMinistryValidation: values.enableMinistryValidation,
    ministryValidationMode: values.ministryValidationMode,
    customCurriculumMode: values.customCurriculumMode,
    lowResourceMode: values.lowResourceMode,
  };
}

export function fromSchoolSettingsApiResponse(response: SchoolConfigDto): SchoolSettingsFormValues {
  return {
    revision: response.revision,
    schoolId: response.schoolId,
    schoolName: response.schoolName ?? '',
    enablePrimary: response.enablePrimary,
    enableMiddle: response.enableMiddle,
    enableHigh: response.enableHigh,
    daysOfWeek: response.daysOfWeek,
    startTime: response.schoolStartTime,
    timezone: response.timezone,
    ramadanModeEnabled: response.ramadanModeEnabled,
    ramadanPeriodDuration: response.ramadanPeriodDuration,
    enableMinistryValidation: response.enableMinistryValidation,
    ministryValidationMode: response.ministryValidationMode,
    customCurriculumMode: response.customCurriculumMode,
    lowResourceMode: response.lowResourceMode,
  };
}
