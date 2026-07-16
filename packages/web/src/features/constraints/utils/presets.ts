/**
 * Preset configurations for optimization preferences
 * Each preset is optimized for a specific use case
 */

import type { OptimizationPreferences, PresetConfig, PresetId } from '../types';
import { DEFAULT_PREFERENCES } from '../types';

/**
 * Teacher-focused preset
 * Prioritizes teacher comfort: minimal gaps, balanced load, respects preferences
 */
const TEACHER_PRESET: OptimizationPreferences = {
  avoidTeacherGapsWeight: 2.0,
  balanceTeacherLoadWeight: 1.5,
  respectTeacherTimePreferenceWeight: 1.5,
  respectTeacherRoomPreferenceWeight: 1.0,
  preferClassHomeRoomWeight: 3.0,
  respectSubjectDesiredFeaturesWeight: 0.3,
  avoidClassGapsWeight: 0.5,
  distributeDifficultSubjectsWeight: 0.5,
  preferMorningForDifficultWeight: 0.3,
  subjectSpreadWeight: 0.3,
  minimizeRoomChangesWeight: 0.5,
  avoidFirstLastPeriodWeight: 0.3,
  allowConsecutivePeriodsForSameSubject: true,
};

/**
 * Class-focused preset
 * Prioritizes student learning: no gaps, difficult subjects in morning, good spread
 */
const CLASS_PRESET: OptimizationPreferences = {
  avoidTeacherGapsWeight: 0.5,
  balanceTeacherLoadWeight: 0.5,
  respectTeacherTimePreferenceWeight: 0.3,
  respectTeacherRoomPreferenceWeight: 0.2,
  preferClassHomeRoomWeight: 5.0,
  respectSubjectDesiredFeaturesWeight: 0.5,
  avoidClassGapsWeight: 2.0,
  distributeDifficultSubjectsWeight: 1.5,
  preferMorningForDifficultWeight: 1.5,
  subjectSpreadWeight: 1.0,
  minimizeRoomChangesWeight: 1.0,
  avoidFirstLastPeriodWeight: 0.5,
  allowConsecutivePeriodsForSameSubject: false,
};

/**
 * Balanced preset (recommended default)
 * Good balance between teacher and student needs
 */
const BALANCED_PRESET: OptimizationPreferences = {
  ...DEFAULT_PREFERENCES,
};

/**
 * Fast preset
 * Minimal constraints for large/complex problems
 * Only critical constraints enabled
 */
const FAST_PRESET: OptimizationPreferences = {
  avoidTeacherGapsWeight: 0,
  balanceTeacherLoadWeight: 0,
  respectTeacherTimePreferenceWeight: 0,
  respectTeacherRoomPreferenceWeight: 0,
  preferClassHomeRoomWeight: 0,
  respectSubjectDesiredFeaturesWeight: 0,
  avoidClassGapsWeight: 0,
  distributeDifficultSubjectsWeight: 0,
  preferMorningForDifficultWeight: 0.5,
  subjectSpreadWeight: 0,
  minimizeRoomChangesWeight: 0,
  avoidFirstLastPeriodWeight: 0.5,
  allowConsecutivePeriodsForSameSubject: true,
};

/**
 * Custom preset starts with balanced values
 * User can modify via ranking UI
 */
const CUSTOM_PRESET: OptimizationPreferences = {
  ...DEFAULT_PREFERENCES,
};

/**
 * All preset configurations with metadata
 */
export const PRESETS: Record<PresetId, PresetConfig> = {
  teacher: {
    id: 'teacher',
    icon: 'Users',
    weights: TEACHER_PRESET,
    isRecommended: false,
  },
  class: {
    id: 'class',
    icon: 'GraduationCap',
    weights: CLASS_PRESET,
    isRecommended: false,
  },
  balanced: {
    id: 'balanced',
    icon: 'Scale',
    weights: BALANCED_PRESET,
    isRecommended: true,
  },
  fast: {
    id: 'fast',
    icon: 'Zap',
    weights: FAST_PRESET,
    isRecommended: false,
  },
  custom: {
    id: 'custom',
    icon: 'SlidersHorizontal',
    weights: CUSTOM_PRESET,
    isRecommended: false,
  },
};

/**
 * Get preset configuration by ID
 */
export function getPreset(id: PresetId): PresetConfig {
  return PRESETS[id];
}

/**
 * Get all presets as array (for rendering)
 */
export function getAllPresets(): PresetConfig[] {
  return Object.values(PRESETS);
}

/**
 * Check if current preferences match a preset
 * Returns the matching preset ID or 'custom' if no match
 */
export function detectPreset(preferences: OptimizationPreferences): PresetId {
  const presetIds: PresetId[] = ['teacher', 'class', 'balanced', 'fast'];

  for (const id of presetIds) {
    const preset = PRESETS[id];
    if (preferencesMatch(preferences, preset.weights)) {
      return id;
    }
  }

  return 'custom';
}

/**
 * Compare two preference objects for equality
 */
function preferencesMatch(a: OptimizationPreferences, b: OptimizationPreferences): boolean {
  const keys = Object.keys(a) as (keyof OptimizationPreferences)[];

  return keys.every((key) => {
    const valA = a[key];
    const valB = b[key];

    if (typeof valA === 'number' && typeof valB === 'number') {
      // Allow small floating point differences
      return Math.abs(valA - valB) < 0.01;
    }

    return valA === valB;
  });
}
