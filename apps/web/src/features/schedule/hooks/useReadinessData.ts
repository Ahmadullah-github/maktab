/**
 * Hook for fetching readiness data for schedule generation
 *
 * Aggregates counts from teachers, classes, subjects, and rooms
 * to determine if the system is ready for schedule generation.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.8
 */

import { useClasses } from '@/features/classes';
import { useRooms } from '@/features/rooms';
import { useSubjects } from '@/features/subjects';
import { useTeachers } from '@/features/teachers';
import type { ReadinessData } from '@/types/readiness';
import { useMemo } from 'react';

/**
 * Return type for useReadinessData hook
 */
export interface UseReadinessDataReturn {
  /** Aggregated readiness data with entity counts */
  data: ReadinessData;
  /** Whether any of the data is still loading */
  isLoading: boolean;
  /** Combined error from any failed query */
  error: Error | null;
  /** Whether all queries have completed successfully */
  isSuccess: boolean;
  /** Refetch all data */
  refetch: () => void;
}

/**
 * Hook for fetching and aggregating readiness data
 *
 * Fetches counts from teachers, classes, subjects, and rooms APIs
 * and combines them into a single ReadinessData object.
 *
 * @returns Object with readiness data, loading state, and error
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.8
 */
export function useReadinessData(): UseReadinessDataReturn {
  // Fetch data from each entity hook
  const {
    data: teachers,
    isLoading: isLoadingTeachers,
    error: teachersError,
    refetch: refetchTeachers,
  } = useTeachers();

  const {
    data: classes,
    isLoading: isLoadingClasses,
    error: classesError,
    refetch: refetchClasses,
  } = useClasses();

  const {
    data: subjects,
    isLoading: isLoadingSubjects,
    error: subjectsError,
    refetch: refetchSubjects,
  } = useSubjects();

  const {
    data: rooms,
    isLoading: isLoadingRooms,
    error: roomsError,
    refetch: refetchRooms,
  } = useRooms();

  // Combine loading states
  const isLoading = isLoadingTeachers || isLoadingClasses || isLoadingSubjects || isLoadingRooms;

  // Combine errors (return first error encountered)
  const error = useMemo(() => {
    if (teachersError) return teachersError as Error;
    if (classesError) return classesError as Error;
    if (subjectsError) return subjectsError as Error;
    if (roomsError) return roomsError as Error;
    return null;
  }, [teachersError, classesError, subjectsError, roomsError]);

  // Check if all queries succeeded
  const isSuccess = !isLoading && !error;

  // Aggregate counts into ReadinessData
  // Requirements: 3.1, 3.2, 3.3, 3.4
  const data: ReadinessData = useMemo(() => {
    return {
      teacherCount: teachers?.length ?? 0,
      classCount: classes?.length ?? 0,
      subjectCount: subjects?.length ?? 0,
      roomCount: rooms?.length ?? 0,
    };
  }, [teachers, classes, subjects, rooms]);

  // Combined refetch function
  const refetch = () => {
    refetchTeachers();
    refetchClasses();
    refetchSubjects();
    refetchRooms();
  };

  return {
    data,
    isLoading,
    error,
    isSuccess,
    refetch,
  };
}
