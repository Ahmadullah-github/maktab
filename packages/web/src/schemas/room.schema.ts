import { z } from 'zod';

/**
 * Zod schema for room form validation
 * Uses Farsi error messages for localized validation feedback
 *
 * Requirements: 4.3, 4.4, 7.1
 */
export const roomSchema = z.object({
  name: z.string().min(1, 'نام اتاق الزامی است').max(255, 'نام اتاق نباید بیشتر از ۲۵۵ حرف باشد'),
  capacity: z
    .number()
    .min(1, 'ظرفیت باید حداقل ۱ باشد')
    .max(1000, 'ظرفیت نباید بیشتر از ۱۰۰۰ باشد'),
  type: z.enum([
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
  features: z.array(z.string()),
});

export type RoomFormData = z.infer<typeof roomSchema>;
