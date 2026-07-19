import { z } from 'zod';
import { ALL_WEEK_DAYS } from '@/features/school-settings/constants/defaults';

/**
 * Maximum allowed length for teacher full name
 */
export const TEACHER_NAME_MAX_LENGTH = 255;
export const TEACHER_STAFF_CODE_MAX_LENGTH = 50;

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
    .refine(isNotWhitespaceOnly, 'teachers.validation.nameRequired')
    .transform((value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ')),

  staffCode: z
    .string()
    .min(1, 'teachers.validation.staffCodeRequired')
    .max(TEACHER_STAFF_CODE_MAX_LENGTH, 'teachers.validation.staffCodeTooLong')
    .transform((value) => value.normalize('NFKC').trim().replace(/\s+/g, '-').toUpperCase()),

  employmentType: z.enum(['full_time', 'part_time']),

  primarySubjectIds: z.array(z.number().int().positive()),
  allowedSubjectIds: z.array(z.number().int().positive()),
  restrictToPrimarySubjects: z.boolean(),

  unavailable: z.array(unavailableSlotSchema),

  maxPeriodsPerWeek: z.number().int().min(0),

  timePreference: TimePreferenceEnum,
  preferredRoomIds: z.array(z.number().int().positive()),
  preferredColleagues: z.array(z.number().int().positive()),
}).superRefine((value, context) => {
  const keys = value.unavailable.map((slot) => `${slot.day}:${slot.period}`);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({
      code: 'custom',
      path: ['unavailable'],
      message: 'teachers.validation.duplicateUnavailableSlot',
    });
  }
});

export type TeacherFormValues = z.infer<typeof teacherFormSchema>;
