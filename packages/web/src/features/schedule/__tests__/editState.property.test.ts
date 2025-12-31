/**
 * Property-based tests for edit state in schedule store
 * **Feature: schedule-phase8, Properties 1-6**
 * **Validates: Requirements 1.5, 1.6, 3.1-3.7, 4.1-4.5, 5.1-5.5, 6.1, 6.2, 15.3-15.5**
 */

import fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCanRedo,
  getCanUndo,
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../stores/scheduleStore';
import { DayOfWeek, type ScheduledLesson, type SwapOperation, UNDO_STACK_LIMIT } from '../types';

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

// Generator for a pair of lessons that can be swapped (different slots)
const swapPairArb = fc
  .tuple(scheduledLessonArb, scheduledLessonArb)
  .filter(([a, b]) => a.day !== b.day || a.periodIndex !== b.periodIndex)
  .map(([lessonA, lessonB]) => ({
    lessonA,
    lessonB,
    slotA: { day: lessonA.day, period: lessonA.periodIndex },
    slotB: { day: lessonB.day, period: lessonB.periodIndex },
  }));

// Generator for swap with empty target slot
const swapToEmptyArb = scheduledLessonArb.chain((lessonA) =>
  fc
    .tuple(dayOfWeekArb, fc.integer({ min: 0, max: 7 }))
    .filter(([day, period]) => day !== lessonA.day || period !== lessonA.periodIndex)
    .map(([day, period]) => ({
      lessonA,
      lessonB: null,
      slotA: { day: lessonA.day, period: lessonA.periodIndex },
      slotB: { day, period },
    }))
);

// Generator for SwapOperation (either with lessonB or empty slot)
const swapOperationArb: fc.Arbitrary<SwapOperation> = fc.oneof(swapPairArb, swapToEmptyArb);

