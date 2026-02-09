/**
 * TeacherClassSubjectAssignment validation schemas using Zod
 * @module schemas/teacherClassSubjectAssignment
 *
 * Validates create/update request bodies for multi-teacher subject assignments.
 */

import { z } from 'zod';

/**
 * Schema for creating a new assignment
 */
export const createTeacherClassSubjectAssignmentSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  classId: z.number().int().positive('Class ID must be a positive integer'),
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(50, 'Periods per week cannot exceed 50'),
  isFixed: z.boolean().optional().default(true),
  schoolId: z.number().int().nullable().optional(),
});

/**
 * Schema for updating an existing assignment
 */
export const updateTeacherClassSubjectAssignmentSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer').optional(),
  classId: z.number().int().positive('Class ID must be a positive integer').optional(),
  subjectId: z.number().int().positive('Subject ID must be a positive integer').optional(),
  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(50, 'Periods per week cannot exceed 50')
    .optional(),
  isFixed: z.boolean().optional(),
  schoolId: z.number().int().nullable().optional(),
});

/**
 * Schema for bulk creating assignments
 */
export const bulkCreateTeacherClassSubjectAssignmentSchema = z.object({
  assignments: z
    .array(createTeacherClassSubjectAssignmentSchema)
    .min(1, 'At least one assignment is required'),
});

/**
 * Schema for query parameters when fetching assignments
 */
export const assignmentQuerySchema = z.object({
  classId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  teacherId: z.coerce.number().int().positive().optional(),
});

// Type exports
export type CreateTeacherClassSubjectAssignmentInput = z.infer<
  typeof createTeacherClassSubjectAssignmentSchema
>;
export type UpdateTeacherClassSubjectAssignmentInput = z.infer<
  typeof updateTeacherClassSubjectAssignmentSchema
>;
export type BulkCreateTeacherClassSubjectAssignmentInput = z.infer<
  typeof bulkCreateTeacherClassSubjectAssignmentSchema
>;
export type AssignmentQueryInput = z.infer<typeof assignmentQuerySchema>;
