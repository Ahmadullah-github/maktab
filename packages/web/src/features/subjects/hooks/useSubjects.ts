/**
 * TanStack Query hooks for Subjects data management
 *
 * Provides hooks for fetching, creating, updating, and deleting subjects
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 1.1, 1.5, 3.4, 3.5, 3.6, 4.5, 4.6, 5.3, 5.4, 9.3, 9.4, 9.5, 10.2, 10.3, 10.4, 11.2
 */

import { invalidateSubjectCaches, QUERY_KEYS } from '@/lib/queryKeys';
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
    mutationFn: ({ id, data }: { id: number; data: Partial<SubjectFormValues> }) =>
      subjectsApi.update(id, data),
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
    mutationFn: (id: number) => subjectsApi.delete(id),
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

/**
 * Hook for inserting curriculum subjects for a specific grade
 *
 * Automatically invalidates the subjects cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with insert curriculum function
 *
 * Requirements: 9.3, 9.4, 9.5
 */
export function useInsertCurriculum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (grade: number) => subjectsApi.insertCurriculum(grade),
    onSuccess: (result, grade) => {
      logger.debug('Invalidating subject-related caches after curriculum insert');
      invalidateSubjectCaches(queryClient);
      toast.success('نصاب تعلیمی با موفقیت درج شد', {
        description: `${result.count} مضمون برای صنف ${grade} اضافه شد`,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to insert curriculum', { error: error.message });
      toast.error('خطا در درج نصاب تعلیمی', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for clearing all subjects for a specific grade
 *
 * Automatically invalidates the subjects cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with clear grade subjects function
 *
 * Requirements: 10.2, 10.3, 10.4
 */
export function useClearGradeSubjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (grade: number) => subjectsApi.clearGradeSubjects(grade),
    onSuccess: (result, grade) => {
      logger.debug('Invalidating subject-related caches after grade subjects clear');
      invalidateSubjectCaches(queryClient);
      toast.success('مضامین صنف با موفقیت پاک شد', {
        description: `${result.count} مضمون از صنف ${grade} حذف شد`,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to clear grade subjects', { error: error.message });
      toast.error('خطا در پاک کردن مضامین صنف', {
        description: error.message,
      });
    },
  });
}
