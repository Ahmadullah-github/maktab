import { z } from 'zod';
import { ALL_WEEK_DAYS } from '@/features/school-settings/constants/defaults';

/**
 * Maximum allowed length for teacher full name
 */
export const TEACHER_NAME_MAX_LENGTH = 255;

/**
 * Time preference enum for teacher scheduling
 */
export const TimePreferenceEnum = z.enum(['morning', 'afternoon', 'any']);
export type TimePreference = z.infer<typeof TimePreferenceEnum>;

/**
 * Unavailable slot schema representing a day-period combination
 */
export const unavailableSlotSchema = z.object({
  day: z.enum(ALL_WEEK_DAYS),
  period: z.number().int().min(0),
});

export type UnavailableSlotInput = z.infer<typeof unavailableSlotSchema>;

/**
 * Class assignment schema linking a subject to classes
 */
export const classAssignmentSchema = z.object({
  subjectId: z.number().int().positive(),
  classIds: z.array(z.number().int().positive()),
});

export type ClassAssignmentInput = z.infer<typeof classAssignmentSchema>;

/**
 * Custom refinement to check if a string is not whitespace-only
 * Returns true if the string contains at least one non-whitespace character
 */
const isNotWhitespaceOnly = (value: string): boolean => {
  return value.trim().length > 0;
};

/**
 * Zod schema for teacher form validation
 * Uses i18n translation keys for localized error messages
 *
 * Requirements: 2.1, 2.2, 2.3, 9.3
 */
export const teacherFormSchema = z.object({
  fullName: z
    .string()
    .min(1, 'teachers.validation.nameRequired')
    .max(TEACHER_NAME_MAX_LENGTH, 'teachers.validation.nameTooLong')
    .refine(isNotWhitespaceOnly, 'teachers.validation.nameRequired'),

  primarySubjectIds: z.array(z.number().int().positive()),
  allowedSubjectIds: z.array(z.number().int().positive()),
  restrictToPrimarySubjects: z.boolean(),

  unavailable: z.array(unavailableSlotSchema),

  maxPeriodsPerWeek: z.number().int().min(1),
  maxPeriodsPerDay: z.number().int().min(1),
  maxConsecutivePeriods: z.number().int().min(1).max(2),

  timePreference: TimePreferenceEnum,
});

export type TeacherFormValues = z.infer<typeof teacherFormSchema>;

/**
 * Helper to transform form values to API payload
 * Serializes arrays to JSON strings for API storage
 */
export const toTeacherApiPayload = (values: TeacherFormValues) => {
  return {
    fullName: values.fullName,
    primarySubjectIds: JSON.stringify(values.primarySubjectIds),
    allowedSubjectIds: JSON.stringify(values.allowedSubjectIds),
    restrictToPrimarySubjects: values.restrictToPrimarySubjects,
    unavailable: JSON.stringify(values.unavailable),
    maxPeriodsPerWeek: values.maxPeriodsPerWeek,
    maxPeriodsPerDay: values.maxPeriodsPerDay,
    maxConsecutivePeriods: values.maxConsecutivePeriods,
    timePreference: values.timePreference,
  };
};

/**
 * Helper to parse API response to form values
 * Deserializes JSON strings to arrays
 */
export const fromTeacherApiResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teacher: any
): TeacherFormValues => {
  let unavailable: UnavailableSlotInput[] = [];
  let primarySubjectIds: number[] = [];
  let allowedSubjectIds: number[] = [];

  // Parse unavailable slots
  if (typeof teacher.unavailable === 'string') {
    try {
      const parsed = JSON.parse(teacher.unavailable || '[]');
      if (Array.isArray(parsed)) {
        unavailable = parsed;
      }
    } catch {
      console.warn('Failed to parse unavailable JSON', teacher.unavailable);
    }
  } else if (Array.isArray(teacher.unavailable)) {
    unavailable = teacher.unavailable;
  }

  // Parse primary subject IDs
  if (typeof teacher.primarySubjectIds === 'string') {
    try {
      const parsed = JSON.parse(teacher.primarySubjectIds || '[]');
      if (Array.isArray(parsed)) {
        primarySubjectIds = parsed.map(Number);
      }
    } catch {
      console.warn('Failed to parse primarySubjectIds JSON', teacher.primarySubjectIds);
    }
  } else if (Array.isArray(teacher.primarySubjectIds)) {
    primarySubjectIds = teacher.primarySubjectIds.map(Number);
  }

  // Parse allowed subject IDs
  if (typeof teacher.allowedSubjectIds === 'string') {
    try {
      const parsed = JSON.parse(teacher.allowedSubjectIds || '[]');
      if (Array.isArray(parsed)) {
        allowedSubjectIds = parsed.map(Number);
      }
    } catch {
      console.warn('Failed to parse allowedSubjectIds JSON', teacher.allowedSubjectIds);
    }
  } else if (Array.isArray(teacher.allowedSubjectIds)) {
    allowedSubjectIds = teacher.allowedSubjectIds.map(Number);
  }

  return {
    fullName: teacher.fullName || '',
    primarySubjectIds,
    allowedSubjectIds,
    restrictToPrimarySubjects: teacher.restrictToPrimarySubjects ?? true,
    unavailable,
    maxPeriodsPerWeek: teacher.maxPeriodsPerWeek || 1,
    maxPeriodsPerDay: teacher.maxPeriodsPerDay || 1,
    maxConsecutivePeriods: teacher.maxConsecutivePeriods || 2,
    timePreference: teacher.timePreference || 'any',
  };
};
