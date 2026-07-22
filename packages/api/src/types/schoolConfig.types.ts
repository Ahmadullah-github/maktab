import type {
  BreakPeriodConfig,
  BreakPeriodsByDayConfig,
  PrayerBreakConfig,
} from '../entity/SchoolConfig';
import type { OptimizationPreferencesInput } from '../schemas/config.schema';

export const SCHOOL_WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export type SchoolWeekDay = (typeof SCHOOL_WEEK_DAYS)[number];
export type GradeCategory = 'Alpha-Primary' | 'Beta-Primary' | 'Middle' | 'High';

export interface SchoolConfigDto {
  id: number;
  schoolId: number | null;
  revision: number;
  /** @deprecated School identity is now provided by SchoolProfileDto. */
  schoolName: string | null;
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  daysOfWeek: SchoolWeekDay[];
  daysPerWeek: number;
  schoolStartTime: string;
  timezone: string;
  autoPopulateCurriculum: boolean;
  lowResourceMode: boolean;
  defaultPeriodsPerDay: number;
  periodDuration: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: Partial<Record<SchoolWeekDay, number>>;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: Partial<Record<GradeCategory, Partial<Record<SchoolWeekDay, number>>>>;
  breakPeriods: BreakPeriodConfig[];
  breakPeriodsByDay: BreakPeriodsByDayConfig;
  prayerBreaksEnabled: boolean;
  prayerBreaks: PrayerBreakConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneralSchoolConfigUpdate {
  schoolId?: number | null;
  revision: number;
  /** Backward-compatible during the SchoolProfile migration. */
  schoolName?: string | null;
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  daysOfWeek: SchoolWeekDay[];
  schoolStartTime: string;
  timezone: string;
  lowResourceMode: boolean;
}

export interface PeriodStructureUpdate {
  schoolId?: number | null;
  revision: number;
  defaultPeriodsPerDay: number;
  periodDuration: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: Partial<Record<SchoolWeekDay, number>>;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: Partial<Record<GradeCategory, Partial<Record<SchoolWeekDay, number>>>>;
  breakPeriods: BreakPeriodConfig[];
  breakPeriodsByDay: BreakPeriodsByDayConfig;
  prayerBreaksEnabled: boolean;
  prayerBreaks: PrayerBreakConfig[];
}

export interface OptimizationPreferencesDto {
  schoolId: number | null;
  revision: number;
  preferences: OptimizationPreferencesInput;
}

export interface OptimizationPreferencesUpdate extends OptimizationPreferencesDto {}
