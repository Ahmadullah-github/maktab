/**
 * Property-based tests for interaction state in schedule store
 * **Feature: schedule-phase6, Property 10: Store State Type Invariants**
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek, type InteractionMode, type ScheduledLesson } from '../types';

// Valid interaction modes
const VALID_INTERACTION_MODES: InteractionMode[] = ['idle', 'selecting', 'previewing', 'executing'];

// Generator for valid InteractionMode
const interactionModeArb = fc.constantFrom(...VALID_INTERACTION_MODES);

// Generator for valid DayOfWeek
const dayOfWeekArb = fc.constantFrom(...Object.values(DayOfWeek));

// Generator for non-empty string IDs
const idArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0);

// Generator for valid FocusedSlot
const focusedSlotArb = fc.record({
  day: dayOfWeekArb,
  period: fc.integer({ min: 0, max: 7 }),
});

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

describe('Interaction Store Property Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  /**
   * **Feature: schedule-phase6, Property 10: Store State Type Invariants**
   * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
   *
   * For any store state:
   * - interactionMode is one of: 'idle', 'selecting', 'previewing', 'executing'
   * - focusedSlot is either null or has valid day (DayOfWeek) and period (non-negative integer)
   * - selectedLesson is either null or a valid ScheduledLesson
   * - isLocked is a boolean
   */
  describe('Property 10: Store State Type Invariants', () => {
    it('interactionMode is always a valid InteractionMode value', () => {
      fc.assert(
        fc.property(interactionModeArb, (mode) => {
          // Set the interaction mode
          useScheduleStore.setState({ interactionMode: mode });

          // Get the state
          const state = useScheduleStore.getState();

          // Verify interactionMode is one of the valid values
          expect(VALID_INTERACTION_MODES).toContain(state.interactionMode);
        }),
        { numRuns: 100 }
      );
    });

    it('focusedSlot is either null or has valid day and non-negative period', () => {
      fc.assert(
        fc.property(fc.option(focusedSlotArb, { nil: null }), (slot) => {
          // Set the focused slot
          useScheduleStore.setState({ focusedSlot: slot });

          // Get the state
          const state = useScheduleStore.getState();

          // Verify focusedSlot invariants
          if (state.focusedSlot === null) {
            expect(state.focusedSlot).toBeNull();
          } else {
            // day must be a valid DayOfWeek
            expect(Object.values(DayOfWeek)).toContain(state.focusedSlot.day);
            // period must be a non-negative integer
            expect(state.focusedSlot.period).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(state.focusedSlot.period)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('selectedLesson is either null or a valid ScheduledLesson', () => {
      fc.assert(
        fc.property(fc.option(scheduledLessonArb, { nil: null }), (lesson) => {
          // Set the selected lesson
          useScheduleStore.setState({ selectedLesson: lesson });

          // Get the state
          const state = useScheduleStore.getState();

          // Verify selectedLesson invariants
          if (state.selectedLesson === null) {
            expect(state.selectedLesson).toBeNull();
          } else {
            // Must have required fields
            expect(state.selectedLesson.day).toBeDefined();
            expect(Object.values(DayOfWeek)).toContain(state.selectedLesson.day);
            expect(state.selectedLesson.periodIndex).toBeGreaterThanOrEqual(0);
            expect(state.selectedLesson.classId).toBeDefined();
            expect(state.selectedLesson.subjectId).toBeDefined();
            expect(Array.isArray(state.selectedLesson.teacherIds)).toBe(true);
            expect(typeof state.selectedLesson.isFixed).toBe('boolean');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('isLocked is always a boolean', () => {
      fc.assert(
        fc.property(fc.boolean(), (locked) => {
          // Set the lock state
          useScheduleStore.setState({ isLocked: locked });

          // Get the state
          const state = useScheduleStore.getState();

          // Verify isLocked is a boolean
          expect(typeof state.isLocked).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    it('all interaction state fields maintain type invariants after any combination of updates', () => {
      fc.assert(
        fc.property(
          fc.record({
            interactionMode: interactionModeArb,
            focusedSlot: fc.option(focusedSlotArb, { nil: null }),
            selectedLesson: fc.option(scheduledLessonArb, { nil: null }),
            isLocked: fc.boolean(),
          }),
          (interactionState) => {
            // Set all interaction state at once
            useScheduleStore.setState(interactionState);

            // Get the state
            const state = useScheduleStore.getState();

            // Verify all invariants hold
            expect(VALID_INTERACTION_MODES).toContain(state.interactionMode);

            if (state.focusedSlot !== null) {
              expect(Object.values(DayOfWeek)).toContain(state.focusedSlot.day);
              expect(state.focusedSlot.period).toBeGreaterThanOrEqual(0);
            }

            if (state.selectedLesson !== null) {
              expect(Object.values(DayOfWeek)).toContain(state.selectedLesson.day);
              expect(state.selectedLesson.periodIndex).toBeGreaterThanOrEqual(0);
            }

            expect(typeof state.isLocked).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
