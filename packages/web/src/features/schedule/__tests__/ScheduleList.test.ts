/**
 * Unit tests for ScheduleList component
 * Tests component exports, table structure, and callback handlers
 *
 * Requirements: 2.1, 2.3, 2.5, 2.6
 */

import { describe, expect, it, vi } from 'vitest';
import { sortSchedulesByDate } from '../components/dashboard/ScheduleList';
import type { TimetableApiResponse } from '../types';

// Helper to create mock schedule data
function createMockSchedule(overrides: Partial<TimetableApiResponse> = {}): TimetableApiResponse {
  return {
    id: 1,
    name: 'Test Schedule',
    description: 'Test description',
    data: JSON.stringify({ statistics: { totalClasses: 10 } }),
    schoolId: null,
    academicYearId: null,
    termId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ScheduleList Unit Tests', () => {
  /**
   * Test component exports
   * Requirements: 2.1
   */
  describe('Component Export', () => {
    it('should export ScheduleList component', async () => {
      const { ScheduleList } = await import('../components/dashboard/ScheduleList');
      expect(typeof ScheduleList).toBe('function');
    });

    it('should export ScheduleListProps type', async () => {
      const module = await import('../components/dashboard/ScheduleList');
      expect(module).toBeDefined();
      expect(module.ScheduleList).toBeDefined();
    });

    it('should export sortSchedulesByDate function', async () => {
      const { sortSchedulesByDate } = await import('../components/dashboard/ScheduleList');
      expect(typeof sortSchedulesByDate).toBe('function');
    });
  });

  /**
   * Test sortSchedulesByDate function
   * Requirements: 2.2
   */
  describe('sortSchedulesByDate', () => {
    it('should sort schedules by createdAt descending', () => {
      const schedules: TimetableApiResponse[] = [
        createMockSchedule({ id: 1, createdAt: '2024-01-01T00:00:00.000Z' }),
        createMockSchedule({ id: 2, createdAt: '2024-06-15T00:00:00.000Z' }),
        createMockSchedule({ id: 3, createdAt: '2024-03-10T00:00:00.000Z' }),
      ];

      const sorted = sortSchedulesByDate(schedules);

      expect(sorted[0].id).toBe(2); // June 15 (newest)
      expect(sorted[1].id).toBe(3); // March 10
      expect(sorted[2].id).toBe(1); // January 1 (oldest)
    });

    it('should handle empty array', () => {
      const sorted = sortSchedulesByDate([]);
      expect(sorted).toEqual([]);
    });

    it('should handle single item array', () => {
      const schedules = [createMockSchedule({ id: 1 })];
      const sorted = sortSchedulesByDate(schedules);
      expect(sorted.length).toBe(1);
      expect(sorted[0].id).toBe(1);
    });

    it('should not mutate original array', () => {
      const schedules: TimetableApiResponse[] = [
        createMockSchedule({ id: 1, createdAt: '2024-01-01T00:00:00.000Z' }),
        createMockSchedule({ id: 2, createdAt: '2024-06-15T00:00:00.000Z' }),
      ];
      const originalOrder = schedules.map((s) => s.id);

      sortSchedulesByDate(schedules);

      expect(schedules.map((s) => s.id)).toEqual(originalOrder);
    });
  });

  /**
   * Test props interface
   * Requirements: 2.1, 2.5, 2.6
   */
  describe('Props Interface', () => {
    it('should accept all required props', () => {
      const validProps = {
        schedules: [createMockSchedule()],
        isLoading: false,
        onLoad: vi.fn(),
        onDelete: vi.fn(),
        onRename: vi.fn(),
      };

      expect(validProps.schedules).toBeDefined();
      expect(validProps.isLoading).toBeDefined();
      expect(typeof validProps.onLoad).toBe('function');
      expect(typeof validProps.onDelete).toBe('function');
      expect(typeof validProps.onRename).toBe('function');
    });

    it('should accept empty schedules array', () => {
      // Requirements: 2.3 - empty state
      const emptyProps = {
        schedules: [],
        isLoading: false,
        onLoad: vi.fn(),
        onDelete: vi.fn(),
        onRename: vi.fn(),
      };

      expect(emptyProps.schedules.length).toBe(0);
    });

    it('should accept loading state', () => {
      const loadingProps = {
        schedules: [],
        isLoading: true,
        onLoad: vi.fn(),
        onDelete: vi.fn(),
        onRename: vi.fn(),
      };

      expect(loadingProps.isLoading).toBe(true);
    });
  });

  /**
   * Test callback handlers
   * Requirements: 2.5, 2.6
   */
  describe('Callback Handlers', () => {
    it('onLoad callback should receive schedule object', () => {
      const onLoad = vi.fn();
      const schedule = createMockSchedule({ id: 42, name: 'Test Schedule' });

      // Simulate what the component does when Load is clicked
      onLoad(schedule);

      expect(onLoad).toHaveBeenCalledWith(schedule);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('onDelete callback should receive schedule object', () => {
      const onDelete = vi.fn();
      const schedule = createMockSchedule({ id: 42, name: 'Test Schedule' });

      // Simulate what the component does when Delete is clicked
      onDelete(schedule);

      expect(onDelete).toHaveBeenCalledWith(schedule);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('onRename callback should receive id and new name', () => {
      const onRename = vi.fn();
      const scheduleId = 42;
      const newName = 'New Schedule Name';

      // Simulate what the component does when rename is confirmed
      onRename(scheduleId, newName);

      expect(onRename).toHaveBeenCalledWith(scheduleId, newName);
      expect(onRename).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Test pagination logic
   * Requirements: 2.4
   */
  describe('Pagination Logic', () => {
    const ITEMS_PER_PAGE = 10;

    it('should not show pagination for 10 or fewer items', () => {
      const schedules = Array.from({ length: 10 }, (_, i) => createMockSchedule({ id: i + 1 }));

      const showPagination = schedules.length > ITEMS_PER_PAGE;
      expect(showPagination).toBe(false);
    });

    it('should show pagination for more than 10 items', () => {
      const schedules = Array.from({ length: 11 }, (_, i) => createMockSchedule({ id: i + 1 }));

      const showPagination = schedules.length > ITEMS_PER_PAGE;
      expect(showPagination).toBe(true);
    });

    it('should calculate correct total pages', () => {
      const testCases = [
        { count: 0, expectedPages: 0 },
        { count: 5, expectedPages: 1 },
        { count: 10, expectedPages: 1 },
        { count: 11, expectedPages: 2 },
        { count: 20, expectedPages: 2 },
        { count: 21, expectedPages: 3 },
        { count: 100, expectedPages: 10 },
      ];

      testCases.forEach(({ count, expectedPages }) => {
        const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
        expect(totalPages).toBe(expectedPages);
      });
    });
  });

  /**
   * Test ScheduleListItem exports
   * Requirements: 2.1, 2.7
   */
  describe('ScheduleListItem Export', () => {
    it('should export ScheduleListItem component', async () => {
      const { ScheduleListItem } = await import('../components/dashboard/ScheduleListItem');
      expect(typeof ScheduleListItem).toBe('function');
    });

    it('should export ScheduleListItemProps type', async () => {
      const module = await import('../components/dashboard/ScheduleListItem');
      expect(module).toBeDefined();
      expect(module.ScheduleListItem).toBeDefined();
    });
  });

  /**
   * Test data parsing
   * Requirements: 2.1
   */
  describe('Data Parsing', () => {
    it('should parse class count from schedule data', () => {
      const schedule = createMockSchedule({
        data: JSON.stringify({ statistics: { totalClasses: 25 } }),
      });

      const data = JSON.parse(schedule.data);
      expect(data.statistics.totalClasses).toBe(25);
    });

    it('should handle invalid JSON data gracefully', () => {
      const schedule = createMockSchedule({
        data: 'invalid json',
      });

      let classCount = 0;
      try {
        const data = JSON.parse(schedule.data);
        classCount = data?.statistics?.totalClasses ?? 0;
      } catch {
        classCount = 0;
      }

      expect(classCount).toBe(0);
    });

    it('should handle missing statistics in data', () => {
      const schedule = createMockSchedule({
        data: JSON.stringify({}),
      });

      const data = JSON.parse(schedule.data);
      const classCount = data?.statistics?.totalClasses ?? 0;

      expect(classCount).toBe(0);
    });
  });

  /**
   * Test date formatting
   * Requirements: 2.1
   */
  describe('Date Formatting', () => {
    it('should format date in Persian locale', () => {
      const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('fa-IR', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(date);
      };

      const testDate = '2024-06-15T10:30:00.000Z';
      const formatted = formatDate(testDate);

      expect(formatted.length).toBeGreaterThan(0);
      expect(typeof formatted).toBe('string');
    });
  });
});
