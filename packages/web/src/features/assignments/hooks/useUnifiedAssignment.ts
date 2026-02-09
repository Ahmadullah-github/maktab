/**
 * useUnifiedAssignment Hook
 *
 * Phase 1.2: Shared Assignment Infrastructure
 *
 * A unified hook that provides assignment operations from any perspective
 * (teacher-centric, subject-centric, or class-centric) with consistent
 * behavior, validation, and cache invalidation.
 *
 * This hook abstracts the dual-write system (old JSON fields + new table)
 * and provides a single interface for all assignment operations.
 */

import { invalidateAssignmentCaches } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useClasses } from '../../classes/hooks/useClasses';
import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import type {
  AssignmentConflict,
  AssignmentStatus,
  TeacherCompatibilityLevel,
  TeacherWorkload,
  WorkloadBreakdown,
  WorkloadStatus,
} from '../types';
import {
  useAssignTeacher,
  useUnassignTeacher,
  useValidateAssignment,
} from './useAssignmentMutations';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed class assignment from teacher data
 */
interface ParsedClassAssignment {
  subjectId: number;
  classIds: number[];
}

/**
 * Assignment info for a specific teacher-subject-class combination
 */
export interface AssignmentInfo {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  periodsPerWeek: number;
  status: AssignmentStatus;
  compatibility: TeacherCompatibilityLevel;
}

/**
 * Teacher option for assignment selection
 */
export interface TeacherOption {
  id: number;
  name: string;
  compatibility: TeacherCompatibilityLevel;
  currentWorkload: number;
  maxWorkload: number;
  availableCapacity: number;
  canAcceptAssignment: boolean;
  isCurrentlyAssigned: boolean;
}

/**
 * Class option for assignment selection
 */
export interface ClassOption {
  id: number;
  name: string;
  displayName: string;
  grade: number | null;
  periodsPerWeek: number;
  currentTeacherId: number | null;
  currentTeacherName: string | null;
  isAssigned: boolean;
}

/**
 * Subject option for assignment selection
 */
export interface SubjectOption {
  id: number;
  name: string;
  periodsPerWeek: number;
  classesRequiring: number;
  classesAssigned: number;
  coveragePercentage: number;
}

/**
 * Options for the unified assignment hook
 */
export interface UseUnifiedAssignmentOptions {
  /** Pre-selected teacher ID (for teacher-centric view) */
  teacherId?: number;
  /** Pre-selected subject ID (for subject-centric view) */
  subjectId?: number;
  /** Pre-selected class ID (for class-centric view) */
  classId?: number;
}

/**
 * Result of the unified assignment hook
 */
export interface UseUnifiedAssignmentResult {
  // Data
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassGroup[];

  // Computed options based on context
  teacherOptions: TeacherOption[];
  classOptions: ClassOption[];
  subjectOptions: SubjectOption[];

  // Current selection info
  selectedTeacher: Teacher | null;
  selectedSubject: Subject | null;
  selectedClass: ClassGroup | null;

  // Workload calculation
  calculateTeacherWorkload: (teacherId: number) => TeacherWorkload;
  getTeacherCompatibility: (teacherId: number, subjectId: number) => TeacherCompatibilityLevel;

  // Assignment operations
  assign: (params: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
    periodsPerWeek: number;
  }) => Promise<{ success: boolean; conflicts: AssignmentConflict[] }>;

  unassign: (params: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
  }) => Promise<{ success: boolean }>;

  validate: (params: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
    periodsPerWeek: number;
  }) => Promise<{
    isValid: boolean;
    conflicts: AssignmentConflict[];
    warnings: AssignmentConflict[];
  }>;

  // Mutation states
  isAssigning: boolean;
  isUnassigning: boolean;
  isValidating: boolean;
  isLoading: boolean;

  // Utility functions
  getAssignmentInfo: (
    teacherId: number,
    subjectId: number,
    classId: number
  ) => AssignmentInfo | null;
  getClassesForTeacherSubject: (teacherId: number, subjectId: number) => ClassOption[];
  getTeachersForSubjectClass: (subjectId: number, classId: number) => TeacherOption[];
  invalidateAllCaches: () => void;

  // Error state
  error: Error | null;
}

// ============================================================================
// Constants
// ============================================================================

