import { API_BASE_URL } from '@/lib/apiBase';
import { parseOperationResponse } from '@/types/operation';
import type { SolverGenerationPhase, SolverLastRun, SolverStatus } from '@/types/solver';
import { useQuery } from '@tanstack/react-query';
import { SCHEDULE_QUERY_KEYS } from '../constants';

const STATUS_POLL_INTERVAL_MS = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function normalizeLastRun(raw: unknown): SolverLastRun | undefined {
  if (!isRecord(raw) || typeof raw.outcome !== 'string' || typeof raw.finishedAt !== 'string') {
    return undefined;
  }

  if (
    raw.outcome !== 'success' &&
    raw.outcome !== 'partial' &&
    raw.outcome !== 'failed' &&
    raw.outcome !== 'cancelled'
  ) {
    return undefined;
  }

  return {
    outcome: raw.outcome,
    finishedAt: raw.finishedAt,
    issueCode: typeof raw.issueCode === 'string' ? raw.issueCode : undefined,
    timetableId: typeof raw.timetableId === 'number' ? raw.timetableId : undefined,
  };
}

function normalizePhase(raw: unknown): SolverGenerationPhase {
  if (
    raw === 'preparing' ||
    raw === 'analyzing' ||
    raw === 'validation' ||
    raw === 'modelBuilding' ||
    raw === 'solvingPhase1' ||
    raw === 'solvingPhase2' ||
    raw === 'formatting' ||
    raw === 'saving' ||
    raw === 'cancelling'
  ) {
    return raw;
  }
  return 'idle';
}

export function normalizeSolverStatus(raw: unknown): SolverStatus {
  if (!isRecord(raw)) {
    return {
      isRunning: false,
      phase: 'idle',
      canCancel: false,
    };
  }

  return {
    isRunning: Boolean(raw.isRunning),
    processId: typeof raw.processId === 'number' ? raw.processId : undefined,
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : undefined,
    phase: normalizePhase(raw.phase),
    phaseFarsi: typeof raw.phaseFarsi === 'string' ? raw.phaseFarsi : undefined,
    strategy: typeof raw.strategy === 'string' ? raw.strategy : undefined,
    percentComplete: typeof raw.percentComplete === 'number' ? raw.percentComplete : undefined,
    estimatedSecondsRemaining:
      typeof raw.estimatedSecondsRemaining === 'number' ? raw.estimatedSecondsRemaining : undefined,
    canCancel: Boolean(raw.canCancel),
    lastRun: normalizeLastRun(raw.lastRun),
  };
}

export async function fetchSolverStatus(): Promise<SolverStatus> {
  const response = await fetch(`${API_BASE_URL}/generate/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch solver status: ${response.statusText}`);
  }

  const data = await response.json();
  const operation = parseOperationResponse<SolverStatus>(data);
  if (!response.ok || !operation || !operation.data) {
    throw new Error('SOLVER_STATUS_ERROR');
  }
  return normalizeSolverStatus(operation.data);
}

export async function cancelSolverGeneration(): Promise<SolverStatus> {
  const response = await fetch(`${API_BASE_URL}/generate/cancel`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json().catch(() => null);
  const operation = parseOperationResponse<SolverStatus>(data);
  if (!response.ok || !operation || !operation.data) throw new Error('SOLVER_CANCEL_ERROR');
  return normalizeSolverStatus(operation.data);
}

export function useSolverStatus() {
  return useQuery({
    queryKey: SCHEDULE_QUERY_KEYS.generateStatus(),
    queryFn: fetchSolverStatus,
    refetchInterval: (query) => (query.state.data?.isRunning ? STATUS_POLL_INTERVAL_MS : false),
    refetchIntervalInBackground: true,
  });
}
