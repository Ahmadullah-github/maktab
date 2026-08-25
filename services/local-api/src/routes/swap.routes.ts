/**
 * Swap Routes
 *
 * API endpoints for validating and executing lesson swaps.
 *
 * Requirements: Phase 3
 * - POST /api/swap/validate - Validate a swap operation
 * - POST /api/swap/execute - Execute a validated swap
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { TimetableRepository } from '../database/repositories/timetable.repository';
import type { SwapValidationResponse } from '../schemas/swap.schema';
import { validateSwapRequest } from '../schemas/swap.schema';
import { SwapConstraintGatherer } from '../services/SwapConstraintGatherer';
import { SwapSolverService } from '../services/SwapSolverService';
import { logger } from '../utils/logger';
import { SchoolScopeConflictError } from '../utils/schoolScopeGuard';

function parseTimetableId(param: string): number | null {
  const timetableId = Number(param);
  return Number.isInteger(timetableId) && timetableId > 0 ? timetableId : null;
}

function parseTimetablePayload(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid timetable payload');
  }

  return parsed as Record<string, unknown>;
}

export function applyLessonMovesToPayload(
  payload: Record<string, unknown>,
  affectedLessons: SwapValidationResponse['affectedLessons']
): Record<string, unknown> {
  const rawLessons = Array.isArray(payload.schedule)
    ? payload.schedule
    : Array.isArray(payload.lessons)
      ? payload.lessons
      : [];
  const matchedMoves = new Set<number>();

  const updatedLessons = rawLessons.map((rawLesson) => {
    if (typeof rawLesson !== 'object' || rawLesson === null) {
      return rawLesson;
    }

    const lesson = rawLesson as Record<string, unknown>;
    const classId = lesson.classId != null ? String(lesson.classId) : null;
    const day = lesson.day != null ? String(lesson.day) : null;
    const periodIndex = Number(lesson.periodIndex);
    const subjectId = lesson.subjectId != null ? String(lesson.subjectId) : null;

    const moveIndex = affectedLessons.findIndex(
      (candidateMove, candidateIndex) =>
        !matchedMoves.has(candidateIndex) &&
        candidateMove.classId === classId &&
        candidateMove.fromDay === day &&
        candidateMove.fromPeriod === periodIndex &&
        (subjectId === null || candidateMove.subjectId === subjectId)
    );

    if (moveIndex === -1) {
      return rawLesson;
    }
    matchedMoves.add(moveIndex);
    const move = affectedLessons[moveIndex];

    return {
      ...lesson,
      day: move.toDay,
      periodIndex: move.toPeriod,
    };
  });

  if (matchedMoves.size !== affectedLessons.length) {
    throw new Error(
      `Swap could not be applied atomically: matched ${matchedMoves.size} of ${affectedLessons.length} lesson moves`
    );
  }

  return {
    ...payload,
    schedule: updatedLessons,
    ...(Array.isArray(payload.lessons) ? { lessons: updatedLessons } : {}),
  };
}

export function createSwapRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const swapConstraintGatherer = SwapConstraintGatherer.getInstance(dataSource, cacheManager);
  const swapSolverService = new SwapSolverService(swapConstraintGatherer);

  router.get('/context/:timetableId', async (req: Request, res: Response) => {
    const timetableId = parseTimetableId(req.params.timetableId);
    if (timetableId === null) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timetable ID',
      });
    }

    try {
      const constraintData = await swapConstraintGatherer.gatherConstraints(timetableId, {
        skipCache: true,
      });

      res.json({
        success: true,
        result: {
          teachers: constraintData.teachers.map((teacher: any) => ({
            teacherId: teacher.id,
            unavailable: teacher.unavailable ?? [],
            timePreference: teacher.timePreference ?? 'None',
          })),
          subjects: constraintData.subjects.map((subject: any) => ({
            subjectId: subject.id,
            requiredRoomType: subject.requiredRoomType ?? null,
            isDifficult: subject.isDifficult ?? false,
          })),
          rooms: constraintData.rooms.map((room: any) => ({
            roomId: room.id,
            roomName: room.name,
            type: room.type ?? 'normal',
          })),
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to load swap constraint context',
        error instanceof Error ? error : new Error(errorMessage),
        { timetableId }
      );

      res.status(
        error instanceof SchoolScopeConflictError
          ? error.statusCode
          : errorMessage.includes('not found')
            ? 404
            : 500
      ).json({
        success: false,
        error: errorMessage,
        ...(error instanceof SchoolScopeConflictError
          ? { code: error.code, details: error.details }
          : {}),
      });
    }
  });

  /**
   * POST /api/swap/validate
   *
   * Validates a swap operation without executing it.
   * Checks all constraints and returns validation result.
   */
  router.post('/validate', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const swapRequest = validateSwapRequest(req.body);

      // Validate swap using Python solver
      const result = await swapSolverService.validateSwap(swapRequest);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const err = error instanceof Error ? error : new Error(errorMessage);

      // Distinguish between validation errors and system errors
      if (error instanceof Error) {
        if (error instanceof SchoolScopeConflictError) {
          return res.status(error.statusCode).json({
            success: false,
            error: error.message,
            code: error.code,
            details: error.details,
          });
        }

        // Check if it's a validation error (Zod)
        if (error.name === 'ZodError') {
          logger.warn('Invalid swap request', { error: errorMessage });
          return res.status(400).json({
            success: false,
            error: 'Invalid request format',
            details: errorMessage,
          });
        }

        // Check if it's a solver timeout
        if (errorMessage.includes('timeout')) {
          logger.error('Swap validation timeout', err);
          return res.status(504).json({
            success: false,
            error: 'Validation timeout',
            details: errorMessage,
          });
        }

        // Check if it's a timetable not found error
        if (errorMessage.includes('not found')) {
          logger.warn('Timetable not found', { error: errorMessage });
          return res.status(404).json({
            success: false,
            error: 'Timetable not found',
            details: errorMessage,
          });
        }
      }

      // Generic system error
      logger.error('Swap validation failed', err);
      res.status(500).json({
        success: false,
        error: 'System error during validation',
        details: errorMessage,
      });
    }
  });

  /**
   * POST /api/swap/execute
   *
   * Executes a validated swap operation.
   * Updates the timetable with the swapped lessons.
   *
   */
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const swapRequest = validateSwapRequest(req.body);
      const expectedRevision = Number(req.body.expectedRevision);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        return res.status(400).json({
          success: false,
          error: 'expectedRevision is required to execute a swap',
        });
      }

      // First validate the swap
      const validationResult = await swapSolverService.validateSwap(swapRequest);

      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Swap validation failed',
          validationResult,
        });
      }

      if (validationResult.affectedLessons.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Swap validation returned no lesson moves',
          validationResult,
        });
      }

      const timetableRepository = TimetableRepository.getInstance(dataSource, cacheManager);
      const timetable = await timetableRepository.getTimetable(swapRequest.timetableId, {
        skipCache: true,
      });

      if (!timetable) {
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
        });
      }

      const payload =
        typeof timetable.data === 'string'
          ? parseTimetablePayload(timetable.data)
          : (timetable.data as Record<string, unknown>);
      const updatedPayload = applyLessonMovesToPayload(payload, validationResult.affectedLessons);
      const updated = await timetableRepository.updateTimetable(
        timetable.id,
        updatedPayload,
        expectedRevision
      );
      swapConstraintGatherer.invalidateCache(swapRequest.timetableId);

      res.json({
        success: true,
        message: 'Swap executed successfully',
        validationResult,
        revision: updated?.revision,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Swap execution failed',
        error instanceof Error ? error : new Error(errorMessage)
      );

      const revisionConflict = error instanceof Error && error.name === 'TimetableRevisionConflictError';
      res.status(
        error instanceof SchoolScopeConflictError ? error.statusCode : revisionConflict ? 409 : 500
      ).json({
        success: false,
        error: errorMessage,
        ...(revisionConflict ? { code: 'TIMETABLE_REVISION_CONFLICT' } : {}),
        ...(error instanceof SchoolScopeConflictError
          ? { code: error.code, details: error.details }
          : {}),
      });
    }
  });

  return router;
}

export default createSwapRoutes;
