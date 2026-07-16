import { z } from 'zod';
import { ALL_WEEK_DAYS } from '../constants/defaults';
import type { SchoolConfigDto } from '../types';

const weekDay = z.enum(ALL_WEEK_DAYS);
const periodCount = z.number().int().min(1).max(12);
const periodMap = z.partialRecord(weekDay, periodCount);
const category = z.enum(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High']);
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

export const schoolConfigDtoSchema = z
  .object({
    id: z.number().int().positive(),
    schoolId: z.number().int().positive().nullable(),
    revision: z.number().int().positive(),
    schoolName: z.string().nullable(),
    enablePrimary: z.boolean(),
    enableMiddle: z.boolean(),
    enableHigh: z.boolean(),
    daysOfWeek: z.array(weekDay).min(1).max(7),
    daysPerWeek: z.number().int().min(1).max(7),
    schoolStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.enum(['Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Karachi']),
    ramadanModeEnabled: z.boolean(),
    ramadanPeriodDuration: z.number().int().min(20).max(60),
    enableMinistryValidation: z.boolean(),
    ministryValidationMode: z.enum(['off', 'warn', 'strict']),
    customCurriculumMode: z.boolean(),
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
  })
  .strict();

export function parseSchoolConfigDto(value: unknown): SchoolConfigDto {
  return schoolConfigDtoSchema.parse(value) as SchoolConfigDto;
}
