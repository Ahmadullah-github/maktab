import { z } from 'zod';

const generationConfigSchema = z
  .object({
    schoolId: z.number().int().positive().nullable().optional(),
  })
  .passthrough();

export const generateRequestSchema = z
  .object({
    config: generationConfigSchema.optional().default({}),
    strategy: z.enum(['fast', 'balanced', 'thorough']).optional().default('balanced'),
  })
  .passthrough();

export const generationJobRequestSchema = z
  .object({
    mode: z.enum(['quick', 'improve']).optional().default('quick'),
    config: generationConfigSchema.optional().default({}),
    sourceTimetableId: z.number().int().positive().optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === 'improve' && !value.sourceTimetableId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceTimetableId'],
        message: 'sourceTimetableId is required for improvement jobs',
      });
    }
  });

export const analyzeRequestSchema = z
  .object({
    config: generationConfigSchema.optional().default({}),
  })
  .passthrough();
