import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimetableApiResponse } from './types';
import { useScheduleStore } from './stores/scheduleStore';
import { useScheduleRouteLoader } from './hooks/useScheduleRouteLoader';

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('./api', () => ({
  scheduleApi: {
    getAll: mocks.getAll,
    getById: mocks.getById,
  },
}));

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe('useScheduleRouteLoader', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getAll.mockReset();
    mocks.getById.mockReset();
    useScheduleStore.setState({
      scheduleId: null,
      isLoading: false,
      error: null,
    });
  });

  it('resolves a direct route entry while React Strict Mode replays effects', async () => {
    const schedule = {
      id: 1,
      createdAt: '2026-07-19T05:15:18.572Z',
    } as TimetableApiResponse;
    mocks.getAll.mockResolvedValue([schedule]);
    const navigateToSchedule = vi.fn().mockResolvedValue(undefined);

    renderHook(
      () =>
        useScheduleRouteLoader({
          scheduleId: undefined,
          navigateToSchedule,
          logScope: 'StrictModeTest',
        }),
      { wrapper: StrictModeWrapper }
    );

    await waitFor(() => expect(navigateToSchedule).toHaveBeenCalledWith(1));
    expect(navigateToSchedule).toHaveBeenCalledTimes(1);
    expect(mocks.getAll).toHaveBeenCalledTimes(1);
    expect(mocks.getById).not.toHaveBeenCalled();
  });
});
