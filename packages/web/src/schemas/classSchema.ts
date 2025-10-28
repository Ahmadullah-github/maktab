// src/schemas/classSchema.ts
import { z } from 'zod';
import { ClassGroup, Subject } from '../types';

// Zod schema for validating ClassGroup objects
export const classSchema = z.object({
  id: z.string().min(1, { message: 'ID must be a non-empty string' }),
  name: z.string().min(1, { message: 'Class name is required' }),
  studentCount: z.number().int().nonnegative({ message: 'Student count must be non-negative' }),
  subjectRequirements: z.record(z.string().min(1, { message: 'ID must be a non-empty string' }), z.object({
    periodsPerWeek: z.number().int().nonnegative({ message: 'Periods per week must be non-negative' }),
    minConsecutive: z.number().int().positive().optional(),
    maxConsecutive: z.number().int().positive().optional(),
    minDaysPerWeek: z.number().int().positive().optional(),
    maxDaysPerWeek: z.number().int().positive().optional()
  })).refine((data) => {
    // Validate that minConsecutive is not greater than maxConsecutive
    for (const key in data) {
      const req = data[key];
      if (req.minConsecutive && req.maxConsecutive && req.minConsecutive > req.maxConsecutive) {
        return false;
      }
    }
    return true;
  }, {
    message: 'minConsecutive cannot be greater than maxConsecutive'
  }).refine((data) => {
    // Validate that minDaysPerWeek is not greater than maxDaysPerWeek
    for (const key in data) {
      const req = data[key];
      if (req.minDaysPerWeek && req.maxDaysPerWeek && req.minDaysPerWeek > req.maxDaysPerWeek) {
        return false;
      }
    }
    return true;
  }, {
    message: 'minDaysPerWeek cannot be greater than maxDaysPerWeek'
  }),
  meta: z.record(z.string(), z.unknown()).optional()
});

// Schema for class form validation
export const classFormSchema = classSchema.pick({
  name: true,
  studentCount: true
}).extend({
  name: z.string().min(2, 'Class name must be at least 2 characters'),
  studentCount: z.number()
    .int()
    .min(1, 'Student count must be at least 1')
    .max(500, 'Student count cannot exceed 500'),
});

// Schema for subject requirements validation
export const subjectRequirementSchema = z.object({
  subjectId: z.string().min(1, 'Subject ID is required'),
  periodsPerWeek: z.number().int().nonnegative({ message: 'Periods per week must be non-negative' }),
  minConsecutive: z.number().int().positive().optional(),
  maxConsecutive: z.number().int().positive().optional(),
  minDaysPerWeek: z.number().int().positive().optional(),
  maxDaysPerWeek: z.number().int().positive().optional()
}).refine((data) => {
  if (data.minConsecutive && data.maxConsecutive && data.minConsecutive > data.maxConsecutive) {
    return false;
  }
  return true;
}, {
  message: 'Minimum consecutive periods cannot be greater than maximum consecutive periods'
}).refine((data) => {
  if (data.minDaysPerWeek && data.maxDaysPerWeek && data.minDaysPerWeek > data.maxDaysPerWeek) {
    return false;
  }
  return true;
}, {
  message: 'Minimum days per week cannot be greater than maximum days per week'
});

// Helper function to validate a class object
export function validateClass(classGroup: unknown): classGroup is ClassGroup {
  const result = classSchema.safeParse(classGroup);
  return result.success;
}

// Helper function to validate class form data
export function validateClassForm(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = classFormSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error
  };
}

// Add validation that references other entities
export const createClassTimetableValidationSchema = (subjects: Subject[], classes: ClassGroup[]) => 
  z.object({
    // Validate that subject IDs exist in subjects array
    subjectRequirements: z.array(z.object({
      subjectId: z.string().refine(
        (id) => subjects.some(s => s.id === id),
        'Subject ID does not exist'
      ),
      periodsPerWeek: z.number().int().nonnegative({ message: 'Periods per week must be non-negative' }),
      minConsecutive: z.number().int().positive().optional(),
      maxConsecutive: z.number().int().positive().optional(),
      minDaysPerWeek: z.number().int().positive().optional(),
      maxDaysPerWeek: z.number().int().positive().optional()
    }))
  });