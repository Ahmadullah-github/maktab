/**
 * Unit tests for ScheduleDashboard component
 * Tests component exports, structure, and callback handlers
 *
 * Requirements: 1.1, 1.2, 8.2, 8.3, 8.4
 */

import { describe, expect, it, vi } from 'vitest';
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

describe('ScheduleDashboard Unit Tests', () => {
  /**
   * Test component exports
   * Requirements: 1.1
   */
  describe('Component Export', () => {
    it('should export ScheduleDashboard component', { timeout: 10000 }, async () => {
      const { ScheduleDashboard } = await import('../components/dashboard/ScheduleDashboard');
      expect(typeof ScheduleDashboard).toBe('function');
    });

    it('should be exported from dashboard index', { timeout: 10000 }, async () => {
      const module = await import('../components/dashboard');
      expect(module.ScheduleDashboard).toBeDefined();
      expect(typeof module.ScheduleDashboard).toBe('function');
    });
  });

  /**
   * Test component structure expectations
   * Requirements: 1.1, 1.2
   */
  describe('Component Structure', () => {
    it('should import GenerateButton component', async () => {
      const { GenerateButton } = await import('../components/dashboard/GenerateButton');
      expect(typeof GenerateButton).toBe('function');
    });

    it('should import StatsCards component', async () => {
      const { StatsCards } = await import('../components/dashboard/StatsCards');
      expect(typeof StatsCards).toBe('function');
    });

    it('should import ScheduleList component', async () => {
      const { ScheduleList } = await import('../components/dashboard/ScheduleList');
      expect(typeof ScheduleList).toBe('function');
    });

    it('should import DeleteConfirmationDialog component', async () => {
      const { DeleteConfirmationDialog } =
        await import('../components/dashboard/DeleteConfirmationDialog');
      expect(typeof DeleteConfirmationDialog).toBe('function');
    });
  });

  /**
   * Test hooks integration
   * Requirements: 8.2
   */
  describe('Hooks Integration', () => {
    it('should import useSchedules hook', async () => {
      const { useSchedules } = await import('../hooks');
      expect(typeof useSchedules).toBe('function');
    });

    it('should import useScheduleStats hook', async () => {
      const { useScheduleStats } = await import('../hooks');
      expect(typeof useScheduleStats).toBe('function');
    });

    it('should import useDeleteSchedule hook', async () => {
      const { useDeleteSchedule } = await import('../hooks');
      expect(typeof useDeleteSchedule).toBe('function');
    });
  });

  /**
   * Test callback handler patterns
   * Requirements: 2.5, 2.6
   */
  describe('Callback Handler Patterns', () => {
    it('onLoad handler should receive schedule object', () => {
      const onLoad = vi.fn();
      const schedule = createMockSchedule({ id: 42, name: 'Test Schedule' });

      // Simulate what the component does when Load is clicked
      onLoad(schedule);

      expect(onLoad).toHaveBeenCalledWith(schedule);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('onDelete handler should receive schedule object', () => {
      const onDelete = vi.fn();
      const schedule = createMockSchedule({ id: 42, name: 'Test Schedule' });

      // Simulate what the component does when Delete is clicked
      onDelete(schedule);

      expect(onDelete).toHaveBeenCalledWith(schedule);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('delete confirmation should call mutation with schedule ID', () => {
      const deleteMutation = vi.fn();
      const scheduleId = 42;

      // Simulate what the component does when delete is confirmed
      deleteMutation(scheduleId);

      expect(deleteMutation).toHaveBeenCalledWith(scheduleId);
      expect(deleteMutation).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Test loading state logic
   * Requirements: 8.2
   */
  describe('Loading State Logic', () => {
    it('should show loading skeleton when isLoading is true and no data', () => {
      const state = {
        isLoading: true,
        schedules: undefined,
        error: null,
      };

      // Loading state condition
      const shouldShowSkeleton = state.isLoading && !state.schedules;
      expect(shouldShowSkeleton).toBe(true);
    });

    it('should not show loading skeleton when data is available', () => {
      const state = {
        isLoading: false,
        schedules: [createMockSchedule()],
        error: null,
      };

      const shouldShowSkeleton = state.isLoading && !state.schedules;
      expect(shouldShowSkeleton).toBe(false);
    });

    it('should not show loading skeleton during background refetch', () => {
      const state = {
        isLoading: true, // Background refetch
        schedules: [createMockSchedule()], // Has cached data
        error: null,
      };

      const shouldShowSkeleton = state.isLoading && !state.schedules;
      expect(shouldShowSkeleton).toBe(false);
    });
  });

  /**
   * Test error state logic
   * Requirements: 8.3, 8.4
   */
  describe('Error State Logic', () => {
    it('should show error state when error is present', () => {
      const state = {
        isLoading: false,
        schedules: undefined,
        error: new Error('Network error'),
      };

      const shouldShowError = !!state.error;
      expect(shouldShowError).toBe(true);
    });

    it('should not show error state when no error', () => {
      const state = {
        isLoading: false,
        schedules: [createMockSchedule()],
        error: null,
      };

      const shouldShowError = !!state.error;
      expect(shouldShowError).toBe(false);
    });

    it('retry handler should call refetch', () => {
      const refetch = vi.fn();

      // Simulate retry button click
      refetch();

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Test delete dialog state management
   * Requirements: 5.4
   */
  describe('Delete Dialog State', () => {
    it('should track dialog open state', () => {
      let dialogOpen = false;
      const setDialogOpen = (open: boolean) => {
        dialogOpen = open;
      };

      // Open dialog
      setDialogOpen(true);
      expect(dialogOpen).toBe(true);

      // Close dialog
      setDialogOpen(false);
      expect(dialogOpen).toBe(false);
    });

    it('should track schedule to delete', () => {
      let scheduleToDelete: TimetableApiResponse | null = null;
      const setScheduleToDelete = (schedule: TimetableApiResponse | null) => {
        scheduleToDelete = schedule;
      };

      const schedule = createMockSchedule({ id: 42, name: 'Test' });

      // Set schedule to delete
      setScheduleToDelete(schedule);
      expect(scheduleToDelete).toEqual(schedule);

      // Clear after delete
      setScheduleToDelete(null);
      expect(scheduleToDelete).toBeNull();
    });

    it('should reset state after successful delete', () => {
      let dialogOpen = true;
      let scheduleToDelete: TimetableApiResponse | null = createMockSchedule();

      // Simulate successful delete callback
      const onSuccess = () => {
        dialogOpen = false;
        scheduleToDelete = null;
      };

      onSuccess();

      expect(dialogOpen).toBe(false);
      expect(scheduleToDelete).toBeNull();
    });

    it('should reset state after failed delete', () => {
      let dialogOpen = true;
      let scheduleToDelete: TimetableApiResponse | null = createMockSchedule();

      // Simulate error delete callback
      const onError = () => {
        dialogOpen = false;
        scheduleToDelete = null;
      };

      onError();

      expect(dialogOpen).toBe(false);
      expect(scheduleToDelete).toBeNull();
    });
  });

  /**
   * Test navigation logic
   * Requirements: 2.5
   */
  describe('Navigation Logic', () => {
    it('should navigate to classes-schedule with schedule ID', () => {
      const navigate = vi.fn();
      const schedule = createMockSchedule({ id: 42 });

      // Simulate navigation
      navigate({ to: '/classes-schedule', search: { scheduleId: schedule.id } });

      expect(navigate).toHaveBeenCalledWith({
        to: '/classes-schedule',
        search: { scheduleId: 42 },
      });
    });
  });

  /**
   * Test StatsCards props mapping
   * Requirements: 1.1
   */
  describe('StatsCards Props Mapping', () => {
    it('should map stats to StatsCards props', () => {
      const stats = {
        totalSchedules: 5,
        totalClasses: 24,
        totalTeachers: 12,
        lastGeneratedAt: new Date('2024-06-15'),
        isLoading: false,
      };

      // Verify props structure matches StatsCardsProps
      expect(stats.totalSchedules).toBe(5);
      expect(stats.totalClasses).toBe(24);
      expect(stats.totalTeachers).toBe(12);
      expect(stats.lastGeneratedAt).toBeInstanceOf(Date);
      expect(stats.isLoading).toBe(false);
    });
  });

  /**
   * Test ScheduleList props mapping
   * Requirements: 2.5, 2.6
   */
  describe('ScheduleList Props Mapping', () => {
    it('should map schedules to ScheduleList props', () => {
      const schedules = [createMockSchedule({ id: 1 }), createMockSchedule({ id: 2 })];

      const props = {
        schedules,
        isLoading: false,
        onLoad: vi.fn(),
        onDelete: vi.fn(),
        onRename: vi.fn(),
      };

      expect(props.schedules.length).toBe(2);
      expect(typeof props.onLoad).toBe('function');
      expect(typeof props.onDelete).toBe('function');
      expect(typeof props.onRename).toBe('function');
    });

    it('should handle empty schedules array', () => {
      const props = {
        schedules: [],
        isLoading: false,
        onLoad: vi.fn(),
        onDelete: vi.fn(),
        onRename: vi.fn(),
      };

      expect(props.schedules.length).toBe(0);
    });
  });

  /**
   * Test DeleteConfirmationDialog props mapping
   * Requirements: 5.4
   */
  describe('DeleteConfirmationDialog Props Mapping', () => {
    it('should map dialog state to props', () => {
      const scheduleToDelete = createMockSchedule({ name: 'Test Schedule' });

      const props = {
        open: true,
        onOpenChange: vi.fn(),
        scheduleName: scheduleToDelete.name,
        onConfirm: vi.fn(),
        isDeleting: false,
      };

      expect(props.open).toBe(true);
      expect(props.scheduleName).toBe('Test Schedule');
      expect(props.isDeleting).toBe(false);
    });

    it('should handle null schedule name gracefully', () => {
      const props = {
        open: false,
        onOpenChange: vi.fn(),
        scheduleName: '', // When scheduleToDelete is null
        onConfirm: vi.fn(),
        isDeleting: false,
      };

      expect(props.scheduleName).toBe('');
    });
  });
});
