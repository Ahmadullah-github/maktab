/**
 * Teacher routes
 * @module routes/teacher
 *
 * Requirements: 2.2, 6.1
 * - All teacher-related endpoints
 * - Pagination support for list endpoint
 * - Validation middleware for POST/PUT
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { TeacherService } from '../services/teacher.service';
import { AssignmentProjectionService } from '../services/assignmentProjection.service';
import { positiveIntegerParam, validateRequest } from '../middleware/validation.middleware';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import {
  createTeacherSchema,
  updateTeacherSchema,
  bulkTeacherImportSchema,
} from '../schemas/teacher.schema';
import { logger } from '../utils/logger';
import { CacheManager } from '../database/cache/cacheManager';

/**
 * Creates teacher routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createTeacherRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('id', positiveIntegerParam);
  const teacherService = TeacherService.getInstance(dataSource, cacheManager);
  const assignmentProjectionService = AssignmentProjectionService.getInstance(
    dataSource,
    cacheManager
  );

  /**
   * GET /teachers
   * Get all teachers with optional pagination
   */
  router.get('/', paginationMiddleware, async (req: Request, res: Response) => {
    try {
      // If pagination params provided, use paginated response
      if (req.query.page || req.query.limit) {
        const result = await teacherService.findAll(req.pagination);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.json(result.data);
      }

      // Otherwise return all teachers (backward compatibility)
      const result = await teacherService.findAllUnpaginated();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching teachers',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch teachers' });
    }
  });

  /**
   * GET /teachers/:id
   * Get a specific teacher by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      const result = await teacherService.findById(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching teacher',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch teacher' });
    }
  });

  /**
   * GET /teachers/:id/workload-view
   * Get the canonical assignment workload projection for a teacher
   */
  router.get('/:id/workload-view', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      const result = await assignmentProjectionService.getTeacherWorkloadView(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching teacher workload view',
        error instanceof Error ? error : new Error(String(error))
      );
      return res.status(500).json({ error: 'Failed to fetch teacher workload view' });
    }
  });

  /**
   * GET /teachers/:id/assignment-summary
   * Get the canonical assignment summary projection for a teacher
   */
  router.get('/:id/assignment-summary', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      const result = await assignmentProjectionService.getTeacherAssignmentSummary(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching teacher assignment summary',
        error instanceof Error ? error : new Error(String(error))
      );
      return res.status(500).json({ error: 'Failed to fetch teacher assignment summary' });
    }
  });

  /**
   * POST /teachers
   * Create a new teacher
   */
  router.post('/', validateRequest(createTeacherSchema), async (req: Request, res: Response) => {
    try {
      logger.debug('Saving teacher', { fullName: req.body.fullName });
      const result = await teacherService.create(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result.data);
    } catch (error) {
      logger.error(
        'Error saving teacher',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to save teacher' });
    }
  });

  /**
   * POST /teachers/bulk
   * Bulk import teachers
   */
  router.post(
    '/bulk',
    validateRequest(bulkTeacherImportSchema),
    async (req: Request, res: Response) => {
      try {
        const { teachers } = req.body;
        logger.debug('Bulk importing teachers', { count: teachers.length });
        const result = await teacherService.bulkImport(teachers);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        res.status(201).json(result.data);
      } catch (error) {
        logger.error(
          'Error bulk importing teachers',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to bulk import teachers' });
      }
    }
  );

  /**
   * PUT /teachers/:id
   * Update an existing teacher
   */
  router.put('/:id', validateRequest(updateTeacherSchema), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      logger.debug('Updating teacher', { id });
      const result = await teacherService.update(id, req.body);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error updating teacher',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to update teacher' });
    }
  });

  /**
   * DELETE /teachers/:id
   * Delete a teacher
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid teacher ID' });
      }

      logger.debug('Deleting teacher', { id });
      const result = await teacherService.delete(id);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error deleting teacher',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete teacher' });
    }
  });

  return router;
}

export default createTeacherRoutes;
