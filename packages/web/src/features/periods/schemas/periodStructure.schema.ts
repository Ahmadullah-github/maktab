/**
 * Zod validation schema for Period Structure form
 * Requirements: 2.3, 2.4, 3.3, 4.3, 9.3
 */

import { z } from 'zod';
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

export type BreakPeriodInput = z.infer<typeof breakPeriodSchema>;

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

export type PrayerBreakInput = z.infer<typeof prayerBreakSchema>;

/**
 * Periods per day map schema (for dynamic periods)
 * Maps day names to period counts - uses string keys for partial records
 */
export const periodsPerDayMapSchema = z.record(z.string(), periodCountSchema);

/**
 * Category periods map schema (for category-based periods)
 * Maps grade category to day-period mapping
 */
export const categoryPeriodsMapSchema = z.record(z.string(), periodsPerDayMapSchema);

/**
 * Main period structure form schema
 * Validates periods, duration, dynamic periods, category-based periods, and breaks
 */
export const periodStructureSchema = z.object({
  defaultPeriodsPerDay: periodCountSchema,

  periodDuration: z
    .number()
    .int('periodStructure.validation.mustBeInteger')
    .min(DURATION_LIMITS.MIN, 'periodStructure.validation.durationMin')
    .max(DURATION_LIMITS.MAX, 'periodStructure.validation.durationMax'),

  dynamicPeriodsEnabled: z.boolean(),

  periodsPerDayMap: periodsPerDayMapSchema.default({}),

  categoryPeriodsEnabled: z.boolean(),

  categoryPeriodsMap: categoryPeriodsMapSchema.default({}),

  breaks: z.array(breakPeriodSchema).default([]),

  prayerBreaksEnabled: z.boolean(),

  prayerBreaks: z.array(prayerBreakSchema).default([]),
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
    defaultPeriodsPerDay: values.defaultPeriodsPerDay,
    periodDuration: values.periodDuration,
    dynamicPeriodsEnabled: values.dynamicPeriodsEnabled,
    periodsPerDayMapJson: JSON.stringify(values.periodsPerDayMap),
    categoryPeriodsEnabled: values.categoryPeriodsEnabled,
    categoryPeriodsMapJson: JSON.stringify(values.categoryPeriodsMap),
    breakPeriodsJson: JSON.stringify(values.breaks),
    ramadanModeEnabled: values.prayerBreaksEnabled,
    prayerBreaksJson: JSON.stringify(values.prayerBreaks),
  };
};

/**
 * Helper to parse API response to form values
 */
export const fromPeriodStructureApiResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): PeriodStructureFormValues => {
  // Parse periodsPerDayMap
  let periodsPerDayMap: Record<string, number> = {};
  if (response.periodsPerDayMap) {
    if (typeof response.periodsPerDayMap === 'string') {
      try {
        periodsPerDayMap = JSON.parse(response.periodsPerDayMap);
      } catch {
        console.warn('Failed to parse periodsPerDayMap JSON');
      }
    } else {
      periodsPerDayMap = response.periodsPerDayMap;
    }
  }

  // Parse categoryPeriodsMap
  let categoryPeriodsMap: Record<string, Record<string, number>> = {};
  if (response.categoryPeriodsMap) {
    if (typeof response.categoryPeriodsMap === 'string') {
      try {
        categoryPeriodsMap = JSON.parse(response.categoryPeriodsMap);
      } catch {
        console.warn('Failed to parse categoryPeriodsMap JSON');
      }
    } else {
      categoryPeriodsMap = response.categoryPeriodsMap;
    }
  }

  // Parse breaks
  let breaks: BreakPeriodInput[] = [];
  if (response.breakPeriods) {
    if (typeof response.breakPeriods === 'string') {
      try {
        breaks = JSON.parse(response.breakPeriods);
      } catch {
        console.warn('Failed to parse breakPeriods JSON');
      }
    } else if (Array.isArray(response.breakPeriods)) {
      breaks = response.breakPeriods;
    }
  }

  // Parse prayerBreaks
  let prayerBreaks: PrayerBreakInput[] = [];
  if (response.prayerBreaks) {
    if (typeof response.prayerBreaks === 'string') {
      try {
        prayerBreaks = JSON.parse(response.prayerBreaks);
      } catch {
        console.warn('Failed to parse prayerBreaks JSON');
      }
    } else if (Array.isArray(response.prayerBreaks)) {
      prayerBreaks = response.prayerBreaks;
    }
  }

  return {
    defaultPeriodsPerDay: response.defaultPeriodsPerDay ?? PERIOD_LIMITS.DEFAULT,
    periodDuration: response.periodDuration ?? DURATION_LIMITS.DEFAULT,
    dynamicPeriodsEnabled: response.dynamicPeriodsEnabled ?? false,
    periodsPerDayMap,
    categoryPeriodsEnabled: response.categoryPeriodsEnabled ?? false,
    categoryPeriodsMap,
    breaks,
    prayerBreaksEnabled: response.ramadanModeEnabled ?? false,
    prayerBreaks,
  };
};
