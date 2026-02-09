/**
 * Route handlers for generate endpoints
 * @module routes/generate/handlers
 */

import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { ERROR_CODES } from '../../constants';
import { CacheManager } from '../../database/cache/cacheManager';
import { SolverError, SolverService } from '../../services/solver.service';
import { SolverDataTransformerService } from '../../services/solverDataTransformer.service';
import { logger } from '../../utils/logger';

let dataSourceRef: DataSource | null = null;
let cacheManagerRef: CacheManager | null = null;

export function initializeHandlers(dataSource: DataSource, cacheManager?: CacheManager): void {
  dataSourceRef = dataSource;
  cacheManagerRef = cacheManager ?? CacheManager.getInstance();
}

/**
 * POST /generate
 * Generate a timetable using the Python solver
 */
export async function handleGenerate(req: Request, res: Response): Promise<void> {
  try {
    const requestConfig = req.body.config || {};
    const strategy = req.body.strategy || 'balanced';

    logger.info('Received timetable generation request', { strategy });

    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
      strategy,
    });

    logger.info('Transformed data for solver', {
      teachers: solverInput.teachers.length,
      subjects: solverInput.subjects.length,
      classes: solverInput.classes.length,
      rooms: solverInput.rooms.length,
    });

    const solverService = SolverService.getInstance();
    const preSolveResult = await solverService.runPreSolveAnalysis(solverInput);

    if (!preSolveResult.can_proceed && preSolveResult.errors?.length > 0) {
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

    if (result.status === 'failed') {
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

    res.json({
      success: true,
      status: result.status || 'success',
      data: result.data,
      errors: result.errors || [],
      warnings: result.warnings || [],
      quality_score: result.quality_score || null,
      metadata: result.metadata || {},
    });
  } catch (error: unknown) {
    logger.error(
      'Timetable generation failed',
      error instanceof Error ? error : new Error(String(error))
    );

    const err = error as SolverError;

    if (err.code === ERROR_CODES.SOLVER_BUSY) {
      res.status(503).json({
        success: false,
        error: {
          type: 'SOLVER_BUSY',
          message: err.clientMessage || 'Solver is currently busy',
        },
      });
      return;
    }

    if (err.code === ERROR_CODES.SOLVER_TIMEOUT) {
      res.status(504).json({
        success: false,
        error: {
          type: 'SOLVER_TIMEOUT',
          message: err.clientMessage || 'Solver timed out',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: err.clientMessage || err.message,
    });
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
 * POST /generate/analyze
 * Run pre-solve analysis without generating a timetable
 */
export async function handleAnalyze(req: Request, res: Response): Promise<void> {
  try {
    const requestConfig = req.body.config || {};

    logger.info('Received pre-solve analysis request');

    const transformerService = SolverDataTransformerService.getInstance(
      dataSourceRef!,
      cacheManagerRef ?? undefined
    );

    const solverInput = await transformerService.transformToSolverInput({
      schoolId: requestConfig.schoolId,
    });

    const solverService = SolverService.getInstance();
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
