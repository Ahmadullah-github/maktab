/**
 * Route handlers for generate endpoints
 * @module routes/generate/handlers
 */

import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { ERROR_CODES, HTTP_STATUS } from '../../constants';
import { CacheManager } from '../../database/cache/cacheManager';
import { TimetableService } from '../../services/timetable.service';
import { SolverError, SolverLastRun, SolverService } from '../../services/solver.service';
import { SolverDataTransformerService } from '../../services/solverDataTransformer.service';
import { logger } from '../../utils/logger';

let dataSourceRef: DataSource | null = null;
let cacheManagerRef: CacheManager | null = null;

export function initializeHandlers(dataSource: DataSource, cacheManager?: CacheManager): void {
  dataSourceRef = dataSource;
  cacheManagerRef = cacheManager ?? CacheManager.getInstance();
}

function createStructuredFailure(
  errorCode: string,
  messageFarsi: string,
  messageEnglish: string,
  context: Record<string, unknown> = {},
  solverStatus?: ReturnType<SolverService['getStatus']>
) {
  return {
    success: false,
    status: 'failed' as const,
    data: null,
    errors: [
      {
        error_code: errorCode,
        severity: 'error' as const,
        message_key: `error.${errorCode.toLowerCase()}`,
        message_farsi: messageFarsi,
        message_english: messageEnglish,
        affected_entities: [],
        context,
      },
    ],
    warnings: [],
    quality_score: null,
    metadata: {},
    solverStatus,
  };
}

function getTimetableService(): TimetableService {
  return TimetableService.getInstance(dataSourceRef!, cacheManagerRef ?? undefined);
}

function createScheduleName(): string {
  return `جدول زمانی - ${new Intl.DateTimeFormat('fa-IR').format(new Date())}`;
}

function createLastRunSummary(
  outcome: SolverLastRun['outcome'],
  options?: {
    messageFarsi?: string;
    messageEnglish?: string;
    timetableId?: number;
  }
): SolverLastRun {
  return {
    outcome,
    finishedAt: new Date(),
    messageFarsi: options?.messageFarsi,
    messageEnglish: options?.messageEnglish,
    timetableId: options?.timetableId,
  };
}

/**
 * POST /generate
 * Generate a timetable using the Python solver
 */
export async function handleGenerate(req: Request, res: Response): Promise<void> {
  const solverService = SolverService.getInstance();
  let runStarted = false;
  let lastRun: SolverLastRun | undefined;

  try {
    const requestConfig = req.body.config || {};
    const strategy = req.body.strategy || 'balanced';

    logger.info('Received timetable generation request', { strategy });
    solverService.beginRun(strategy);
    runStarted = true;

    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );
    solverService.setPreparingPhase('در حال آماده‌سازی داده‌های تولید...');

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
      strategy,
    });
    solverService.throwIfCancellationRequested();

    logger.info('Transformed data for solver', {
      teachers: solverInput.teachers.length,
      subjects: solverInput.subjects.length,
      classes: solverInput.classes.length,
      rooms: solverInput.rooms.length,
    });

    const preSolveResult = await solverService.runPreSolveAnalysis(solverInput);
    solverService.throwIfCancellationRequested();

    if (!preSolveResult.can_proceed && preSolveResult.errors?.length > 0) {
      lastRun = createLastRunSummary('failed', {
        messageFarsi: preSolveResult.errors[0]?.message_farsi || 'تولید جدول زمانی ممکن نیست',
        messageEnglish:
          preSolveResult.errors[0]?.message_english || 'Pre-solve analysis blocked generation',
      });
      res.status(422).json({
        success: false,
        status: 'failed',
        data: null,
        errors: preSolveResult.errors,
        warnings: preSolveResult.warnings || [],
        quality_score: null,
        metadata: { analysis_time_ms: preSolveResult.analysis_time_ms },
      });
      return;
    }

    const result = await solverService.runSolver(solverInput);
    solverService.throwIfCancellationRequested();

    if (result.status === 'failed') {
      lastRun = createLastRunSummary('failed', {
        messageFarsi: result.errors[0]?.message_farsi || 'خطا در تولید جدول زمانی',
        messageEnglish: result.errors[0]?.message_english || 'Timetable generation failed',
      });
      res.status(422).json({
        success: false,
        status: 'failed',
        data: null,
        errors: result.errors || [],
        warnings: result.warnings || [],
        quality_score: null,
        metadata: result.metadata || {},
      });
      return;
    }

    solverService.throwIfCancellationRequested();
    solverService.setSavingPhase();

    const timetableService = getTimetableService();
    const savedTimetableResult = await timetableService.create({
      name: createScheduleName(),
      description: '',
      data: result.data,
      schoolId: requestConfig.schoolId ?? null,
    });

    if (!savedTimetableResult.success || !savedTimetableResult.data) {
      const error = new Error(savedTimetableResult.error || 'Failed to save generated timetable');
      const solverError = error as SolverError;
      solverError.clientMessage = 'Generated timetable could not be saved.';
      solverError.code = ERROR_CODES.INTERNAL_ERROR;
      throw solverError;
    }

    lastRun = createLastRunSummary(result.status, {
      messageFarsi:
        result.status === 'partial'
          ? 'جدول زمانی با هشدار ذخیره شد'
          : 'جدول زمانی با موفقیت ذخیره شد',
      messageEnglish:
        result.status === 'partial'
          ? 'Timetable saved with warnings'
          : 'Timetable generated successfully',
      timetableId: savedTimetableResult.data.id,
    });

    res.json({
      success: true,
      status: result.status || 'success',
      data: result.data,
      errors: result.errors || [],
      warnings: result.warnings || [],
      quality_score: result.quality_score || null,
      metadata: result.metadata || {},
      savedTimetable: savedTimetableResult.data,
    });
  } catch (error: unknown) {
    logger.error(
      'Timetable generation failed',
      error instanceof Error ? error : new Error(String(error))
    );

    const err = error as SolverError;

    if (err.code === ERROR_CODES.SOLVER_BUSY) {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(
        createStructuredFailure(
          'SOLVER_BUSY',
          'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
          err.clientMessage || 'Solver is currently busy',
          {},
          solverService.getStatus()
        )
      );
      return;
    }

    if (err.code === ERROR_CODES.SOLVER_CANCELLED) {
      if (runStarted) {
        lastRun = createLastRunSummary('cancelled', {
          messageFarsi: 'تولید جدول زمانی لغو شد',
          messageEnglish: err.clientMessage || 'Timetable generation was cancelled',
        });
      }

      res.status(HTTP_STATUS.CONFLICT).json(
        createStructuredFailure(
          'SOLVER_CANCELLED',
          'تولید جدول زمانی لغو شد',
          err.clientMessage || 'Timetable generation was cancelled'
        )
      );
      return;
    }

    if (err.code === ERROR_CODES.SOLVER_TIMEOUT) {
      if (runStarted) {
        lastRun = createLastRunSummary('failed', {
          messageFarsi: 'تولید جدول زمانی زمان‌بر شد',
          messageEnglish: err.clientMessage || 'Solver timed out',
        });
      }

      res.status(HTTP_STATUS.GATEWAY_TIMEOUT).json(
        createStructuredFailure(
          'SOLVER_TIMEOUT',
          'تولید جدول زمانی زمان‌بر شد',
          err.clientMessage || 'Solver timed out'
        )
      );
      return;
    }

    if (runStarted && !lastRun) {
      lastRun = createLastRunSummary('failed', {
        messageFarsi: 'خطا در تولید جدول زمانی',
        messageEnglish: err.clientMessage || err.message,
      });
    }

    res.status(500).json(
      createStructuredFailure(
        err.code || 'SOLVER_ERROR',
        'خطا در تولید جدول زمانی',
        err.clientMessage || err.message,
        err.parsedError?.details ? { details: err.parsedError.details } : {}
      )
    );
  } finally {
    if (runStarted) {
      solverService.finishRun(lastRun);
    }
  }
}

