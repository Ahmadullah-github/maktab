import { z } from 'zod';
import type { SchoolConfig } from '../entity/SchoolConfig';
import { SCHOOL_WEEK_DAYS } from '../types/schoolConfig.types';

const weekDay = z.enum(SCHOOL_WEEK_DAYS);
const periodCount = z.number().int().min(1).max(12);
const breakPeriod = z
  .object({
    afterPeriod: z.number().int().min(1).max(11),
    duration: z.number().int().min(5).max(60),
  })
  .strict();
const prayerBreak = z
  .object({
    name: z.string().trim().min(1).max(100),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration: z.number().int().min(5).max(60),
  })
  .strict();
const periodMap = z.partialRecord(weekDay, periodCount);
const category = z.enum(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High']);
const timezone = z.enum(['Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Karachi']);

const scalarSchema = z
  .object({
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    enablePrimary: z.boolean(),
    enableMiddle: z.boolean(),
    enableHigh: z.boolean(),
    daysPerWeek: z.number().int().min(1).max(7),
    periodsPerDay: periodCount,
    defaultPeriodsPerDay: periodCount,
    periodDuration: z.number().int().min(15).max(120),
    dynamicPeriodsEnabled: z.boolean(),
    categoryPeriodsEnabled: z.boolean(),
    prayerBreaksEnabled: z.boolean(),
    autoPopulateCurriculum: z.boolean(),
    lowResourceMode: z.boolean(),
    schoolStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone,
  })
  .superRefine((value, context) => {
    if (value.periodsPerDay !== value.defaultPeriodsPerDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodsPerDay'],
        message: 'must equal defaultPeriodsPerDay',
      });
    }
    if (!value.enablePrimary && !value.enableMiddle && !value.enableHigh) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enablePrimary'],
        message: 'at least one grade band must be enabled',
      });
    }
  });

