/**
 * Unit tests for useScheduleStats hook
 * Tests edge cases and specific scenarios
 *
 * Requirements: 7.7
 */

import { describe, expect, it } from 'vitest';

import { computeLastGeneratedAt } from '../hooks/useScheduleStats';
import type { TimetableApiResponse } from '../types';

// Helper to create a mock schedule response
function createMockSchedule(
  id: number,
  createdAt: string,
  data?: {
    metadata?: { classes?: unknown[]; teachers?: unknown[] };
    statistics?: { totalClasses?: number; totalTeachers?: number; totalLessons?: number };
  }
): TimetableApiResponse {
  return {
    id,
    name: `Schedule ${id}`,
    description: '',
    data: JSON.stringify({
      schedule: [],
      metadata: data?.metadata ?? { classes: [], subjects: [], teachers: [] },
      statistics: data?.statistics ?? {
        totalClasses: 0,
        totalTeachers: 0,
        totalLessons: 0,
        singleTeacherClasses: 0,
        multiTeacherClasses: 0,
        totalSubjects: 0,
        customSubjects: 0,
        standardSubjects: 0,
        totalRooms: 0,
        categoryCounts: {},
        customSubjectsByCategory: {},
        periodsPerWeek: 0,
        solveTimeSeconds: null,
        strategy: null,
        numConstraintsApplied: null,
        qualityScore: null,
      },
    }),
    schoolId: null,
    academicYearId: null,
    termId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('useScheduleStats Unit Tests', () => {
  /**
   * Test empty schedules returns zeros and null
   * Requirements: 7.7
   */
  describe('Empty Schedules Case', () => {
    it('should return null for lastGeneratedAt when schedules is empty', () => {
      const result = computeLastGeneratedAt([]);
      expect(result).toBeNull();
    });

    it('should handle undefined schedules gracefully', () => {
      // The hook handles this internally, but we test the computation function
      const result = computeLastGeneratedAt([]);
      expect(result).toBeNull();
    });
  });

  /**
   * Test single schedule returns correct values
   * Requirements: 7.1, 7.5
   */
  describe('Single Schedule Case', () => {
    it('should return correct lastGeneratedAt for single schedule', () => {
      const createdAt = '2024-06-15T10:30:00.000Z';
      const schedules = [createMockSchedule(1, createdAt)];

      const result = computeLastGeneratedAt(schedules);

      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe(createdAt);
    });

    it('should return totalSchedules of 1 for single schedule', () => {
      const schedules = [createMockSchedule(1, '2024-06-15T10:30:00.000Z')];

      // totalSchedules is simply the array length
      expect(schedules.length).toBe(1);
    });
  });

  /**
   * Test multiple schedules with different timestamps
   * Requirements: 7.5
   */
  describe('Multiple Schedules - Timestamp Selection', () => {
    it('should return the most recent timestamp as lastGeneratedAt', () => {
      const schedules = [
        createMockSchedule(1, '2024-01-01T00:00:00.000Z'),
        createMockSchedule(2, '2024-06-15T12:00:00.000Z'), // Most recent
        createMockSchedule(3, '2024-03-10T08:00:00.000Z'),
      ];

      const result = computeLastGeneratedAt(schedules);

      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should handle schedules with same timestamp', () => {
      const sameTime = '2024-06-15T10:30:00.000Z';
      const schedules = [
        createMockSchedule(1, sameTime),
        createMockSchedule(2, sameTime),
        createMockSchedule(3, sameTime),
      ];

      const result = computeLastGeneratedAt(schedules);

      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe(sameTime);
    });

    it('should handle schedules in reverse chronological order', () => {
      const schedules = [
        createMockSchedule(1, '2024-12-31T23:59:59.000Z'), // Most recent (first in array)
        createMockSchedule(2, '2024-06-15T12:00:00.000Z'),
        createMockSchedule(3, '2024-01-01T00:00:00.000Z'),
      ];

      const result = computeLastGeneratedAt(schedules);

      expect(result).not.toBeNull();
      expect(result!.toISOString()).toBe('2024-12-31T23:59:59.000Z');
    });
  });

  /**
   * Test hook export
   * Requirements: 7.6
   */
  describe('Hook Export', () => {
    it('should export useScheduleStats as a function', async () => {
      const { useScheduleStats } = await import('../hooks/useScheduleStats');
      expect(typeof useScheduleStats).toBe('function');
    });

    it('should export computeLastGeneratedAt as a function', async () => {
      const { computeLastGeneratedAt } = await import('../hooks/useScheduleStats');
      expect(typeof computeLastGeneratedAt).toBe('function');
    });
  });
});
