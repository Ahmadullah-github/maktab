import { z } from 'zod';

const roomTypeFields = {
  value: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/i),
  label: z.string().trim().min(1).max(100),
  icon: z.string().trim().max(100).optional().default('Building'),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
};

export const createRoomTypeSchema = z.object(roomTypeFields).strict();
export const updateRoomTypeSchema = z
  .object({
    value: roomTypeFields.value.optional(),
    label: roomTypeFields.label.optional(),
    icon: roomTypeFields.icon.optional(),
    sortOrder: roomTypeFields.sortOrder.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
