import { z } from 'zod';

const schoolId = z.number().int().positive().nullable().optional();
const item = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(255),
    nameEn: z.string().trim().max(255).nullable().optional(),
    code: z.string().trim().min(1).max(50),
    weeklyPeriods: z.number().int().min(1).max(84),
    isDifficult: z.boolean().optional().default(false),
    requiredRoomType: z
      .union([z.string().trim().toLowerCase().max(100).regex(/^[a-z0-9_-]+$/), z.literal(''), z.null()])
      .optional()
      .transform((value) => value || null),
  })
  .strict();

const gradeDraft = z
  .object({
    grade: z.number().int().min(1).max(12),
    items: z.array(item).max(100),
  })
  .strict();

const proposedClass = z
  .object({
    name: z.string().trim().min(1).max(255),
    displayName: z.string().trim().max(255).optional(),
    grade: z.number().int().min(1).max(12),
    section: z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']).optional(),
    sectionIndex: z.string().trim().max(20).optional(),
    studentCount: z.number().int().min(0).max(500).optional(),
    fixedRoomId: z.number().int().positive().nullable().optional(),
    homeRoomId: z.number().int().positive().nullable().optional(),
    singleTeacherMode: z.boolean().optional(),
    classTeacherId: z.number().int().positive().nullable().optional(),
    academicYearId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const curriculumPreviewSchema = z
  .object({
    schoolId,
    revision: z.number().int().min(0),
    changedGrades: z.array(gradeDraft).max(12),
    synchronizeClassIds: z
      .array(z.number().int().positive())
      .max(1000)
      .optional()
      .default([])
      .transform((ids) => [...new Set(ids)]),
    proposedClasses: z.array(proposedClass).max(500).optional().default([]),
  })
  .strict()
  .superRefine((value, context) => {
    const grades = value.changedGrades.map((draft) => draft.grade);
    if (new Set(grades).size !== grades.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changedGrades'],
        message: 'Each changed grade must appear exactly once',
      });
    }
  });

export const curriculumApplySchema = z
  .object({
    previewToken: z.string().uuid(),
    confirmAssignmentRemoval: z.boolean(),
  })
  .strict();

export type CurriculumPreviewRequest = z.infer<typeof curriculumPreviewSchema>;
export type CurriculumApplyRequest = z.infer<typeof curriculumApplySchema>;
