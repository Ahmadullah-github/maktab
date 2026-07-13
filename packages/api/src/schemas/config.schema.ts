import { z } from 'zod';
import { SCHOOL_WEEK_DAYS } from '../types/schoolConfig.types';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must use HH:mm format');
const schoolId = z.number().int().positive().nullable().optional();
const revision = z.number().int().positive();
const weekDay = z.enum(SCHOOL_WEEK_DAYS);
const gradeCategory = z.enum(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High']);
const timezone = z.enum(['Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Karachi']);

const uniqueDays = z
  .array(weekDay)
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, 'Weekdays must be unique');

const breakPeriod = z
  .object({
    afterPeriod: z.number().int().min(1).max(11),
    duration: z.number().int().min(5).max(60),
  })
  .strict();

const prayerBreak = z
  .object({
    name: z.string().trim().min(1).max(100),
    time,
    duration: z.number().int().min(5).max(60),
  })
  .strict();

const periodCount = z.number().int().min(1).max(12);
const periodMap = z.partialRecord(weekDay, periodCount);

function addDuplicateBreakIssues(
  breaks: Array<{ afterPeriod: number }>,
  path: Array<string | number>,
  context: z.RefinementCtx
): void {
  const seen = new Set<number>();
  for (let index = 0; index < breaks.length; index += 1) {
    const afterPeriod = breaks[index].afterPeriod;
    if (seen.has(afterPeriod)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index, 'afterPeriod'],
        message: `Only one break can follow period ${afterPeriod}`,
      });
    }
    seen.add(afterPeriod);
  }
}

export const generalSchoolConfigUpdateSchema = z
  .object({
    schoolId,
    revision,
    schoolName: z.string().trim().max(255).nullable(),
    enablePrimary: z.boolean(),
    enableMiddle: z.boolean(),
    enableHigh: z.boolean(),
    daysOfWeek: uniqueDays,
    schoolStartTime: time,
    timezone,
    ramadanModeEnabled: z.boolean(),
    ramadanPeriodDuration: z.number().int().min(20).max(60),
    enableMinistryValidation: z.boolean(),
    ministryValidationMode: z.enum(['warn', 'strict', 'off']),
    customCurriculumMode: z.boolean(),
    lowResourceMode: z.boolean(),
  })
  .strict()
  .refine((value) => value.enablePrimary || value.enableMiddle || value.enableHigh, {
    message: 'At least one grade band must remain enabled',
    path: ['enablePrimary'],
  });

export const periodStructureUpdateSchema = z
  .object({
    schoolId,
    revision,
    defaultPeriodsPerDay: periodCount,
    periodDuration: z.number().int().min(15).max(120),
    dynamicPeriodsEnabled: z.boolean(),
    periodsPerDayMap: periodMap,
    categoryPeriodsEnabled: z.boolean(),
    categoryPeriodsMap: z.partialRecord(gradeCategory, periodMap),
    breakPeriods: z.array(breakPeriod),
    breakPeriodsByDay: z.partialRecord(weekDay, z.array(breakPeriod)),
    prayerBreaksEnabled: z.boolean(),
    prayerBreaks: z.array(prayerBreak),
  })
  .strict()
  .superRefine((value, context) => {
    addDuplicateBreakIssues(value.breakPeriods, ['breakPeriods'], context);
    for (const [day, breaks] of Object.entries(value.breakPeriodsByDay)) {
      addDuplicateBreakIssues(breaks ?? [], ['breakPeriodsByDay', day], context);
    }

    const intervals = value.prayerBreaks
      .map((entry, index) => {
        const [hours, minutes] = entry.time.split(':').map(Number);
        const start = hours * 60 + minutes;
        return { index, start, end: start + entry.duration };
      })
      .sort((left, right) => left.start - right.start);

    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index].start < intervals[index - 1].end) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['prayerBreaks', intervals[index].index, 'time'],
          message: 'Prayer break intervals must not overlap',
        });
      }
    }

    for (const interval of intervals) {
      if (interval.end > 24 * 60) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['prayerBreaks', interval.index, 'duration'],
          message: 'Prayer break must end before midnight',
        });
      }
    }
  });

export const configurationValueSchema = z
  .object({
    value: z.unknown(),
  })
  .strict();

export type GeneralSchoolConfigUpdateInput = z.infer<typeof generalSchoolConfigUpdateSchema>;
export type PeriodStructureUpdateInput = z.infer<typeof periodStructureUpdateSchema>;
