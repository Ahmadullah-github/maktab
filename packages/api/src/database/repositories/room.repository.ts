/**
 * Room Repository for Room entity data access operations
 * @module database/repositories/room
 * 
 * Requirements: 1.3
 * - Dedicated roomRepository.ts file containing only Room-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { Room } from '../../entity/Room';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';

/**
 * Room data transfer object for input
 */
export interface RoomInput {
  name: string;
  schoolId?: number | null;
  capacity?: number;
  type?: string;
  features?: string[];
  unavailable?: unknown[];
  meta?: Record<string, unknown>;
}

/**
 * Room with parsed JSON fields (plain object, not entity)
 */
export interface ParsedRoom {
  id: number;
  schoolId: number | null;
  name: string;
  capacity: number;
  type: string;
  features: string[];
  unavailable: unknown[];
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}


/**
 * Room Repository
 * 
 * Handles all Room-related database operations with:
 * - JSON field parsing/stringifying
 * - Caching via CacheManager
 * - Bulk operations with batch processing
 * - Transaction support
 * - findByName for upsert lookups
 */
export class RoomRepository extends BaseRepository<Room> {
  protected readonly entityClass: EntityTarget<Room> = Room;
  protected readonly cachePrefix: string = 'room';

  private static instance: RoomRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of RoomRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): RoomRepository {
    if (!RoomRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      RoomRepository.instance = new RoomRepository(dataSource, cache);
    }
    return RoomRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    RoomRepository.instance = null;
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON fields in a Room entity
   * @param room - Room entity with JSON string fields
   * @returns Room with parsed JSON fields as plain object
   */
  private parseRoomJsonFields(room: Room): ParsedRoom {
    return {
      id: room.id,
      schoolId: room.schoolId,
      name: room.name,
      capacity: room.capacity,
      type: room.type,
      features: safeJsonParse<string[]>(room.features, []),
      unavailable: safeJsonParse<unknown[]>(room.unavailable, []),
      meta: safeJsonParse<Record<string, unknown>>(room.meta, {}),
      isDeleted: room.isDeleted,
      deletedAt: room.deletedAt,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  /**
   * Stringify JSON fields for storage
   * @param input - Room input data
   * @returns Partial Room with stringified JSON fields
   */
  private stringifyRoomJsonFields(input: RoomInput): Partial<Room> {
    const capacity = (typeof input.capacity === 'number' && !isNaN(input.capacity)) 
      ? input.capacity : 0;

    return {
      name: input.name,
      schoolId: input.schoolId ?? null,
      capacity,
      type: input.type ?? '',
      features: safeJsonStringify(input.features ?? [], '[]'),
      unavailable: safeJsonStringify(input.unavailable ?? [], '[]'),
      meta: safeJsonStringify(input.meta ?? {}, '{}'),
    };
  }


  // =========================================================================
  // CRUD Operations with JSON Parsing
  // =========================================================================

  /**
   * Get a room by ID with parsed JSON fields
   * @param id - Room ID
   * @param options - Repository options
   * @returns Parsed room or null
   */
  async getRoom(id: number, options?: RepositoryOptions): Promise<ParsedRoom | null> {
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedRoom>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved room from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const room = await repo.findOne({ where: { id } });

    if (!room) {
      logger.debug('Room not found', { id });
      return null;
    }

    const parsed = this.parseRoomJsonFields(room);

    // Cache the parsed result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved room from database and cached', { id });
    }

    return parsed;
  }

  /**
   * Get all rooms with pagination and parsed JSON fields
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with parsed rooms
   */
  async getAllRooms(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedRoom>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);

    const [rooms, total] = await repo.findAndCount({
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    const parsedRooms = rooms.map((r) => this.parseRoomJsonFields(r));

    return {
      data: parsedRooms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all rooms without pagination (for backward compatibility)
   * @param options - Repository options
   * @returns Array of parsed rooms
   */
  async getAllRoomsUnpaginated(options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const cacheKey = this.getAllCacheKey();

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedRoom[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all rooms from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const rooms = await repo.find({ order: { id: 'ASC' } });

    const parsedRooms = rooms.map((r) => this.parseRoomJsonFields(r));

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedRooms);
      logger.debug('Retrieved all rooms from database and cached', {
        count: parsedRooms.length,
      });
    }

    return parsedRooms;
  }

  /**
   * Save a new room or update existing (upsert by name)
   * @param input - Room input data
   * @param options - Repository options
   * @returns Saved room with parsed JSON fields
   */
  async saveRoom(input: RoomInput, options?: RepositoryOptions): Promise<ParsedRoom> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    // Check for existing room by name (upsert logic)
    let room = await repo.findOne({ where: { name: input.name } });

    if (!room) {
      room = new Room();
      room.createdAt = now;
      logger.debug('Creating new room', { name: input.name });
    } else {
      logger.debug('Updating existing room', { name: input.name, id: room.id });
    }

    // Apply stringified JSON fields
    const stringified = this.stringifyRoomJsonFields(input);
    Object.assign(room, stringified);
    room.updatedAt = now;

    const saved = await repo.save(room);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(saved.id);
    }

    logger.info('Saved room', { id: saved.id, name: saved.name });
    return this.parseRoomJsonFields(saved);
  }


  /**
   * Update an existing room by ID
   * @param id - Room ID
   * @param input - Partial room input data
   * @param options - Repository options
   * @returns Updated room or null if not found
   */
  async updateRoom(
    id: number,
    input: Partial<RoomInput>,
    options?: RepositoryOptions
  ): Promise<ParsedRoom | null> {
    const repo = this.getRepository(options?.manager);
    const room = await repo.findOne({ where: { id } });

    if (!room) {
      logger.debug('Room not found for update', { id });
      return null;
    }

    // Apply updates with JSON stringification
    if (input.name !== undefined) room.name = input.name;
    if (input.schoolId !== undefined) room.schoolId = input.schoolId ?? null;
    if (input.capacity !== undefined) {
      room.capacity = (typeof input.capacity === 'number' && !isNaN(input.capacity)) 
        ? input.capacity : 0;
    }
    if (input.type !== undefined) room.type = input.type;
    if (input.features !== undefined) {
      room.features = safeJsonStringify(input.features, '[]');
    }
    if (input.unavailable !== undefined) {
      room.unavailable = safeJsonStringify(input.unavailable, '[]');
    }
    if (input.meta !== undefined) {
      room.meta = safeJsonStringify(input.meta, '{}');
    }

    room.updatedAt = new Date();
    const updated = await repo.save(room);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
    }

    logger.info('Updated room', { id });
    return this.parseRoomJsonFields(updated);
  }

  /**
   * Delete a room by ID
   * @param id - Room ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteRoom(id: number, options?: RepositoryOptions): Promise<boolean> {
    const result = await super.delete(id, options);
    if (result) {
      logger.info('Deleted room', { id });
    }
    return result;
  }

  // =========================================================================
  // Custom Query Methods
  // =========================================================================

  /**
   * Find a room by name
   * Requirements: 1.3 - Implement findByName for upsert lookups
   * @param name - Room name
   * @param options - Repository options
   * @returns Parsed room or null
   */
  async findByName(name: string, options?: RepositoryOptions): Promise<ParsedRoom | null> {
    const repo = this.getRepository(options?.manager);
    const room = await repo.findOne({ where: { name } });

    if (!room) {
      return null;
    }

    return this.parseRoomJsonFields(room);
  }

  /**
   * Find rooms by school ID
   * @param schoolId - School ID
   * @param options - Repository options
   * @returns Array of parsed rooms
   */
  async findBySchoolId(
    schoolId: number,
    options?: RepositoryOptions
  ): Promise<ParsedRoom[]> {
    const repo = this.getRepository(options?.manager);
    const rooms = await repo.find({
      where: { schoolId },
      order: { id: 'ASC' },
    });

    return rooms.map((r) => this.parseRoomJsonFields(r));
  }

  /**
   * Find rooms by type
   * @param type - Room type
   * @param options - Repository options
   * @returns Array of parsed rooms
   */
  async findByType(
    type: string,
    options?: RepositoryOptions
  ): Promise<ParsedRoom[]> {
    const repo = this.getRepository(options?.manager);
    const rooms = await repo.find({
      where: { type },
      order: { id: 'ASC' },
    });

    return rooms.map((r) => this.parseRoomJsonFields(r));
  }

  /**
   * Find rooms with capacity >= minCapacity
   * @param minCapacity - Minimum capacity
   * @param options - Repository options
   * @returns Array of parsed rooms
   */
  async findByMinCapacity(
    minCapacity: number,
    options?: RepositoryOptions
  ): Promise<ParsedRoom[]> {
    const repo = this.getRepository(options?.manager);
    const rooms = await repo
      .createQueryBuilder('room')
      .where('room.capacity >= :minCapacity', { minCapacity })
      .orderBy('room.id', 'ASC')
      .getMany();

    return rooms.map((r) => this.parseRoomJsonFields(r));
  }


  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Bulk import rooms with batch database operations
   * @param roomsData - Array of room input data
   * @param options - Repository options
   * @returns Array of saved rooms with parsed JSON fields
   */
  async bulkImport(
    roomsData: RoomInput[],
    options?: RepositoryOptions
  ): Promise<ParsedRoom[]> {
    if (roomsData.length === 0) {
      return [];
    }

    logger.info('Starting bulk import of rooms', { count: roomsData.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedRoom[]> => {
      const repo = manager.getRepository(Room);
      const now = new Date();

      // Prepare all room entities
      const roomEntities: Room[] = roomsData.map((input) => {
        const room = new Room();
        const stringified = this.stringifyRoomJsonFields(input);
        Object.assign(room, stringified);
        room.createdAt = now;
        room.updatedAt = now;
        return room;
      });

      // Batch save all rooms in a single operation
      const saved = await repo.save(roomEntities);

      logger.info('Bulk import completed', { count: saved.length });
      return saved.map((r) => this.parseRoomJsonFields(r));
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedRoom[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for rooms
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    return result;
  }

  /**
   * Bulk upsert rooms with batch database operations
   * @param roomsData - Array of room input data
   * @param options - Repository options
   * @returns Array of saved rooms with parsed JSON fields
   */
  async bulkUpsert(
    roomsData: RoomInput[],
    options?: RepositoryOptions
  ): Promise<ParsedRoom[]> {
    if (roomsData.length === 0) {
      return [];
    }

    logger.info('Starting bulk upsert of rooms', { count: roomsData.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedRoom[]> => {
      const repo = manager.getRepository(Room);
      const now = new Date();
      const results: Room[] = [];

      // Process rooms - need to check for existing ones for upsert
      for (const input of roomsData) {
        let room = await repo.findOne({ where: { name: input.name } });

        if (!room) {
          room = new Room();
          room.createdAt = now;
        }

        // Apply stringified JSON fields
        const stringified = this.stringifyRoomJsonFields(input);
        Object.assign(room, stringified);
        room.updatedAt = now;

        results.push(room);
      }

      // Batch save all rooms
      const saved = await repo.save(results);

      logger.info('Bulk upsert completed', { count: saved.length });
      return saved.map((r) => this.parseRoomJsonFields(r));
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedRoom[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for rooms
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    return result;
  }

  /**
   * Bulk delete rooms by IDs with transaction
   * @param ids - Array of room IDs to delete
   * @param options - Repository options
   * @returns Number of deleted rooms
   */
  async bulkDeleteRooms(ids: number[], options?: RepositoryOptions): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    logger.info('Starting bulk delete of rooms', { count: ids.length });

    const operation = async (manager: EntityManager): Promise<number> => {
      const repo = manager.getRepository(Room);
      const result = await repo.delete(ids);
      return result.affected ?? 0;
    };

    let deleted: number;
    if (options?.manager) {
      deleted = await operation(options.manager);
    } else {
      deleted = await this.withTransaction(operation);
    }

    // Invalidate all cache
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Bulk delete completed', { deleted });
    return deleted;
  }

  /**
   * Count total rooms
   * @param options - Repository options
   * @returns Total count
   */
  async countRooms(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }
}
