/**
 * TanStack Query hooks for Teachers data management
 *
 * Provides hooks for fetching, creating, updating, and deleting teachers
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 2.4, 2.5, 2.6, 9.2
 */

import { invalidateTeacherCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { teachersApi } from '../api';
import type { TeacherFormValues } from '../types';
import { logger } from '../utils/logger';

/**
 * Query key for teachers data
 * Used for cache management and invalidation
 */
export const TEACHERS_QUERY_KEY = QUERY_KEYS.teachers;

/**
 * Hook for fetching all teachers
 *
 * @returns Query result with teachers array
 *
 * Requirements: 9.2
 */
export function useTeachers() {
  return useQuery({
    queryKey: TEACHERS_QUERY_KEY,
    queryFn: teachersApi.getAll,
  });
}

/**
 * Hook for fetching a single teacher by ID
 *
 * @param id - Teacher ID to fetch, or null to disable the query
 * @returns Query result with teacher data
 *
 * Requirements: 9.2
 */
export function useTeacher(id: number | null) {
  return useQuery({
    queryKey: [...TEACHERS_QUERY_KEY, id],
    queryFn: () => teachersApi.getById(id!),
    enabled: id !== null,
  });
}

/**
 * Hook for creating a new teacher
 *
 * Automatically invalidates the teachers cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with create function
 *
 * Requirements: 2.4, 9.2
 */
export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TeacherFormValues) => teachersApi.create(data),
    onSuccess: (newTeacher) => {
      logger.debug('Invalidating teacher-related caches after create');
      invalidateTeacherCaches(queryClient);
      toast.success('استاد با موفقیت ایجاد شد', {
        description: newTeacher.fullName,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to create teacher', { error: error.message });
      toast.error('خطا در ایجاد استاد', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for updating an existing teacher
 *
 * Automatically invalidates the teachers cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with update function
 *
 * Requirements: 2.5, 9.2
 */
export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TeacherFormValues> }) =>
      teachersApi.update(id, data),
    onSuccess: (updatedTeacher) => {
      logger.debug('Invalidating teacher-related caches after update');
      invalidateTeacherCaches(queryClient);
      toast.success('استاد با موفقیت بروزرسانی شد', {
        description: updatedTeacher.fullName,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to update teacher', { error: error.message });
      toast.error('خطا در بروزرسانی استاد', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for deleting a teacher
 *
 * Automatically invalidates the teachers cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with delete function
 *
 * Requirements: 2.6, 9.2
 */
export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => teachersApi.delete(id),
    onSuccess: () => {
      logger.debug('Invalidating teacher-related caches after delete');
      invalidateTeacherCaches(queryClient);
      toast.success('استاد با موفقیت حذف شد');
    },
    onError: (error: Error) => {
      logger.error('Failed to delete teacher', { error: error.message });
      toast.error('خطا در حذف استاد', {
        description: error.message,
      });
    },
  });
}
