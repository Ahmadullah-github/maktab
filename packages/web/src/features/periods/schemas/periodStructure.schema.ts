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
 * Note: All fields are required (no .default()) to ensure proper type inference with React Hook Form
 */
export const periodStructureSchema = z.object({
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

  prayerBreaksEnabled: z.boolean(),

  prayerBreaks: z.array(prayerBreakSchema),
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
    breakPeriods: JSON.stringify(values.breaks),
    prayerBreaksJson: JSON.stringify(values.prayerBreaks),
  };
};

/**
 * Helper to safely parse JSON from API response
 * Handles both raw JSON strings and already-parsed objects
 */
const safeParseJson = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value as T;
};

/**
 * Helper to parse API response to form values
 */
export const fromPeriodStructureApiResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  response: any
): PeriodStructureFormValues => {
  // Parse periodsPerDayMap - check both getter result and raw JSON field
  const periodsPerDayMap = safeParseJson<Record<string, number>>(
    response.periodsPerDayMap ?? response.periodsPerDayMapJson,
    {}
  );

  // Parse categoryPeriodsMap - check both getter result and raw JSON field
  const categoryPeriodsMap = safeParseJson<Record<string, Record<string, number>>>(
    response.categoryPeriodsMap ?? response.categoryPeriodsMapJson,
    {}
  );

  // Parse breaks from breakPeriods field
  const breaks = safeParseJson<BreakPeriodInput[]>(response.breakPeriods, []);

  // Parse prayerBreaks - check both getter result and raw JSON field
  const prayerBreaks = safeParseJson<PrayerBreakInput[]>(
    response.prayerBreaks ?? response.prayerBreaksJson,
    []
  );

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
