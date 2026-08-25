/**
 * TanStack Query hooks for Subjects data management
 *
 * Provides hooks for fetching, creating, updating, and deleting subjects
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 1.1, 1.5, 3.4, 3.5, 3.6, 4.5, 4.6, 5.3, 5.4, 9.3, 9.4, 9.5, 10.2, 10.3, 10.4, 11.2
 */

import { invalidateSubjectCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { schoolCurriculumApi } from '@/features/school-curriculum/api';
import { ApiError } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { subjectsApi } from '../api';
import type { SubjectFormValues } from '../types';
import { logger } from '../utils/logger';

/**
 * Query key for subjects data
 * Used for cache management and invalidation
 */
export const SUBJECTS_QUERY_KEY = QUERY_KEYS.subjects;

async function deleteWithCurriculumConfirmation(id: number): Promise<void> {
  try {
    await subjectsApi.delete(id);
  } catch (error) {
    if (!(error instanceof ApiError) || typeof error.payload !== 'object' || !error.payload) {
      throw error;
    }
    const payload = error.payload as {
      code?: string;
      details?: { preview?: { previewToken?: string; assignmentImpacts?: unknown[]; capabilityImpacts?: unknown[] } };
    };
    const preview = payload.details?.preview;
    if (payload.code !== 'CONFIRMATION_REQUIRED' || !preview?.previewToken) throw error;
    const assignmentCount = preview.assignmentImpacts?.length ?? 0;
    const capabilityCount = preview.capabilityImpacts?.length ?? 0;
    if (!window.confirm(`این حذف بر ${assignmentCount} تخصیص و ${capabilityCount} قابلیت استاد اثر می‌گذارد. ادامه می‌دهید؟`)) {
      throw new Error('حذف لغو شد.');
    }
    await schoolCurriculumApi.apply(preview.previewToken, true);
  }
}

async function applySubjectMutationConfirmation(error: unknown): Promise<boolean> {
  if (!(error instanceof ApiError) || typeof error.payload !== 'object' || !error.payload) return false;
  const payload = error.payload as {
    code?: string;
    details?: { preview?: { previewToken?: string; assignmentImpacts?: unknown[]; capabilityImpacts?: unknown[] } };
  };
  const preview = payload.details?.preview;
  if (payload.code !== 'CONFIRMATION_REQUIRED' || !preview?.previewToken) return false;
  if (!window.confirm('این تغییر تخصیص‌ها یا قابلیت‌های وابسته را حذف می‌کند. ادامه می‌دهید؟')) {
    throw new Error('تغییر لغو شد.');
  }
  await schoolCurriculumApi.apply(preview.previewToken, true);
  return true;
}

/**
 * Hook for fetching all subjects
 *
 * @returns Query result with subjects array
 *
 * Requirements: 1.1
 */
export function useSubjects() {
  return useQuery({
    queryKey: SUBJECTS_QUERY_KEY,
    queryFn: subjectsApi.getAll,
  });
}

/**
 * Hook for fetching a single subject by ID
 *
 * @param id - Subject ID to fetch, or null to disable the query
 * @returns Query result with subject data
 *
 * Requirements: 3.4
 */
export function useSubject(id: number | null) {
  return useQuery({
    queryKey: [...SUBJECTS_QUERY_KEY, id],
    queryFn: () => subjectsApi.getById(id!),
    enabled: id !== null,
  });
}

/**
 * Hook for creating a new subject
 *
 * Automatically invalidates the subjects cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with create function
 *
 * Requirements: 4.5, 4.6, 11.2
 */
export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubjectFormValues) => subjectsApi.create(data),
    onSuccess: (newSubject) => {
      logger.debug('Invalidating subject-related caches after create');
      invalidateSubjectCaches(queryClient);
      toast.success('مضمون با موفقیت ایجاد شد', {
        description: newSubject.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to create subject', { error: error.message });
      toast.error('خطا در ایجاد مضمون', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for updating an existing subject
 *
 * Automatically invalidates the subjects cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with update function
 *
 * Requirements: 3.4, 3.5, 3.6, 11.2
 */
export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SubjectFormValues> }) => {
      try {
        return await subjectsApi.update(id, data);
      } catch (error) {
        if (!(await applySubjectMutationConfirmation(error))) throw error;
        return subjectsApi.getById(id);
      }
    },
    onSuccess: (updatedSubject) => {
      logger.debug('Invalidating subject-related caches after update');
      invalidateSubjectCaches(queryClient);
      toast.success('مضمون با موفقیت بروزرسانی شد', {
        description: updatedSubject.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to update subject', { error: error.message });
      toast.error('خطا در بروزرسانی مضمون', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for deleting a subject
 *
 * Automatically invalidates the subjects cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with delete function
 *
 * Requirements: 5.3, 5.4, 11.2
 */
export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWithCurriculumConfirmation,
    onSuccess: () => {
      logger.debug('Invalidating subject-related caches after delete');
      invalidateSubjectCaches(queryClient);
      toast.success('مضمون با موفقیت حذف شد');
    },
    onError: (error: Error) => {
      logger.error('Failed to delete subject', { error: error.message });
      toast.error('خطا در حذف مضمون', {
        description: error.message,
      });
    },
  });
}

export function useBulkDeleteSubjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) await deleteWithCurriculumConfirmation(id);
      return { deleted: ids.length, deletedIds: ids };
    },
    onSuccess: (result) => {
      invalidateSubjectCaches(queryClient);
      toast.success('مضامین با موفقیت حذف شدند', {
        description: `${result.deleted} مضمون برای همیشه حذف شد`,
      });
    },
    onError: (error: Error) => {
      toast.error('خطا در حذف مضامین', { description: error.message });
    },
  });
}
