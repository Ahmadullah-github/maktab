/**
 * Teacher validation schemas using Zod
 * @module schemas/teacher
 *
 * Requirements: 9.1
 * - Validates Teacher create/update request bodies
 */

import { z } from 'zod';
import { SCHOOL_WEEK_DAYS } from '../types/schoolConfig.types';

function parseJsonString(value: string): unknown {
  return JSON.parse(value);
}

function normalizeIntegerArray(value: unknown): number[] | null {
  const source = typeof value === 'string' ? parseJsonString(value) : value;

  if (!Array.isArray(source)) {
    return null;
  }

  const normalized = source.map((item) => {
    if (typeof item === 'number' && Number.isInteger(item)) {
      return item;
    }

    if (typeof item === 'string' && item.trim() !== '') {
      const parsed = Number(item);
      return Number.isInteger(parsed) ? parsed : Number.NaN;
    }

    return Number.NaN;
  });

  return normalized.every(Number.isInteger) ? normalized : null;
}

function normalizeArray(value: unknown): unknown[] | null {
  const source = typeof value === 'string' ? parseJsonString(value) : value;
  return Array.isArray(source) ? source : null;
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  const source = typeof value === 'string' ? parseJsonString(value) : value;
  if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
    return source as Record<string, unknown>;
  }
  return null;
}

function normalizeClassAssignments(
  value: unknown
): Array<{ subjectId: string; classIds: string[] }> | null {
  const source = typeof value === 'string' ? parseJsonString(value) : value;

  if (!Array.isArray(source)) {
    return null;
  }

  const normalized = source.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return null;
    }

    const assignment = item as { subjectId?: unknown; classIds?: unknown };
    const { subjectId, classIds } = assignment;

    const normalizedSubjectId =
      typeof subjectId === 'string'
        ? subjectId
        : typeof subjectId === 'number' && Number.isInteger(subjectId)
          ? String(subjectId)
          : null;

    if (!normalizedSubjectId || !Array.isArray(classIds)) {
      return null;
    }

    const normalizedClassIds = classIds.map((classId) => {
      if (typeof classId === 'string') {
        return classId;
      }

      if (typeof classId === 'number' && Number.isInteger(classId)) {
        return String(classId);
      }

      return null;
    });

    if (normalizedClassIds.some((classId) => classId === null)) {
      return null;
    }

    return {
      subjectId: normalizedSubjectId,
      classIds: normalizedClassIds as string[],
    };
  });

  return normalized.every((assignment) => assignment !== null)
    ? (normalized as Array<{ subjectId: string; classIds: string[] }>)
    : null;
}

const integerArraySchema = z.unknown().transform((value, ctx): number[] => {
  try {
    const normalized = normalizeIntegerArray(value);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Let the schema issue below surface the message.
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Must be an array of integers or a JSON string array',
  });
  return z.NEVER;
});

const arraySchema = z.unknown().transform((value, ctx): unknown[] => {
  try {
    const normalized = normalizeArray(value);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Let the schema issue below surface the message.
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Must be an array or a JSON string array',
  });
  return z.NEVER;
});

const unavailableArraySchema = arraySchema.pipe(
  z.array(
    z
      .object({
        day: z.enum(SCHOOL_WEEK_DAYS),
        period: z.number().int().min(0).max(11),
      })
      .strict()
  )
);

const recordSchema = z.unknown().transform((value, ctx): Record<string, unknown> => {
  try {
    const normalized = normalizeRecord(value);
    if (normalized) {
      return normalized;
    }
  } catch {
    // Let the schema issue below surface the message.
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Must be an object or a JSON object string',
  });
  return z.NEVER;
});

const classAssignmentsSchema = z
  .unknown()
  .transform((value, ctx): Array<{ subjectId: string; classIds: string[] }> => {
    try {
      const normalized = normalizeClassAssignments(value);
      if (normalized) {
        return normalized;
      }
    } catch {
      // Let the schema issue below surface the message.
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Must be class assignment objects or a JSON string array',
    });
    return z.NEVER;
  });

/**
 * Schema for creating a new teacher
 * Validates all required fields for teacher creation
 */
export const createTeacherSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name is required')
    .max(255, 'Full name must be at most 255 characters'),

  schoolId: z.number().int().nullable().optional(),

  primarySubjectIds: integerArraySchema
    .optional()
    .default([])
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),

  allowedSubjectIds: integerArraySchema
    .optional()
    .default([])
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),

  restrictToPrimarySubjects: z.boolean().optional().default(true),

  availability: recordSchema.optional().default({}),

  unavailable: unavailableArraySchema.optional().default([]),

  maxPeriodsPerWeek: z
    .number()
    .int()
    .min(0, 'Max periods per week must be non-negative')
    .default(0),

  maxPeriodsPerDay: z
    .number()
    .int()
    .min(0, 'Max periods per day must be non-negative')
    .optional()
    .default(0),

  maxConsecutivePeriods: z
    .number()
    .int()
    .min(0, 'Max consecutive periods must be non-negative')
    .optional()
    .default(0),

  timePreference: z.string().optional().default(''),

  preferredRoomIds: integerArraySchema.optional().default([]),

  preferredColleagues: integerArraySchema.optional().default([]),

  classAssignments: classAssignmentsSchema
    .optional()
    .default([])
    .describe('DEPRECATED legacy assignment mirror. Use canonical assignment commands instead.'),

  meta: recordSchema.optional().default({}),
});

/**
 * Schema for updating an existing teacher
 * All fields are optional for partial updates
 */
export const updateTeacherSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Full name cannot be empty')
    .max(255, 'Full name must be at most 255 characters')
    .optional(),

  schoolId: z.number().int().nullable().optional(),

  primarySubjectIds: integerArraySchema
    .optional()
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),
  allowedSubjectIds: integerArraySchema
    .optional()
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),
  restrictToPrimarySubjects: z.boolean().optional(),
  availability: recordSchema.optional(),
  unavailable: unavailableArraySchema.optional(),

  maxPeriodsPerWeek: z
    .number()
    .int()
    .min(0, 'Max periods per week must be non-negative')
    .optional(),

  maxPeriodsPerDay: z.number().int().min(0, 'Max periods per day must be non-negative').optional(),

  maxConsecutivePeriods: z
    .number()
    .int()
    .min(0, 'Max consecutive periods must be non-negative')
    .optional(),

  timePreference: z.string().optional(),
  preferredRoomIds: integerArraySchema.optional(),
  preferredColleagues: integerArraySchema.optional(),
  classAssignments: classAssignmentsSchema
    .optional()
    .describe('DEPRECATED legacy assignment mirror. Use canonical assignment commands instead.'),
  meta: recordSchema.optional(),
});

/**
 * Schema for bulk teacher import
 */
export const bulkTeacherImportSchema = z.object({
  teachers: z.array(createTeacherSchema).min(1, 'At least one teacher is required'),
});

// Type exports
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type BulkTeacherImportInput = z.infer<typeof bulkTeacherImportSchema>;
