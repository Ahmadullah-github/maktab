import { z } from 'zod';

const timetableDataSchema = z
  .unknown()
  .refine((value) => value !== null && value !== undefined, 'Timetable data is required');

export const createTimetableSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().max(4000).optional().default(''),
    data: timetableDataSchema,
    schoolId: z.number().int().positive().nullable().optional(),
    academicYearId: z.number().int().positive().nullable().optional(),
    termId: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const updateTimetableSchema = z
  .object({
    data: timetableDataSchema,
  })
  .strict();

export type CreateTimetableInput = z.infer<typeof createTimetableSchema>;
export type UpdateTimetableInput = z.infer<typeof updateTimetableSchema>;
