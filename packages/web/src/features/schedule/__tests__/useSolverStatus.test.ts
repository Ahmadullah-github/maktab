import { describe, expect, it } from 'vitest';
import { normalizeSolverStatus } from '../hooks/useSolverStatus';

describe('normalizeSolverStatus', () => {
  it('normalizes a running solver payload with shared progress data', () => {
    const status = normalizeSolverStatus({
      isRunning: true,
      processId: 1234,
      startedAt: '2026-04-07T12:00:00.000Z',
      phase: 'solvingPhase2',
      phaseFarsi: 'در حال حل (مرحله ۲)...',
      strategy: 'balanced',
      percentComplete: 85,
      estimatedSecondsRemaining: 12,
      canCancel: true,
      lastRun: {
        outcome: 'failed',
        finishedAt: '2026-04-07T11:55:00.000Z',
        messageFarsi: 'خطا در تولید جدول زمانی',
      },
    });

    expect(status).toEqual({
      isRunning: true,
      processId: 1234,
      startedAt: '2026-04-07T12:00:00.000Z',
      phase: 'solvingPhase2',
      phaseFarsi: 'در حال حل (مرحله ۲)...',
      strategy: 'balanced',
      percentComplete: 85,
      estimatedSecondsRemaining: 12,
      canCancel: true,
      lastRun: {
        outcome: 'failed',
        finishedAt: '2026-04-07T11:55:00.000Z',
        messageFarsi: 'خطا در تولید جدول زمانی',
        messageEnglish: undefined,
        timetableId: undefined,
      },
    });
  });

  it('falls back to an idle status for invalid payloads', () => {
    expect(normalizeSolverStatus(null)).toEqual({
      isRunning: false,
      phase: 'idle',
      canCancel: false,
    });
  });
});
