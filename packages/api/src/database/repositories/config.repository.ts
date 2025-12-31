/**
 * Config Repository for Configuration and SchoolConfig entity data access operations
 * @module database/repositories/config
 * 
 * Requirements: 1.6
 * - Dedicated configRepository.ts file containing only Configuration-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { Configuration } from '../../entity/Configuration';
import { SchoolConfig } from '../../entity/SchoolConfig';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';

/**
 * SchoolConfig input data transfer object
 */
export interface SchoolConfigInput {
  schoolName?: string | null;
  enablePrimary?: boolean;
  enableMiddle?: boolean;
  enableHigh?: boolean;
  daysPerWeek?: number;
  periodsPerDay?: number;
  breakPeriods?: unknown[] | string;
}

/**
 * Parsed SchoolConfig with breakPeriods as array
 */
export interface ParsedSchoolConfig {
  id: number;
  schoolName: string | null;
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  daysPerWeek: number;
  periodsPerDay: number;
  breakPeriods: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Config Repository
 * 
 * Handles Configuration and SchoolConfig database operations with:
 * - Key-value configuration storage
 * - SchoolConfig singleton management
 * - Caching via CacheManager
 */
export class ConfigRepository extends BaseRepository<Configuration> {
  protected readonly entityClass: EntityTarget<Configuration> = Configuration;
  protected readonly cachePrefix: string = 'config';

  private static instance: ConfigRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of ConfigRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): ConfigRepository {
    if (!ConfigRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      ConfigRepository.instance = new ConfigRepository(dataSource, cache);
    }
    return ConfigRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    ConfigRepository.instance = null;
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
    if (!options?.skipCache) {
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
    if (!options?.skipCache) {
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
    if (!options?.skipCache) {
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
    if (!options?.skipCache) {
      const cacheKey = `config:${key}`;
      this.cacheManager.delete(this.cachePrefix, cacheKey);
    }

    const success = (result.affected ?? 0) > 0;
    if (success) {
      logger.info('Deleted configuration', { key });
    }
    return success;
  }

  // =========================================================================
  // SchoolConfig Operations
  // =========================================================================

  /**
   * Migrate break periods format from old to new format
   * @param breakPeriods - Break periods string
   * @returns Migrated break periods string
   */
  private migrateBreakPeriodsFormat(breakPeriods: string): string {
    try {
      const parsed = JSON.parse(breakPeriods);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Check if it's old format (array of numbers)
        if (typeof parsed[0] === 'number') {
          // Convert to new format
          const migrated = parsed.map((afterPeriod: number) => ({
            afterPeriod,
            duration: 15, // Default duration
          }));
          return JSON.stringify(migrated);
        }
      }
      return breakPeriods;
    } catch {
      return breakPeriods;
    }
  }

  /**
   * Parse SchoolConfig JSON fields
   * @param config - SchoolConfig entity
   * @returns Parsed SchoolConfig
   */
  private parseSchoolConfigJsonFields(config: SchoolConfig): ParsedSchoolConfig {
    return {
      id: config.id,
      schoolName: config.schoolName,
      enablePrimary: config.enablePrimary,
      enableMiddle: config.enableMiddle,
      enableHigh: config.enableHigh,
      daysPerWeek: config.daysPerWeek,
      periodsPerDay: config.periodsPerDay,
      breakPeriods: safeJsonParse<unknown[]>(config.breakPeriods, []),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Get the school configuration (singleton)
   * @param options - Repository options
   * @returns Parsed school config or null
   */
  async getSchoolConfig(options?: RepositoryOptions): Promise<ParsedSchoolConfig | null> {
    const cacheKey = 'schoolConfig:singleton';

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedSchoolConfig>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved school config from cache');
        return cached;
      }
    }

    const manager = options?.manager ?? this.dataSource.manager;
    
    // Check if entity is registered
    if (!this.dataSource.hasMetadata(SchoolConfig)) {
      logger.warn('SchoolConfig entity is not registered in TypeORM');
      return null;
    }

    const repo = manager.getRepository(SchoolConfig);
    const configs = await repo.find();
    const config = configs[0] || null;

    if (!config) {
      logger.debug('School config not found');
      return null;
    }

    // Auto-migrate break periods format on read
    if (config.breakPeriods) {
      config.breakPeriods = this.migrateBreakPeriodsFormat(config.breakPeriods);
    }

    const parsed = this.parseSchoolConfigJsonFields(config);

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved school config from database and cached');
    }

    return parsed;
  }

  /**
   * Save the school configuration (upsert singleton)
   * @param input - School config input data
   * @param options - Repository options
   * @returns Saved school config
   */
  async saveSchoolConfig(
    input: SchoolConfigInput,
    options?: RepositoryOptions
  ): Promise<ParsedSchoolConfig> {
    const manager = options?.manager ?? this.dataSource.manager;

    // Check if entity is registered
    if (!this.dataSource.hasMetadata(SchoolConfig)) {
      throw new Error('SchoolConfig entity is not registered in TypeORM');
    }

    const repo = manager.getRepository(SchoolConfig);
    let existing = (await repo.find())[0];

    if (!existing) {
      existing = new SchoolConfig();
      logger.debug('Creating new school config');
    } else {
      logger.debug('Updating existing school config');
    }

    // Apply updates
    if (input.schoolName !== undefined) existing.schoolName = input.schoolName;
    if (input.enablePrimary !== undefined) existing.enablePrimary = input.enablePrimary;
    if (input.enableMiddle !== undefined) existing.enableMiddle = input.enableMiddle;
    if (input.enableHigh !== undefined) existing.enableHigh = input.enableHigh;
    if (typeof input.daysPerWeek === 'number') existing.daysPerWeek = input.daysPerWeek;
    if (typeof input.periodsPerDay === 'number') existing.periodsPerDay = input.periodsPerDay;

    // Handle breakPeriods with migration
    if (input.breakPeriods !== undefined) {
      const breakPeriods = typeof input.breakPeriods === 'string'
        ? input.breakPeriods
        : safeJsonStringify(input.breakPeriods, '[]');
      existing.breakPeriods = this.migrateBreakPeriodsFormat(breakPeriods);
    }

    existing.updatedAt = new Date();
    const saved = await repo.save(existing);

    // Invalidate cache
    if (!options?.skipCache) {
      const cacheKey = 'schoolConfig:singleton';
      this.cacheManager.delete(this.cachePrefix, cacheKey);
    }

    logger.info('Saved school config');
    return this.parseSchoolConfigJsonFields(saved);
  }
}
