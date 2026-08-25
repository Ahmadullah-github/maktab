import type { TimetableApiResponse } from '../types';

const STORAGE_KEY = 'maktab-schedule-selection-preference';

export type ScheduleSelectionMode = 'latest' | 'manual';

export interface ScheduleSelectionPreference {
  mode: ScheduleSelectionMode;
  scheduleId: number | null;
}

const DEFAULT_PREFERENCE: ScheduleSelectionPreference = {
  mode: 'latest',
  scheduleId: null,
};

function isValidPreference(value: unknown): value is ScheduleSelectionPreference {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const parsed = value as Record<string, unknown>;
  const mode = parsed.mode;
  const scheduleId = parsed.scheduleId;

  return (
    (mode === 'latest' || mode === 'manual') &&
    (scheduleId === null || (typeof scheduleId === 'number' && Number.isFinite(scheduleId)))
  );
}

export function getScheduleSelectionPreference(): ScheduleSelectionPreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCE;
    }

    const parsed = JSON.parse(stored);
    return isValidPreference(parsed) ? parsed : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function setScheduleSelectionPreference(
  preference: ScheduleSelectionPreference
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Ignore storage failures. The route will fall back to latest mode.
  }
}

export function setLatestSchedulePreference(): void {
  setScheduleSelectionPreference({
    mode: 'latest',
    scheduleId: null,
  });
}

export function setManualSchedulePreference(scheduleId: number): void {
  setScheduleSelectionPreference({
    mode: 'manual',
    scheduleId,
  });
}

export function findLatestScheduleId(
  schedules: Pick<TimetableApiResponse, 'id' | 'createdAt'>[]
): number | null {
  if (schedules.length === 0) {
    return null;
  }

  const latest = schedules.reduce((currentLatest, candidate) => {
    return new Date(candidate.createdAt).getTime() > new Date(currentLatest.createdAt).getTime()
      ? candidate
      : currentLatest;
  });

  return latest.id;
}

export function resolveScheduleIdForEntry(
  schedules: Pick<TimetableApiResponse, 'id' | 'createdAt'>[],
  preference: ScheduleSelectionPreference
): number | null {
  const latestScheduleId = findLatestScheduleId(schedules);
  if (latestScheduleId === null) {
    return null;
  }

  if (preference.mode === 'manual' && preference.scheduleId !== null) {
    const selectedScheduleExists = schedules.some((schedule) => schedule.id === preference.scheduleId);
    if (selectedScheduleExists) {
      return preference.scheduleId;
    }
  }

  return latestScheduleId;
}



