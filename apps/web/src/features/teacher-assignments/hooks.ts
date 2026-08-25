/**
 * TanStack Query hooks for Teacher-Class-Subject Assignments
 *
 * Phase 4.4: Enhanced with optimistic updates for better UX
 */

import { invalidateAssignmentCaches } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { teacherAssignmentsApi } from './api';
import type {
  CreateTeacherAssignmentInput,
  TeacherClassSubjectAssignment,
  UpdateTeacherAssignmentInput,
} from './types';

// Query keys
export const teacherAssignmentKeys = {
  all: ['teacher-assignments'] as const,
  lists: () => [...teacherAssignmentKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...teacherAssignmentKeys.lists(), filters] as const,
  byClass: (classId: number) => [...teacherAssignmentKeys.all, 'class', classId] as const,
  byTeacher: (teacherId: number) => [...teacherAssignmentKeys.all, 'teacher', teacherId] as const,
  byClassAndSubject: (classId: number, subjectId: number) =>
    [...teacherAssignmentKeys.all, 'class', classId, 'subject', subjectId] as const,
  summary: (classId: number, subjectId: number) =>
    [...teacherAssignmentKeys.all, 'summary', classId, subjectId] as const,
  detail: (id: number) => [...teacherAssignmentKeys.all, 'detail', id] as const,
};

// ============================================================================
// Helper: Invalidate all related caches using centralized function
// ============================================================================

function invalidateAllCaches(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateAssignmentCaches(queryClient);
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all teacher assignments
 */
export function useTeacherAssignments() {
  return useQuery({
    queryKey: teacherAssignmentKeys.lists(),
    queryFn: () => teacherAssignmentsApi.getAll(),
  });
}

/**
 * Hook to fetch assignments for a specific class
 */
export function useTeacherAssignmentsByClass(classId: number) {
  return useQuery({
    queryKey: teacherAssignmentKeys.byClass(classId),
    queryFn: () => teacherAssignmentsApi.getByClass(classId),
    enabled: classId > 0,
  });
}

/**
 * Hook to fetch assignments for a specific teacher
 */
export function useTeacherAssignmentsByTeacher(teacherId: number) {
  return useQuery({
    queryKey: teacherAssignmentKeys.byTeacher(teacherId),
    queryFn: () => teacherAssignmentsApi.getByTeacher(teacherId),
    enabled: teacherId > 0,
  });
}

/**
 * Hook to fetch assignments for a specific class-subject pair
 */
export function useTeacherAssignmentsByClassAndSubject(classId: number, subjectId: number) {
  return useQuery({
    queryKey: teacherAssignmentKeys.byClassAndSubject(classId, subjectId),
    queryFn: () => teacherAssignmentsApi.getByClassAndSubject(classId, subjectId),
    enabled: classId > 0 && subjectId > 0,
  });
}

/**
 * Hook to fetch assignment summary for a class-subject pair
 */
export function useAssignmentSummary(classId: number, subjectId: number) {
  return useQuery({
    queryKey: teacherAssignmentKeys.summary(classId, subjectId),
    queryFn: () => teacherAssignmentsApi.getSummary(classId, subjectId),
    enabled: classId > 0 && subjectId > 0,
  });
}

// ============================================================================
// Mutation Hooks with Optimistic Updates
// ============================================================================

/**
 * Hook to create a new teacher assignment with optimistic update
 */
export function useCreateTeacherAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeacherAssignmentInput) => teacherAssignmentsApi.create(data),

    // Optimistic update
    onMutate: async (newAssignment) => {
      // Cancel any outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: teacherAssignmentKeys.lists() });

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData<TeacherClassSubjectAssignment[]>(
        teacherAssignmentKeys.lists()
      );

      // Optimistically add the new assignment with a temporary ID
      if (previousAssignments) {
        const optimisticAssignment: TeacherClassSubjectAssignment = {
          id: -Date.now(), // Temporary negative ID
          teacherId: newAssignment.teacherId,
          classId: newAssignment.classId,
          subjectId: newAssignment.subjectId,
          periodsPerWeek: newAssignment.periodsPerWeek,
          isFixed: newAssignment.isFixed ?? false,
          schoolId: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<TeacherClassSubjectAssignment[]>(teacherAssignmentKeys.lists(), [
          ...previousAssignments,
          optimisticAssignment,
        ]);
      }

      // Return context with previous value for rollback
      return { previousAssignments };
    },

    // Rollback on error
    onError: (err, _newAssignment, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(teacherAssignmentKeys.lists(), context.previousAssignments);
      }
      toast.error('خطا در ایجاد تخصیص', {
        description: err instanceof Error ? err.message : 'خطای ناشناخته',
      });
    },

    // Always refetch after error or success
    onSettled: () => {
      invalidateAllCaches(queryClient);
    },

    onSuccess: () => {
      toast.success('تخصیص با موفقیت ایجاد شد');
    },
  });
}

