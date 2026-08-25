import type { OptimizationPreferences, PresetConfig, PresetId } from '../types';
import { DEFAULT_PREFERENCES } from '../types';

const TEACHER_PRESET: OptimizationPreferences = {
  ...DEFAULT_PREFERENCES,
  avoidTeacherGapsWeight: 2,
  balanceTeacherLoadWeight: 2,
  respectTeacherTimePreferenceWeight: 2,
  respectTeacherRoomPreferenceWeight: 1,
  respectPreferredColleaguesWeight: 1,
  avoidClassGapsWeight: 0.5,
  distributeDifficultSubjectsWeight: 0.5,
  preferMorningForDifficultWeight: 0.5,
  subjectSpreadWeight: 0.5,
};

const CLASS_PRESET: OptimizationPreferences = {
  ...DEFAULT_PREFERENCES,
  avoidTeacherGapsWeight: 0.5,
  balanceTeacherLoadWeight: 0.5,
  respectTeacherTimePreferenceWeight: 0.5,
  respectTeacherRoomPreferenceWeight: 0.5,
  respectPreferredColleaguesWeight: 0.5,
  avoidClassGapsWeight: 2,
  distributeDifficultSubjectsWeight: 2,
  preferMorningForDifficultWeight: 2,
  subjectSpreadWeight: 1,
  minimizeRoomChangesWeight: 1,
  allowConsecutivePeriodsForSameSubject: false,
};

export const PRESETS: Record<PresetId, PresetConfig> = {
  teacher: { id: 'teacher', weights: TEACHER_PRESET },
  class: { id: 'class', weights: CLASS_PRESET },
  balanced: { id: 'balanced', weights: DEFAULT_PREFERENCES, isRecommended: true },
  custom: { id: 'custom', weights: DEFAULT_PREFERENCES },
};

export function getPreset(id: PresetId): PresetConfig {
  return PRESETS[id];
}

export function getAllPresets(): PresetConfig[] {
  return Object.values(PRESETS);
}

export function detectPreset(preferences: OptimizationPreferences): PresetId {
  for (const id of ['teacher', 'class', 'balanced'] as const) {
    if (preferencesMatch(preferences, PRESETS[id].weights)) return id;
  }
  return 'custom';
}

function preferencesMatch(a: OptimizationPreferences, b: OptimizationPreferences): boolean {
  return (Object.keys(a) as Array<keyof OptimizationPreferences>).every(
    (key) => a[key] === b[key]
  );
}
