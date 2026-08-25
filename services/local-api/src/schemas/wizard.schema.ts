import { z } from 'zod';

export const saveWizardStepSchema = z
  .object({
    data: z.unknown(),
  })
  .strict();
