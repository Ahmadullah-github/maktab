import { SCHEDULE_QUERY_KEYS } from '@/features/schedule/constants';
import type { SolverStrategy } from '@/features/schedule/types';
import { useCanGenerate } from '@/hooks/useLicense';
import { API_BASE_URL } from '@/lib/apiBase';
import { useLicenseStore } from '@/stores/licenseStore';
import {
  createClientIssue,
  parseOperationResponse,
  type OperationIssue,
} from '@/types/operation';
import type { QualityScore, SolverResponse, SolverStatus } from '@/types/solver';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type GenerationJobMode = 'quick' | 'improve';
export type GenerationJobStatus =
  | 'queued'
  | 'preparing'
  | 'analyzing'
  | 'solving'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GenerationJob {
  id: string;
  mode: GenerationJobMode;
  status: GenerationJobStatus;
  sourceTimetableId: number | null;
  resultTimetableId: number | null;
  resultCandidateId: number | null;
  progress: number;
  phase: string | null;
  phaseFarsi: string | null;
  canCancel: boolean;
  cancelRequested: boolean;
  effectiveConfig: Record<string, unknown>;
  metrics: Record<string, unknown>;
  issues: OperationIssue[];
  failureCode: string | null;
  diagnosticId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateJobInput {
  mode: GenerationJobMode;
  sourceTimetableId?: number;
  config: { schoolId?: number | null };
}

export interface ScheduleGenerationError {
  type: string;
  errors: OperationIssue[];
  warnings: OperationIssue[];
  diagnosticId: string;
}

class JobApiError extends Error {
  constructor(
    readonly code: string,
    readonly issues: OperationIssue[] = [createClientIssue(code, true)],
    readonly diagnosticId = `client-${Date.now()}`
  ) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isGenerationJob(value: unknown): value is GenerationJob {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.mode === 'quick' || value.mode === 'improve') &&
    typeof value.status === 'string' &&
    typeof value.progress === 'number' &&
    Array.isArray(value.issues)
  );
}

async function readJobResponse(response: Response): Promise<GenerationJob | null> {
  const raw = await response.json().catch(() => null);
  const operation = parseOperationResponse<{ job: unknown }>(raw);
  if (!operation) throw new JobApiError('CLIENT_PROTOCOL_ERROR');
  if (!response.ok || operation.outcome === 'failed') {
    throw new JobApiError(
      operation.issues[0]?.code ?? 'GENERATION_JOB_ERROR',
      operation.issues,
      operation.diagnosticId
    );
  }
  const job = operation.data?.job;
  if (job === null || job === undefined) return null;
  if (!isGenerationJob(job)) throw new JobApiError('CLIENT_PROTOCOL_ERROR');
  return job;
}

async function createJob(input: CreateJobInput): Promise<GenerationJob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/generate/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new JobApiError('CLIENT_NETWORK_ERROR');
  }
  const job = await readJobResponse(response);
  if (!job) throw new JobApiError('CLIENT_PROTOCOL_ERROR');
  return job;
}

async function fetchJob(jobId: string): Promise<GenerationJob> {
  const response = await fetch(`${API_BASE_URL}/generate/jobs/${jobId}`);
  const job = await readJobResponse(response);
  if (!job) throw new JobApiError('GENERATION_JOB_NOT_FOUND');
  return job;
}

async function fetchActiveJob(): Promise<GenerationJob | null> {
  const response = await fetch(`${API_BASE_URL}/generate/jobs/active`);
  return readJobResponse(response);
}

async function cancelJob(jobId: string): Promise<GenerationJob> {
  const response = await fetch(`${API_BASE_URL}/generate/jobs/${jobId}`, {
    method: 'DELETE',
  });
  const job = await readJobResponse(response);
  if (!job) throw new JobApiError('SOLVER_CANCEL_ERROR');
  return job;
}

function isActive(status: GenerationJobStatus | undefined): boolean {
  return Boolean(
    status && ['queued', 'preparing', 'analyzing', 'solving', 'saving'].includes(status)
  );
}

