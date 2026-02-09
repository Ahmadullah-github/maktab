/**
 * useConflictDetection Hook
 *
 * Phase 4.3: Unified Conflict Detection Across Views
 *
 * Provides consistent conflict detection for all three assignment views:
 * - Teacher-centric view
 * - Subject-centric view
 * - Class-centric view
 *
 * Ensures same conflicts are shown with consistent Farsi messages
 * and resolution suggestions across all views.
 *
 * NOTE: No longer validates teacher-subject compatibility as a conflict.
 * Primary/allowed subjects are solver preferences, not hard restrictions.
 */

import { useCallback, useMemo } from 'react';
import { useClasses } from '../../classes/hooks/useClasses';
import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import type { AssignmentConflict, ConflictSeverity } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface ConflictDetectionOptions {
  /** Teacher ID to check conflicts for */
  teacherId?: number;
  /** Subject ID to check conflicts for */
  subjectId?: number;
  /** Class ID to check conflicts for */
  classId?: number;
}

export interface ConflictDetectionResult {
  /** All detected conflicts */
  conflicts: AssignmentConflict[];
  /** Error-level conflicts only */
  errors: AssignmentConflict[];
  /** Warning-level conflicts only */
  warnings: AssignmentConflict[];
  /** Whether there are any error-level conflicts */
  hasErrors: boolean;
  /** Whether there are any conflicts at all */
  hasConflicts: boolean;
  /** Loading state */
  isLoading: boolean;
}

