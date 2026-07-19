import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportRequest } from '@/schemas/export.schema';
import { exportApi } from '../api/export.api';
import { useExportSchedule } from './useExportSchedule';

vi.mock('../api/export.api', () => ({
  exportApi: {
    exportSchedule: vi.fn(),
    getExportProgress: vi.fn(),
    getExportJob: vi.fn(),
    downloadFile: vi.fn(),
    cancelExport: vi.fn(),
  },
  isExportJob: (response: object) => 'jobId' in response,
}));

const request: ExportRequest = {
  scheduleId: 1,
  format: 'pdf',
  scope: 'all-classes',
  targetType: 'class',
  language: 'fa',
  displaySettings: {
    showSubjectName: true,
    showTeacherName: true,
    showRoomName: true,
    cellSize: 'normal',
    fontSize: 'md',
    colorBy: 'none',
  },
};

describe('useExportSchedule batch polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(exportApi.exportSchedule).mockResolvedValue({
      jobId: 'job-123',
      status: 'started',
    });
    vi.mocked(exportApi.getExportProgress).mockResolvedValue({
      current: 2,
      total: 2,
      status: 'complete',
      message: 'done',
    });
    vi.mocked(exportApi.getExportJob).mockResolvedValue({
      jobId: 'job-123',
      status: 'completed',
      downloadUrl: '/api/export/download/token',
      filename: 'schedule.pdf',
    });
    vi.mocked(exportApi.downloadFile).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('polls the job returned by the mutation and downloads it on completion', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useExportSchedule(), { wrapper });

    await act(async () => {
      await result.current.exportSchedule(request);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(exportApi.getExportProgress).toHaveBeenCalledWith('job-123');
    expect(exportApi.getExportJob).toHaveBeenCalledWith('job-123');
    expect(exportApi.downloadFile).toHaveBeenCalledWith(
      '/api/export/download/token',
      'schedule.pdf'
    );
  });
});
