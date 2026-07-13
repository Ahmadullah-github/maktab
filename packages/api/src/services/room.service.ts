/**
 * Room Service for business logic operations
 * @module services/room
 *
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to RoomService class
 */

import { DataSource } from 'typeorm';
import { RoomRepository, RoomInput, ParsedRoom } from '../database/repositories/room.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import { SWAP_CONSTRAINT_CACHE_PREFIX } from './SwapConstraintCache';

/**
 * RoomService handles all business logic for Room operations
 */
export class RoomService {
  private roomRepository: RoomRepository;
  private readonly cacheManager: CacheManager;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.roomRepository = RoomRepository.getInstance(dataSource, this.cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): RoomService {
    return getDataSourceScopedInstance(
      dataSource,
      RoomService,
      () => new RoomService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(RoomService);
  }

  async create(input: RoomInput): Promise<ServiceResult<ParsedRoom>> {
    try {
      if (!input.name || input.name.trim() === '') {
        return { success: false, error: 'Room name is required' };
      }

      const existing = await this.roomRepository.findByName(input.name);
      if (existing) {
        return { success: false, error: `Room with name "${input.name}" already exists` };
      }

      if (input.capacity !== undefined && input.capacity < 0) {
        return { success: false, error: 'Room capacity cannot be negative' };
      }

      const room = await this.roomRepository.saveRoom(input);
      this.invalidateSwapConstraints();
      logger.info('RoomService: Created room', { id: room.id, name: room.name });
      return { success: true, data: room };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to create room', error);
      return { success: false, error: error.message };
    }
  }

  async update(id: number, input: Partial<RoomInput>): Promise<ServiceResult<ParsedRoom>> {
    try {
      if (input.name !== undefined && input.name.trim() === '') {
        return { success: false, error: 'Room name cannot be empty' };
      }

      if (input.capacity !== undefined && input.capacity < 0) {
        return { success: false, error: 'Room capacity cannot be negative' };
      }

      const existing = await this.roomRepository.getRoom(id);
      if (!existing) {
        return { success: false, error: `Room with ID ${id} not found` };
      }

      if (input.name && input.name !== existing.name) {
        const duplicate = await this.roomRepository.findByName(input.name);
        if (duplicate && duplicate.id !== id) {
          return { success: false, error: `Room with name "${input.name}" already exists` };
        }
      }

      const room = await this.roomRepository.updateRoom(id, input);
      if (!room) {
        return { success: false, error: `Failed to update room with ID ${id}` };
      }

      this.invalidateSwapConstraints();
      logger.info('RoomService: Updated room', { id });
      return { success: true, data: room };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to update room', error, { id });
      return { success: false, error: error.message };
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.roomRepository.getRoom(id);
      if (!existing) {
        return { success: false, error: `Room with ID ${id} not found` };
      }

      const deleted = await this.roomRepository.deleteRoom(id);
      if (!deleted) {
        return { success: false, error: `Failed to delete room with ID ${id}` };
      }

      this.invalidateSwapConstraints();
      logger.info('RoomService: Deleted room', { id });
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to delete room', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedRoom>> {
    try {
      const room = await this.roomRepository.getRoom(id);
      if (!room) {
        return { success: false, error: `Room with ID ${id} not found` };
      }
      return { success: true, data: room };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to find room', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(
    pagination?: PaginationParams
  ): Promise<ServiceResult<PaginatedResponse<ParsedRoom>>> {
    try {
      const result = await this.roomRepository.getAllRooms(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to find all rooms', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const rooms = await this.roomRepository.getAllRoomsUnpaginated();
      return { success: true, data: rooms };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to find all rooms', error);
      return { success: false, error: error.message };
    }
  }

  async bulkImport(roomsData: RoomInput[]): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const invalidRooms = roomsData.filter((r) => !r.name || r.name.trim() === '');
      if (invalidRooms.length > 0) {
        return { success: false, error: `${invalidRooms.length} room(s) have empty names` };
      }

      const negativeCapacity = roomsData.filter((r) => r.capacity !== undefined && r.capacity < 0);
      if (negativeCapacity.length > 0) {
        return {
          success: false,
          error: `${negativeCapacity.length} room(s) have negative capacity`,
        };
      }

      const normalizedNames = roomsData.map((room) => room.name.trim());
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        return { success: false, error: 'Bulk import contains duplicate room names' };
      }
      for (const name of normalizedNames) {
        if (await this.roomRepository.findByName(name)) {
          return { success: false, error: `Room with name "${name}" already exists` };
        }
      }

      const rooms = await this.roomRepository.bulkImport(
        roomsData.map((room) => ({ ...room, name: room.name.trim() }))
      );
      this.invalidateSwapConstraints();
      logger.info('RoomService: Bulk imported rooms', { count: rooms.length });
      return { success: true, data: rooms };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to bulk import rooms', error);
      return { success: false, error: error.message };
    }
  }

  async bulkUpsert(roomsData: RoomInput[]): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const invalidRooms = roomsData.filter((r) => !r.name || r.name.trim() === '');
      if (invalidRooms.length > 0) {
        return { success: false, error: `${invalidRooms.length} room(s) have empty names` };
      }

      const rooms = await this.roomRepository.bulkUpsert(roomsData);
      this.invalidateSwapConstraints();
      logger.info('RoomService: Bulk upserted rooms', { count: rooms.length });
      return { success: true, data: rooms };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to bulk upsert rooms', error);
      return { success: false, error: error.message };
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }
      const deleted = await this.roomRepository.bulkDeleteRooms(ids);
      if (deleted > 0) {
        this.invalidateSwapConstraints();
      }
      logger.info('RoomService: Bulk deleted rooms', { count: deleted });
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to bulk delete rooms', error);
      return { success: false, error: error.message };
    }
  }

  async findByName(name: string): Promise<ServiceResult<ParsedRoom | null>> {
    try {
      const room = await this.roomRepository.findByName(name);
      return { success: true, data: room };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to find room by name', error, { name });
      return { success: false, error: error.message };
    }
  }

  async findByType(type: string): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const rooms = await this.roomRepository.findByType(type);
      return { success: true, data: rooms };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to find rooms by type', error, { type });
      return { success: false, error: error.message };
    }
  }

  async findByMinCapacity(minCapacity: number): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const rooms = await this.roomRepository.findByMinCapacity(minCapacity);
      return { success: true, data: rooms };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to find rooms by capacity', error, { minCapacity });
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.roomRepository.countRooms();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('RoomService: Failed to count rooms', error);
      return { success: false, error: error.message };
    }
  }

  private invalidateSwapConstraints(): void {
    this.cacheManager.invalidatePrefix(SWAP_CONSTRAINT_CACHE_PREFIX);
  }
}
