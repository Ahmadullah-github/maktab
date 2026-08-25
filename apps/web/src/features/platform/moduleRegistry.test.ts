import { describe, expect, it } from 'vitest';

import { platformModules } from './moduleRegistry';

describe('platform module registry', () => {
  it('keeps module codes unique and exposes the offline timetable boundary', () => {
    const codes = platformModules.map((module) => module.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(platformModules.find((module) => module.code === 'timetable')?.delivery).toBe('offline');
    expect(platformModules.filter((module) => module.delivery === 'offline')).toHaveLength(1);
  });
});
