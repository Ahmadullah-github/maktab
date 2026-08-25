import type { SchoolConfigDto } from '../types/schoolConfig.types';
import { buildCanonicalPeriodConfiguration } from '../utils/periodConfiguration';
import { normalizeUnavailableSlots } from '../utils/teacherContracts';

export interface TeacherCapacityInput {
  maxPeriodsPerWeek: number;
  unavailable: unknown;
}

function parseUnavailable(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Teacher capacity has exactly two authorities: the weekly contract and the
 * sparse unavailable-slot list projected onto the canonical school grid.
 */
export function calculateTeacherEffectiveCapacity(
  teacher: TeacherCapacityInput,
  config: SchoolConfigDto
): number {
  const canonical = buildCanonicalPeriodConfiguration({
    ...config,
    periodsPerDayMap: config.periodsPerDayMap as Record<string, number>,
    categoryPeriodsMap: config.categoryPeriodsMap as Record<string, Record<string, number>>,
  });
  const activeDays = new Set(config.daysOfWeek.map((day) => day.toLowerCase()));
  const unavailable = new Set(
    normalizeUnavailableSlots(parseUnavailable(teacher.unavailable))
      .filter((slot) => activeDays.has(slot.day.toLowerCase()))
      .map((slot) => `${slot.day.toLowerCase()}:${slot.period}`)
  );

  const availableCalendarSlots = config.daysOfWeek.reduce((total, day) => {
    const periods = canonical.periodsPerDayMap[day] ?? config.defaultPeriodsPerDay;
    let available = 0;
    for (let period = 0; period < periods; period += 1) {
      if (!unavailable.has(`${day.toLowerCase()}:${period}`)) available += 1;
    }
    return total + available;
  }, 0);

  return Math.min(Math.max(0, teacher.maxPeriodsPerWeek), availableCalendarSlots);
}
