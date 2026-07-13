/**
 * RoomType routes for managing room types
 * @module routes/roomType
 */

import { Request, Response, Router } from 'express';
import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { RoomTypeRepository } from '../database/repositories/roomType.repository';
import { positiveIntegerParam, validateRequest } from '../middleware/validation.middleware';
import { createRoomTypeSchema, updateRoomTypeSchema } from '../schemas/roomType.schema';
import { logger } from '../utils/logger';

export function createRoomTypeRoutes(dataSource: DataSource, cacheManager?: CacheManager): Router {
  const router = Router();
  router.param('id', positiveIntegerParam);
  const cache = cacheManager ?? CacheManager.getInstance();
  const roomTypeRepo = RoomTypeRepository.getInstance(dataSource, cache);

  // Seed defaults on route initialization
  roomTypeRepo.seedDefaults().catch((err) => {
    logger.error('Failed to seed room types', err);
  });

  /**
   * GET /api/room-types
   * Get all active room types
   */
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const roomTypes = await roomTypeRepo.getAllActive();
      res.json(roomTypes);
    } catch (error) {
      logger.error('Failed to get room types', error as Error);
      res.status(500).json({ error: 'Failed to get room types' });
    }
  });

  /**
   * GET /api/room-types/:id
   * Get a single room type by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const roomType = await roomTypeRepo.getRoomType(id);
      if (!roomType) {
        res.status(404).json({ error: 'Room type not found' });
        return;
      }

      res.json(roomType);
    } catch (error) {
      logger.error('Failed to get room type', error as Error);
      res.status(500).json({ error: 'Failed to get room type' });
    }
  });

  /**
   * POST /api/room-types
   * Create a new room type
   */
  router.post('/', validateRequest(createRoomTypeSchema), async (req: Request, res: Response) => {
    try {
      const { value, label, icon, sortOrder } = req.body;

      if (!value || !label) {
        res.status(400).json({ error: 'value and label are required' });
        return;
      }

      // Check for duplicate value
      const existing = await roomTypeRepo.findByValue(value);
      if (existing) {
        res.status(409).json({ error: 'Room type with this value already exists' });
        return;
      }

      const roomType = await roomTypeRepo.createRoomType({
        value,
        label,
        icon,
        sortOrder,
        isSystem: false,
      });

      res.status(201).json(roomType);
    } catch (error) {
      logger.error('Failed to create room type', error as Error);
      res.status(500).json({ error: 'Failed to create room type' });
    }
  });

  /**
   * PUT /api/room-types/:id
   * Update a room type
   */
  router.put('/:id', validateRequest(updateRoomTypeSchema), async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const { value, label, icon, sortOrder } = req.body;

      // If changing value, check for duplicates
      if (value) {
        const existing = await roomTypeRepo.findByValue(value);
        if (existing && existing.id !== id) {
          res.status(409).json({ error: 'Room type with this value already exists' });
          return;
        }
      }

      const roomType = await roomTypeRepo.updateRoomType(id, {
        value,
        label,
        icon,
        sortOrder,
      });

      if (!roomType) {
        res.status(404).json({ error: 'Room type not found' });
        return;
      }

      res.json(roomType);
    } catch (error) {
      logger.error('Failed to update room type', error as Error);
      res.status(500).json({ error: 'Failed to update room type' });
    }
  });

  /**
   * DELETE /api/room-types/:id
   * Soft delete a room type (non-system only)
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const deleted = await roomTypeRepo.deleteRoomType(id);
      if (!deleted) {
        res.status(400).json({ error: 'Cannot delete system room type or room type not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete room type', error as Error);
      res.status(500).json({ error: 'Failed to delete room type' });
    }
  });

  /**
   * POST /api/room-types/:id/restore
   * Restore a soft-deleted room type
   */
  router.post('/:id/restore', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const roomType = await roomTypeRepo.restoreRoomType(id);
      if (!roomType) {
        res.status(404).json({ error: 'Room type not found or not deleted' });
        return;
      }

      res.json(roomType);
    } catch (error) {
      logger.error('Failed to restore room type', error as Error);
      res.status(500).json({ error: 'Failed to restore room type' });
    }
  });

  return router;
}
