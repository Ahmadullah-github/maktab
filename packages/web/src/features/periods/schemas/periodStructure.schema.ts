/**
 * Zod validation schema for Period Structure form
 * Requirements: 2.3, 2.4, 3.3, 4.3, 9.3
 */

import { z } from 'zod';
import type { SchoolConfigDto } from '@/features/school-settings/types';
import { ALL_WEEK_DAYS } from '@/features/school-settings/constants/defaults';
import { BREAK_DURATION_LIMITS, DURATION_LIMITS, PERIOD_LIMITS } from '../constants/defaults';

/**
 * Time format regex for HH:mm validation
 */
const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Period count schema with configurable limits
 * Used for default periods, dynamic periods, and category-based periods
 */
export const periodCountSchema = z
  .number()
  .int('periodStructure.validation.mustBeInteger')
  .min(PERIOD_LIMITS.MIN, 'periodStructure.validation.periodCountMin')
  .max(PERIOD_LIMITS.MAX, 'periodStructure.validation.periodCountMax');

/**
 * Break period configuration schema
 */
export const breakPeriodSchema = z.object({
  afterPeriod: z.number().int().min(1, 'periodStructure.validation.breakAfterPeriodMin'),
  duration: z
    .number()
    .int()
    .min(BREAK_DURATION_LIMITS.MIN, 'periodStructure.validation.breakDurationMin')
    .max(BREAK_DURATION_LIMITS.MAX, 'periodStructure.validation.breakDurationMax'),
});

/**
 * Prayer break configuration schema
 */
export const prayerBreakSchema = z.object({
  name: z.string().min(1, 'periodStructure.validation.prayerNameRequired'),
  time: z.string().regex(TIME_FORMAT_REGEX, 'periodStructure.validation.invalidTimeFormat'),
  duration: z
    .number()
    .int()
    .min(BREAK_DURATION_LIMITS.MIN, 'periodStructure.validation.breakDurationMin')
    .max(BREAK_DURATION_LIMITS.MAX, 'periodStructure.validation.breakDurationMax'),
});

/**
 * Periods per day map schema (for dynamic periods)
 * Maps day names to period counts - uses string keys for partial records
 */
const weekDaySchema = z.enum(ALL_WEEK_DAYS);
const gradeCategorySchema = z.enum(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High']);

export const periodsPerDayMapSchema = z.partialRecord(weekDaySchema, periodCountSchema);

/**
 * Category periods map schema (for category-based periods)
 * Maps grade category to day-period mapping
 */
export const categoryPeriodsMapSchema = z.partialRecord(
  gradeCategorySchema,
  periodsPerDayMapSchema
);

/**
 * Per-day break overrides schema
 * Maps day names to sparse break arrays.
 */
export const breaksByDaySchema = z.partialRecord(weekDaySchema, z.array(breakPeriodSchema));

/**
 * Main period structure form schema
 * Validates periods, duration, dynamic periods, category-based periods, and breaks
 * Note: All fields are required (no .default()) to ensure proper type inference with React Hook Form
 */
export const periodStructureSchema = z
  .object({
    revision: z.number().int().positive(),

    schoolId: z.number().int().positive().nullable(),

    defaultPeriodsPerDay: periodCountSchema,

    periodDuration: z
      .number()
      .int('periodStructure.validation.mustBeInteger')
      .min(DURATION_LIMITS.MIN, 'periodStructure.validation.durationMin')
      .max(DURATION_LIMITS.MAX, 'periodStructure.validation.durationMax'),

    dynamicPeriodsEnabled: z.boolean(),

    periodsPerDayMap: periodsPerDayMapSchema,

    categoryPeriodsEnabled: z.boolean(),

    categoryPeriodsMap: categoryPeriodsMapSchema,

    breaks: z.array(breakPeriodSchema),

    breaksByDay: breaksByDaySchema,

    prayerBreaksEnabled: z.boolean(),

    prayerBreaks: z.array(prayerBreakSchema),
  })
  .superRefine((values, context) => {
    const validateDuplicateBreaks = (
      breaks: Array<{ afterPeriod: number }>,
      path: Array<string | number>
    ) => {
      const seen = new Set<number>();
      breaks.forEach((breakConfig, index) => {
        if (seen.has(breakConfig.afterPeriod)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, index, 'afterPeriod'],
            message: 'periodStructure.validation.duplicateBreak',
          });
        }
        seen.add(breakConfig.afterPeriod);
      });
    };

    validateDuplicateBreaks(values.breaks, ['breaks']);
    Object.entries(values.breaksByDay).forEach(([day, breaks]) => {
      validateDuplicateBreaks(breaks ?? [], ['breaksByDay', day]);
    });

    const prayerIntervals = values.prayerBreaks
      .map((prayerBreak, index) => {
        const [hours, minutes] = prayerBreak.time.split(':').map(Number);
        const start = hours * 60 + minutes;
        return { index, start, end: start + prayerBreak.duration };
      })
      .sort((left, right) => left.start - right.start);

    prayerIntervals.forEach((interval, index) => {
      if (interval.end > 24 * 60) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['prayerBreaks', interval.index, 'duration'],
          message: 'periodStructure.validation.prayerBreakBeforeMidnight',
        });
      }
      if (index > 0 && interval.start < prayerIntervals[index - 1].end) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['prayerBreaks', interval.index, 'time'],
          message: 'periodStructure.validation.prayerBreakOverlap',
        });
      }
    });
  });

/**
 * Type inference from schema
 */
export type PeriodStructureFormValues = z.infer<typeof periodStructureSchema>;

/**
 * Helper to transform form values to API payload
 */
export const toPeriodStructureApiPayload = (values: PeriodStructureFormValues) => {
  return {
    revision: values.revision,
    schoolId: values.schoolId,
    defaultPeriodsPerDay: values.defaultPeriodsPerDay,
    periodDuration: values.periodDuration,
    dynamicPeriodsEnabled: values.dynamicPeriodsEnabled,
    periodsPerDayMap: values.periodsPerDayMap,
    categoryPeriodsEnabled: values.categoryPeriodsEnabled,
    categoryPeriodsMap: values.categoryPeriodsMap,
    breakPeriods: values.breaks,
    breakPeriodsByDay: values.breaksByDay,
    prayerBreaksEnabled: values.prayerBreaksEnabled,
    prayerBreaks: values.prayerBreaks,
  };
};

/**
 * Helper to parse API response to form values
 */
export const fromPeriodStructureApiResponse = (
  response: SchoolConfigDto
): PeriodStructureFormValues => {
  return {
    revision: response.revision,
    schoolId: response.schoolId,
    defaultPeriodsPerDay: response.defaultPeriodsPerDay ?? PERIOD_LIMITS.DEFAULT,
    periodDuration: response.periodDuration ?? DURATION_LIMITS.DEFAULT,
    dynamicPeriodsEnabled: response.dynamicPeriodsEnabled ?? false,
    periodsPerDayMap: response.periodsPerDayMap,
    categoryPeriodsEnabled: response.categoryPeriodsEnabled ?? false,
    categoryPeriodsMap: response.categoryPeriodsMap,
    breaks: response.breakPeriods,
    breaksByDay: response.breakPeriodsByDay,
    prayerBreaksEnabled: response.prayerBreaksEnabled,
    prayerBreaks: response.prayerBreaks,
  };
};
