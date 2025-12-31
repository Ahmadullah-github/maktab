/**
 * Tests for useSaveScheduleChanges hook
 *
 * Requirements: 15.1, 15.2, 15.6, 15.7
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSaveScheduleChanges } from '../hooks/useSaveScheduleChanges';
import { useScheduleStore } from '../stores/scheduleStore';
import type { ScheduledLesson } from '../types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

// Create a wrapper with QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// Sample lesson for testing
const sampleLesson: ScheduledLesson = {
  classId: 'class-1',
  className: 'Class 1A',
  day: 'Saturday',
  periodIndex: 0,
  periodsThisDay: 6,
  subjectId: 'subject-1',
  subjectName: 'Math',
  teacherIds: ['teacher-1'],
  teacherNames: ['Teacher A'],
  roomId: 'room-1',
  roomName: 'Room 101',
};

describe('useSaveScheduleChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    useScheduleStore.setState({
      scheduleId: 1,
      lessons: [sampleLesson],
      undoStack: [
        {
          id: 'action-1',
          timestamp: Date.now(),
          type: 'swap',
          before: { lessonA: sampleLesson, lessonB: null },
          after: { lessonA: { ...sampleLesson, periodIndex: 1 }, lessonB: null },
        },
      ],
      redoStack: [],
      originalLessons: [],
      lastSavedAt: null,
    });
  });

  afterEach(() => {
    useScheduleStore.setState({
      scheduleId: null,
      lessons: [],
      undoStack: [],
      redoStack: [],
      originalLessons: [],
      lastSavedAt: null,
    });
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isSaving).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.saveChanges).toBe('function');
  });

  it('should save changes successfully (Requirement: 15.1)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveChanges();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify API was called with correct data
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/timetables/1/lessons'),
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      })
    );
  });

  it('should call markAsSaved on success (Requirement: 15.2)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    // Verify undoStack has items before save
    expect(useScheduleStore.getState().undoStack.length).toBe(1);

    await act(async () => {
      await result.current.saveChanges();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify markAsSaved was called (undoStack should be cleared)
    expect(useScheduleStore.getState().undoStack.length).toBe(0);
    expect(useScheduleStore.getState().lastSavedAt).not.toBeNull();
  });

  it('should show success toast in Persian (Requirement: 15.6)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveChanges();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(toast.success).toHaveBeenCalledWith('تغییرات با موفقیت ذخیره شد');
  });

  it('should show error toast on failure (Requirement: 15.7)', async () => {
    const errorMessage = 'Network error';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ message: errorMessage }),
    });

    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.saveChanges();
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(toast.error).toHaveBeenCalledWith('خطا در ذخیره تغییرات', {
      description: errorMessage,
    });
  });

  it('should not save when no schedule is loaded', async () => {
    useScheduleStore.setState({ scheduleId: null });

    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.saveChanges();
    });

    // API should not be called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should set isSaving during save operation', async () => {
    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockImplementationOnce(() =>
      promise.then(() => ({
        ok: true,
        json: () => Promise.resolve({}),
      }))
    );

    const { result } = renderHook(() => useSaveScheduleChanges(), {
      wrapper: createWrapper(),
    });

    // Start save
    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.saveChanges();
    });

    // Should be saving
    await waitFor(() => {
      expect(result.current.isSaving).toBe(true);
    });

    // Complete save
    await act(async () => {
      resolvePromise!();
      await savePromise;
    });

    // Should no longer be saving
    await waitFor(() => {
      expect(result.current.isSaving).toBe(false);
    });
  });
});
