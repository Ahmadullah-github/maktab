/**
 * useSubjectAssignments Hook
 *
 * Phase 2.5: Subject-Centric Assignment Mutations
 *
 * Provides assignment data and mutations filtered by subject.
 * Used by SubjectAssignmentManager and related components.
 *
 * Features:
 * - Filtered assignments for a specific subject
 * - Assign/unassign mutations with proper cache invalidation
 * - Assignment grouping by class
 * - Coverage statistics
 */

import { useMemo } from 'react';
import {
  useAssignTeacher,
  useUnassignTeacher,
  useValidateAssignment,
} from '../../assignments/hooks/useAssignmentMutations';
import type { TeacherCompatibilityLevel } from '../../assignments/types';
import { useClasses } from '../../classes/hooks/useClasses';
import type { SubjectRequirement } from '../../classes/types';
import { teacherAssignmentKeys, useTeacherAssignments } from '../../teacher-assignments';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';

// ============================================================================
// Types
// ============================================================================

/**
 * Assignment info for a class-subject combination
 */
export interface ClassSubjectAssignment {
  /** Assignment ID (from TeacherClassSubjectAssignment table) */
  assignmentId: number;
  /** Teacher ID */
  teacherId: number;
  /** Teacher name */
  teacherName: string;
  /** Periods assigned to this teacher */
  periodsPerWeek: number;
  /** Teacher's compatibility with the subject */
  compatibility: TeacherCompatibilityLevel;
}

/**
 * Class assignment summary for a subject
 */
export interface ClassAssignmentSummary {
  /** Class ID */
  classId: number;
  /** Class name */
  className: string;
  /** Class display name */
  displayName: string;
  /** Class grade */
  grade: number | null;
  /** Total periods required for this subject */
  requiredPeriods: number;
  /** Total periods assigned */
  assignedPeriods: number;
  /** Remaining periods to assign */
  remainingPeriods: number;
  /** Whether fully assigned */
  isFullyAssigned: boolean;
  /** Teachers assigned to this class-subject */
  assignments: ClassSubjectAssignment[];
}

/**
 * Result of the useSubjectAssignments hook
 */
