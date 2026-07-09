/**
 * Unit tests for useCellSelection hook
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCellSelection } from '../hooks/useCellSelection';
import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek, type ScheduledLesson } from '../types';
import { buildIndexes } from '../utils/indexBuilder';

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

const anotherLesson: ScheduledLesson = {
  day: DayOfWeek.Tuesday,
  periodIndex: 3,
  classId: 'c2',
  className: 'Class 2',
  subjectId: 's2',
  subjectName: 'Science',
  teacherIds: ['t2'],
  teacherNames: ['Teacher 2'],
  roomId: 'r2',
  roomName: 'Room 2',
  isFixed: false,
  periodsThisDay: 6,
};

describe('useCellSelection', () => {
  // Mock grid element
  let mockGridElement: HTMLDivElement;
  let gridRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    // Reset store state
    useScheduleStore.getState().clearSchedule();

    // Create mock grid element
    mockGridElement = document.createElement('div');
    mockGridElement.tabIndex = 0;
    document.body.appendChild(mockGridElement);
    gridRef = { current: mockGridElement };

    // Set up indexes with sample lessons
    const indexes = buildIndexes([sampleLesson, anotherLesson]);
    useScheduleStore.setState({ indexes });
  });

  afterEach(() => {
    // Cleanup
    document.body.removeChild(mockGridElement);
    vi.clearAllMocks();
  });

  describe('Enter/Space selection', () => {
    it('Enter key on focused cell with lesson selects the lesson', () => {
      // Set focused slot to cell with lesson
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Monday, period: 2 },
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Enter keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toEqual(sampleLesson);
      expect(state.interactionMode).toBe('selecting');
    });

    it('Space key on focused cell with lesson selects the lesson', () => {
      // Set focused slot to cell with lesson
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Monday, period: 2 },
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Space keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: ' ' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toEqual(sampleLesson);
      expect(state.interactionMode).toBe('selecting');
    });

    it('Enter key on focused empty cell does not select anything', () => {
      // Set focused slot to empty cell
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Wednesday, period: 0 },
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Enter keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });

    it('Enter key without focused slot does nothing', () => {
      // No focused slot
      useScheduleStore.setState({
        focusedSlot: null,
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Enter keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });
  });

  describe('Click selection', () => {
    it('handleCellAction with lesson selects the lesson', () => {
      const { result } = renderHook(() => useCellSelection({ gridRef }));

      // Call handleCellAction with a lesson
      act(() => {
        result.current.handleCellAction(DayOfWeek.Monday, 2, sampleLesson);
      });

      // Check that lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toEqual(sampleLesson);
      expect(state.interactionMode).toBe('selecting');
    });

    it('handleCellAction with null lesson does not select anything', () => {
      const { result } = renderHook(() => useCellSelection({ gridRef }));

      // Call handleCellAction with null lesson
      act(() => {
        result.current.handleCellAction(DayOfWeek.Wednesday, 0, null);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });

    it('handleCellAction replaces previous selection', () => {
      const { result } = renderHook(() => useCellSelection({ gridRef }));

      // Select first lesson
      act(() => {
        result.current.handleCellAction(DayOfWeek.Monday, 2, sampleLesson);
      });

      expect(useScheduleStore.getState().selectedLesson).toEqual(sampleLesson);

      // Select second lesson
      act(() => {
        result.current.handleCellAction(DayOfWeek.Tuesday, 3, anotherLesson);
      });

      // Check that second lesson replaced the first
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toEqual(anotherLesson);
      expect(state.interactionMode).toBe('selecting');
    });
  });

  describe('Escape cancellation', () => {
    it('Escape key cancels selection', () => {
      // First select a lesson
      useScheduleStore.getState().selectLesson(sampleLesson);
      expect(useScheduleStore.getState().selectedLesson).toEqual(sampleLesson);

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Escape keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that selection is cancelled
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });

    it('handleEscape cancels selection', () => {
      // First select a lesson
      useScheduleStore.getState().selectLesson(sampleLesson);

      const { result } = renderHook(() => useCellSelection({ gridRef }));

      // Call handleEscape
      act(() => {
        result.current.handleEscape();
      });

      // Check that selection is cancelled
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });

    it('Escape key works even when no lesson is selected', () => {
      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Escape keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that state remains idle
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });
  });

  describe('Empty cell handling', () => {
    it('Enter on empty cell does not change state', () => {
      // Set focused slot to empty cell
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Friday, period: 5 },
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Enter keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });

    it('handleCellAction with null does not change state', () => {
      const { result } = renderHook(() => useCellSelection({ gridRef }));

      // Call handleCellAction with null
      act(() => {
        result.current.handleCellAction(DayOfWeek.Friday, 5, null);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
      expect(state.interactionMode).toBe('idle');
    });
  });

  describe('Lock state respect', () => {
    it('ignores Enter key when isLocked is true', () => {
      // Set focused slot and lock state
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Monday, period: 2 },
        isLocked: true,
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Enter keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
    });

    it('ignores handleCellAction when isLocked is true', () => {
      // Set lock state
      useScheduleStore.setState({
        isLocked: true,
      });

      const { result } = renderHook(() => useCellSelection({ gridRef }));

      // Call handleCellAction
      act(() => {
        result.current.handleCellAction(DayOfWeek.Monday, 2, sampleLesson);
      });

      // Check that no lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toBeNull();
    });

    it('allows selection when isLocked is false', () => {
      // Set focused slot with lock state false
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Monday, period: 2 },
        isLocked: false,
      });

      renderHook(() => useCellSelection({ gridRef }));

      // Simulate Enter keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that lesson is selected
      const state = useScheduleStore.getState();
      expect(state.selectedLesson).toEqual(sampleLesson);
      expect(state.interactionMode).toBe('selecting');
    });
  });

  describe('onSwapInitiated callback', () => {
    it('calls onSwapInitiated when selecting different cell with existing selection', () => {
      const onSwapInitiated = vi.fn();

      // First select a lesson
      useScheduleStore.getState().selectLesson(sampleLesson);

      const { result } = renderHook(() => useCellSelection({ gridRef, onSwapInitiated }));

      // Click on a different cell with a lesson
      act(() => {
        result.current.handleCellAction(DayOfWeek.Tuesday, 3, anotherLesson);
      });

      // Check that onSwapInitiated was called
      expect(onSwapInitiated).toHaveBeenCalledWith(sampleLesson, {
        day: DayOfWeek.Tuesday,
        period: 3,
      });
    });

    it('does not call onSwapInitiated when clicking same cell', () => {
      const onSwapInitiated = vi.fn();

      // First select a lesson
      useScheduleStore.getState().selectLesson(sampleLesson);

      const { result } = renderHook(() => useCellSelection({ gridRef, onSwapInitiated }));

      // Click on the same cell
      act(() => {
        result.current.handleCellAction(DayOfWeek.Monday, 2, sampleLesson);
      });

      // Check that onSwapInitiated was not called
      expect(onSwapInitiated).not.toHaveBeenCalled();
    });
  });

  describe('onCellActionRequested callback', () => {
    it('delegates keyboard activation to grid-owned slot handling when provided', () => {
      const onCellActionRequested = vi.fn();

      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Monday, period: 2 },
      });

      renderHook(() => useCellSelection({ gridRef, onCellActionRequested }));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      expect(onCellActionRequested).toHaveBeenCalledWith({
        day: DayOfWeek.Monday,
        period: 2,
      });
      expect(useScheduleStore.getState().selectedLesson).toBeNull();
    });
  });
});
