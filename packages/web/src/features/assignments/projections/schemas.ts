import { z } from 'zod';

const warningSchema = z.object({
  code: z.enum([
    'missing_capability',
    'remaining_unassigned_periods',
    'over_assigned_periods',
    'split_assignment_disabled',
    'teacher_over_capacity',
  ]),
  severity: z.enum(['warning', 'error']),
  message: z.string(),
});

const assignmentSchema = z.object({
  assignmentId: z.number().int().positive(),
  teacherId: z.number().int().positive(),
  teacherName: z.string(),
  assignedPeriodsPerWeek: z.number().int().positive(),
  isFixed: z.boolean(),
  source: z.string(),
  capabilityLevel: z.enum(['primary', 'allowed', 'incompatible']),
});

export const projectionRequirementSchema = z.object({
  requirementId: z.number().int().positive(),
  assignmentVersion: z.number().int().nonnegative(),
  classId: z.number().int().positive(),
  className: z.string(),
  subjectId: z.number().int().positive(),
  subjectName: z.string(),
  requiredPeriodsPerWeek: z.number().int().positive(),
  assignedPeriodsPerWeek: z.number().int().nonnegative(),
  remainingPeriodsPerWeek: z.number().int(),
  allowSplitAssignment: z.boolean(),
  assignments: z.array(assignmentSchema),
  warnings: z.array(warningSchema),
});

export const assignmentMatrixSchema = z.object({
  generatedAt: z.string(),
  classes: z.array(z.object({
    classId: z.number().int().positive(),
    className: z.string(),
    requirements: z.array(projectionRequirementSchema),
  })),
});

export const classAssignmentViewSchema = z.object({
  classId: z.number().int().positive(),
  className: z.string(),
  classTeacherId: z.number().int().positive().nullable(),
  classTeacherName: z.string().nullable(),
  requirements: z.array(projectionRequirementSchema),
});

const workloadSchema = z.object({
  teacherId: z.number().int().positive(),
  teacherName: z.string(),
  maxPeriodsPerWeek: z.number().int().nonnegative(),
  contractedMaxPeriodsPerWeek: z.number().int().nonnegative(),
  effectiveCapacityPerWeek: z.number().int().nonnegative(),
  bindingCapacityConstraint: z.enum(['contract', 'calendar']),
  assignedPeriodsPerWeek: z.number().int().nonnegative(),
  remainingCapacityPerWeek: z.number().int(),
  capabilities: z.array(z.object({
    subjectId: z.number().int().positive(),
    subjectName: z.string(),
    capabilityLevel: z.enum(['primary', 'allowed']),
  })),
  assignments: z.array(z.object({
    assignmentId: z.number().int().positive(),
    requirementId: z.number().int().positive(),
    classId: z.number().int().positive(),
    className: z.string(),
    subjectId: z.number().int().positive(),
    subjectName: z.string(),
    assignedPeriodsPerWeek: z.number().int().positive(),
    isFixed: z.boolean(),
    source: z.string(),
    warnings: z.array(warningSchema),
  })),
});

export const teacherWorkloadViewSchema = workloadSchema;
export const teacherWorkloadViewsSchema = z.array(workloadSchema);
