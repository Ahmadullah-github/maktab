/**
 * Abstract Base Repository with generic CRUD operations
 * @module database/repositories/base
 * 
 * Requirements: 1.8, 11.4
 * - BaseRepository class providing reusable cache management and common operations
 * - Transaction support via withTransaction method
 */

import {
  DataSource,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
  DeepPartial,
} from 'typeorm';
import { CacheManager } from '../cache/cacheManager';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';

/**
 * Base entity interface that all entities should implement
 */
export interface BaseEntity extends ObjectLiteral {
  id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Options for repository operations
 */
export interface RepositoryOptions {
  /** Use a specific entity manager (for transactions) */
  manager?: EntityManager;
  /** Skip cache operations */
  skipCache?: boolean;
}

/**
 * Abstract Base Repository
 * 
 * Provides generic CRUD operations with:
 * - Integrated caching via CacheManager
 * - Transaction support via withTransaction
 * - Pagination support for list operations
 * - Bulk operations with batch processing
 */
export abstract class BaseRepository<T extends BaseEntity> {
  /** The entity class this repository manages */
  protected abstract readonly entityClass: EntityTarget<T>;
  
  /** Cache prefix for this entity type */
  protected abstract readonly cachePrefix: string;

  constructor(
    protected readonly dataSource: DataSource,
    protected readonly cacheManager: CacheManager
  ) {}

  /**
   * Get the TypeORM repository for this entity
   * @param manager - Optional entity manager for transactions
   */
  protected getRepository(manager?: EntityManager): Repository<T> {
    if (manager) {
      return manager.getRepository(this.entityClass);
    }
    return this.dataSource.getRepository(this.entityClass);
  }

  /**
   * Generate cache key for a single entity
   * @param id - Entity ID
   */
  protected getCacheKey(id: number): string {
    return `${this.cachePrefix}:${id}`;
  }

  /**
   * Generate cache key for the "all" collection
   */
  protected getAllCacheKey(): string {
    return `${this.cachePrefix}:all`;
  }

  /**
   * Invalidate cache for a specific entity
   * @param id - Entity ID (optional, invalidates all if not provided)
   */
  protected invalidateCache(id?: number): void {
    if (id !== undefined) {
      this.cacheManager.delete(this.cachePrefix, this.getCacheKey(id));
    }
    // Always invalidate the "all" cache when any entity changes
    this.cacheManager.delete(this.cachePrefix, this.getAllCacheKey());
  }

  /**
   * Invalidate all cache entries for this entity type
   */
  protected invalidateAllCache(): void {
    this.cacheManager.invalidatePrefix(this.cachePrefix);
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Find an entity by ID
   * @param id - Entity ID
   * @param options - Repository options
   * @returns The entity or null if not found
   */
  async findById(id: number, options?: RepositoryOptions): Promise<T | null> {
    const cacheKey = this.getCacheKey(id);
    
    // Check cache first (unless skipCache is true)
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<T>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const entity = await repo.findOne({
      where: { id } as FindOptionsWhere<T>,
    });

    // Cache the result
    if (entity && !options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, entity);
    }

    return entity;
  }

  /**
   * Find all entities with optional pagination
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with entities
   */
  async findAll(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<T>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);
    
    const [data, total] = await repo.findAndCount({
      skip,
      take: limit,
      order: { id: 'ASC' } as any,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find all entities without pagination (for backward compatibility)
   * @param options - Repository options
   * @returns Array of all entities
   */
  async findAllUnpaginated(options?: RepositoryOptions): Promise<T[]> {
    const cacheKey = this.getAllCacheKey();
    
    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<T[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const entities = await repo.find({
      order: { id: 'ASC' } as any,
    });

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, entities);
    }

    return entities;
  }

  /**
   * Save a new entity or update an existing one
   * @param data - Entity data
   * @param options - Repository options
   * @returns The saved entity
   */
  async save(data: DeepPartial<T>, options?: RepositoryOptions): Promise<T> {
    const repo = this.getRepository(options?.manager);
    
    // Set timestamps
    const now = new Date();
    const entityData = {
      ...data,
      updatedAt: now,
    } as DeepPartial<T>;
    
    // If no ID, it's a new entity
    if (!('id' in data) || data.id === undefined) {
      (entityData as any).createdAt = now;
    }

    const entity = repo.create(entityData);
    const saved = await repo.save(entity);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(saved.id);
    }

    return saved;
  }

