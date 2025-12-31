/**
 * Property-based tests for drag-drop functionality
 *
 * **Feature: schedule-phase6, Property 6: Drag Lock State Management**
 * **Validates: Requirements 4.1, 4.2, 4.5, 4.6**
 *
 * **Feature: schedule-phase6, Property 7: Drop Target Validation**
 * **Validates: Requirements 5.1, 5.4**
 */

import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import { createCellId, isValidDrop, parseCellId, type DragData } from '../hooks/useDragDrop';
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

// Generator for view scope
const viewScopeArb = fc.constantFrom<'class' | 'teacher'>('class', 'teacher');

// Generator for DragData
const dragDataArb: fc.Arbitrary<DragData> = fc.record({
  type: fc.constant('lesson' as const),
  lesson: scheduledLessonArb,
  sourceSlot: fc.record({
    day: dayOfWeekArb,
    period: fc.integer({ min: 0, max: 7 }),
  }),
  viewScope: viewScopeArb,
  viewId: idArb,
});

describe('Drag-Drop Property Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  /**
   * **Feature: schedule-phase6, Property 6: Drag Lock State Management**
   * **Validates: Requirements 4.1, 4.2, 4.5, 4.6**
   *
   * For any drag operation:
   * - onDragStart should set isLocked to true and selectedLesson to the dragged lesson
   * - onDragEnd should set isLocked to false
   * - onDragCancel should set isLocked to false, selectedLesson to null, and interactionMode to 'idle'
   */
  describe('Property 6: Drag Lock State Management', () => {
    it('drag start sets isLocked to true and selects the lesson', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Verify initial state
          expect(useScheduleStore.getState().isLocked).toBe(false);
          expect(useScheduleStore.getState().selectedLesson).toBeNull();

          // Simulate drag start: set lock and select lesson
          useScheduleStore.getState().setLocked(true);
          useScheduleStore.getState().selectLesson(lesson);

          // Verify state after drag start
          const state = useScheduleStore.getState();
          expect(state.isLocked).toBe(true);
          expect(state.selectedLesson).toEqual(lesson);
          expect(state.interactionMode).toBe('selecting');
        }),
        { numRuns: 100 }
      );
    });

    it('drag end sets isLocked to false', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Simulate drag start
          useScheduleStore.getState().setLocked(true);
          useScheduleStore.getState().selectLesson(lesson);

          // Verify locked state
          expect(useScheduleStore.getState().isLocked).toBe(true);

          // Simulate drag end: unlock
          useScheduleStore.getState().setLocked(false);

          // Verify state after drag end
          const state = useScheduleStore.getState();
          expect(state.isLocked).toBe(false);
          // Selection may or may not be cleared depending on drop validity
          // but lock should always be false
        }),
        { numRuns: 100 }
      );
    });

    it('drag cancel resets all interaction state', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Simulate drag start
          useScheduleStore.getState().setLocked(true);
          useScheduleStore.getState().selectLesson(lesson);

          // Verify state during drag
          expect(useScheduleStore.getState().isLocked).toBe(true);
          expect(useScheduleStore.getState().selectedLesson).toEqual(lesson);

          // Simulate drag cancel: unlock and cancel selection
          useScheduleStore.getState().setLocked(false);
          useScheduleStore.getState().cancelSelection();

          // Verify state after drag cancel
          const state = useScheduleStore.getState();
          expect(state.isLocked).toBe(false);
          expect(state.selectedLesson).toBeNull();
          expect(state.interactionMode).toBe('idle');
        }),
        { numRuns: 100 }
      );
    });

    it('lock state transitions are consistent through drag lifecycle', () => {
      fc.assert(
        fc.property(scheduledLessonArb, fc.constantFrom('end', 'cancel'), (lesson, endType) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          // Initial state: unlocked, no selection
          expect(useScheduleStore.getState().isLocked).toBe(false);
          expect(useScheduleStore.getState().selectedLesson).toBeNull();
          expect(useScheduleStore.getState().interactionMode).toBe('idle');

          // Drag start: locked, lesson selected
          useScheduleStore.getState().setLocked(true);
          useScheduleStore.getState().selectLesson(lesson);

          expect(useScheduleStore.getState().isLocked).toBe(true);
          expect(useScheduleStore.getState().selectedLesson).toEqual(lesson);
          expect(useScheduleStore.getState().interactionMode).toBe('selecting');

          // Drag end or cancel
          if (endType === 'end') {
            // Normal end: just unlock
            useScheduleStore.getState().setLocked(false);
            expect(useScheduleStore.getState().isLocked).toBe(false);
            // Selection may remain for swap operation
          } else {
            // Cancel: unlock and clear selection
            useScheduleStore.getState().setLocked(false);
            useScheduleStore.getState().cancelSelection();
            expect(useScheduleStore.getState().isLocked).toBe(false);
            expect(useScheduleStore.getState().selectedLesson).toBeNull();
            expect(useScheduleStore.getState().interactionMode).toBe('idle');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('multiple drag operations maintain correct lock state', () => {
      fc.assert(
        fc.property(fc.array(scheduledLessonArb, { minLength: 1, maxLength: 5 }), (lessons) => {
          // Reset state
          useScheduleStore.getState().clearSchedule();

          for (const lesson of lessons) {
            // Start drag
            useScheduleStore.getState().setLocked(true);
            useScheduleStore.getState().selectLesson(lesson);

            expect(useScheduleStore.getState().isLocked).toBe(true);
            expect(useScheduleStore.getState().selectedLesson).toEqual(lesson);

            // End drag (cancel)
            useScheduleStore.getState().setLocked(false);
            useScheduleStore.getState().cancelSelection();

            expect(useScheduleStore.getState().isLocked).toBe(false);
            expect(useScheduleStore.getState().selectedLesson).toBeNull();
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase6, Property 7: Drop Target Validation**
   * **Validates: Requirements 5.1, 5.4**
   *
   * For any drop attempt, the drop should only be accepted if the source and target
   * are within the same view scope (same class view or same teacher view).
   */
  describe('Property 7: Drop Target Validation', () => {
    it('drop is valid when source and target have same view scope and ID', () => {
      fc.assert(
        fc.property(dragDataArb, (dragData) => {
          // Drop with same scope and ID should be valid
          const isValid = isValidDrop(dragData, dragData.viewScope, dragData.viewId);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('drop is invalid when view scopes differ', () => {
      fc.assert(
        fc.property(dragDataArb, (dragData) => {
          // Flip the view scope
          const differentScope = dragData.viewScope === 'class' ? 'teacher' : 'class';

          // Drop with different scope should be invalid
          const isValid = isValidDrop(dragData, differentScope, dragData.viewId);
          expect(isValid).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('drop is invalid when view IDs differ', () => {
      fc.assert(
        fc.property(
          dragDataArb,
          idArb.filter((id) => id.length > 0),
          (dragData, differentId) => {
            // Skip if IDs happen to be the same
            fc.pre(differentId !== dragData.viewId);

            // Drop with different ID should be invalid
            const isValid = isValidDrop(dragData, dragData.viewScope, differentId);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('drop is invalid when both scope and ID differ', () => {
      fc.assert(
        fc.property(
          dragDataArb,
          idArb.filter((id) => id.length > 0),
          (dragData, differentId) => {
            // Skip if IDs happen to be the same
            fc.pre(differentId !== dragData.viewId);

            // Flip the view scope
            const differentScope = dragData.viewScope === 'class' ? 'teacher' : 'class';

            // Drop with different scope and ID should be invalid
            const isValid = isValidDrop(dragData, differentScope, differentId);
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidDrop is symmetric for same scope', () => {
      fc.assert(
        fc.property(
          viewScopeArb,
          idArb,
          idArb,
          scheduledLessonArb,
          dayOfWeekArb,
          fc.integer({ min: 0, max: 7 }),
          (scope, id1, id2, lesson, day, period) => {
            const dragData1: DragData = {
              type: 'lesson',
              lesson,
              sourceSlot: { day, period },
              viewScope: scope,
              viewId: id1,
            };

            const dragData2: DragData = {
              type: 'lesson',
              lesson,
              sourceSlot: { day, period },
              viewScope: scope,
              viewId: id2,
            };

            // If id1 === id2, both should be valid
            // If id1 !== id2, both should be invalid
            const valid1to2 = isValidDrop(dragData1, scope, id2);
            const valid2to1 = isValidDrop(dragData2, scope, id1);

            expect(valid1to2).toBe(valid2to1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional tests for cell ID utilities
   */
  describe('Cell ID Utilities', () => {
    it('createCellId and parseCellId are inverse operations', () => {
      fc.assert(
        fc.property(dayOfWeekArb, fc.integer({ min: 0, max: 100 }), (day, period) => {
          const cellId = createCellId(day, period);
          const parsed = parseCellId(cellId);

          expect(parsed).not.toBeNull();
          expect(parsed?.day).toBe(day);
          expect(parsed?.period).toBe(period);
        }),
        { numRuns: 100 }
      );
    });

    it('parseCellId returns null for invalid cell IDs', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            // Filter out strings that could be valid cell IDs
            const parts = s.split('-');
            if (parts.length < 2) return true;
            const validDays = [
              'Saturday',
              'Sunday',
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
            ];
            const day = parts.slice(0, -1).join('-');
            const period = parseInt(parts[parts.length - 1], 10);
            return !validDays.includes(day) || isNaN(period) || period < 0;
          }),
          (invalidId) => {
            const parsed = parseCellId(invalidId);
            expect(parsed).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
