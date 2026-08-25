import { DataSource, EntityTarget } from 'typeorm';
import { DEFAULT_ROOM_TYPES } from '../../constants/roomTypes';
import { RoomType } from '../../entity/RoomType';
import { logger } from '../../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

export { DEFAULT_ROOM_TYPES } from '../../constants/roomTypes';

export interface RoomTypeInput {
  value: string;
  labelFa: string;
  labelEn: string;
  icon?: string | null;
  sortOrder?: number;
  isSystem?: boolean;
}

export interface RoomTypeUpdateInput {
  labelFa?: string;
  labelEn?: string;
  icon?: string | null;
  sortOrder?: number;
}

export interface ParsedRoomType {
  id: number;
  value: string;
  /** Transitional alias retained for older clients. */
  label: string;
  labelFa: string;
  labelEn: string;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class RoomTypeRepository extends BaseRepository<RoomType> {
  protected readonly entityClass: EntityTarget<RoomType> = RoomType;
  protected readonly cachePrefix = 'roomType';

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): RoomTypeRepository {
    return getDataSourceScopedInstance(
      dataSource,
      RoomTypeRepository,
      () => new RoomTypeRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(RoomTypeRepository);
  }

  private parse(entity: RoomType): ParsedRoomType {
    return {
      id: entity.id,
      value: entity.value,
      label: entity.labelFa,
      labelFa: entity.labelFa,
      labelEn: entity.labelEn?.trim() || entity.labelFa,
      icon: entity.icon,
      sortOrder: entity.sortOrder,
      isSystem: entity.isSystem,
      isDeleted: entity.isDeleted,
      deletedAt: entity.deletedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /** Preserve custom data while ensuring all shipped values exist. */
  async seedDefaults(options?: RepositoryOptions): Promise<void> {
    const repo = this.getRepository(options?.manager);
    const values = new Set((await repo.find({ select: { value: true } })).map((row) => row.value));
    const now = new Date();
    const missing = DEFAULT_ROOM_TYPES.filter((definition) => !values.has(definition.value)).map(
      (definition) => {
        const entity = new RoomType();
        Object.assign(entity, definition, {
          isSystem: true,
          isDeleted: false,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        return entity;
      }
    );
    if (missing.length > 0) {
      await repo.save(missing);
      this.invalidateAllCache();
      logger.info('Seeded missing default room types', { count: missing.length });
    }
  }

  async getAllActive(options?: RepositoryOptions): Promise<ParsedRoomType[]> {
    const entities = await this.getRepository(options?.manager).find({
      where: { isDeleted: false },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return entities.map((entity) => this.parse(entity));
  }

  async getAllDeleted(options?: RepositoryOptions): Promise<ParsedRoomType[]> {
    const entities = await this.getRepository(options?.manager).find({
      where: { isDeleted: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return entities.map((entity) => this.parse(entity));
  }

  async getRoomType(id: number, options?: RepositoryOptions): Promise<ParsedRoomType | null> {
    const entity = await this.getRepository(options?.manager).findOne({ where: { id } });
    return entity ? this.parse(entity) : null;
  }

  async findByValue(value: string, options?: RepositoryOptions): Promise<ParsedRoomType | null> {
    const entity = await this.getRepository(options?.manager).findOne({
      where: { value: value.trim().toLowerCase() },
    });
    return entity ? this.parse(entity) : null;
  }

  async findActiveByValue(
    value: string,
    options?: RepositoryOptions
  ): Promise<ParsedRoomType | null> {
    const entity = await this.getRepository(options?.manager).findOne({
      where: { value: value.trim().toLowerCase(), isDeleted: false },
    });
    return entity ? this.parse(entity) : null;
  }

  async createRoomType(input: RoomTypeInput, options?: RepositoryOptions): Promise<ParsedRoomType> {
    const repo = this.getRepository(options?.manager);
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const row = await repo.createQueryBuilder('roomType').select('MAX(roomType.sortOrder)', 'max').getRawOne();
      sortOrder = Number(row?.max ?? 0) + 1;
    }
    const now = new Date();
    const entity = repo.create({
      value: input.value.trim().toLowerCase(),
      labelFa: input.labelFa.trim(),
      labelEn: input.labelEn.trim(),
      icon: input.icon ?? 'Building',
      sortOrder,
      isSystem: input.isSystem ?? false,
      isDeleted: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repo.save(entity);
    this.invalidateAllCache();
    return this.parse(saved);
  }

  async updateRoomType(
    id: number,
    input: RoomTypeUpdateInput,
    options?: RepositoryOptions
  ): Promise<ParsedRoomType | null> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id, isDeleted: false } });
    if (!entity) return null;
    if (input.labelFa !== undefined) entity.labelFa = input.labelFa.trim();
    if (input.labelEn !== undefined) entity.labelEn = input.labelEn.trim();
    if (input.icon !== undefined) entity.icon = input.icon;
    if (input.sortOrder !== undefined) entity.sortOrder = input.sortOrder;
    entity.updatedAt = new Date();
    const saved = await repo.save(entity);
    this.invalidateAllCache();
    return this.parse(saved);
  }

  async deleteRoomType(id: number, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id, isDeleted: false } });
    if (!entity) return false;
    entity.isDeleted = true;
    entity.deletedAt = new Date();
    entity.updatedAt = new Date();
    await repo.save(entity);
    this.invalidateAllCache();
    return true;
  }

  async restoreRoomType(id: number, options?: RepositoryOptions): Promise<ParsedRoomType | null> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id, isDeleted: true } });
    if (!entity) return null;
    entity.isDeleted = false;
    entity.deletedAt = null;
    entity.updatedAt = new Date();
    const saved = await repo.save(entity);
    this.invalidateAllCache();
    return this.parse(saved);
  }
}