export interface UseConflictDetectionResult extends ConflictDetectionResult {
  /** Detect conflicts for a specific assignment */
  detectConflicts: (
    teacherId: number,
    subjectId: number,
    classId: number,
    periodsPerWeek: number
  ) => AssignmentConflict[];
  /** Get conflicts for a teacher */
  getTeacherConflicts: (teacherId: number) => AssignmentConflict[];
  /** Get conflicts for a subject across all classes */
  getSubjectConflicts: (subjectId: number) => AssignmentConflict[];
  /** Get conflicts for a class */
  getClassConflicts: (classId: number) => AssignmentConflict[];
  /** Check if a specific assignment has conflicts */
  hasAssignmentConflicts: (teacherId: number, subjectId: number, classId: number) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const NEAR_CAPACITY_THRESHOLD = 5;

// ============================================================================
// Conflict Factory Functions (Consistent Farsi Messages)
// ============================================================================

/**
 * Create workload exceeded conflict
 */
function createWorkloadConflict(
  teacher: Teacher,
  currentPeriods: number,
  maxPeriods: number,
  severity: ConflictSeverity = 'error'
): AssignmentConflict {
  const isOverloaded = currentPeriods > maxPeriods;

  return {
    type: 'workload_exceeded',
    severity,
    message: isOverloaded
      ? `Teacher "${teacher.fullName}" is overloaded (${currentPeriods}/${maxPeriods} periods)`
      : `Teacher "${teacher.fullName}" is near capacity (${currentPeriods}/${maxPeriods} periods)`,
    messageFa: isOverloaded
      ? `معلم "${teacher.fullName}" بیش از حد بارگذاری شده است (${currentPeriods}/${maxPeriods} ساعت)`
      : `معلم "${teacher.fullName}" نزدیک به حداکثر ظرفیت است (${currentPeriods}/${maxPeriods} ساعت)`,
    affectedEntities: {
      teacherId: teacher.id,
    },
    suggestedResolution: isOverloaded
      ? 'Reduce teacher assignments or increase maximum periods'
      : 'Consider distributing workload to other teachers',
    suggestedResolutionFa: isOverloaded
      ? 'تخصیص‌های معلم را کاهش دهید یا حداکثر ساعات را افزایش دهید'
      : 'توزیع بار کاری به معلمان دیگر را در نظر بگیرید',
  };
}

// NOTE: createIncompatibilityConflict removed - no longer used
// Primary/allowed subjects are solver preferences, not hard restrictions

/**
 * Create duplicate assignment conflict
 */
function createDuplicateConflict(
  teacher: Teacher,
  subject: Subject,
  classGroup: ClassGroup
): AssignmentConflict {
  return {
    type: 'duplicate_assignment',
    severity: 'warning',
    message: `Teacher "${teacher.fullName}" is already assigned to "${subject.name}" in "${classGroup.displayName || classGroup.name}"`,
    messageFa: `معلم "${teacher.fullName}" قبلاً برای "${subject.name}" در "${classGroup.displayName || classGroup.name}" تخصیص یافته است`,
    affectedEntities: {
      teacherId: teacher.id,
      subjectId: subject.id,
      classId: classGroup.id,
    },
    suggestedResolution: 'Remove existing assignment first',
    suggestedResolutionFa: 'ابتدا تخصیص موجود را حذف کنید',
  };
}

/**
 * Create coverage insufficient conflict
 */
function createCoverageConflict(
  subject: Subject,
  classGroup: ClassGroup,
  assignedPeriods: number,
  requiredPeriods: number
): AssignmentConflict {
  return {
    type: 'coverage_insufficient',
    severity: assignedPeriods === 0 ? 'error' : 'warning',
    message: `"${subject.name}" in "${classGroup.displayName || classGroup.name}" needs ${requiredPeriods - assignedPeriods} more periods`,
    messageFa: `"${subject.name}" در "${classGroup.displayName || classGroup.name}" به ${requiredPeriods - assignedPeriods} ساعت بیشتر نیاز دارد`,
    affectedEntities: {
      subjectId: subject.id,
      classId: classGroup.id,
    },
    suggestedResolution: 'Assign additional teachers to cover remaining periods',
    suggestedResolutionFa: 'معلمان بیشتری برای پوشش ساعات باقی‌مانده تخصیص دهید',
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON array from string or return as-is
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// NOTE: getCompatibilityLevel removed - no longer used for conflict detection
// Primary/allowed subjects are solver preferences, not hard restrictions

/**
 * Calculate teacher's current workload from assignments
 */
function calculateWorkload(
  teacherId: number,
  assignments: TeacherClassSubjectAssignment[]
): number {
  return assignments
    .filter((a) => a.teacherId === teacherId)
    .reduce((sum, a) => sum + a.periodsPerWeek, 0);
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useConflictDetection(
  options: ConflictDetectionOptions = {}
): UseConflictDetectionResult {
  const { teacherId, subjectId, classId } = options;

  // Fetch data
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();
  const { data: assignments = [], isLoading: isLoadingAssignments } = useTeacherAssignments();

  const isLoading =
    isLoadingTeachers || isLoadingSubjects || isLoadingClasses || isLoadingAssignments;

  /**
   * Detect conflicts for a specific assignment
   */
  const detectConflicts = useCallback(
    (tId: number, sId: number, cId: number, periodsPerWeek: number): AssignmentConflict[] => {
      const conflicts: AssignmentConflict[] = [];

      const teacher = teachers.find((t) => t.id === tId);
      const subject = subjects.find((s) => s.id === sId);
      const classGroup = classes.find((c) => c.id === cId);

      if (!teacher || !subject || !classGroup) {
        return conflicts;
      }

      // NOTE: No longer check teacher-subject compatibility as a conflict
      // Primary/allowed subjects are solver preferences, not hard restrictions
      // The assignment table is the source of truth

      // 1. Check workload
      const currentWorkload = calculateWorkload(tId, assignments);
      const projectedWorkload = currentWorkload + periodsPerWeek;
      const maxPeriods = teacher.maxPeriodsPerWeek;

      if (projectedWorkload > maxPeriods) {
        conflicts.push(createWorkloadConflict(teacher, projectedWorkload, maxPeriods, 'error'));
      } else if (maxPeriods - projectedWorkload <= NEAR_CAPACITY_THRESHOLD) {
        conflicts.push(createWorkloadConflict(teacher, projectedWorkload, maxPeriods, 'warning'));
      }

      // 2. Check for duplicate assignment
      const existingAssignment = assignments.find(
        (a) => a.teacherId === tId && a.subjectId === sId && a.classId === cId
      );
      if (existingAssignment) {
        conflicts.push(createDuplicateConflict(teacher, subject, classGroup));
      }

      return conflicts;
    },
    [teachers, subjects, classes, assignments]
  );

  /**
   * Get all conflicts for a teacher
   */
  const getTeacherConflicts = useCallback(
    (tId: number): AssignmentConflict[] => {
      const conflicts: AssignmentConflict[] = [];
      const teacher = teachers.find((t) => t.id === tId);

      if (!teacher) return conflicts;

      // Check workload
      const currentWorkload = calculateWorkload(tId, assignments);
      const maxPeriods = teacher.maxPeriodsPerWeek;

      if (currentWorkload > maxPeriods) {
        conflicts.push(createWorkloadConflict(teacher, currentWorkload, maxPeriods, 'error'));
      } else if (maxPeriods - currentWorkload <= NEAR_CAPACITY_THRESHOLD) {
        conflicts.push(createWorkloadConflict(teacher, currentWorkload, maxPeriods, 'warning'));
      }

      // NOTE: No longer check teacher-subject compatibility as a conflict
      // Primary/allowed subjects are solver preferences, not hard restrictions

      return conflicts;
    },
    [teachers, assignments]
  );

  /**
   * Get all conflicts for a subject across all classes
   */
  const getSubjectConflicts = useCallback(
    (sId: number): AssignmentConflict[] => {
      const conflicts: AssignmentConflict[] = [];
      const subject = subjects.find((s) => s.id === sId);

      if (!subject) return conflicts;

      // Check each class that requires this subject
      for (const classGroup of classes) {
        const requirements = parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements);
        const requirement = requirements.find((r) => r.subjectId === sId);

        if (requirement) {
          // Get assignments for this class-subject pair
          const classSubjectAssignments = assignments.filter(
            (a) => a.classId === classGroup.id && a.subjectId === sId
          );

          const assignedPeriods = classSubjectAssignments.reduce(
            (sum, a) => sum + a.periodsPerWeek,
            0
          );

          // Check coverage
          if (assignedPeriods < requirement.periodsPerWeek) {
            conflicts.push(
              createCoverageConflict(
                subject,
                classGroup,
                assignedPeriods,
                requirement.periodsPerWeek
              )
            );
          }

          // NOTE: No longer check teacher-subject compatibility as a conflict
          // Primary/allowed subjects are solver preferences, not hard restrictions
        }
      }

      return conflicts;
    },
    [subjects, classes, assignments]
  );

  /**
   * Get all conflicts for a class
   */
  const getClassConflicts = useCallback(
    (cId: number): AssignmentConflict[] => {
      const conflicts: AssignmentConflict[] = [];
      const classGroup = classes.find((c) => c.id === cId);

      if (!classGroup) return conflicts;

      const requirements = parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements);

      for (const requirement of requirements) {
        const subject = subjects.find((s) => s.id === requirement.subjectId);
        if (!subject) continue;

        // Get assignments for this class-subject pair
        const classSubjectAssignments = assignments.filter(
          (a) => a.classId === cId && a.subjectId === requirement.subjectId
        );

        const assignedPeriods = classSubjectAssignments.reduce(
          (sum, a) => sum + a.periodsPerWeek,
          0
        );

        // Check coverage
        if (assignedPeriods < requirement.periodsPerWeek) {
          conflicts.push(
            createCoverageConflict(subject, classGroup, assignedPeriods, requirement.periodsPerWeek)
          );
        }

        // Check workload for each teacher assignment
        for (const assignment of classSubjectAssignments) {
          const teacher = teachers.find((t) => t.id === assignment.teacherId);
          if (teacher) {
            // Check workload only - no compatibility check
            const currentWorkload = calculateWorkload(teacher.id, assignments);
            if (currentWorkload > teacher.maxPeriodsPerWeek) {
              conflicts.push(
                createWorkloadConflict(teacher, currentWorkload, teacher.maxPeriodsPerWeek, 'error')
              );
            }
          }
        }
      }

      return conflicts;
    },
    [teachers, subjects, classes, assignments]
  );

  /**
   * Check if a specific assignment has conflicts
   */
  const hasAssignmentConflicts = useCallback(
    (tId: number, sId: number, cId: number): boolean => {
      const conflicts = detectConflicts(tId, sId, cId, 0);
      return conflicts.some((c) => c.severity === 'error');
    },
    [detectConflicts]
  );

  // Compute conflicts based on options
  const conflicts = useMemo((): AssignmentConflict[] => {
    if (teacherId) {
      return getTeacherConflicts(teacherId);
    }
    if (subjectId) {
      return getSubjectConflicts(subjectId);
    }
    if (classId) {
      return getClassConflicts(classId);
    }
    return [];
  }, [teacherId, subjectId, classId, getTeacherConflicts, getSubjectConflicts, getClassConflicts]);

  const errors = useMemo(() => conflicts.filter((c) => c.severity === 'error'), [conflicts]);

  const warnings = useMemo(() => conflicts.filter((c) => c.severity === 'warning'), [conflicts]);

  return {
    conflicts,
    errors,
    warnings,
    hasErrors: errors.length > 0,
    hasConflicts: conflicts.length > 0,
    isLoading,
    detectConflicts,
    getTeacherConflicts,
    getSubjectConflicts,
    getClassConflicts,
    hasAssignmentConflicts,
  };
}

export default useConflictDetection;
