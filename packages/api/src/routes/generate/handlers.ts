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
import {
  AssignmentReadinessError,
  SolverDataTransformerService,
} from '../../services/solverDataTransformer.service';
import { SchoolConfigService } from '../../services/schoolConfig.service';
import { enrichGeneratedScheduleTiming } from '../../services/scheduleTiming.service';
import { logger } from '../../utils/logger';
import { findGeneratedPeriodBoundsIssues } from '../../utils/periodConfiguration';
import { SchoolScopeConflictError } from '../../utils/schoolScopeGuard';
import { validateGeneratedTimetable } from '../../services/generatedTimetableValidation.service';
import {
  createOperationIssue,
  createOperationResponse,
  withDiagnosticId,
} from '../../types/operation.types';

function createStructuredFailure(
  errorCode: string,
  diagnosticId: string,
  options: {
    context?: Record<string, any>;
    solverStatus?: ReturnType<SolverService['getStatus']>;
    phase?: Parameters<typeof createOperationIssue>[1];
  } = {}
) {
  return createOperationResponse('failed', diagnosticId, {
    issues: [
      createOperationIssue(errorCode, options.phase ?? 'preparation', {
        messageParams: options.context ?? {},
      }),
    ],
    metadata: options.solverStatus ? { solverStatus: options.solverStatus } : {},
  });
}

function getDiagnosticId(req: Request): string {
  return req.requestContext?.requestId ?? 'untracked';
}

function getTimetableService(
  dataSource: DataSource,
  cacheManager?: CacheManager
): TimetableService {
  return TimetableService.getInstance(dataSource, cacheManager);
}

function createScheduleName(): string {
  return `جدول زمانی - ${new Intl.DateTimeFormat('fa-IR').format(new Date())}`;
}

function createLastRunSummary(
  outcome: SolverLastRun['outcome'],
  options?: {
    issueCode?: string;
    timetableId?: number;
  }
): SolverLastRun {
  return {
    outcome,
    finishedAt: new Date(),
    issueCode: options?.issueCode,
    timetableId: options?.timetableId,
  };
}

/**
 * POST /generate
 * Generate a timetable using the Python solver
 */
