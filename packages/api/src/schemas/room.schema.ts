/**
 * Room validation schemas using Zod
 * @module schemas/room
 *
 * Requirements: 9.3
 * - Validates Room create/update request bodies
 */

import { z } from 'zod';
import { SCHOOL_WEEK_DAYS } from '../types/schoolConfig.types';

const jsonArray = z.unknown().transform((value, context): unknown[] => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must contain valid JSON' });
      return z.NEVER;
    }
  }
  if (!Array.isArray(parsed)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be an array' });
    return z.NEVER;
  }
  return parsed;
});

const featureArray = jsonArray.transform((value, context): string[] => {
  if (!value.every((item) => typeof item === 'string')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Features must be strings' });
    return z.NEVER;
  }
  return value as string[];
});

const jsonRecord = z.unknown().transform((value, context): Record<string, unknown> => {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must contain valid JSON' });
      return z.NEVER;
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be an object' });
    return z.NEVER;
  }
  return parsed as Record<string, unknown>;
});

const unavailableArray = jsonArray.pipe(
  z.array(
    z
      .object({
        day: z.enum(SCHOOL_WEEK_DAYS),
        period: z.number().int().min(0).max(11),
      })
      .strict()
  )
);

/**
 * Schema for creating a new room
 * Validates all required fields for room creation
 */
export const createRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(255, 'Room name must be at most 255 characters'),

  schoolId: z.number().int().nullable().optional(),

  capacity: z
    .number()
    .int()
    .min(1, 'Room capacity must be at least 1')
    .max(1000, 'Room capacity must be at most 1000'),

  type: z
    .string()
    .min(1, 'Room type is required')
    .max(100, 'Room type must be at most 100 characters'),

  features: featureArray.optional().default([]),

  unavailable: unavailableArray.optional().default([]),

  meta: jsonRecord.optional().default({}),
});

/**
 * Schema for updating an existing room
 * All fields are optional for partial updates
 */
export const updateRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name cannot be empty')
    .max(255, 'Room name must be at most 255 characters')
    .optional(),

  schoolId: z.number().int().nullable().optional(),

  capacity: z
    .number()
    .int()
    .min(1, 'Room capacity must be at least 1')
    .max(1000, 'Room capacity must be at most 1000')
    .optional(),

  type: z
    .string()
    .min(1, 'Room type cannot be empty')
    .max(100, 'Room type must be at most 100 characters')
    .optional(),

  features: featureArray.optional(),
  unavailable: unavailableArray.optional(),
  meta: jsonRecord.optional(),
});

export const bulkCreateRoomSchema = z
  .object({
    rooms: z.array(createRoomSchema).min(1).max(100),
  })
  .strict();

// Type exports
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
