/**
 * Room validation schemas using Zod
 * @module schemas/room
 * 
 * Requirements: 9.3
 * - Validates Room create/update request bodies
 */

import { z } from 'zod';

/**
 * Schema for creating a new room
 * Validates all required fields for room creation
 */
export const createRoomSchema = z.object({
  name: z.string()
    .min(1, 'Room name is required')
    .max(255, 'Room name must be at most 255 characters'),
  
  schoolId: z.number().int().nullable().optional(),
  
  capacity: z.number()
    .int()
    .min(1, 'Room capacity must be at least 1')
    .max(1000, 'Room capacity must be at most 1000'),
  
  type: z.string()
    .min(1, 'Room type is required')
    .max(100, 'Room type must be at most 100 characters'),
  
  features: z.string()
    .optional()
    .default('[]')
    .describe('JSON string array of room features'),
  
  unavailable: z.string()
    .optional()
    .default('[]')
    .describe('JSON string of unavailable slots'),
  
  meta: z.string()
    .optional()
    .default('{}')
    .describe('JSON string of metadata'),
});

/**
 * Schema for updating an existing room
 * All fields are optional for partial updates
 */
export const updateRoomSchema = z.object({
  name: z.string()
    .min(1, 'Room name cannot be empty')
    .max(255, 'Room name must be at most 255 characters')
    .optional(),
  
  schoolId: z.number().int().nullable().optional(),
  
  capacity: z.number()
    .int()
    .min(1, 'Room capacity must be at least 1')
    .max(1000, 'Room capacity must be at most 1000')
    .optional(),
  
  type: z.string()
    .min(1, 'Room type cannot be empty')
    .max(100, 'Room type must be at most 100 characters')
    .optional(),
  
  features: z.string().optional(),
  unavailable: z.string().optional(),
  meta: z.string().optional(),
});

// Type exports
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
