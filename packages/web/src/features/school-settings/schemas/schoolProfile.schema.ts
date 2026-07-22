import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum);

export const schoolProfileFormSchema = z.object({
  officialName: z.string().trim().min(1, 'schoolSettings.profile.nameRequired').max(255),
  shortName: optionalText(100),
  nameFa: optionalText(255),
  namePs: optionalText(255),
  nameEn: optionalText(255),
  schoolCode: optionalText(100),
  address: optionalText(500),
  phone: optionalText(50),
  email: z.union([z.literal(''), z.string().trim().email().max(254)]),
  website: z.union([z.literal(''), z.string().trim().url().max(2048)]),
  defaultLanguage: z.enum(['fa', 'en']),
});

export type SchoolProfileFormValues = z.infer<typeof schoolProfileFormSchema>;

function nullable(value: string): string | null {
  return value.trim() || null;
}

export function toSchoolProfilePayload(values: SchoolProfileFormValues) {
  return {
    officialName: values.officialName.trim(),
    shortName: nullable(values.shortName),
    nameFa: nullable(values.nameFa),
    namePs: nullable(values.namePs),
    nameEn: nullable(values.nameEn),
    schoolCode: nullable(values.schoolCode),
    address: nullable(values.address),
    phone: nullable(values.phone),
    email: nullable(values.email),
    website: nullable(values.website),
    defaultLanguage: values.defaultLanguage,
  };
}
