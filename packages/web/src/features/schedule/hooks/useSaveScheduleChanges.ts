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
import { parseScheduleDataField } from '../utils/scheduleTransformer';
import { ScheduleStorage } from '../utils/scheduleStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * Input type for updating schedule lessons
 */
interface UpdateScheduleLessonsInput {
  scheduleId: number;
  lessons: ScheduledLesson[];
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
async function updateScheduleLessons(input: UpdateScheduleLessonsInput): Promise<void> {
  const { scheduleId, lessons } = input;

  // Step 1: Fetch current timetable to get full data structure
  const getResponse = await fetch(`${API_BASE_URL}/timetables/${scheduleId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!getResponse.ok) {
    throw new Error(`Failed to fetch timetable: ${getResponse.statusText}`);
  }

  const timetable = await getResponse.json();
  const existingData = parseScheduleDataField(timetable.data);

  // Step 2: Update the schedule array in the data
  const updatedData = {
    ...existingData,
    schedule: lessons.map((lesson) => ({
      day: lesson.day,
      periodIndex: lesson.periodIndex,
      classId: lesson.classId,
      className: lesson.className,
      subjectId: lesson.subjectId,
      subjectName: lesson.subjectName,
      teacherIds: lesson.teacherIds,
      teacherNames: lesson.teacherNames,
      roomId: lesson.roomId,
      roomName: lesson.roomName,
      isFixed: lesson.isFixed,
      periodsThisDay: lesson.periodsThisDay,
    })),
  };

  // Step 3: Send updated data back to API
  const putResponse = await fetch(`${API_BASE_URL}/timetables/${scheduleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: updatedData }),
  });

  if (!putResponse.ok) {
    const error = await putResponse.json().catch(() => ({
      message: putResponse.statusText,
    }));
    throw new Error(error.message || `HTTP error! status: ${putResponse.status}`);
  }
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
 * - 15.1: Call PUT /timetables/:id/lessons with current lessons
 * - 15.2: Call markAsSaved on success
 * - 15.6: Show success toast in Persian
 * - 15.7: Show error toast on failure
 */
export function useSaveScheduleChanges(): UseSaveScheduleChangesReturn {
  const queryClient = useQueryClient();

  // Get state and actions from store
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const lessons = useScheduleStore((state) => state.lessons);
  const markAsSaved = useScheduleStore((state) => state.markAsSaved);

  // Create mutation for saving changes
  const mutation = useMutation({
    mutationFn: updateScheduleLessons,
    onSuccess: () => {
      logger.info('Schedule changes saved successfully');

      // Mark as saved in store (Requirement: 15.2)
      markAsSaved();

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
      toast.error('خطا در ذخیره تغییرات', {
        description: error.message,
      });
    },
  });

  // Wrapper function to save current changes
  const saveChanges = useCallback(async (): Promise<void> => {
    if (scheduleId === null) {
      logger.warn('Cannot save: no schedule loaded');
      return;
    }

    await mutation.mutateAsync({
      scheduleId,
      lessons,
    });
  }, [scheduleId, lessons, mutation]);

  return {
    saveChanges,
    isSaving: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
  };
}
