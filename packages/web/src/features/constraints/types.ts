export type OptimizationStrength = 0 | 0.5 | 1 | 2;

export interface OptimizationPreferences {
  avoidTeacherGapsWeight: OptimizationStrength;
  avoidClassGapsWeight: OptimizationStrength;
  distributeDifficultSubjectsWeight: OptimizationStrength;
  balanceTeacherLoadWeight: OptimizationStrength;
  minimizeRoomChangesWeight: OptimizationStrength;
  preferMorningForDifficultWeight: OptimizationStrength;
  respectTeacherTimePreferenceWeight: OptimizationStrength;
  respectTeacherRoomPreferenceWeight: OptimizationStrength;
  respectPreferredColleaguesWeight: OptimizationStrength;
  preferClassHomeRoomWeight: OptimizationStrength;
  respectSubjectDesiredFeaturesWeight: OptimizationStrength;
  subjectSpreadWeight: OptimizationStrength;
  allowConsecutivePeriodsForSameSubject: boolean;
}

export interface OptimizationPreferencesProfile {
  schoolId: number | null;
  revision: number;
  preferences: OptimizationPreferences;
}

export type PresetId = 'teacher' | 'class' | 'balanced' | 'custom';
export type ConstraintWeightKey = Exclude<
  keyof OptimizationPreferences,
  'allowConsecutivePeriodsForSameSubject'
>;
export type ConstraintCategory = 'teacher' | 'class' | 'subject' | 'room';

export interface PresetConfig {
  id: PresetId;
  weights: OptimizationPreferences;
  isRecommended?: boolean;
}

export interface ConstraintInfo {
  key: ConstraintWeightKey;
  translationKey: string;
  category: ConstraintCategory;
}

export const DEFAULT_PREFERENCES: OptimizationPreferences = {
  avoidTeacherGapsWeight: 1,
  avoidClassGapsWeight: 1,
  distributeDifficultSubjectsWeight: 1,
  balanceTeacherLoadWeight: 0.5,
  minimizeRoomChangesWeight: 0.5,
  preferMorningForDifficultWeight: 0.5,
  respectTeacherTimePreferenceWeight: 0.5,
  respectTeacherRoomPreferenceWeight: 0.5,
  respectPreferredColleaguesWeight: 0.5,
  preferClassHomeRoomWeight: 2,
  respectSubjectDesiredFeaturesWeight: 0.5,
  subjectSpreadWeight: 1,
  allowConsecutivePeriodsForSameSubject: true,
};

export const CONSTRAINT_DEFINITIONS: ConstraintInfo[] = [
  { key: 'avoidTeacherGapsWeight', translationKey: 'avoidTeacherGaps', category: 'teacher' },
  { key: 'balanceTeacherLoadWeight', translationKey: 'balanceTeacherLoad', category: 'teacher' },
  { key: 'respectTeacherTimePreferenceWeight', translationKey: 'respectTeacherTimePreference', category: 'teacher' },
  { key: 'respectTeacherRoomPreferenceWeight', translationKey: 'respectTeacherRoomPreference', category: 'teacher' },
  { key: 'respectPreferredColleaguesWeight', translationKey: 'respectPreferredColleagues', category: 'teacher' },
  { key: 'avoidClassGapsWeight', translationKey: 'avoidClassGaps', category: 'class' },
  { key: 'distributeDifficultSubjectsWeight', translationKey: 'distributeDifficultSubjects', category: 'subject' },
  { key: 'preferMorningForDifficultWeight', translationKey: 'preferMorningForDifficult', category: 'subject' },
  { key: 'subjectSpreadWeight', translationKey: 'subjectSpread', category: 'subject' },
  { key: 'minimizeRoomChangesWeight', translationKey: 'minimizeRoomChanges', category: 'room' },
  { key: 'preferClassHomeRoomWeight', translationKey: 'preferClassHomeRoom', category: 'room' },
  { key: 'respectSubjectDesiredFeaturesWeight', translationKey: 'respectSubjectDesiredFeatures', category: 'room' },
];