function toSolverStatus(job: GenerationJob | null): SolverStatus | null {
  if (!job) return null;
  const phase =
    job.status === 'queued' || job.status === 'preparing'
      ? 'preparing'
      : job.status === 'analyzing'
        ? 'analyzing'
        : job.status === 'saving'
          ? 'saving'
          : job.cancelRequested
            ? 'cancelling'
            : job.status === 'solving'
              ? 'solvingPhase1'
              : 'idle';
  const terminal = !isActive(job.status);
  return {
    isRunning: !terminal,
    startedAt: job.startedAt ?? job.createdAt,
    phase,
    phaseFarsi: job.phaseFarsi ?? undefined,
    strategy: job.mode,
    percentComplete: job.progress,
    canCancel: job.canCancel,
    lastRun: terminal
      ? {
          outcome:
            job.status === 'completed'
              ? 'success'
              : job.status === 'cancelled'
                ? 'cancelled'
                : 'failed',
          finishedAt: job.finishedAt ?? job.updatedAt,
          issueCode: job.failureCode ?? undefined,
          timetableId: job.resultTimetableId ?? undefined,
        }
      : undefined,
  };
}

export interface UseGenerateScheduleReturn {
  generate: (strategy?: SolverStrategy) => void;
  improve: (sourceTimetableId: number) => void;
  cancel: () => void;
  isGenerating: boolean;
  elapsedTime: number;
  error: ScheduleGenerationError | null;
  solverResponse: SolverResponse | null;
  qualityScore: QualityScore | null;
  warnings: OperationIssue[];
  reset: () => void;
  isLoadingInputData: boolean;
  canGenerate: boolean;
  blockedReason: string | null;
  retry: () => void;
  lastStrategy: SolverStrategy | null;
  solverStatus: SolverStatus | null;
  generationJob: GenerationJob | null;
  resultTimetableId: number | null;
  resultCandidateId: number | null;
}

