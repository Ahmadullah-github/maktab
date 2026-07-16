import { DataSource, EntityManager, EntityTarget, In } from 'typeorm';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { Room } from '../../entity/Room';
import { Teacher } from '../../entity/Teacher';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

export interface UnavailableSlot {
  day: string;
  period: number;
}

export interface RoomInput {
  name: string;
  schoolId?: number | null;
  capacity?: number;
  type?: string;
  features?: string[];
  unavailable?: UnavailableSlot[];
  meta?: Record<string, unknown>;
}

export interface ParsedRoom {
  id: number;
  schoolId: number | null;
  name: string;
  normalizedName: string;
  capacity: number;
  type: string;
  features: string[];
  unavailable: UnavailableSlot[];
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RoomDataIntegrityError extends Error {
  constructor(public readonly roomId: number, message: string) {
    super(`Room ${roomId} has invalid persisted availability: ${message}`);
    this.name = 'RoomDataIntegrityError';
  }
}

export function normalizeRoomName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeRoomFeatures(features: string[]): string[] {
  return [...new Set(features.map((feature) => feature.normalize('NFKC').trim().toLowerCase()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function parseUnavailable(room: Room): UnavailableSlot[] {
  let value: unknown;
  try {
    value = JSON.parse(room.unavailable || '[]');
  } catch {
    throw new RoomDataIntegrityError(room.id, 'value is not valid JSON');
  }
  if (!Array.isArray(value)) {
    throw new RoomDataIntegrityError(room.id, 'value is not an array');
  }
  for (const slot of value) {
    if (
      typeof slot !== 'object' ||
      slot === null ||
      typeof (slot as { day?: unknown }).day !== 'string' ||
      !Number.isInteger((slot as { period?: unknown }).period)
    ) {
      throw new RoomDataIntegrityError(room.id, 'every slot must contain a weekday string and integer period');
    }
  }
  return value as UnavailableSlot[];
}

export class RoomRepository extends BaseRepository<Room> {
  protected readonly entityClass: EntityTarget<Room> = Room;
  protected readonly cachePrefix = 'room';

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): RoomRepository {
    return getDataSourceScopedInstance(
      dataSource,
      RoomRepository,
      () => new RoomRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(RoomRepository);
  }

  private parse(room: Room): ParsedRoom {
    return {
      id: room.id,
      schoolId: room.schoolId,
      name: room.name,
      normalizedName: room.normalizedName,
      capacity: room.capacity,
      type: room.type,
      features: safeJsonParse<string[]>(room.features, []),
      unavailable: parseUnavailable(room),
      meta: safeJsonParse<Record<string, unknown>>(room.meta, {}),
      isDeleted: room.isDeleted,
      deletedAt: room.deletedAt,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private assign(room: Room, input: Partial<RoomInput>): void {
    if (input.name !== undefined) {
      room.name = input.name.trim();
      room.normalizedName = normalizeRoomName(input.name);
    }
    if (input.schoolId !== undefined) room.schoolId = input.schoolId;
    if (input.capacity !== undefined) room.capacity = input.capacity;
    if (input.type !== undefined) room.type = input.type.trim().toLowerCase();
    if (input.features !== undefined) {
      room.features = safeJsonStringify(normalizeRoomFeatures(input.features), '[]');
    }
    if (input.unavailable !== undefined) room.unavailable = safeJsonStringify(input.unavailable, '[]');
    if (input.meta !== undefined) room.meta = safeJsonStringify(input.meta, '{}');
  }

  async getRoom(id: number, options?: RepositoryOptions): Promise<ParsedRoom | null> {
    const entity = await this.getRepository(options?.manager).findOne({
      where: { id, isDeleted: false },
    });
    return entity ? this.parse(entity) : null;
  }

  async getAnyRoom(id: number, options?: RepositoryOptions): Promise<ParsedRoom | null> {
    const entity = await this.getRepository(options?.manager).findOne({ where: { id } });
    return entity ? this.parse(entity) : null;
  }

  async getAllRooms(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedRoom>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const [entities, total] = await this.getRepository(options?.manager).findAndCount({
      where: { isDeleted: false },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'ASC' },
    });
    return {
      data: entities.map((entity) => this.parse(entity)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllRoomsUnpaginated(options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const entities = await this.getRepository(options?.manager).find({
      where: { isDeleted: false },
      order: { id: 'ASC' },
    });
    return entities.map((entity) => this.parse(entity));
  }

  async getDeletedRooms(options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const entities = await this.getRepository(options?.manager).find({
      where: { isDeleted: true },
      order: { id: 'ASC' },
    });
    return entities.map((entity) => this.parse(entity));
  }

  async saveRoom(input: RoomInput, options?: RepositoryOptions): Promise<ParsedRoom> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();
    const room = repo.create({
      schoolId: null,
      capacity: 0,
      type: 'normal',
      features: '[]',
      unavailable: '[]',
      meta: '{}',
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    this.assign(room, input);
    const saved = await repo.save(room);
    this.invalidateAllCache();
    return this.parse(saved);
  }

  async updateRoom(
    id: number,
    input: Partial<RoomInput>,
    options?: RepositoryOptions
  ): Promise<ParsedRoom | null> {
    const repo = this.getRepository(options?.manager);
    const room = await repo.findOne({ where: { id, isDeleted: false } });
    if (!room) return null;
    this.assign(room, input);
    room.updatedAt = new Date();
    const saved = await repo.save(room);
    this.invalidateAllCache();
    return this.parse(saved);
  }

  async findByName(name: string, options?: RepositoryOptions): Promise<ParsedRoom | null> {
    const entity = await this.getRepository(options?.manager).findOne({
      where: { normalizedName: normalizeRoomName(name), isDeleted: false },
    });
    return entity ? this.parse(entity) : null;
  }

  async findByType(type: string, options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const entities = await this.getRepository(options?.manager).find({
      where: { type, isDeleted: false },
      order: { id: 'ASC' },
    });
    return entities.map((entity) => this.parse(entity));
  }

  async findByMinCapacity(minimum: number, options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const entities = await this.getRepository(options?.manager)
      .createQueryBuilder('room')
      .where('room.isDeleted = 0')
      .andWhere('room.capacity >= :minimum', { minimum })
      .orderBy('room.id', 'ASC')
      .getMany();
    return entities.map((entity) => this.parse(entity));
  }

  async bulkImport(inputs: RoomInput[], options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const operation = async (manager: EntityManager): Promise<ParsedRoom[]> => {
      const result: ParsedRoom[] = [];
      for (const input of inputs) result.push(await this.saveRoom(input, { manager, skipCache: true }));
      return result;
    };
    const result = options?.manager
      ? await operation(options.manager)
      : await this.withTransaction(operation);
    this.invalidateAllCache();
    return result;
  }

  async bulkUpsert(inputs: RoomInput[], options?: RepositoryOptions): Promise<ParsedRoom[]> {
    const operation = async (manager: EntityManager): Promise<ParsedRoom[]> => {
      const result: ParsedRoom[] = [];
      for (const input of inputs) {
        const existing = await this.findByName(input.name, { manager, skipCache: true });
        result.push(
          existing
            ? (await this.updateRoom(existing.id, input, { manager, skipCache: true }))!
            : await this.saveRoom(input, { manager, skipCache: true })
        );
      }
      return result;
    };
    const result = options?.manager
      ? await operation(options.manager)
      : await this.withTransaction(operation);
    this.invalidateAllCache();
    return result;
  }

  /** Soft-delete atomically and remove stale teacher preferences in the same transaction. */
  async bulkDeleteRooms(ids: number[], options?: RepositoryOptions): Promise<number> {
    if (ids.length === 0) return 0;
    const operation = async (manager: EntityManager): Promise<number> => {
      const roomRepo = manager.getRepository(Room);
      const rooms = await roomRepo.find({ where: { id: In(ids), isDeleted: false } });
      if (rooms.length !== ids.length) return 0;
      const now = new Date();
      for (const room of rooms) {
        room.isDeleted = true;
        room.deletedAt = now;
        room.updatedAt = now;
      }
      await roomRepo.save(rooms);

      const deletedIds = new Set(ids);
      const teacherRepo = manager.getRepository(Teacher);
      const teachers = await teacherRepo.find();
      for (const teacher of teachers) {
        const current = safeJsonParse<number[]>(teacher.preferredRoomIds, []);
        const next = current.filter((id) => !deletedIds.has(Number(id)));
        if (next.length !== current.length) {
          teacher.preferredRoomIds = JSON.stringify(next);
          teacher.updatedAt = now;
          await teacherRepo.save(teacher);
        }
      }
      return rooms.length;
    };
    const count = options?.manager
      ? await operation(options.manager)
      : await this.withTransaction(operation);
    this.invalidateAllCache();
    logger.info('Soft deleted rooms', { ids, count });
    return count;
  }

  async deleteRoom(id: number, options?: RepositoryOptions): Promise<boolean> {
    return (await this.bulkDeleteRooms([id], options)) === 1;
  }

  async restoreRoom(id: number, options?: RepositoryOptions): Promise<ParsedRoom | null> {
    const repo = this.getRepository(options?.manager);
    const room = await repo.findOne({ where: { id, isDeleted: true } });
    if (!room) return null;
    room.isDeleted = false;
    room.deletedAt = null;
    room.updatedAt = new Date();
    const saved = await repo.save(room);
    this.invalidateAllCache();
    return this.parse(saved);
  }

  async countRooms(options?: RepositoryOptions): Promise<number> {
    return this.getRepository(options?.manager).count({ where: { isDeleted: false } });
  }
}
