/**
 * Timetable routes
 * @module routes/timetable
 *
 * Requirements: 2.6
 * - All timetable-related endpoints
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { TimetableService } from '../services/timetable.service';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import { logger } from '../utils/logger';
import { CacheManager } from '../database/cache/cacheManager';
import { positiveIntegerParam, validateRequest } from '../middleware/validation.middleware';
import { createTimetableSchema, updateTimetableSchema } from '../schemas/timetable.schema';

/**
 * Creates timetable routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createTimetableRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('id', positiveIntegerParam);
  const timetableService = TimetableService.getInstance(dataSource, cacheManager);

  /**
   * GET /timetables
   * Get all timetables with optional pagination
   */
  router.get('/', paginationMiddleware, async (req: Request, res: Response) => {
    try {
      // If pagination params provided, use paginated response
      if (req.query.page || req.query.limit) {
        const result = await timetableService.findAll(req.pagination);
        if (!result.success) {
          return res.status(500).json({ error: result.error });
        }
        return res.json(result.data);
      }

      // Otherwise return all timetables (backward compatibility)
      const result = await timetableService.findAllUnpaginated();
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching timetables',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch timetables' });
    }
  });

  /**
   * GET /timetables/:id
   * Get a specific timetable by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid timetable ID' });
      }

      const result = await timetableService.findById(id);
      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching timetable',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch timetable' });
    }
  });

  /**
   * POST /timetables
   * Save a new timetable
   */
  router.post('/', validateRequest(createTimetableSchema), async (req: Request, res: Response) => {
    try {
      logger.debug('Saving timetable', { name: req.body.name });
      const result = await timetableService.create(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.status(201).json(result.data);
    } catch (error) {
      logger.error(
        'Error saving timetable',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to save timetable' });
    }
  });

  /**
   * PUT /timetables/:id
   * Update an existing timetable's data
   */
  router.put(
    '/:id',
    validateRequest(updateTimetableSchema),
    async (req: Request, res: Response) => {
      try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid timetable ID' });
        }

        const { data } = req.body;
        logger.debug('Updating timetable', { id });
        const result = await timetableService.updateData(id, data);
        if (!result.success) {
          if (result.error?.includes('not found')) {
            return res.status(404).json({ error: result.error });
          }
          return res.status(400).json({ error: result.error });
        }
        res.json(result.data);
      } catch (error) {
        logger.error(
          'Error updating timetable',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to update timetable' });
      }
    }
  );

  /**
   * DELETE /timetables/:id
   * Delete a timetable
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid timetable ID' });
      }

      logger.debug('Deleting timetable', { id });
      const result = await timetableService.delete(id);
      if (!result.success) {
        if (result.error?.includes('not found')) {
          return res.status(404).json({ error: result.error });
        }
        return res.status(400).json({ error: result.error });
      }
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error deleting timetable',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete timetable' });
    }
  });

  return router;
}

export default createTimetableRoutes;
