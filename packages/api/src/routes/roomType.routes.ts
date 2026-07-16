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

  router.get('/archived', async (_req: Request, res: Response) => {
    try {
      res.json(await roomTypeRepo.getAllDeleted());
    } catch (error) {
      logger.error('Failed to get archived room types', error as Error);
      res.status(500).json({ error: 'Failed to get archived room types' });
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
      const { value, labelFa, labelEn, icon, sortOrder } = req.body;

      // Check for duplicate value
      const existing = await roomTypeRepo.findByValue(value);
      if (existing) {
        res.status(409).json({
          error: existing.isDeleted
            ? 'This room type value is archived and must be restored'
            : 'Room type with this value already exists',
          code: existing.isDeleted ? 'ROOM_TYPE_RESTORE_REQUIRED' : 'ROOM_TYPE_VALUE_CONFLICT',
          ...(existing.isDeleted ? { roomTypeId: existing.id } : {}),
        });
        return;
      }

      const roomType = await roomTypeRepo.createRoomType({
        value,
        labelFa,
        labelEn,
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

      const { labelFa, labelEn, icon, sortOrder } = req.body;

      const roomType = await roomTypeRepo.updateRoomType(id, {
        labelFa,
        labelEn,
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
   * Soft delete an unreferenced room type.
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' });
        return;
      }

      const roomType = await roomTypeRepo.getRoomType(id);
      if (!roomType || roomType.isDeleted) {
        res.status(404).json({ error: 'Active room type not found' });
        return;
      }
      const [rooms, subjects] = await Promise.all([
        dataSource.query(
          'SELECT id, name FROM room WHERE isDeleted = 0 AND type = ?',
          [roomType.value]
        ) as Promise<Array<{ id: number; name: string }>>,
        dataSource.query(
          'SELECT id, name FROM subject WHERE isDeleted = 0 AND requiredRoomType = ?',
          [roomType.value]
        ) as Promise<Array<{ id: number; name: string }>>,
      ]);
      if (rooms.length > 0 || subjects.length > 0) {
        res.status(409).json({
          error: 'Room type is still referenced by active data',
          code: 'ROOM_TYPE_DELETE_BLOCKED',
          details: { rooms, subjects },
        });
        return;
      }

      const deleted = await roomTypeRepo.deleteRoomType(id);
      if (!deleted) {
        res.status(404).json({ error: 'Active room type not found' });
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
