import { z } from 'zod';

/**
 * Zod schema for subject form validation
 * Uses Farsi error messages for localized validation feedback
 *
 * Requirements: 3.3, 4.4, 8.2
 */
export const subjectSchema = z.object({
  name: z.string().min(1, 'نام مضمون الزامی است'),
  code: z.string().min(1, 'کود مضمون الزامی است').max(10, 'کود نباید بیشتر از ۱۰ حرف باشد'),
  grade: z.number().min(1).max(12).nullable(),
  periodsPerWeek: z.number().min(1, 'حداقل ۱ ساعت').max(10, 'حداکثر ۱۰ ساعت').nullable(),
  section: z.enum(['PRIMARY', 'MIDDLE', 'HIGH', '']),
  requiredRoomType: z.enum([
    'normal',
    'computer_lab',
    'biology_lab',
    'chemistry_lab',
    'math_lab',
    'physics_lab',
    'lab',
    'library',
    'salon',
    'gym',
    'sport_camp',
    'other',
    '',
  ]),
  requiredFeatures: z.array(z.string()),
  desiredFeatures: z.array(z.string()),
  isDifficult: z.boolean(),
  minRoomCapacity: z.number().min(0, 'ظرفیت نمی‌تواند منفی باشد'),
});

export type SubjectFormData = z.infer<typeof subjectSchema>;
