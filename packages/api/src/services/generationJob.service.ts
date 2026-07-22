import { randomUUID } from 'crypto';
import os from 'os';
import { DataSource, In } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { GenerationJob, GenerationJobMode, GenerationJobStatus } from '../entity/GenerationJob';
import { Timetable } from '../entity/Timetable';
import { TimetableCandidate } from '../entity/TimetableCandidate';
import { timetableDataSchema } from '../schemas/timetable.schema';
import { OperationIssue } from '../types/operation.types';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import { logger } from '../utils/logger';
import { findGeneratedPeriodBoundsIssues } from '../utils/periodConfiguration';
import { validateGeneratedTimetable } from './generatedTimetableValidation.service';
import { enrichGeneratedScheduleTiming } from './scheduleTiming.service';
import { SchoolConfigService } from './schoolConfig.service';
import { SolverError, SolverLastRun, SolverService } from './solver.service';
import {
  AssignmentReadinessError,
  SolverDataTransformerService,
} from './solverDataTransformer.service';
import { TimetableService } from './timetable.service';

const ACTIVE_STATUSES: GenerationJobStatus[] = [
  'queued',
  'preparing',
  'analyzing',
  'solving',
  'saving',
];

export interface CreateGenerationJobInput {
  mode?: GenerationJobMode;
  config?: { schoolId?: number | null; [key: string]: unknown };
  sourceTimetableId?: number;
}

