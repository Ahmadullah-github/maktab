/**
 * Constraint checker utility for swap validation
 * Provides functions to check hard and soft constraints for swap operations
 *
 * **Feature: schedule-phase7**
 */

import { SWAP_CONSTRAINT_TYPES } from '../constants';
import type {
  ClassConstraintData,
  ConstraintViolation,
  DayOfWeek,
  RoomConstraintData,
  ScheduledLesson,
  ScheduleIndexes,
  SubjectConstraintData,
  SwapOperation,
  SwapValidationResult,
  TeacherConstraintData,
} from '../types';
import { createEntitySlotKey } from './indexBuilder';

/**
 * Checks if a teacher is available at the target slot
 * Handles multi-teacher lessons by checking ALL teachers
 *
 * @param lesson - The lesson being moved
 * @param targetSlot - The target day and period
 * @param teachers - Map of teacher constraint data
 * @returns ConstraintViolation if teacher is unavailable, null otherwise
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
export function checkTeacherAvailability(
  lesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  teachers: Map<string, TeacherConstraintData>
): ConstraintViolation | null {
  // Check availability for ALL teachers in the lesson
  for (const teacherId of lesson.teacherIds) {
    const teacherData = teachers.get(teacherId);

    // Skip if no teacher data available (defensive)
    if (!teacherData) {
      continue;
    }

    if (teacherData.unavailable.some(
      (slot) => slot.day === targetSlot.day && slot.period === targetSlot.period
    )) {
      return {
        type: 'TEACHER_UNAVAILABLE',
        severity: SWAP_CONSTRAINT_TYPES.TEACHER_UNAVAILABLE.severity,
        message: SWAP_CONSTRAINT_TYPES.TEACHER_UNAVAILABLE.messageFa,
        details: {
          teacherId,
          day: targetSlot.day,
          period: targetSlot.period,
        },
      };
    }
  }

  return null;
}

/**
 * Checks if any teacher has a conflict at the target slot
 * Uses byTeacherAndSlot index for O(1) lookup
 * Excludes swap partner from conflict check
 *
 * @param lesson - The lesson being moved
 * @param targetSlot - The target day and period
 * @param indexes - Pre-computed schedule indexes
 * @param excludeLessonId - Optional lesson ID to exclude (swap partner)
 * @returns ConstraintViolation if teacher has conflict, null otherwise
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */
export function checkTeacherConflict(
  lesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  indexes: ScheduleIndexes,
  excludeLessonId?: string
): ConstraintViolation | null {
  // Check conflict for ALL teachers in the lesson
  for (const teacherId of lesson.teacherIds) {
    const teacherSlotKey = createEntitySlotKey(teacherId, targetSlot.day, targetSlot.period);
    const conflictingLesson = indexes.byTeacherAndSlot.get(teacherSlotKey);

    // Check if there's a conflicting lesson that isn't the swap partner
    if (conflictingLesson) {
      // Create a unique identifier for the conflicting lesson
      const conflictingLessonId = `${conflictingLesson.classId}-${conflictingLesson.day}-${conflictingLesson.periodIndex}`;
      const currentLessonId = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;

      // Skip if this is the same lesson or the excluded swap partner
      if (conflictingLessonId === currentLessonId || conflictingLessonId === excludeLessonId) {
        continue;
      }

      return {
        type: 'TEACHER_CONFLICT',
        severity: SWAP_CONSTRAINT_TYPES.TEACHER_CONFLICT.severity,
        message: SWAP_CONSTRAINT_TYPES.TEACHER_CONFLICT.messageFa,
        details: {
          teacherId,
          conflictingClassName: conflictingLesson.className ?? conflictingLesson.classId,
          conflictingSubjectName: conflictingLesson.subjectName ?? conflictingLesson.subjectId,
        },
      };
    }
  }

  return null;
}

