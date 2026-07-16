/**
 * Subject validation schemas using Zod
 * @module schemas/subject
 *
 * Requirements: 9.2
 * - Validates Subject create/update request bodies
 */

import { z } from 'zod';

/**
 * Valid section values for Afghan school system
 */
const sectionEnum = z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']);
const customCategoryEnum = z.enum(['Alpha-Primary', 'Beta-Primary', 'Middle', 'High']);

const nullableRoomTypeSchema = z
  .union([z.string().trim().toLowerCase().max(100).regex(/^[a-z0-9_-]+$/), z.literal(''), z.null()])
  .transform((value) => (value === '' ? null : value));

function parseJsonArrayString(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    // Let schema validation below surface a clear error.
  }

  throw new Error('Expected a JSON string array');
}

function parseJsonRecordString(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Let schema validation below surface a clear error.
  }

  throw new Error('Expected a JSON object string');
}

const jsonStringArraySchema = z.unknown().transform((value, ctx): string[] => {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return parseJsonArrayString(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be an array of strings or a JSON string array',
      });
      return z.NEVER;
    }
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Must be an array of strings or a JSON string array',
  });
  return z.NEVER;
});

const normalizedStringArraySchema = jsonStringArraySchema.transform((items) =>
  [...new Set(items.map((item) => item.normalize('NFKC').trim().toLowerCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
);

const jsonRecordSchema = z.unknown().transform((value, ctx): Record<string, unknown> => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string') {
    try {
      return parseJsonRecordString(value);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must be an object or a JSON object string',
      });
      return z.NEVER;
    }
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Must be an object or a JSON object string',
  });
  return z.NEVER;
});

/**
 * Schema for creating a new subject
 * Validates all required fields for subject creation
 */
export const createSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Subject name is required')
    .max(255, 'Subject name must be at most 255 characters'),

  schoolId: z.number().int().positive().nullable().optional(),

  code: z.string().trim().max(50, 'Subject code must be at most 50 characters').optional().default(''),

  grade: z
    .number()
    .int()
    .min(1, 'Grade must be at least 1')
    .max(12, 'Grade must be at most 12')
    .nullable()
    .optional(),

  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(84, 'Periods per week must be at most 84')
    .nullable()
    .optional(),

  section: sectionEnum.optional().default(''),

  requiredRoomType: nullableRoomTypeSchema.optional().default(null),

  requiredFeatures: normalizedStringArraySchema.optional().default([]).describe('Required room features'),

  desiredFeatures: normalizedStringArraySchema.optional().default([]).describe('Desired room features'),

  isDifficult: z.boolean().optional().default(false),

  minRoomCapacity: z
    .number()
    .int()
    .min(0, 'Minimum room capacity must be non-negative')
    .optional()
    .default(0),

  meta: jsonRecordSchema.optional().default({}).describe('Subject metadata'),
  isCustom: z.boolean().optional().default(false),
  customCategory: customCategoryEnum.nullable().optional().default(null),
});

/**
 * Schema for updating an existing subject
 * All fields are optional for partial updates
 */
export const updateSubjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Subject name cannot be empty')
    .max(255, 'Subject name must be at most 255 characters')
    .optional(),

  schoolId: z.number().int().positive().nullable().optional(),

  code: z.string().trim().max(50, 'Subject code must be at most 50 characters').optional(),

  grade: z
    .number()
    .int()
    .min(1, 'Grade must be at least 1')
    .max(12, 'Grade must be at most 12')
    .nullable()
    .optional(),

  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(84, 'Periods per week must be at most 84')
    .nullable()
    .optional(),

  section: sectionEnum.optional(),
  requiredRoomType: nullableRoomTypeSchema.optional(),
  requiredFeatures: normalizedStringArraySchema.optional(),
  desiredFeatures: normalizedStringArraySchema.optional(),
  isDifficult: z.boolean().optional(),

  minRoomCapacity: z.number().int().min(0, 'Minimum room capacity must be non-negative').optional(),

  meta: jsonRecordSchema.optional(),
  isCustom: z.boolean().optional(),
  customCategory: customCategoryEnum.nullable().optional(),
});

/**
 * Schema for bulk subject upsert
 */
export const bulkSubjectUpsertSchema = z.object({
  subjects: z.array(createSubjectSchema).min(1, 'At least one subject is required'),
});

export const bulkDeleteSubjectsSchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(500).transform((ids) => [...new Set(ids)]),
  })
  .strict();

export const insertGradeCurriculumSchema = z
  .object({
    schoolId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const syncCurriculumSubjectsSchema = z
  .object({
    grades: z.array(z.number().int().min(1).max(12)).min(1).max(12),
    schoolId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const clearCurriculumSubjectsSchema = syncCurriculumSubjectsSchema;

// Type exports
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type BulkSubjectUpsertInput = z.infer<typeof bulkSubjectUpsertSchema>;
