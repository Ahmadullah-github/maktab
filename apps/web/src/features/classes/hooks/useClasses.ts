/**
 * TanStack Query hooks for Classes data management
 *
 * Provides hooks for fetching, creating, updating, and deleting classes
 * with automatic cache invalidation and optimistic updates
 *
 * Requirements: 11.2, 11.3
 */

import { invalidateAssignmentCaches, invalidateClassCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { classesApi } from '../api';
import type { ClassFormValues } from '../types';
import { logger } from '../utils/logger';

/**
 * Query key for classes data
 * Used for cache management and invalidation
 */
export const CLASSES_QUERY_KEY = QUERY_KEYS.classes;

/**
 * Hook for fetching all classes
 *
 * @returns Query result with classes array
 *
 * Requirements: 11.2
 */
export function useClasses() {
  return useQuery({
    queryKey: CLASSES_QUERY_KEY,
    queryFn: classesApi.getAll,
  });
}

/**
 * Hook for fetching a single class by ID
 *
 * @param id - Class ID to fetch, or null to disable the query
 * @returns Query result with class data
 *
 * Requirements: 11.2
 */
export function useClass(id: number | null) {
  return useQuery({
    queryKey: [...CLASSES_QUERY_KEY, id],
    queryFn: () => classesApi.getById(id!),
    enabled: id !== null,
  });
}

/**
 * Hook for creating a new class
 *
 * Automatically invalidates the classes cache on success
 * and shows toast notifications for success/error
 *
 * @returns Mutation result with create function
 *
 * Requirements: 11.2, 11.3
 */
export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ClassFormValues) => classesApi.create(data),
    onSuccess: (newClass) => {
      logger.debug('Invalidating class-related caches after create');
      invalidateClassCaches(queryClient);
      toast.success('صنف با موفقیت ایجاد شد', {
        description: newClass.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to create class', { error: error.message });
      toast.error('خطا در ایجاد صنف', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for updating an existing class
 *
 * Automatically invalidates the classes cache on success
 * and shows toast notifications for success/error
 *
 * @returns Mutation result with update function
 *
 * Requirements: 11.2, 11.3
 */
export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClassFormValues> }) =>
      classesApi.update(id, data),
    onSuccess: (updatedClass) => {
      logger.debug('Invalidating class-related caches after update');
      invalidateClassCaches(queryClient);
      toast.success('صنف با موفقیت بروزرسانی شد', {
        description: updatedClass.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to update class', { error: error.message });
      toast.error('خطا در بروزرسانی صنف', {
        description: error.message,
      });
    },
  });
}

export function useUpdateClassSubjectPeriods() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      classId: number;
      subjectId: number;
      periodsPerWeek: number;
    }) => api.classes.updateSubjectPeriods(input.classId, input.subjectId, input.periodsPerWeek),
    onSuccess: () => {
      invalidateAssignmentCaches(queryClient);
      toast.success('ساعات مضمون برای صنف بروزرسانی شد');
    },
    onError: (error: Error) => {
      toast.error('تغییر ساعات مضمون ممکن نشد', { description: error.message });
    },
  });
}

/**
 * Hook for deleting a class
 *
 * Automatically invalidates the classes cache on success
 * and shows toast notifications for success/error
 *
 * @returns Mutation result with delete function
 *
 * Requirements: 11.2, 11.3
 */
export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => classesApi.delete(id),
    onSuccess: () => {
      logger.debug('Invalidating class-related caches after delete');
      invalidateClassCaches(queryClient);
      toast.success('صنف با موفقیت حذف شد');
    },
    onError: (error: Error) => {
      logger.error('Failed to delete class', { error: error.message });
      toast.error('خطا در حذف صنف', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for bulk creating classes
 *
 * Creates multiple classes at once with automatic cache invalidation
 * and Farsi toast notifications
 *
 * @returns Mutation result with bulk create function
 */
export function useBulkCreateClasses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classes: ClassFormValues[]) => classesApi.bulkCreate(classes),
    onSuccess: (_, variables) => {
      logger.debug('Invalidating class-related caches after bulk create');
      invalidateClassCaches(queryClient);
      toast.success(`${variables.length} صنف با موفقیت ایجاد شد`);
    },
    onError: (error: Error) => {
      logger.error('Failed to bulk create classes', { error: error.message });
      toast.error('خطا در ایجاد صنف‌ها', {
        description: error.message,
      });
    },
  });
}
