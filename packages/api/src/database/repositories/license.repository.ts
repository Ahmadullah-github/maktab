/**
 * License Repository for License entity data access operations
 * @module database/repositories/license
 * 
 * Requirements: 4.7
 * - Add @Index on isActive column to License entity
 * - Dedicated licenseRepository.ts file containing License-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { License } from '../../entity/License';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';

/**
 * License data transfer object for input
 */
export interface LicenseInput {
  licenseKey: string;
  schoolName: string;
  contactName?: string;
  contactPhone?: string;
  licenseType: string;
  activatedAt: Date;
  expiresAt: Date;
  gracePeriodDays?: number;
  isActive?: boolean;
  machineId?: string;
  meta?: Record<string, unknown>;
}

/**
 * License with parsed JSON meta field
 */
export interface ParsedLicense {
  id: number;
  licenseKey: string;
  schoolName: string;
  contactName: string;
  contactPhone: string;
  licenseType: string;
  activatedAt: Date;
  expiresAt: Date;
  gracePeriodDays: number;
  isActive: boolean;
  machineId: string;
  meta: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * License Repository
 * 
 * Handles all License-related database operations with:
 * - JSON meta field parsing/stringifying
 * - Caching via CacheManager
 * - Active license lookups (indexed)
 */
export class LicenseRepository extends BaseRepository<License> {
  protected readonly entityClass: EntityTarget<License> = License;
  protected readonly cachePrefix: string = 'license';

  private static instance: LicenseRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of LicenseRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): LicenseRepository {
    if (!LicenseRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      LicenseRepository.instance = new LicenseRepository(dataSource, cache);
    }
    return LicenseRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    LicenseRepository.instance = null;
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON meta field in a License entity
   * @param license - License entity with JSON string meta field
   * @returns License with parsed meta field
   */
  private parseLicenseJsonFields(license: License): ParsedLicense {
    return {
      id: license.id,
      licenseKey: license.licenseKey,
      schoolName: license.schoolName,
      contactName: license.contactName ?? '',
      contactPhone: license.contactPhone ?? '',
      licenseType: license.licenseType,
      activatedAt: license.activatedAt,
      expiresAt: license.expiresAt,
      gracePeriodDays: license.gracePeriodDays,
      isActive: license.isActive,
      machineId: license.machineId ?? '',
      meta: safeJsonParse<Record<string, unknown>>(license.meta, {}),
      createdAt: license.createdAt,
      updatedAt: license.updatedAt,
    };
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Get a license by ID with parsed JSON meta
   * @param id - License ID
   * @param options - Repository options
   * @returns Parsed license or null
   */
  async getLicense(id: number, options?: RepositoryOptions): Promise<ParsedLicense | null> {
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedLicense>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved license from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const license = await repo.findOne({ where: { id } });

    if (!license) {
      logger.debug('License not found', { id });
      return null;
    }

    const parsed = this.parseLicenseJsonFields(license);

    // Cache the parsed result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved license from database and cached', { id });
    }

    return parsed;
  }

  /**
   * Get all licenses with pagination
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with parsed licenses
   */
  async getAllLicenses(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedLicense>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);

    const [licenses, total] = await repo.findAndCount({
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    const parsedLicenses = licenses.map((l) => this.parseLicenseJsonFields(l));

    return {
      data: parsedLicenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all licenses without pagination
   * @param options - Repository options
   * @returns Array of parsed licenses
   */
  async getAllLicensesUnpaginated(options?: RepositoryOptions): Promise<ParsedLicense[]> {
    const cacheKey = this.getAllCacheKey();

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedLicense[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all licenses from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const licenses = await repo.find({ order: { id: 'ASC' } });

    const parsedLicenses = licenses.map((l) => this.parseLicenseJsonFields(l));

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedLicenses);
      logger.debug('Retrieved all licenses from database and cached', {
        count: parsedLicenses.length,
      });
    }

    return parsedLicenses;
  }

  /**
   * Save a new license
   * @param input - License input data
   * @param options - Repository options
   * @returns Saved license with parsed JSON meta
   */
  async saveLicense(input: LicenseInput, options?: RepositoryOptions): Promise<ParsedLicense> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    const license = new License();
    license.licenseKey = input.licenseKey;
    license.schoolName = input.schoolName;
    license.contactName = input.contactName ?? '';
    license.contactPhone = input.contactPhone ?? '';
    license.licenseType = input.licenseType;
    license.activatedAt = input.activatedAt;
    license.expiresAt = input.expiresAt;
    license.gracePeriodDays = input.gracePeriodDays ?? 7;
    license.isActive = input.isActive ?? true;
    license.machineId = input.machineId ?? '';
    license.meta = safeJsonStringify(input.meta ?? {}, '{}');
    license.createdAt = now;
    license.updatedAt = now;

    const saved = await repo.save(license);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(saved.id);
      // Also invalidate active license cache
      this.cacheManager.delete(this.cachePrefix, 'license:active');
    }

    logger.info('Saved license', { id: saved.id, licenseKey: saved.licenseKey });
    return this.parseLicenseJsonFields(saved);
  }

  /**
   * Update an existing license by ID
   * @param id - License ID
   * @param input - Partial license input data
   * @param options - Repository options
   * @returns Updated license or null if not found
   */
  async updateLicense(
    id: number,
    input: Partial<LicenseInput>,
    options?: RepositoryOptions
  ): Promise<ParsedLicense | null> {
    const repo = this.getRepository(options?.manager);
    const license = await repo.findOne({ where: { id } });

    if (!license) {
      logger.debug('License not found for update', { id });
      return null;
    }

    // Apply updates
    if (input.licenseKey !== undefined) license.licenseKey = input.licenseKey;
    if (input.schoolName !== undefined) license.schoolName = input.schoolName;
    if (input.contactName !== undefined) license.contactName = input.contactName ?? '';
    if (input.contactPhone !== undefined) license.contactPhone = input.contactPhone ?? '';
    if (input.licenseType !== undefined) license.licenseType = input.licenseType;
    if (input.activatedAt !== undefined) license.activatedAt = input.activatedAt;
    if (input.expiresAt !== undefined) license.expiresAt = input.expiresAt;
    if (input.gracePeriodDays !== undefined) license.gracePeriodDays = input.gracePeriodDays;
    if (input.isActive !== undefined) license.isActive = input.isActive;
    if (input.machineId !== undefined) license.machineId = input.machineId ?? '';
    if (input.meta !== undefined) license.meta = safeJsonStringify(input.meta, '{}');
    license.updatedAt = new Date();

    const updated = await repo.save(license);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
      // Also invalidate active license cache
      this.cacheManager.delete(this.cachePrefix, 'license:active');
    }

    logger.info('Updated license', { id });
    return this.parseLicenseJsonFields(updated);
  }