describe('Edit State Property Tests', () => {
  // Reset store before each test
  beforeEach(() => {
    useScheduleStore.getState().clearSchedule();
  });

  /**
   * **Feature: schedule-phase8, Property 1: Undo/Redo Round Trip**
   * **Validates: Requirements 3.2, 4.2, 5.2**
   *
   * For any sequence of swap executions followed by the same number of undos
   * and then redos, the final lessons array should equal the state after all
   * swaps were executed.
   */
  describe('Property 1: Undo/Redo Round Trip', () => {
    it('undo then redo restores the state after swap', () => {
      fc.assert(
        fc.property(swapOperationArb, (swap) => {
          const store = useScheduleStore.getState();

          // Set up initial lessons
          const initialLessons = [swap.lessonA];
          if (swap.lessonB) {
            initialLessons.push(swap.lessonB);
          }
          useScheduleStore.setState({ lessons: initialLessons });

          // Execute swap
          store.executeSwap(swap);
          const stateAfterSwap = useScheduleStore.getState();
          const lessonsAfterSwap = [...stateAfterSwap.lessons];

          // Undo
          useScheduleStore.getState().undo();
          const stateAfterUndo = useScheduleStore.getState();

          // Verify lessons are restored to original positions
          const lessonAAfterUndo = stateAfterUndo.lessons.find(
            (l) => l.classId === swap.lessonA.classId
          );
          expect(lessonAAfterUndo?.day).toBe(swap.lessonA.day);
          expect(lessonAAfterUndo?.periodIndex).toBe(swap.lessonA.periodIndex);

          // Redo
          useScheduleStore.getState().redo();
          const stateAfterRedo = useScheduleStore.getState();

          // Verify lessons match state after swap
          const lessonAAfterRedo = stateAfterRedo.lessons.find(
            (l) => l.classId === swap.lessonA.classId
          );
          const lessonAInSwapped = lessonsAfterSwap.find((l) => l.classId === swap.lessonA.classId);
          expect(lessonAAfterRedo?.day).toBe(lessonAInSwapped?.day);
          expect(lessonAAfterRedo?.periodIndex).toBe(lessonAInSwapped?.periodIndex);
        }),
        { numRuns: 100 }
      );
    });

    it('multiple undos then redos restore state correctly', () => {
      fc.assert(
        fc.property(fc.array(swapOperationArb, { minLength: 1, maxLength: 5 }), (swaps) => {
          // Set up initial lessons from all swaps
          const allLessons: ScheduledLesson[] = [];
          const seenClassIds = new Set<string>();

          for (const swap of swaps) {
            if (!seenClassIds.has(swap.lessonA.classId)) {
              allLessons.push(swap.lessonA);
              seenClassIds.add(swap.lessonA.classId);
            }
            if (swap.lessonB && !seenClassIds.has(swap.lessonB.classId)) {
              allLessons.push(swap.lessonB);
              seenClassIds.add(swap.lessonB.classId);
            }
          }

          useScheduleStore.setState({ lessons: allLessons });

          // Execute all swaps
          for (const swap of swaps) {
            useScheduleStore.getState().executeSwap(swap);
          }

          const stateAfterAllSwaps = useScheduleStore.getState();
          const undoStackLength = stateAfterAllSwaps.undoStack.length;

          // Undo all
          for (let i = 0; i < undoStackLength; i++) {
            useScheduleStore.getState().undo();
          }

          // Redo all
          for (let i = 0; i < undoStackLength; i++) {
            useScheduleStore.getState().redo();
          }

          const finalState = useScheduleStore.getState();

          // Verify undo stack length is restored
          expect(finalState.undoStack.length).toBe(undoStackLength);
          expect(finalState.redoStack.length).toBe(0);
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Feature: schedule-phase8, Property 2: Swap Execution State Consistency**
   * **Validates: Requirements 3.1, 3.4, 3.5, 3.6, 3.7**
   *
   * For any valid swap operation, after execution:
   * - The undoStack length should increase by 1 (unless at limit, then stays at limit)
   * - The redoStack should be empty
   * - The interactionMode should be 'idle'
   * - The selectedLesson should be null
   * - A valid SwapAction should be at the top of undoStack
   */
  describe('Property 2: Swap Execution State Consistency', () => {
    it('executeSwap updates state correctly', () => {
      fc.assert(
        fc.property(swapOperationArb, (swap) => {
          // Set up initial state with a clean undoStack (not at limit)
          const initialLessons = [swap.lessonA];
          if (swap.lessonB) {
            initialLessons.push(swap.lessonB);
          }
          useScheduleStore.setState({
            lessons: initialLessons,
            interactionMode: 'selecting',
            selectedLesson: swap.lessonA,
            undoStack: [], // Start with empty undoStack to ensure we can test increment
            redoStack: [
              {
                id: 'old-action',
                timestamp: Date.now(),
                type: 'swap',
                before: { lessonA: swap.lessonA, lessonB: null },
                after: { lessonA: swap.lessonA, lessonB: null },
              },
            ],
          });

          const stateBefore = useScheduleStore.getState();
          const undoStackLengthBefore = stateBefore.undoStack.length;

          // Execute swap
          useScheduleStore.getState().executeSwap(swap);

          const stateAfter = useScheduleStore.getState();

          // Verify undoStack length increased by 1 (Requirement 3.4)
          // Note: When at limit, it stays at limit (tested separately in Property 3)
          const expectedLength = Math.min(undoStackLengthBefore + 1, UNDO_STACK_LIMIT);
          expect(stateAfter.undoStack.length).toBe(expectedLength);

          // Verify redoStack is empty (Requirement 3.5)
          expect(stateAfter.redoStack.length).toBe(0);

          // Verify interactionMode is 'idle' (Requirement 3.6)
          expect(stateAfter.interactionMode).toBe('idle');

          // Verify selectedLesson is null (Requirement 3.7)
          expect(stateAfter.selectedLesson).toBeNull();

          // Verify SwapAction at top of undoStack is valid (Requirement 3.1)
          const topAction = stateAfter.undoStack[stateAfter.undoStack.length - 1];
          expect(topAction).toBeDefined();
          expect(topAction.id).toBeDefined();
          expect(typeof topAction.id).toBe('string');
          expect(topAction.timestamp).toBeDefined();
          expect(typeof topAction.timestamp).toBe('number');
          expect(topAction.type).toBe('swap');
          expect(topAction.before.lessonA).toBeDefined();
          expect(topAction.after.lessonA).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase8, Property 3: Stack Limit Enforcement**
   * **Validates: Requirements 6.1, 6.2**
   *
   * For any sequence of more than 50 swap executions without undo,
   * the undoStack length should never exceed 50, and the oldest
   * actions should be removed first.
   */
  describe('Property 3: Stack Limit Enforcement', () => {
    it('undoStack never exceeds UNDO_STACK_LIMIT', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: UNDO_STACK_LIMIT + 1, max: UNDO_STACK_LIMIT + 20 }),
          (numSwaps) => {
            // Create a base lesson
            const baseLesson: ScheduledLesson = {
              day: DayOfWeek.Saturday,
              periodIndex: 0,
              classId: 'class-1',
              className: 'Class 1',
              subjectId: 'subject-1',
              subjectName: 'Subject 1',
              teacherIds: ['teacher-1'],
              teacherNames: ['Teacher 1'],
              roomId: 'room-1',
              roomName: 'Room 1',
              isFixed: false,
              periodsThisDay: 6,
            };

            useScheduleStore.setState({ lessons: [baseLesson] });

            // Execute many swaps
            for (let i = 0; i < numSwaps; i++) {
              const currentState = useScheduleStore.getState();
              const currentLesson = currentState.lessons[0];

              const swap: SwapOperation = {
                lessonA: currentLesson,
                lessonB: null,
                slotA: { day: currentLesson.day, period: currentLesson.periodIndex },
                slotB: { day: DayOfWeek.Sunday, period: i % 8 },
              };

              useScheduleStore.getState().executeSwap(swap);

              // Verify stack limit is enforced
              const state = useScheduleStore.getState();
              expect(state.undoStack.length).toBeLessThanOrEqual(UNDO_STACK_LIMIT);
            }

            // Final verification
            const finalState = useScheduleStore.getState();
            expect(finalState.undoStack.length).toBe(UNDO_STACK_LIMIT);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: schedule-phase8, Property 4: Computed Properties Correctness**
   * **Validates: Requirements 1.5, 1.6, 8.3, 8.4, 8.5, 8.6**
   *
   * For any schedule state:
   * - unsavedChangesCount should equal undoStack.length
   * - hasUnsavedChanges should equal undoStack.length > 0
   * - canUndo should equal undoStack.length > 0
   * - canRedo should equal redoStack.length > 0
   */
  describe('Property 4: Computed Properties Correctness', () => {
    it('computed selectors return correct values based on stack lengths', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          (undoCount, redoCount) => {
            // Create mock swap actions
            const createMockAction = (id: string) => ({
              id,
              timestamp: Date.now(),
              type: 'swap' as const,
              before: {
                lessonA: {
                  day: DayOfWeek.Saturday,
                  periodIndex: 0,
                  classId: 'c1',
                  className: null,
                  subjectId: 's1',
                  subjectName: null,
                  teacherIds: ['t1'],
                  teacherNames: null,
                  roomId: null,
                  roomName: null,
                  isFixed: false,
                  periodsThisDay: null,
                },
                lessonB: null,
              },
              after: {
                lessonA: {
                  day: DayOfWeek.Sunday,
                  periodIndex: 1,
                  classId: 'c1',
                  className: null,
                  subjectId: 's1',
                  subjectName: null,
                  teacherIds: ['t1'],
                  teacherNames: null,
                  roomId: null,
                  roomName: null,
                  isFixed: false,
                  periodsThisDay: null,
                },
                lessonB: null,
              },
            });

            const undoStack = Array.from({ length: undoCount }, (_, i) =>
              createMockAction(`undo-${i}`)
            );
            const redoStack = Array.from({ length: redoCount }, (_, i) =>
              createMockAction(`redo-${i}`)
            );

            useScheduleStore.setState({ undoStack, redoStack });

            const state = useScheduleStore.getState();

            // Verify computed properties
            expect(getUnsavedChangesCount(state)).toBe(undoCount);
            expect(getHasUnsavedChanges(state)).toBe(undoCount > 0);
            expect(getCanUndo(state)).toBe(undoCount > 0);
            expect(getCanRedo(state)).toBe(redoCount > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase8, Property 5: Index Synchronization**
   * **Validates: Requirements 3.3, 4.3, 5.3, 16.4**
   *
   * For any sequence of swap, undo, and redo operations, the indexes
   * should correctly reflect the current lesson positions.
   */
  describe('Property 5: Index Synchronization', () => {
    it('indexes are synchronized after swap operations', () => {
      fc.assert(
        fc.property(swapOperationArb, (swap) => {
          // Set up initial lessons
          const initialLessons = [swap.lessonA];
          if (swap.lessonB) {
            initialLessons.push(swap.lessonB);
          }
          useScheduleStore.setState({ lessons: initialLessons });
          useScheduleStore.getState().updateIndexes();

          // Execute swap
          useScheduleStore.getState().executeSwap(swap);

          const state = useScheduleStore.getState();

          // Verify indexes are synchronized with lessons
          for (const lesson of state.lessons) {
            const slotKey = `${lesson.day}-${lesson.periodIndex}`;
            const classSlotKey = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;

            // Check bySlot index
            const slotLessons = state.indexes.bySlot.get(slotKey);
            expect(slotLessons).toBeDefined();
            expect(slotLessons).toContainEqual(lesson);

            // Check byClassAndSlot index
            const classSlotLesson = state.indexes.byClassAndSlot.get(classSlotKey);
            expect(classSlotLesson).toBeDefined();
            expect(classSlotLesson).toEqual(lesson);

            // Check byClass index
            const classLessons = state.indexes.byClass.get(lesson.classId);
            expect(classLessons).toBeDefined();
            expect(classLessons).toContainEqual(lesson);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('indexes are synchronized after undo', () => {
      fc.assert(
        fc.property(swapOperationArb, (swap) => {
          // Set up initial lessons
          const initialLessons = [swap.lessonA];
          if (swap.lessonB) {
            initialLessons.push(swap.lessonB);
          }
          useScheduleStore.setState({ lessons: initialLessons });

          // Execute swap then undo
          useScheduleStore.getState().executeSwap(swap);
          useScheduleStore.getState().undo();

          const state = useScheduleStore.getState();

          // Verify indexes are synchronized with lessons
          for (const lesson of state.lessons) {
            const classSlotKey = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;
            const classSlotLesson = state.indexes.byClassAndSlot.get(classSlotKey);
            expect(classSlotLesson).toBeDefined();
            expect(classSlotLesson).toEqual(lesson);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase8, Property 6: markAsSaved State Reset**
   * **Validates: Requirements 15.3, 15.4, 15.5**
   *
   * For any schedule state with unsaved changes, after calling markAsSaved:
   * - originalLessons should equal the current lessons
   * - undoStack should be empty
   * - lastSavedAt should be a recent timestamp (within 1 second)
   */
  describe('Property 6: markAsSaved State Reset', () => {
    it('markAsSaved resets edit state correctly', () => {
      fc.assert(
        fc.property(fc.array(scheduledLessonArb, { minLength: 1, maxLength: 10 }), (lessons) => {
          // Set up state with some unsaved changes
          useScheduleStore.setState({
            lessons,
            undoStack: [
              {
                id: 'action-1',
                timestamp: Date.now(),
                type: 'swap',
                before: { lessonA: lessons[0], lessonB: null },
                after: { lessonA: lessons[0], lessonB: null },
              },
            ],
            originalLessons: [],
            lastSavedAt: null,
          });

          const timeBefore = Date.now();

          // Call markAsSaved
          useScheduleStore.getState().markAsSaved();

          const timeAfter = Date.now();
          const state = useScheduleStore.getState();

          // Verify originalLessons equals current lessons (Requirement 15.3)
          expect(state.originalLessons).toEqual(lessons);

          // Verify undoStack is empty (Requirement 15.4)
          expect(state.undoStack.length).toBe(0);

          // Verify lastSavedAt is a recent timestamp (Requirement 15.5)
          expect(state.lastSavedAt).not.toBeNull();
          expect(state.lastSavedAt!.getTime()).toBeGreaterThanOrEqual(timeBefore);
          expect(state.lastSavedAt!.getTime()).toBeLessThanOrEqual(timeAfter);
        }),
        { numRuns: 100 }
      );
    });
  });
});
