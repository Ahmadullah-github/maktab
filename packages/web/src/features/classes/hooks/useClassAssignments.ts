/**
 * useClassAssignments Hook
 *
 * Provides CRUD operations for class subject-teacher assignments with
 * TanStack Query integration, cache invalidation, optimistic updates,
 * and bidirectional updates.
 *
 * Enhanced for Phase 3.5: Multi-teacher assignment support
 *
 * Requirements: 3.5, 8.4, 8.5
 */

import { invalidateAssignmentCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { assignmentsApi } from '../../assignments/hooks/useAssignmentMutations';
import { teacherAssignmentsApi } from '../../teacher-assignments/api';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { classesApi } from '../api';
import type { ClassGroup, SubjectRequirement } from '../types';
import { logger } from '../utils/logger';
import { CLASSES_QUERY_KEY } from './useClasses';

/**
 * Safely parse JSON array from string or return as-is if already an array
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
 * Ensure subjectRequirements is always an array
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  return parseJsonArray<SubjectRequirement>(requirements);
}

function getRequiredPeriods(
  requirements: SubjectRequirement[] | string | null | undefined,
  subjectId: number
): number {
  return ensureSubjectRequirements(requirements).find((req) => req.subjectId === subjectId)
    ?.periodsPerWeek ?? 1;
}

/**
 * Options for the useClassAssignments hook
 */
export interface UseClassAssignmentsOptions {
  /** Enable optimistic updates for better UX */
  enableOptimisticUpdates?: boolean;
  /** Callback when assignment changes */
  onAssignmentChange?: (classId: number, requirements: SubjectRequirement[]) => void;
}

/**
 * Hook for managing class subject-teacher assignments
 *
 * Provides functions to assign, unassign, and update teacher assignments
 * for class subject requirements with automatic cache invalidation,
 * optimistic updates, and bidirectional updates.
 *
 * Requirements: 3.5, 8.4, 8.5
 *
 * @param options - Configuration options
 * @returns Object with assignment mutation functions
 */
export function useClassAssignments(options: UseClassAssignmentsOptions = {}) {
  const { enableOptimisticUpdates = true, onAssignmentChange } = options;
  const queryClient = useQueryClient();

  /**
   * Invalidate all related caches using centralized function
   * for cross-feature consistency
   */
  const invalidateCaches = () => {
    invalidateAssignmentCaches(queryClient);
  };

  /**
   * Apply optimistic update to class in cache
   */
  const applyOptimisticUpdate = (classId: number, updatedRequirements: SubjectRequirement[]) => {
    if (!enableOptimisticUpdates) return;

    queryClient.setQueryData<ClassGroup[]>(QUERY_KEYS.classes, (oldClasses) => {
      if (!oldClasses) return oldClasses;

      return oldClasses.map((classGroup) => {
        if (classGroup.id !== classId) return classGroup;
        return { ...classGroup, subjectRequirements: updatedRequirements };
      });
    });

    // Trigger callback for real-time sync
    if (onAssignmentChange) {
      onAssignmentChange(classId, updatedRequirements);
    }
  };

  /**
   * Revert optimistic update on error
   */
  const revertOptimisticUpdate = (classId: number, previousRequirements: SubjectRequirement[]) => {
    if (!enableOptimisticUpdates) return;

    queryClient.setQueryData<ClassGroup[]>(CLASSES_QUERY_KEY, (oldClasses) => {
      if (!oldClasses) return oldClasses;

      return oldClasses.map((classGroup) => {
        if (classGroup.id !== classId) return classGroup;
        return { ...classGroup, subjectRequirements: previousRequirements };
      });
    });
  };

  /**
   * Assign a teacher to a subject in a class
   * Requirements: 3.5, 8.4, 8.5
   */
  const assignTeacher = useMutation({
    mutationFn: async ({
      classId,
      classData,
      subjectId,
      teacherId,
    }: {
      classId: number;
      classData: ClassGroup;
      subjectId: number;
      teacherId: number;
    }) => {
      const requirements = ensureSubjectRequirements(classData.subjectRequirements);
      const currentAssignments = await teacherAssignmentsApi.getByClassAndSubject(classId, subjectId);
      const currentTeacherIds = Array.from(
        new Set(currentAssignments.map((assignment) => assignment.teacherId))
      );

      await Promise.all(
        currentTeacherIds
          .filter((currentTeacherId) => currentTeacherId !== teacherId)
          .map((currentTeacherId) =>
            assignmentsApi.unassign({
              teacherId: currentTeacherId,
              subjectId,
              classIds: [classId],
            })
          )
      );

      if (!currentTeacherIds.includes(teacherId)) {
        await assignmentsApi.assign({
          teacherId,
          subjectId,
          classIds: [classId],
          periodsPerWeek: getRequiredPeriods(requirements, subjectId),
        });
      }
    },
    onSuccess: (_data, variables) => {
      logger.debug('Teacher assigned to subject in class', {
        classId: variables.classId,
        subjectId: variables.subjectId,
        teacherId: variables.teacherId,
      });
      invalidateCaches();
      toast.success('معلم با موفقیت تخصیص یافت', {
        description: 'تخصیص معلم به مضمون انجام شد',
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to assign teacher', { error: error.message });
      // Revert optimistic update
      const requirements = ensureSubjectRequirements(variables.classData.subjectRequirements);
      revertOptimisticUpdate(variables.classId, requirements);
      toast.error('خطا در تخصیص معلم', {
        description: error.message,
      });
    },
  });

  /**
   * Unassign a teacher from a subject in a class
   * Requirements: 3.5, 8.4, 8.5
   */
  const unassignTeacher = useMutation({
    mutationFn: async ({
      classId,
      classData: _classData,
      subjectId,
    }: {
      classId: number;
      classData: ClassGroup;
      subjectId: number;
    }) => {
      const currentAssignments = await teacherAssignmentsApi.getByClassAndSubject(classId, subjectId);

      await Promise.all(
        currentAssignments.map((assignment) =>
          assignmentsApi.unassign({
            teacherId: assignment.teacherId,
            subjectId,
            classIds: [classId],
          })
        )
      );
    },
    onSuccess: (_data, variables) => {
      logger.debug('Teacher unassigned from subject in class', {
        classId: variables.classId,
        subjectId: variables.subjectId,
      });
      invalidateCaches();
      toast.success('تخصیص معلم حذف شد');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to unassign teacher', { error: error.message });
      // Revert optimistic update
      const requirements = ensureSubjectRequirements(variables.classData.subjectRequirements);
      revertOptimisticUpdate(variables.classId, requirements);
      toast.error('خطا در حذف تخصیص', {
        description: error.message,
      });
    },
  });

  /**
   * Update all subject requirements for a class (bulk update)
   * Requirements: 3.5, 8.4, 8.5
   */
  const updateSubjectRequirements = useMutation({
    mutationFn: async ({
      classId,
      requirements,
      previousRequirements: _previousRequirements,
    }: {
      classId: number;
      requirements: SubjectRequirement[];
      previousRequirements?: SubjectRequirement[];
    }) => {
      // Apply optimistic update immediately
      applyOptimisticUpdate(classId, requirements);

      return classesApi.update(classId, {
        subjectRequirements: requirements,
      });
    },
    onSuccess: (_data, variables) => {
      logger.debug('Subject requirements updated', {
        classId: variables.classId,
        count: variables.requirements.length,
      });
      invalidateCaches();
      toast.success('نیازمندی‌های درسی بروزرسانی شد');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to update subject requirements', { error: error.message });
      // Revert optimistic update if we have previous requirements
      if (variables.previousRequirements) {
        revertOptimisticUpdate(variables.classId, variables.previousRequirements);
      }
      toast.error('خطا در بروزرسانی نیازمندی‌ها', {
        description: error.message,
      });
    },
  });

  /**
   * Add a new subject requirement with optional teacher
   */
  const addSubjectRequirement = useMutation({
    mutationFn: async ({
      classId,
      classData,
      requirement,
    }: {
      classId: number;
      classData: ClassGroup;
      requirement: SubjectRequirement;
    }) => {
      // Ensure subjectRequirements is an array (handles JSON string from cache)
      const requirements = ensureSubjectRequirements(classData.subjectRequirements);
      // Check if subject already exists
      const existingIndex = requirements.findIndex((r) => r.subjectId === requirement.subjectId);

      let updatedRequirements: SubjectRequirement[];

      if (existingIndex >= 0) {
        // Update existing requirement
        updatedRequirements = requirements.map((r, index) =>
          index === existingIndex ? requirement : r
        );
      } else {
        // Add new requirement
        updatedRequirements = [...requirements, requirement];
      }

      // Apply optimistic update immediately
      applyOptimisticUpdate(classId, updatedRequirements);

      return classesApi.update(classId, {
        subjectRequirements: updatedRequirements,
      });
    },
    onSuccess: (_data, variables) => {
      logger.debug('Subject requirement added', {
        classId: variables.classId,
        subjectId: variables.requirement.subjectId,
      });
      invalidateCaches();
      toast.success('مضمون اضافه شد');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to add subject requirement', { error: error.message });
      // Revert optimistic update
      const requirements = ensureSubjectRequirements(variables.classData.subjectRequirements);
      revertOptimisticUpdate(variables.classId, requirements);
      toast.error('خطا در افزودن مضمون', {
        description: error.message,
      });
    },
  });

  /**
   * Remove a subject requirement from a class
   */
  const removeSubjectRequirement = useMutation({
    mutationFn: async ({
      classId,
      classData,
      subjectId,
    }: {
      classId: number;
      classData: ClassGroup;
      subjectId: number;
    }) => {
      // Ensure subjectRequirements is an array (handles JSON string from cache)
      const requirements = ensureSubjectRequirements(classData.subjectRequirements);
      const updatedRequirements = requirements.filter((r) => r.subjectId !== subjectId);

      // Apply optimistic update immediately
      applyOptimisticUpdate(classId, updatedRequirements);

      return classesApi.update(classId, {
        subjectRequirements: updatedRequirements,
      });
    },
    onSuccess: (_data, variables) => {
      logger.debug('Subject requirement removed', {
        classId: variables.classId,
        subjectId: variables.subjectId,
      });
      invalidateCaches();
      toast.success('مضمون حذف شد');
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to remove subject requirement', { error: error.message });
      // Revert optimistic update
      const requirements = ensureSubjectRequirements(variables.classData.subjectRequirements);
      revertOptimisticUpdate(variables.classId, requirements);
      toast.error('خطا در حذف مضمون', {
        description: error.message,
      });
    },
  });

  /**
   * Bulk assign teachers to multiple subjects in a class
   */
  const bulkAssignTeachers = useMutation({
    mutationFn: async ({
      classId,
      classData,
      assignments,
    }: {
      classId: number;
      classData: ClassGroup;
      assignments: Array<{ subjectId: number; teacherId: number | null }>;
    }) => {
      const requirements = ensureSubjectRequirements(classData.subjectRequirements);

      for (const { subjectId, teacherId } of assignments) {
        const currentAssignments = await teacherAssignmentsApi.getByClassAndSubject(classId, subjectId);
        const currentTeacherIds = Array.from(
          new Set(currentAssignments.map((assignment) => assignment.teacherId))
        );

        await Promise.all(
          currentTeacherIds
            .filter((currentTeacherId) => teacherId === null || currentTeacherId !== teacherId)
            .map((currentTeacherId) =>
              assignmentsApi.unassign({
                teacherId: currentTeacherId,
                subjectId,
                classIds: [classId],
              })
            )
        );

        if (teacherId !== null && !currentTeacherIds.includes(teacherId)) {
          await assignmentsApi.assign({
            teacherId,
            subjectId,
            classIds: [classId],
            periodsPerWeek: getRequiredPeriods(requirements, subjectId),
          });
        }
      }
    },
    onSuccess: (_data, variables) => {
      logger.debug('Bulk teacher assignments completed', {
        classId: variables.classId,
        count: variables.assignments.length,
      });
      invalidateCaches();
      toast.success('تخصیص‌های معلمان بروزرسانی شد', {
        description: `${variables.assignments.length} تخصیص انجام شد`,
      });
    },
    onError: (error: Error, variables) => {
      logger.error('Failed to bulk assign teachers', { error: error.message });
      // Revert optimistic update
      const requirements = ensureSubjectRequirements(variables.classData.subjectRequirements);
      revertOptimisticUpdate(variables.classId, requirements);
      toast.error('خطا در تخصیص معلمان', {
        description: error.message,
      });
    },
  });

  return {
    assignTeacher,
    unassignTeacher,
    updateSubjectRequirements,
    addSubjectRequirement,
    removeSubjectRequirement,
    bulkAssignTeachers,
    isLoading:
      assignTeacher.isPending ||
      unassignTeacher.isPending ||
      updateSubjectRequirements.isPending ||
      addSubjectRequirement.isPending ||
      removeSubjectRequirement.isPending ||
      bulkAssignTeachers.isPending,
  };
}

export default useClassAssignments;

// ============================================================================
// Multi-Teacher Assignment Query Hook (Phase 3.5)
// ============================================================================

/**
 * Summary of assignments for a subject in a class
 */
export interface SubjectAssignmentSummary {
  subjectId: number;
  totalAssignedPeriods: number;
  assignments: TeacherClassSubjectAssignment[];
}

/**
 * Hook for querying multi-teacher assignments for a specific class
 *
 * Provides filtered assignments and grouped data by subject for
 * the new multi-teacher assignment system.
 *
 * @param classId - The class ID to filter assignments for
 * @returns Object with assignments data and computed summaries
 */
export function useClassAssignmentsQuery(classId: number) {
  const { data: allAssignments = [], isLoading, error } = useTeacherAssignments();

  // Filter assignments for this class
  const classAssignments = useMemo(
    () => allAssignments.filter((a: TeacherClassSubjectAssignment) => a.classId === classId),
    [allAssignments, classId]
  );

  // Group assignments by subject
  const assignmentsBySubject = useMemo(() => {
    const grouped = new Map<number, TeacherClassSubjectAssignment[]>();
    for (const a of classAssignments) {
      const existing = grouped.get(a.subjectId) || [];
      grouped.set(a.subjectId, [...existing, a]);
    }
    return grouped;
  }, [classAssignments]);

  // Get summary for each subject
  const subjectSummaries = useMemo((): SubjectAssignmentSummary[] => {
    const summaries: SubjectAssignmentSummary[] = [];
    assignmentsBySubject.forEach((assignments, subjectId) => {
      summaries.push({
        subjectId,
        totalAssignedPeriods: assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0),
        assignments,
      });
    });
    return summaries;
  }, [assignmentsBySubject]);

  // Calculate total assigned periods for the class
  const totalAssignedPeriods = useMemo(
    () => classAssignments.reduce((sum, a) => sum + a.periodsPerWeek, 0),
    [classAssignments]
  );

  // Get assignments for a specific subject
  const getSubjectAssignments = (subjectId: number): TeacherClassSubjectAssignment[] => {
    return assignmentsBySubject.get(subjectId) || [];
  };

  // Get total assigned periods for a specific subject
  const getSubjectAssignedPeriods = (subjectId: number): number => {
    const assignments = getSubjectAssignments(subjectId);
    return assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
  };

  // Check if a subject is fully assigned (given required periods)
  const isSubjectFullyAssigned = (subjectId: number, requiredPeriods: number): boolean => {
    return getSubjectAssignedPeriods(subjectId) >= requiredPeriods;
  };

  return {
    // Raw data
    assignments: classAssignments,
    assignmentsBySubject,
    subjectSummaries,
    totalAssignedPeriods,

    // Helper functions
    getSubjectAssignments,
    getSubjectAssignedPeriods,
    isSubjectFullyAssigned,

    // Query state
    isLoading,
    error,
  };
}
