// src/schemas/subjectSchema.ts
import { z } from 'zod';
import { Subject } from '../types';

// Zod schema for validating Subject objects
export const subjectSchema = z.object({
  id: z.string().min(1, { message: 'ID must be a non-empty string' }),
  name: z.string().min(1, { message: 'Subject name is required' }),
  code: z.string().optional(),
  isDifficult: z.boolean().optional(),
  requiredRoomType: z.union([z.string(), z.null()]).optional(),
  requiredFeatures: z.array(z.string()).optional(),
  desiredFeatures: z.array(z.string()).optional(),
  minRoomCapacity: z.number().int().positive().optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

// Schema for subject form validation
export const subjectFormSchema = subjectSchema.pick({
  name: true,
  code: true,
  isDifficult: true,
  requiredRoomType: true
}).extend({
  name: z.string().min(2, 'Subject name must be at least 2 characters')
});

// Helper function to validate a subject object
export function validateSubject(subject: unknown): subject is Subject {
  const result = subjectSchema.safeParse(subject);
  return result.success;
}

// Helper function to validate subject form data
export function validateSubjectForm(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = subjectFormSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error
  };
}