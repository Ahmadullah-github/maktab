/**
 * Timetable Repository for Timetable entity data access operations
 * @module database/repositories/timetable
 *
 * Requirements: 1.5
 * - Dedicated timetableRepository.ts file containing only Timetable-related database operations
 */

import { DataSource, EntityManager, EntityTarget, IsNull } from 'typeorm';
import { Timetable } from '../../entity/Timetable';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { safeJsonStringify } from '../../utils/jsonTransformer';
import { timetableDataSchema } from '../../schemas/timetable.schema';
import { logger } from '../../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';

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
  revision: number;
  isStale: boolean;
  staleReason: string | null;
  staleAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimetableSummary extends Omit<ParsedTimetable, 'data'> {
  lessonCount: number;
  classCount: number;
  teacherCount: number;
  generationStatus: string | null;
  qualityScore: number | null;
}

export class TimetableRevisionConflictError extends Error {
  readonly code = 'TIMETABLE_REVISION_CONFLICT';

  constructor(readonly currentRevision: number) {
    super('This timetable was changed in another session. Reload it before saving again.');
    this.name = 'TimetableRevisionConflictError';
  }
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

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of TimetableRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TimetableRepository {
    return getDataSourceScopedInstance(
      dataSource,
      TimetableRepository,
      () => new TimetableRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(TimetableRepository);
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
    let data: unknown;
    try {
      data = JSON.parse(timetable.data);
    } catch (error) {
      throw new Error(
        `Stored timetable ${timetable.id} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return {
      id: timetable.id,
      schoolId: timetable.schoolId,
      academicYearId: timetable.academicYearId,
      termId: timetable.termId,
      name: timetable.name,
      description: timetable.description,
      data,
      revision: timetable.revision,
      isStale: timetable.isStale,
      staleReason: timetable.staleReason,
      staleAt: timetable.staleAt,
      isDeleted: timetable.isDeleted,
      deletedAt: timetable.deletedAt,
      createdAt: timetable.createdAt,
      updatedAt: timetable.updatedAt,
    };
  }

  private toSummary(timetable: ParsedTimetable): TimetableSummary {
    const parsed = timetableDataSchema.parse(timetable.data);
    const lessons = parsed.schedule;
    const classCount = new Set(lessons.map((lesson) => lesson.classId)).size;
    const teacherCount = new Set(lessons.flatMap((lesson) => lesson.teacherIds)).size;
    const payload = timetable.data as Record<string, unknown>;
    const quality = payload.quality_score;
    const { data: _data, ...summary } = timetable;
    return {
      ...summary,
      lessonCount: lessons.length,
      classCount,
      teacherCount,
      generationStatus: typeof payload.status === 'string' ? payload.status : null,
      qualityScore:
        quality && typeof quality === 'object' && typeof (quality as Record<string, unknown>).overall === 'number'
          ? ((quality as Record<string, unknown>).overall as number)
          : null,
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
    if (this.shouldUseCache(options)) {
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
    if (this.shouldUseCache(options)) {
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
    if (this.shouldUseCache(options)) {
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
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedTimetables);
      logger.debug('Retrieved all timetables from database and cached', {
        count: parsedTimetables.length,
      });
    }

    return parsedTimetables;
  }

  async getAllTimetableSummaries(options?: RepositoryOptions): Promise<TimetableSummary[]> {
    const repo = this.getRepository(options?.manager);
    const timetables = await repo.find({ where: { isDeleted: false }, order: { updatedAt: 'DESC' } });
    return timetables.map((item) => this.toSummary(this.parseTimetableJsonFields(item)));
  }

  /**
   * Save a new timetable
   * @param input - Timetable input data
   * @param options - Repository options
   * @returns Saved timetable with parsed JSON data
   */
  async saveTimetable(
    input: TimetableInput,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    const timetable = new Timetable();
    timetable.name = input.name;
    timetable.description = input.description ?? '';
    timetable.data = safeJsonStringify(input.data, '{}');
    timetable.revision = 1;
    timetable.isStale = false;
    timetable.staleReason = null;
    timetable.staleAt = null;
    timetable.schoolId = input.schoolId ?? null;
    timetable.academicYearId = input.academicYearId ?? null;
    timetable.termId = input.termId ?? null;
    timetable.createdAt = now;
    timetable.updatedAt = now;

    const saved = await repo.save(timetable);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
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
    expectedRevision: number,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable | null> {
    const repo = this.getRepository(options?.manager);
    const timetable = await repo.findOne({ where: { id } });

    if (!timetable) {
      logger.debug('Timetable not found for update', { id });
      return null;
    }

    const updateResult = await repo
      .createQueryBuilder()
      .update(Timetable)
      .set({
        data: safeJsonStringify(data, '{}'),
        revision: () => 'revision + 1',
        updatedAt: new Date(),
      })
      .where('id = :id AND revision = :expectedRevision', { id, expectedRevision })
      .execute();

    if ((updateResult.affected ?? 0) === 0) {
      const current = await repo.findOne({ where: { id } });
      if (!current) return null;
      throw new TimetableRevisionConflictError(current.revision);
    }

    const updated = await repo.findOneOrFail({ where: { id } });

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      this.invalidateCache(id);
    }

    logger.info('Updated timetable', { id });
    return this.parseTimetableJsonFields(updated);
  }

  async updateTimetableLessons(
    id: number,
    lessons: unknown[],
    expectedRevision: number,
    options?: RepositoryOptions
  ): Promise<ParsedTimetable | null> {
    const existing = await this.getTimetable(id, { ...options, skipCache: true });
    if (!existing) return null;
    const payload = timetableDataSchema.parse(existing.data);
    return this.updateTimetable(id, { ...payload, schedule: lessons }, expectedRevision, options);
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
    if (input.data !== undefined) {
      timetable.data = safeJsonStringify(input.data, '{}');
      timetable.revision += 1;
    }
    if (input.schoolId !== undefined) timetable.schoolId = input.schoolId ?? null;
    if (input.academicYearId !== undefined) timetable.academicYearId = input.academicYearId ?? null;
    if (input.termId !== undefined) timetable.termId = input.termId ?? null;
    timetable.updatedAt = new Date();

    const updated = await repo.save(timetable);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
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

  async markStaleForSchool(
    schoolId: number | null,
    reason: string,
    options?: RepositoryOptions
  ): Promise<number> {
    const repository = this.getRepository(options?.manager);
    const where = schoolId === null ? { schoolId: IsNull(), isDeleted: false } : { schoolId, isDeleted: false };
    const result = await repository.update(where, {
      isStale: true,
      staleReason: reason,
      staleAt: new Date(),
    });
    if (this.shouldUseCache(options)) this.invalidateAllCache();
    return result.affected ?? 0;
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
  async findBySchoolId(schoolId: number, options?: RepositoryOptions): Promise<ParsedTimetable[]> {
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
  async findByTermId(termId: number, options?: RepositoryOptions): Promise<ParsedTimetable[]> {
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
