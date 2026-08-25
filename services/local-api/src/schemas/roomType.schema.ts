import { z } from 'zod';
import { SUPPORTED_ROOM_TYPE_ICONS } from '../constants/roomTypes';

const roomTypeFields = {
  value: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/),
  labelFa: z.string().trim().min(1).max(100),
  labelEn: z.string().trim().min(1).max(100),
  icon: z.enum(SUPPORTED_ROOM_TYPE_ICONS).optional().default('Building'),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

export const createRoomTypeSchema = z.object(roomTypeFields).strict();
export const updateRoomTypeSchema = z
  .object({
    labelFa: roomTypeFields.labelFa.optional(),
    labelEn: roomTypeFields.labelEn.optional(),
    icon: roomTypeFields.icon.optional(),
    sortOrder: roomTypeFields.sortOrder.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
