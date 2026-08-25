/**
 * Config Repository for generic key-value configuration data access operations
 * @module database/repositories/config
 *
 * Requirements: 1.6
 * - Dedicated configRepository.ts file containing only Configuration-related database operations
 */

import { DataSource, EntityTarget } from 'typeorm';
import { Configuration } from '../../entity/Configuration';
import { logger } from '../../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

/**
 * Config Repository
 *
 * Handles generic Configuration database operations with:
 * - Key-value configuration storage
 * - Caching via CacheManager
 */
export class ConfigRepository extends BaseRepository<Configuration> {
  protected readonly entityClass: EntityTarget<Configuration> = Configuration;
  protected readonly cachePrefix: string = 'config';

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of ConfigRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): ConfigRepository {
    return getDataSourceScopedInstance(
      dataSource,
      ConfigRepository,
      () => new ConfigRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(ConfigRepository);
  }

  // =========================================================================
  // Configuration (Key-Value) Operations
  // =========================================================================

  /**
   * Get a configuration value by key
   * @param key - Configuration key
   * @param options - Repository options
   * @returns Configuration value or null if not found
   */
  async getConfiguration(key: string, options?: RepositoryOptions): Promise<string | null> {
    const cacheKey = `config:${key}`;

    // Check cache first
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<Configuration>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved configuration from cache', { key });
        return cached.value;
      }
    }

    const repo = this.getRepository(options?.manager);
    const config = await repo.findOne({ where: { key } });

    if (!config) {
      logger.debug('Configuration not found', { key });
      return null;
    }

    // Cache the result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, config);
      logger.debug('Retrieved configuration from database and cached', { key });
    }

    return config.value;
  }

  /**
   * Save a configuration value (upsert by key)
   * @param key - Configuration key
   * @param value - Configuration value
   * @param options - Repository options
   * @returns Saved configuration
   */
  async saveConfiguration(
    key: string,
    value: string,
    options?: RepositoryOptions
  ): Promise<Configuration> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    let config = await repo.findOne({ where: { key } });

    if (!config) {
      config = new Configuration();
      config.key = key;
      logger.debug('Creating new configuration', { key });
    } else {
      logger.debug('Updating existing configuration', { key });
    }

    // Ensure value is always a string
    config.value = typeof value === 'string' ? value : JSON.stringify(value);
    config.updatedAt = now;

    const saved = await repo.save(config);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      const cacheKey = `config:${key}`;
      this.cacheManager.delete(this.cachePrefix, cacheKey);
    }

    logger.info('Saved configuration', { key });
    return saved;
  }

  /**
   * Get all configurations
   * @param options - Repository options
   * @returns Array of all configurations
   */
  async getAllConfigurations(options?: RepositoryOptions): Promise<Configuration[]> {
    const repo = this.getRepository(options?.manager);
    const configs = await repo.find();
    logger.debug('Retrieved all configurations', { count: configs.length });
    return configs;
  }

  /**
   * Delete a configuration by key
   * @param key - Configuration key
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteConfiguration(key: string, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const result = await repo.delete({ key });

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      const cacheKey = `config:${key}`;
      this.cacheManager.delete(this.cachePrefix, cacheKey);
    }

    const success = (result.affected ?? 0) > 0;
    if (success) {
      logger.info('Deleted configuration', { key });
    }
    return success;
  }
}
