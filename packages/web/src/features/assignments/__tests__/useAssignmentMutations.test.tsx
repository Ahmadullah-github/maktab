import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssignTeacher } from '../hooks/useAssignmentMutations';

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from 'sonner';

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

describe('useAssignTeacher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
      configurable: true,
    });
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('sends persistRequirementOverrides and shows a warning toast on successful trims', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            success: true,
            conflicts: [],
            warnings: [
              {
                type: 'coverage_insufficient',
                severity: 'warning',
                message: 'Trimmed to 1/3 periods',
                messageFa: 'تخصیص به 1 از 3 ساعت کاهش یافت',
                affectedEntities: {
                  teacherId: 1,
                  subjectId: 2,
                  classId: 3,
                },
              },
            ],
            updatedTeacherId: 1,
            updatedClassIds: [3],
          })
        ),
    });

    const { result } = renderHook(() => useAssignTeacher(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        teacherId: 1,
        subjectId: 2,
        classIds: [3],
        classPeriodOverrides: [{ classId: 3, periodsPerWeek: 3 }],
        persistRequirementOverrides: true,
      });
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, request] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toMatchObject({
      teacherId: 1,
      subjectId: 2,
      classIds: [3],
      classPeriodOverrides: [{ classId: 3, periodsPerWeek: 3 }],
      persistRequirementOverrides: true,
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith('تخصیص با هشدار ذخیره شد', {
        description: 'تخصیص به 1 از 3 ساعت کاهش یافت',
      });
    });
  });
});
