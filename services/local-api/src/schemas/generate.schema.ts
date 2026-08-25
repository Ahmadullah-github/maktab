import { z } from 'zod';

const generationConfigSchema = z
  .object({
    schoolId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const generateRequestSchema = z
  .object({
    config: generationConfigSchema.optional().default({}),
    strategy: z.enum(['fast', 'balanced', 'thorough']).optional().default('balanced'),
  })
  .strict();

export const analyzeRequestSchema = z
  .object({
    config: generationConfigSchema.optional().default({}),
  })
  .strict();
