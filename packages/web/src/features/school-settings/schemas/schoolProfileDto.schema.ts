import { z } from 'zod';

export const schoolProfileDtoSchema = z
  .object({
    id: z.literal(1),
    revision: z.number().int().positive(),
    officialName: z.string().trim().min(1).max(255),
    shortName: z.string().nullable(),
    nameFa: z.string().nullable(),
    namePs: z.string().nullable(),
    nameEn: z.string().nullable(),
    schoolCode: z.string().nullable(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    website: z.string().nullable(),
    defaultLanguage: z.enum(['fa', 'en']),
    logoUrl: z.string().nullable(),
    logoVersion: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const schoolProfileStatusDtoSchema = z
  .object({
    configured: z.boolean(),
    profile: schoolProfileDtoSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.configured !== (value.profile !== null)) {
      context.addIssue({ code: 'custom', message: 'Invalid school profile status' });
    }
  });

export type SchoolProfileDto = z.infer<typeof schoolProfileDtoSchema>;
export type SchoolProfileStatusDto = z.infer<typeof schoolProfileStatusDtoSchema>;
