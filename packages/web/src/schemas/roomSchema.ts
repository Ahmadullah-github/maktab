// src/schemas/roomSchema.ts
import { z } from 'zod';
import { Room, ClassGroup } from '../types';
import { DayOfWeek } from '../lib/schema';

// Zod schema for validating Room objects
export const roomSchema = z.object({
  id: z.string().min(1, { message: 'ID must be a non-empty string' }),
  name: z.string().min(1, { message: 'Room name is required' }),
  capacity: z.number().int().positive({ message: 'Capacity must be a positive number' }),
  type: z.string().min(1, { message: 'Room type is required' }),
  features: z.array(z.string()).optional(),
  unavailable: z.array(z.object({
    day: z.union([z.nativeEnum(DayOfWeek), z.string()]), // weekday or ISO date
    periods: z.array(z.number().int().nonnegative())
  })).optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

// Schema for room form validation
export const roomFormSchema = roomSchema.pick({
  name: true,
  capacity: true,
  type: true,
  features: true
}).extend({
  name: z.string().min(2, 'Room name must be at least 2 characters'),
  capacity: z.number()
    .int()
    .min(1, 'Capacity must be at least 1')
    .max(1000, 'Capacity cannot exceed 1000')
});

// Helper function to validate a room object
export function validateRoom(room: unknown): room is Room {
  const result = roomSchema.safeParse(room);
  return result.success;
}

// Helper function to validate room form data
export function validateRoomForm(data: unknown): { success: boolean; errors?: z.ZodError } {
  const result = roomFormSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error
  };
}

// Add validation that references other entities
export const createRoomTimetableValidationSchema = (rooms: Room[], classes: ClassGroup[]) => 
  z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'Timetable name is required'),
    room: z.string().refine(
      (roomId) => rooms.some(r => r.id === roomId),
      'Room ID must be valid'
    ),
    classes: z.array(z.string()).refine(
      (classIds) => classIds.every(c => classes.some(cl => cl.id === c)),
      'Class IDs must be valid'
    ),
    // Validate that room types are consistent
    type: z.string().refine(
      (type) => rooms.some(r => r.type === type),
      'Room type must be valid'
    )
  });