export async function handleGenerate(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const solverService = SolverService.getInstance();
  const diagnosticId = getDiagnosticId(req);
  let runStarted = false;
  let lastRun: SolverLastRun | undefined;

  try {
    const requestConfig = req.body.config || {};
    const strategy = req.body.strategy || 'balanced';

    logger.info('Received timetable generation request', { strategy });
    solverService.beginRun(strategy);
    runStarted = true;

    const transformerService = SolverDataTransformerService.getInstance(dataSource, cacheManager);
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

    if (preSolveResult.outcome === 'failed') {
      const firstIssue = preSolveResult.issues.find((issue) => issue.blocking);
      lastRun = createLastRunSummary('failed', {
        issueCode: firstIssue?.code,
      });
      res.status(422).json(
        createOperationResponse('failed', diagnosticId, {
          issues: preSolveResult.issues,
          metadata: {
            ...preSolveResult.metadata,
            ...(preSolveResult.data ? { analysis: preSolveResult.data } : {}),
          },
        })
      );
      return;
    }

    const result = await solverService.runSolver(solverInput);
    solverService.throwIfCancellationRequested();

    if (result.outcome === 'failed') {
      const firstIssue = result.issues.find((issue) => issue.blocking);
      lastRun = createLastRunSummary('failed', {
        issueCode: firstIssue?.code,
      });
      res.status(422).json(
        createOperationResponse('failed', diagnosticId, {
          issues: result.issues,
          metadata: result.metadata,
        })
      );
      return;
    }

    result.issues = [...preSolveResult.issues, ...result.issues];
    if (
      result.outcome === 'success' &&
      result.issues.some((issue) => !issue.blocking && issue.severity === 'warning')
    ) {
      result.outcome = 'partial';
    }

    const blockingPartial =
      result.outcome === 'partial' &&
      result.issues.some((item) => item.code === 'NO_FEASIBLE_SOLUTION' && item.blocking);
    if (blockingPartial) {
      lastRun = createLastRunSummary('failed', {
        issueCode: 'NO_FEASIBLE_SOLUTION',
      });
      res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
        ...withDiagnosticId(result, diagnosticId),
        outcome: 'failed',
        data: null,
      });
      return;
    }

    const periodBoundsIssues = findGeneratedPeriodBoundsIssues(result.data, solverInput);
    if (periodBoundsIssues.length > 0) {
      lastRun = createLastRunSummary('failed', {
        issueCode: ERROR_CODES.INVALID_GENERATED_PERIOD_BOUNDS,
      });
      res
        .status(HTTP_STATUS.UNPROCESSABLE_ENTITY)
        .json(
          createStructuredFailure(
            ERROR_CODES.INVALID_GENERATED_PERIOD_BOUNDS,
            diagnosticId,
            {
              context: { issueCount: periodBoundsIssues.length },
              phase: 'output_validation',
            }
          )
        );
      return;
    }

    const invariantIssues = validateGeneratedTimetable(result.data, solverInput);
    if (invariantIssues.length > 0) {
      lastRun = createLastRunSummary('failed', {
        issueCode: 'INVALID_GENERATED_TIMETABLE',
      });
      res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json(
        createStructuredFailure(
          'INVALID_GENERATED_TIMETABLE',
          diagnosticId,
          {
            context: { issueCount: invariantIssues.length },
            phase: 'output_validation',
          }
        )
      );
      return;
    }

    const schoolConfig = await SchoolConfigService.getInstance(dataSource, cacheManager).getConfig(
      requestConfig.schoolId ?? null
    );
    result.data = enrichGeneratedScheduleTiming(result.data, schoolConfig);
    result.data = {
      ...result.data,
      status: result.outcome,
      quality_score:
        result.metadata.qualityScore && typeof result.metadata.qualityScore === 'object'
          ? result.metadata.qualityScore
          : null,
    };

    solverService.throwIfCancellationRequested();
    solverService.setSavingPhase();

    const timetableService = getTimetableService(dataSource, cacheManager);
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
      solverError.code = 'TIMETABLE_SAVE_ERROR';
      throw solverError;
    }

    lastRun = createLastRunSummary(result.outcome, {
      timetableId: savedTimetableResult.data.id,
    });

    res.json(
      createOperationResponse(result.outcome, diagnosticId, {
        data: {
          timetable: result.data,
          savedTimetable: savedTimetableResult.data,
        },
        issues: result.issues,
        metadata: result.metadata,
      })
    );
  } catch (error: unknown) {
    logger.error(
      'Timetable generation failed',
      error instanceof Error ? error : new Error(String(error))
    );

    const err = error as SolverError;

    if (error instanceof AssignmentReadinessError) {
      if (runStarted) {
        lastRun = createLastRunSummary('failed', {
          issueCode: error.issues[0]?.code ?? error.code,
        });
      }
      res.status(error.statusCode).json(
        createOperationResponse('failed', diagnosticId, {
          issues: error.issues,
        })
      );
      return;
    }

    if (error instanceof SchoolScopeConflictError) {
      if (runStarted) {
        lastRun = createLastRunSummary('failed', {
          issueCode: error.code,
        });
      }
      res.status(error.statusCode).json(
        createStructuredFailure(
          error.code,
          diagnosticId,
          { context: { ...error.details } }
        )
      );
      return;
    }

    if (err.code === ERROR_CODES.SOLVER_BUSY) {
      res
        .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
        .json(
          createStructuredFailure(
            'SOLVER_BUSY',
            diagnosticId,
            { solverStatus: solverService.getStatus(), phase: 'request' }
          )
        );
      return;
    }

    if (err.code === ERROR_CODES.SOLVER_CANCELLED) {
      if (runStarted) {
        lastRun = createLastRunSummary('cancelled', {
          issueCode: 'SOLVER_CANCELLED',
        });
      }

      res
        .status(HTTP_STATUS.CONFLICT)
        .json(
          createStructuredFailure(
            'SOLVER_CANCELLED',
            diagnosticId,
            { phase: 'solving' }
          )
        );
      return;
    }

    if (err.code === ERROR_CODES.SOLVER_TIMEOUT) {
      if (runStarted) {
        lastRun = createLastRunSummary('failed', {
          issueCode: 'SOLVER_TIMEOUT',
        });
      }

      res
        .status(HTTP_STATUS.GATEWAY_TIMEOUT)
        .json(
          createStructuredFailure(
            'SOLVER_TIMEOUT',
            diagnosticId,
            { phase: 'solving' }
          )
        );
      return;
    }

    if (runStarted && !lastRun) {
      lastRun = createLastRunSummary('failed', {
        issueCode: err.code || 'SOLVER_ERROR',
      });
    }

    res
      .status(500)
      .json(
        createStructuredFailure(
          err.code || 'SOLVER_ERROR',
          diagnosticId,
          { phase: solverService.getStatus().phase === 'saving' ? 'saving' : 'solving' }
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
export function handleGetStatus(req: Request, res: Response): void {
  const diagnosticId = getDiagnosticId(req);
  try {
    const solverService = SolverService.getInstance();
    const status = solverService.getStatus();
    res.json(createOperationResponse('success', diagnosticId, { data: status }));
  } catch (error) {
    logger.error(
      'Error getting solver status',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json(
      createOperationResponse('failed', diagnosticId, {
        issues: [createOperationIssue('SOLVER_STATUS_ERROR', 'request')],
      })
    );
  }
}

/**
 * DELETE /generate/cancel
 * Cancel the currently running generation lifecycle
 */
export function handleCancelGenerate(req: Request, res: Response): void {
  const diagnosticId = getDiagnosticId(req);
  try {
    const solverService = SolverService.getInstance();
    const accepted = solverService.requestCancel();

    if (!accepted) {
      res.status(HTTP_STATUS.CONFLICT).json(
        createOperationResponse('failed', diagnosticId, {
          issues: [createOperationIssue('NO_CANCELLABLE_GENERATION', 'request')],
          metadata: { solverStatus: solverService.getStatus() },
        })
      );
      return;
    }

    res.status(HTTP_STATUS.ACCEPTED).json(
      createOperationResponse('success', diagnosticId, {
        data: solverService.getStatus(),
      })
    );
  } catch (error) {
    logger.error(
      'Error cancelling solver generation',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json(
      createOperationResponse('failed', diagnosticId, {
        issues: [createOperationIssue('SOLVER_CANCEL_ERROR', 'request')],
      })
    );
  }
}

/**
 * POST /generate/analyze
 * Run pre-solve analysis without generating a timetable
 */
export async function handleAnalyze(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const diagnosticId = getDiagnosticId(req);
  try {
    const requestConfig = req.body.config || {};
    const solverService = SolverService.getInstance();

    if (solverService.isRunning) {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(
        createOperationResponse('failed', diagnosticId, {
          issues: [createOperationIssue(ERROR_CODES.SOLVER_BUSY, 'analysis')],
          metadata: { solverStatus: solverService.getStatus() },
        })
      );
      return;
    }

    logger.info('Received pre-solve analysis request');

    const transformerService = SolverDataTransformerService.getInstance(dataSource, cacheManager);

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
    });

    const result = await solverService.runPreSolveAnalysis(solverInput);

    res.json(withDiagnosticId(result, diagnosticId));
  } catch (error: unknown) {
    logger.error(
      'Pre-solve analysis failed',
      error instanceof Error ? error : new Error(String(error))
    );

    if (error instanceof AssignmentReadinessError) {
      res.status(error.statusCode).json(
        createOperationResponse('failed', diagnosticId, {
          issues: error.issues,
        })
      );
      return;
    }

    res.status(500).json(
      createOperationResponse('failed', diagnosticId, {
        issues: [createOperationIssue('ANALYSIS_ERROR', 'analysis')],
      })
    );
  }
}

/**
 * POST /generate/test
 * Test endpoint for transformation service
 */
export async function handleTest(
  dataSource: DataSource,
  cacheManager: CacheManager | undefined,
  req: Request,
  res: Response
): Promise<void> {
  const diagnosticId = getDiagnosticId(req);
  try {
    const transformerService = SolverDataTransformerService.getInstance(dataSource, cacheManager);

    const solverInput = await transformerService.transformToSolverInput({});

    res.json(
      createOperationResponse('success', diagnosticId, {
        data: {
          stats: {
            teachers: solverInput.teachers.length,
            subjects: solverInput.subjects.length,
            classes: solverInput.classes.length,
            rooms: solverInput.rooms.length,
          },
          sampleTeacher: solverInput.teachers[0],
          sampleClass: solverInput.classes[0],
        },
      })
    );
  } catch (error) {
    logger.error(
      'Solver transformation test failed',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json(
      createOperationResponse('failed', diagnosticId, {
        issues: [createOperationIssue('TRANSFORMATION_ERROR', 'preparation')],
      })
    );
  }
}
