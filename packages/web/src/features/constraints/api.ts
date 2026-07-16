import { api } from '@/lib/api';
import { z } from 'zod';
import type { OptimizationPreferences, OptimizationPreferencesProfile } from './types';

const strength = z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(2)]);
export const optimizationPreferencesSchema = z
  .object({
    avoidTeacherGapsWeight: strength,
    avoidClassGapsWeight: strength,
    distributeDifficultSubjectsWeight: strength,
    balanceTeacherLoadWeight: strength,
    minimizeRoomChangesWeight: strength,
    preferMorningForDifficultWeight: strength,
    respectTeacherTimePreferenceWeight: strength,
    respectTeacherRoomPreferenceWeight: strength,
    respectPreferredColleaguesWeight: strength,
    preferClassHomeRoomWeight: strength,
    respectSubjectDesiredFeaturesWeight: strength,
    subjectSpreadWeight: strength,
    allowConsecutivePeriodsForSameSubject: z.boolean(),
  })
  .strict();

const profileSchema = z
  .object({
    schoolId: z.number().int().positive().nullable(),
    revision: z.number().int().positive(),
    preferences: optimizationPreferencesSchema,
  })
  .strict();

export function parsePreferencesProfile(value: unknown): OptimizationPreferencesProfile {
  return profileSchema.parse(value) as OptimizationPreferencesProfile;
}

export async function fetchPreferences(
  schoolId: number | null = null
): Promise<OptimizationPreferencesProfile> {
  return parsePreferencesProfile(await api.config.getOptimizationPreferences(schoolId));
}

export async function savePreferences(
  profile: OptimizationPreferencesProfile
): Promise<OptimizationPreferencesProfile> {
  const payload = {
    schoolId: profile.schoolId,
    revision: profile.revision,
    preferences: optimizationPreferencesSchema.parse(profile.preferences) as OptimizationPreferences,
  };
  return parsePreferencesProfile(await api.config.updateOptimizationPreferences(payload));
}
