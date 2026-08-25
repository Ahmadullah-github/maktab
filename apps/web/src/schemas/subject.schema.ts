import { z } from 'zod';

/**
 * Zod schema for subject form validation
 * Uses Farsi error messages for localized validation feedback
 *
 * Requirements: 3.3, 4.4, 8.2
 */
export const subjectSchema = z.object({
  name: z.string().trim().min(1, 'نام مضمون الزامی است').max(255),
  code: z.string().trim().max(50, 'کود نباید بیشتر از ۵۰ حرف باشد'),
  grade: z.number().min(1).max(12).nullable(),
  periodsPerWeek: z.number().int().min(1, 'حداقل ۱ ساعت').max(84, 'حداکثر ۸۴ ساعت').nullable(),
  section: z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']),
  requiredRoomType: z.string().trim().regex(/^[a-z0-9_-]+$/).nullable(),
  requiredFeatures: z.array(z.string()).transform((items) => [...new Set(items.map((item) => item.normalize('NFKC').trim().toLowerCase()).filter(Boolean))]),
  desiredFeatures: z.array(z.string()).transform((items) => [...new Set(items.map((item) => item.normalize('NFKC').trim().toLowerCase()).filter(Boolean))]),
  isDifficult: z.boolean(),
  minRoomCapacity: z.number().min(0, 'ظرفیت نمی‌تواند منفی باشد'),
});

export type SubjectFormData = z.infer<typeof subjectSchema>;
