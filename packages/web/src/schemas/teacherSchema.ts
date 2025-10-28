// src/schemas/teacherSchema.ts
import { z } from 'zod';
import { Teacher, Subject } from '../types';
import { DayOfWeek } from '../lib/schema';

// Zod schema for validating Teacher objects
export const teacherSchema = z.object({
  id: z.string({
    required_error: "ID is required",
    invalid_type_error: "ID must be a string"
  }).min(1, { message: 'ID must be a non-empty string' }),
  fullName: z.string()
    .min(1, { message: 'Teacher name is required' })
    .max(100, 'Full name cannot exceed 100 characters'),
  maxPeriodsPerWeek: z.number()
    .int()
    .nonnegative({ message: 'Max periods per week must be non-negative' })
    .max(40, 'Max periods per week cannot exceed 40'),
  maxPeriodsPerDay: z.number()
    .int()
    .nonnegative()
    .optional(),
  timePreference: z.enum(['Morning', 'Afternoon', 'None']).optional(),
  primarySubjectIds: z.array(z.string().min(1, { message: 'ID must be a non-empty string' }))
    .min(1, { message: 'Teacher must have at least one primary subject' }),
  allowedSubjectIds: z.array(z.string().min(1, { message: 'ID must be a non-empty string' })).optional(),
  restrictToPrimarySubjects: z.boolean().optional(),
  availability: z.record(z.nativeEnum(DayOfWeek), z.array(z.boolean())).optional(),
  unavailable: z.array(z.object({
    day: z.union([z.nativeEnum(DayOfWeek), z.string()]), // weekday or ISO date
    periods: z.array(z.number().int().nonnegative())
  })).optional(),
  maxConsecutivePeriods: z.number()
    .int()
    .nonnegative()
    .optional(),
  preferredRoomIds: z.array(z.string().min(1, { message: 'ID must be a non-empty string' })).optional(),
  preferredColleagues: z.array(z.string().min(1, { message: 'ID must be a non-empty string' })).optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

// Schema for teacher form validation (may be less strict than the full schema)
export const teacherFormSchema = teacherSchema.pick({
  fullName: true,
  maxPeriodsPerWeek: true,
  maxPeriodsPerDay: true,
  timePreference: true,
  primarySubjectIds: true
}).extend({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  maxPeriodsPerWeek: z.number().int().min(1).max(40, 'Max periods per week must be between 1 and 40')
});

// Schema for bulk import validation
export const teacherBulkImportSchema = z.array(teacherFormSchema);

// Schema for API responses (with required ID)
export const teacherApiSchema = teacherSchema.extend({
  id: z.string(), // Make ID required for API responses
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

// Helper function to validate a teacher object
export function validateTeacher(teacher: unknown): teacher is Teacher {
  const result = teacherSchema.safeParse(teacher);
  return result.success;
}

// Helper function to validate teacher form data
export function validateTeacherForm(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = teacherFormSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error
  };
}

// Helper for API validation responses
export function validateApiResponse<T>(
  schema: z.ZodType<T>, 
  data: unknown
): { success: boolean; data?: T; error?: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { 
      success: false, 
      error: result.error.errors.map(e => e.message).join(', ')
    };
  }
}

// Add validation that references other entities
export const createTimetableValidationSchema = (subjects: Subject[], teachers: Teacher[]) => 
  z.object({
    // Validate that subject IDs exist in subjects array
    subjectRequirements: z.array(z.object({
      subjectId: z.string().refine(
        (id) => subjects.some(s => s.id === id),
        'Subject ID does not exist'
      ),
      // ... other fields
    }))
  });