export interface GenerationJobView {
  id: string;
  mode: GenerationJobMode;
  status: GenerationJobStatus;
  schoolId: number | null;
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
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimetableCandidateView {
  id: number;
  jobId: string;
  schoolId: number | null;
  sourceTimetableId: number | null;
  acceptedTimetableId: number | null;
  status: string;
  data?: unknown;
  sourceQualityScore: number | null;
  qualityScore: number | null;
  objectiveValue: number | null;
  bestBound: number | null;
  relativeGap: number | null;
  interrupted: boolean;
  metrics: Record<string, unknown>;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function qualityScore(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const score = (data as Record<string, unknown>).quality_score;
  if (!score || typeof score !== 'object') return null;
  return numberOrNull((score as Record<string, unknown>).overall);
}

function createScheduleName(): string {
  return `جدول زمانی - ${new Intl.DateTimeFormat('fa-IR').format(new Date())}`;
}

function effectiveSolverConfig(mode: GenerationJobMode, classCount: number) {
  const logicalCpus = Math.max(1, os.cpus().length);
  const memoryGb = os.totalmem() / 1024 ** 3;
  const reservedCpus = logicalCpus >= 8 ? 2 : 1;
  const cpuBudget = Math.max(1, logicalCpus - reservedCpus);
  const memoryWorkerCap = memoryGb < 6 ? 2 : memoryGb < 10 ? 4 : 6;
  const workerCap = mode === 'quick' ? 4 : 6;
  const workers = Math.max(1, Math.min(cpuBudget, memoryWorkerCap, workerCap));
  const quickSeconds = classCount <= 10 ? 120 : classCount <= 20 ? 240 : 300;

  return {
    solverMode: mode,
    solverWorkers: workers,
    solverQuickTimeLimitSeconds: quickSeconds,
    solverFallbackTimeLimitSeconds: 600,
    solverTimeLimitSeconds: mode === 'quick' ? 600 : 900,
    solverHardTimeLimitSeconds: mode === 'quick' ? 600 : 1200,
    solverMemoryLimitMb: Math.max(768, Math.min(4096, Math.floor(memoryGb * 1024 * 0.45))),
    hardwareProfile: {
      logicalCpus,
      reservedCpus,
      memoryGb: Math.round(memoryGb * 10) / 10,
    },
  };
}

/**
 * Owns the durable generation lifecycle. HTTP requests only enqueue/read/cancel;
 * this service performs the long-running work independently of the response socket.
 */
export class GenerationJobService {
  private runningJobId: string | null = null;

  private constructor(
    private readonly dataSource: DataSource,
    private readonly cacheManager?: CacheManager
  ) {}

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): GenerationJobService {
    return getDataSourceScopedInstance(
      dataSource,
      GenerationJobService,
      () => new GenerationJobService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(GenerationJobService);
  }

  async recoverInterruptedJobs(): Promise<number> {
    const repository = this.dataSource.getRepository(GenerationJob);
    const activeJobs = await repository.find({ where: { status: In(ACTIVE_STATUSES) } });
    if (activeJobs.length === 0) return 0;

    const now = new Date();
    for (const job of activeJobs) {
      job.status = 'failed';
      job.phase = 'failed';
      job.phaseFarsi = 'اجرای قبلی پس از راه‌اندازی مجدد متوقف شد';
      job.failureCode = 'APPLICATION_RESTARTED';
      job.finishedAt = now;
      job.updatedAt = now;
      job.issuesJson = JSON.stringify([
        {
          code: 'APPLICATION_RESTARTED',
          severity: 'error',
          category: 'system',
          phase: 'solving',
          blocking: true,
          retryable: true,
          messageParams: {},
          affectedEntities: [],
        },
      ]);
    }
    await repository.save(activeJobs);
    logger.warn('Recovered interrupted generation jobs', { count: activeJobs.length });
    return activeJobs.length;
  }

  async enqueue(input: CreateGenerationJobInput, diagnosticId: string): Promise<GenerationJobView> {
    const mode = input.mode ?? 'quick';
    if (mode === 'improve' && !input.sourceTimetableId) {
      throw Object.assign(new Error('sourceTimetableId is required for improvement'), {
        code: 'SOURCE_TIMETABLE_REQUIRED',
      });
    }

    const repository = this.dataSource.getRepository(GenerationJob);
    const active = await repository.findOne({ where: { status: In(ACTIVE_STATUSES) } });
    if (active) {
      throw Object.assign(new Error('A generation job is already active'), {
        code: 'SOLVER_BUSY',
        activeJob: this.toView(active),
      });
    }

    if (input.sourceTimetableId) {
      const source = await TimetableService.getInstance(
        this.dataSource,
        this.cacheManager
      ).findById(input.sourceTimetableId);
      if (!source.success || !source.data) {
        throw Object.assign(new Error('Source timetable was not found'), {
          code: 'SOURCE_TIMETABLE_NOT_FOUND',
        });
      }
    }

    const job = repository.create({
      id: randomUUID(),
      mode,
      status: 'queued',
      schoolId: input.config?.schoolId ?? null,
      sourceTimetableId: input.sourceTimetableId ?? null,
      requestJson: JSON.stringify(input),
      diagnosticId,
      phase: 'queued',
      phaseFarsi: 'در صف اجرا...',
    });

    try {
      await repository.save(job);
    } catch (error) {
      if (String(error).includes('UQ_generation_job_one_active')) {
        throw Object.assign(new Error('A generation job is already active'), {
          code: 'SOLVER_BUSY',
        });
      }
      throw error;
    }

    setImmediate(() => {
      void this.execute(job.id).catch((error) => {
        logger.error(
          'Unhandled generation job failure',
          error instanceof Error ? error : new Error(String(error)),
          { jobId: job.id }
        );
      });
    });
    return this.toView(job);
  }

  async get(jobId: string): Promise<GenerationJobView | null> {
    const job = await this.dataSource.getRepository(GenerationJob).findOne({ where: { id: jobId } });
    if (!job) return null;
    if (this.runningJobId === job.id) await this.syncProgress(job);
    return this.toView(job);
  }

  async getActive(): Promise<GenerationJobView | null> {
    const job = await this.dataSource
      .getRepository(GenerationJob)
      .findOne({ where: { status: In(ACTIVE_STATUSES) }, order: { createdAt: 'DESC' } });
    if (!job) return null;
    if (this.runningJobId === job.id) await this.syncProgress(job);
    return this.toView(job);
  }

  async cancel(jobId: string): Promise<GenerationJobView | null> {
    const repository = this.dataSource.getRepository(GenerationJob);
    const job = await repository.findOne({ where: { id: jobId } });
    if (!job || !ACTIVE_STATUSES.includes(job.status)) return null;

    job.cancelRequested = true;
    job.phase = 'cancelling';
    job.phaseFarsi = 'در حال لغو تولید جدول زمانی...';
    job.updatedAt = new Date();
    await repository.save(job);
    SolverService.getInstance().requestCancel();
    return this.toView(job);
  }

  async listCandidates(sourceTimetableId?: number): Promise<TimetableCandidateView[]> {
    const repository = this.dataSource.getRepository(TimetableCandidate);
    const candidates = await repository.find({
      where: sourceTimetableId ? { sourceTimetableId } : {},
      order: { createdAt: 'DESC' },
    });
    return candidates.map((candidate) => this.toCandidateView(candidate, false));
  }

  async getCandidate(id: number): Promise<TimetableCandidateView | null> {
    const candidate = await this.dataSource
      .getRepository(TimetableCandidate)
      .findOne({ where: { id } });
    return candidate ? this.toCandidateView(candidate) : null;
  }

  async discardCandidate(id: number): Promise<boolean> {
    const repository = this.dataSource.getRepository(TimetableCandidate);
    const candidate = await repository.findOne({ where: { id } });
    if (!candidate || candidate.status !== 'available') return false;
    candidate.status = 'discarded';
    candidate.updatedAt = new Date();
    await repository.save(candidate);
    return true;
  }

  async acceptCandidate(id: number): Promise<{ candidate: TimetableCandidateView; timetable: unknown } | null> {
    return this.dataSource.transaction(async (manager) => {
      const candidateRepository = manager.getRepository(TimetableCandidate);
      const candidate = await candidateRepository.findOne({ where: { id } });
      if (!candidate || candidate.status !== 'available') return null;

      const source = candidate.sourceTimetableId
        ? await manager.getRepository(Timetable).findOne({
            where: { id: candidate.sourceTimetableId, isDeleted: false },
          })
        : null;

      const data = timetableDataSchema.parse(parseJson(candidate.data, null));
      const timetable = manager.getRepository(Timetable).create({
        schoolId: candidate.schoolId,
        academicYearId: source?.academicYearId ?? null,
        termId: source?.termId ?? null,
        name: source ? `${source.name} - بهبود یافته` : createScheduleName(),
        description: source?.description ?? '',
        data: JSON.stringify(data),
      });
      const saved = await manager.getRepository(Timetable).save(timetable);

      candidate.status = 'accepted';
      candidate.acceptedTimetableId = saved.id;
      candidate.acceptedAt = new Date();
      candidate.updatedAt = new Date();
      await candidateRepository.save(candidate);

      return {
        candidate: this.toCandidateView(candidate),
        timetable: { ...saved, data },
      };
    });
  }

  private async execute(jobId: string): Promise<void> {
    if (this.runningJobId) return;
    this.runningJobId = jobId;
    const repository = this.dataSource.getRepository(GenerationJob);
    const job = await repository.findOne({ where: { id: jobId } });
    if (!job) {
      this.runningJobId = null;
      return;
    }

    const request = parseJson<CreateGenerationJobInput>(job.requestJson, {});
    const solver = SolverService.getInstance();
    let lastRun: SolverLastRun | undefined;
    let progressTimer: NodeJS.Timeout | undefined;

    try {
      job.status = 'preparing';
      job.phase = 'preparing';
      job.phaseFarsi = 'در حال آماده‌سازی داده‌ها...';
      job.startedAt = new Date();
      job.updatedAt = new Date();
      await repository.save(job);

      solver.beginRun(job.mode);
      progressTimer = setInterval(() => void this.syncProgress(job), 1000);

      let sourceData: unknown = null;
      if (job.sourceTimetableId) {
        const sourceResult = await TimetableService.getInstance(
          this.dataSource,
          this.cacheManager
        ).findById(job.sourceTimetableId);
        if (!sourceResult.success || !sourceResult.data) {
          throw Object.assign(new Error('Source timetable no longer exists'), {
            code: 'SOURCE_TIMETABLE_NOT_FOUND',
          });
        }
        sourceData = sourceResult.data.data;
      }

      const transformer = SolverDataTransformerService.getInstance(
        this.dataSource,
        this.cacheManager
      );
      const solverInput = await transformer.transformToSolverInput({
        schoolId: request.config?.schoolId,
        strategy: job.mode === 'quick' ? 'fast' : 'thorough',
      });
      const effectiveConfig = effectiveSolverConfig(job.mode, solverInput.classes.length);
      solverInput.config = {
        ...solverInput.config,
        ...effectiveConfig,
        ...(job.mode === 'improve' && sourceData && typeof sourceData === 'object'
          ? { initialSolution: (sourceData as Record<string, unknown>).schedule ?? [] }
          : {}),
      };
      job.effectiveConfigJson = JSON.stringify(effectiveConfig);
      await repository.save(job);
      solver.throwIfCancellationRequested();

      job.status = 'analyzing';
      await repository.save(job);
      const analysis = await solver.runPreSolveAnalysis(solverInput);
      if (analysis.outcome === 'failed') {
        const firstIssue = analysis.issues.find((issue) => issue.blocking);
        await this.failJob(job, firstIssue?.code ?? 'PRE_SOLVE_FAILED', analysis.issues, analysis.metadata);
        lastRun = { outcome: 'failed', finishedAt: new Date(), issueCode: firstIssue?.code };
        return;
      }

      job.status = 'solving';
      await repository.save(job);
      const timeoutMs = Number(effectiveConfig.solverHardTimeLimitSeconds) * 1000 + 30_000;
      const result = await solver.runSolver(solverInput, { timeoutMs });
      if (result.outcome === 'failed' || !result.data) {
        const firstIssue = result.issues.find((issue) => issue.blocking);
        await this.failJob(job, firstIssue?.code ?? 'SOLVER_FAILED', result.issues, result.metadata);
        lastRun = { outcome: 'failed', finishedAt: new Date(), issueCode: firstIssue?.code };
        return;
      }

      result.issues = [...analysis.issues, ...result.issues];
      const periodIssues = findGeneratedPeriodBoundsIssues(result.data, solverInput);
      if (periodIssues.length > 0) {
        await this.failJob(job, 'INVALID_GENERATED_PERIOD_BOUNDS', [], {
          issueCount: periodIssues.length,
        });
        return;
      }
      const invariantIssues = validateGeneratedTimetable(result.data, solverInput);
      if (invariantIssues.length > 0) {
        await this.failJob(job, 'INVALID_GENERATED_TIMETABLE', [], {
          issueCount: invariantIssues.length,
        });
        return;
      }

      const schoolConfig = await SchoolConfigService.getInstance(
        this.dataSource,
        this.cacheManager
      ).getConfig(request.config?.schoolId ?? null);
      let scheduleData = enrichGeneratedScheduleTiming(result.data, schoolConfig) as Record<
        string,
        unknown
      >;
      scheduleData = {
        ...scheduleData,
        status: result.outcome,
        quality_score:
          result.metadata.qualityScore && typeof result.metadata.qualityScore === 'object'
            ? result.metadata.qualityScore
            : null,
      };

      job.status = 'saving';
      job.progress = 100;
      await repository.save(job);
      solver.setSavingPhase();

      const interrupted = result.metadata.interrupted === true;
      if (job.mode === 'quick' && !interrupted) {
        const saveResult = await TimetableService.getInstance(
          this.dataSource,
          this.cacheManager
        ).create({
          name: createScheduleName(),
          description: '',
          data: scheduleData,
          schoolId: request.config?.schoolId ?? null,
        });
        if (!saveResult.success || !saveResult.data) {
          throw Object.assign(new Error(saveResult.error ?? 'Unable to save timetable'), {
            code: 'TIMETABLE_SAVE_ERROR',
          });
        }
        job.resultTimetableId = saveResult.data.id;
        lastRun = { outcome: result.outcome, finishedAt: new Date(), timetableId: saveResult.data.id };
      } else {
        const sourceScore = qualityScore(sourceData);
        const improvedScore = qualityScore(scheduleData);
        const demonstrablyNotBetter =
          !interrupted &&
          sourceScore !== null &&
          improvedScore !== null &&
          improvedScore <= sourceScore;
        if (!demonstrablyNotBetter) {
          const candidate = this.dataSource.getRepository(TimetableCandidate).create({
            jobId: job.id,
            schoolId: job.schoolId,
            sourceTimetableId: job.sourceTimetableId,
            data: JSON.stringify(timetableDataSchema.parse(scheduleData)),
            sourceQualityScore: sourceScore,
            qualityScore: improvedScore,
            objectiveValue: numberOrNull(
              result.metadata.objectiveValue ?? result.metadata.objective_value
            ),
            bestBound: numberOrNull(result.metadata.bestBound ?? result.metadata.best_bound),
            relativeGap: numberOrNull(
              result.metadata.relativeGap ?? result.metadata.relative_gap
            ),
            interrupted,
            metricsJson: JSON.stringify(result.metadata),
          });
          await this.dataSource.getRepository(TimetableCandidate).save(candidate);
          job.resultCandidateId = candidate.id;
        } else {
          result.metadata.noImprovement = true;
        }
        lastRun = { outcome: result.outcome, finishedAt: new Date() };
      }

      job.status = interrupted ? 'cancelled' : 'completed';
      job.phase = job.status;
      job.phaseFarsi = interrupted
        ? 'تولید لغو شد؛ آخرین راه حل معتبر حفظ شد'
        : 'تولید با موفقیت تکمیل شد';
      job.failureCode = interrupted ? 'SOLVER_CANCELLED' : null;
      job.progress = 100;
      job.issuesJson = JSON.stringify(result.issues);
      job.metricsJson = JSON.stringify(result.metadata);
      job.finishedAt = new Date();
      job.updatedAt = new Date();
      await repository.save(job);
      if (interrupted) {
        lastRun = {
          outcome: 'cancelled',
          finishedAt: new Date(),
          issueCode: 'SOLVER_CANCELLED',
        };
      }
    } catch (error) {
      const solverError = error as SolverError;
      const cancelled = solverError.code === 'SOLVER_CANCELLED' || job.cancelRequested;
      const issues = error instanceof AssignmentReadinessError ? error.issues : [];
      job.status = cancelled ? 'cancelled' : 'failed';
      job.phase = job.status;
      job.phaseFarsi = cancelled ? 'تولید لغو شد' : 'تولید جدول زمانی ناموفق بود';
      job.failureCode = cancelled
        ? 'SOLVER_CANCELLED'
        : error instanceof AssignmentReadinessError
          ? error.code
          : solverError.code ?? 'SOLVER_ERROR';
      job.issuesJson = JSON.stringify(issues);
      job.finishedAt = new Date();
      job.updatedAt = new Date();
      await repository.save(job);
      lastRun = {
        outcome: cancelled ? 'cancelled' : 'failed',
        finishedAt: new Date(),
        issueCode: job.failureCode,
      };
      logger.error(
        'Generation job failed',
        error instanceof Error ? error : new Error(String(error)),
        { jobId: job.id, code: job.failureCode }
      );
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      solver.finishRun(lastRun);
      this.runningJobId = null;
    }
  }

  private async syncProgress(job: GenerationJob): Promise<void> {
    if (!ACTIVE_STATUSES.includes(job.status)) return;
    const status = SolverService.getInstance().getStatus();
    if (!status.isRunning) return;
    job.phase = status.phase;
    job.phaseFarsi = status.phaseFarsi ?? job.phaseFarsi;
    job.progress = status.percentComplete ?? job.progress;
    job.updatedAt = new Date();
    await this.dataSource.getRepository(GenerationJob).save(job);
  }

  private async failJob(
    job: GenerationJob,
    code: string,
    issues: OperationIssue[],
    metrics: Record<string, unknown>
  ): Promise<void> {
    job.status = 'failed';
    job.phase = 'failed';
    job.phaseFarsi = 'راه حل معتبر پیدا نشد';
    job.failureCode = code;
    job.issuesJson = JSON.stringify(issues);
    job.metricsJson = JSON.stringify(metrics);
    job.finishedAt = new Date();
    job.updatedAt = new Date();
    await this.dataSource.getRepository(GenerationJob).save(job);
  }

  private toView(job: GenerationJob): GenerationJobView {
    return {
      id: job.id,
      mode: job.mode,
      status: job.status,
      schoolId: job.schoolId,
      sourceTimetableId: job.sourceTimetableId,
      resultTimetableId: job.resultTimetableId,
      resultCandidateId: job.resultCandidateId,
      progress: job.progress,
      phase: job.phase,
      phaseFarsi: job.phaseFarsi,
      canCancel: ACTIVE_STATUSES.includes(job.status) && !job.cancelRequested,
      cancelRequested: job.cancelRequested,
      effectiveConfig: parseJson(job.effectiveConfigJson, {}),
      metrics: parseJson(job.metricsJson, {}),
      issues: parseJson(job.issuesJson, []),
      failureCode: job.failureCode,
      diagnosticId: job.diagnosticId,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private toCandidateView(
    candidate: TimetableCandidate,
    includeData: boolean = true
  ): TimetableCandidateView {
    return {
      id: candidate.id,
      jobId: candidate.jobId,
      schoolId: candidate.schoolId,
      sourceTimetableId: candidate.sourceTimetableId,
      acceptedTimetableId: candidate.acceptedTimetableId,
      status: candidate.status,
      ...(includeData ? { data: parseJson(candidate.data, null) } : {}),
      sourceQualityScore: candidate.sourceQualityScore,
      qualityScore: candidate.qualityScore,
      objectiveValue: candidate.objectiveValue,
      bestBound: candidate.bestBound,
      relativeGap: candidate.relativeGap,
      interrupted: candidate.interrupted,
      metrics: parseJson(candidate.metricsJson, {}),
      acceptedAt: candidate.acceptedAt,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };
  }
}
