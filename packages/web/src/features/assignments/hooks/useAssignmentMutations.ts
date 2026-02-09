/**
 * useAssignmentMutations Hook
 *
 * TanStack Query mutations for assignment operations:
 * - Assign teacher to subject-class combinations
 * - Unassign teacher from subject-class combinations
 * - Validate assignment before applying
 *
 * Updated for multi-teacher assignment support using TeacherClassSubjectAssignment API.
 *
 * Requirements: Phase 2.3
 */

import { invalidateAssignmentCaches } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { teacherAssignmentKeys } from '../../teacher-assignments';
import type {
  AssignmentConflict,
  AssignmentOperationResult,
  AssignmentValidationResult,
  AssignTeacherRequest,
  UnassignTeacherRequest,
} from '../types';

// ============================================================================
// API Base URL
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get machine ID from localStorage (for license validation)
 */
function getMachineId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('maktab_machine_id');
  }
  return null;
}

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const machineId = getMachineId();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(machineId ? { 'X-Machine-Id': machineId } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text);
}

/**
 * Assignment API functions
 */
export const assignmentsApi = {
  /**
   * Validate an assignment without making changes
   */
  validate: (data: AssignTeacherRequest): Promise<AssignmentValidationResult> => {
    console.log('[assignmentsApi] validate called with:', data);
    return fetchAPI<AssignmentValidationResult>('/assignments/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then((result) => {
      console.log('[assignmentsApi] validate result:', result);
      return result;
    });
  },

  /**
   * Assign a teacher to subject-class combinations
   */
  assign: (data: AssignTeacherRequest): Promise<AssignmentOperationResult> => {
    console.log('[assignmentsApi] assign called with:', data);
    return fetchAPI<AssignmentOperationResult>('/assignments/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    })
      .then((result) => {
        console.log('[assignmentsApi] assign result:', result);
        return result;
      })
      .catch((error) => {
        console.error('[assignmentsApi] assign error:', error);
        throw error;
      });
  },

  /**
   * Unassign a teacher from subject-class combinations
   */
  unassign: (data: UnassignTeacherRequest): Promise<AssignmentOperationResult> =>
    fetchAPI<AssignmentOperationResult>('/assignments/unassign', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  /**
   * Get teacher workload analysis
   */
  getTeacherWorkload: (teacherId: number) => fetchAPI(`/assignments/teacher/${teacherId}/workload`),

  /**
   * Get subject coverage analysis
   */
  getSubjectCoverage: (subjectId: number) => fetchAPI(`/assignments/subject/${subjectId}/coverage`),

  /**
   * Get all assignment conflicts
   */
  getConflicts: (): Promise<AssignmentConflict[]> =>
    fetchAPI<AssignmentConflict[]>('/assignments/conflicts'),
};

// ============================================================================
// Types
// ============================================================================

export interface UseAssignmentMutationsResult {
  /** Assign teacher mutation */
  assignTeacher: ReturnType<typeof useAssignTeacher>;
  /** Unassign teacher mutation */
  unassignTeacher: ReturnType<typeof useUnassignTeacher>;
  /** Validate assignment mutation */
  validateAssignment: ReturnType<typeof useValidateAssignment>;
  /** Whether any mutation is in progress */
  isLoading: boolean;
}

// ============================================================================
// Individual Mutation Hooks
// ============================================================================

/**
 * Hook for validating an assignment without applying it
 */
export function useValidateAssignment() {
  return useMutation({
    mutationFn: (data: AssignTeacherRequest) => assignmentsApi.validate(data),
    // No cache invalidation needed - validation is read-only
  });
}

// Helper to invalidate all caches using centralized function
function invalidateAllAssignmentCaches(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateAssignmentCaches(queryClient);
}

/**
 * Hook for assigning a teacher to subject-class combinations
 *
 * Phase 4.4: Enhanced with optimistic updates for better UX
 *
 * Invalidates both teachers and classes caches since assignments
 * are stored in both entities.
 */
export function useAssignTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AssignTeacherRequest) => assignmentsApi.assign(data),

    // Optimistic update
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: teacherAssignmentKeys.all });

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData(teacherAssignmentKeys.lists());

      // We can't fully optimistically update here since we don't know the new IDs
      // But we can set a loading state indicator
      return { previousAssignments, variables };
    },

    onSuccess: (result, variables) => {
      const classCount = Array.isArray(variables.classIds) ? variables.classIds.length : 0;

      if (result.success) {
        toast.success('تخصیص با موفقیت انجام شد', {
          description: `${classCount} کلاس تخصیص داده شد`,
        });
      } else {
        // Assignment failed due to conflicts - show error, not warning
        const conflictCount = result.conflicts?.length || 0;
        const conflictMessages = result.conflicts?.map((c) => c.messageFa || c.message).join('\n');
        toast.error('تخصیص انجام نشد', {
          description: conflictMessages || `${conflictCount} تعارض شناسایی شد`,
        });
      }
    },

    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousAssignments) {
        queryClient.setQueryData(teacherAssignmentKeys.lists(), context.previousAssignments);
      }
      toast.error('خطا در تخصیص استاد', {
        description: error.message,
      });
    },

    // Always refetch after error or success
    onSettled: () => {
      invalidateAllAssignmentCaches(queryClient);
    },
  });
}