  /**
   * Delete a license by ID
   * @param id - License ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteLicense(id: number, options?: RepositoryOptions): Promise<boolean> {
    const result = await super.delete(id, options);
    
    // Also invalidate active license cache
    if (!options?.skipCache) {
      this.cacheManager.delete(this.cachePrefix, 'license:active');
    }
    
    if (result) {
      logger.info('Deleted license', { id });
    }
    return result;
  }

  // =========================================================================
  // Custom Query Methods
  // =========================================================================

  /**
   * Find a license by license key
   * @param licenseKey - License key
   * @param options - Repository options
   * @returns Parsed license or null
   */
  async findByLicenseKey(
    licenseKey: string,
    options?: RepositoryOptions
  ): Promise<ParsedLicense | null> {
    const repo = this.getRepository(options?.manager);
    const license = await repo.findOne({ where: { licenseKey } });

    if (!license) {
      return null;
    }

    return this.parseLicenseJsonFields(license);
  }

  /**
   * Find active licenses (uses index on isActive)
   * Requirements: 4.7 - Index on isActive column
   * @param options - Repository options
   * @returns Array of parsed active licenses
   */
  async findActiveLicenses(options?: RepositoryOptions): Promise<ParsedLicense[]> {
    const cacheKey = 'license:active';

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedLicense[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved active licenses from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const licenses = await repo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });

    const parsedLicenses = licenses.map((l) => this.parseLicenseJsonFields(l));

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedLicenses);
      logger.debug('Retrieved active licenses from database and cached', {
        count: parsedLicenses.length,
      });
    }

    return parsedLicenses;
  }

  /**
   * Get the current active license (most recent active)
   * @param options - Repository options
   * @returns Parsed license or null
   */
  async getActiveLicense(options?: RepositoryOptions): Promise<ParsedLicense | null> {
    const activeLicenses = await this.findActiveLicenses(options);
    
    if (activeLicenses.length === 0) {
      return null;
    }

    // Return the most recently activated license
    return activeLicenses.sort(
      (a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime()
    )[0];
  }

  /**
   * Deactivate a license
   * @param id - License ID
   * @param options - Repository options
   * @returns Updated license or null if not found
   */
  async deactivateLicense(id: number, options?: RepositoryOptions): Promise<ParsedLicense | null> {
    return this.updateLicense(id, { isActive: false }, options);
  }

  /**
   * Activate a license
   * @param id - License ID
   * @param options - Repository options
   * @returns Updated license or null if not found
   */
  async activateLicense(id: number, options?: RepositoryOptions): Promise<ParsedLicense | null> {
    return this.updateLicense(id, { isActive: true }, options);
  }

  /**
   * Find licenses by machine ID
   * @param machineId - Machine ID
   * @param options - Repository options
   * @returns Array of parsed licenses
   */
  async findByMachineId(
    machineId: string,
    options?: RepositoryOptions
  ): Promise<ParsedLicense[]> {
    const repo = this.getRepository(options?.manager);
    const licenses = await repo.find({
      where: { machineId },
      order: { id: 'ASC' },
    });

    return licenses.map((l) => this.parseLicenseJsonFields(l));
  }

  /**
   * Count total licenses
   * @param options - Repository options
   * @returns Total count
   */
  async countLicenses(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }

  /**
   * Count active licenses
   * @param options - Repository options
   * @returns Count of active licenses
   */
  async countActiveLicenses(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count({ where: { isActive: true } });
  }
}
