/**
 * Property-based tests for index builder
 * **Feature: schedule-phase1, Property 1: Index Builder Completeness**
 * **Feature: schedule-phase1, Property 2: Multi-Teacher Index Correctness**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DayOfWeek, type ScheduledLesson } from '../types';
import { buildIndexes, createEntitySlotKey, createSlotKey } from '../utils/indexBuilder';

// Generator for valid DayOfWeek
const dayOfWeekArb = fc.constantFrom(...Object.values(DayOfWeek));

// Generator for non-empty string IDs
const idArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0);

// Generator for valid ScheduledLesson
const scheduledLessonArb: fc.Arbitrary<ScheduledLesson> = fc.record({
  day: dayOfWeekArb,
  periodIndex: fc.integer({ min: 0, max: 7 }),
  classId: idArb,
  className: fc.option(fc.string(), { nil: null }),
  subjectId: idArb,
  subjectName: fc.option(fc.string(), { nil: null }),
  teacherIds: fc.array(idArb, { minLength: 1, maxLength: 3 }),
  teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
  roomId: fc.option(idArb, { nil: null }),
  roomName: fc.option(fc.string(), { nil: null }),
  isFixed: fc.boolean(),
  periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
});

// Generator for lessons array (0-100 lessons for performance)
const lessonsArrayArb = fc.array(scheduledLessonArb, {
  minLength: 0,
  maxLength: 100,
});

// Generator for multi-teacher lesson (at least 2 teachers)
const multiTeacherLessonArb: fc.Arbitrary<ScheduledLesson> = fc.record({
  day: dayOfWeekArb,
  periodIndex: fc.integer({ min: 0, max: 7 }),
  classId: idArb,
  className: fc.option(fc.string(), { nil: null }),
  subjectId: idArb,
  subjectName: fc.option(fc.string(), { nil: null }),
  teacherIds: fc.array(idArb, { minLength: 2, maxLength: 5 }),
  teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
  roomId: fc.option(idArb, { nil: null }),
  roomName: fc.option(fc.string(), { nil: null }),
  isFixed: fc.boolean(),
  periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
});

describe('Index Builder Property Tests', () => {
  /**
   * **Feature: schedule-phase1, Property 1: Index Builder Completeness**
   * **Validates: Requirements 3.2, 3.3, 3.5**
   *
   * For any array of ScheduledLesson objects, after calling buildIndexes,
   * every lesson in the input array SHALL be retrievable via:
   * - bySlot using key `${lesson.day}-${lesson.periodIndex}`
   * - byClassAndSlot using key `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`
   * - byClass using key `${lesson.classId}`
   * - byTeacher for each teacherId in `lesson.teacherIds`
   * - byRoom using key `${lesson.roomId}` (when roomId is not null)
   */
  it('Property 1: Every lesson is findable via all relevant indexes', () => {
    fc.assert(
      fc.property(lessonsArrayArb, (lessons) => {
        const indexes = buildIndexes(lessons);

        for (const lesson of lessons) {
          // Check bySlot
          const slotKey = createSlotKey(lesson.day, lesson.periodIndex);
          const slotLessons = indexes.bySlot.get(slotKey);
          expect(slotLessons).toBeDefined();
          expect(slotLessons).toContain(lesson);

          // Check byClassAndSlot
          const classSlotKey = createEntitySlotKey(lesson.classId, lesson.day, lesson.periodIndex);
          const classSlotLesson = indexes.byClassAndSlot.get(classSlotKey);
          expect(classSlotLesson).toBeDefined();

          // Check byClass
          const classLessons = indexes.byClass.get(lesson.classId);
          expect(classLessons).toBeDefined();
          expect(classLessons).toContain(lesson);

          // Check byTeacher for each teacherId
          for (const teacherId of lesson.teacherIds) {
            const teacherLessons = indexes.byTeacher.get(teacherId);
            expect(teacherLessons).toBeDefined();
            expect(teacherLessons).toContain(lesson);
          }

          // Check byRoom (only when roomId is not null)
          if (lesson.roomId !== null) {
            const roomLessons = indexes.byRoom.get(lesson.roomId);
            expect(roomLessons).toBeDefined();
            expect(roomLessons).toContain(lesson);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase1, Property 2: Multi-Teacher Index Correctness**
   * **Validates: Requirements 3.4**
   *
   * For any ScheduledLesson with multiple teacherIds, the byTeacherAndSlot index
   * SHALL contain an entry for each teacher using key `${teacherId}-${lesson.day}-${lesson.periodIndex}`,
   * and each entry SHALL reference the same lesson.
   */
  it('Property 2: Multi-teacher lessons are indexed for each teacher', () => {
    fc.assert(
      fc.property(fc.array(multiTeacherLessonArb, { minLength: 1, maxLength: 50 }), (lessons) => {
        const indexes = buildIndexes(lessons);

        for (const lesson of lessons) {
          // Each teacher should have an entry in byTeacherAndSlot
          for (const teacherId of lesson.teacherIds) {
            const teacherSlotKey = createEntitySlotKey(teacherId, lesson.day, lesson.periodIndex);
            const indexedLesson = indexes.byTeacherAndSlot.get(teacherSlotKey);

            expect(indexedLesson).toBeDefined();
            // All teachers should reference the same lesson
            expect(indexedLesson).toBe(lesson);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