export interface UseSubjectAssignmentsResult {
  /** All assignments for this subject, grouped by class */
  classAssignments: ClassAssignmentSummary[];
  /** Raw assignment data */
  rawAssignments: TeacherClassSubjectAssignment[];
  /** Total classes requiring this subject */
  totalClasses: number;
  /** Classes with full assignment */
  fullyAssignedClasses: number;
  /** Classes with partial assignment */
  partiallyAssignedClasses: number;
  /** Classes with no assignment */
  unassignedClasses: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Assign teacher mutation */
  assignTeacher: ReturnType<typeof useAssignTeacher>;
  /** Unassign teacher mutation */
  unassignTeacher: ReturnType<typeof useUnassignTeacher>;
  /** Validate assignment mutation */
  validateAssignment: ReturnType<typeof useValidateAssignment>;
  /** Whether any mutation is in progress */
  isLoading: boolean;
  /** Whether data is being fetched */
  isFetching: boolean;
  /** Error state */
  error: Error | null;
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

/**
 * Ensure subject requirements is an array
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  if (Array.isArray(requirements)) return requirements;
  return parseJsonArray<SubjectRequirement>(requirements);
}

/**
 * Get teacher compatibility level for a subject
 */
function getTeacherCompatibility(
  teacher: {
    primarySubjectIds: number[] | string | null;
    allowedSubjectIds: number[] | string | null;
    restrictToPrimarySubjects: boolean;
  },
  subjectId: number
): TeacherCompatibilityLevel {
  const primaryIds = parseJsonArray<number>(teacher.primarySubjectIds);
  const allowedIds = parseJsonArray<number>(teacher.allowedSubjectIds);

  if (primaryIds.includes(subjectId)) {
    return 'primary';
  }
  if (allowedIds.includes(subjectId)) {
    return 'allowed';
  }
  // Not in primary or allowed, but still valid if assigned by admin
  return 'allowed';
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing assignments for a specific subject
 *
 * @param subjectId - The subject ID to filter assignments for
 * @returns Assignment data and mutations for the subject
 *
 * @example
 * ```tsx
 * const {
 *   classAssignments,
 *   coveragePercentage,
 *   assignTeacher,
 *   unassignTeacher,
 * } = useSubjectAssignments(subjectId);
 *
 * // Assign a teacher
 * await assignTeacher.mutateAsync({
 *   teacherId: 1,
 *   subjectId,
 *   classIds: [2],
 *   periodsPerWeek: 4,
 * });
 * ```
 */
export function useSubjectAssignments(subjectId: number): UseSubjectAssignmentsResult {
  // Fetch all data
  const {
    data: allAssignments = [],
    isLoading: isLoadingAssignments,
    error: assignmentsError,
  } = useTeacherAssignments();

  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();

  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();

  // Mutations
  const assignTeacher = useAssignTeacher();
  const unassignTeacher = useUnassignTeacher();
  const validateAssignment = useValidateAssignment();

  // Filter assignments for this subject
  const subjectAssignments = useMemo(() => {
    return allAssignments.filter((a) => a.subjectId === subjectId);
  }, [allAssignments, subjectId]);

  // Build class assignment summaries
  const classAssignments = useMemo((): ClassAssignmentSummary[] => {
    const summaries: ClassAssignmentSummary[] = [];

    for (const classGroup of classes) {
      if (classGroup.isDeleted) continue;

      // Check if this class requires this subject
      const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
      const requirement = requirements.find((r) => r.subjectId === subjectId);

      if (!requirement) continue;

      // Get assignments for this class-subject
      const classSubjectAssignments = subjectAssignments.filter((a) => a.classId === classGroup.id);

      // Build assignment details
      const assignments: ClassSubjectAssignment[] = classSubjectAssignments.map((a) => {
        const teacher = teachers.find((t) => t.id === a.teacherId);
        return {
          assignmentId: a.id,
          teacherId: a.teacherId,
          teacherName: teacher?.fullName || `Teacher ${a.teacherId}`,
          periodsPerWeek: a.periodsPerWeek,
          compatibility: teacher ? getTeacherCompatibility(teacher, subjectId) : 'incompatible',
        };
      });

      const assignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
      const requiredPeriods = requirement.periodsPerWeek;
      const remainingPeriods = Math.max(0, requiredPeriods - assignedPeriods);

      summaries.push({
        classId: classGroup.id,
        className: classGroup.name,
        displayName: classGroup.displayName || classGroup.name,
        grade: classGroup.grade,
        requiredPeriods,
        assignedPeriods,
        remainingPeriods,
        isFullyAssigned: remainingPeriods <= 0,
        assignments,
      });
    }

    // Sort by grade, then by name
    return summaries.sort((a, b) => {
      if (a.grade !== b.grade) return (a.grade || 0) - (b.grade || 0);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [classes, subjectAssignments, teachers, subjectId]);

  // Calculate coverage statistics
  const {
    totalClasses,
    fullyAssignedClasses,
    partiallyAssignedClasses,
    unassignedClasses,
    coveragePercentage,
  } = useMemo(() => {
    const total = classAssignments.length;
    const fullyAssigned = classAssignments.filter((c) => c.isFullyAssigned).length;
    const partiallyAssigned = classAssignments.filter(
      (c) => !c.isFullyAssigned && c.assignments.length > 0
    ).length;
    const unassigned = classAssignments.filter((c) => c.assignments.length === 0).length;
    const percentage = total > 0 ? Math.round((fullyAssigned / total) * 100) : 0;

    return {
      totalClasses: total,
      fullyAssignedClasses: fullyAssigned,
      partiallyAssignedClasses: partiallyAssigned,
      unassignedClasses: unassigned,
      coveragePercentage: percentage,
    };
  }, [classAssignments]);

  const isLoading =
    assignTeacher.isPending || unassignTeacher.isPending || validateAssignment.isPending;

  const isFetching = isLoadingAssignments || isLoadingTeachers || isLoadingClasses;

  const error = assignmentsError || teachersError || classesError || null;

  return {
    classAssignments,
    rawAssignments: subjectAssignments,
    totalClasses,
    fullyAssignedClasses,
    partiallyAssignedClasses,
    unassignedClasses,
    coveragePercentage,
    assignTeacher,
    unassignTeacher,
    validateAssignment,
    isLoading,
    isFetching,
    error,
  };
}

// ============================================================================
// All Subjects Summary Hook
// ============================================================================

/**
 * Summary of assignment coverage for a single subject (used in data grid)
 */
export interface SubjectAssignmentSummary {
  subjectId: number;
  totalClasses: number;
  assignedClasses: number;
  coveragePercentage: number;
  assignedTeachers: Array<{ teacherId: number; teacherName: string }>;
}

/**
 * Hook for getting assignment summaries for ALL subjects
 * Used by SubjectDataGrid to show coverage in each row
 */
export function useAllSubjectAssignmentSummaries(): {
  allSummaries: SubjectAssignmentSummary[];
  isLoading: boolean;
} {
  const { data: allAssignments = [], isLoading: isLoadingAssignments } = useTeacherAssignments();
  const { data: teachers = [], isLoading: isLoadingTeachers } = useTeachers();
  const { data: classes = [], isLoading: isLoadingClasses } = useClasses();

  const allSummaries = useMemo((): SubjectAssignmentSummary[] => {
    // Build a map of subjectId -> classes that require it
    const subjectClassMap = new Map<number, { classId: number; requiredPeriods: number }[]>();

    for (const classGroup of classes) {
      if (classGroup.isDeleted) continue;
      const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
      for (const req of requirements) {
        if (!subjectClassMap.has(req.subjectId)) {
          subjectClassMap.set(req.subjectId, []);
        }
        subjectClassMap.get(req.subjectId)!.push({
          classId: classGroup.id,
          requiredPeriods: req.periodsPerWeek,
        });
      }
    }

    // Build summaries for each subject
    const summaries: SubjectAssignmentSummary[] = [];

    for (const [subjectId, classRequirements] of subjectClassMap) {
      const subjectAssignments = allAssignments.filter((a) => a.subjectId === subjectId);

      // Count assigned classes (classes with at least one assignment)
      const assignedClassIds = new Set(subjectAssignments.map((a) => a.classId));
      const assignedClasses = classRequirements.filter((c) =>
        assignedClassIds.has(c.classId)
      ).length;

      // Get unique teachers
      const teacherMap = new Map<number, string>();
      for (const a of subjectAssignments) {
        if (!teacherMap.has(a.teacherId)) {
          const teacher = teachers.find((t) => t.id === a.teacherId);
          teacherMap.set(a.teacherId, teacher?.fullName || `Teacher ${a.teacherId}`);
        }
      }

      const totalClasses = classRequirements.length;
      const coveragePercentage =
        totalClasses > 0 ? Math.round((assignedClasses / totalClasses) * 100) : 0;

      summaries.push({
        subjectId,
        totalClasses,
        assignedClasses,
        coveragePercentage,
        assignedTeachers: Array.from(teacherMap.entries()).map(([teacherId, teacherName]) => ({
          teacherId,
          teacherName,
        })),
      });
    }

    return summaries;
  }, [allAssignments, classes, teachers]);

  return {
    allSummaries,
    isLoading: isLoadingAssignments || isLoadingTeachers || isLoadingClasses,
  };
}

// Re-export query keys for external use
export { teacherAssignmentKeys };

export default useSubjectAssignments;
