/**
 * Unit tests for useUndoRedo hook
 *
 * Tests:
 * - undo/redo function calls
 * - computed values match store state
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUndoRedo } from '../hooks/useUndoRedo';
import { getCanRedo, getCanUndo, useScheduleStore } from '../stores/scheduleStore';

// Mock the schedule store
vi.mock('../stores/scheduleStore', () => ({
  useScheduleStore: vi.fn(),
  getCanUndo: vi.fn(),
  getCanRedo: vi.fn(),
}));

describe('useUndoRedo', () => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();

  const createMockState = (undoStackLength: number, redoStackLength: number) => ({
    undo: mockUndo,
    redo: mockRedo,
    undoStack: Array(undoStackLength).fill({}),
    redoStack: Array(redoStackLength).fill({}),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('with empty stacks', () => {
    beforeEach(() => {
      const mockState = createMockState(0, 0);
      (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof mockState) => unknown) => {
          if (selector === getCanUndo) return false;
          if (selector === getCanRedo) return false;
          return selector(mockState);
        }
      );
    });

    it('returns canUndo as false when undoStack is empty (Requirement: 8.3)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.canUndo).toBe(false);
    });

    it('returns canRedo as false when redoStack is empty (Requirement: 8.4)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.canRedo).toBe(false);
    });

    it('returns undoCount as 0 when undoStack is empty (Requirement: 8.5)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.undoCount).toBe(0);
    });

    it('returns redoCount as 0 when redoStack is empty (Requirement: 8.6)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.redoCount).toBe(0);
    });
  });

  describe('with populated stacks', () => {
    beforeEach(() => {
      const mockState = createMockState(3, 2);
      (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof mockState) => unknown) => {
          if (selector === getCanUndo) return true;
          if (selector === getCanRedo) return true;
          return selector(mockState);
        }
      );
    });

    it('returns canUndo as true when undoStack has items (Requirement: 8.3)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.canUndo).toBe(true);
    });

    it('returns canRedo as true when redoStack has items (Requirement: 8.4)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.canRedo).toBe(true);
    });

    it('returns correct undoCount (Requirement: 8.5)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.undoCount).toBe(3);
    });

    it('returns correct redoCount (Requirement: 8.6)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(result.current.redoCount).toBe(2);
    });
  });

  describe('undo function', () => {
    beforeEach(() => {
      const mockState = createMockState(1, 0);
      (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof mockState) => unknown) => {
          if (selector === getCanUndo) return true;
          if (selector === getCanRedo) return false;
          return selector(mockState);
        }
      );
    });

    it('returns undo function (Requirement: 8.1)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(typeof result.current.undo).toBe('function');
    });

    it('calls store undo action when undo is called (Requirement: 8.1)', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.undo();
      });

      expect(mockUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe('redo function', () => {
    beforeEach(() => {
      const mockState = createMockState(0, 1);
      (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof mockState) => unknown) => {
          if (selector === getCanUndo) return false;
          if (selector === getCanRedo) return true;
          return selector(mockState);
        }
      );
    });

    it('returns redo function (Requirement: 8.2)', () => {
      const { result } = renderHook(() => useUndoRedo());
      expect(typeof result.current.redo).toBe('function');
    });

    it('calls store redo action when redo is called (Requirement: 8.2)', () => {
      const { result } = renderHook(() => useUndoRedo());

      act(() => {
        result.current.redo();
      });

      expect(mockRedo).toHaveBeenCalledTimes(1);
    });
  });

  describe('return type completeness', () => {
    beforeEach(() => {
      const mockState = createMockState(1, 1);
      (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
        (selector: (state: typeof mockState) => unknown) => {
          if (selector === getCanUndo) return true;
          if (selector === getCanRedo) return true;
          return selector(mockState);
        }
      );
    });

    it('returns all required properties', () => {
      const { result } = renderHook(() => useUndoRedo());

      expect(result.current).toHaveProperty('undo');
      expect(result.current).toHaveProperty('redo');
      expect(result.current).toHaveProperty('canUndo');
      expect(result.current).toHaveProperty('canRedo');
      expect(result.current).toHaveProperty('undoCount');
      expect(result.current).toHaveProperty('redoCount');
    });
  });
});
