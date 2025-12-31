/**
 * Property-based tests for schedule store
 * **Feature: schedule-phase1, Property 4: Store Clear Reset Invariant**
 * **Feature: schedule-phase1, Property 5: Store Index Consistency**
 */

import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_DISPLAY_SETTINGS } from '../constants';
import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek, type ScheduledLesson } from '../types';

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

describe('Schedule Store Property Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  /**
   * **Feature: schedule-phase1, Property 4: Store Clear Reset Invariant**
   * **Validates: Requirements 2.3**
   *
   * For any ScheduleState (regardless of current values), calling clearSchedule
   * SHALL result in a state where:
   * - scheduleId is null
   * - scheduleName is empty string
   * - lessons is empty array
   * - all index Maps are empty
   * - metadata is null
   * - statistics is null
   * - all entity Maps are empty
   * - displaySettings equals DEFAULT_DISPLAY_SETTINGS
   * - isLoading is false
   * - error is null
   */
  it('Property 4: clearSchedule always returns to initial state', () => {
    fc.assert(
      fc.property(
        // Generate random state values to set before clearing
        fc.record({
          scheduleId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
          scheduleName: fc.string(),
          lessons: lessonsArrayArb,
          isLoading: fc.boolean(),
          error: fc.option(fc.string(), { nil: null }),
        }),
        (randomState) => {
          const store = useScheduleStore.getState();

          // Manually set some state to simulate a loaded schedule
          useScheduleStore.setState({
            scheduleId: randomState.scheduleId,
            scheduleName: randomState.scheduleName,
            lessons: randomState.lessons,
            isLoading: randomState.isLoading,
            error: randomState.error,
          });

          // Call clearSchedule
          store.clearSchedule();

          // Get the state after clearing
          const clearedState = useScheduleStore.getState();

          // Verify all fields are reset to initial values
          expect(clearedState.scheduleId).toBeNull();
          expect(clearedState.scheduleName).toBe('');
          expect(clearedState.lessons).toEqual([]);
          expect(clearedState.indexes.bySlot.size).toBe(0);
          expect(clearedState.indexes.byTeacherAndSlot.size).toBe(0);
          expect(clearedState.indexes.byRoomAndSlot.size).toBe(0);
          expect(clearedState.indexes.byClassAndSlot.size).toBe(0);
          expect(clearedState.indexes.byTeacher.size).toBe(0);
          expect(clearedState.indexes.byClass.size).toBe(0);
          expect(clearedState.indexes.byRoom.size).toBe(0);
          expect(clearedState.metadata).toBeNull();
          expect(clearedState.statistics).toBeNull();
          expect(clearedState.teachers.size).toBe(0);
          expect(clearedState.rooms.size).toBe(0);
          expect(clearedState.classes.size).toBe(0);
          expect(clearedState.subjects.size).toBe(0);
          expect(clearedState.displaySettings).toEqual(DEFAULT_DISPLAY_SETTINGS);
          expect(clearedState.isLoading).toBe(false);
          expect(clearedState.error).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: schedule-phase1, Property 5: Store Index Consistency**
   * **Validates: Requirements 2.4**
   *
   * For any ScheduleState with a non-empty lessons array, after calling updateIndexes,
   * the indexes SHALL be consistent with the lessons array such that:
   * - bySlot.size equals the number of unique (day, periodIndex) combinations
   * - byClass.size equals the number of unique classIds
   * - byTeacher.size equals the number of unique teacherIds across all lessons
   * - Every lesson is findable via its corresponding index keys
   */
  it('Property 5: updateIndexes produces consistent indexes', () => {
    fc.assert(
      fc.property(lessonsArrayArb, (lessons) => {
        // Set lessons in the store
        useScheduleStore.setState({ lessons });

        // Call updateIndexes
        useScheduleStore.getState().updateIndexes();

        // Get the updated state
        const state = useScheduleStore.getState();

        // Calculate expected unique counts
        const uniqueSlots = new Set(lessons.map((l) => `${l.day}-${l.periodIndex}`));
        const uniqueClasses = new Set(lessons.map((l) => l.classId));
        const uniqueTeachers = new Set(lessons.flatMap((l) => l.teacherIds));
        const uniqueRooms = new Set(lessons.filter((l) => l.roomId !== null).map((l) => l.roomId));

        // Verify index sizes match unique counts
        expect(state.indexes.bySlot.size).toBe(uniqueSlots.size);
        expect(state.indexes.byClass.size).toBe(uniqueClasses.size);
        expect(state.indexes.byTeacher.size).toBe(uniqueTeachers.size);
        expect(state.indexes.byRoom.size).toBe(uniqueRooms.size);

        // Verify every lesson is findable via its corresponding index keys
        for (const lesson of lessons) {
          // Check bySlot
          const slotKey = `${lesson.day}-${lesson.periodIndex}`;
          const slotLessons = state.indexes.bySlot.get(slotKey);
          expect(slotLessons).toBeDefined();
          expect(slotLessons).toContain(lesson);

          // Check byClass
          const classLessons = state.indexes.byClass.get(lesson.classId);
          expect(classLessons).toBeDefined();
          expect(classLessons).toContain(lesson);

          // Check byTeacher for each teacherId
          for (const teacherId of lesson.teacherIds) {
            const teacherLessons = state.indexes.byTeacher.get(teacherId);
            expect(teacherLessons).toBeDefined();
            expect(teacherLessons).toContain(lesson);
          }

          // Check byRoom (only when roomId is not null)
          if (lesson.roomId !== null) {
            const roomLessons = state.indexes.byRoom.get(lesson.roomId);
            expect(roomLessons).toBeDefined();
            expect(roomLessons).toContain(lesson);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
