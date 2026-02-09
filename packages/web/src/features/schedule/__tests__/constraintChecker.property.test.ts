/**
 * Property-based tests for constraint checker
 * **Feature: schedule-phase7**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { SWAP_CONSTRAINT_TYPES } from '../constants';
import type {
  RoomConstraintData,
  ScheduledLesson,
  SubjectConstraintData,
  TeacherConstraintData,
} from '../types';
import { DayOfWeek } from '../types';
import {
  checkClassConflict,
  checkConsecutivePeriods,
  checkDifficultAfternoon,
  checkRoomConflict,
  checkRoomTypeMismatch,
  checkTeacherAvailability,
  checkTeacherConflict,
  checkTeacherPreference,
} from '../utils/constraintChecker';
import { buildIndexes } from '../utils/indexBuilder';

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

// Generator for target slot
const targetSlotArb = fc.record({
  day: dayOfWeekArb,
  period: periodArb,
});

// Generator for teacher constraint data with specific availability
const teacherConstraintDataArb = (
  teacherId: string,
  availability: Record<DayOfWeek, boolean[]>
): TeacherConstraintData => ({
  id: teacherId,
  availability,
  timePreference: 'None',
  maxConsecutivePeriods: 4,
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

// Generator for room constraint data
const roomConstraintDataArb: fc.Arbitrary<RoomConstraintData> = fc.record({
  id: idArb,
  type: fc.constantFrom(
    'normal',
    'computer_lab',
    'biology_lab',
    'chemistry_lab',
    'math_lab',
    'physics_lab',
    'lab',
    'library',
    'salon',
    'gym',
    'sport_camp',
    'other'
  ),
});

// Generator for subject constraint data
const subjectConstraintDataArb: fc.Arbitrary<SubjectConstraintData> = fc.record({
  id: idArb,
  requiredRoomType: fc.option(
    fc.constantFrom(
      'normal',
      'computer_lab',
      'biology_lab',
      'chemistry_lab',
      'math_lab',
      'physics_lab',
      'lab',
      'library',
      'salon',
      'gym',
      'sport_camp',
      'other'
    ),
    { nil: null }
  ),
  isDifficult: fc.boolean(),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Constraint Checker Property Tests', () => {
  /**
   * **Feature: schedule-phase7, Property 3: Teacher Availability Check**
   * **Validates: Requirements 3.2**
   *
   * For any swap operation where the teacher's availability array shows false
   * for the target day and period, the validation must return a TEACHER_UNAVAILABLE violation.
   */
  describe('Property 3: Teacher Availability Check', () => {
    it('returns TEACHER_UNAVAILABLE when teacher is unavailable at target slot', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          targetSlotArb,
          fullAvailabilityArb,
          (lesson, targetSlot, baseAvailability) => {
            // Ensure the lesson has at least one teacher
            if (lesson.teacherIds.length === 0) return;

            const teacherId = lesson.teacherIds[0];

            // Create availability where target slot is explicitly unavailable
            const availability = { ...baseAvailability };
            availability[targetSlot.day] = [...availability[targetSlot.day]];
            availability[targetSlot.day][targetSlot.period] = false;

            const teachers = new Map<string, TeacherConstraintData>();
            teachers.set(teacherId, teacherConstraintDataArb(teacherId, availability));

            const result = checkTeacherAvailability(lesson, targetSlot, teachers);

            // Should return a violation
            expect(result).not.toBeNull();
            expect(result?.type).toBe('TEACHER_UNAVAILABLE');
            expect(result?.severity).toBe('hard');
            expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.TEACHER_UNAVAILABLE.messageFa);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns null when teacher is available at target slot', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          targetSlotArb,
          fullAvailabilityArb,
          (lesson, targetSlot, baseAvailability) => {
            // Ensure the lesson has at least one teacher
            if (lesson.teacherIds.length === 0) return;

            // Create availability where ALL teachers are available at target slot
            const teachers = new Map<string, TeacherConstraintData>();
            for (const teacherId of lesson.teacherIds) {
              const availability = { ...baseAvailability };
              availability[targetSlot.day] = [...availability[targetSlot.day]];
              availability[targetSlot.day][targetSlot.period] = true;
              teachers.set(teacherId, teacherConstraintDataArb(teacherId, availability));
            }

            const result = checkTeacherAvailability(lesson, targetSlot, teachers);

            // Should return null (no violation)
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('checks ALL teachers for multi-teacher lessons', () => {
      fc.assert(
        fc.property(
          fc
            .record({
              day: dayOfWeekArb,
              periodIndex: periodArb,
              classId: idArb,
              className: fc.option(fc.string(), { nil: null }),
              subjectId: idArb,
              subjectName: fc.option(fc.string(), { nil: null }),
              // Ensure at least 2 teachers
              teacherIds: fc.array(idArb, { minLength: 2, maxLength: 4 }),
              teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
              roomId: fc.option(idArb, { nil: null }),
              roomName: fc.option(fc.string(), { nil: null }),
              isFixed: fc.boolean(),
              periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
            })
            .filter((l) => new Set(l.teacherIds).size === l.teacherIds.length), // Unique teacher IDs
          targetSlotArb,
          fullAvailabilityArb,
          (lesson, targetSlot, baseAvailability) => {
            const teachers = new Map<string, TeacherConstraintData>();

            // First teacher is available
            const firstAvailability = { ...baseAvailability };
            firstAvailability[targetSlot.day] = [...firstAvailability[targetSlot.day]];
            firstAvailability[targetSlot.day][targetSlot.period] = true;
            teachers.set(
              lesson.teacherIds[0],
              teacherConstraintDataArb(lesson.teacherIds[0], firstAvailability)
            );

            // Second teacher is unavailable
            const secondAvailability = { ...baseAvailability };
            secondAvailability[targetSlot.day] = [...secondAvailability[targetSlot.day]];
            secondAvailability[targetSlot.day][targetSlot.period] = false;
            teachers.set(
              lesson.teacherIds[1],
              teacherConstraintDataArb(lesson.teacherIds[1], secondAvailability)
            );

            const result = checkTeacherAvailability(lesson, targetSlot, teachers);

            // Should return a violation because second teacher is unavailable
            expect(result).not.toBeNull();
            expect(result?.type).toBe('TEACHER_UNAVAILABLE');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase7, Property 4: Teacher Conflict Detection**
   * **Validates: Requirements 4.2**
   *
   * For any swap operation where a teacher is already scheduled at the target slot
   * (excluding the swap partner), the validation must return a TEACHER_CONFLICT violation.
   */
  describe('Property 4: Teacher Conflict Detection', () => {
    it('returns TEACHER_CONFLICT when teacher has another lesson at target slot', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          scheduledLessonArb,
          targetSlotArb,
          (lessonToMove, conflictingLesson, targetSlot) => {
            // Ensure lessons share at least one teacher
            if (lessonToMove.teacherIds.length === 0) return;

            const sharedTeacherId = lessonToMove.teacherIds[0];

            // Create conflicting lesson at target slot with same teacher
            const conflicting: ScheduledLesson = {
              ...conflictingLesson,
              day: targetSlot.day,
              periodIndex: targetSlot.period,
              teacherIds: [sharedTeacherId],
              // Ensure different class to avoid being same lesson
              classId:
                conflictingLesson.classId === lessonToMove.classId
                  ? `${conflictingLesson.classId}-other`
                  : conflictingLesson.classId,
            };

            // Build indexes with the conflicting lesson
            const indexes = buildIndexes([conflicting]);

            const result = checkTeacherConflict(lessonToMove, targetSlot, indexes);

            // Should return a violation
            expect(result).not.toBeNull();
            expect(result?.type).toBe('TEACHER_CONFLICT');
            expect(result?.severity).toBe('hard');
            expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.TEACHER_CONFLICT.messageFa);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns null when no teacher conflict exists', () => {
      fc.assert(
        fc.property(scheduledLessonArb, targetSlotArb, (lesson, targetSlot) => {
          // Empty indexes - no conflicts possible
          const indexes = buildIndexes([]);

          const result = checkTeacherConflict(lesson, targetSlot, indexes);

          // Should return null (no violation)
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('excludes swap partner from conflict check', () => {
      fc.assert(
        fc.property(scheduledLessonArb, targetSlotArb, (lesson, targetSlot) => {
          // Create a "swap partner" at the target slot
          const swapPartner: ScheduledLesson = {
            ...lesson,
            day: targetSlot.day,
            periodIndex: targetSlot.period,
            classId: 'swap-partner-class',
          };

          const indexes = buildIndexes([swapPartner]);
          const excludeId = `${swapPartner.classId}-${swapPartner.day}-${swapPartner.periodIndex}`;

          const result = checkTeacherConflict(lesson, targetSlot, indexes, excludeId);

          // Should return null because swap partner is excluded
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase7, Property 5: Room Conflict Detection**
   * **Validates: Requirements 5.2**
   *
   * For any swap operation where the room is already occupied at the target slot
   * (excluding the swap partner), the validation must return a ROOM_CONFLICT violation.
   */
  describe('Property 5: Room Conflict Detection', () => {
    it('returns ROOM_CONFLICT when room is occupied at target slot', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb.filter((l) => l.roomId !== null),
          scheduledLessonArb,
          targetSlotArb,
          (lessonToMove, conflictingLesson, targetSlot) => {
            // Create conflicting lesson at target slot with same room
            const conflicting: ScheduledLesson = {
              ...conflictingLesson,
              day: targetSlot.day,
              periodIndex: targetSlot.period,
              roomId: lessonToMove.roomId,
              // Ensure different class
              classId:
                conflictingLesson.classId === lessonToMove.classId
                  ? `${conflictingLesson.classId}-other`
                  : conflictingLesson.classId,
            };

            const indexes = buildIndexes([conflicting]);

            const result = checkRoomConflict(lessonToMove, targetSlot, indexes);

            // Should return a violation
            expect(result).not.toBeNull();
            expect(result?.type).toBe('ROOM_CONFLICT');
            expect(result?.severity).toBe('hard');
            expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.ROOM_CONFLICT.messageFa);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns null when lesson has no room assignment', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb.map((l) => ({ ...l, roomId: null })),
          targetSlotArb,
          (lesson, targetSlot) => {
            // Even with conflicts in indexes, should skip check
            const indexes = buildIndexes([]);

            const result = checkRoomConflict(lesson, targetSlot, indexes);

            // Should return null (no violation)
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('excludes swap partner from conflict check', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb.filter((l) => l.roomId !== null),
          targetSlotArb,
          (lesson, targetSlot) => {
            // Create a "swap partner" at the target slot with same room
            const swapPartner: ScheduledLesson = {
              ...lesson,
              day: targetSlot.day,
              periodIndex: targetSlot.period,
              classId: 'swap-partner-class',
            };

            const indexes = buildIndexes([swapPartner]);
            const excludeId = `${swapPartner.classId}-${swapPartner.day}-${swapPartner.periodIndex}`;

            const result = checkRoomConflict(lesson, targetSlot, indexes, excludeId);

            // Should return null because swap partner is excluded
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase7, Property 7: Class Conflict Detection**
   * **Validates: Requirements 7.2**
   *
   * For any swap operation where the class already has a lesson at the target slot
   * (excluding the swap partner), the validation must return a CLASS_CONFLICT violation.
   */
  describe('Property 7: Class Conflict Detection', () => {
    it('returns CLASS_CONFLICT when class has another lesson at target slot', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          scheduledLessonArb,
          targetSlotArb,
          (lessonToMove, conflictingLesson, targetSlot) => {
            // Create conflicting lesson at target slot with same class but different subject
            const conflicting: ScheduledLesson = {
              ...conflictingLesson,
              day: targetSlot.day,
              periodIndex: targetSlot.period,
              classId: lessonToMove.classId,
              // Ensure different subject to make it a different lesson
              subjectId:
                conflictingLesson.subjectId === lessonToMove.subjectId
                  ? `${conflictingLesson.subjectId}-other`
                  : conflictingLesson.subjectId,
            };

            // Ensure the lesson being moved is at a different slot
            const movedLesson: ScheduledLesson = {
              ...lessonToMove,
              day:
                lessonToMove.day === targetSlot.day &&
                lessonToMove.periodIndex === targetSlot.period
                  ? DayOfWeek.Friday
                  : lessonToMove.day,
              periodIndex:
                lessonToMove.day === targetSlot.day &&
                lessonToMove.periodIndex === targetSlot.period
                  ? (targetSlot.period + 1) % 8
                  : lessonToMove.periodIndex,
            };

            const indexes = buildIndexes([conflicting]);

            const result = checkClassConflict(movedLesson, targetSlot, indexes);

            // Should return a violation
            expect(result).not.toBeNull();
            expect(result?.type).toBe('CLASS_CONFLICT');
            expect(result?.severity).toBe('hard');
            expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.CLASS_CONFLICT.messageFa);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns null when no class conflict exists', () => {
      fc.assert(
        fc.property(scheduledLessonArb, targetSlotArb, (lesson, targetSlot) => {
          // Empty indexes - no conflicts possible
          const indexes = buildIndexes([]);

          const result = checkClassConflict(lesson, targetSlot, indexes);

          // Should return null (no violation)
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('excludes swap partner from conflict check', () => {
      fc.assert(
        fc.property(scheduledLessonArb, targetSlotArb, (lesson, targetSlot) => {
          // Create a "swap partner" at the target slot with same class
          const swapPartner: ScheduledLesson = {
            ...lesson,
            day: targetSlot.day,
            periodIndex: targetSlot.period,
          };

          const indexes = buildIndexes([swapPartner]);
          const excludeId = `${swapPartner.classId}-${swapPartner.day}-${swapPartner.periodIndex}`;

          const result = checkClassConflict(lesson, targetSlot, indexes, excludeId);

          // Should return null because swap partner is excluded
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: schedule-phase7, Property 6: Room Type Validation**
   * **Validates: Requirements 6.2**
   *
   * For any swap operation where the subject requires a specific room type
   * and the target room doesn't match, the validation must return a ROOM_TYPE_MISMATCH violation.
   */
  describe('Property 6: Room Type Validation', () => {
    it('returns ROOM_TYPE_MISMATCH when room type does not match requirement', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          fc.constantFrom(
            'normal',
            'computer_lab',
            'biology_lab',
            'chemistry_lab',
            'math_lab',
            'physics_lab',
            'lab',
            'library',
            'salon',
            'gym',
            'sport_camp',
            'other'
          ),
          fc.constantFrom(
            'normal',
            'computer_lab',
            'biology_lab',
            'chemistry_lab',
            'math_lab',
            'physics_lab',
            'lab',
            'library',
            'salon',
            'gym',
            'sport_camp',
            'other'
          ),
          (lesson, requiredType, actualType) => {
            // Skip if types match
            if (requiredType === actualType) return;

            const subjects = new Map<string, SubjectConstraintData>();
            subjects.set(lesson.subjectId, {
              id: lesson.subjectId,
              requiredRoomType: requiredType,
              isDifficult: false,
            });

            const targetRoom: RoomConstraintData = {
              id: 'target-room',
              type: actualType,
            };

            const result = checkRoomTypeMismatch(lesson, targetRoom, subjects);

            // Should return a violation
            expect(result).not.toBeNull();
            expect(result?.type).toBe('ROOM_TYPE_MISMATCH');
            expect(result?.severity).toBe('hard');
            expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.ROOM_TYPE_MISMATCH.messageFa);
            expect(result?.details.requiredRoomType).toBe(requiredType);
            expect(result?.details.actualRoomType).toBe(actualType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns null when room type matches requirement', () => {
      fc.assert(
        fc.property(
          scheduledLessonArb,
          fc.constantFrom(
            'normal',
            'computer_lab',
            'biology_lab',
            'chemistry_lab',
            'math_lab',
            'physics_lab',
            'lab',
            'library',
            'salon',
            'gym',
            'sport_camp',
            'other'
          ),
          (lesson, roomType) => {
            const subjects = new Map<string, SubjectConstraintData>();
            subjects.set(lesson.subjectId, {
              id: lesson.subjectId,
              requiredRoomType: roomType,
              isDifficult: false,
            });

            const targetRoom: RoomConstraintData = {
              id: 'target-room',
              type: roomType, // Same type
            };

            const result = checkRoomTypeMismatch(lesson, targetRoom, subjects);

            // Should return null (no violation)
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns null when subject has no room type requirement', () => {
      fc.assert(
        fc.property(scheduledLessonArb, roomConstraintDataArb, (lesson, targetRoom) => {
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: null, // No requirement
            isDifficult: false,
          });

          const result = checkRoomTypeMismatch(lesson, targetRoom, subjects);

          // Should return null (no violation)
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('returns null when target room is null', () => {
      fc.assert(
        fc.property(scheduledLessonArb, (lesson) => {
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: 'lab',
            isDifficult: false,
          });

          const result = checkRoomTypeMismatch(lesson, null, subjects);

          // Should return null (can't check type without room)
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * **Feature: schedule-phase7, Property 8: Teacher Preference Violation**
 * **Validates: Requirements 8.2, 8.3**
 *
 * For any swap operation where a teacher has a Morning preference and the target
 * slot is in the afternoon (period >= 4), or has an Afternoon preference and the
 * target slot is in the morning (period < 4), the validation must return a
 * TEACHER_PREFERENCE warning.
 */
describe('Property 8: Teacher Preference Violation', () => {
  // Generator for time preference
  const timePreferenceArb = fc.constantFrom('Morning', 'Afternoon', 'None') as fc.Arbitrary<
    'Morning' | 'Afternoon' | 'None'
  >;

  // Generator for morning period (0-3)
  const morningPeriodArb = fc.integer({ min: 0, max: 3 });

  // Generator for afternoon period (4-7)
  const afternoonPeriodArb = fc.integer({ min: 4, max: 7 });

  it('returns TEACHER_PREFERENCE warning when Morning preference teacher is moved to afternoon', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        afternoonPeriodArb,
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          // Ensure the lesson has at least one teacher
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'Morning',
            maxConsecutivePeriods: 4,
          });

          const result = checkTeacherPreference(lesson, targetSlot, teachers);

          // Should return a warning
          expect(result).not.toBeNull();
          expect(result?.type).toBe('TEACHER_PREFERENCE');
          expect(result?.severity).toBe('soft');
          expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.TEACHER_PREFERENCE.messageFa);
          expect(result?.details.teacherPreference).toBe('Morning');
          expect(result?.details.targetTimeOfDay).toBe('Afternoon');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns TEACHER_PREFERENCE warning when Afternoon preference teacher is moved to morning', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        morningPeriodArb,
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          // Ensure the lesson has at least one teacher
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'Afternoon',
            maxConsecutivePeriods: 4,
          });

          const result = checkTeacherPreference(lesson, targetSlot, teachers);

          // Should return a warning
          expect(result).not.toBeNull();
          expect(result?.type).toBe('TEACHER_PREFERENCE');
          expect(result?.severity).toBe('soft');
          expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.TEACHER_PREFERENCE.messageFa);
          expect(result?.details.teacherPreference).toBe('Afternoon');
          expect(result?.details.targetTimeOfDay).toBe('Morning');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when Morning preference teacher is moved to morning slot', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        morningPeriodArb,
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          // Ensure the lesson has at least one teacher
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'Morning',
            maxConsecutivePeriods: 4,
          });

          const result = checkTeacherPreference(lesson, targetSlot, teachers);

          // Should return null (no violation)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when Afternoon preference teacher is moved to afternoon slot', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        afternoonPeriodArb,
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          // Ensure the lesson has at least one teacher
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'Afternoon',
            maxConsecutivePeriods: 4,
          });

          const result = checkTeacherPreference(lesson, targetSlot, teachers);

          // Should return null (no violation)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when teacher has no preference (None)', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          // Ensure the lesson has at least one teacher
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'None',
            maxConsecutivePeriods: 4,
          });

          const result = checkTeacherPreference(lesson, targetSlot, teachers);

          // Should return null (no violation)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when teacher has no preference set (undefined)', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          // Ensure the lesson has at least one teacher
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            // timePreference is undefined
            maxConsecutivePeriods: 4,
          });

          const result = checkTeacherPreference(lesson, targetSlot, teachers);

          // Should return null (no violation)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: schedule-phase7, Property 9: Consecutive Periods Warning**
 * **Validates: Requirements 9.2**
 *
 * For any swap operation where the resulting consecutive periods for a teacher
 * would exceed their maxConsecutivePeriods, the validation must return a
 * CONSECUTIVE_EXCEEDED warning.
 */
describe('Property 9: Consecutive Periods Warning', () => {
  it('returns CONSECUTIVE_EXCEEDED warning when swap would exceed max consecutive periods', () => {
    fc.assert(
      fc.property(
        // Use a day that's not Friday for existing lessons
        fc.constantFrom(
          DayOfWeek.Saturday,
          DayOfWeek.Sunday,
          DayOfWeek.Monday,
          DayOfWeek.Tuesday,
          DayOfWeek.Wednesday,
          DayOfWeek.Thursday
        ),
        fc.integer({ min: 2, max: 4 }), // maxConsecutive
        fullAvailabilityArb,
        (day, maxConsecutive, baseAvailability) => {
          const teacherId = 'teacher-1';
          const classId = 'class-1';

          // Create existing lessons that form a consecutive sequence
          // e.g., if maxConsecutive is 3, create lessons at periods 0, 1, 2
          const existingLessons: ScheduledLesson[] = [];
          for (let i = 0; i < maxConsecutive; i++) {
            existingLessons.push({
              day,
              periodIndex: i,
              classId: `${classId}-${i}`,
              className: null,
              subjectId: 'subject-1',
              subjectName: null,
              teacherIds: [teacherId],
              teacherNames: null,
              roomId: null,
              roomName: null,
              isFixed: false,
              periodsThisDay: null,
            });
          }

          // The lesson we want to move - currently at a different day (Friday)
          // This ensures it's always different from the target day
          const lessonToMove: ScheduledLesson = {
            day: DayOfWeek.Friday, // Always Friday, which is different from the target day
            periodIndex: 0,
            classId: 'moving-class',
            className: null,
            subjectId: 'subject-2',
            subjectName: null,
            teacherIds: [teacherId],
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          };

          // Target slot is adjacent to the existing sequence (would make it exceed)
          const targetSlot = { day, period: maxConsecutive };

          const indexes = buildIndexes(existingLessons);

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'None',
            maxConsecutivePeriods: maxConsecutive,
          });

          const result = checkConsecutivePeriods(lessonToMove, targetSlot, indexes, teachers);

          // Should return a warning because adding period at maxConsecutive
          // would create maxConsecutive + 1 consecutive periods
          expect(result).not.toBeNull();
          expect(result?.type).toBe('CONSECUTIVE_EXCEEDED');
          expect(result?.severity).toBe('soft');
          expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.CONSECUTIVE_EXCEEDED.messageFa);
          expect(result?.details.currentConsecutive).toBe(maxConsecutive + 1);
          expect(result?.details.maxAllowed).toBe(maxConsecutive);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when swap does not exceed max consecutive periods', () => {
    fc.assert(
      fc.property(
        dayOfWeekArb,
        fc.integer({ min: 3, max: 6 }), // maxConsecutive
        fullAvailabilityArb,
        (day, maxConsecutive, baseAvailability) => {
          const teacherId = 'teacher-1';

          // Create existing lessons with a gap (not consecutive)
          // e.g., periods 0, 2 (gap at 1)
          const existingLessons: ScheduledLesson[] = [
            {
              day,
              periodIndex: 0,
              classId: 'class-0',
              className: null,
              subjectId: 'subject-1',
              subjectName: null,
              teacherIds: [teacherId],
              teacherNames: null,
              roomId: null,
              roomName: null,
              isFixed: false,
              periodsThisDay: null,
            },
            {
              day,
              periodIndex: 2,
              classId: 'class-2',
              className: null,
              subjectId: 'subject-1',
              subjectName: null,
              teacherIds: [teacherId],
              teacherNames: null,
              roomId: null,
              roomName: null,
              isFixed: false,
              periodsThisDay: null,
            },
          ];

          // The lesson we want to move
          const lessonToMove: ScheduledLesson = {
            day: DayOfWeek.Friday,
            periodIndex: 0,
            classId: 'moving-class',
            className: null,
            subjectId: 'subject-2',
            subjectName: null,
            teacherIds: [teacherId],
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          };

          // Target slot fills the gap - creates sequence 0, 1, 2 (3 consecutive)
          const targetSlot = { day, period: 1 };

          const indexes = buildIndexes(existingLessons);

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'None',
            maxConsecutivePeriods: maxConsecutive, // >= 3, so 3 consecutive is OK
          });

          const result = checkConsecutivePeriods(lessonToMove, targetSlot, indexes, teachers);

          // Should return null because 3 consecutive <= maxConsecutive
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns null when teacher has no maxConsecutivePeriods limit', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const indexes = buildIndexes([]);

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability: baseAvailability,
            timePreference: 'None',
            // maxConsecutivePeriods is undefined
          });

          const result = checkConsecutivePeriods(lesson, targetSlot, indexes, teachers);

          // Should return null (no limit set)
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correctly handles moving within the same day', () => {
    fc.assert(
      fc.property(dayOfWeekArb, fullAvailabilityArb, (day, baseAvailability) => {
        const teacherId = 'teacher-1';

        // Create lessons at periods 0, 1, 2 (3 consecutive)
        const existingLessons: ScheduledLesson[] = [
          {
            day,
            periodIndex: 0,
            classId: 'class-0',
            className: null,
            subjectId: 'subject-1',
            subjectName: null,
            teacherIds: [teacherId],
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          },
          {
            day,
            periodIndex: 1,
            classId: 'class-1',
            className: null,
            subjectId: 'subject-1',
            subjectName: null,
            teacherIds: [teacherId],
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          },
          {
            day,
            periodIndex: 2,
            classId: 'class-2',
            className: null,
            subjectId: 'subject-1',
            subjectName: null,
            teacherIds: [teacherId],
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          },
        ];

        // Move the lesson at period 0 to period 5 (same day)
        // This should reduce consecutive from 3 to 2 (periods 1, 2)
        const lessonToMove = existingLessons[0];
        const targetSlot = { day, period: 5 };

        const indexes = buildIndexes(existingLessons);

        const teachers = new Map<string, TeacherConstraintData>();
        teachers.set(teacherId, {
          id: teacherId,
          availability: baseAvailability,
          timePreference: 'None',
          maxConsecutivePeriods: 2, // Max 2 consecutive
        });

        const result = checkConsecutivePeriods(lessonToMove, targetSlot, indexes, teachers);

        // Should return null because moving period 0 to 5 leaves periods 1, 2
        // which is exactly 2 consecutive (not exceeding max of 2)
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: schedule-phase7, Property 10: Difficult Subject Afternoon Warning**
 * **Validates: Requirements 10.1**
 *
 * For any swap operation where a difficult subject is moved to an afternoon slot
 * (period >= 4), the validation must return a DIFFICULT_AFTERNOON warning.
 */
describe('Property 10: Difficult Subject Afternoon Warning', () => {
  // Generator for afternoon period (4-7)
  const afternoonPeriodArb = fc.integer({ min: 4, max: 7 });

  // Generator for morning period (0-3)
  const morningPeriodArb = fc.integer({ min: 0, max: 3 });

  it('returns DIFFICULT_AFTERNOON warning when difficult subject is moved to afternoon', () => {
    fc.assert(
      fc.property(scheduledLessonArb, dayOfWeekArb, afternoonPeriodArb, (lesson, day, period) => {
        const targetSlot = { day, period };

        const subjects = new Map<string, SubjectConstraintData>();
        subjects.set(lesson.subjectId, {
          id: lesson.subjectId,
          requiredRoomType: null,
          isDifficult: true, // Mark as difficult
        });

        const result = checkDifficultAfternoon(lesson, targetSlot, subjects);

        // Should return a warning
        expect(result).not.toBeNull();
        expect(result?.type).toBe('DIFFICULT_AFTERNOON');
        expect(result?.severity).toBe('soft');
        expect(result?.message).toBe(SWAP_CONSTRAINT_TYPES.DIFFICULT_AFTERNOON.messageFa);
        expect(result?.details.subjectName).toBe(lesson.subjectName ?? lesson.subjectId);
      }),
      { numRuns: 100 }
    );
  });

  it('returns null when difficult subject is moved to morning slot', () => {
    fc.assert(
      fc.property(scheduledLessonArb, dayOfWeekArb, morningPeriodArb, (lesson, day, period) => {
        const targetSlot = { day, period };

        const subjects = new Map<string, SubjectConstraintData>();
        subjects.set(lesson.subjectId, {
          id: lesson.subjectId,
          requiredRoomType: null,
          isDifficult: true, // Mark as difficult
        });

        const result = checkDifficultAfternoon(lesson, targetSlot, subjects);

        // Should return null (morning is OK for difficult subjects)
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('returns null when non-difficult subject is moved to afternoon', () => {
    fc.assert(
      fc.property(scheduledLessonArb, dayOfWeekArb, afternoonPeriodArb, (lesson, day, period) => {
        const targetSlot = { day, period };

        const subjects = new Map<string, SubjectConstraintData>();
        subjects.set(lesson.subjectId, {
          id: lesson.subjectId,
          requiredRoomType: null,
          isDifficult: false, // Not difficult
        });

        const result = checkDifficultAfternoon(lesson, targetSlot, subjects);

        // Should return null (non-difficult subjects can be in afternoon)
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('returns null when subject has no isDifficult flag set', () => {
    fc.assert(
      fc.property(scheduledLessonArb, dayOfWeekArb, afternoonPeriodArb, (lesson, day, period) => {
        const targetSlot = { day, period };

        const subjects = new Map<string, SubjectConstraintData>();
        subjects.set(lesson.subjectId, {
          id: lesson.subjectId,
          requiredRoomType: null,
          // isDifficult is undefined
        });

        const result = checkDifficultAfternoon(lesson, targetSlot, subjects);

        // Should return null (no difficulty flag means not difficult)
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('returns null when subject data is not found', () => {
    fc.assert(
      fc.property(scheduledLessonArb, targetSlotArb, (lesson, targetSlot) => {
        // Empty subjects map - no subject data
        const subjects = new Map<string, SubjectConstraintData>();

        const result = checkDifficultAfternoon(lesson, targetSlot, subjects);

        // Should return null (no subject data to check)
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// validateSwap Property Tests
// ============================================================================

import type { SwapOperation } from '../types';
import { validateSwap } from '../utils/constraintChecker';

// Generator for SwapOperation
const swapOperationArb = (
  lessonA: ScheduledLesson,
  lessonB: ScheduledLesson | null,
  slotA: { day: DayOfWeek; period: number },
  slotB: { day: DayOfWeek; period: number }
): SwapOperation => ({
  lessonA,
  lessonB,
  slotA,
  slotB,
});

/**
 * **Feature: schedule-phase7, Property 1: Validation Result Correctness**
 * **Validates: Requirements 2.3, 2.4, 2.5**
 *
 * For any swap operation, the validation result flags must correctly reflect
 * the presence of violations:
 * - If any hard constraint is violated, isValid must be false
 * - If only soft constraints are violated, isValid must be true and canProceedWithWarning must be true
 * - If no constraints are violated, isValid must be true and canProceedWithWarning must be false
 */
describe('Property 1: Validation Result Correctness', () => {
  it('sets isValid to false when hard constraints are violated', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];

          // Create availability where target slot is unavailable (hard constraint violation)
          const availability = { ...baseAvailability };
          availability[targetSlot.day] = [...availability[targetSlot.day]];
          availability[targetSlot.day][targetSlot.period] = false;

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability,
            timePreference: 'None',
            maxConsecutivePeriods: 4,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // isValid must be false when hard constraint is violated (Requirement 2.3)
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some((e) => e.severity === 'hard')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sets isValid to true and canProceedWithWarning to true when only soft constraints are violated', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        fc.integer({ min: 4, max: 7 }), // afternoon period
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          // Create availability where teacher IS available (no hard constraint)
          const availability = { ...baseAvailability };
          availability[targetSlot.day] = [...availability[targetSlot.day]];
          availability[targetSlot.day][targetSlot.period] = true;

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability,
            timePreference: 'Morning', // Morning preference + afternoon slot = soft violation
            maxConsecutivePeriods: 10, // High limit to avoid consecutive violation
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: null,
            isDifficult: false,
          });

          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // isValid must be true when only soft constraints violated (Requirement 2.4)
          expect(result.isValid).toBe(true);
          // canProceedWithWarning must be true when there are warnings
          expect(result.canProceedWithWarning).toBe(true);
          expect(result.warnings.length).toBeGreaterThan(0);
          expect(result.errors.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sets isValid to true and canProceedWithWarning to false when no constraints are violated', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        fc.integer({ min: 0, max: 3 }), // morning period
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          // Create availability where teacher IS available
          const availability = { ...baseAvailability };
          availability[targetSlot.day] = [...availability[targetSlot.day]];
          availability[targetSlot.day][targetSlot.period] = true;

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability,
            timePreference: 'Morning', // Morning preference + morning slot = no violation
            maxConsecutivePeriods: 10,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: null,
            isDifficult: false,
          });

          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // isValid must be true when no constraints violated (Requirement 2.5)
          expect(result.isValid).toBe(true);
          // canProceedWithWarning must be false when no warnings
          expect(result.canProceedWithWarning).toBe(false);
          expect(result.warnings.length).toBe(0);
          expect(result.errors.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: schedule-phase7, Property 2: Violation Categorization**
 * **Validates: Requirements 2.6, 2.7**
 *
 * For any swap operation, all hard constraint violations must appear in the
 * errors array and all soft constraint violations must appear in the warnings array.
 */
describe('Property 2: Violation Categorization', () => {
  it('places hard constraint violations in errors array', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];

          // Create unavailability (hard constraint)
          const availability = { ...baseAvailability };
          availability[targetSlot.day] = [...availability[targetSlot.day]];
          availability[targetSlot.day][targetSlot.period] = false;

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability,
            timePreference: 'None',
            maxConsecutivePeriods: 10,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // All errors must have severity 'hard' (Requirement 2.6)
          expect(result.errors.every((e) => e.severity === 'hard')).toBe(true);
          // Warnings array should not contain hard violations
          expect(result.warnings.every((w) => w.severity === 'soft')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('places soft constraint violations in warnings array', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        fc.integer({ min: 4, max: 7 }), // afternoon period
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          // Create availability where teacher IS available
          const availability = { ...baseAvailability };
          availability[targetSlot.day] = [...availability[targetSlot.day]];
          availability[targetSlot.day][targetSlot.period] = true;

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability,
            timePreference: 'Morning', // Soft constraint violation
            maxConsecutivePeriods: 10,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: null,
            isDifficult: true, // Another soft constraint violation
          });

          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // All warnings must have severity 'soft' (Requirement 2.7)
          expect(result.warnings.every((w) => w.severity === 'soft')).toBe(true);
          // Errors array should not contain soft violations
          expect(result.errors.every((e) => e.severity === 'hard')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('correctly separates mixed hard and soft violations', () => {
    fc.assert(
      fc.property(
        scheduledLessonArb,
        dayOfWeekArb,
        fc.integer({ min: 4, max: 7 }), // afternoon period
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          if (lesson.teacherIds.length === 0) return;

          const teacherId = lesson.teacherIds[0];
          const targetSlot = { day, period };

          // Create unavailability (hard constraint) + morning preference (soft constraint)
          const availability = { ...baseAvailability };
          availability[targetSlot.day] = [...availability[targetSlot.day]];
          availability[targetSlot.day][targetSlot.period] = false; // Hard violation

          const teachers = new Map<string, TeacherConstraintData>();
          teachers.set(teacherId, {
            id: teacherId,
            availability,
            timePreference: 'Morning', // Soft violation (afternoon slot)
            maxConsecutivePeriods: 10,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: null,
            isDifficult: true, // Another soft violation
          });

          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // Should have both errors and warnings
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.warnings.length).toBeGreaterThan(0);

          // All errors must be hard, all warnings must be soft
          expect(result.errors.every((e) => e.severity === 'hard')).toBe(true);
          expect(result.warnings.every((w) => w.severity === 'soft')).toBe(true);

          // isValid should be false due to hard constraint
          expect(result.isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: schedule-phase7, Property 16: Multi-Teacher Validation**
 * **Validates: Requirements 3.4, 18.1, 18.2, 18.3**
 *
 * For any lesson with multiple teachers, all teachers must be checked for
 * availability and conflicts, and if ANY teacher has a violation, the result
 * must reflect it.
 */
describe('Property 16: Multi-Teacher Validation', () => {
  it('checks availability for ALL teachers in multi-teacher lessons', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            day: dayOfWeekArb,
            periodIndex: periodArb,
            classId: idArb,
            className: fc.option(fc.string(), { nil: null }),
            subjectId: idArb,
            subjectName: fc.option(fc.string(), { nil: null }),
            teacherIds: fc.array(idArb, { minLength: 2, maxLength: 4 }),
            teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
            roomId: fc.option(idArb, { nil: null }),
            roomName: fc.option(fc.string(), { nil: null }),
            isFixed: fc.boolean(),
            periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
          })
          .filter((l) => new Set(l.teacherIds).size === l.teacherIds.length),
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          const teachers = new Map<string, TeacherConstraintData>();

          // First teacher is available
          const firstAvailability = { ...baseAvailability };
          firstAvailability[targetSlot.day] = [...firstAvailability[targetSlot.day]];
          firstAvailability[targetSlot.day][targetSlot.period] = true;
          teachers.set(lesson.teacherIds[0], {
            id: lesson.teacherIds[0],
            availability: firstAvailability,
            timePreference: 'None',
            maxConsecutivePeriods: 10,
          });

          // Second teacher is unavailable (hard constraint)
          const secondAvailability = { ...baseAvailability };
          secondAvailability[targetSlot.day] = [...secondAvailability[targetSlot.day]];
          secondAvailability[targetSlot.day][targetSlot.period] = false;
          teachers.set(lesson.teacherIds[1], {
            id: lesson.teacherIds[1],
            availability: secondAvailability,
            timePreference: 'None',
            maxConsecutivePeriods: 10,
          });

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // Should be invalid because second teacher is unavailable (Requirement 18.3)
          expect(result.isValid).toBe(false);
          expect(result.errors.some((e) => e.type === 'TEACHER_UNAVAILABLE')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('checks conflicts for ALL teachers in multi-teacher lessons', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            day: dayOfWeekArb,
            periodIndex: periodArb,
            classId: idArb,
            className: fc.option(fc.string(), { nil: null }),
            subjectId: idArb,
            subjectName: fc.option(fc.string(), { nil: null }),
            teacherIds: fc.array(idArb, { minLength: 2, maxLength: 4 }),
            teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
            roomId: fc.option(idArb, { nil: null }),
            roomName: fc.option(fc.string(), { nil: null }),
            isFixed: fc.boolean(),
            periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
          })
          .filter((l) => new Set(l.teacherIds).size === l.teacherIds.length),
        targetSlotArb,
        fullAvailabilityArb,
        (lesson, targetSlot, baseAvailability) => {
          const teachers = new Map<string, TeacherConstraintData>();

          // All teachers are available
          for (const teacherId of lesson.teacherIds) {
            const availability = { ...baseAvailability };
            availability[targetSlot.day] = [...availability[targetSlot.day]];
            availability[targetSlot.day][targetSlot.period] = true;
            teachers.set(teacherId, {
              id: teacherId,
              availability,
              timePreference: 'None',
              maxConsecutivePeriods: 10,
            });
          }

          // Create a conflicting lesson for the second teacher at target slot
          const conflictingLesson: ScheduledLesson = {
            day: targetSlot.day,
            periodIndex: targetSlot.period,
            classId: 'conflicting-class',
            className: 'Conflicting Class',
            subjectId: 'conflicting-subject',
            subjectName: 'Conflicting Subject',
            teacherIds: [lesson.teacherIds[1]], // Second teacher has conflict
            teacherNames: null,
            roomId: null,
            roomName: null,
            isFixed: false,
            periodsThisDay: null,
          };

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          const indexes = buildIndexes([conflictingLesson]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // Should be invalid because second teacher has conflict (Requirement 18.2)
          expect(result.isValid).toBe(false);
          expect(result.errors.some((e) => e.type === 'TEACHER_CONFLICT')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns valid when ALL teachers pass all checks', () => {
    fc.assert(
      fc.property(
        fc
          .record({
            day: dayOfWeekArb,
            periodIndex: periodArb,
            classId: idArb,
            className: fc.option(fc.string(), { nil: null }),
            subjectId: idArb,
            subjectName: fc.option(fc.string(), { nil: null }),
            teacherIds: fc.array(idArb, { minLength: 2, maxLength: 4 }),
            teacherNames: fc.option(fc.array(fc.string()), { nil: null }),
            roomId: fc.option(idArb, { nil: null }),
            roomName: fc.option(fc.string(), { nil: null }),
            isFixed: fc.boolean(),
            periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
          })
          .filter((l) => new Set(l.teacherIds).size === l.teacherIds.length),
        dayOfWeekArb,
        fc.integer({ min: 0, max: 3 }), // morning period
        fullAvailabilityArb,
        (lesson, day, period, baseAvailability) => {
          const targetSlot = { day, period };
          const teachers = new Map<string, TeacherConstraintData>();

          // All teachers are available and have no preference conflicts
          for (const teacherId of lesson.teacherIds) {
            const availability = { ...baseAvailability };
            availability[targetSlot.day] = [...availability[targetSlot.day]];
            availability[targetSlot.day][targetSlot.period] = true;
            teachers.set(teacherId, {
              id: teacherId,
              availability,
              timePreference: 'Morning', // Morning preference + morning slot = OK
              maxConsecutivePeriods: 10,
            });
          }

          const rooms = new Map<string, RoomConstraintData>();
          const subjects = new Map<string, SubjectConstraintData>();
          subjects.set(lesson.subjectId, {
            id: lesson.subjectId,
            requiredRoomType: null,
            isDifficult: false,
          });

          const indexes = buildIndexes([]);

          const swap = swapOperationArb(
            lesson,
            null,
            { day: lesson.day, period: lesson.periodIndex },
            targetSlot
          );

          const result = validateSwap(swap, indexes, teachers, rooms, subjects);

          // Should be valid when all teachers pass all checks
          expect(result.isValid).toBe(true);
          expect(result.errors.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
