/**
 * Class routes
 * @module routes/class
 * 
 * Requirements: 2.5, 6.4
 * - All class-related endpoints
 * - Pagination support for list endpoint
 * - Validation middleware for POST/PUT
 */

import { Router, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { ClassService } from '../services/class.service';
import { validateRequest } from '../middleware/validation.middleware';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import { createClassSchema, updateClassSchema } from '../schemas/class.schema';
import { logger } from '../utils/logger';
import { CacheManager } from '../database/cache/cacheManager';

/**
 * Creates class routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createClassRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  const classService = ClassService.getInstance(dataSource, cacheManager);

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
      logger.error('Error fetching classes', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to fetch classes' });
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
      logger.error('Error fetching class', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to fetch class' });
    }
  });

  /**
   * POST /classes
   * Create a new class
   */
  router.post('/', validateRequest(createClassSchema), async (req: Request, res: Response) => {
    try {
      logger.debug('Saving class', { name: req.body.name });
      const result = await classService.create(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
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
      logger.error('Error updating class', error instanceof Error ? error : new Error(String(error)));
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
      logger.error('Error deleting class', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to delete class' });
    }
  });

  return router;
}

export default createClassRoutes;