  /**
   * Update an existing entity
   * @param id - Entity ID
   * @param data - Partial entity data to update
   * @param options - Repository options
   * @returns The updated entity or null if not found
   */
  async update(
    id: number,
    data: DeepPartial<T>,
    options?: RepositoryOptions
  ): Promise<T | null> {
    const repo = this.getRepository(options?.manager);
    
    // Find existing entity
    const existing = await repo.findOne({
      where: { id } as FindOptionsWhere<T>,
    });
    
    if (!existing) {
      return null;
    }

    // Merge and save
    const merged = repo.merge(existing, {
      ...data,
      updatedAt: new Date(),
    } as DeepPartial<T>);
    
    const updated = await repo.save(merged);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
    }

    return updated;
  }

  /**
   * Delete an entity by ID
   * @param id - Entity ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async delete(id: number, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const result = await repo.delete(id);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
    }

    return (result.affected ?? 0) > 0;
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Save multiple entities in a batch
   * @param entities - Array of entity data
   * @param options - Repository options
   * @returns Array of saved entities
   */
  async bulkSave(
    entities: DeepPartial<T>[],
    options?: RepositoryOptions
  ): Promise<T[]> {
    if (entities.length === 0) {
      return [];
    }

    const repo = this.getRepository(options?.manager);
    const now = new Date();

    // Prepare entities with timestamps
    const prepared = entities.map((data) => {
      const entityData = {
        ...data,
        createdAt: now,
        updatedAt: now,
      } as DeepPartial<T>;
      return repo.create(entityData);
    });

    // Use batch save
    const saved = await repo.save(prepared);

    // Invalidate all cache for this entity type
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    return saved;
  }

  /**
   * Delete multiple entities by IDs
   * @param ids - Array of entity IDs
   * @param options - Repository options
   * @returns Number of deleted entities
   */
  async bulkDelete(ids: number[], options?: RepositoryOptions): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const repo = this.getRepository(options?.manager);
    const result = await repo.delete(ids);

    // Invalidate all cache for this entity type
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    return result.affected ?? 0;
  }

  // =========================================================================
  // Transaction Support
  // =========================================================================

  /**
   * Execute an operation within a transaction
   * @param operation - Function to execute within the transaction
   * @returns Result of the operation
   * 
   * Requirements: 11.4
   * - Repositories accept optional EntityManager for transaction participation
   */
  async withTransaction<R>(
    operation: (manager: EntityManager) => Promise<R>
  ): Promise<R> {
    return this.dataSource.transaction(async (manager) => {
      return operation(manager);
    });
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Count total entities
   * @param options - Repository options
   * @returns Total count
   */
  async count(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }

  /**
   * Check if an entity exists by ID
   * @param id - Entity ID
   * @param options - Repository options
   * @returns true if exists
   */
  async exists(id: number, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const count = await repo.count({
      where: { id } as FindOptionsWhere<T>,
    });
    return count > 0;
  }

  /**
   * Find entities by a specific field value
   * @param field - Field name
   * @param value - Field value
   * @param options - Repository options
   * @returns Array of matching entities
   */
  async findByField<K extends keyof T>(
    field: K,
    value: T[K],
    options?: RepositoryOptions
  ): Promise<T[]> {
    const repo = this.getRepository(options?.manager);
    return repo.find({
      where: { [field]: value } as FindOptionsWhere<T>,
    });
  }

  /**
   * Find a single entity by a specific field value
   * @param field - Field name
   * @param value - Field value
   * @param options - Repository options
   * @returns The entity or null
   */
  async findOneByField<K extends keyof T>(
    field: K,
    value: T[K],
    options?: RepositoryOptions
  ): Promise<T | null> {
    const repo = this.getRepository(options?.manager);
    return repo.findOne({
      where: { [field]: value } as FindOptionsWhere<T>,
    });
  }
}
