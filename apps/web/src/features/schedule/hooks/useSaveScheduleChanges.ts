import { API_BASE_URL } from '@/lib/apiBase';
/**
 * Hook for saving schedule changes to the API
 *
 * Provides a mutation hook for persisting schedule edits,
 * with automatic cache invalidation and toast notifications.
 *
 * Requirements: 15.1, 15.2, 15.6, 15.7
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { toast } from 'sonner';

import { SCHEDULE_QUERY_KEYS } from '../constants';
import { useScheduleStore } from '../stores/scheduleStore';
import type { ScheduledLesson } from '../types';
import { logger } from '../utils/logger';
import { ScheduleStorage } from '../utils/scheduleStorage';


/**
 * Input type for updating schedule lessons
 */
interface UpdateScheduleLessonsInput {
  scheduleId: number;
  lessons: ScheduledLesson[];
  expectedRevision: number;
}

class ScheduleRevisionConflictError extends Error {
  constructor() {
    super('این جدول در پنجرهٔ دیگری تغییر کرده است. صفحه را تازه‌سازی کنید و تغییرات را دوباره بررسی کنید.');
    this.name = 'ScheduleRevisionConflictError';
  }
}

/**
 * API function to update schedule lessons
 * Requirements: 15.1
 *
 * This function:
 * 1. Fetches the current timetable data
 * 2. Updates the schedule array within the data
 * 3. Sends the complete data back to the API
 */
async function updateScheduleLessons(input: UpdateScheduleLessonsInput): Promise<{ revision: number }> {
  const response = await fetch(`${API_BASE_URL}/timetables/${input.scheduleId}/lessons`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lessons: input.lessons, expectedRevision: input.expectedRevision }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: response.statusText,
    }));
    if (response.status === 409 && error.code === 'TIMETABLE_REVISION_CONFLICT') {
      throw new ScheduleRevisionConflictError();
    }
    throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Return type for useSaveScheduleChanges hook
 */
export interface UseSaveScheduleChangesReturn {
  /** Save current schedule changes */
  saveChanges: () => Promise<void>;
  /** Whether save is in progress */
  isSaving: boolean;
  /** Whether save was successful */
  isSuccess: boolean;
  /** Error from last save attempt */
  error: Error | null;
}

/**
 * Hook for saving schedule changes to the API
 *
 * Provides a mutation for persisting schedule edits with:
 * - Automatic cache invalidation on success
 * - Persian toast notifications for success/error
 * - Integration with store's markAsSaved action
 *
 * @returns Object containing saveChanges function and mutation state
 *
 * Requirements:
 * - 15.1: Call PATCH /timetables/:id/lessons with current lessons and revision
 * - 15.2: Call markAsSaved on success
 * - 15.6: Show success toast in Persian
 * - 15.7: Show error toast on failure
 */
export function useSaveScheduleChanges(): UseSaveScheduleChangesReturn {
  const queryClient = useQueryClient();

  // Get state and actions from store
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const scheduleRevision = useScheduleStore((state) => state.scheduleRevision);
  const lessons = useScheduleStore((state) => state.lessons);
  const markAsSaved = useScheduleStore((state) => state.markAsSaved);

  // Create mutation for saving changes
  const mutation = useMutation({
    mutationFn: updateScheduleLessons,
    onSuccess: (response) => {
      logger.info('Schedule changes saved successfully');

      // Mark as saved in store (Requirement: 15.2)
      markAsSaved(response.revision);

      // Clear localStorage backup (Phase 7: Task 7.3)
      if (scheduleId !== null) {
        ScheduleStorage.clear(scheduleId);
        logger.debug('Cleared localStorage backup after successful save');
      }

      // Invalidate schedule queries to refresh data
      if (scheduleId !== null) {
        queryClient.invalidateQueries({
          queryKey: SCHEDULE_QUERY_KEYS.detail(scheduleId),
        });
      }

      // Show success toast in Persian (Requirement: 15.6)
      toast.success('تغییرات با موفقیت ذخیره شد');
    },
    onError: (error: Error) => {
      logger.error('Failed to save schedule changes', { error: error.message });

      // Show error toast in Persian (Requirement: 15.7)
      toast.error(
        error instanceof ScheduleRevisionConflictError
          ? 'تغییرات هم‌زمان شناسایی شد'
          : 'خطا در ذخیره تغییرات',
        {
          description: error.message,
          ...(error instanceof ScheduleRevisionConflictError
            ? { action: { label: 'تازه‌سازی', onClick: () => window.location.reload() } }
            : {}),
        }
      );
    },
  });

  // Wrapper function to save current changes
  const saveChanges = useCallback(async (): Promise<void> => {
    if (scheduleId === null || scheduleRevision === null) {
      logger.warn('Cannot save: no schedule loaded');
      return;
    }

    await mutation.mutateAsync({
      scheduleId,
      lessons,
      expectedRevision: scheduleRevision,
    });
  }, [scheduleId, scheduleRevision, lessons, mutation]);

  return {
    saveChanges,
    isSaving: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