export function useGenerateSchedule(): UseGenerateScheduleReturn {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canGenerateLicense = useCanGenerate();
  const licenseStatus = useLicenseStore((state) => state.status);
  const [jobId, setJobId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [apiError, setApiError] = useState<ScheduleGenerationError | null>(null);
  const lastRequestRef = useRef<CreateJobInput | null>(null);
  const handledTerminalRef = useRef<string | null>(null);

  const activeQuery = useQuery({
    queryKey: [...SCHEDULE_QUERY_KEYS.generateStatus(), 'active-job'],
    queryFn: fetchActiveJob,
    enabled: jobId === null,
    refetchInterval: false,
  });

  useEffect(() => {
    if (activeQuery.data?.id) setJobId(activeQuery.data.id);
  }, [activeQuery.data?.id]);

  const jobQuery = useQuery({
    queryKey: [...SCHEDULE_QUERY_KEYS.generateStatus(), jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) =>
      isActive(query.state.data?.status) ? 1000 : false,
    refetchIntervalInBackground: true,
  });

  const generationJob = jobQuery.data ?? activeQuery.data ?? null;
  const isGenerating = isActive(generationJob?.status);

  const jobStartedAt = generationJob?.startedAt ?? generationJob?.createdAt ?? null;
  useEffect(() => {
    if (!isGenerating || !jobStartedAt) return;
    const started = Date.parse(jobStartedAt);
    const update = () => setElapsedTime(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [isGenerating, jobStartedAt]);

  useEffect(() => {
    if (!generationJob || isGenerating || handledTerminalRef.current === generationJob.id) return;
    handledTerminalRef.current = generationJob.id;
    void queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEYS.all });

    if (generationJob.status === 'completed') {
      if (generationJob.resultCandidateId) {
        toast.success('نسخهٔ بهبود یافته برای مقایسه آماده است');
      } else if (generationJob.metrics.noImprovement === true) {
        toast.info('راه حل بهتر از جدول فعلی پیدا نشد');
      } else {
        toast.success(t('errors.notifications.generated'));
      }
    } else if (generationJob.status === 'cancelled' && generationJob.resultCandidateId) {
      toast.info('تولید لغو شد؛ آخرین راه حل معتبر حفظ شد');
    } else if (generationJob.status === 'failed') {
      toast.error(t('errors.notifications.failed'));
    }
  }, [generationJob, isGenerating, queryClient, t]);

  const mutation = useMutation({
    mutationFn: createJob,
    onMutate: (input) => {
      lastRequestRef.current = input;
      setApiError(null);
      setElapsedTime(0);
      handledTerminalRef.current = null;
    },
    onSuccess: (job) => {
      setJobId(job.id);
      queryClient.setQueryData([...SCHEDULE_QUERY_KEYS.generateStatus(), job.id], job);
    },
    onError: (error: JobApiError) => {
      const blockingIssues = error.issues.filter((issue) => issue.blocking);
      setApiError({
        type: error.code,
        errors:
          blockingIssues.length > 0
            ? blockingIssues
            : [createClientIssue(error.code, error.code === 'CLIENT_NETWORK_ERROR')],
        warnings: error.issues.filter((issue) => !issue.blocking),
        diagnosticId: error.diagnosticId,
      });
    },
  });

  const blockedReason = useMemo(() => {
    if (canGenerateLicense) return null;
    if (licenseStatus?.mode === 'trial_expired') return t('errors.license.trialExpired');
    if (licenseStatus?.mode === 'license_expired') return t('errors.license.expired');
    return t('errors.license.required');
  }, [canGenerateLicense, licenseStatus?.mode, t]);

  const run = useCallback(
    (input: CreateJobInput) => {
      if (!canGenerateLicense) {
        toast.error(blockedReason ?? t('errors.license.required'));
        return;
      }
      mutation.mutate(input);
    },
    [blockedReason, canGenerateLicense, mutation, t]
  );

  const generate = useCallback(() => run({ mode: 'quick', config: {} }), [run]);
  const improve = useCallback(
    (sourceTimetableId: number) => run({ mode: 'improve', sourceTimetableId, config: {} }),
    [run]
  );

  const cancel = useCallback(() => {
    if (!generationJob?.id) return;
    void cancelJob(generationJob.id)
      .then((job) => {
        queryClient.setQueryData([...SCHEDULE_QUERY_KEYS.generateStatus(), job.id], job);
        toast.info(t('errors.notifications.cancelRequested'));
      })
      .catch(() => toast.error(t('errors.notifications.cancelFailed')));
  }, [generationJob?.id, queryClient, t]);

  const retry = useCallback(() => {
    if (lastRequestRef.current) run(lastRequestRef.current);
  }, [run]);

  const reset = useCallback(() => {
    mutation.reset();
    setApiError(null);
    setElapsedTime(0);
    setJobId(null);
  }, [mutation]);

  const terminalError = useMemo<ScheduleGenerationError | null>(() => {
    if (!generationJob || generationJob.status !== 'failed') return null;
    const errors = generationJob.issues.filter((issue) => issue.blocking);
    const code = generationJob.failureCode ?? 'SOLVER_ERROR';
    return {
      type: code,
      errors: errors.length > 0 ? errors : [createClientIssue(code, code === 'SOLVER_TIMEOUT')],
      warnings: generationJob.issues.filter((issue) => !issue.blocking),
      diagnosticId: generationJob.diagnosticId ?? 'generation-job',
    };
  }, [generationJob]);

  const solverStatus = useMemo(() => toSolverStatus(generationJob), [generationJob]);
  const qualityScore =
    generationJob?.metrics.qualityScore && typeof generationJob.metrics.qualityScore === 'object'
      ? (generationJob.metrics.qualityScore as QualityScore)
      : null;

  return {
    generate,
    improve,
    cancel,
    isGenerating: mutation.isPending || isGenerating,
    elapsedTime,
    error: apiError ?? terminalError,
    solverResponse: null,
    qualityScore,
    warnings: generationJob?.issues.filter((issue) => !issue.blocking) ?? [],
    reset,
    isLoadingInputData: activeQuery.isLoading,
    canGenerate: canGenerateLicense,
    blockedReason,
    retry,
    lastStrategy: generationJob?.mode === 'improve' ? 'thorough' : 'fast',
    solverStatus,
    generationJob,
    resultTimetableId: generationJob?.resultTimetableId ?? null,
    resultCandidateId: generationJob?.resultCandidateId ?? null,
  };
}
