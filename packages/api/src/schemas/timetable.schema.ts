import { z } from 'zod';

export const scheduledLessonSchema = z
  .object({
    day: z.enum(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    periodIndex: z.number().int().nonnegative(),
    classId: z.coerce.string().min(1),
    className: z.string().nullable().optional(),
    subjectId: z.coerce.string().min(1),
    subjectName: z.string().nullable().optional(),
    teacherIds: z.array(z.coerce.string().min(1)),
    teacherNames: z.array(z.string()).nullable().optional(),
    roomId: z.coerce.string().nullable().optional(),
    roomName: z.string().nullable().optional(),
    isFixed: z.boolean().optional(),
    periodsThisDay: z.number().int().positive().nullable().optional(),
  })
  .passthrough();

/** Canonical persisted solver payload. Metadata remains extensible, lessons do not. */
export const timetableDataSchema = z
  .object({
    schedule: z.array(scheduledLessonSchema),
    metadata: z.record(z.string(), z.unknown()).optional(),
    statistics: z.unknown().optional(),
    status: z.string().optional(),
    errors: z.array(z.string()).optional(),
  })
  .passthrough();

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
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const updateTimetableLessonsSchema = z
  .object({
    lessons: z.array(scheduledLessonSchema),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export type CreateTimetableInput = z.infer<typeof createTimetableSchema>;
export type UpdateTimetableInput = z.infer<typeof updateTimetableSchema>;
