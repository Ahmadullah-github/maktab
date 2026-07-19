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

const assignmentAllocationSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  periodsPerWeek: z.number().int().min(1).max(84),
});

const assignmentBatchChangeSchema = z.object({
  requirementId: z.number().int().positive('Requirement ID must be a positive integer'),
  expectedVersion: z.number().int().nonnegative('Expected version cannot be negative'),
  allocations: z
    .array(assignmentAllocationSchema)
    .max(50, 'A requirement cannot contain more than 50 teacher allocations')
    .superRefine((allocations, context) => {
      const seen = new Set<number>();
      allocations.forEach((allocation, index) => {
        if (seen.has(allocation.teacherId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'teacherId'],
            message: 'A teacher can appear only once per requirement',
          });
        }
        seen.add(allocation.teacherId);
      });
    }),
});

const assignmentPrimaryCapabilityGrantSchema = z.object({
  teacherId: z.number().int().positive('Teacher ID must be a positive integer'),
  subjectId: z.number().int().positive('Subject ID must be a positive integer'),
});

/** Complete desired allocation states, committed atomically across all requirements. */
export const assignmentBatchSchema = z.object({
  changes: z
    .array(assignmentBatchChangeSchema)
    .min(1, 'At least one assignment change is required')
    .max(500, 'At most 500 requirements can be changed at once')
    .superRefine((changes, context) => {
      const seen = new Set<number>();
      changes.forEach((change, index) => {
        if (seen.has(change.requirementId)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'requirementId'],
            message: 'Each requirement can appear only once per batch',
          });
        }
        seen.add(change.requirementId);
      });
    }),
  primaryCapabilityGrants: z
    .array(assignmentPrimaryCapabilityGrantSchema)
    .max(500, 'At most 500 primary capability grants can be requested at once')
    .superRefine((grants, context) => {
      const seen = new Set<string>();
      grants.forEach((grant, index) => {
        const key = `${grant.teacherId}:${grant.subjectId}`;
        if (seen.has(key)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index],
            message: 'Each teacher-subject primary capability can appear only once per batch',
          });
        }
        seen.add(key);
      });
    })
    .optional(),
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
  addToPrimarySubjects: z.boolean().optional(),
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
  addToPrimarySubjects: z.boolean().optional(),
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
export type AssignmentBatchInput = z.infer<typeof assignmentBatchSchema>;
