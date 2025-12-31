/**
 * Unit tests for useUnsavedChanges hook
 *
 * Tests:
 * - count and hasChanges values
 * - beforeunload registration
 * - save and confirmLeave functions
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import {
  getHasUnsavedChanges,
  getUnsavedChangesCount,
  useScheduleStore,
} from '../stores/scheduleStore';

// Mock the schedule store
vi.mock('../stores/scheduleStore', () => ({
  useScheduleStore: vi.fn(),
  getUnsavedChangesCount: vi.fn(),
  getHasUnsavedChanges: vi.fn(),
}));

describe('useUnsavedChanges', () => {
  // Track event listeners
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  const setupMockStore = (count: number, hasChanges: boolean) => {
    (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: unknown) => {
        if (selector === getUnsavedChangesCount) return count;
        if (selector === getHasUnsavedChanges) return hasChanges;
        return undefined;
      }
    );
  };

  describe('count and hasChanges values', () => {
    it('returns count from store (Requirement: 13.1)', () => {
      setupMockStore(5, true);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(result.current.count).toBe(5);
    });

    it('returns hasChanges from store (Requirement: 13.2)', () => {
      setupMockStore(3, true);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(result.current.hasChanges).toBe(true);
    });

    it('returns hasChanges as false when no changes (Requirement: 13.2)', () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(result.current.hasChanges).toBe(false);
    });

    it('returns count as 0 when no changes (Requirement: 13.1)', () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(result.current.count).toBe(0);
    });
  });

  describe('beforeunload registration', () => {
    it('registers beforeunload handler when hasChanges is true (Requirement: 13.5)', () => {
      setupMockStore(1, true);
      renderHook(() => useUnsavedChanges());

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('does not register beforeunload handler when hasChanges is false (Requirement: 13.5)', () => {
      setupMockStore(0, false);
      renderHook(() => useUnsavedChanges());

      expect(addEventListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('removes beforeunload handler on unmount (Requirement: 13.5)', () => {
      setupMockStore(1, true);
      const { unmount } = renderHook(() => useUnsavedChanges());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });

    it('removes beforeunload handler when hasChanges becomes false', () => {
      // Start with changes
      setupMockStore(1, true);
      const { rerender } = renderHook(() => useUnsavedChanges());

      // Clear the spy calls
      removeEventListenerSpy.mockClear();

      // Update to no changes
      setupMockStore(0, false);
      rerender();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    });
  });

  describe('confirmLeave function', () => {
    it('returns confirmLeave function (Requirement: 13.3)', () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(typeof result.current.confirmLeave).toBe('function');
    });

    it('confirmLeave returns true when no changes (Requirement: 13.3)', async () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());

      let canLeave: boolean = false;
      await act(async () => {
        canLeave = await result.current.confirmLeave();
      });

      expect(canLeave).toBe(true);
    });

    it('confirmLeave returns false by default when has changes (Requirement: 13.3)', async () => {
      setupMockStore(1, true);
      const { result } = renderHook(() => useUnsavedChanges());

      let canLeave: boolean = true;
      await act(async () => {
        canLeave = await result.current.confirmLeave();
      });

      expect(canLeave).toBe(false);
    });

    it('confirmLeave calls onConfirmLeave callback when provided (Requirement: 13.3)', async () => {
      setupMockStore(1, true);
      const onConfirmLeave = vi.fn().mockResolvedValue(true);
      const { result } = renderHook(() => useUnsavedChanges({ onConfirmLeave }));

      let canLeave: boolean = false;
      await act(async () => {
        canLeave = await result.current.confirmLeave();
      });

      expect(onConfirmLeave).toHaveBeenCalledTimes(1);
      expect(canLeave).toBe(true);
    });
  });

  describe('save function', () => {
    it('returns save function (Requirement: 13.4)', () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(typeof result.current.save).toBe('function');
    });

    it('returns isSaving as false initially (Requirement: 13.4)', () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());
      expect(result.current.isSaving).toBe(false);
    });

    it('calls onSave callback when save is called (Requirement: 13.4)', async () => {
      setupMockStore(1, true);
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useUnsavedChanges({ onSave }));

      await act(async () => {
        await result.current.save();
      });

      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('does nothing when onSave is not provided (Requirement: 13.4)', async () => {
      setupMockStore(1, true);
      const { result } = renderHook(() => useUnsavedChanges());

      // Should not throw
      await act(async () => {
        await result.current.save();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('isSaving returns to false after save completes (Requirement: 13.4)', async () => {
      setupMockStore(1, true);
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useUnsavedChanges({ onSave }));

      await act(async () => {
        await result.current.save();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('isSaving returns to false even if save throws (Requirement: 13.4)', async () => {
      setupMockStore(1, true);
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      const { result } = renderHook(() => useUnsavedChanges({ onSave }));

      await expect(
        act(async () => {
          await result.current.save();
        })
      ).rejects.toThrow('Save failed');

      expect(result.current.isSaving).toBe(false);
    });
  });

  describe('return type completeness', () => {
    it('returns all required properties', () => {
      setupMockStore(0, false);
      const { result } = renderHook(() => useUnsavedChanges());

      expect(result.current).toHaveProperty('count');
      expect(result.current).toHaveProperty('hasChanges');
      expect(result.current).toHaveProperty('confirmLeave');
      expect(result.current).toHaveProperty('save');
      expect(result.current).toHaveProperty('isSaving');
    });
  });
});