/**
 * Hook for unassigning a teacher from subject-class combinations
 *
 * Phase 4.4: Enhanced with optimistic updates for better UX
 *
 * Invalidates both teachers and classes caches.
 */
export function useUnassignTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UnassignTeacherRequest) => assignmentsApi.unassign(data),

    // Optimistic update
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: teacherAssignmentKeys.all });

      // Snapshot the previous value
      const previousAssignments = queryClient.getQueryData(teacherAssignmentKeys.lists());

      // Optimistically remove the assignments
      // Note: This is a simplified optimistic update - the actual removal
      // depends on the API response
      return { previousAssignments, variables };
    },

    onSuccess: (_result, variables) => {
      const classCount = Array.isArray(variables.classIds) ? variables.classIds.length : 0;

      toast.success('تخصیص با موفقیت حذف شد', {
        description: `${classCount} کلاس از تخصیص خارج شد`,
      });
    },

    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousAssignments) {
        queryClient.setQueryData(teacherAssignmentKeys.lists(), context.previousAssignments);
      }
      toast.error('خطا در حذف تخصیص', {
        description: error.message,
      });
    },

    // Always refetch after error or success
    onSettled: () => {
      invalidateAllAssignmentCaches(queryClient);
    },
  });
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * Combined hook providing all assignment mutations
 *
 * Usage:
 * ```tsx
 * const { assignTeacher, unassignTeacher, validateAssignment, isLoading } = useAssignmentMutations();
 *
 * // Validate before assigning
 * const validation = await validateAssignment.mutateAsync({
 *   teacherId: 1,
 *   subjectId: 2,
 *   classIds: [3, 4, 5],
 *   periodsPerWeek: 4,
 * });
 *
 * if (validation.isValid) {
 *   await assignTeacher.mutateAsync({
 *     teacherId: 1,
 *     subjectId: 2,
 *     classIds: [3, 4, 5],
 *     periodsPerWeek: 4,
 *   });
 * }
 * ```
 */
export function useAssignmentMutations(): UseAssignmentMutationsResult {
  const assignTeacher = useAssignTeacher();
  const unassignTeacher = useUnassignTeacher();
  const validateAssignment = useValidateAssignment();

  const isLoading =
    assignTeacher.isPending || unassignTeacher.isPending || validateAssignment.isPending;

  return {
    assignTeacher,
    unassignTeacher,
    validateAssignment,
    isLoading,
  };
}

export default useAssignmentMutations;
