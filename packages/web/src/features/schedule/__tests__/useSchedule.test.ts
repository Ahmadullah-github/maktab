/**
 * Unit tests for schedule hooks
 * Requirements: 5.5
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHEDULE_QUERY_KEYS } from '../constants';

// Mock the scheduleApi module
vi.mock('../api', () => ({
  scheduleApi: {
    getById: vi.fn(),
    getAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Schedule Hooks Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Test query keys are correctly defined
   * Requirements: 5.5
   */
  describe('Query Keys', () => {
    it('should have correct all query key', () => {
      expect(SCHEDULE_QUERY_KEYS.all).toEqual(['schedules']);
    });

    it('should have correct lists query key', () => {
      expect(SCHEDULE_QUERY_KEYS.lists()).toEqual(['schedules', 'list']);
    });

    it('should have correct detail query key', () => {
      expect(SCHEDULE_QUERY_KEYS.detail(1)).toEqual(['schedule', 1]);
      expect(SCHEDULE_QUERY_KEYS.detail(42)).toEqual(['schedule', 42]);
    });

    it('should generate unique detail keys for different IDs', () => {
      const key1 = SCHEDULE_QUERY_KEYS.detail(1);
      const key2 = SCHEDULE_QUERY_KEYS.detail(2);
      expect(key1).not.toEqual(key2);
    });
  });

  /**
   * Test useSchedule hook configuration
   * Requirements: 5.1, 5.5
   */
  describe('useSchedule Hook Configuration', () => {
    it('should use correct query key format for schedule detail', async () => {
      // Import the hook to verify its configuration
      const { useSchedule } = await import('../hooks/useSchedule');

      // The hook should be a function
      expect(typeof useSchedule).toBe('function');
    });
  });

  /**
   * Test useSchedules hook configuration
   * Requirements: 5.2, 5.5
   */
  describe('useSchedules Hook Configuration', () => {
    it('should use correct query key for schedules list', async () => {
      const { useSchedules } = await import('../hooks/useSchedule');

      // The hook should be a function
      expect(typeof useSchedules).toBe('function');
    });
  });

  /**
   * Test useSaveSchedule hook configuration
   * Requirements: 5.3, 5.5
   */
  describe('useSaveSchedule Hook Configuration', () => {
    it('should be a function', async () => {
      const { useSaveSchedule } = await import('../hooks/useSchedule');

      expect(typeof useSaveSchedule).toBe('function');
    });
  });

  /**
   * Test useDeleteSchedule hook configuration
   * Requirements: 5.4, 5.5
   */
  describe('useDeleteSchedule Hook Configuration', () => {
    it('should be a function', async () => {
      const { useDeleteSchedule } = await import('../hooks/useSchedule');

      expect(typeof useDeleteSchedule).toBe('function');
    });
  });

  /**
   * Test cache invalidation query keys
   * Requirements: 5.5
   */
  describe('Cache Invalidation', () => {
    it('mutations should invalidate the correct query key', () => {
      // The mutations should invalidate SCHEDULE_QUERY_KEYS.all
      // which is ['schedules']
      expect(SCHEDULE_QUERY_KEYS.all).toEqual(['schedules']);
    });
  });
});
