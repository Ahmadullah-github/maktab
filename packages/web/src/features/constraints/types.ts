/**
 * Types for the Constraints (Optimization Preferences) feature
 * Matches the GlobalPreferencesSchema from packages/api/schema.ts
 */

/**
 * Optimization preferences for timetable generation
 * All weights are 0-2 range where 0 = disabled, higher = more important
 */
export interface OptimizationPreferences {
  // Weights for soft constraints
  avoidTeacherGapsWeight: number;
  avoidClassGapsWeight: number;
  distributeDifficultSubjectsWeight: number;
  balanceTeacherLoadWeight: number;
  minimizeRoomChangesWeight: number;
  preferMorningForDifficultWeight: number;
  respectTeacherTimePreferenceWeight: number;
  respectTeacherRoomPreferenceWeight: number;
  avoidFirstLastPeriodWeight: number;
  subjectSpreadWeight: number;

  // Capability toggles
  allowConsecutivePeriodsForSameSubject: boolean;
}

// ============================================================================
// Preset System Types
// ============================================================================

/**
 * Available preset identifiers
 */
export type PresetId = 'teacher' | 'class' | 'balanced' | 'fast' | 'custom';

/**
 * Constraint weight keys (excludes boolean toggles)
 */
export type ConstraintWeightKey = Exclude<
  keyof OptimizationPreferences,
  'allowConsecutivePeriodsForSameSubject'
>;

/**
 * Single constraint item for ranking UI
 */
export interface ConstraintRankItem {
  /** Constraint key from OptimizationPreferences */
  key: ConstraintWeightKey;
  /** Whether this constraint is enabled */
  enabled: boolean;
  /** Rank position (1 = highest priority, higher = lower priority) */
  rank: number;
  /** Category for grouping in UI */
  category: ConstraintCategory;
}

/**
 * Preset configuration with weights and metadata
 */
export interface PresetConfig {
  /** Unique preset identifier */
  id: PresetId;
  /** Lucide icon name */
  icon: string;
  /** Full weight configuration */
  weights: OptimizationPreferences;
  /** Whether this is the recommended default */
  isRecommended?: boolean;
}

/**
 * Saved preferences with selected preset tracking
 */
export interface SavedPreferences {
  /** Currently selected preset */
  selectedPreset: PresetId;
  /** Current weight values */
  preferences: OptimizationPreferences;
  /** Custom ranking order (only used when preset is 'custom') */
  customRanking?: ConstraintRankItem[];
}

// ============================================================================
// Problem Size Types
// ============================================================================

/**
 * Problem size categories based on request count
 */
export type ProblemSize = 'small' | 'medium' | 'large';

/**
 * Problem size thresholds and their implications
 */
export interface ProblemSizeInfo {
  size: ProblemSize;
  requestCount: number;
  /** Which constraints will actually be applied */
  activeConstraintLevel: 'all' | 'critical-important' | 'critical-only';
  /** Recommended preset for this size */
  recommendedPreset: PresetId;
}

/**
 * Default values for optimization preferences
 */
export const DEFAULT_PREFERENCES: OptimizationPreferences = {
  avoidTeacherGapsWeight: 1.0,
  avoidClassGapsWeight: 1.0,
  distributeDifficultSubjectsWeight: 0.8,
  balanceTeacherLoadWeight: 0.7,
  minimizeRoomChangesWeight: 0.3,
  preferMorningForDifficultWeight: 0.5,
  respectTeacherTimePreferenceWeight: 0.5,
  respectTeacherRoomPreferenceWeight: 0.2,
  avoidFirstLastPeriodWeight: 0,
  subjectSpreadWeight: 0,
  allowConsecutivePeriodsForSameSubject: true,
};

/**
 * Constraint categories for grouping
 */
export type ConstraintCategory = 'teacher' | 'class' | 'subject' | 'room' | 'general';

/**
 * Constraint metadata for UI display
 */
export interface ConstraintInfo {
  key: keyof OptimizationPreferences;
  type: 'weight' | 'toggle';
  defaultValue: number | boolean;
  category: ConstraintCategory;
  /** Priority level for constraint budget system */
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * All constraint definitions with metadata
 */
export const CONSTRAINT_DEFINITIONS: ConstraintInfo[] = [
  // Teacher constraints
  {
    key: 'avoidTeacherGapsWeight',
    type: 'weight',
    defaultValue: 1.0,
    category: 'teacher',
    priority: 'high',
  },
  {
    key: 'balanceTeacherLoadWeight',
    type: 'weight',
    defaultValue: 0.7,
    category: 'teacher',
    priority: 'high',
  },
  {
    key: 'respectTeacherTimePreferenceWeight',
    type: 'weight',
    defaultValue: 0.5,
    category: 'teacher',
    priority: 'medium',
  },
  {
    key: 'respectTeacherRoomPreferenceWeight',
    type: 'weight',
    defaultValue: 0.2,
    category: 'teacher',
    priority: 'low',
  },

  // Class constraints
  {
    key: 'avoidClassGapsWeight',
    type: 'weight',
    defaultValue: 1.0,
    category: 'class',
    priority: 'high',
  },

  // Subject constraints
  {
    key: 'distributeDifficultSubjectsWeight',
    type: 'weight',
    defaultValue: 0.8,
    category: 'subject',
    priority: 'medium',
  },
  {
    key: 'preferMorningForDifficultWeight',
    type: 'weight',
    defaultValue: 0.5,
    category: 'subject',
    priority: 'critical',
  },
  {
    key: 'subjectSpreadWeight',
    type: 'weight',
    defaultValue: 0,
    category: 'subject',
    priority: 'medium',
  },
  {
    key: 'allowConsecutivePeriodsForSameSubject',
    type: 'toggle',
    defaultValue: true,
    category: 'subject',
    priority: 'high',
  },

  // Room constraints
  {
    key: 'minimizeRoomChangesWeight',
    type: 'weight',
    defaultValue: 0.3,
    category: 'room',
    priority: 'low',
  },

  // General constraints
  {
    key: 'avoidFirstLastPeriodWeight',
    type: 'weight',
    defaultValue: 0,
    category: 'general',
    priority: 'critical',
  },
];