/**
 * Checks if the room has a conflict at the target slot
 * Uses byRoomAndSlot index for O(1) lookup
 * Handles null roomId (skip check)
 *
 * @param lesson - The lesson being moved
 * @param targetSlot - The target day and period
 * @param indexes - Pre-computed schedule indexes
 * @param excludeLessonId - Optional lesson ID to exclude (swap partner)
 * @returns ConstraintViolation if room has conflict, null otherwise
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */
export function checkRoomConflict(
  lesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  indexes: ScheduleIndexes,
  excludeLessonId?: string
): ConstraintViolation | null {
  // Skip check if lesson has no room assignment
  if (lesson.roomId === null) {
    return null;
  }

  const roomSlotKey = createEntitySlotKey(lesson.roomId, targetSlot.day, targetSlot.period);
  const conflictingLesson = indexes.byRoomAndSlot.get(roomSlotKey);

  if (conflictingLesson) {
    // Create a unique identifier for the conflicting lesson
    const conflictingLessonId = `${conflictingLesson.classId}-${conflictingLesson.day}-${conflictingLesson.periodIndex}`;
    const currentLessonId = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;

    // Skip if this is the same lesson or the excluded swap partner
    if (conflictingLessonId === currentLessonId || conflictingLessonId === excludeLessonId) {
      return null;
    }

    return {
      type: 'ROOM_CONFLICT',
      severity: SWAP_CONSTRAINT_TYPES.ROOM_CONFLICT.severity,
      message: SWAP_CONSTRAINT_TYPES.ROOM_CONFLICT.messageFa,
      details: {
        roomId: lesson.roomId,
        conflictingClassNameRoom: conflictingLesson.className ?? conflictingLesson.classId,
      },
    };
  }

  return null;
}

/**
 * Checks if the class has a conflict at the target slot
 * Uses byClassAndSlot index for O(1) lookup
 * Excludes swap partner from conflict check
 *
 * @param lesson - The lesson being moved
 * @param targetSlot - The target day and period
 * @param indexes - Pre-computed schedule indexes
 * @param excludeLessonId - Optional lesson ID to exclude (swap partner)
 * @returns ConstraintViolation if class has conflict, null otherwise
 *
 * **Validates: Requirements 7.1, 7.2, 7.3**
 */
