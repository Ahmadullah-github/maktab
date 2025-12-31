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

/**
 * Schema for creating a new subject
 * Validates all required fields for subject creation
 */
export const createSubjectSchema = z.object({
  name: z.string()
    .min(1, 'Subject name is required')
    .max(255, 'Subject name must be at most 255 characters'),
  
  schoolId: z.number().int().nullable().optional(),
  
  code: z.string()
    .max(50, 'Subject code must be at most 50 characters')
    .optional()
    .default(''),
  
  grade: z.number()
    .int()
    .min(1, 'Grade must be at least 1')
    .max(12, 'Grade must be at most 12')
    .nullable()
    .optional(),
  
  periodsPerWeek: z.number()
    .int()
    .min(0, 'Periods per week must be non-negative')
    .nullable()
    .optional(),
  
  section: sectionEnum.optional().default(''),
  
  requiredRoomType: z.string()
    .optional()
    .default(''),
  
  requiredFeatures: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of required room features'),
  
  desiredFeatures: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of desired room features'),
  
  isDifficult: z.boolean()
    .optional()
    .default(false),
  
  minRoomCapacity: z.number()
    .int()
    .min(0, 'Minimum room capacity must be non-negative')
    .optional()
    .default(0),
  
  meta: z.string()
    .optional()
    .default('{}')
    .describe('JSON string of metadata'),
});

/**
 * Schema for updating an existing subject
 * All fields are optional for partial updates
 */
export const updateSubjectSchema = z.object({
  name: z.string()
    .min(1, 'Subject name cannot be empty')
    .max(255, 'Subject name must be at most 255 characters')
    .optional(),
  
  schoolId: z.number().int().nullable().optional(),
  
  code: z.string()
    .max(50, 'Subject code must be at most 50 characters')
    .optional(),
  
  grade: z.number()
    .int()
    .min(1, 'Grade must be at least 1')
    .max(12, 'Grade must be at most 12')
    .nullable()
    .optional(),
  
  periodsPerWeek: z.number()
    .int()
    .min(0, 'Periods per week must be non-negative')
    .nullable()
    .optional(),
  
  section: sectionEnum.optional(),
  requiredRoomType: z.string().optional(),
  requiredFeatures: z.string().optional(),
  desiredFeatures: z.string().optional(),
  isDifficult: z.boolean().optional(),
  
  minRoomCapacity: z.number()
    .int()
    .min(0, 'Minimum room capacity must be non-negative')
    .optional(),
  
  meta: z.string().optional(),
});

/**
 * Schema for bulk subject upsert
 */
export const bulkSubjectUpsertSchema = z.object({
  subjects: z.array(createSubjectSchema).min(1, 'At least one subject is required'),
});

// Type exports
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
export type BulkSubjectUpsertInput = z.infer<typeof bulkSubjectUpsertSchema>;
