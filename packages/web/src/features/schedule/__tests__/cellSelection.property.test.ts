/**
 * Property-based tests for cell selection
 * **Feature: schedule-phase6, Property 4: Selection State Consistency**
 * **Validates: Requirements 3.1, 3.2, 3.5**
 *
 * **Feature: schedule-phase6, Property 5: Escape Cancellation**
 * **Validates: Requirements 3.3**
 */

import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

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

describe('Cell Selection Property Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  /**
   * **Feature: schedule-phase6, Property 4: Selection State Consistency**
   * **Validates: Requirements 3.1, 3.2, 3.5**
   *
   * For any selection action (Enter/Space on focused cell or click on cell with lesson),
   * the selectedLesson should be set to the lesson at that position, and
   * interactionMode should be 'selecting'.
   */
  describe('Property 4: Selection State Consistency', () => {
    it('selecting a lesson sets selectedLesson and mode to selecting', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Select the lesson
          useScheduleStore.getState().selectLesson(lesson);

          // Get the state
          const state = useScheduleStore.getState();

          // Verify selectedLesson is set to the lesson
          expect(state.selectedLesson).toEqual(lesson);

          // Verify interactionMode is 'selecting'
          expect(state.interactionMode).toBe('selecting');
        }),
        { numRuns: 100 }
      );
    });

    it('selecting a new lesson replaces the previous selection', () => {
      fc.assert(
        fc.property(scheduledLessonArb, scheduledLessonArb, (lesson1, lesson2) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Select first lesson
          useScheduleStore.getState().selectLesson(lesson1);

          // Verify first lesson is selected
          expect(useScheduleStore.getState().selectedLesson).toEqual(lesson1);
          expect(useScheduleStore.getState().interactionMode).toBe('selecting');

          // Select second lesson
          useScheduleStore.getState().selectLesson(lesson2);

          // Verify second lesson replaced the first
          const state = useScheduleStore.getState();
          expect(state.selectedLesson).toEqual(lesson2);
          expect(state.interactionMode).toBe('selecting');
        }),
        { numRuns: 100 }
      );
    });

    it('selecting null sets selectedLesson to null and mode to idle', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // First select a lesson
          useScheduleStore.getState().selectLesson(lesson);
          expect(useScheduleStore.getState().selectedLesson).toEqual(lesson);

          // Then select null
          useScheduleStore.getState().selectLesson(null);

          // Verify state
          const state = useScheduleStore.getState();
          expect(state.selectedLesson).toBeNull();
          expect(state.interactionMode).toBe('idle');
        }),
        { numRuns: 100 }
      );
    });

    it('selection preserves all lesson properties', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Select the lesson
          useScheduleStore.getState().selectLesson(lesson);

          // Get the selected lesson
          const selected = useScheduleStore.getState().selectedLesson;

          // Verify all properties are preserved
          expect(selected).not.toBeNull();
          if (selected) {
            expect(selected.day).toBe(lesson.day);
            expect(selected.periodIndex).toBe(lesson.periodIndex);
            expect(selected.classId).toBe(lesson.classId);
            expect(selected.className).toBe(lesson.className);
            expect(selected.subjectId).toBe(lesson.subjectId);
            expect(selected.subjectName).toBe(lesson.subjectName);
            expect(selected.teacherIds).toEqual(lesson.teacherIds);
            expect(selected.teacherNames).toEqual(lesson.teacherNames);
            expect(selected.roomId).toBe(lesson.roomId);
            expect(selected.roomName).toBe(lesson.roomName);
            expect(selected.isFixed).toBe(lesson.isFixed);
            expect(selected.periodsThisDay).toBe(lesson.periodsThisDay);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('interactionMode is always selecting when selectedLesson is non-null after selectLesson', () => {
      fc.assert(
        fc.property(
          fc.array(fc.option(scheduledLessonArb, { nil: null }), { minLength: 1, maxLength: 10 }),
          (lessons) => {
            // Reset state
            useScheduleStore.getState().clearSchedule();

            // Apply a sequence of selections
            for (const lesson of lessons) {
              useScheduleStore.getState().selectLesson(lesson);

              const state = useScheduleStore.getState();

              // Invariant: if selectedLesson is non-null, mode is 'selecting'
              // if selectedLesson is null, mode is 'idle'
              if (state.selectedLesson !== null) {
                expect(state.interactionMode).toBe('selecting');
              } else {
                expect(state.interactionMode).toBe('idle');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase6, Property 5: Escape Cancellation**
   * **Validates: Requirements 3.3**
   *
   * For any state with a non-null selectedLesson, pressing Escape should result in
   * selectedLesson being null and interactionMode being 'idle'.
   */
  describe('Property 5: Escape Cancellation', () => {
    it('cancelSelection sets selectedLesson to null and mode to idle', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // First select a lesson
          useScheduleStore.getState().selectLesson(lesson);

          // Verify lesson is selected
          expect(useScheduleStore.getState().selectedLesson).toEqual(lesson);
          expect(useScheduleStore.getState().interactionMode).toBe('selecting');

          // Cancel selection (simulates Escape)
          useScheduleStore.getState().cancelSelection();

          // Verify state after cancellation
          const state = useScheduleStore.getState();
          expect(state.selectedLesson).toBeNull();
          expect(state.interactionMode).toBe('idle');
        }),
        { numRuns: 100 }
      );
    });

    it('cancelSelection is idempotent - calling multiple times has same effect', () => {
      fc.assert(
        fc.property(scheduledLessonArb, fc.integer({ min: 1, max: 5 }), (lesson, times) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // First select a lesson
          useScheduleStore.getState().selectLesson(lesson);

          // Cancel selection multiple times
          for (let i = 0; i < times; i++) {
            useScheduleStore.getState().cancelSelection();
          }

          // Verify state is always the same after any number of cancellations
          const state = useScheduleStore.getState();
          expect(state.selectedLesson).toBeNull();
          expect(state.interactionMode).toBe('idle');
        }),
        { numRuns: 100 }
      );
    });

    it('cancelSelection works even when no lesson is selected', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (times) => {
          // Reset state (no lesson selected)
          useScheduleStore.getState().clearSchedule();

          // Verify initial state
          expect(useScheduleStore.getState().selectedLesson).toBeNull();
          expect(useScheduleStore.getState().interactionMode).toBe('idle');

          // Cancel selection multiple times
          for (let i = 0; i < times; i++) {
            useScheduleStore.getState().cancelSelection();
          }

          // Verify state remains idle
          const state = useScheduleStore.getState();
          expect(state.selectedLesson).toBeNull();
          expect(state.interactionMode).toBe('idle');
        }),
        { numRuns: 100 }
      );
    });

    it('cancelSelection does not affect other state fields', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          fc.record({
            day: dayOfWeekArb,
            period: fc.integer({ min: 0, max: 7 }),
          }),
          fc.boolean(),
          (lesson, focusedSlot, isLocked) => {
            // Reset state
            useScheduleStore.getState().clearSchedule();

            // Set up state with focused slot and lock
            useScheduleStore.setState({
              focusedSlot,
              isLocked,
            });

            // Select a lesson
            useScheduleStore.getState().selectLesson(lesson);

            // Cancel selection
            useScheduleStore.getState().cancelSelection();

            // Verify only selection-related fields changed
            const state = useScheduleStore.getState();
            expect(state.selectedLesson).toBeNull();
            expect(state.interactionMode).toBe('idle');

            // Other fields should be unchanged
            expect(state.focusedSlot).toEqual(focusedSlot);
            expect(state.isLocked).toBe(isLocked);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
