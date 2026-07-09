/**
 * Class (ClassGroup) validation schemas using Zod
 * @module schemas/class
 * 
 * Requirements: 9.4
 * - Validates ClassGroup create/update request bodies
 */

import { z } from 'zod';

/**
 * Valid section values for Afghan school system
 */
const sectionEnum = z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']);

/**
 * Schema for creating a new class group
 * Validates all required fields for class creation
 */
export const createClassSchema = z.object({
  name: z.string()
    .min(1, 'Class name is required')
    .max(255, 'Class name must be at most 255 characters'),
  
  schoolId: z.number().int().nullable().optional(),
  
  academicYearId: z.number().int().nullable().optional(),
  
  displayName: z.string()
    .max(100, 'Display name must be at most 100 characters')
    .optional()
    .default(''),
  
  section: sectionEnum.optional().default(''),
  
  grade: z.number()
    .int()
    .min(1, 'Grade must be at least 1')
    .max(12, 'Grade must be at most 12')
    .nullable()
    .optional(),
  
  sectionIndex: z.string()
    .max(10, 'Section index must be at most 10 characters')
    .optional()
    .default(''),
  
  studentCount: z.number()
    .int()
    .min(0, 'Student count must be non-negative')
    .max(500, 'Student count must be at most 500')
    .default(0),
  
  fixedRoomId: z.number()
    .int()
    .nullable()
    .optional()
    .describe('ID of the room this class is locked to'),
  
  singleTeacherMode: z.boolean()
    .optional()
    .default(false)
    .describe('Whether one teacher teaches all subjects (Alpha-Primary)'),
  
  classTeacherId: z.number()
    .int()
    .nullable()
    .optional()
    .describe('ID of the class teacher/supervisor. This is not subject assignment truth.'),
  
  subjectRequirements: z.string()
    .optional()
    .default('[]')
    .describe('Compatibility JSON string for class requirements. Embedded teacherId is deprecated for assignment writes.'),
  
  meta: z.string()
    .optional()
    .default('{}')
    .describe('JSON string of metadata'),
});

/**
 * Schema for updating an existing class group
 * All fields are optional for partial updates
 */
export const updateClassSchema = z.object({
  name: z.string()
    .min(1, 'Class name cannot be empty')
    .max(255, 'Class name must be at most 255 characters')
    .optional(),
  
  schoolId: z.number().int().nullable().optional(),
  academicYearId: z.number().int().nullable().optional(),
  
  displayName: z.string()
    .max(100, 'Display name must be at most 100 characters')
    .optional(),
  
  section: sectionEnum.optional(),
  
  grade: z.number()
    .int()
    .min(1, 'Grade must be at least 1')
    .max(12, 'Grade must be at most 12')
    .nullable()
    .optional(),
  
  sectionIndex: z.string()
    .max(10, 'Section index must be at most 10 characters')
    .optional(),
  
  studentCount: z.number()
    .int()
    .min(0, 'Student count must be non-negative')
    .max(500, 'Student count must be at most 500')
    .optional(),
  
  fixedRoomId: z.number().int().nullable().optional(),
  singleTeacherMode: z.boolean().optional(),
  classTeacherId: z.number()
    .int()
    .nullable()
    .optional()
    .describe('ID of the class teacher/supervisor. This is not subject assignment truth.'),
  subjectRequirements: z.string()
    .optional()
    .describe('Compatibility JSON string for class requirements. Embedded teacherId is deprecated for assignment writes.'),
  meta: z.string().optional(),
});

// Type exports
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