/**
 * GET /generate/status
 * Get the current status of the solver
 */
export function handleGetStatus(_req: Request, res: Response): void {
  try {
    const solverService = SolverService.getInstance();
    const status = solverService.getStatus();
    res.json(status);
  } catch (error) {
    logger.error(
      'Error getting solver status',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ error: 'Failed to get solver status' });
  }
}

/**
 * DELETE /generate/cancel
 * Cancel the currently running generation lifecycle
 */
export function handleCancelGenerate(_req: Request, res: Response): void {
  try {
    const solverService = SolverService.getInstance();
    const accepted = solverService.requestCancel();

    if (!accepted) {
      res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: 'No cancellable timetable generation is currently running.',
        solverStatus: solverService.getStatus(),
      });
      return;
    }

    res.status(HTTP_STATUS.ACCEPTED).json({
      success: true,
      message: 'Cancellation requested.',
      solverStatus: solverService.getStatus(),
    });
  } catch (error) {
    logger.error(
      'Error cancelling solver generation',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ success: false, message: 'Failed to cancel timetable generation.' });
  }
}

/**
 * POST /generate/analyze
 * Run pre-solve analysis without generating a timetable
 */
export async function handleAnalyze(req: Request, res: Response): Promise<void> {
  try {
    const requestConfig = req.body.config || {};
    const solverService = SolverService.getInstance();

    if (solverService.isRunning) {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        can_proceed: false,
        errors: [
          {
            error_code: ERROR_CODES.SOLVER_BUSY,
            severity: 'error',
            message_key: 'error.solver_busy',
            message_farsi: 'در حال حاضر یک تولید جدول زمانی در حال اجرا است',
            message_english:
              'Timetable generation is already in progress. Please wait for it to complete.',
            affected_entities: [],
            context: {},
          },
        ],
        warnings: [],
        suggestions: [],
        analysis_time_ms: 0,
        solverStatus: solverService.getStatus(),
      });
      return;
    }

    logger.info('Received pre-solve analysis request');

    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
    });

    const result = await solverService.runPreSolveAnalysis(solverInput);

    res.json(result);
  } catch (error: unknown) {
    logger.error(
      'Pre-solve analysis failed',
      error instanceof Error ? error : new Error(String(error))
    );

    res.status(500).json({
      can_proceed: false,
      errors: [
        {
          error_code: 'ANALYSIS_ERROR',
          severity: 'error',
          message_farsi: 'تحلیل پیش از حل با خطا مواجه شد',
          message_english: 'Pre-solve analysis failed',
          affected_entities: [],
          context: {},
        },
      ],
      warnings: [],
      suggestions: [],
      analysis_time_ms: 0,
    });
  }
}

/**
 * POST /generate/test
 * Test endpoint for transformation service
 */
export async function handleTest(req: Request, res: Response): Promise<void> {
  try {
    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({});

    res.json({
      success: true,
      message: 'Transformation successful',
      stats: {
        teachers: solverInput.teachers.length,
        subjects: solverInput.subjects.length,
        classes: solverInput.classes.length,
        rooms: solverInput.rooms.length,
      },
      sampleTeacher: solverInput.teachers[0],
      sampleClass: solverInput.classes[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
