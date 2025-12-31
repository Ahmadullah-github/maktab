/**
 * Unit tests for useDragDrop hook
 * Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.4
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCellId,
  isValidDrop,
  parseCellId,
  useDragDrop,
  type DragData,
} from '../hooks/useDragDrop';
import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek, type ScheduledLesson } from '../types';

// Sample lesson for testing
const sampleLesson: ScheduledLesson = {
  day: DayOfWeek.Monday,
  periodIndex: 2,
  classId: 'c1',
  className: 'Class 1',
  subjectId: 's1',
  subjectName: 'Math',
  teacherIds: ['t1'],
  teacherNames: ['Teacher 1'],
  roomId: 'r1',
  roomName: 'Room 1',
  isFixed: false,
  periodsThisDay: 6,
};

// Sample drag data
const sampleDragData: DragData = {
  type: 'lesson',
  lesson: sampleLesson,
  sourceSlot: { day: DayOfWeek.Monday, period: 2 },
  viewScope: 'class',
  viewId: 'c1',
};

describe('useDragDrop', () => {
  beforeEach(() => {
    // Reset store state
    useScheduleStore.getState().clearSchedule();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('sensors configuration', () => {
    it('returns configured sensors', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Should have sensors configured
      expect(result.current.sensors).toBeDefined();
      expect(result.current.sensors.length).toBeGreaterThan(0);
    });
  });

  describe('drag start behavior', () => {
    it('sets isLocked to true on drag start', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Verify initial state
      expect(useScheduleStore.getState().isLocked).toBe(false);

      // Simulate drag start
      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      // Verify lock state
      expect(useScheduleStore.getState().isLocked).toBe(true);
    });

    it('selects the dragged lesson on drag start', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Verify initial state
      expect(useScheduleStore.getState().selectedLesson).toBeNull();

      // Simulate drag start
      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      // Verify lesson is selected
      expect(useScheduleStore.getState().selectedLesson).toEqual(sampleLesson);
      expect(useScheduleStore.getState().interactionMode).toBe('selecting');
    });

    it('ignores drag start without valid drag data', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Simulate drag start without data
      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'Monday-2',
            data: { current: undefined },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      // Verify state unchanged
      expect(useScheduleStore.getState().isLocked).toBe(false);
      expect(useScheduleStore.getState().selectedLesson).toBeNull();
    });

    it('ignores drag start with wrong type', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Simulate drag start with wrong type
      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'Monday-2',
            data: { current: { type: 'other' } },
            rect: { current: { initial: null, translated: null } },
          },
        } as any);
      });

      // Verify state unchanged
      expect(useScheduleStore.getState().isLocked).toBe(false);
      expect(useScheduleStore.getState().selectedLesson).toBeNull();
    });
  });

  describe('drag end behavior', () => {
    it('sets isLocked to false on drag end', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Set up locked state
      useScheduleStore.setState({ isLocked: true });

      // Simulate drag end without drop target
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData },
            rect: { current: { initial: null, translated: null } },
          },
          over: null,
        } as any);
      });

      // Verify lock state
      expect(useScheduleStore.getState().isLocked).toBe(false);
    });

    it('calls onDropComplete for valid drop', () => {
      const onDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({ viewScope: 'class', viewId: 'c1', onDropComplete })
      );

      // Simulate drag end with valid drop target
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData },
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: 'Tuesday-3',
            rect: null as any,
            data: { current: undefined },
            disabled: false,
          },
        } as any);
      });

      // Verify callback was called
      expect(onDropComplete).toHaveBeenCalledWith(sampleDragData, {
        day: DayOfWeek.Tuesday,
        period: 3,
      });
    });

    it('cancels selection for invalid drop (different view scope)', () => {
      const onDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({ viewScope: 'teacher', viewId: 't1', onDropComplete })
      );

      // Set up selected lesson
      useScheduleStore.setState({
        selectedLesson: sampleLesson,
        interactionMode: 'selecting',
      });

      // Simulate drag end with invalid drop (different scope)
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData }, // viewScope: 'class'
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: 'Tuesday-3',
            rect: null as any,
            data: { current: undefined },
            disabled: false,
          },
        } as any);
      });

      // Verify selection was cancelled
      expect(useScheduleStore.getState().selectedLesson).toBeNull();
      expect(useScheduleStore.getState().interactionMode).toBe('idle');
      expect(onDropComplete).not.toHaveBeenCalled();
    });

    it('does not call onDropComplete without drop target', () => {
      const onDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({ viewScope: 'class', viewId: 'c1', onDropComplete })
      );

      // Simulate drag end without drop target
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData },
            rect: { current: { initial: null, translated: null } },
          },
          over: null,
        } as any);
      });

      // Verify callback was not called
      expect(onDropComplete).not.toHaveBeenCalled();
    });
  });

  describe('drag cancel behavior', () => {
    it('sets isLocked to false on drag cancel', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Set up locked state
      useScheduleStore.setState({ isLocked: true });

      // Simulate drag cancel
      act(() => {
        result.current.handleDragCancel();
      });

      // Verify lock state
      expect(useScheduleStore.getState().isLocked).toBe(false);
    });

    it('clears selection on drag cancel', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Set up selected lesson
      useScheduleStore.setState({
        selectedLesson: sampleLesson,
        interactionMode: 'selecting',
      });

      // Simulate drag cancel
      act(() => {
        result.current.handleDragCancel();
      });

      // Verify selection was cleared
      expect(useScheduleStore.getState().selectedLesson).toBeNull();
      expect(useScheduleStore.getState().interactionMode).toBe('idle');
    });

    it('resets all interaction state on drag cancel', () => {
      const { result } = renderHook(() => useDragDrop({ viewScope: 'class', viewId: 'c1' }));

      // Set up full interaction state
      useScheduleStore.setState({
        isLocked: true,
        selectedLesson: sampleLesson,
        interactionMode: 'selecting',
      });

      // Simulate drag cancel
      act(() => {
        result.current.handleDragCancel();
      });

      // Verify all state was reset
      const state = useScheduleStore.getState();
      expect(state.isLocked).toBe(false);
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });
  });

  describe('view scope validation', () => {
    it('accepts drop within same class view', () => {
      const onDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({ viewScope: 'class', viewId: 'c1', onDropComplete })
      );

      // Simulate drag end with same view scope
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData },
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: 'Wednesday-4',
            rect: null as any,
            data: { current: undefined },
            disabled: false,
          },
        } as any);
      });

      // Verify callback was called
      expect(onDropComplete).toHaveBeenCalled();
    });

    it('rejects drop from different class view', () => {
      const onDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({ viewScope: 'class', viewId: 'c2', onDropComplete })
      );

      // Simulate drag end with different view ID
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData }, // viewId: 'c1'
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: 'Wednesday-4',
            rect: null as any,
            data: { current: undefined },
            disabled: false,
          },
        } as any);
      });

      // Verify callback was not called
      expect(onDropComplete).not.toHaveBeenCalled();
    });

    it('rejects drop from class view to teacher view', () => {
      const onDropComplete = vi.fn();
      const { result } = renderHook(() =>
        useDragDrop({ viewScope: 'teacher', viewId: 't1', onDropComplete })
      );

      // Simulate drag end with different view scope
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'Monday-2',
            data: { current: sampleDragData }, // viewScope: 'class'
            rect: { current: { initial: null, translated: null } },
          },
          over: {
            id: 'Wednesday-4',
            rect: null as any,
            data: { current: undefined },
            disabled: false,
          },
        } as any);
      });

      // Verify callback was not called
      expect(onDropComplete).not.toHaveBeenCalled();
    });
  });
});

describe('Cell ID Utilities', () => {
  describe('createCellId', () => {
    it('creates cell ID from day and period', () => {
      expect(createCellId(DayOfWeek.Monday, 2)).toBe('Monday-2');
      expect(createCellId(DayOfWeek.Saturday, 0)).toBe('Saturday-0');
      expect(createCellId(DayOfWeek.Friday, 7)).toBe('Friday-7');
    });
  });

  describe('parseCellId', () => {
    it('parses valid cell ID', () => {
      expect(parseCellId('Monday-2')).toEqual({ day: DayOfWeek.Monday, period: 2 });
      expect(parseCellId('Saturday-0')).toEqual({ day: DayOfWeek.Saturday, period: 0 });
      expect(parseCellId('Friday-7')).toEqual({ day: DayOfWeek.Friday, period: 7 });
    });

    it('returns null for invalid cell ID', () => {
      expect(parseCellId('')).toBeNull();
      expect(parseCellId('invalid')).toBeNull();
      expect(parseCellId('Monday')).toBeNull();
      expect(parseCellId('InvalidDay-2')).toBeNull();
      expect(parseCellId('Monday-abc')).toBeNull();
      expect(parseCellId('Monday--1')).toBeNull();
    });
  });

  describe('isValidDrop', () => {
    it('returns true for same view scope and ID', () => {
      expect(isValidDrop(sampleDragData, 'class', 'c1')).toBe(true);
    });

    it('returns false for different view scope', () => {
      expect(isValidDrop(sampleDragData, 'teacher', 'c1')).toBe(false);
    });

    it('returns false for different view ID', () => {
      expect(isValidDrop(sampleDragData, 'class', 'c2')).toBe(false);
    });

    it('returns false for different scope and ID', () => {
      expect(isValidDrop(sampleDragData, 'teacher', 't1')).toBe(false);
    });
  });
});
