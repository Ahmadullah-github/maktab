import { z } from 'zod';

const schoolId = z.number().int().positive().nullable().optional();

export const curriculumOverrideSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    periodsPerWeek: z.number().int().min(1).max(84).optional(),
    isRemoved: z.boolean().optional(),
  })
  .strict();

export const curriculumCustomSubjectSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    nameEn: z.string().trim().max(255).optional(),
    code: z.string().trim().min(1).max(50),
    periodsPerWeek: z.number().int().positive().max(84),
    isDifficult: z.boolean().optional(),
    requiredRoomType: z.string().trim().max(100).optional(),
  })
  .strict();

const gradeCurriculumFields = {
  overrides: z.array(curriculumOverrideSchema).max(500).optional(),
  customSubjects: z.array(curriculumCustomSubjectSchema).max(500).optional(),
};

export const saveGradeCurriculumSchema = z
  .object({
    ...gradeCurriculumFields,
    schoolId,
  })
  .strict();

export const bulkSaveCurriculumSchema = z
  .object({
    gradeConfigs: z
      .array(
        z
          .object({
            grade: z.number().int().min(1).max(12),
            ...gradeCurriculumFields,
          })
          .strict()
      )
      .min(1)
      .max(12),
    schoolId,
  })
  .strict();

export const curriculumSchoolIdSchema = z.object({ schoolId }).strict();

export const addCustomCurriculumSubjectSchema = curriculumCustomSubjectSchema
  .extend({ schoolId })
  .strict();

export const overrideCurriculumPeriodsSchema = z
  .object({
    periodsPerWeek: z.number().int().min(1).max(84),
    schoolId,
  })
  .strict();
