/**
 * useScheduleStats Hook
 * Computes dashboard statistics from schedule data
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { useMemo } from 'react';
import type { SolutionMetadata, SolutionStatistics, TimetableApiResponse } from '../types';
import { useSchedules } from './useSchedule';

/**
 * Return type for useScheduleStats hook
 */
export interface ScheduleStatsResult {
  /** Total count of saved schedules (Requirements: 7.1) */
  totalSchedules: number;
  /** Total classes from latest schedule metadata (Requirements: 7.2) */
  totalClasses: number;
  /** Total teachers from latest schedule metadata (Requirements: 7.3) */
  totalTeachers: number;
  /** Total lessons from latest schedule statistics (Requirements: 7.4) */
  totalLessons: number;
  /** Timestamp of most recent schedule (Requirements: 7.5) */
  lastGeneratedAt: Date | null;
  /** Loading state from underlying query (Requirements: 7.6) */
  isLoading: boolean;
}

/**
 * Parsed data structure from schedule's data field
 */
interface ParsedScheduleData {
  metadata?: SolutionMetadata;
  statistics?: SolutionStatistics;
}

/**
 * Safely parses the JSON data field from a schedule
 * Returns null if parsing fails
 */
function parseScheduleData(data: unknown): ParsedScheduleData | null {
  try {
    const parsed = (typeof data === 'string' ? JSON.parse(data) : data) as ParsedScheduleData;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Finds the latest schedule by createdAt timestamp
 */
function findLatestSchedule(schedules: TimetableApiResponse[]): TimetableApiResponse | null {
  if (schedules.length === 0) return null;

  return schedules.reduce((latest, current) => {
    const latestDate = new Date(latest.createdAt);
    const currentDate = new Date(current.createdAt);
    return currentDate > latestDate ? current : latest;
  });
}

/**
 * Computes the maximum createdAt date from schedules
 */
export function computeLastGeneratedAt(schedules: TimetableApiResponse[]): Date | null {
  if (schedules.length === 0) return null;

  const latestSchedule = findLatestSchedule(schedules);
  if (!latestSchedule) return null;

  return new Date(latestSchedule.createdAt);
}

/**
 * Extracts statistics from the latest schedule
 */
function extractLatestStats(schedules: TimetableApiResponse[]): {
  totalClasses: number;
  totalTeachers: number;
  totalLessons: number;
} {
  const defaultStats = {
    totalClasses: 0,
    totalTeachers: 0,
    totalLessons: 0,
  };

  if (schedules.length === 0) return defaultStats;

  const latestSchedule = findLatestSchedule(schedules);
  if (!latestSchedule) return defaultStats;

  const parsedData = parseScheduleData(latestSchedule.data);
  if (!parsedData) return defaultStats;

  // Extract from metadata (classes and teachers arrays)
  const metadata = parsedData.metadata;
  const statistics = parsedData.statistics;

  return {
    totalClasses: metadata?.classes?.length ?? statistics?.totalClasses ?? 0,
    totalTeachers: metadata?.teachers?.length ?? statistics?.totalTeachers ?? 0,
    totalLessons: statistics?.totalLessons ?? 0,
  };
}

/**
 * Hook for computing dashboard statistics from schedule data
 *
 * Uses useSchedules to fetch all schedules and computes:
 * - Total schedule count
 * - Class/teacher/lesson counts from latest schedule
 * - Most recent generation timestamp
 *
 * @returns Statistics object with computed values and loading state
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export function useScheduleStats(): ScheduleStatsResult {
  const { data: schedules, isLoading } = useSchedules();

  const stats = useMemo(() => {
    // Handle empty/undefined schedules case (Requirements: 7.7)
    if (!schedules || schedules.length === 0) {
      return {
        totalSchedules: 0,
        totalClasses: 0,
        totalTeachers: 0,
        totalLessons: 0,
        lastGeneratedAt: null,
      };
    }

    // Compute totalSchedules from array length (Requirements: 7.1)
    const totalSchedules = schedules.length;

    // Extract stats from latest schedule (Requirements: 7.2, 7.3, 7.4)
    const { totalClasses, totalTeachers, totalLessons } = extractLatestStats(schedules);

    // Compute lastGeneratedAt as max createdAt (Requirements: 7.5)
    const lastGeneratedAt = computeLastGeneratedAt(schedules);

    return {
      totalSchedules,
      totalClasses,
      totalTeachers,
      totalLessons,
      lastGeneratedAt,
    };
  }, [schedules]);

  return {
    ...stats,
    isLoading, // Requirements: 7.6
  };
}
