import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findLatestScheduleId,
  getScheduleSelectionPreference,
  resolveScheduleIdForEntry,
  setLatestSchedulePreference,
  setManualSchedulePreference,
} from '../utils/scheduleSelectionPreference';

describe('scheduleSelectionPreference', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to latest mode when nothing is stored', () => {
    expect(getScheduleSelectionPreference()).toEqual({
      mode: 'latest',
      scheduleId: null,
    });
  });

  it('returns the latest schedule by createdAt', () => {
    expect(
      findLatestScheduleId([
        { id: 11, createdAt: '2026-04-01T10:00:00Z' },
        { id: 13, createdAt: '2026-04-02T10:00:00Z' },
        { id: 12, createdAt: '2026-04-01T12:00:00Z' },
      ] as Parameters<typeof findLatestScheduleId>[0])
    ).toBe(13);
  });

  it('keeps a manual schedule when it still exists', () => {
    setManualSchedulePreference(12);

    expect(
      resolveScheduleIdForEntry(
        [
          { id: 11, createdAt: '2026-04-01T10:00:00Z' },
          { id: 13, createdAt: '2026-04-02T10:00:00Z' },
          { id: 12, createdAt: '2026-04-01T12:00:00Z' },
        ] as Parameters<typeof resolveScheduleIdForEntry>[0],
        getScheduleSelectionPreference()
      )
    ).toBe(12);
  });

  it('falls back to the latest schedule when the manual selection no longer exists', () => {
    setManualSchedulePreference(12);

    expect(
      resolveScheduleIdForEntry(
        [
          { id: 11, createdAt: '2026-04-01T10:00:00Z' },
          { id: 13, createdAt: '2026-04-02T10:00:00Z' },
        ] as Parameters<typeof resolveScheduleIdForEntry>[0],
        getScheduleSelectionPreference()
      )
    ).toBe(13);
  });

  it('resolves to the latest schedule in latest mode', () => {
    setLatestSchedulePreference();

    expect(
      resolveScheduleIdForEntry(
        [
          { id: 11, createdAt: '2026-04-01T10:00:00Z' },
          { id: 13, createdAt: '2026-04-02T10:00:00Z' },
        ] as Parameters<typeof resolveScheduleIdForEntry>[0],
        getScheduleSelectionPreference()
      )
    ).toBe(13);
  });
});
