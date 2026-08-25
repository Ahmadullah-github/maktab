/**
 * Room routes
 * @module routes/room
 *
 * Requirements: 2.4, 6.3
 * - All room-related endpoints
 * - Pagination support for list endpoint
 * - Validation middleware for POST/PUT
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { paginationMiddleware } from '../middleware/pagination.middleware';
import { positiveIntegerParam, validateRequest } from '../middleware/validation.middleware';
import {
  bulkCreateRoomSchema,
  bulkDeleteRoomSchema,
  createRoomSchema,
  updateRoomSchema,
} from '../schemas/room.schema';
import { RoomService } from '../services/room.service';
import { logger } from '../utils/logger';

/**
 * Creates room routes with injected dependencies
 * @param dataSource - TypeORM DataSource
 * @param cacheManager - Optional CacheManager instance
 */
export function createRoomRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('id', positiveIntegerParam);
  const roomService = RoomService.getInstance(dataSource, cacheManager);

  const sendFailure = (res: Response, result: { error?: string; statusCode?: number; code?: string; details?: unknown }) =>
    res.status(result.statusCode ?? 400).json({
      error: result.error,
      ...(result.code ? { code: result.code } : {}),
      ...(result.details !== undefined ? { details: result.details } : {}),
    });

  /**
   * GET /rooms
   * Get all rooms with optional pagination
   */
  router.get('/', paginationMiddleware, async (req: Request, res: Response) => {
    try {
      // If pagination params provided, use paginated response
      if (req.query.page || req.query.limit) {
        const result = await roomService.findAll(req.pagination);
        if (!result.success) {
          return sendFailure(res, result);
        }
        return res.json(result.data);
      }

      // Otherwise return all rooms (backward compatibility)
      const result = await roomService.findAllUnpaginated();
      if (!result.success) {
        return sendFailure(res, result);
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching rooms',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  /** Maintenance endpoint; the Rooms screen intentionally has no archive view. */
  router.get('/deleted', async (_req: Request, res: Response) => {
    const result = await roomService.findDeleted();
    if (!result.success) return sendFailure(res, result);
    return res.json(result.data);
  });

  /**
   * GET /rooms/:id
   * Get a specific room by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid room ID' });
      }

      const result = await roomService.findById(id);
      if (!result.success) {
        return sendFailure(res, result);
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error fetching room',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  /**
   * POST /rooms/bulk
   * Bulk create multiple rooms at once
   * NOTE: This route MUST be defined BEFORE /:id routes
   */
  router.post(
    '/bulk',
    validateRequest(bulkCreateRoomSchema),
    async (req: Request, res: Response) => {
      try {
        const { rooms } = req.body;
        logger.debug('Bulk creating rooms', { count: rooms.length });

        const result = await roomService.bulkImport(rooms);
        if (!result.success) {
          return sendFailure(res, result);
        }

        logger.info('Bulk created rooms', { count: result.data?.length ?? 0 });
        res.status(201).json(result.data);
      } catch (error) {
        logger.error(
          'Error bulk creating rooms',
          error instanceof Error ? error : new Error(String(error))
        );
        res.status(500).json({ error: 'Failed to bulk create rooms' });
      }
    }
  );

  /** Atomic, all-or-nothing bulk soft deletion. */
  router.post(
    '/bulk-delete',
    validateRequest(bulkDeleteRoomSchema),
    async (req: Request, res: Response) => {
      const result = await roomService.bulkDelete(req.body.ids);
      if (!result.success) return sendFailure(res, result);
      return res.json(result.data);
    }
  );

  /**
   * POST /rooms
   * Create a new room
   */
  router.post('/', validateRequest(createRoomSchema), async (req: Request, res: Response) => {
    try {
      logger.debug('Saving room', { name: req.body.name });
      const result = await roomService.create(req.body);
      if (!result.success) {
        return sendFailure(res, result);
      }
      res.status(201).json(result.data);
    } catch (error) {
      logger.error('Error saving room', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ error: 'Failed to save room' });
    }
  });

  /**
   * PUT /rooms/:id
   * Update an existing room
   */
  router.put('/:id', validateRequest(updateRoomSchema), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid room ID' });
      }

      logger.debug('Updating room', { id });
      const result = await roomService.update(id, req.body);
      if (!result.success) {
        return sendFailure(res, result);
      }
      res.json(result.data);
    } catch (error) {
      logger.error(
        'Error updating room',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to update room' });
    }
  });

  router.post('/:id/restore', async (req: Request, res: Response) => {
    const result = await roomService.restore(Number(req.params.id));
    if (!result.success) return sendFailure(res, result);
    return res.json(result.data);
  });

  /**
   * DELETE /rooms/:id
   * Delete a room
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid room ID' });
      }

      logger.debug('Deleting room', { id });
      const result = await roomService.delete(id);
      if (!result.success) {
        return sendFailure(res, result);
      }
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error deleting room',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

  return router;
}

export default createRoomRoutes;
