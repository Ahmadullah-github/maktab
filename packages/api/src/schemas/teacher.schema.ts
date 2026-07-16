/**
 * Teacher validation schemas using Zod
 * @module schemas/teacher
 *
 * Requirements: 9.1
 * - Validates Teacher create/update request bodies
 */

import { z } from 'zod';
import { SCHOOL_WEEK_DAYS } from '../types/schoolConfig.types';
import {
  normalizeTeacherName,
  normalizeTeacherStaffCode,
  TEACHER_EMPLOYMENT_TYPES,
  TEACHER_TIME_PREFERENCES,
} from '../utils/teacherContracts';

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
        period: z.number().int().min(0),
      })
      .strict()
  ).superRefine((slots, ctx) => {
    const seen = new Set<string>();
    slots.forEach((slot, index) => {
      const key = `${slot.day}:${slot.period}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Unavailable slots must be unique',
          path: [index],
        });
      }
      seen.add(key);
    });
  })
);

const positiveIntegerArraySchema = integerArraySchema.pipe(
  z.array(z.number().int().positive()).refine((values) => new Set(values).size === values.length, {
    message: 'IDs must be unique',
  })
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
    .max(255, 'Full name must be at most 255 characters')
    .transform(normalizeTeacherName),

  staffCode: z
    .string()
    .min(1, 'Staff code is required')
    .max(50, 'Staff code must be at most 50 characters')
    .transform(normalizeTeacherStaffCode),

  employmentType: z.enum(TEACHER_EMPLOYMENT_TYPES).default('full_time'),

  schoolId: z.number().int().positive().nullable().optional(),

  primarySubjectIds: positiveIntegerArraySchema
    .optional()
    .default([])
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),

  allowedSubjectIds: positiveIntegerArraySchema
    .optional()
    .default([])
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),

  restrictToPrimarySubjects: z.boolean().optional().default(true),

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

  timePreference: z.enum(TEACHER_TIME_PREFERENCES).optional().default('any'),

  preferredRoomIds: positiveIntegerArraySchema.optional().default([]),

  preferredColleagues: positiveIntegerArraySchema.optional().default([]),

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
    .transform(normalizeTeacherName)
    .optional(),

  staffCode: z
    .string()
    .min(1, 'Staff code cannot be empty')
    .max(50, 'Staff code must be at most 50 characters')
    .transform(normalizeTeacherStaffCode)
    .optional(),

  employmentType: z.enum(TEACHER_EMPLOYMENT_TYPES).optional(),

  schoolId: z.number().int().positive().nullable().optional(),

  primarySubjectIds: positiveIntegerArraySchema
    .optional()
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),
  allowedSubjectIds: positiveIntegerArraySchema
    .optional()
    .describe(
      'DEPRECATED compatibility capability mirror. Canonical capability rows will replace this field.'
    ),
  restrictToPrimarySubjects: z.boolean().optional(),
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

  timePreference: z.enum(TEACHER_TIME_PREFERENCES).optional(),
  preferredRoomIds: positiveIntegerArraySchema.optional(),
  preferredColleagues: positiveIntegerArraySchema.optional(),
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

export const bulkTeacherDeleteSchema = z.object({
  ids: z
    .array(z.number().int().positive())
    .min(1, 'At least one teacher ID is required')
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Teacher IDs must be unique' }),
});

// Type exports
export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type BulkTeacherImportInput = z.infer<typeof bulkTeacherImportSchema>;
export type BulkTeacherDeleteInput = z.infer<typeof bulkTeacherDeleteSchema>;
