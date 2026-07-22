import { z } from 'zod';

export const LESSON_FIXEDNESS_VERSION = 2;

/**
 * Solver output before fixedness v2 incorrectly marked every generated lesson
 * as fixed whenever its teacher allocation was locked. Repair only that
 * distinctive all-locked legacy shape; mixed schedules retain real anchors.
 */
export function repairLegacyLessonFixedness(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return payload;
  }

  const data = payload as Record<string, unknown>;
  const metadata =
    typeof data.metadata === 'object' && data.metadata !== null && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  if (Number(metadata.lessonFixednessVersion) >= LESSON_FIXEDNESS_VERSION) {
    return payload;
  }

  const schedule = Array.isArray(data.schedule) ? data.schedule : null;
  const isLegacyAllLocked =
    schedule !== null &&
    schedule.length > 0 &&
    schedule.every(
      (lesson) =>
        typeof lesson === 'object' &&
        lesson !== null &&
        !Array.isArray(lesson) &&
        (lesson as Record<string, unknown>).isFixed === true
    );
  if (!isLegacyAllLocked || schedule === null) {
    return payload;
  }

  return {
    ...data,
    schedule: schedule.map((lesson) => ({
      ...(lesson as Record<string, unknown>),
      isFixed: false,
    })),
    metadata: {
      ...metadata,
      lessonFixednessVersion: LESSON_FIXEDNESS_VERSION,
      fixedLessonCount: 0,
    },
  };
}

export const scheduledLessonSchema = z
  .object({
    day: z.enum(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
    periodIndex: z.number().int().nonnegative(),
    classId: z.coerce.string().min(1),
    className: z.string().nullable().optional(),
    subjectId: z.coerce.string().min(1),
    subjectName: z.string().nullable().optional(),
    teacherIds: z.array(z.coerce.string().min(1)).min(1),
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
