/**
 * Subject routes
 * @module routes/subject
 *
 * Requirements: 2.3, 6.2
 * - All subject-related endpoints
 * - Pagination support for list endpoint
 * - Validation middleware for POST/PUT
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import {
  integerParamInRange,
  positiveIntegerParam,
  validateRequest,
} from '../middleware/validation.middleware';
import {
  createSubjectSchema,
  bulkDeleteSubjectsSchema,
  clearCurriculumSubjectsSchema,
  insertGradeCurriculumSchema,
  syncCurriculumSubjectsSchema,
  updateSubjectSchema,
} from '../schemas/subject.schema';
import { AssignmentProjectionService } from '../services/assignmentProjection.service';
import { SubjectService } from '../services/subject.service';
import { CurriculumMaterializationService } from '../services/curriculumMaterialization.service';
import { logger } from '../utils/logger';

/**
 * Creates subject routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createSubjectRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('id', positiveIntegerParam);
  router.param('grade', integerParamInRange(1, 12));
  const subjectService = SubjectService.getInstance(dataSource, cacheManager);
  const curriculumMaterializationService = CurriculumMaterializationService.getInstance(
    dataSource,
    cacheManager
  );
  const assignmentProjectionService = AssignmentProjectionService.getInstance(
    dataSource,
    cacheManager
  );

  /**
   * GET /subjects
   * Get all subjects with optional pagination
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const result = await subjectService.findAllUnpaginated();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching subjects',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  });

  /** GET /subjects/paginated always returns the documented pagination envelope. */
  router.get('/paginated', paginationMiddleware, async (req: Request, res: Response) => {
    const result = await subjectService.findAll(req.pagination);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }
    return res.json(result.data);
  });

  /** Permanently delete a set of subjects and their dependent assignment data atomically. */
  router.post(
    '/bulk-delete',
    validateRequest(bulkDeleteSubjectsSchema),
    async (req: Request, res: Response) => {
      const ids = req.body.ids as number[];
      const result = await subjectService.bulkDelete(ids);
      if (!result.success) {
        return res.status(result.statusCode ?? 400).json({ error: result.error });
      }
      return res.json({ deleted: result.data ?? 0, deletedIds: ids });
    }
  );

  router.post(
    '/curriculum/sync',
    validateRequest(syncCurriculumSubjectsSchema),
    async (req: Request, res: Response) => {
      try {
        const result = await curriculumMaterializationService.materializeGrades(
          req.body.grades,
          req.body.schoolId ?? null
        );
        return res.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to synchronize effective curriculum', error instanceof Error ? error : new Error(message));
        return res.status(409).json({ error: message });
      }
    }
  );

  router.post(
    '/curriculum/clear',
    validateRequest(clearCurriculumSubjectsSchema),
    async (req: Request, res: Response) => {
      const schoolId = req.body.schoolId ?? null;
      const ids: number[] = [];
      for (const grade of [...new Set<number>(req.body.grades)]) {
        const gradeResult = await subjectService.findByGrade(grade);
        if (!gradeResult.success || !gradeResult.data) {
          return res.status(500).json({ error: gradeResult.error ?? 'Failed to load subjects' });
        }
        ids.push(
          ...gradeResult.data
            .filter((subject) => subject.schoolId === schoolId)
            .map((subject) => subject.id)
        );
      }
      if (ids.length === 0) {
        return res.json({ count: 0, deletedIds: [] });
      }
      const result = await subjectService.bulkDelete(ids);
      if (!result.success) {
        return res.status(result.statusCode ?? 409).json({ error: result.error });
      }
      return res.json({ count: result.data ?? 0, deletedIds: ids });
    }
  );

  /**
   * GET /subjects/:id
   * Get a specific subject by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      const result = await subjectService.findById(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch subject' });
    }
  });

  /**
   * GET /subjects/:id/coverage-view
   * Get the canonical subject coverage projection
   */
  router.get('/:id/coverage-view', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      const result = await assignmentProjectionService.getSubjectCoverageView(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching subject coverage view',
        error instanceof Error ? error : new Error(String(error))
      );
      return res.status(500).json({ error: 'Failed to fetch subject coverage view' });
    }
  });

  /**
   * POST /subjects
   * Create a new subject
   */
  router.post('/', validateRequest(createSubjectSchema), async (req: Request, res: Response) => {
    try {
      logger.debug('Saving subject', { name: req.body.name });
      const result = await subjectService.create(req.body);
      if (!result.success) {
        return res.status(result.statusCode ?? 400).json({
          error: result.error,
          code: result.code,
          details: result.details,
        });
      }
      res.status(201).json(result.data);
    } catch (error) {
      logger.error(
        'Error saving subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to save subject' });
    }
  });

  /**
   * PUT /subjects/:id
   * Update an existing subject
   */
  router.put('/:id', validateRequest(updateSubjectSchema), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      logger.debug('Updating subject', { id });
      const result = await subjectService.update(id, req.body);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(result.statusCode ?? 400).json({
          error: result.error,
          code: result.code,
          details: result.details,
        });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error updating subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to update subject' });
    }
  });

  /**
   * DELETE /subjects/:id
   * Permanently delete a subject and its dependent assignment/requirement records
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      logger.debug('Deleting subject', { id });
      const result = await subjectService.delete(id);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error deleting subject',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete subject' });
    }
  });

  /**
   * DELETE /subjects
   * Clear all subjects
   */
  router.delete('/', async (_req: Request, res: Response) => {
    try {
      logger.debug('Clearing all subjects');
      // Get all subjects and delete them
      const allResult = await subjectService.findAllUnpaginated();
      if (!allResult.success || !allResult.data) {
        return res.status(500).json({ error: 'Failed to fetch subjects for deletion' });
      }

      const ids = allResult.data.map((s) => s.id);
      if (ids.length > 0) {
        const deleteResult = await subjectService.bulkDelete(ids);
        if (!deleteResult.success) {
          return res.status(500).json({ error: deleteResult.error });
        }
      }
      res.json({ count: ids.length });
    } catch (error) {
      logger.error(
        'Error clearing all subjects',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to clear all subjects' });
    }
  });

  /**
   * DELETE /subjects/grade/:grade
   * Clear subjects by grade
   */
  router.delete('/grade/:grade', async (req: Request, res: Response) => {
    try {
      const grade = Number(req.params.grade);
      if (isNaN(grade)) {
        return res.status(400).json({ error: 'Invalid grade' });
      }

      logger.debug('Clearing subjects for grade', { grade });
      const gradeResult = await subjectService.findByGrade(grade);
      if (!gradeResult.success || !gradeResult.data) {
        return res.status(500).json({ error: 'Failed to fetch subjects for grade' });
      }

      const ids = gradeResult.data.map((s) => s.id);
      if (ids.length > 0) {
        const deleteResult = await subjectService.bulkDelete(ids);
        if (!deleteResult.success) {
          return res.status(500).json({ error: deleteResult.error });
        }
      }
      res.json({ count: ids.length });
    } catch (error) {
      logger.error(
        'Error clearing grade subjects',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to clear grade subjects' });
    }
  });

  /**
   * POST /subjects/grade/:grade/insert-curriculum
   * Insert curriculum subjects for a grade (bulk upsert)
   * Materializes the backend's effective ministry + school curriculum.
   */
  router.post(
    '/grade/:grade/insert-curriculum',
    validateRequest(insertGradeCurriculumSchema),
    async (req: Request, res: Response) => {
      try {
        const grade = Number(req.params.grade);
        if (isNaN(grade) || grade < 1 || grade > 12) {
          return res.status(400).json({ error: 'Invalid grade. Must be between 1 and 12.' });
        }

        const result = await curriculumMaterializationService.materializeGrades(
          [grade],
          req.body.schoolId ?? null
        );
        res.status(201).json({ count: result.createdOrUpdatedSubjects, ...result });
      } catch (error) {
        logger.error(
          'Error inserting curriculum',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to insert curriculum for grade' });
      }
    }
  );

  return router;
}

export default createSubjectRoutes;
