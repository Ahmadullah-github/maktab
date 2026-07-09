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
import { validateRequest } from '../middleware/validation.middleware';
import { createSubjectSchema, updateSubjectSchema } from '../schemas/subject.schema';
import { AssignmentProjectionService } from '../services/assignmentProjection.service';
import { SubjectService } from '../services/subject.service';
import { logger } from '../utils/logger';

/**
 * Creates subject routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createSubjectRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const subjectService = SubjectService.getInstance(dataSource, cacheManager);
  const assignmentProjectionService = AssignmentProjectionService.getInstance(
    dataSource,
    cacheManager
  );

  /**
   * GET /subjects
   * Get all subjects with optional pagination
   */
  router.get('/', paginationMiddleware, async (req: Request, res: Response) => {
    try {
      // If pagination params provided, use paginated response
      if (req.query.page || req.query.limit) {
        const result = await subjectService.findAll(req.pagination);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.json(result.data);
      }

      // Otherwise return all subjects (backward compatibility)
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

  /**
   * GET /subjects/:id
   * Get a specific subject by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
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
      const id = parseInt(req.params.id);
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
        return res.status(400).json({ error: result.error });
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
      }

      logger.debug('Updating subject', { id });
      const result = await subjectService.update(id, req.body);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
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
   * Delete a subject
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
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
      res.status(204).send();
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
      const grade = parseInt(req.params.grade);
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
      res.status(204).send();
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
   * Expects subjects array from frontend (cleaner architecture - frontend owns curriculum data)
   */
  router.post('/grade/:grade/insert-curriculum', async (req: Request, res: Response) => {
    try {
      const grade = parseInt(req.params.grade);
      if (isNaN(grade) || grade < 1 || grade > 12) {
        return res.status(400).json({ error: 'Invalid grade. Must be between 1 and 12.' });
      }

      const { subjects } = req.body || {};

      if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ error: 'subjects array is required' });
      }

      // Normalize subjects with grade
      const normalized = subjects.map((s: any) => ({
        name: s.name,
        code: s.code || '',
        periodsPerWeek: s.periodsPerWeek || 0,
        requiredRoomType: s.requiredRoomType || null,
        isDifficult: !!s.isDifficult,
        grade,
        section: s.section || '',
      }));

      logger.debug('Inserting curriculum for grade', { grade, count: normalized.length });
      const result = await subjectService.bulkUpsert(normalized);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({ count: normalized.length, subjects: result.data });
    } catch (error) {
      logger.error(
        'Error inserting curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to insert curriculum for grade' });
    }
  });

  return router;
}

export default createSubjectRoutes;
