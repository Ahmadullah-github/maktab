/**
 * Timetable Repository for Timetable entity data access operations
 * @module database/repositories/timetable
 * 
 * Requirements: 1.5
 * - Dedicated timetableRepository.ts file containing only Timetable-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { Timetable } from '../../entity/Timetable';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';

/**
 * Timetable data transfer object for input
 */
export interface TimetableInput {
  name: string;
  description?: string;
  data: unknown;
  schoolId?: number | null;
  academicYearId?: number | null;
  termId?: number | null;
}

/**
 * Timetable with parsed JSON data field
 */
export interface ParsedTimetable {
  id: number;
  schoolId: number | null;
  academicYearId: number | null;
  termId: number | null;
  name: string;
  description: string;
  data: unknown;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Timetable Repository
 * 
 * Handles all Timetable-related database operations with:
 * - JSON data field parsing/stringifying
 * - Caching via CacheManager
 * - Transaction support
 */
export class TimetableRepository extends BaseRepository<Timetable> {
  protected readonly entityClass: EntityTarget<Timetable> = Timetable;
  protected readonly cachePrefix: string = 'timetable';

  private static instance: TimetableRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of TimetableRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TimetableRepository {
    if (!TimetableRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      TimetableRepository.instance = new TimetableRepository(dataSource, cache);
    }
    return TimetableRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    TimetableRepository.instance = null;
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON data field in a Timetable entity
   * @param timetable - Timetable entity with JSON string data field
   * @returns Timetable with parsed data field
   */
  private parseTimetableJsonFields(timetable: Timetable): ParsedTimetable {
    return {
      id: timetable.id,
      schoolId: timetable.schoolId,
      academicYearId: timetable.academicYearId,
      termId: timetable.termId,
      name: timetable.name,
      description: timetable.description,
      data: safeJsonParse<unknown>(timetable.data, {}),
      isDeleted: timetable.isDeleted,
      deletedAt: timetable.deletedAt,
      createdAt: timetable.createdAt,
      updatedAt: timetable.updatedAt,
    };
  }

  // =========================================================================
  // CRUD Operations with JSON Parsing
  // =========================================================================

  /**
   * Get a timetable by ID with parsed JSON data
   * @param id - Timetable ID
   * @param options - Repository options
   * @returns Parsed timetable or null
   */
  async getTimetable(id: number, options?: RepositoryOptions): Promise<ParsedTimetable | null> {
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedTimetable>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved timetable from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const timetable = await repo.findOne({ where: { id } });

    if (!timetable) {
      logger.debug('Timetable not found', { id });
      return null;
    }

    const parsed = this.parseTimetableJsonFields(timetable);

    // Cache the parsed result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved timetable from database and cached', { id });
    }

    return parsed;
  }

  /**
   * Get all timetables with pagination and parsed JSON data
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with parsed timetables
   */
  async getAllTimetables(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedTimetable>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);

    const [timetables, total] = await repo.findAndCount({
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    const parsedTimetables = timetables.map((t) => this.parseTimetableJsonFields(t));

    return {
      data: parsedTimetables,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all timetables without pagination (for backward compatibility)
   * @param options - Repository options
   * @returns Array of parsed timetables
   */
  async getAllTimetablesUnpaginated(options?: RepositoryOptions): Promise<ParsedTimetable[]> {
    const cacheKey = this.getAllCacheKey();

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedTimetable[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all timetables from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const timetables = await repo.find({ order: { id: 'ASC' } });

    const parsedTimetables = timetables.map((t) => this.parseTimetableJsonFields(t));

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedTimetables);
      logger.debug('Retrieved all timetables from database and cached', {
        count: parsedTimetables.length,
      });
    }

    return parsedTimetables;
  }

  /**
   * Save a new timetable
   * @param input - Timetable input data
   * @param options - Repository options
   * @returns Saved timetable with parsed JSON data
   */
  async saveTimetable(input: TimetableInput, options?: RepositoryOptions): Promise<ParsedTimetable> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    const timetable = new Timetable();
    timetable.name = input.name;
    timetable.description = input.description ?? '';
    timetable.data = safeJsonStringify(input.data, '{}');
    timetable.schoolId = input.schoolId ?? null;
    timetable.academicYearId = input.academicYearId ?? null;
    timetable.termId = input.termId ?? null;
    timetable.createdAt = now;
    timetable.updatedAt = now;

    const saved = await repo.save(timetable);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(saved.id);
    }

    logger.info('Saved timetable', { id: saved.id, name: saved.name });
    return this.parseTimetableJsonFields(saved);
  }

