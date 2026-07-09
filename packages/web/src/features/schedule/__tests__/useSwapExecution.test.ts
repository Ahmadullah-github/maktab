/**
 * Unit tests for useSwapExecution hook
 *
 * Tests:
 * - executeSwap calls store action
 * - isExecuting state transitions
 * - Only executes valid swaps
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSwapExecution } from '../hooks/useSwapExecution';
import { useScheduleStore } from '../stores/scheduleStore';
import type { DayOfWeek, ScheduledLesson, SwapValidationResult } from '../types';

// Mock the schedule store
vi.mock('../stores/scheduleStore', () => ({
  useScheduleStore: vi.fn(),
}));

describe('useSwapExecution', () => {
  const mockExecuteSwap = vi.fn();

  // Create a sample lesson for testing
  const createLesson = (overrides: Partial<ScheduledLesson> = {}): ScheduledLesson => ({
    day: 'Saturday' as DayOfWeek,
    periodIndex: 0,
    classId: 'class-1',
    className: 'Class 1',
    subjectId: 'subject-1',
    subjectName: 'Math',
    teacherIds: ['teacher-1'],
    teacherNames: ['Teacher 1'],
    roomId: 'room-1',
    roomName: 'Room 1',
    isFixed: false,
    periodsThisDay: 8,
    ...overrides,
  });

  // Create a valid swap validation result
  const createValidSwapResult = (): SwapValidationResult => ({
    isValid: true,
    canProceedWithWarning: false,
    errors: [],
    warnings: [],
    swap: {
      lessonA: createLesson(),
      lessonB: createLesson({ periodIndex: 1, subjectId: 'subject-2', subjectName: 'Science' }),
      slotA: { day: 'Saturday' as DayOfWeek, period: 0 },
      slotB: { day: 'Saturday' as DayOfWeek, period: 1 },
    },
  });

  // Create an invalid swap validation result
  const createInvalidSwapResult = (): SwapValidationResult => ({
    isValid: false,
    canProceedWithWarning: false,
    errors: [
      {
        type: 'TEACHER_CONFLICT',
        severity: 'hard',
        message: 'تداخل معلم',
        details: {},
      },
    ],
    warnings: [],
    swap: {
      lessonA: createLesson(),
      lessonB: createLesson({ periodIndex: 1 }),
      slotA: { day: 'Saturday' as DayOfWeek, period: 0 },
      slotB: { day: 'Saturday' as DayOfWeek, period: 1 },
    },
  });

  // Create a swap with warning that can proceed
  const createWarningSwapResult = (): SwapValidationResult => ({
    isValid: true,
    canProceedWithWarning: true,
    errors: [],
    warnings: [
      {
        type: 'DIFFICULT_AFTERNOON',
        severity: 'soft',
        message: 'درس سخت در بعدازظهر',
        details: {},
      },
    ],
    swap: {
      lessonA: createLesson(),
      lessonB: createLesson({ periodIndex: 1 }),
      slotA: { day: 'Saturday' as DayOfWeek, period: 0 },
      slotB: { day: 'Saturday' as DayOfWeek, period: 1 },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useScheduleStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: { executeSwap: typeof mockExecuteSwap }) => unknown) =>
        selector({ executeSwap: mockExecuteSwap })
    );
  });

  describe('executeSwap function', () => {
    it('calls store executeSwap action with valid swap (Requirement: 7.4)', () => {
      const { result } = renderHook(() => useSwapExecution());
      const validSwap = createValidSwapResult();

      act(() => {
        result.current.executeSwap(validSwap);
      });

      expect(mockExecuteSwap).toHaveBeenCalledTimes(1);
      expect(mockExecuteSwap).toHaveBeenCalledWith(validSwap.swap);
    });

    it('calls store executeSwap action when canProceedWithWarning is true (Requirement: 7.4)', () => {
      const { result } = renderHook(() => useSwapExecution());
      const warningSwap = createWarningSwapResult();

      act(() => {
        result.current.executeSwap(warningSwap);
      });

      expect(mockExecuteSwap).toHaveBeenCalledTimes(1);
      expect(mockExecuteSwap).toHaveBeenCalledWith(warningSwap.swap);
    });

    it('does not call store executeSwap action with invalid swap (Requirement: 7.1)', () => {
      const { result } = renderHook(() => useSwapExecution());
      const invalidSwap = createInvalidSwapResult();

      act(() => {
        result.current.executeSwap(invalidSwap);
      });

      expect(mockExecuteSwap).not.toHaveBeenCalled();
    });
  });

  describe('isExecuting state', () => {
    it('returns isExecuting as false initially (Requirement: 7.2)', () => {
      const { result } = renderHook(() => useSwapExecution());

      expect(result.current.isExecuting).toBe(false);
    });

    it('isExecuting returns to false after execution completes (Requirement: 7.3)', () => {
      const { result } = renderHook(() => useSwapExecution());
      const validSwap = createValidSwapResult();

      act(() => {
        result.current.executeSwap(validSwap);
      });

      // After synchronous execution, isExecuting should be false
      expect(result.current.isExecuting).toBe(false);
    });

    it('isExecuting returns to false even if store action throws (Requirement: 7.3)', () => {
      mockExecuteSwap.mockImplementation(() => {
        throw new Error('Store error');
      });

      const { result } = renderHook(() => useSwapExecution());
      const validSwap = createValidSwapResult();

      expect(() => {
        act(() => {
          result.current.executeSwap(validSwap);
        });
      }).toThrow('Store error');

      // isExecuting should still be false after error
      expect(result.current.isExecuting).toBe(false);
    });
  });

  describe('return type', () => {
    it('returns executeSwap function (Requirement: 7.1)', () => {
      const { result } = renderHook(() => useSwapExecution());

      expect(typeof result.current.executeSwap).toBe('function');
    });

    it('returns isExecuting boolean (Requirement: 7.2)', () => {
      const { result } = renderHook(() => useSwapExecution());

      expect(typeof result.current.isExecuting).toBe('boolean');
    });
  });
});
