import { describe, expect, it } from 'vitest';
import en from './i18n/en.json';
import fa from './i18n/fa.json';
import { optimizationPreferencesSchema, parsePreferencesProfile } from './api';
import { CONSTRAINT_DEFINITIONS, DEFAULT_PREFERENCES } from './types';
import { PRESETS, detectPreset } from './utils/presets';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('constraints contracts', () => {
  it('accepts only canonical strength levels and a complete strict profile', () => {
    expect(optimizationPreferencesSchema.parse(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
    expect(() => optimizationPreferencesSchema.parse({
      ...DEFAULT_PREFERENCES,
      preferClassHomeRoomWeight: 0.3,
    })).toThrow();
    expect(() => parsePreferencesProfile({
      schoolId: null,
      revision: 1,
      preferences: { ...DEFAULT_PREFERENCES, unknownWeight: 1 },
    })).toThrow();
  });

  it('keeps every preset lossless and detects custom edits', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(optimizationPreferencesSchema.parse(preset.weights)).toEqual(preset.weights);
    }
    expect(detectPreset(DEFAULT_PREFERENCES)).toBe('balanced');
    expect(detectPreset({ ...DEFAULT_PREFERENCES, avoidTeacherGapsWeight: 2 })).toBe('custom');
    expect(CONSTRAINT_DEFINITIONS).toHaveLength(12);
  });

  it('keeps English and Farsi feature catalogs in parity', () => {
    expect(leafKeys(en).sort()).toEqual(leafKeys(fa).sort());
  });
});
