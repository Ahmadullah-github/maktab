/**
 * Class routes
 * @module routes/class
 *
 * Requirements: 2.5, 6.4
 * - All class-related endpoints
 * - Pagination support for list endpoint
 * - Validation middleware for POST/PUT
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { createClassSchema, updateClassSchema } from '../schemas/class.schema';
import { AssignmentProjectionService } from '../services/assignmentProjection.service';
import { ClassService } from '../services/class.service';
import { logger } from '../utils/logger';

/**
 * Creates class routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createClassRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const classService = ClassService.getInstance(dataSource, cacheManager);
  const assignmentProjectionService = AssignmentProjectionService.getInstance(
    dataSource,
    cacheManager
  );

  /**
   * GET /classes
   * Get all classes with optional pagination
   */
  router.get('/', paginationMiddleware, async (req: Request, res: Response) => {
    try {
      // If pagination params provided, use paginated response
      if (req.query.page || req.query.limit) {
        const result = await classService.findAll(req.pagination);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.json(result.data);
      }

      // Otherwise return all classes (backward compatibility)
      const result = await classService.findAllUnpaginated();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching classes',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch classes' });
    }
  });

  /**
   * POST /classes/bulk
   * Create multiple classes at once
   * NOTE: Must be defined before /:id routes to avoid matching 'bulk' as an ID
   */
  router.post('/bulk', async (req: Request, res: Response) => {
    try {
      const { classes } = req.body;

      if (!Array.isArray(classes) || classes.length === 0) {
        return res.status(400).json({ error: 'classes array is required' });
      }

      if (classes.length > 100) {
        return res.status(400).json({ error: 'Maximum 100 classes per bulk operation' });
      }

      logger.debug('Bulk creating classes', { count: classes.length });

      const results = [];
      for (const classData of classes) {
        const result = await classService.create(classData);
        if (result.success) {
          results.push(result.data);
        } else {
          logger.warn('Failed to create class in bulk', { error: result.error, classData });
        }
      }

      res.status(201).json(results);
    } catch (error) {
      logger.error(
        'Error bulk creating classes',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to bulk create classes' });
    }
  });

  /**
   * POST /classes/bulk-apply-curriculum
   * Apply curriculum to multiple classes based on their grades
   * NOTE: Must be defined before /:id routes to avoid matching as an ID
   */
  router.post('/bulk-apply-curriculum', async (req: Request, res: Response) => {
    try {
      const { classIds, overwrite = false } = req.body;

      // Validate input
      if (!classIds) {
        return res.status(400).json({ error: 'classIds is required' });
      }

      // If classIds is empty array, apply to all classes without requirements
      const applyToAll = Array.isArray(classIds) && classIds.length === 0;

      logger.info('Bulk applying curriculum', {
        classIds: applyToAll ? 'all' : classIds,
        overwrite,
        applyToAll,
      });

      const result = await classService.bulkApplyCurriculum(
        applyToAll ? undefined : classIds,
        overwrite
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      logger.info('Bulk curriculum application completed', {
        updated: result.data?.updated,
        skipped: result.data?.skipped,
        failed: result.data?.failed,
      });

      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error bulk applying curriculum',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to bulk apply curriculum' });
    }
  });

  /**
   * GET /classes/:id
   * Get a specific class by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid class ID' });
      }

      const result = await classService.findById(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching class',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch class' });
    }
  });

  /**
   * GET /classes/:id/assignment-view
   * Get the canonical assignment projection for a class
   */
  router.get('/:id/assignment-view', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid class ID' });
      }

      const result = await assignmentProjectionService.getClassAssignmentView(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      return res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching class assignment view',
        error instanceof Error ? error : new Error(String(error))
      );
      return res.status(500).json({ error: 'Failed to fetch class assignment view' });
    }
  });

  /**
   * POST /classes
   * Create a new class
   * Note: Subject requirements may be auto-populated from curriculum if grade is set
   */
  router.post('/', validateRequest(createClassSchema), async (req: Request, res: Response) => {
    try {
      const inputHasRequirements = req.body.subjectRequirements?.length > 0;
      logger.debug('Creating class', {
        name: req.body.name,
        grade: req.body.grade,
        hasInputRequirements: inputHasRequirements,
      });

      const result = await classService.create(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Log if auto-population occurred
      const wasAutoPopulated =
        !inputHasRequirements && (result.data?.subjectRequirements?.length ?? 0) > 0;
      if (wasAutoPopulated) {
        logger.info('Class created with auto-populated curriculum', {
          classId: result.data?.id,
          className: result.data?.name,
          grade: result.data?.grade,
          subjectCount: result.data?.subjectRequirements?.length ?? 0,
        });
      }

      res.status(201).json(result.data);
    } catch (error) {
      logger.error('Error saving class', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to save class' });
    }
  });

  /**
   * PUT /classes/:id
   * Update an existing class
   */
  router.put('/:id', validateRequest(updateClassSchema), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid class ID' });
      }

      logger.debug('Updating class', { id });
      const result = await classService.update(id, req.body);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error updating class',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to update class' });
    }
  });

  /**
   * DELETE /classes/:id
   * Delete a class
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid class ID' });
      }

      logger.debug('Deleting class', { id });
      const result = await classService.delete(id);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error deleting class',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete class' });
    }
  });

  return router;
}

export default createClassRoutes;
