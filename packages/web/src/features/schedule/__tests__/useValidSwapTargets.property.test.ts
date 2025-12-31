/**
 * Property-based tests for useValidSwapTargets hook
 * **Feature: schedule-phase7**
 *
 * Tests the core logic of valid swap targets computation.
 * Since React hooks require a component context, we test the underlying
 * logic functions directly.
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { getValidationStatusFromResult } from '../hooks/useValidSwapTargets';
import type {
  CellValidationStatus,
  RoomConstraintData,
  ScheduledLesson,
  SubjectConstraintData,
  SwapOperation,
  SwapValidationResult,
  TeacherConstraintData,
} from '../types';
import { DayOfWeek } from '../types';
import { validateSwap } from '../utils/constraintChecker';
import { buildIndexes, createSlotKey } from '../utils/indexBuilder';

// ============================================================================
// Generators
// ============================================================================

// Generator for valid DayOfWeek
const dayOfWeekArb = fc.constantFrom(...Object.values(DayOfWeek));

// Generator for non-empty string IDs
const idArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0);

// Generator for period index (0-7)
const periodArb = fc.integer({ min: 0, max: 7 });

// Generator for valid ScheduledLesson
const scheduledLessonArb: fc.Arbitrary<ScheduledLesson> = fc.record({
  day: dayOfWeekArb,
  periodIndex: periodArb,
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

// Generator for availability array (8 periods)
const availabilityArrayArb = fc.array(fc.boolean(), { minLength: 8, maxLength: 8 });

// Generator for full availability record
const fullAvailabilityArb: fc.Arbitrary<Record<DayOfWeek, boolean[]>> = fc.record({
  [DayOfWeek.Saturday]: availabilityArrayArb,
  [DayOfWeek.Sunday]: availabilityArrayArb,
  [DayOfWeek.Monday]: availabilityArrayArb,
  [DayOfWeek.Tuesday]: availabilityArrayArb,
  [DayOfWeek.Wednesday]: availabilityArrayArb,
  [DayOfWeek.Thursday]: availabilityArrayArb,
  [DayOfWeek.Friday]: availabilityArrayArb,
});

// Generator for SwapValidationResult
const swapValidationResultArb: fc.Arbitrary<SwapValidationResult> = fc.record({
  isValid: fc.boolean(),
  canProceedWithWarning: fc.boolean(),
  errors: fc.constant([]),
  warnings: fc.constant([]),
  swap: fc.record({
    lessonA: scheduledLessonArb,
    lessonB: fc.option(scheduledLessonArb, { nil: null }),
    slotA: fc.record({ day: dayOfWeekArb, period: periodArb }),
    slotB: fc.record({ day: dayOfWeekArb, period: periodArb }),
  }),
});

// ============================================================================
// Helper Functions for Testing
// ============================================================================

/**
 * Simulates the core logic of useValidSwapTargets
 * Computes validation results for all potential target slots
 */
function computeValidSwapTargets(
  selectedLesson: ScheduledLesson | null,
  scopeLessons: ScheduledLesson[],
  daysOfWeek: DayOfWeek[],
  periodsPerDayMap: Record<string, number>,
  teachers: Map<string, TeacherConstraintData>,
  rooms: Map<string, RoomConstraintData>,
  subjects: Map<string, SubjectConstraintData>
): Map<string, SwapValidationResult> {
  // Return empty map when no lesson selected (Requirement 11.3)
  if (!selectedLesson) {
    return new Map();
  }

  const results = new Map<string, SwapValidationResult>();
  const indexes = buildIndexes(scopeLessons);

  // Create a set of slots that have lessons for quick lookup
  const lessonsBySlot = new Map<string, ScheduledLesson>();
  for (const lesson of scopeLessons) {
    const slotKey = createSlotKey(lesson.day, lesson.periodIndex);
    lessonsBySlot.set(slotKey, lesson);
  }

  // Iterate through all slots in the schedule
  for (const day of daysOfWeek) {
    const periodsForDay = periodsPerDayMap[day] ?? 0;

    for (let period = 0; period < periodsForDay; period++) {
      const slotKey = createSlotKey(day, period);

      // Exclude selected lesson's own slot (Requirement 11.4)
      if (selectedLesson.day === day && selectedLesson.periodIndex === period) {
        continue;
      }

      // Get the lesson at this slot (if any)
      const targetLesson = lessonsBySlot.get(slotKey) ?? null;

      // Create swap operation
      const swap: SwapOperation = {
        lessonA: selectedLesson,
        lessonB: targetLesson,
        slotA: { day: selectedLesson.day, period: selectedLesson.periodIndex },
        slotB: { day, period },
      };

      // Validate the swap
      const result = validateSwap(swap, indexes, teachers, rooms, subjects);

      results.set(slotKey, result);
    }
  }

  return results;
}

