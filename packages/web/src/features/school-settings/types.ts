import type { TimezoneValue, WeekDay } from './constants/defaults';

export interface BreakPeriodConfig {
  afterPeriod: number;
  duration: number;
}

export interface PrayerBreakConfig {
  name: string;
  time: string;
  duration: number;
}

export type BreakPeriodsByDay = Partial<Record<WeekDay, BreakPeriodConfig[]>>;
export type PeriodsPerDayMap = Partial<Record<WeekDay, number>>;
export type GradeCategoryKey = 'Alpha-Primary' | 'Beta-Primary' | 'Middle' | 'High';
export type CategoryPeriodsMap = Partial<Record<GradeCategoryKey, PeriodsPerDayMap>>;

/** Canonical structured response shared by every school-configuration consumer. */
export interface SchoolConfigDto {
  id: number;
  schoolId: number | null;
  revision: number;
  schoolName: string | null;
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  daysOfWeek: WeekDay[];
  daysPerWeek: number;
  schoolStartTime: string;
  timezone: TimezoneValue;
  autoPopulateCurriculum: boolean;
  lowResourceMode: boolean;
  defaultPeriodsPerDay: number;
  periodDuration: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: PeriodsPerDayMap;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: CategoryPeriodsMap;
  breakPeriods: BreakPeriodConfig[];
  breakPeriodsByDay: BreakPeriodsByDay;
  prayerBreaksEnabled: boolean;
  prayerBreaks: PrayerBreakConfig[];
  createdAt: string;
  updatedAt: string;
}

export type SchoolConfig = SchoolConfigDto;

export type GeneralSchoolConfigPayload = Pick<
  SchoolConfigDto,
  | 'schoolId'
  | 'revision'
  | 'schoolName'
  | 'enablePrimary'
  | 'enableMiddle'
  | 'enableHigh'
  | 'daysOfWeek'
  | 'schoolStartTime'
  | 'timezone'
  | 'lowResourceMode'
>;