/**
 * Hook to bulk create teacher assignments with optimistic update
 */
export function useBulkCreateTeacherAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignments: CreateTeacherAssignmentInput[]) =>
      teacherAssignmentsApi.bulkCreate(assignments),

    // Optimistic update
    onMutate: async (newAssignments) => {
      await queryClient.cancelQueries({ queryKey: teacherAssignmentKeys.lists() });

      const previousAssignments = queryClient.getQueryData<TeacherClassSubjectAssignment[]>(
        teacherAssignmentKeys.lists()
      );

      if (previousAssignments) {
        const optimisticAssignments: TeacherClassSubjectAssignment[] = newAssignments.map(
          (a, index) => ({
            id: -(Date.now() + index), // Temporary negative IDs
            teacherId: a.teacherId,
            classId: a.classId,
            subjectId: a.subjectId,
            periodsPerWeek: a.periodsPerWeek,
            isFixed: a.isFixed ?? false,
            schoolId: null,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        );

        queryClient.setQueryData<TeacherClassSubjectAssignment[]>(teacherAssignmentKeys.lists(), [
          ...previousAssignments,
          ...optimisticAssignments,
        ]);
      }

      return { previousAssignments };
    },

    onError: (err, _newAssignments, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(teacherAssignmentKeys.lists(), context.previousAssignments);
      }
      toast.error('خطا در ایجاد تخصیص‌ها', {
        description: err instanceof Error ? err.message : 'خطای ناشناخته',
      });
    },

    onSettled: () => {
      invalidateAllCaches(queryClient);
    },

    onSuccess: (_, variables) => {
      toast.success('تخصیص‌ها با موفقیت ایجاد شدند', {
        description: `${variables.length} تخصیص ایجاد شد`,
      });
    },
  });
}

/**
 * Hook to update a teacher assignment with optimistic update
 */
export function useUpdateTeacherAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTeacherAssignmentInput }) =>
      teacherAssignmentsApi.update(id, data),

    // Optimistic update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: teacherAssignmentKeys.lists() });

      const previousAssignments = queryClient.getQueryData<TeacherClassSubjectAssignment[]>(
        teacherAssignmentKeys.lists()
      );

      if (previousAssignments) {
        queryClient.setQueryData<TeacherClassSubjectAssignment[]>(
          teacherAssignmentKeys.lists(),
          previousAssignments.map((assignment) =>
            assignment.id === id
              ? {
                  ...assignment,
                  ...data,
                  updatedAt: new Date().toISOString(),
                }
              : assignment
          )
        );
      }

      return { previousAssignments };
    },

    onError: (err, _variables, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(teacherAssignmentKeys.lists(), context.previousAssignments);
      }
      toast.error('خطا در بروزرسانی تخصیص', {
        description: err instanceof Error ? err.message : 'خطای ناشناخته',
      });
    },

    onSettled: () => {
      invalidateAllCaches(queryClient);
    },

    onSuccess: () => {
      toast.success('تخصیص با موفقیت بروزرسانی شد');
    },
  });
}

/**
 * Hook to delete a teacher assignment with optimistic update
 */
export function useDeleteTeacherAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => teacherAssignmentsApi.delete(id),

    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: teacherAssignmentKeys.lists() });

      const previousAssignments = queryClient.getQueryData<TeacherClassSubjectAssignment[]>(
        teacherAssignmentKeys.lists()
      );

      if (previousAssignments) {
        queryClient.setQueryData<TeacherClassSubjectAssignment[]>(
          teacherAssignmentKeys.lists(),
          previousAssignments.filter((assignment) => assignment.id !== id)
        );
      }

      return { previousAssignments };
    },

    onError: (err, _id, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(teacherAssignmentKeys.lists(), context.previousAssignments);
      }
      toast.error('خطا در حذف تخصیص', {
        description: err instanceof Error ? err.message : 'خطای ناشناخته',
      });
    },

    onSettled: () => {
      invalidateAllCaches(queryClient);
    },

    onSuccess: () => {
      toast.success('تخصیص با موفقیت حذف شد');
    },
  });
}

/**
 * Hook to validate an assignment
 */
export function useValidateAssignment() {
  return useMutation({
    mutationFn: ({
      classId,
      subjectId,
      requiredPeriods,
      excludeAssignmentId,
    }: {
      classId: number;
      subjectId: number;
      requiredPeriods: number;
      excludeAssignmentId?: number;
    }) => teacherAssignmentsApi.validate(classId, subjectId, requiredPeriods, excludeAssignmentId),
  });
}