export const schoolConfigDtoSchema = z.object({
  id: z.number().int().positive(),
  schoolId: z.number().int().positive().nullable(),
  revision: z.number().int().positive(),
  schoolName: z.string().nullable(),
  enablePrimary: z.boolean(),
  enableMiddle: z.boolean(),
  enableHigh: z.boolean(),
  daysOfWeek: z.array(weekDay).min(1).max(7),
  daysPerWeek: z.number().int().min(1).max(7),
  schoolStartTime: z.string(),
  timezone,
  autoPopulateCurriculum: z.boolean(),
  lowResourceMode: z.boolean(),
  defaultPeriodsPerDay: periodCount,
  periodDuration: z.number().int().min(15).max(120),
  dynamicPeriodsEnabled: z.boolean(),
  periodsPerDayMap: periodMap,
  categoryPeriodsEnabled: z.boolean(),
  categoryPeriodsMap: z.partialRecord(category, periodMap),
  breakPeriods: z.array(breakPeriod),
  breakPeriodsByDay: z.partialRecord(weekDay, z.array(breakPeriod)),
  prayerBreaksEnabled: z.boolean(),
  prayerBreaks: z.array(prayerBreak),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class SchoolConfigCorruptError extends Error {
  readonly code = 'SCHOOL_CONFIG_CORRUPT';

  constructor(
    readonly configId: number,
    readonly field: string,
    detail: string
  ) {
    super(`School configuration ${configId} has corrupt ${field}: ${detail}`);
  }
}

function assertStorageInvariant(
  config: SchoolConfig,
  condition: boolean,
  field: string,
  detail: string
): void {
  if (!condition) throw new SchoolConfigCorruptError(config.id, field, detail);
}

function hasExactlyKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expectedKeys = [...expected].sort();
  return (
    actual.length === expectedKeys.length &&
    actual.every((key, index) => key === expectedKeys[index])
  );
}

function hasDuplicateBreakPositions(breaks: Array<{ afterPeriod: number }>): boolean {
  return new Set(breaks.map((entry) => entry.afterPeriod)).size !== breaks.length;
}

function parseJsonField<T>(
  config: SchoolConfig,
  field: string,
  rawValue: string | null,
  fallback: unknown,
  schema: z.ZodType<T>
): T {
  let parsed = fallback;
  if (rawValue !== null && rawValue.trim() !== '') {
    try {
      parsed = JSON.parse(rawValue);
    } catch (error) {
      throw new SchoolConfigCorruptError(
        config.id,
        field,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new SchoolConfigCorruptError(config.id, field, z.prettifyError(result.error));
  }
  return result.data;
}

export function readStoredSchoolConfig(config: SchoolConfig) {
  const scalarResult = scalarSchema.safeParse(config);
  if (!scalarResult.success) {
    throw new SchoolConfigCorruptError(
      config.id,
      'scalar fields',
      z.prettifyError(scalarResult.error)
    );
  }

  const daysOfWeek = parseJsonField(
    config,
    'daysOfWeekJson',
    config.daysOfWeekJson,
    ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    z
      .array(weekDay)
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length)
  );
  const periodsPerDayMap = parseJsonField(
    config,
    'periodsPerDayMapJson',
    config.periodsPerDayMapJson,
    {},
    periodMap
  );
  const categoryPeriodsMap = parseJsonField(
    config,
    'categoryPeriodsMapJson',
    config.categoryPeriodsMapJson,
    {},
    z.partialRecord(category, periodMap)
  );
  const breakPeriods = parseJsonField(
    config,
    'breakPeriods',
    config.breakPeriods,
    [],
    z.array(breakPeriod)
  );
  const breakPeriodsByDay = parseJsonField(
    config,
    'breakPeriodsByDayJson',
    config.breakPeriodsByDayJson,
    {},
    z.partialRecord(weekDay, z.array(breakPeriod))
  );
  const prayerBreaks = parseJsonField(
    config,
    'prayerBreaksJson',
    config.prayerBreaksJson,
    [],
    z.array(prayerBreak)
  );

  assertStorageInvariant(
    config,
    config.daysPerWeek === daysOfWeek.length,
    'daysPerWeek',
    `stored ${config.daysPerWeek}, but daysOfWeekJson contains ${daysOfWeek.length} days`
  );
  assertStorageInvariant(
    config,
    config.dynamicPeriodsEnabled
      ? hasExactlyKeys(periodsPerDayMap, daysOfWeek)
      : Object.keys(periodsPerDayMap).length === 0,
    'periodsPerDayMapJson',
    config.dynamicPeriodsEnabled
      ? 'must contain exactly the active days when dynamic periods are enabled'
      : 'must be empty when dynamic periods are disabled'
  );

  const enabledCategories: Array<z.infer<typeof category>> = [
    ...(config.enablePrimary ? (['Alpha-Primary', 'Beta-Primary'] as const) : []),
    ...(config.enableMiddle ? (['Middle'] as const) : []),
    ...(config.enableHigh ? (['High'] as const) : []),
  ];
  const categoryShapeIsExact =
    hasExactlyKeys(categoryPeriodsMap, enabledCategories) &&
    Object.values(categoryPeriodsMap).every((dayMap) => hasExactlyKeys(dayMap ?? {}, daysOfWeek));
  assertStorageInvariant(
    config,
    config.categoryPeriodsEnabled
      ? categoryShapeIsExact
      : Object.keys(categoryPeriodsMap).length === 0,
    'categoryPeriodsMapJson',
    config.categoryPeriodsEnabled
      ? 'must contain exactly the enabled categories and active days'
      : 'must be empty when category periods are disabled'
  );

  const activeDays = new Set<string>(daysOfWeek);
  assertStorageInvariant(
    config,
    Object.keys(breakPeriodsByDay).every((day) => activeDays.has(day)),
    'breakPeriodsByDayJson',
    'contains an inactive day override'
  );
  assertStorageInvariant(
    config,
    !hasDuplicateBreakPositions(breakPeriods) &&
      Object.values(breakPeriodsByDay).every(
        (entries) => !hasDuplicateBreakPositions(entries ?? [])
      ),
    'break configuration',
    'contains duplicate afterPeriod values'
  );

  const maximumPeriodsByDay = Object.fromEntries(
    daysOfWeek.map((day) => [
      day,
      config.categoryPeriodsEnabled
        ? Math.max(
            ...enabledCategories.map(
              (enabledCategory) => categoryPeriodsMap[enabledCategory]?.[day] ?? 0
            )
          )
        : config.dynamicPeriodsEnabled
          ? (periodsPerDayMap[day] ?? 0)
          : config.defaultPeriodsPerDay,
    ])
  );
  const maximumSharedPeriods = Math.max(...Object.values(maximumPeriodsByDay));
  assertStorageInvariant(
    config,
    breakPeriods.every((entry) => entry.afterPeriod < maximumSharedPeriods) &&
      Object.entries(breakPeriodsByDay).every(([day, entries]) =>
        (entries ?? []).every((entry) => entry.afterPeriod < maximumPeriodsByDay[day])
      ),
    'break configuration',
    'contains a break outside its effective period boundary'
  );

  const prayerIntervals = prayerBreaks
    .map((entry) => {
      const [hours, minutes] = entry.time.split(':').map(Number);
      const start = hours * 60 + minutes;
      return { start, end: start + entry.duration };
    })
    .sort((left, right) => left.start - right.start);
  assertStorageInvariant(
    config,
    prayerIntervals.every(
      (entry, index) =>
        entry.end <= 24 * 60 && (index === 0 || entry.start >= prayerIntervals[index - 1].end)
    ),
    'prayerBreaksJson',
    'contains overlapping intervals or a break ending after midnight'
  );
  assertStorageInvariant(
    config,
    config.prayerBreaksEnabled || prayerBreaks.length === 0,
    'prayerBreaksJson',
    'must be empty when prayer breaks are disabled'
  );

  return {
    daysOfWeek,
    periodsPerDayMap,
    categoryPeriodsMap,
    breakPeriods,
    breakPeriodsByDay,
    prayerBreaks,
  };
}
