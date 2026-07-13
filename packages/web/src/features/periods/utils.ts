import type { WeekDay } from '@/features/school-settings/constants/defaults';
import type {
  BreakPeriodConfig,
  BreaksByDayMap,
  CategoryPeriodsMap,
  PeriodsPerDayMap,
} from './types';

interface EffectivePeriodsOptions {
  defaultPeriods: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap: PeriodsPerDayMap;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: CategoryPeriodsMap;
}

export function normalizeBreaks(breaks: BreakPeriodConfig[]): BreakPeriodConfig[] {
  const deduped = new Map<number, number>();

  for (const breakConfig of breaks) {
    if (breakConfig.afterPeriod < 1 || breakConfig.duration <= 0) {
      continue;
    }

    deduped.set(breakConfig.afterPeriod, breakConfig.duration);
  }

  return Array.from(deduped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([afterPeriod, duration]) => ({ afterPeriod, duration }));
}

export function clampBreaksToMaxPeriods(
  breaks: BreakPeriodConfig[],
  maxPeriods: number
): BreakPeriodConfig[] {
  if (maxPeriods <= 1) {
    return [];
  }

  return normalizeBreaks(breaks).filter((breakConfig) => breakConfig.afterPeriod < maxPeriods);
}

export function buildBreakSlotDurations(
  maxPeriods: number,
  breaks: BreakPeriodConfig[]
): Array<{ afterPeriod: number; duration: number }> {
  const clampedBreaks = clampBreaksToMaxPeriods(breaks, maxPeriods);
  const durationByPeriod = new Map(
    clampedBreaks.map((breakConfig) => [breakConfig.afterPeriod, breakConfig.duration])
  );

  return Array.from({ length: Math.max(maxPeriods - 1, 0) }, (_, index) => {
    const afterPeriod = index + 1;
    return {
      afterPeriod,
      duration: durationByPeriod.get(afterPeriod) ?? 0,
    };
  });
}

export function buildBreaksFromSlots(
  slots: Array<{ afterPeriod: number; duration: number }>
): BreakPeriodConfig[] {
  return normalizeBreaks(
    slots
      .filter((slot) => slot.duration > 0)
      .map((slot) => ({
        afterPeriod: slot.afterPeriod,
        duration: slot.duration,
      }))
  );
}

export function getEffectivePeriodsForDay(
  day: WeekDay,
  {
    defaultPeriods,
    dynamicPeriodsEnabled,
    periodsPerDayMap,
    categoryPeriodsEnabled,
    categoryPeriodsMap,
  }: EffectivePeriodsOptions
): number {
  if (categoryPeriodsEnabled) {
    let maxPeriods = 0;

    for (const categoryDayMap of Object.values(categoryPeriodsMap)) {
      const categoryPeriods = categoryDayMap?.[day];
      if (typeof categoryPeriods === 'number' && categoryPeriods > maxPeriods) {
        maxPeriods = categoryPeriods;
      }
    }

    if (maxPeriods > 0) {
      return maxPeriods;
    }
  }

  if (dynamicPeriodsEnabled && typeof periodsPerDayMap[day] === 'number') {
    return periodsPerDayMap[day] as number;
  }

  return defaultPeriods;
}

export function getMaxEffectivePeriods(
  activeDays: WeekDay[],
  options: EffectivePeriodsOptions
): number {
  const maximum = activeDays.reduce((maxPeriods, day) => {
    const periodsForDay = getEffectivePeriodsForDay(day, options);
    return Math.max(maxPeriods, periodsForDay);
  }, 0);
  return maximum || options.defaultPeriods;
}

export function getResolvedBreaksForDay(
  day: WeekDay,
  sharedBreaks: BreakPeriodConfig[],
  breaksByDay: BreaksByDayMap,
  maxPeriods: number
): BreakPeriodConfig[] {
  const override = breaksByDay[day];
  return clampBreaksToMaxPeriods(override ?? sharedBreaks, maxPeriods);
}

export function stripInactiveBreakOverrides(
  breaksByDay: BreaksByDayMap,
  activeDays: WeekDay[]
): BreaksByDayMap {
  const activeDaySet = new Set(activeDays);

  return Object.fromEntries(
    Object.entries(breaksByDay)
      .filter(([day]) => activeDaySet.has(day as WeekDay))
      .map(([day, breaks]) => [day, normalizeBreaks(breaks ?? [])])
  ) as BreaksByDayMap;
}
