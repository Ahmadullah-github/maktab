import { z } from 'zod';

/**
 * Zod schema for subject requirement configuration
 */
export const subjectRequirementSchema = z.object({
  subjectId: z.number().int().positive(),
  periodsPerWeek: z.number().int().min(1).max(20),
  teacherId: z.number().int().positive().nullable().optional(),
});

export type SubjectRequirementInput = z.infer<typeof subjectRequirementSchema>;

/**
 * Zod schema for class form validation
 * Uses i18n translation keys for localized error messages
 */
export const classFormSchema = z.object({
  name: z
    .string()
    .min(1, 'classes.validation.nameRequired')
    .max(255, 'classes.validation.nameTooLong'),
  displayName: z.string().max(100).optional(),
  grade: z
    .number()
    .int()
    .min(1, 'classes.validation.invalidGrade')
    .max(12, 'classes.validation.invalidGrade')
    .nullable(),
  sectionIndex: z.string().max(10).optional().default(''),
  studentCount: z.number().int().min(0).max(500).default(0),
  fixedRoomId: z.number().int().nullable().optional(),
  singleTeacherMode: z.boolean().default(false),
  classTeacherId: z.number().int().nullable().optional(),
  subjectRequirements: z.array(subjectRequirementSchema).default([]),
});

export type ClassFormValues = z.infer<typeof classFormSchema>;

/**
 * Helper to transform form values to API payload
 * Serializes subjectRequirements array to JSON string
 */
export const toClassApiPayload = (values: ClassFormValues) => {
  return {
    ...values,
    subjectRequirements: JSON.stringify(values.subjectRequirements),
  };
};

/**
 * Helper to parse API response to form values
 * Deserializes subjectRequirements JSON string to array
 */
export const fromClassApiResponse = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classData: any
): ClassFormValues => {
  let subjectRequirements: SubjectRequirementInput[] = [];

  if (typeof classData.subjectRequirements === 'string') {
    try {
      const parsed = JSON.parse(classData.subjectRequirements || '[]');
      if (Array.isArray(parsed)) {
        subjectRequirements = parsed;
      }
    } catch {
      // Log warning but continue with empty array
      console.warn('Failed to parse subjectRequirements JSON', classData.subjectRequirements);
    }
  } else if (Array.isArray(classData.subjectRequirements)) {
    subjectRequirements = classData.subjectRequirements;
  }

  return {
    name: classData.name || '',
    displayName: classData.displayName || '',
    grade: classData.grade ?? null,
    sectionIndex: classData.sectionIndex || '',
    studentCount: classData.studentCount || 0,
    fixedRoomId: classData.fixedRoomId ?? null,
    singleTeacherMode: classData.singleTeacherMode || false,
    classTeacherId: classData.classTeacherId ?? null,
    subjectRequirements,
  };
};
