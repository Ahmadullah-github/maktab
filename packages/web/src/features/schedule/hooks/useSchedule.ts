/**
 * TanStack Query hooks for Schedule data management
 *
 * Provides hooks for fetching, saving, and deleting schedules
 * with automatic cache invalidation and Farsi toast notifications
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { scheduleApi, type SaveScheduleInput } from '../api';
import { SCHEDULE_QUERY_KEYS } from '../constants';
import { logger } from '../utils/logger';

/**
 * Hook for fetching a single schedule by ID
 *
 * @param id - Schedule ID to fetch, or null to disable the query
 * @returns Query result with transformed schedule data
 *
 * Requirements: 5.1, 5.5
 */
export function useSchedule(id: number | null) {
  return useQuery({
    queryKey: id !== null ? SCHEDULE_QUERY_KEYS.detail(id) : ['schedule', null],
    queryFn: () => scheduleApi.getById(id!),
    enabled: id !== null,
  });
}

/**
 * Hook for fetching all schedules
 *
 * @returns Query result with schedules array for dashboard display
 *
 * Requirements: 5.2, 5.5
 */
export function useSchedules() {
  return useQuery({
    queryKey: SCHEDULE_QUERY_KEYS.all,
    queryFn: scheduleApi.getAll,
  });
}

/**
 * Hook for saving a schedule
 *
 * Automatically invalidates the schedules cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with save function
 *
 * Requirements: 5.3, 5.5, 5.6, 5.7
 */
export function useSaveSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SaveScheduleInput) => scheduleApi.save(data),
    onSuccess: (savedSchedule) => {
      logger.debug('Invalidating schedules cache after save');
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });
      toast.success('جدول زمانی با موفقیت ذخیره شد', {
        description: savedSchedule.name,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to save schedule', { error: error.message });
      toast.error('خطا در ذخیره جدول زمانی', {
        description: error.message,
      });
    },
  });
}

/**
 * Hook for deleting a schedule
 *
 * Automatically invalidates the schedules cache on success
 * and shows Farsi toast notifications for success/error
 *
 * @returns Mutation result with delete function
 *
 * Requirements: 5.4, 5.5, 5.6, 5.7
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => scheduleApi.delete(id),
    onSuccess: () => {
      logger.debug('Invalidating schedules cache after delete');
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });
      toast.success('جدول زمانی با موفقیت حذف شد');
    },
    onError: (error: Error) => {
      logger.error('Failed to delete schedule', { error: error.message });
      toast.error('خطا در حذف جدول زمانی', {
        description: error.message,
      });
    },
  });
}