const NEAR_CAPACITY_THRESHOLD = 5;

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
 * Enhanced to support generalist teachers (empty subject lists)
 */
function getCompatibilityLevel(teacher: Teacher, subjectId: number): TeacherCompatibilityLevel {
  const primaryIds = parseJsonArray<number>(teacher.primarySubjectIds);
  const allowedIds = parseJsonArray<number>(teacher.allowedSubjectIds);

  // Check explicit primary
  if (primaryIds.includes(subjectId)) {
    return 'primary';
  }

  // Check explicit allowed
  if (allowedIds.includes(subjectId)) {
    return 'allowed';
  }

  // Generalist teacher: empty subject lists means can teach anything
  // This is common for primary school teachers
  if (primaryIds.length === 0 && allowedIds.length === 0) {
    return 'allowed'; // Treat as allowed for backward compatibility
  }

  // Not in primary or allowed, but still valid if assigned by admin
  // Primary/allowed are solver preferences, not hard restrictions
  return 'allowed';
}

/**
 * Determine workload status
 */
function determineWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
  if (maxPeriods <= 0) return 'underloaded';

  const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
  const remainingCapacity = maxPeriods - totalPeriods;

  if (totalPeriods > maxPeriods) return 'overloaded';
  if (remainingCapacity <= NEAR_CAPACITY_THRESHOLD) return 'near_capacity';
  if (utilizationPercentage >= 50) return 'optimal';
  return 'underloaded';
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useUnifiedAssignment(
  options: UseUnifiedAssignmentOptions = {}
): UseUnifiedAssignmentResult {
  const { teacherId, subjectId, classId } = options;

  const queryClient = useQueryClient();

  // Fetch base data
  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const { data: subjects = [], isLoading: isLoadingSubjects, error: subjectsError } = useSubjects();
  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();
  // REAL-TIME FIX: Use useTeacherAssignments for real-time assignment data
  const {
    data: allAssignments = [],
    isLoading: isLoadingAssignments,
    error: assignmentsError,
  } = useTeacherAssignments();

  // Mutations
  const assignMutation = useAssignTeacher();
  const unassignMutation = useUnassignTeacher();
  const validateMutation = useValidateAssignment();

  // Selected entities
  const selectedTeacher = useMemo(
    () => (teacherId ? (teachers.find((t) => t.id === teacherId) ?? null) : null),
    [teacherId, teachers]
  );

  const selectedSubject = useMemo(
    () => (subjectId ? (subjects.find((s) => s.id === subjectId) ?? null) : null),
    [subjectId, subjects]
  );

  const selectedClass = useMemo(
    () => (classId ? (classes.find((c) => c.id === classId) ?? null) : null),
    [classId, classes]
  );

  // Calculate teacher workload - REAL-TIME FIX: Use assignments table
  const calculateTeacherWorkload = useCallback(
    (tId: number): TeacherWorkload => {
      const teacher = teachers.find((t) => t.id === tId);
      if (!teacher) {
        return {
          teacherId: tId,
          totalPeriods: 0,
          maxPeriods: 0,
          utilizationPercentage: 0,
          breakdown: [],
          status: 'underloaded',
          remainingCapacity: 0,
        };
      }

      // REAL-TIME FIX: Get assignments from the assignments table
      const teacherAssignments = allAssignments.filter((a) => a.teacherId === tId && !a.isDeleted);

      // Group by subject for breakdown
      const subjectMap = new Map<number, { classIds: number[]; totalPeriods: number }>();
      for (const assignment of teacherAssignments) {
        const existing = subjectMap.get(assignment.subjectId) || {
          classIds: [],
          totalPeriods: 0,
        };
        existing.classIds.push(assignment.classId);
        existing.totalPeriods += assignment.periodsPerWeek;
        subjectMap.set(assignment.subjectId, existing);
      }

      const breakdown: WorkloadBreakdown[] = [];
      let totalPeriods = 0;

      for (const [sId, data] of subjectMap) {
        const subject = subjects.find((s) => s.id === sId);
        breakdown.push({
          subjectId: sId,
          subjectName: subject?.name || `Subject ${sId}`,
          classIds: data.classIds,
          periodsPerWeek: subject?.periodsPerWeek || 0,
          totalPeriods: data.totalPeriods,
        });
        totalPeriods += data.totalPeriods;
      }

      const maxPeriods = teacher.maxPeriodsPerWeek;
      const utilizationPercentage = maxPeriods > 0 ? (totalPeriods / maxPeriods) * 100 : 0;
      const remainingCapacity = maxPeriods - totalPeriods;
      const status = determineWorkloadStatus(totalPeriods, maxPeriods);

      return {
        teacherId: tId,
        totalPeriods,
        maxPeriods,
        utilizationPercentage,
        breakdown,
        status,
        remainingCapacity,
      };
    },
    [teachers, subjects, allAssignments]
  );

  // Get teacher compatibility
  const getTeacherCompatibility = useCallback(
    (tId: number, sId: number): TeacherCompatibilityLevel => {
      const teacher = teachers.find((t) => t.id === tId);
      if (!teacher) return 'incompatible';
      return getCompatibilityLevel(teacher, sId);
    },
    [teachers]
  );

  // Teacher options (filtered by subject if provided)
  // Now includes ALL teachers, sorted by compatibility
  const teacherOptions = useMemo((): TeacherOption[] => {
    return (
      teachers
        .filter((t) => !t.isDeleted)
        .map((teacher) => {
          const compatibility = subjectId ? getCompatibilityLevel(teacher, subjectId) : 'primary';
          const workload = calculateTeacherWorkload(teacher.id);

          // Check if currently assigned to the selected class+subject
          let isCurrentlyAssigned = false;
          if (classId && subjectId) {
            const assignments = parseJsonArray<ParsedClassAssignment>(teacher.classAssignments);
            const assignment = assignments.find((a) => a.subjectId === subjectId);
            isCurrentlyAssigned = assignment?.classIds.includes(classId) ?? false;
          }

          return {
            id: teacher.id,
            name: teacher.fullName,
            compatibility,
            currentWorkload: workload.totalPeriods,
            maxWorkload: workload.maxPeriods,
            availableCapacity: workload.remainingCapacity,
            canAcceptAssignment: workload.remainingCapacity > 0,
            isCurrentlyAssigned,
          };
        })
        // No longer filter out incompatible - show ALL teachers
        .sort((a, b) => {
          // Sort by: can accept > compatibility (primary > allowed > incompatible) > capacity
          if (a.canAcceptAssignment !== b.canAcceptAssignment) {
            return a.canAcceptAssignment ? -1 : 1;
          }
          // Compatibility order: primary > allowed > incompatible
          const compatOrder = { primary: 0, allowed: 1, incompatible: 2 };
          const aOrder = compatOrder[a.compatibility] ?? 2;
          const bOrder = compatOrder[b.compatibility] ?? 2;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return b.availableCapacity - a.availableCapacity;
        })
    );
  }, [teachers, subjectId, classId, calculateTeacherWorkload]);

  // Class options (filtered by subject if provided) - REAL-TIME FIX: Use assignments table
  const classOptions = useMemo((): ClassOption[] => {
    return classes
      .filter((c) => !c.isDeleted)
      .map((classGroup) => {
        const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
        const requirement = subjectId ? requirements.find((r) => r.subjectId === subjectId) : null;

        // REAL-TIME FIX: Get current teacher from assignments table
        let currentTeacherId: number | null = null;
        let currentTeacherName: string | null = null;

        if (subjectId) {
          const classSubjectAssignment = allAssignments.find(
            (a) => a.classId === classGroup.id && a.subjectId === subjectId && !a.isDeleted
          );
          if (classSubjectAssignment) {
            currentTeacherId = classSubjectAssignment.teacherId;
            const teacher = teachers.find((t) => t.id === currentTeacherId);
            currentTeacherName = teacher?.fullName ?? null;
          }
        }

        return {
          id: classGroup.id,
          name: classGroup.name,
          displayName: classGroup.displayName || classGroup.name,
          grade: classGroup.grade,
          periodsPerWeek: requirement?.periodsPerWeek || 0,
          currentTeacherId,
          currentTeacherName,
          isAssigned: !!currentTeacherId,
        };
      })
      .filter((c) => !subjectId || c.periodsPerWeek > 0) // Only show classes that require the subject
      .sort((a, b) => {
        // Sort by grade, then by name
        if (a.grade !== b.grade) return (a.grade || 0) - (b.grade || 0);
        return a.displayName.localeCompare(b.displayName);
      });
  }, [classes, teachers, subjectId, allAssignments]);

  // Subject options (filtered by teacher if provided) - REAL-TIME FIX: Use assignments table
  const subjectOptions = useMemo((): SubjectOption[] => {
    return subjects
      .filter((s) => !s.isDeleted)
      .map((subject) => {
        // Count classes requiring this subject
        let classesRequiring = 0;
        let classesAssigned = 0;

        for (const classGroup of classes) {
          const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
          const requirement = requirements.find((r) => r.subjectId === subject.id);
          if (requirement) {
            classesRequiring++;
            // REAL-TIME FIX: Check assignments table for assignment status
            const hasAssignment = allAssignments.some(
              (a) => a.classId === classGroup.id && a.subjectId === subject.id && !a.isDeleted
            );
            if (hasAssignment) {
              classesAssigned++;
            }
          }
        }

        const coveragePercentage =
          classesRequiring > 0 ? Math.round((classesAssigned / classesRequiring) * 100) : 0;

        return {
          id: subject.id,
          name: subject.name,
          periodsPerWeek: subject.periodsPerWeek ?? 0,
          classesRequiring,
          classesAssigned,
          coveragePercentage,
        };
      })
      .filter((s) => {
        // If teacher is selected, only show subjects they can teach
        if (teacherId) {
          const teacher = teachers.find((t) => t.id === teacherId);
          if (teacher) {
            const compatibility = getCompatibilityLevel(teacher, s.id);
            return compatibility !== 'incompatible';
          }
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subjects, classes, teachers, teacherId, allAssignments]);

  // Get assignment info for a specific combination - REAL-TIME FIX: Use assignments table
  const getAssignmentInfo = useCallback(
    (tId: number, sId: number, cId: number): AssignmentInfo | null => {
      const teacher = teachers.find((t) => t.id === tId);
      const subject = subjects.find((s) => s.id === sId);
      const classGroup = classes.find((c) => c.id === cId);

      if (!teacher || !subject || !classGroup) return null;

      const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
      const requirement = requirements.find((r) => r.subjectId === sId);

      // REAL-TIME FIX: Check assignments table for assignment status
      const assignment = allAssignments.find(
        (a) => a.teacherId === tId && a.subjectId === sId && a.classId === cId && !a.isDeleted
      );
      const isAssigned = !!assignment;
      const compatibility = getCompatibilityLevel(teacher, sId);

      return {
        teacherId: tId,
        teacherName: teacher.fullName,
        subjectId: sId,
        subjectName: subject.name,
        classId: cId,
        className: classGroup.displayName || classGroup.name,
        periodsPerWeek:
          assignment?.periodsPerWeek || requirement?.periodsPerWeek || subject.periodsPerWeek || 0,
        status: isAssigned ? 'assigned' : 'unassigned',
        compatibility,
      };
    },
    [teachers, subjects, classes, allAssignments]
  );

  // Get classes for a teacher-subject combination - REAL-TIME FIX: Use assignments table
  const getClassesForTeacherSubject = useCallback(
    (tId: number, sId: number): ClassOption[] => {
      const teacher = teachers.find((t) => t.id === tId);
      if (!teacher) return [];

      // REAL-TIME FIX: Get assigned class IDs from assignments table
      const teacherSubjectAssignments = allAssignments.filter(
        (a) => a.teacherId === tId && a.subjectId === sId && !a.isDeleted
      );
      const assignedClassIds = teacherSubjectAssignments.map((a) => a.classId);

      return classes
        .filter((c) => !c.isDeleted)
        .map((classGroup) => {
          const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
          const requirement = requirements.find((r) => r.subjectId === sId);

          if (!requirement) return null;

          // REAL-TIME FIX: Get current teacher from assignments table
          const classSubjectAssignment = allAssignments.find(
            (a) => a.classId === classGroup.id && a.subjectId === sId && !a.isDeleted
          );
          const currentTeacherId = classSubjectAssignment?.teacherId ?? null;
          const currentTeacher = currentTeacherId
            ? teachers.find((t) => t.id === currentTeacherId)
            : null;

          return {
            id: classGroup.id,
            name: classGroup.name,
            displayName: classGroup.displayName || classGroup.name,
            grade: classGroup.grade,
            periodsPerWeek: requirement.periodsPerWeek,
            currentTeacherId,
            currentTeacherName: currentTeacher?.fullName ?? null,
            isAssigned: assignedClassIds.includes(classGroup.id),
          };
        })
        .filter((c): c is ClassOption => c !== null);
    },
    [teachers, classes, allAssignments]
  );

  // Get teachers for a subject-class combination - REAL-TIME FIX: Use assignments table
  const getTeachersForSubjectClass = useCallback(
    (sId: number, cId: number): TeacherOption[] => {
      const classGroup = classes.find((c) => c.id === cId);
      if (!classGroup) return [];

      // REAL-TIME FIX: Get current assignment from assignments table
      const currentAssignment = allAssignments.find(
        (a) => a.classId === cId && a.subjectId === sId && !a.isDeleted
      );

      const result: TeacherOption[] = [];

      for (const teacher of teachers) {
        if (teacher.isDeleted) continue;

        // Include ALL teachers - primary/allowed are preferences, not restrictions
        const compatibility = getCompatibilityLevel(teacher, sId);

        const workload = calculateTeacherWorkload(teacher.id);
        // REAL-TIME FIX: Check assignments table for current assignment
        const isCurrentlyAssigned = currentAssignment?.teacherId === teacher.id;

        result.push({
          id: teacher.id,
          name: teacher.fullName,
          compatibility,
          currentWorkload: workload.totalPeriods,
          maxWorkload: workload.maxPeriods,
          availableCapacity: workload.remainingCapacity,
          canAcceptAssignment: workload.remainingCapacity > 0,
          isCurrentlyAssigned,
        });
      }

      return result.sort((a, b) => {
        if (a.isCurrentlyAssigned) return -1;
        if (b.isCurrentlyAssigned) return 1;
        if (a.compatibility === 'primary' && b.compatibility !== 'primary') return -1;
        if (a.compatibility !== 'primary' && b.compatibility === 'primary') return 1;
        return b.availableCapacity - a.availableCapacity;
      });
    },
    [teachers, classes, calculateTeacherWorkload, allAssignments]
  );

  // Invalidate all related caches using centralized function
  const invalidateAllCaches = useCallback(() => {
    invalidateAssignmentCaches(queryClient);
  }, [queryClient]);

  // Assignment operation
  const assign = useCallback(
    async (params: {
      teacherId: number;
      subjectId: number;
      classIds: number[];
      periodsPerWeek: number;
    }) => {
      console.log('[useUnifiedAssignment] assign called with params:', params);

      try {
        const result = await assignMutation.mutateAsync(params);
        console.log('[useUnifiedAssignment] assign mutation result:', result);
        return {
          success: result.success,
          conflicts: result.conflicts || [],
        };
      } catch (error) {
        console.error('[useUnifiedAssignment] assign mutation error:', error);
        throw error;
      }
    },
    [assignMutation]
  );

  // Unassignment operation
  const unassign = useCallback(
    async (params: { teacherId: number; subjectId: number; classIds: number[] }) => {
      await unassignMutation.mutateAsync(params);
      return { success: true };
    },
    [unassignMutation]
  );

  // Validation operation
  const validate = useCallback(
    async (params: {
      teacherId: number;
      subjectId: number;
      classIds: number[];
      periodsPerWeek: number;
    }) => {
      const result = await validateMutation.mutateAsync(params);
      return {
        isValid: result.isValid,
        conflicts: result.conflicts || [],
        warnings: result.warnings || [],
      };
    },
    [validateMutation]
  );

  return {
    // Data
    teachers,
    subjects,
    classes,

    // Computed options
    teacherOptions,
    classOptions,
    subjectOptions,

    // Selected entities
    selectedTeacher,
    selectedSubject,
    selectedClass,

    // Workload
    calculateTeacherWorkload,
    getTeacherCompatibility,

    // Operations
    assign,
    unassign,
    validate,

    // Mutation states
    isAssigning: assignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
    isValidating: validateMutation.isPending,
    isLoading: isLoadingTeachers || isLoadingSubjects || isLoadingClasses || isLoadingAssignments,

    // Utilities
    getAssignmentInfo,
    getClassesForTeacherSubject,
    getTeachersForSubjectClass,
    invalidateAllCaches,

    // Error
    error: teachersError || subjectsError || classesError || assignmentsError || null,
  };
}

export default useUnifiedAssignment;
