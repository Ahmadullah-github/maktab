import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();

const schoolProfileFields = {
  officialName: z.string().trim().min(1).max(255),
  shortName: optionalText(100),
  nameFa: optionalText(255),
  namePs: optionalText(255),
  nameEn: optionalText(255),
  schoolCode: optionalText(100),
  address: optionalText(500),
  phone: optionalText(50),
  email: z.string().trim().email().max(254).nullable().optional(),
  website: z.string().trim().url().max(2048).nullable().optional(),
  defaultLanguage: z.enum(['fa', 'en']),
} as const;

export const createSchoolProfileSchema = z.object(schoolProfileFields).strict();

export const updateSchoolProfileSchema = z
  .object({
    revision: z.number().int().positive(),
    ...schoolProfileFields,
  })
  .strict();
