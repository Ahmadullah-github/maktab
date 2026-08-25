import { timetableDataSchema } from '../schemas/timetable.schema';
import type { SolverInput } from './solverDataTransformer.service';

export interface GeneratedTimetableValidationIssue {
  code: string;
  message: string;
  lessonIndex?: number;
}

const slotKey = (day: string, period: number) => `${day}:${period}`;
const tupleKey = (...parts: string[]) => parts.join(':');

/**
 * Defense-in-depth verification of solver output before it crosses the persistence boundary.
 * These are hard constraints; an output with any issue must never be stored as a timetable.
 */
export function validateGeneratedTimetable(
  rawData: unknown,
  input: SolverInput
): GeneratedTimetableValidationIssue[] {
  const parsed = timetableDataSchema.safeParse(rawData);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      code: 'INVALID_PAYLOAD',
      message: `${issue.path.join('.') || 'data'}: ${issue.message}`,
    }));
  }

  const issues: GeneratedTimetableValidationIssue[] = [];
  const teacherById = new Map(input.teachers.map((teacher) => [String(teacher.id), teacher]));
  const classById = new Map(input.classes.map((item) => [String(item.id), item]));
  const subjectById = new Map(input.subjects.map((item) => [String(item.id), item]));
  const roomById = new Map(input.rooms.map((room) => [String(room.id), room]));
  const occupiedClasses = new Set<string>();
  const occupiedTeachers = new Set<string>();
  const occupiedRooms = new Set<string>();
  const requirementCounts = new Map<string, number>();
  const assignmentCounts = new Map<string, number>();
  const teacherLoads = new Map<string, number>();

  parsed.data.schedule.forEach((lesson, lessonIndex) => {
    const periodLimit = input.config.periodsPerDayMap?.[lesson.day] ?? input.config.periodsPerDay;
    if (!input.config.daysOfWeek.includes(lesson.day) || lesson.periodIndex >= periodLimit) {
      issues.push({ code: 'PERIOD_OUT_OF_BOUNDS', message: 'Lesson is outside the configured school week.', lessonIndex });
    }
    if (!classById.has(lesson.classId)) issues.push({ code: 'UNKNOWN_CLASS', message: `Unknown class ${lesson.classId}.`, lessonIndex });
    if (!subjectById.has(lesson.subjectId)) issues.push({ code: 'UNKNOWN_SUBJECT', message: `Unknown subject ${lesson.subjectId}.`, lessonIndex });

    const classSlot = tupleKey(lesson.classId, slotKey(lesson.day, lesson.periodIndex));
    if (occupiedClasses.has(classSlot)) issues.push({ code: 'CLASS_COLLISION', message: `Class ${lesson.classId} has two lessons in one slot.`, lessonIndex });
    occupiedClasses.add(classSlot);

    for (const teacherId of lesson.teacherIds) {
      const teacher = teacherById.get(teacherId);
      if (!teacher) {
        issues.push({ code: 'UNKNOWN_TEACHER', message: `Unknown teacher ${teacherId}.`, lessonIndex });
        continue;
      }
      const teacherSlot = tupleKey(teacherId, slotKey(lesson.day, lesson.periodIndex));
      if (occupiedTeachers.has(teacherSlot)) issues.push({ code: 'TEACHER_COLLISION', message: `Teacher ${teacherId} has two lessons in one slot.`, lessonIndex });
      occupiedTeachers.add(teacherSlot);
      teacherLoads.set(teacherId, (teacherLoads.get(teacherId) ?? 0) + 1);

      const dayAvailability = teacher.availability?.[lesson.day];
      const unavailable = teacher.unavailable?.find((entry: any) => entry.day === lesson.day)?.periods ?? [];
      if (dayAvailability?.[lesson.periodIndex] === false || unavailable.includes(lesson.periodIndex)) {
        issues.push({ code: 'TEACHER_UNAVAILABLE', message: `Teacher ${teacherId} is unavailable in this slot.`, lessonIndex });
      }
      const assignmentKey = tupleKey(teacherId, lesson.classId, lesson.subjectId);
      assignmentCounts.set(assignmentKey, (assignmentCounts.get(assignmentKey) ?? 0) + 1);
    }

    if (lesson.roomId) {
      const room = roomById.get(lesson.roomId);
      if (!room) {
        issues.push({ code: 'UNKNOWN_ROOM', message: `Unknown room ${lesson.roomId}.`, lessonIndex });
      } else {
        const roomSlot = tupleKey(lesson.roomId, slotKey(lesson.day, lesson.periodIndex));
        if (occupiedRooms.has(roomSlot)) issues.push({ code: 'ROOM_COLLISION', message: `Room ${lesson.roomId} is double-booked.`, lessonIndex });
        occupiedRooms.add(roomSlot);
        const unavailable = room.unavailable?.find((entry: any) => entry.day === lesson.day)?.periods ?? [];
        if (unavailable.includes(lesson.periodIndex)) issues.push({ code: 'ROOM_UNAVAILABLE', message: `Room ${lesson.roomId} is unavailable in this slot.`, lessonIndex });
      }
    }

    const subject = subjectById.get(lesson.subjectId);
    const room = lesson.roomId ? roomById.get(lesson.roomId) : undefined;
    const classGroup = classById.get(lesson.classId);
    if (subject?.requiredRoomType && room?.type !== subject.requiredRoomType) {
      issues.push({ code: 'ROOM_TYPE_MISMATCH', message: `Subject ${lesson.subjectId} requires room type ${subject.requiredRoomType}.`, lessonIndex });
    }
    const requiredCapacity = Math.max(
      Number(subject?.minRoomCapacity ?? 0),
      Number(classGroup?.studentCount ?? 0)
    );
    if (requiredCapacity > (room?.capacity ?? Number.POSITIVE_INFINITY)) {
      issues.push({ code: 'ROOM_CAPACITY', message: `Room ${lesson.roomId} is too small for this lesson.`, lessonIndex });
    }
    if (subject?.minRoomCapacity && !room) {
      issues.push({ code: 'ROOM_REQUIRED', message: `Subject ${lesson.subjectId} requires a room.`, lessonIndex });
    }
    if (classGroup?.fixedRoomId && lesson.roomId !== String(classGroup.fixedRoomId)) {
      issues.push({ code: 'FIXED_ROOM_MISMATCH', message: `Class ${lesson.classId} must use room ${classGroup.fixedRoomId}.`, lessonIndex });
    }
    const requirementKey = tupleKey(lesson.classId, lesson.subjectId);
    requirementCounts.set(requirementKey, (requirementCounts.get(requirementKey) ?? 0) + 1);
  });

  for (const classGroup of input.classes) {
    for (const [subjectId, requirement] of Object.entries(classGroup.subjectRequirements ?? {})) {
      const expected = Number((requirement as any).periodsPerWeek ?? requirement ?? 0);
      const actual = requirementCounts.get(tupleKey(String(classGroup.id), String(subjectId))) ?? 0;
      if (actual !== expected) issues.push({ code: 'REQUIREMENT_COUNT_MISMATCH', message: `Class ${classGroup.id}, subject ${subjectId}: expected ${expected} periods, received ${actual}.` });
    }
  }

  for (const assignment of input.fixedTeacherAssignments ?? []) {
    const key = tupleKey(String(assignment.teacherId), String(assignment.classId), String(assignment.subjectId));
    const actual = assignmentCounts.get(key) ?? 0;
    if (actual !== Number(assignment.periodsPerWeek)) issues.push({ code: 'TEACHER_ASSIGNMENT_MISMATCH', message: `Teacher ${assignment.teacherId}, class ${assignment.classId}, subject ${assignment.subjectId}: expected ${assignment.periodsPerWeek} periods, received ${actual}.` });
  }

  for (const [teacherId, load] of teacherLoads) {
    const maximum = Number(teacherById.get(teacherId)?.maxPeriodsPerWeek ?? 0);
    if (maximum > 0 && load > maximum) issues.push({ code: 'TEACHER_WORKLOAD', message: `Teacher ${teacherId} exceeds the weekly maximum (${load}/${maximum}).` });
  }

  return issues;
}
