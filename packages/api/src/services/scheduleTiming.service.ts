import type { SchoolConfigDto, SchoolWeekDay } from '../types/schoolConfig.types';
import { buildCanonicalPeriodConfiguration } from '../utils/periodConfiguration';

export interface PeriodTimeRange {
  periodIndex: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleBreakInterval {
  kind: 'regular' | 'prayer';
  name?: string;
  startTime: string;
  endTime: string;
  duration: number;
  afterPeriod?: number;
}

export interface ScheduleTimingMetadata {
  schoolStartTime: string;
  timezone: string;
  effectivePeriodDurationMinutes: number;
  periodTimelineByDay: Record<string, PeriodTimeRange[]>;
  breakIntervalsByDay: Record<string, ScheduleBreakInterval[]>;
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes: number): string {
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return dayOffset > 0 ? `${time} (+${dayOffset})` : time;
}

function periodsForDay(config: SchoolConfigDto, day: SchoolWeekDay): number {
  return buildCanonicalPeriodConfiguration(config).periodsPerDayMap[day];
}

export function buildScheduleTiming(config: SchoolConfigDto): ScheduleTimingMetadata {
  const duration = config.periodDuration;
  const prayerIntervals = config.prayerBreaksEnabled
    ? config.prayerBreaks
        .map((prayerBreak) => ({
          ...prayerBreak,
          start: toMinutes(prayerBreak.time),
          end: toMinutes(prayerBreak.time) + prayerBreak.duration,
        }))
        .sort((left, right) => left.start - right.start)
    : [];

  const periodTimelineByDay: Record<string, PeriodTimeRange[]> = {};
  const breakIntervalsByDay: Record<string, ScheduleBreakInterval[]> = {};

  for (const day of config.daysOfWeek) {
    let cursor = toMinutes(config.schoolStartTime);
    const periods: PeriodTimeRange[] = [];
    const breaks: Array<ScheduleBreakInterval & { startMinutes: number }> = prayerIntervals.map(
      (prayerBreak) => ({
        kind: 'prayer',
        name: prayerBreak.name,
        startTime: formatMinutes(prayerBreak.start),
        endTime: formatMinutes(prayerBreak.end),
        duration: prayerBreak.duration,
        startMinutes: prayerBreak.start,
      })
    );
    const hasDayOverride = Object.prototype.hasOwnProperty.call(config.breakPeriodsByDay, day);
    const regularBreaks = hasDayOverride
      ? (config.breakPeriodsByDay[day] ?? [])
      : config.breakPeriods;
    const regularBreakByPeriod = new Map(
      regularBreaks.map((regularBreak) => [regularBreak.afterPeriod, regularBreak.duration])
    );

    for (let periodIndex = 0; periodIndex < periodsForDay(config, day); periodIndex += 1) {
      let proposedEnd = cursor + duration;
      for (const prayerBreak of prayerIntervals) {
        if (cursor < prayerBreak.end && proposedEnd > prayerBreak.start) {
          cursor = prayerBreak.end;
          proposedEnd = cursor + duration;
        }
      }

      periods.push({
        periodIndex,
        startTime: formatMinutes(cursor),
        endTime: formatMinutes(proposedEnd),
      });
      cursor = proposedEnd;

      const afterPeriod = periodIndex + 1;
      const breakDuration = regularBreakByPeriod.get(afterPeriod);
      if (breakDuration !== undefined) {
        breaks.push({
          kind: 'regular',
          startTime: formatMinutes(cursor),
          endTime: formatMinutes(cursor + breakDuration),
          duration: breakDuration,
          afterPeriod,
          startMinutes: cursor,
        });
        cursor += breakDuration;
      }
    }

    periodTimelineByDay[day] = periods;
    breakIntervalsByDay[day] = breaks
      .sort((left, right) => left.startMinutes - right.startMinutes)
      .map(({ startMinutes: _startMinutes, ...interval }) => interval);
  }

  return {
    schoolStartTime: config.schoolStartTime,
    timezone: config.timezone,
    effectivePeriodDurationMinutes: duration,
    periodTimelineByDay,
    breakIntervalsByDay,
  };
}

export function enrichGeneratedScheduleTiming(
  solverData: unknown,
  config: SchoolConfigDto
): unknown {
  if (!solverData || typeof solverData !== 'object' || Array.isArray(solverData)) return solverData;
  const data = solverData as Record<string, unknown>;
  const metadata =
    data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  const periodConfiguration =
    metadata.periodConfiguration &&
    typeof metadata.periodConfiguration === 'object' &&
    !Array.isArray(metadata.periodConfiguration)
      ? (metadata.periodConfiguration as Record<string, unknown>)
      : {};

  data.metadata = {
    ...metadata,
    periodConfiguration: {
      ...periodConfiguration,
      ...buildScheduleTiming(config),
    },
  };
  return data;
}