export function checkClassConflict(
  lesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  indexes: ScheduleIndexes,
  excludeLessonId?: string
): ConstraintViolation | null {
  const classSlotKey = createEntitySlotKey(lesson.classId, targetSlot.day, targetSlot.period);
  const conflictingLesson = indexes.byClassAndSlot.get(classSlotKey);

  if (conflictingLesson) {
    // Create a unique identifier for the conflicting lesson
    const conflictingLessonId = `${conflictingLesson.classId}-${conflictingLesson.day}-${conflictingLesson.periodIndex}`;
    const currentLessonId = `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;

    // Skip if this is the same lesson or the excluded swap partner
    if (conflictingLessonId === currentLessonId || conflictingLessonId === excludeLessonId) {
      return null;
    }

    return {
      type: 'CLASS_CONFLICT',
      severity: SWAP_CONSTRAINT_TYPES.CLASS_CONFLICT.severity,
      message: SWAP_CONSTRAINT_TYPES.CLASS_CONFLICT.messageFa,
      details: {
        classId: lesson.classId,
        className: lesson.className ?? lesson.classId,
      },
    };
  }

  return null;
}

/**
 * Checks if the room type matches the subject's required room type
 * Handles null requiredRoomType (no constraint)
 *
 * @param lesson - The lesson being moved
 * @param targetRoom - The room at the target slot (null if no room)
 * @param subjects - Map of subject constraint data
 * @returns ConstraintViolation if room type doesn't match, null otherwise
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
 */
export function checkRoomTypeMismatch(
  lesson: ScheduledLesson,
  targetRoom: RoomConstraintData | null,
  subjects: Map<string, SubjectConstraintData>,
  classData?: ClassConstraintData
): ConstraintViolation | null {
  if (classData?.fixedRoomId) {
    return null;
  }

  const subjectData = subjects.get(lesson.subjectId);

  // Skip if no subject data or no room type requirement
  if (!subjectData || !subjectData.requiredRoomType) {
    return null;
  }

  // Skip if no target room (can't check type)
  if (!targetRoom) {
    return null;
  }

  // Check if room type matches requirement
  if (targetRoom.type !== subjectData.requiredRoomType) {
    return {
      type: 'ROOM_TYPE_MISMATCH',
      severity: SWAP_CONSTRAINT_TYPES.ROOM_TYPE_MISMATCH.severity,
      message: SWAP_CONSTRAINT_TYPES.ROOM_TYPE_MISMATCH.messageFa,
      details: {
        subjectId: lesson.subjectId,
        subjectName: lesson.subjectName ?? lesson.subjectId,
        requiredRoomType: subjectData.requiredRoomType,
        actualRoomType: targetRoom.type,
      },
    };
  }

  return null;
}

// ============================================================================
// Soft Constraint Checkers
// ============================================================================

/**
 * Threshold period for morning/afternoon distinction
 * Periods 0-3 are morning, periods 4+ are afternoon
 */
const AFTERNOON_PERIOD_THRESHOLD = 4;

interface LessonMoveValidationInput {
  lesson: ScheduledLesson;
  targetSlot: { day: DayOfWeek; period: number };
  swapPartner: ScheduledLesson | null;
  targetRoom: RoomConstraintData | null;
  indexes: ScheduleIndexes;
  teachers: Map<string, TeacherConstraintData>;
  subjects: Map<string, SubjectConstraintData>;
  classes: Map<string, ClassConstraintData>;
}

function createLessonKey(lesson: ScheduledLesson): string {
  return `${lesson.classId}-${lesson.day}-${lesson.periodIndex}`;
}

function createViolationKey(violation: ConstraintViolation): string {
  return `${violation.type}:${violation.message}:${JSON.stringify(violation.details)}`;
}

function pushUniqueViolation(
  violations: ConstraintViolation[],
  seenViolations: Set<string>,
  violation: ConstraintViolation | null
): void {
  if (!violation) {
    return;
  }

  const violationKey = createViolationKey(violation);
  if (seenViolations.has(violationKey)) {
    return;
  }

  seenViolations.add(violationKey);
  violations.push(violation);
}

function validateLessonMove({
  lesson,
  targetSlot,
  swapPartner,
  targetRoom,
  indexes,
  teachers,
  subjects,
  classes,
}: LessonMoveValidationInput): {
  errors: ConstraintViolation[];
  warnings: ConstraintViolation[];
} {
  const errors: ConstraintViolation[] = [];
  const warnings: ConstraintViolation[] = [];
  const seenErrors = new Set<string>();
  const seenWarnings = new Set<string>();
  const excludeLessonId = swapPartner ? createLessonKey(swapPartner) : undefined;

  pushUniqueViolation(
    errors,
    seenErrors,
    checkTeacherAvailability(lesson, targetSlot, teachers)
  );
  pushUniqueViolation(
    errors,
    seenErrors,
    checkTeacherConflict(lesson, targetSlot, indexes, excludeLessonId)
  );
  pushUniqueViolation(
    errors,
    seenErrors,
    checkRoomConflict(lesson, targetSlot, indexes, excludeLessonId)
  );
  pushUniqueViolation(
    errors,
    seenErrors,
    checkClassConflict(lesson, targetSlot, indexes, excludeLessonId)
  );
  pushUniqueViolation(
    errors,
    seenErrors,
    checkRoomTypeMismatch(lesson, targetRoom, subjects, classes.get(lesson.classId))
  );

  pushUniqueViolation(
    warnings,
    seenWarnings,
    checkTeacherPreference(lesson, targetSlot, teachers)
  );
  pushUniqueViolation(
    warnings,
    seenWarnings,
    checkDifficultAfternoon(lesson, targetSlot, subjects)
  );

  return { errors, warnings };
}

/**
 * Checks if a swap violates teacher's time preference
 * Morning preference + afternoon slot = warning
 * Afternoon preference + morning slot = warning
 *
 * @param lesson - The lesson being moved
 * @param targetSlot - The target day and period
 * @param teachers - Map of teacher constraint data
 * @returns ConstraintViolation if preference violated, null otherwise
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */
export function checkTeacherPreference(
  lesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  teachers: Map<string, TeacherConstraintData>
): ConstraintViolation | null {
  // Check preference for ALL teachers in the lesson
  for (const teacherId of lesson.teacherIds) {
    const teacherData = teachers.get(teacherId);

    // Skip if no teacher data or no preference set
    if (!teacherData || !teacherData.timePreference || teacherData.timePreference === 'None') {
      continue;
    }

    const isAfternoonSlot = targetSlot.period >= AFTERNOON_PERIOD_THRESHOLD;
    const preference = teacherData.timePreference;

    // Morning preference + afternoon slot = warning
    if (preference === 'Morning' && isAfternoonSlot) {
      return {
        type: 'TEACHER_PREFERENCE',
        severity: SWAP_CONSTRAINT_TYPES.TEACHER_PREFERENCE.severity,
        message: SWAP_CONSTRAINT_TYPES.TEACHER_PREFERENCE.messageFa,
        details: {
          teacherId,
          teacherPreference: preference,
          targetTimeOfDay: 'Afternoon',
          period: targetSlot.period,
        },
      };
    }

    // Afternoon preference + morning slot = warning
    if (preference === 'Afternoon' && !isAfternoonSlot) {
      return {
        type: 'TEACHER_PREFERENCE',
        severity: SWAP_CONSTRAINT_TYPES.TEACHER_PREFERENCE.severity,
        message: SWAP_CONSTRAINT_TYPES.TEACHER_PREFERENCE.messageFa,
        details: {
          teacherId,
          teacherPreference: preference,
          targetTimeOfDay: 'Morning',
          period: targetSlot.period,
        },
      };
    }
  }

  return null;
}

/**
 * Checks if a difficult subject is being moved to an afternoon slot
 * Difficult subjects are recommended for morning periods
 *
 * @param lesson - The lesson being moved
 * @param targetSlot - The target day and period
 * @param subjects - Map of subject constraint data
 * @returns ConstraintViolation if difficult subject in afternoon, null otherwise
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
 */
export function checkDifficultAfternoon(
  lesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number },
  subjects: Map<string, SubjectConstraintData>
): ConstraintViolation | null {
  const subjectData = subjects.get(lesson.subjectId);

  // Skip if no subject data or subject is not marked as difficult
  if (!subjectData || !subjectData.isDifficult) {
    return null;
  }

  // Check if target slot is in the afternoon (period >= 4)
  const isAfternoonSlot = targetSlot.period >= AFTERNOON_PERIOD_THRESHOLD;

  if (isAfternoonSlot) {
    return {
      type: 'DIFFICULT_AFTERNOON',
      severity: SWAP_CONSTRAINT_TYPES.DIFFICULT_AFTERNOON.severity,
      message: SWAP_CONSTRAINT_TYPES.DIFFICULT_AFTERNOON.messageFa,
      details: {
        subjectId: lesson.subjectId,
        subjectName: lesson.subjectName ?? lesson.subjectId,
        period: targetSlot.period,
        day: targetSlot.day,
      },
    };
  }

  return null;
}

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Main validation function for swap operations
 * Orchestrates all hard and soft constraint checks
 *
 * @param swap - The swap operation to validate
 * @param indexes - Pre-computed schedule indexes for O(1) lookups
 * @param teachers - Map of teacher constraint data
 * @param rooms - Map of room constraint data
 * @param subjects - Map of subject constraint data
 * @returns SwapValidationResult with validity status, errors, and warnings
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
 */
export function validateSwap(
  swap: SwapOperation,
  indexes: ScheduleIndexes,
  teachers: Map<string, TeacherConstraintData>,
  rooms: Map<string, RoomConstraintData>,
  subjects: Map<string, SubjectConstraintData>,
  classes: Map<string, ClassConstraintData>
): SwapValidationResult {
  const errors: ConstraintViolation[] = [];
  const warnings: ConstraintViolation[] = [];
  const seenErrors = new Set<string>();
  const seenWarnings = new Set<string>();
  const lessonAMove = validateLessonMove({
    lesson: swap.lessonA,
    targetSlot: swap.slotB,
    swapPartner: swap.lessonB,
    targetRoom: swap.lessonB?.roomId ? (rooms.get(swap.lessonB.roomId) ?? null) : null,
    indexes,
    teachers,
    subjects,
    classes,
  });

  for (const error of lessonAMove.errors) {
    pushUniqueViolation(errors, seenErrors, error);
  }
  for (const warning of lessonAMove.warnings) {
    pushUniqueViolation(warnings, seenWarnings, warning);
  }

  if (swap.lessonB) {
    const lessonBMove = validateLessonMove({
      lesson: swap.lessonB,
      targetSlot: swap.slotA,
      swapPartner: swap.lessonA,
      targetRoom: swap.lessonA.roomId ? (rooms.get(swap.lessonA.roomId) ?? null) : null,
      indexes,
      teachers,
      subjects,
      classes,
    });

    for (const error of lessonBMove.errors) {
      pushUniqueViolation(errors, seenErrors, error);
    }
    for (const warning of lessonBMove.warnings) {
      pushUniqueViolation(warnings, seenWarnings, warning);
    }
  }

  // ============================================================================
  // Determine validation result flags
  // ============================================================================

  // isValid is false if ANY hard constraint is violated (Requirement 2.3)
  const isValid = errors.length === 0;

  // canProceedWithWarning is true if valid but has soft constraint warnings (Requirement 2.4)
  // If no constraints violated, canProceedWithWarning is false (Requirement 2.5)
  const canProceedWithWarning = isValid && warnings.length > 0;

  return {
    isValid,
    canProceedWithWarning,
    errors, // Hard constraint violations (Requirement 2.6)
    warnings, // Soft constraint violations (Requirement 2.7)
    swap,
  };
}
