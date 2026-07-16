import { DataSource } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import {
  ParsedRoom,
  RoomDataIntegrityError,
  RoomInput,
  RoomRepository,
  normalizeRoomName,
} from '../database/repositories/room.repository';
import { RoomTypeRepository } from '../database/repositories/roomType.repository';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import {
  SchoolScopeConflictError,
  assertOperationalWriteScope,
} from '../utils/schoolScopeGuard';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import { SWAP_CONSTRAINT_CACHE_PREFIX } from './SwapConstraintCache';

export interface RoomDeleteBlocker {
  roomId: number;
  classes: Array<{ id: number; name: string; reference: 'fixedRoomId' | 'homeRoomId' }>;
}

export interface BulkRoomDeleteResult {
  deletedIds: number[];
}

function isUniqueNameError(error: unknown): boolean {
  return error instanceof Error && /room\.normalizedName|IDX_room_normalized_name_active/i.test(error.message);
}

export class RoomService {
  private readonly roomRepository: RoomRepository;
  private readonly roomTypeRepository: RoomTypeRepository;
  private readonly cacheManager: CacheManager;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.roomRepository = RoomRepository.getInstance(dataSource, this.cacheManager);
    this.roomTypeRepository = RoomTypeRepository.getInstance(dataSource, this.cacheManager);
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

  private failure(error: unknown): ServiceResult<never> {
    if (error instanceof SchoolScopeConflictError) {
      return {
        success: false,
        error: error.message,
        statusCode: error.statusCode,
        code: error.code,
        details: error.details,
      };
    }
    if (isUniqueNameError(error)) {
      return {
        success: false,
        error: 'An active room with this name already exists',
        statusCode: 409,
        code: 'ROOM_NAME_CONFLICT',
      };
    }
    const value = error instanceof Error ? error : new Error(String(error));
    logger.error('Room operation failed', value);
    return {
      success: false,
      error: value.message,
      statusCode: value instanceof RoomDataIntegrityError ? 500 : 400,
      code: value instanceof RoomDataIntegrityError ? 'ROOM_DATA_INTEGRITY_ERROR' : undefined,
      details: value instanceof RoomDataIntegrityError ? { roomId: value.roomId } : undefined,
    };
  }

  private async validateType(type: string | undefined): Promise<ServiceResult<never> | null> {
    if (!type) return null;
    const roomType = await this.roomTypeRepository.findActiveByValue(type);
    if (!roomType) {
      return {
        success: false,
        error: `Active room type "${type}" does not exist`,
        statusCode: 409,
        code: 'ROOM_TYPE_INACTIVE_OR_MISSING',
      };
    }
    return null;
  }

  async create(input: RoomInput): Promise<ServiceResult<ParsedRoom>> {
    try {
      const name = input.name.trim();
      if (!name) return { success: false, error: 'Room name is required', statusCode: 400 };
      const invalidType = await this.validateType(input.type);
      if (invalidType) return invalidType;
      await assertOperationalWriteScope(this.dataSource, [
        { entity: 'room', schoolId: input.schoolId ?? null },
      ]);
      const room = await this.roomRepository.saveRoom({ ...input, name });
      this.invalidateSwapConstraints();
      return { success: true, data: room };
    } catch (error) {
      return this.failure(error);
    }
  }

  async update(id: number, input: Partial<RoomInput>): Promise<ServiceResult<ParsedRoom>> {
    try {
      const existing = await this.roomRepository.getRoom(id);
      if (!existing) {
        return { success: false, error: `Room with ID ${id} not found`, statusCode: 404 };
      }
      if (input.name !== undefined && !input.name.trim()) {
        return { success: false, error: 'Room name cannot be empty', statusCode: 400 };
      }
      const invalidType = await this.validateType(input.type);
      if (invalidType) return invalidType;
      await assertOperationalWriteScope(this.dataSource, [
        {
          entity: 'room',
          id,
          schoolId: input.schoolId === undefined ? existing.schoolId : input.schoolId,
        },
      ]);
      const room = await this.roomRepository.updateRoom(id, {
        ...input,
        name: input.name?.trim(),
      });
      if (!room) return { success: false, error: `Room with ID ${id} not found`, statusCode: 404 };
      this.invalidateSwapConstraints();
      return { success: true, data: room };
    } catch (error) {
      return this.failure(error);
    }
  }

