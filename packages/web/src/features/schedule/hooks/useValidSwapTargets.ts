/**
 * Hook for computing valid swap targets for a selected lesson
 *
 * Provides real-time validation of all potential swap targets in the current view scope.
 * Uses memoization for performance optimization.
 *
 * **Feature: schedule-phase7**
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 16.3**
 */

import { useMemo } from 'react';

import { useScheduleStore } from '../stores/scheduleStore';
import type {
  CellValidationStatus,
  DayOfWeek,
  RoomConstraintData,
  ScheduledLesson,
  SubjectConstraintData,
  SwapOperation,
  SwapValidationResult,
  TeacherConstraintData,
} from '../types';
import { validateSwap } from '../utils/constraintChecker';
import { createSlotKey } from '../utils/indexBuilder';

/**
 * Options for the useValidSwapTargets hook
 */
export interface UseValidSwapTargetsOptions {
  /** View scope: 'class' or 'teacher' */
  viewScope: 'class' | 'teacher';
  /** ID of the class or teacher being viewed */
  scopeId: string;
}

/**
 * Return type for the useValidSwapTargets hook
 */
export interface UseValidSwapTargetsReturn {
  /** Map of slot key to validation result */
  validationResults: Map<string, SwapValidationResult>;
  /** Get validation status for a specific slot */
  getValidationStatus: (day: DayOfWeek, period: number) => CellValidationStatus;
  /** Check if any valid targets exist */
  hasValidTargets: boolean;
}

/**
 * Converts a SwapValidationResult to a CellValidationStatus
 *
 * @param result - The validation result to convert
 * @returns 'valid', 'warning', 'blocked', or null
 *
 * **Validates: Requirements 16.3**
 */
export function getValidationStatusFromResult(
  result: SwapValidationResult | undefined
): CellValidationStatus {
  if (!result) {
    return null;
  }

  if (!result.isValid) {
    // Hard constraint violations -> blocked
    return 'blocked';
  }

  if (result.canProceedWithWarning) {
    // Soft constraint violations -> warning
    return 'warning';
  }

  // No violations -> valid
  return 'valid';
}

/**
 * Creates teacher constraint data from store metadata
 * This is a helper to convert TeacherMetadata to TeacherConstraintData
 */
function createTeacherConstraintMap(
  teachers: Map<string, { teacherId: string; teacherName: string }>
): Map<string, TeacherConstraintData> {
  const constraintMap = new Map<string, TeacherConstraintData>();

  // Note: The store's TeacherMetadata doesn't have availability data
  // In a real implementation, this would come from the API
  // For now, we create empty constraint data that won't block swaps
  for (const [id, teacher] of teachers) {
    constraintMap.set(id, {
      id: teacher.teacherId,
      availability: {} as Record<DayOfWeek, boolean[]>,
      timePreference: 'None',
      maxConsecutivePeriods: undefined,
    });
  }

  return constraintMap;
}

/**
 * Creates subject constraint data from store metadata
 */
function createSubjectConstraintMap(
  subjects: Map<string, { subjectId: string; subjectName: string }>
): Map<string, SubjectConstraintData> {
  const constraintMap = new Map<string, SubjectConstraintData>();

  for (const [id, subject] of subjects) {
    constraintMap.set(id, {
      id: subject.subjectId,
      requiredRoomType: null,
      isDifficult: false,
    });
  }

  return constraintMap;
}

/**
 * Creates room constraint data from store metadata
 */
function createRoomConstraintMap(
  rooms: Map<string, { roomId: string; roomName: string }>
): Map<string, RoomConstraintData> {
  const constraintMap = new Map<string, RoomConstraintData>();

  for (const [id, room] of rooms) {
    constraintMap.set(id, {
      id: room.roomId,
      type: 'normal', // Default type
    });
  }

  return constraintMap;
}

/**
 * Hook for computing valid swap targets for a selected lesson
 *
 * When a lesson is selected, this hook computes validation results for all
 * potential target slots in the current view scope. Results are memoized
 * for performance.
 *
 * @param selectedLesson - The currently selected lesson (null if none)
 * @param options - View scope configuration
 * @returns Object with validation results map and helper functions
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
 */
export function useValidSwapTargets(
  selectedLesson: ScheduledLesson | null,
  options: UseValidSwapTargetsOptions
): UseValidSwapTargetsReturn {
  const { viewScope, scopeId } = options;

  // Get data from store
  const indexes = useScheduleStore((state) => state.indexes);
  const metadata = useScheduleStore((state) => state.metadata);
  const teachers = useScheduleStore((state) => state.teachers);
  const rooms = useScheduleStore((state) => state.rooms);
  const subjects = useScheduleStore((state) => state.subjects);

  // Create constraint data maps
  const teacherConstraints = useMemo(() => createTeacherConstraintMap(teachers), [teachers]);

  const subjectConstraints = useMemo(() => createSubjectConstraintMap(subjects), [subjects]);

  const roomConstraints = useMemo(() => createRoomConstraintMap(rooms), [rooms]);

  /**
   * Compute validation results for all potential targets
   * Memoized for performance (Requirement 11.5)
   */
  const validationResults = useMemo<Map<string, SwapValidationResult>>(() => {
    // Return empty map when no lesson selected (Requirement 11.3)
    if (!selectedLesson) {
      return new Map();
    }

    // Return empty map if no metadata (can't determine slots)
    if (!metadata?.periodConfiguration) {
      return new Map();
    }

    const results = new Map<string, SwapValidationResult>();
    const { periodsPerDayMap, daysOfWeek } = metadata.periodConfiguration;

    // Get lessons in the current view scope
    const scopeLessons =
      viewScope === 'class'
        ? (indexes.byClass.get(scopeId) ?? [])
        : (indexes.byTeacher.get(scopeId) ?? []);

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
          slotA: { day: selectedLesson.day as DayOfWeek, period: selectedLesson.periodIndex },
          slotB: { day: day as DayOfWeek, period },
        };

        // Validate the swap
        const result = validateSwap(
          swap,
          indexes,
          teacherConstraints,
          roomConstraints,
          subjectConstraints
        );

        results.set(slotKey, result);
      }
    }

    return results;
  }, [
    selectedLesson,
    metadata,
    viewScope,
    scopeId,
    indexes,
    teacherConstraints,
    roomConstraints,
    subjectConstraints,
  ]);

  /**
   * Get validation status for a specific slot
   * Converts SwapValidationResult to CellValidationStatus
   */
  const getValidationStatus = useMemo(() => {
    return (day: DayOfWeek, period: number): CellValidationStatus => {
      const slotKey = createSlotKey(day, period);
      const result = validationResults.get(slotKey);
      return getValidationStatusFromResult(result);
    };
  }, [validationResults]);

  /**
   * Check if any valid targets exist
   * Useful for UI feedback when no swaps are possible
   */
  const hasValidTargets = useMemo(() => {
    for (const result of validationResults.values()) {
      if (result.isValid) {
        return true;
      }
    }
    return false;
  }, [validationResults]);

  return {
    validationResults,
    getValidationStatus,
    hasValidTargets,
  };
}