// ============================================================================
// Property Tests
// ============================================================================

/**
 * **Feature: schedule-phase7, Property 11: Valid Targets Computation**
 * **Validates: Requirements 11.1, 11.3, 11.4**
 *
 * For any selected lesson, the useValidSwapTargets hook must:
 * - Return an empty map when no lesson is selected
 * - Exclude the selected lesson's own slot from potential targets
 * - Include validation results for all other slots in the view scope
 */
describe('Property 11: Valid Targets Computation', () => {
  const defaultDays = [
    DayOfWeek.Saturday,
    DayOfWeek.Sunday,
    DayOfWeek.Monday,
    DayOfWeek.Tuesday,
    DayOfWeek.Wednesday,
    DayOfWeek.Thursday,
  ];

  const defaultPeriodsPerDay: Record<string, number> = {
    [DayOfWeek.Saturday]: 6,
    [DayOfWeek.Sunday]: 6,
    [DayOfWeek.Monday]: 6,
    [DayOfWeek.Tuesday]: 6,
    [DayOfWeek.Wednesday]: 6,
    [DayOfWeek.Thursday]: 6,
  };

  it('returns empty map when no lesson is selected (Requirement 11.3)', () => {
    fc.assert(
      fc.property(fc.array(scheduledLessonArb, { minLength: 0, maxLength: 10 }), (scopeLessons) => {
        const teachers = new Map<string, TeacherConstraintData>();
        const rooms = new Map<string, RoomConstraintData>();
        const subjects = new Map<string, SubjectConstraintData>();

        const result = computeValidSwapTargets(
          null, // No lesson selected
          scopeLessons,
          defaultDays,
          defaultPeriodsPerDay,
          teachers,
          rooms,
          subjects
        );

        // Must return empty map when no lesson selected
        expect(result.size).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('excludes selected lesson own slot from potential targets (Requirement 11.4)', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb.filter(
          (l) => defaultDays.includes(l.day) && l.periodIndex < (defaultPeriodsPerDay[l.day] ?? 0)
        ),
        fullAvailabilityArb,
        (selectedLesson, availability) => {
          // Create teacher constraint data
          const teachers = new Map<string, TeacherConstraintData>();
          for (const teacherId of selectedLesson.teacherIds) {
            teachers.set(teacherId, {
              id: teacherId,
              availability,
              timePreference: 'None',
              maxConsecutivePeriods: 10,
            });
          }

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();

          const result = computeValidSwapTargets(
            selectedLesson,
            [selectedLesson],
            defaultDays,
            defaultPeriodsPerDay,
            teachers,
            rooms,
            subjects
          );

          // The selected lesson's own slot should NOT be in the results
          const ownSlotKey = createSlotKey(selectedLesson.day, selectedLesson.periodIndex);
          expect(result.has(ownSlotKey)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('includes validation results for all other slots in view scope (Requirement 11.1)', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb.filter(
          (l) => defaultDays.includes(l.day) && l.periodIndex < (defaultPeriodsPerDay[l.day] ?? 0)
        ),
        fullAvailabilityArb,
        (selectedLesson, availability) => {
          // Create teacher constraint data
          const teachers = new Map<string, TeacherConstraintData>();
          for (const teacherId of selectedLesson.teacherIds) {
            teachers.set(teacherId, {
              id: teacherId,
              availability,
              timePreference: 'None',
              maxConsecutivePeriods: 10,
            });
          }

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();

          const result = computeValidSwapTargets(
            selectedLesson,
            [selectedLesson],
            defaultDays,
            defaultPeriodsPerDay,
            teachers,
            rooms,
            subjects
          );

          // Calculate expected number of slots (excluding own slot)
          let totalSlots = 0;
          for (const day of defaultDays) {
            totalSlots += defaultPeriodsPerDay[day] ?? 0;
          }
          const expectedSlots = totalSlots - 1; // Minus own slot

          // Should have validation results for all other slots
          expect(result.size).toBe(expectedSlots);

          // Each result should be a valid SwapValidationResult
          for (const [, validationResult] of result) {
            expect(validationResult).toHaveProperty('isValid');
            expect(validationResult).toHaveProperty('canProceedWithWarning');
            expect(validationResult).toHaveProperty('errors');
            expect(validationResult).toHaveProperty('warnings');
            expect(validationResult).toHaveProperty('swap');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('validation results correctly reflect constraint violations', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb.filter(
          (l) =>
            defaultDays.includes(l.day) &&
            l.periodIndex < (defaultPeriodsPerDay[l.day] ?? 0) &&
            l.teacherIds.length > 0
        ),
        (selectedLesson) => {
          const teacherId = selectedLesson.teacherIds[0];

          // Create availability where ALL slots are unavailable
          const unavailableAvailability: Record<DayOfWeek, boolean[]> = {
            [DayOfWeek.Saturday]: Array(8).fill(false),
            [DayOfWeek.Sunday]: Array(8).fill(false),
            [DayOfWeek.Monday]: Array(8).fill(false),
            [DayOfWeek.Tuesday]: Array(8).fill(false),
            [DayOfWeek.Wednesday]: Array(8).fill(false),
            [DayOfWeek.Thursday]: Array(8).fill(false),
            [DayOfWeek.Friday]: Array(8).fill(false),
          };

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: unavailableAvailability,
            timePreference: 'None',
            maxConsecutivePeriods: 10,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();

          const result = computeValidSwapTargets(
            selectedLesson,
            [selectedLesson],
            defaultDays,
            defaultPeriodsPerDay,
            teachers,
            rooms,
            subjects
          );

          // All results should be invalid (blocked) due to teacher unavailability
          for (const [, validationResult] of result) {
            expect(validationResult.isValid).toBe(false);
            expect(validationResult.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Tests for getValidationStatusFromResult helper function
 * **Validates: Requirements 16.3**
 */
describe('getValidationStatusFromResult', () => {
  it('returns null for undefined result', () => {
    const status = getValidationStatusFromResult(undefined);
    expect(status).toBeNull();
  });

  it('returns "blocked" when isValid is false', () => {
    fc.assert(
      fc.property(
        swapValidationResultArb.map((r) => ({ ...r, isValid: false })),
        (result) => {
          const status = getValidationStatusFromResult(result);
          expect(status).toBe('blocked');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "warning" when isValid is true and canProceedWithWarning is true', () => {
    fc.assert(
      fc.property(
        swapValidationResultArb.map((r) => ({
          ...r,
          isValid: true,
          canProceedWithWarning: true,
        })),
        (result) => {
          const status = getValidationStatusFromResult(result);
          expect(status).toBe('warning');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "valid" when isValid is true and canProceedWithWarning is false', () => {
    fc.assert(
      fc.property(
        swapValidationResultArb.map((r) => ({
          ...r,
          isValid: true,
          canProceedWithWarning: false,
        })),
        (result) => {
          const status = getValidationStatusFromResult(result);
          expect(status).toBe('valid');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correctly maps all possible validation states to cell statuses', () => {
    // Test all combinations
    const testCases: Array<{
      isValid: boolean;
      canProceedWithWarning: boolean;
      expected: CellValidationStatus;
    }> = [
      { isValid: false, canProceedWithWarning: false, expected: 'blocked' },
      { isValid: false, canProceedWithWarning: true, expected: 'blocked' },
      { isValid: true, canProceedWithWarning: false, expected: 'valid' },
      { isValid: true, canProceedWithWarning: true, expected: 'warning' },
    ];

    for (const { isValid, canProceedWithWarning, expected } of testCases) {
      const result: SwapValidationResult = {
        isValid,
        canProceedWithWarning,
        errors: [],
        warnings: [],
        swap: {
          lessonA: {
            day: DayOfWeek.Saturday,
            periodIndex: 0,
            classId: 'class-1',
            className: null,
            subjectId: 'subject-1',
            subjectName: null,
            teacherIds: ['teacher-1'],
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          },
          lessonB: null,
          slotA: { day: DayOfWeek.Saturday, period: 0 },
          slotB: { day: DayOfWeek.Saturday, period: 1 },
        },
      };

      const status = getValidationStatusFromResult(result);
      expect(status).toBe(expected);
    }
  });
});

/**
 * Performance test for validation engine
 * **Validates: Requirements 17.1, 17.2**
 *
 * The validation engine SHALL complete all constraint checks for a single swap in less than 1ms
 * The useValidSwapTargets hook SHALL compute all valid targets in less than 100ms for 700 lessons
 */
describe('Performance Requirements', () => {
  it('validates all targets in under 100ms for 700 lessons (Requirement 17.2)', () => {
    // Generate 700 lessons across 20 classes, 6 days, 6 periods
    const lessons: ScheduledLesson[] = [];
    const days = [
      DayOfWeek.Saturday,
      DayOfWeek.Sunday,
      DayOfWeek.Monday,
      DayOfWeek.Tuesday,
      DayOfWeek.Wednesday,
      DayOfWeek.Thursday,
    ];
    const periodsPerDay = 6;
    const numClasses = 20;

    // Create 700 lessons (20 classes × 6 days × ~6 periods = 720 slots, we'll use ~700)
    let lessonCount = 0;
    for (let classIdx = 0; classIdx < numClasses && lessonCount < 700; classIdx++) {
      for (const day of days) {
        for (let period = 0; period < periodsPerDay && lessonCount < 700; period++) {
          lessons.push({
            day,
            periodIndex: period,
            classId: `class-${classIdx}`,
            className: `Class ${classIdx}`,
            subjectId: `subject-${(classIdx + period) % 10}`,
            subjectName: `Subject ${(classIdx + period) % 10}`,
            teacherIds: [`teacher-${(classIdx + period) % 15}`],
            teacherNames: [`Teacher ${(classIdx + period) % 15}`],
            roomId: `room-${(classIdx + period) % 8}`,
            roomName: `Room ${(classIdx + period) % 8}`,
            isFixed: false,
            periodsThisDay: periodsPerDay,
          });
          lessonCount++;
        }
      }
    }

    expect(lessons.length).toBe(700);

    // Create teacher constraint data
    const teachers = new Map<string, TeacherConstraintData>();
    for (let i = 0; i < 15; i++) {
      const availability: Record<DayOfWeek, boolean[]> = {
        [DayOfWeek.Saturday]: Array(8).fill(true),
        [DayOfWeek.Sunday]: Array(8).fill(true),
        [DayOfWeek.Monday]: Array(8).fill(true),
        [DayOfWeek.Tuesday]: Array(8).fill(true),
        [DayOfWeek.Wednesday]: Array(8).fill(true),
        [DayOfWeek.Thursday]: Array(8).fill(true),
        [DayOfWeek.Friday]: Array(8).fill(true),
      };
      teachers.set(`teacher-${i}`, {
        id: `teacher-${i}`,
        availability,
        timePreference: 'None',
        maxConsecutivePeriods: 4,
      });
    }

    const rooms = new Map<string, RoomConstraintData>();
    for (let i = 0; i < 8; i++) {
      rooms.set(`room-${i}`, {
        id: `room-${i}`,
        type: 'classroom',
      });
    }

    const subjects = new Map<string, SubjectConstraintData>();
    for (let i = 0; i < 10; i++) {
      subjects.set(`subject-${i}`, {
        id: `subject-${i}`,
        requiredRoomType: null,
        isDifficult: i < 3, // First 3 subjects are difficult
      });
    }

    const periodsPerDayMap: Record<string, number> = {
      [DayOfWeek.Saturday]: periodsPerDay,
      [DayOfWeek.Sunday]: periodsPerDay,
      [DayOfWeek.Monday]: periodsPerDay,
      [DayOfWeek.Tuesday]: periodsPerDay,
      [DayOfWeek.Wednesday]: periodsPerDay,
      [DayOfWeek.Thursday]: periodsPerDay,
    };

    // Select a lesson to test
    const selectedLesson = lessons[0];

    // Measure time for computing all valid targets
    const startTime = performance.now();

    const indexes = buildIndexes(lessons);

    // Create a set of slots that have lessons for quick lookup
    const lessonsBySlot = new Map<string, ScheduledLesson>();
    for (const lesson of lessons) {
      const slotKey = createSlotKey(lesson.day, lesson.periodIndex);
      lessonsBySlot.set(slotKey, lesson);
    }

    const results = new Map<string, SwapValidationResult>();

    // Iterate through all slots in the schedule
    for (const day of days) {
      for (let period = 0; period < periodsPerDay; period++) {
        const slotKey = createSlotKey(day, period);

        // Exclude selected lesson's own slot
        if (selectedLesson.day === day && selectedLesson.periodIndex === period) {
          continue;
        }

        // Get the lesson at this slot (if any)
        const targetLesson = lessonsBySlot.get(slotKey) ?? null;

        // Create swap operation
        const swap: SwapOperation = {
          lessonA: selectedLesson,
          lessonB: targetLesson,
          slotA: { day: selectedLesson.day, period: selectedLesson.periodIndex },
          slotB: { day, period },
        };

        // Validate the swap
        const result = validateSwap(swap, indexes, teachers, rooms, subjects);
        results.set(slotKey, result);
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Verify we computed all expected slots
    const expectedSlots = days.length * periodsPerDay - 1; // Minus own slot
    expect(results.size).toBe(expectedSlots);

    // Performance requirement: must complete in under 100ms
    expect(duration).toBeLessThan(100);

    // Log actual duration for visibility
    console.log(`Validation of ${lessons.length} lessons completed in ${duration.toFixed(2)}ms`);
  });

  it('validates a single swap in under 1ms (Requirement 17.1)', () => {
    // Create a simple scenario
    const lesson: ScheduledLesson = {
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

    const indexes = buildIndexes([lesson]);

    const teachers = new Map<string, TeacherConstraintData>();
    teachers.set('teacher-1', {
      id: 'teacher-1',
      availability: {
        [DayOfWeek.Saturday]: Array(8).fill(true),
        [DayOfWeek.Sunday]: Array(8).fill(true),
        [DayOfWeek.Monday]: Array(8).fill(true),
        [DayOfWeek.Tuesday]: Array(8).fill(true),
        [DayOfWeek.Wednesday]: Array(8).fill(true),
        [DayOfWeek.Thursday]: Array(8).fill(true),
        [DayOfWeek.Friday]: Array(8).fill(true),
      },
      timePreference: 'Morning',
      maxConsecutivePeriods: 4,
    });

    const rooms = new Map<string, RoomConstraintData>();
    rooms.set('room-1', { id: 'room-1', type: 'classroom' });

    const subjects = new Map<string, SubjectConstraintData>();
    subjects.set('subject-1', {
      id: 'subject-1',
      requiredRoomType: 'classroom',
      isDifficult: true,
    });

    const swap: SwapOperation = {
      lessonA: lesson,
      lessonB: null,
      slotA: { day: DayOfWeek.Saturday, period: 0 },
      slotB: { day: DayOfWeek.Saturday, period: 1 },
    };

    // Run multiple iterations to get average time
    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      validateSwap(swap, indexes, teachers, rooms, subjects);
    }

    const endTime = performance.now();
    const avgDuration = (endTime - startTime) / iterations;

    // Performance requirement: single swap validation must complete in under 1ms
    expect(avgDuration).toBeLessThan(1);

    // Log actual duration for visibility
    console.log(`Single swap validation average: ${avgDuration.toFixed(4)}ms`);
  });
});