  private async blockers(ids: number[]): Promise<RoomDeleteBlocker[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = (await this.dataSource.query(
      `SELECT id, name, fixedRoomId, homeRoomId FROM class_group
       WHERE isDeleted = 0 AND (fixedRoomId IN (${placeholders}) OR homeRoomId IN (${placeholders}))`,
      [...ids, ...ids]
    )) as Array<{
      id: number;
      name: string;
      fixedRoomId: number | null;
      homeRoomId: number | null;
    }>;
    return ids.flatMap((roomId) => {
      const classes = rows.flatMap((row) => {
        const result: RoomDeleteBlocker['classes'] = [];
        if (row.fixedRoomId === roomId) result.push({ id: row.id, name: row.name, reference: 'fixedRoomId' });
        if (row.homeRoomId === roomId) result.push({ id: row.id, name: row.name, reference: 'homeRoomId' });
        return result;
      });
      return classes.length > 0 ? [{ roomId, classes }] : [];
    });
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    const result = await this.bulkDelete([id]);
    return result.success
      ? { success: true, data: true }
      : { ...result, data: undefined };
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<BulkRoomDeleteResult>> {
    try {
      const uniqueIds = [...new Set(ids)];
      const existing = await Promise.all(uniqueIds.map((id) => this.roomRepository.getRoom(id)));
      const missingIds = uniqueIds.filter((_, index) => !existing[index]);
      if (missingIds.length > 0) {
        return {
          success: false,
          error: 'One or more rooms do not exist or are already deleted',
          statusCode: 404,
          code: 'ROOMS_NOT_FOUND',
          details: { missingIds },
        };
      }
      const blockers = await this.blockers(uniqueIds);
      if (blockers.length > 0) {
        return {
          success: false,
          error: 'Rooms referenced by active classes cannot be deleted',
          statusCode: 409,
          code: 'ROOM_DELETE_BLOCKED',
          details: { blockers },
        };
      }
      const count = await this.roomRepository.bulkDeleteRooms(uniqueIds);
      if (count !== uniqueIds.length) {
        return { success: false, error: 'Atomic room deletion failed', statusCode: 409 };
      }
      this.invalidateSwapConstraints();
      return { success: true, data: { deletedIds: uniqueIds } };
    } catch (error) {
      return this.failure(error);
    }
  }

  async restore(id: number): Promise<ServiceResult<ParsedRoom>> {
    try {
      const archived = await this.roomRepository.getAnyRoom(id);
      if (!archived || !archived.isDeleted) {
        return { success: false, error: 'Archived room not found', statusCode: 404 };
      }
      const invalidType = await this.validateType(archived.type);
      if (invalidType) return invalidType;
      await assertOperationalWriteScope(this.dataSource, [
        { entity: 'room', id, schoolId: archived.schoolId },
      ]);
      const room = await this.roomRepository.restoreRoom(id);
      if (!room) return { success: false, error: 'Archived room not found', statusCode: 404 };
      this.invalidateSwapConstraints();
      return { success: true, data: room };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findDeleted(): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      return { success: true, data: await this.roomRepository.getDeletedRooms() };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedRoom>> {
    try {
      const room = await this.roomRepository.getRoom(id);
      return room
        ? { success: true, data: room }
        : { success: false, error: `Room with ID ${id} not found`, statusCode: 404 };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findAll(pagination?: PaginationParams): Promise<ServiceResult<PaginatedResponse<ParsedRoom>>> {
    try {
      return { success: true, data: await this.roomRepository.getAllRooms(pagination) };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      return { success: true, data: await this.roomRepository.getAllRoomsUnpaginated() };
    } catch (error) {
      return this.failure(error);
    }
  }

  async bulkImport(inputs: RoomInput[]): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const normalized = inputs.map((input) => ({ ...input, name: input.name.trim() }));
      if (normalized.some((input) => !input.name)) {
        return { success: false, error: 'Room names are required', statusCode: 400 };
      }
      const names = normalized.map((input) => normalizeRoomName(input.name));
      if (new Set(names).size !== names.length) {
        return { success: false, error: 'Bulk import contains duplicate room names', statusCode: 409 };
      }
      for (const input of normalized) {
        const invalidType = await this.validateType(input.type);
        if (invalidType) return invalidType;
      }
      await assertOperationalWriteScope(
        this.dataSource,
        normalized.map((input) => ({ entity: 'room', schoolId: input.schoolId ?? null }))
      );
      const rooms = await this.roomRepository.bulkImport(normalized);
      this.invalidateSwapConstraints();
      return { success: true, data: rooms };
    } catch (error) {
      return this.failure(error);
    }
  }

  async bulkUpsert(inputs: RoomInput[]): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      const normalized = inputs.map((input) => ({ ...input, name: input.name.trim() }));
      if (normalized.some((input) => !input.name)) {
        return { success: false, error: 'Room names are required', statusCode: 400 };
      }
      for (const input of normalized) {
        const invalidType = await this.validateType(input.type);
        if (invalidType) return invalidType;
      }
      const existing = await Promise.all(
        normalized.map((input) => this.roomRepository.findByName(input.name))
      );
      await assertOperationalWriteScope(
        this.dataSource,
        normalized.map((input, index) => ({
          entity: 'room',
          id: existing[index]?.id,
          schoolId:
            input.schoolId === undefined ? (existing[index]?.schoolId ?? null) : input.schoolId,
        }))
      );
      const rooms = await this.roomRepository.bulkUpsert(normalized);
      this.invalidateSwapConstraints();
      return { success: true, data: rooms };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findByName(name: string): Promise<ServiceResult<ParsedRoom | null>> {
    try {
      return { success: true, data: await this.roomRepository.findByName(name) };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findByType(type: string): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      return { success: true, data: await this.roomRepository.findByType(type) };
    } catch (error) {
      return this.failure(error);
    }
  }

  async findByMinCapacity(capacity: number): Promise<ServiceResult<ParsedRoom[]>> {
    try {
      return { success: true, data: await this.roomRepository.findByMinCapacity(capacity) };
    } catch (error) {
      return this.failure(error);
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      return { success: true, data: await this.roomRepository.countRooms() };
    } catch (error) {
      return this.failure(error);
    }
  }

  private invalidateSwapConstraints(): void {
    this.cacheManager.invalidatePrefix(SWAP_CONSTRAINT_CACHE_PREFIX);
  }
}
