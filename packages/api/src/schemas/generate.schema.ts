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

export const analyzeRequestSchema = z
  .object({
    config: generationConfigSchema.optional().default({}),
  })
  .passthrough();
