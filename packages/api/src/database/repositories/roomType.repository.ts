/**
 * RoomType Repository for RoomType entity data access operations
 * @module database/repositories/roomType
 */

import { DataSource, EntityTarget } from 'typeorm';
import { RoomType } from '../../entity/RoomType';
import { logger } from '../../utils/logger';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

/**
 * Seed data type for room types
 */
interface RoomTypeSeedData {
  value: string;
  label: string;
  icon: string;
  sortOrder: number;
  isSystem: boolean;
  isDeleted: boolean;
}

/**
 * Default room types to seed on first run
 */
export const DEFAULT_ROOM_TYPES: RoomTypeSeedData[] = [
  {
    value: '',
    label: 'بدون محدودیت',
    icon: 'Building',
    sortOrder: 0,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'normal',
    label: 'صنف عادی',
    icon: 'Building',
    sortOrder: 1,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'computer_lab',
    label: 'لابراتوار کمپیوتر',
    icon: 'Beaker',
    sortOrder: 2,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'biology_lab',
    label: 'لابراتوار بیولوژی',
    icon: 'Beaker',
    sortOrder: 3,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'chemistry_lab',
    label: 'لابراتوار کیمیا',
    icon: 'Beaker',
    sortOrder: 4,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'math_lab',
    label: 'لابراتوار ریاضی',
    icon: 'Beaker',
    sortOrder: 5,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'physics_lab',
    label: 'لابراتوار فزیک',
    icon: 'Beaker',
    sortOrder: 6,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'lab',
    label: 'لابراتوار',
    icon: 'Beaker',
    sortOrder: 7,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'library',
    label: 'کتابخانه',
    icon: 'Library',
    sortOrder: 8,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'salon',
    label: 'سالون',
    icon: 'Building',
    sortOrder: 9,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'gym',
    label: 'سالون ورزش',
    icon: 'Dumbbell',
    sortOrder: 10,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'sport_camp',
    label: 'میدان ورزشی',
    icon: 'Dumbbell',
    sortOrder: 11,
    isSystem: true,
    isDeleted: false,
  },
  {
    value: 'other',
    label: 'سایر',
    icon: 'Building',
    sortOrder: 99,
    isSystem: true,
    isDeleted: false,
  },
];

/**
 * RoomType input for create/update
 */
export interface RoomTypeInput {
  value: string;
  label: string;
  icon?: string | null;
  sortOrder?: number;
  isSystem?: boolean;
}

/**
 * Parsed RoomType (plain object)
 */
export interface ParsedRoomType {
  id: number;
  value: string;
  label: string;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RoomType Repository
 */
export class RoomTypeRepository extends BaseRepository<RoomType> {
  protected readonly entityClass: EntityTarget<RoomType> = RoomType;
  protected readonly cachePrefix: string = 'roomType';

  private static instance: RoomTypeRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): RoomTypeRepository {
    if (!RoomTypeRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      RoomTypeRepository.instance = new RoomTypeRepository(dataSource, cache);
    }
    return RoomTypeRepository.instance;
  }

  static resetInstance(): void {
    RoomTypeRepository.instance = null;
  }

