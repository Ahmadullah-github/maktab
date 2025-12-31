/**
 * Index builder utility for schedule data
 * Creates O(1) lookup structures for efficient schedule queries
 */

import type { ScheduledLesson, ScheduleIndexes } from '../types';

/**
 * Creates a slot key from day and period index
 * Format: "${day}-${periodIndex}"
 */
export function createSlotKey(day: string, periodIndex: number): string {
  return `${day}-${periodIndex}`;
}

/**
 * Creates an entity-slot key from entity ID, day, and period index
 * Format: "${entityId}-${day}-${periodIndex}"
 */
export function createEntitySlotKey(entityId: string, day: string, periodIndex: number): string {
  return `${entityId}-${day}-${periodIndex}`;
}

/**
 * Creates empty schedule indexes
 */
function createEmptyIndexes(): ScheduleIndexes {
  return {
    bySlot: new Map(),
    byTeacherAndSlot: new Map(),
    byRoomAndSlot: new Map(),
    byClassAndSlot: new Map(),
    byTeacher: new Map(),
    byClass: new Map(),
    byRoom: new Map(),
  };
}

/**
 * Builds all schedule indexes from a lessons array
 * Enables O(1) lookups by various keys
 *
 * @param lessons - Array of scheduled lessons
 * @returns ScheduleIndexes with all lookup maps populated
 */
export function buildIndexes(lessons: ScheduledLesson[]): ScheduleIndexes {
  // Handle empty lessons array edge case
  if (!lessons || lessons.length === 0) {
    return createEmptyIndexes();
  }

  const indexes = createEmptyIndexes();

  for (const lesson of lessons) {
    const slotKey = createSlotKey(lesson.day, lesson.periodIndex);

    // bySlot: group lessons by slot (multiple lessons can share a slot)
    const slotLessons = indexes.bySlot.get(slotKey) ?? [];
    slotLessons.push(lesson);
    indexes.bySlot.set(slotKey, slotLessons);

    // byClassAndSlot: single lesson per class+slot
    const classSlotKey = createEntitySlotKey(lesson.classId, lesson.day, lesson.periodIndex);
    indexes.byClassAndSlot.set(classSlotKey, lesson);

    // byClass: group all lessons for a class
    const classLessons = indexes.byClass.get(lesson.classId) ?? [];
    classLessons.push(lesson);
    indexes.byClass.set(lesson.classId, classLessons);

    // byTeacherAndSlot: handle multi-teacher support
    // Each teacher gets their own entry for the same lesson
    for (const teacherId of lesson.teacherIds) {
      const teacherSlotKey = createEntitySlotKey(teacherId, lesson.day, lesson.periodIndex);
      indexes.byTeacherAndSlot.set(teacherSlotKey, lesson);

      // byTeacher: group all lessons for a teacher
      const teacherLessons = indexes.byTeacher.get(teacherId) ?? [];
      teacherLessons.push(lesson);
      indexes.byTeacher.set(teacherId, teacherLessons);
    }

    // byRoomAndSlot: skip null roomIds
    if (lesson.roomId !== null) {
      const roomSlotKey = createEntitySlotKey(lesson.roomId, lesson.day, lesson.periodIndex);
      indexes.byRoomAndSlot.set(roomSlotKey, lesson);

      // byRoom: group all lessons for a room
      const roomLessons = indexes.byRoom.get(lesson.roomId) ?? [];
      roomLessons.push(lesson);
      indexes.byRoom.set(lesson.roomId, roomLessons);
    }
  }

  return indexes;
}
