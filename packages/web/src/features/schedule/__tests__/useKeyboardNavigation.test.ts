/**
 * Unit tests for useKeyboardNavigation hook
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek } from '../types';

// Test configuration
const testDays: DayOfWeek[] = [
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
];
const testPeriodsPerDay = 6;

describe('useKeyboardNavigation', () => {
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
  });

  afterEach(() => {
    // Cleanup
    document.body.removeChild(mockGridElement);
    vi.clearAllMocks();
  });

  describe('Arrow key handling', () => {
    it('ArrowUp moves focus to previous period', () => {
      // Set initial focused slot
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowUp keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus moved up
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 2 });
    });

    it('ArrowDown moves focus to next period', () => {
      // Set initial focused slot
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowDown keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus moved down
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 4 });
    });

    it('ArrowLeft moves focus to next day (RTL)', () => {
      // Set initial focused slot
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowLeft keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus moved to next day (RTL: left = forward)
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Sunday, period: 3 });
    });

    it('ArrowRight moves focus to previous day (RTL)', () => {
      // Set initial focused slot
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Sunday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowRight keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus moved to previous day (RTL: right = backward)
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 3 });
    });
  });

  describe('Boundary behavior', () => {
    it('ArrowUp at period 0 stays at period 0', () => {
      // Set initial focused slot at top boundary
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 0 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowUp keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus stayed at period 0
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 0 });
    });

    it('ArrowDown at max period stays at max period', () => {
      // Set initial focused slot at bottom boundary
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: testPeriodsPerDay - 1 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowDown keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus stayed at max period
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({
        day: DayOfWeek.Saturday,
        period: testPeriodsPerDay - 1,
      });
    });

    it('ArrowRight at first day stays at first day', () => {
      // Set initial focused slot at first day
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowRight keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus stayed at first day
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 3 });
    });

    it('ArrowLeft at last day stays at last day', () => {
      // Set initial focused slot at last day
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Wednesday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowLeft keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus stayed at last day
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Wednesday, period: 3 });
    });
  });

  describe('Lock state respect', () => {
    it('ignores navigation when isLocked is true', () => {
      // Set initial focused slot and lock state
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
        isLocked: true,
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowDown keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus did not change
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 3 });
    });

    it('allows navigation when isLocked is false', () => {
      // Set initial focused slot with lock state false
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
        isLocked: false,
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate ArrowDown keydown
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus changed
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 4 });
    });
  });

  describe('Initial focus', () => {
    it('sets focus to first slot when no slot is focused', () => {
      // Ensure no slot is focused
      useScheduleStore.setState({
        focusedSlot: null,
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate any arrow key
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus was set to first slot
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 0 });
    });
  });

  describe('Non-arrow keys', () => {
    it('ignores non-arrow keys', () => {
      // Set initial focused slot
      useScheduleStore.setState({
        focusedSlot: { day: DayOfWeek.Saturday, period: 3 },
      });

      renderHook(() =>
        useKeyboardNavigation({
          days: testDays,
          periodsPerDay: testPeriodsPerDay,
          gridRef,
        })
      );

      // Simulate non-arrow key
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        mockGridElement.dispatchEvent(event);
      });

      // Check that focus did not change
      const state = useScheduleStore.getState();
      expect(state.focusedSlot).toEqual({ day: DayOfWeek.Saturday, period: 3 });
    });
  });
});