  private parseRoomType(entity: RoomType): ParsedRoomType {
    return {
      id: entity.id,
      value: entity.value,
      label: entity.label,
      icon: entity.icon,
      sortOrder: entity.sortOrder,
      isSystem: entity.isSystem,
      isDeleted: entity.isDeleted,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Seed default room types if table is empty
   */
  async seedDefaults(options?: RepositoryOptions): Promise<void> {
    const repo = this.getRepository(options?.manager);
    const count = await repo.count();

    if (count > 0) {
      logger.debug('Room types already seeded, skipping');
      return;
    }

    logger.info('Seeding default room types', { count: DEFAULT_ROOM_TYPES.length });

    const now = new Date();
    const entities = DEFAULT_ROOM_TYPES.map((data) => {
      const entity = new RoomType();
      Object.assign(entity, data);
      entity.createdAt = now;
      entity.updatedAt = now;
      return entity;
    });

    await repo.save(entities);
    this.invalidateAllCache();
    logger.info('Default room types seeded successfully');
  }

  /**
   * Get all active room types (not deleted), ordered by sortOrder
   */
  async getAllActive(options?: RepositoryOptions): Promise<ParsedRoomType[]> {
    const cacheKey = `${this.cachePrefix}:active`;

    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedRoomType[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const entities = await repo.find({
      where: { isDeleted: false },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });

    const parsed = entities.map((e) => this.parseRoomType(e));

    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
    }

    return parsed;
  }

  /**
   * Get a room type by ID
   */
  async getRoomType(id: number, options?: RepositoryOptions): Promise<ParsedRoomType | null> {
    const cacheKey = this.getCacheKey(id);

    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedRoomType>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id } });

    if (!entity) {
      return null;
    }

    const parsed = this.parseRoomType(entity);

    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
    }

    return parsed;
  }

  /**
   * Find room type by value
   */
  async findByValue(value: string, options?: RepositoryOptions): Promise<ParsedRoomType | null> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { value } });
    return entity ? this.parseRoomType(entity) : null;
  }

  /**
   * Create a new room type
   */
  async createRoomType(input: RoomTypeInput, options?: RepositoryOptions): Promise<ParsedRoomType> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    // Get max sortOrder if not provided
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const maxResult = await repo
        .createQueryBuilder('rt')
        .select('MAX(rt.sortOrder)', 'max')
        .getRawOne();
      sortOrder = (maxResult?.max ?? 0) + 1;
    }

    const entity = new RoomType();
    entity.value = input.value;
    entity.label = input.label;
    entity.icon = input.icon ?? null;
    entity.sortOrder = sortOrder ?? 0;
    entity.isSystem = input.isSystem ?? false;
    entity.createdAt = now;
    entity.updatedAt = now;

    const saved = await repo.save(entity);
    this.invalidateAllCache();

    logger.info('Created room type', { id: saved.id, value: saved.value });
    return this.parseRoomType(saved);
  }

  /**
   * Update a room type
   */
  async updateRoomType(
    id: number,
    input: Partial<RoomTypeInput>,
    options?: RepositoryOptions
  ): Promise<ParsedRoomType | null> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id } });

    if (!entity) {
      return null;
    }

    if (input.value !== undefined) entity.value = input.value;
    if (input.label !== undefined) entity.label = input.label;
    if (input.icon !== undefined) entity.icon = input.icon;
    if (input.sortOrder !== undefined) entity.sortOrder = input.sortOrder;
    entity.updatedAt = new Date();

    const saved = await repo.save(entity);
    this.invalidateCache(id);

    logger.info('Updated room type', { id });
    return this.parseRoomType(saved);
  }

  /**
   * Soft delete a room type (only non-system types)
   */
  async deleteRoomType(id: number, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id } });

    if (!entity) {
      return false;
    }

    if (entity.isSystem) {
      logger.warn('Cannot delete system room type', { id, value: entity.value });
      return false;
    }

    entity.isDeleted = true;
    entity.deletedAt = new Date();
    entity.updatedAt = new Date();

    await repo.save(entity);
    this.invalidateCache(id);

    logger.info('Soft deleted room type', { id });
    return true;
  }

  /**
   * Restore a soft-deleted room type
   */
  async restoreRoomType(id: number, options?: RepositoryOptions): Promise<ParsedRoomType | null> {
    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({ where: { id } });

    if (!entity || !entity.isDeleted) {
      return null;
    }

    entity.isDeleted = false;
    entity.deletedAt = null;
    entity.updatedAt = new Date();

    const saved = await repo.save(entity);
    this.invalidateCache(id);

    logger.info('Restored room type', { id });
    return this.parseRoomType(saved);
  }
}
