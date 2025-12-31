/**
 * TanStack Query hooks for Classes data management
 *
 * Provides hooks for fetching, creating, updating, and deleting classes
 * with automatic cache invalidation and optimistic updates
 *
 * Requirements: 11.2, 11.3
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { classesApi } from '../api';
import type { ClassFormValues } from '../types';
import { logger } from '../utils/logger';

/**
 * Query key for classes data
 * Used for cache management and invalidation
 */
export const CLASSES_QUERY_KEY = ['classes'] as const;

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
      logger.debug('Invalidating classes cache after create');
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEY });
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
      logger.debug('Invalidating classes cache after update');
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEY });
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
      logger.debug('Invalidating classes cache after delete');
      queryClient.invalidateQueries({ queryKey: CLASSES_QUERY_KEY });
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
