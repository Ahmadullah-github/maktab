/**
 * Teacher validation schemas using Zod
 * @module schemas/teacher
 * 
 * Requirements: 9.1
 * - Validates Teacher create/update request bodies
 */

import { z } from 'zod';

/**
 * Schema for creating a new teacher
 * Validates all required fields for teacher creation
 */
export const createTeacherSchema = z.object({
  fullName: z.string()
    .min(1, 'Full name is required')
    .max(255, 'Full name must be at most 255 characters'),
  
  schoolId: z.number().int().nullable().optional(),
  
  primarySubjectIds: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of primary subject IDs'),
  
  allowedSubjectIds: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of allowed subject IDs'),
  
  restrictToPrimarySubjects: z.boolean()
    .optional()
    .default(true),
  
  availability: z.string()
    .optional()
    .default('{}')
    .describe('JSON string of availability matrix'),
  
  unavailable: z.string()
    .optional()
    .default('[]')
    .describe('JSON string of unavailable slots'),
  
  maxPeriodsPerWeek: z.number()
    .int()
    .min(0, 'Max periods per week must be non-negative')
    .default(0),
  
  maxPeriodsPerDay: z.number()
    .int()
    .min(0, 'Max periods per day must be non-negative')
    .optional()
    .default(0),
  
  maxConsecutivePeriods: z.number()
    .int()
    .min(0, 'Max consecutive periods must be non-negative')
    .optional()
    .default(0),
  
  timePreference: z.string()
    .optional()
    .default(''),
  
  preferredRoomIds: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of preferred room IDs'),
  
  preferredColleagues: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of preferred colleague IDs'),
  
  classAssignments: z.string()
    .optional()
    .default('[]')
    .describe('JSON string of class assignments'),
  
  meta: z.string()
    .optional()
    .default('{}')
    .describe('JSON string of metadata'),
});

/**
 * Schema for updating an existing teacher
 * All fields are optional for partial updates
 */
export const updateTeacherSchema = z.object({
  fullName: z.string()
    .min(1, 'Full name cannot be empty')
    .max(255, 'Full name must be at most 255 characters')
    .optional(),
  
  schoolId: z.number().int().nullable().optional(),
  
  primarySubjectIds: z.string().optional(),
  allowedSubjectIds: z.string().optional(),
  restrictToPrimarySubjects: z.boolean().optional(),
  availability: z.string().optional(),
  unavailable: z.string().optional(),
  
  maxPeriodsPerWeek: z.number()
    .int()
    .min(0, 'Max periods per week must be non-negative')
    .optional(),
  
  maxPeriodsPerDay: z.number()
    .int()
    .min(0, 'Max periods per day must be non-negative')
    .optional(),
  
  maxConsecutivePeriods: z.number()
    .int()
    .min(0, 'Max consecutive periods must be non-negative')
    .optional(),
  
  timePreference: z.string().optional(),
  preferredRoomIds: z.string().optional(),
  preferredColleagues: z.string().optional(),
  classAssignments: z.string().optional(),
  meta: z.string().optional(),
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
