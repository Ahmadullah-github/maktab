import { z } from 'zod';

const schoolId = z.number().int().positive().nullable().optional();

export const schoolCurriculumSubjectSchema = z.object({
  itemId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  nameEn: z.string().trim().max(255).optional(),
  code: z.string().trim().min(1).max(50),
  periodsPerWeek: z.number().int().min(1).max(84),
  isDifficult: z.boolean().optional(),
  requiredRoomType: z.string().trim().max(100).optional(),
}).strict();

const gradeCurriculumSchema = z.object({
  grade: z.number().int().min(1).max(12),
  revision: z.number().int().min(0),
  subjects: z.array(schoolCurriculumSubjectSchema).max(500),
}).strict().superRefine((value, context) => {
  const codes = new Set<string>();
  const itemIds = new Set<string>();
  value.subjects.forEach((subject, index) => {
    const code = subject.code.normalize('NFKC').trim().toLocaleLowerCase();
    if (codes.has(code)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['subjects', index, 'code'], message: 'Subject codes must be unique within a grade' });
    if (itemIds.has(subject.itemId)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['subjects', index, 'itemId'], message: 'Curriculum item IDs must be unique within a grade' });
    codes.add(code);
    itemIds.add(subject.itemId);
  });
});

export const saveGradeCurriculumSchema = z.object({
  revision: z.number().int().min(0),
  subjects: z.array(schoolCurriculumSubjectSchema).max(500),
  schoolId,
}).strict();

function requireUniqueGrades(
  value: { gradeConfigs: Array<{ grade: number }> },
  context: z.RefinementCtx
) {
  const grades = new Set<number>();
  value.gradeConfigs.forEach((entry, index) => {
    if (grades.has(entry.grade)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gradeConfigs', index, 'grade'],
        message: 'Each grade can appear only once',
      });
    }
    grades.add(entry.grade);
  });
}

export const bulkSaveCurriculumSchema = z.object({
  gradeConfigs: z.array(gradeCurriculumSchema).min(1).max(12),
  schoolId,
}).strict().superRefine(requireUniqueGrades);

const classProposalSchema = z.object({
  name: z.string().trim().min(1).max(255),
  displayName: z.string().trim().max(100).optional(),
  grade: z.number().int().min(1).max(12),
  section: z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']).optional(),
  sectionIndex: z.string().trim().max(10).optional(),
  studentCount: z.number().int().min(0).max(500).default(0),
  classTeacherId: z.number().int().positive().nullable().optional(),
}).strict();

const curriculumPlanBaseSchema = z.object({
  schoolId,
  schoolConfigRevision: z.number().int().min(1),
  gradeConfigs: z.array(gradeCurriculumSchema).min(1).max(12),
  classes: z.array(classProposalSchema).max(500).default([]),
}).strict();

export const curriculumPlanSchema = curriculumPlanBaseSchema.superRefine(requireUniqueGrades);

export const applyCurriculumPlanSchema = curriculumPlanBaseSchema.extend({
  previewToken: z.string().min(16).max(256),
  confirmAssignmentRemoval: z.boolean().default(false),
}).strict().superRefine(requireUniqueGrades);

export const curriculumSchoolIdSchema = z.object({ schoolId }).strict();

// Compatibility contracts retained for old clients during the UI transition.
export const addCustomCurriculumSubjectSchema = schoolCurriculumSubjectSchema.extend({ schoolId }).strict();
export const overrideCurriculumPeriodsSchema = z.object({ periodsPerWeek: z.number().int().min(1).max(84), schoolId }).strict();