  /**
   * Update an existing timetable by ID
   * @param id - Timetable ID
   * @param data - Timetable data to update
   * @param options - Repository options
   * @returns Updated timetable or null if not found
   */
  async updateTimetable(
    id: number,
    data: unknown,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable | null> {
    const repo = this.getRepository(options?.manager);
    const timetable = await repo.findOne({ where: { id } });

    if (!timetable) {
      logger.debug('Timetable not found for update', { id });
      return null;
    }

    timetable.data = safeJsonStringify(data, '{}');
    timetable.updatedAt = new Date();

    const updated = await repo.save(timetable);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
    }

    logger.info('Updated timetable', { id });
    return this.parseTimetableJsonFields(updated);
  }

  /**
   * Update timetable metadata (name, description)
   * @param id - Timetable ID
   * @param input - Partial timetable input
   * @param options - Repository options
   * @returns Updated timetable or null if not found
   */
  async updateTimetableMetadata(
    id: number,
    input: Partial<TimetableInput>,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable | null> {
    const repo = this.getRepository(options?.manager);
    const timetable = await repo.findOne({ where: { id } });

    if (!timetable) {
      logger.debug('Timetable not found for metadata update', { id });
      return null;
    }

    if (input.name !== undefined) timetable.name = input.name;
    if (input.description !== undefined) timetable.description = input.description;
    if (input.data !== undefined) timetable.data = safeJsonStringify(input.data, '{}');
    if (input.schoolId !== undefined) timetable.schoolId = input.schoolId ?? null;
    if (input.academicYearId !== undefined) timetable.academicYearId = input.academicYearId ?? null;
    if (input.termId !== undefined) timetable.termId = input.termId ?? null;
    timetable.updatedAt = new Date();

    const updated = await repo.save(timetable);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
    }

    logger.info('Updated timetable metadata', { id });
    return this.parseTimetableJsonFields(updated);
  }

  /**
   * Delete a timetable by ID
   * @param id - Timetable ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteTimetable(id: number, options?: RepositoryOptions): Promise<boolean> {
    const result = await super.delete(id, options);
    if (result) {
      logger.info('Deleted timetable', { id });
    }
    return result;
  }

  // =========================================================================
  // Custom Query Methods
  // =========================================================================

  /**
   * Find timetables by school ID
   * @param schoolId - School ID
   * @param options - Repository options
   * @returns Array of parsed timetables
   */
  async findBySchoolId(
    schoolId: number,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable[]> {
    const repo = this.getRepository(options?.manager);
    const timetables = await repo.find({
      where: { schoolId },
      order: { id: 'ASC' },
    });

    return timetables.map((t) => this.parseTimetableJsonFields(t));
  }

  /**
   * Find timetables by academic year ID
   * @param academicYearId - Academic year ID
   * @param options - Repository options
   * @returns Array of parsed timetables
   */
  async findByAcademicYearId(
    academicYearId: number,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable[]> {
    const repo = this.getRepository(options?.manager);
    const timetables = await repo.find({
      where: { academicYearId },
      order: { id: 'ASC' },
    });

    return timetables.map((t) => this.parseTimetableJsonFields(t));
  }

  /**
   * Find timetables by term ID
   * @param termId - Term ID
   * @param options - Repository options
   * @returns Array of parsed timetables
   */
  async findByTermId(
    termId: number,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable[]> {
    const repo = this.getRepository(options?.manager);
    const timetables = await repo.find({
      where: { termId },
      order: { id: 'ASC' },
    });

    return timetables.map((t) => this.parseTimetableJsonFields(t));
  }

  /**
   * Count total timetables
   * @param options - Repository options
   * @returns Total count
   */
  async countTimetables(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }
}
