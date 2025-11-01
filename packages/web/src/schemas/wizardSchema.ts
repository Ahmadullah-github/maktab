// src/schemas/wizardSchema.ts
import { z } from 'zod';
import { SchoolInfo, PeriodsInfo } from '../types';

// Zod schema for validating SchoolInfo objects
export const schoolInfoSchema = z.object({
  schoolName: z.string()
    .min(1, 'School name is required')
    .max(100, 'School name cannot exceed 100 characters'),
  enablePrimary: z.boolean(),
  enableMiddle: z.boolean(),
  enableHigh: z.boolean(),
  daysPerWeek: z.number().min(1).max(7),
  periodsPerDay: z.number().min(1).max(12),
  breakPeriods: z.array(z.number()).min(0)
});

// Zod schema for validating PeriodsInfo objects
export const periodsInfoSchema = z.object({
  periodsPerDay: z.number()
    .min(1, 'Periods per day must be at least 1')
    .max(12, 'Periods per day cannot exceed 12'),
  periodDuration: z.number()
    .min(10, 'Period duration must be at least 10 minutes')
    .max(120, 'Period duration cannot exceed 120 minutes'),
  schoolStartTime: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'School start time must be in HH:mm format'),
  periods: z.array(z.object({
    index: z.number(),
    startTime: z.string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:mm format')
      .optional(),
    endTime: z.string()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:mm format')
      .optional()
  })).optional(),
  breakPeriods: z.array(z.number())
    .min(0, 'Break periods array must be valid')
    .optional()
});

// Zod schema for validating wizard step data
export const wizardStepSchema = z.object({
  stepKey: z.string().min(1, 'Step key is required'),
  data: z.any()
});

// Schema for school info form validation
export const schoolInfoFormSchema = schoolInfoSchema.extend({
  schoolName: z.string().min(2, 'School name must be at least 2 characters')
});

// Schema for periods info form validation
export const periodsInfoFormSchema = periodsInfoSchema.extend({
  periodsPerDay: z.number().min(1, 'Periods per day must be at least 1').max(10, 'Periods per day cannot exceed 10 for form validation')
});

// Helper function to validate school info
export function validateSchoolInfo(info: unknown): info is SchoolInfo {
  const result = schoolInfoSchema.safeParse(info);
  return result.success;
}

// Helper function to validate periods info
export function validatePeriodsInfo(info: unknown): info is PeriodsInfo {
  const result = periodsInfoSchema.safeParse(info);
  return result.success;
}

// Helper function to validate wizard step data
export function validateWizardStep(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = wizardStepSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error
  };
}

// Schema for API responses
export const schoolInfoApiSchema = schoolInfoSchema.extend({
  id: z.string(), // Make ID required for API responses
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const periodsInfoApiSchema = periodsInfoSchema.extend({
  id: z.string(), // Make ID required for API responses
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

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
