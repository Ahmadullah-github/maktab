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
  updateSubjectSchema,
} from '../schemas/subject.schema';
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
  router.param('id', positiveIntegerParam);
  router.param('grade', integerParamInRange(1, 12));
  const subjectService = SubjectService.getInstance(dataSource, cacheManager);
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
        return res.status(result.statusCode ?? 400).json({
          error: result.error,
          code: result.code,
          details: result.details,
        });
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

  return router;
}

export default createSubjectRoutes;
