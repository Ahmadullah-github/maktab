/**
 * Assignment validation schemas using Zod
 * @module schemas/assignment
 *
 * Requirements: 5.4, 6.5, 1.6, 3.5
 * - Validates assignment validation requests
 * - Validates assignment operation requests
 */

import { z } from 'zod';

const classPeriodOverrideSchema = z.object({
  classId: z.number().int().positive('Class ID must be a positive integer'),
  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(84, 'Periods per week cannot exceed 84'),
});

/**
 * Schema for validating an assignment request
 * Used by POST /api/assignments/validate
 */
export const validateAssignmentSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
  classIds: z
    .array(z.number().int().positive('Class ID must be a positive integer'))
    .min(1, 'At least one class ID is required'),
  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(84, 'Periods per week cannot exceed 84')
    .optional(),
  classPeriodOverrides: z.array(classPeriodOverrideSchema).optional(),
  persistRequirementOverrides: z.boolean().optional(),
});

/**
 * Schema for assigning a teacher to subject-class combinations
 * Used by POST /api/assignments/assign
 */
export const assignTeacherSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
  classIds: z
    .array(z.number().int().positive('Class ID must be a positive integer'))
    .min(1, 'At least one class ID is required'),
  periodsPerWeek: z
    .number()
    .int()
    .min(1, 'Periods per week must be at least 1')
    .max(84, 'Periods per week cannot exceed 84')
    .optional(),
  classPeriodOverrides: z.array(classPeriodOverrideSchema).optional(),
  persistRequirementOverrides: z.boolean().optional(),
});

/**
 * Schema for unassigning a teacher from subject-class combinations
 * Used by DELETE /api/assignments/unassign
 */
export const unassignTeacherSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
  classIds: z
    .array(z.number().int().positive('Class ID must be a positive integer'))
    .min(1, 'At least one class ID is required'),
});

export const updateTeacherCapabilitySchema = z.object({
  teacherId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  capabilityLevel: z.enum(['primary', 'allowed']).nullable(),
  removeAssignments: z.boolean().default(false),
});

// Type exports
export type ValidateAssignmentInput = z.infer<typeof validateAssignmentSchema>;
export type AssignTeacherInput = z.infer<typeof assignTeacherSchema>;
export type UnassignTeacherInput = z.infer<typeof unassignTeacherSchema>;
