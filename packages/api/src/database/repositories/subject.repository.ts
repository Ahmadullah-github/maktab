/**
 * Subject Repository for Subject entity data access operations
 * @module database/repositories/subject
 * 
 * Requirements: 1.2
 * - Dedicated subjectRepository.ts file containing only Subject-related database operations
 */

import { DataSource, EntityManager, EntityTarget, IsNull } from 'typeorm';
import { Subject } from '../../entity/Subject';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';

/**
 * Subject data transfer object for input
 */
export interface SubjectInput {
  name: string;
  code?: string;
  schoolId?: number | null;
  grade?: number | null;
  periodsPerWeek?: number | null;
  section?: string;
  requiredRoomType?: string;
  requiredFeatures?: string[];
  desiredFeatures?: string[];
  isDifficult?: boolean;
  minRoomCapacity?: number;
  meta?: Record<string, unknown>;
}

/**
 * Subject with parsed JSON fields (plain object, not entity)
 */
export interface ParsedSubject {
  id: number;
  schoolId: number | null;
  name: string;
  code: string;
  grade: number | null;
  periodsPerWeek: number | null;
  section: string;
  requiredRoomType: string;
  requiredFeatures: string[];
  desiredFeatures: string[];
  isDifficult: boolean;
  minRoomCapacity: number;
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}


/**
 * Subject Repository
 * 
 * Handles all Subject-related database operations with:
 * - JSON field parsing/stringifying
 * - Caching via CacheManager
 * - Bulk upsert with batch operations
 * - Transaction support
 * - findByGradeAndName, findByGradeAndCode for upsert lookups
 */
export class SubjectRepository extends BaseRepository<Subject> {
  protected readonly entityClass: EntityTarget<Subject> = Subject;
  protected readonly cachePrefix: string = 'subject';

  private static instance: SubjectRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of SubjectRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SubjectRepository {
    if (!SubjectRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      SubjectRepository.instance = new SubjectRepository(dataSource, cache);
    }
    return SubjectRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    SubjectRepository.instance = null;
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON fields in a Subject entity
   * @param subject - Subject entity with JSON string fields
   * @returns Subject with parsed JSON fields as plain object
   */
  private parseSubjectJsonFields(subject: Subject): ParsedSubject {
    return {
      id: subject.id,
      schoolId: subject.schoolId,
      name: subject.name,
      code: subject.code,
      grade: subject.grade,
      periodsPerWeek: subject.periodsPerWeek,
      section: subject.section,
      requiredRoomType: subject.requiredRoomType,
      requiredFeatures: safeJsonParse<string[]>(subject.requiredFeatures, []),
      desiredFeatures: safeJsonParse<string[]>(subject.desiredFeatures, []),
      isDifficult: subject.isDifficult,
      minRoomCapacity: subject.minRoomCapacity,
      meta: safeJsonParse<Record<string, unknown>>(subject.meta, {}),
      isDeleted: subject.isDeleted,
      deletedAt: subject.deletedAt,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };
  }

  /**
   * Stringify JSON fields for storage
   * @param input - Subject input data
   * @returns Partial Subject with stringified JSON fields
   */
  private stringifySubjectJsonFields(input: SubjectInput): Partial<Subject> {
    const grade = (typeof input.grade === 'number' && !isNaN(input.grade)) ? input.grade : null;
    const periodsPerWeek = (typeof input.periodsPerWeek === 'number' && !isNaN(input.periodsPerWeek)) 
      ? input.periodsPerWeek : null;
    const minRoomCapacity = (typeof input.minRoomCapacity === 'number' && !isNaN(input.minRoomCapacity)) 
      ? input.minRoomCapacity : 0;

    return {
      name: input.name,
      code: input.code ?? '',
      schoolId: input.schoolId ?? null,
      grade,
      periodsPerWeek,
      section: input.section ?? '',
      requiredRoomType: input.requiredRoomType ?? '',
      requiredFeatures: safeJsonStringify(input.requiredFeatures ?? [], '[]'),
      desiredFeatures: safeJsonStringify(input.desiredFeatures ?? [], '[]'),
      isDifficult: input.isDifficult ?? false,
      minRoomCapacity,
      meta: safeJsonStringify(input.meta ?? {}, '{}'),
    };
  }


  // =========================================================================
  // CRUD Operations with JSON Parsing
  // =========================================================================

  /**
   * Get a subject by ID with parsed JSON fields
   * @param id - Subject ID
   * @param options - Repository options
   * @returns Parsed subject or null
   */
  async getSubject(id: number, options?: RepositoryOptions): Promise<ParsedSubject | null> {
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedSubject>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved subject from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const subject = await repo.findOne({ where: { id } });

    if (!subject) {
      logger.debug('Subject not found', { id });
      return null;
    }

    const parsed = this.parseSubjectJsonFields(subject);

    // Cache the parsed result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved subject from database and cached', { id });
    }

    return parsed;
  }

  /**
   * Get all subjects with pagination and parsed JSON fields
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with parsed subjects
   */
  async getAllSubjects(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedSubject>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);

    const [subjects, total] = await repo.findAndCount({
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    const parsedSubjects = subjects.map((s) => this.parseSubjectJsonFields(s));

    return {
      data: parsedSubjects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all subjects without pagination (for backward compatibility)
   * @param options - Repository options
   * @returns Array of parsed subjects
   */
  async getAllSubjectsUnpaginated(options?: RepositoryOptions): Promise<ParsedSubject[]> {
    const cacheKey = this.getAllCacheKey();

    // Check cache first
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<ParsedSubject[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all subjects from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({ order: { id: 'ASC' } });

    const parsedSubjects = subjects.map((s) => this.parseSubjectJsonFields(s));

    // Cache the result
    if (!options?.skipCache) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedSubjects);
      logger.debug('Retrieved all subjects from database and cached', {
        count: parsedSubjects.length,
      });
    }

    return parsedSubjects;
  }

  /**
   * Save a new subject or update existing (upsert by grade+name or grade+code)
   * @param input - Subject input data
   * @param options - Repository options
   * @returns Saved subject with parsed JSON fields
   */
  async saveSubject(input: SubjectInput, options?: RepositoryOptions): Promise<ParsedSubject> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    // De-dup guard: try to find existing by (grade,name) or (grade,code)
    const gradeVal = (typeof input.grade === 'number' && !isNaN(input.grade)) ? input.grade : null;
    const codeVal = input.code || '';

    // Build where conditions for upsert lookup
    const whereConditions: any[] = [{ grade: gradeVal, name: input.name }];
    if (codeVal) {
      whereConditions.push({ grade: gradeVal, code: codeVal });
    }

    let subject = await repo.findOne({ where: whereConditions });

    if (!subject) {
      subject = new Subject();
      subject.createdAt = now;
      logger.debug('Creating new subject', { name: input.name, grade: gradeVal });
    } else {
      logger.debug('Updating existing subject', { name: input.name, id: subject.id });
    }

    // Apply stringified JSON fields
    const stringified = this.stringifySubjectJsonFields(input);
    Object.assign(subject, stringified);
    subject.updatedAt = now;

    const saved = await repo.save(subject);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(saved.id);
    }

    logger.info('Saved subject', { id: saved.id, name: saved.name });
    return this.parseSubjectJsonFields(saved);
  }

  /**
   * Update an existing subject by ID
   * @param id - Subject ID
   * @param input - Partial subject input data
   * @param options - Repository options
   * @returns Updated subject or null if not found
   */
  async updateSubject(
    id: number,
    input: Partial<SubjectInput>,
    options?: RepositoryOptions
  ): Promise<ParsedSubject | null> {
    const repo = this.getRepository(options?.manager);
    const subject = await repo.findOne({ where: { id } });

    if (!subject) {
      logger.debug('Subject not found for update', { id });
      return null;
    }

    // Apply updates with JSON stringification
    if (input.name !== undefined) subject.name = input.name;
    if (input.code !== undefined) subject.code = input.code;
    if (input.schoolId !== undefined) subject.schoolId = input.schoolId ?? null;
    if (input.grade !== undefined) {
      subject.grade = (typeof input.grade === 'number' && !isNaN(input.grade)) ? input.grade : null;
    }
    if (input.periodsPerWeek !== undefined) {
      subject.periodsPerWeek = (typeof input.periodsPerWeek === 'number' && !isNaN(input.periodsPerWeek)) 
        ? input.periodsPerWeek : null;
    }
    if (input.section !== undefined) subject.section = input.section;
    if (input.requiredRoomType !== undefined) subject.requiredRoomType = input.requiredRoomType;
    if (input.requiredFeatures !== undefined) {
      subject.requiredFeatures = safeJsonStringify(input.requiredFeatures, '[]');
    }
    if (input.desiredFeatures !== undefined) {
      subject.desiredFeatures = safeJsonStringify(input.desiredFeatures, '[]');
    }
    if (input.isDifficult !== undefined) subject.isDifficult = input.isDifficult;
    if (input.minRoomCapacity !== undefined) {
      subject.minRoomCapacity = (typeof input.minRoomCapacity === 'number' && !isNaN(input.minRoomCapacity)) 
        ? input.minRoomCapacity : 0;
    }
    if (input.meta !== undefined) {
      subject.meta = safeJsonStringify(input.meta, '{}');
    }

    subject.updatedAt = new Date();
    const updated = await repo.save(subject);

    // Invalidate cache
    if (!options?.skipCache) {
      this.invalidateCache(id);
    }

    logger.info('Updated subject', { id });
    return this.parseSubjectJsonFields(updated);
  }

  /**
   * Delete a subject by ID
   * @param id - Subject ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteSubject(id: number, options?: RepositoryOptions): Promise<boolean> {
    const result = await super.delete(id, options);
    if (result) {
      logger.info('Deleted subject', { id });
    }
    return result;
  }


  // =========================================================================
  // Custom Query Methods
  // =========================================================================

  /**
   * Find a subject by grade and name
   * Requirements: 1.2 - Implement findByGradeAndName for upsert lookups
   * @param grade - Subject grade level
   * @param name - Subject name
   * @param options - Repository options
   * @returns Parsed subject or null
   */
  async findByGradeAndName(
    grade: number | null,
    name: string,
    options?: RepositoryOptions
  ): Promise<ParsedSubject | null> {
    const repo = this.getRepository(options?.manager);
    const whereCondition = grade === null 
      ? { grade: IsNull(), name } 
      : { grade, name };
    const subject = await repo.findOne({ where: whereCondition as any });

    if (!subject) {
      return null;
    }

    return this.parseSubjectJsonFields(subject);
  }

  /**
   * Find a subject by grade and code
   * Requirements: 1.2 - Implement findByGradeAndCode for upsert lookups
   * @param grade - Subject grade level
   * @param code - Subject code
   * @param options - Repository options
   * @returns Parsed subject or null
   */
  async findByGradeAndCode(
    grade: number | null,
    code: string,
    options?: RepositoryOptions
  ): Promise<ParsedSubject | null> {
    const repo = this.getRepository(options?.manager);
    const whereCondition = grade === null 
      ? { grade: IsNull(), code } 
      : { grade, code };
    const subject = await repo.findOne({ where: whereCondition as any });

    if (!subject) {
      return null;
    }

    return this.parseSubjectJsonFields(subject);
  }

  /**
   * Find subjects by grade
   * @param grade - Subject grade level
   * @param options - Repository options
   * @returns Array of parsed subjects
   */
  async findByGrade(
    grade: number,
    options?: RepositoryOptions
  ): Promise<ParsedSubject[]> {
    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({
      where: { grade },
      order: { id: 'ASC' },
    });

    return subjects.map((s) => this.parseSubjectJsonFields(s));
  }

  /**
   * Find subjects by school ID
   * @param schoolId - School ID
   * @param options - Repository options
   * @returns Array of parsed subjects
   */
  async findBySchoolId(
    schoolId: number,
    options?: RepositoryOptions
  ): Promise<ParsedSubject[]> {
    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({
      where: { schoolId },
      order: { id: 'ASC' },
    });

    return subjects.map((s) => this.parseSubjectJsonFields(s));
  }

  /**
   * Find subjects by section (PRIMARY, MIDDLE, HIGH)
   * @param section - Section name
   * @param options - Repository options
   * @returns Array of parsed subjects
   */
  async findBySection(
    section: string,
    options?: RepositoryOptions
  ): Promise<ParsedSubject[]> {
    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({
      where: { section },
      order: { id: 'ASC' },
    });

    return subjects.map((s) => this.parseSubjectJsonFields(s));
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Bulk upsert subjects with batch database operations
   * Requirements: 5.2, 5.3
   * - Use batch database operations instead of individual saves
   * - Wrap operations in a database transaction for atomicity
   * 
   * @param subjectsData - Array of subject input data
   * @param options - Repository options
   * @returns Array of saved subjects with parsed JSON fields
   */
  async bulkUpsert(
    subjectsData: SubjectInput[],
    options?: RepositoryOptions
  ): Promise<ParsedSubject[]> {
    if (subjectsData.length === 0) {
      return [];
    }

    logger.info('Starting bulk upsert of subjects', { count: subjectsData.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedSubject[]> => {
      const repo = manager.getRepository(Subject);
      const now = new Date();
      const results: Subject[] = [];

      // Process subjects - need to check for existing ones for upsert
      for (const input of subjectsData) {
        const gradeVal = (typeof input.grade === 'number' && !isNaN(input.grade)) ? input.grade : null;
        const codeVal = input.code || '';

        // Build where conditions for upsert lookup
        const whereConditions: any[] = [{ grade: gradeVal, name: input.name }];
        if (codeVal) {
          whereConditions.push({ grade: gradeVal, code: codeVal });
        }

        let subject = await repo.findOne({ where: whereConditions });

        if (!subject) {
          subject = new Subject();
          subject.createdAt = now;
        }

        // Apply stringified JSON fields
        const stringified = this.stringifySubjectJsonFields(input);
        Object.assign(subject, stringified);
        subject.updatedAt = now;

        results.push(subject);
      }

      // Batch save all subjects
      const saved = await repo.save(results);

      logger.info('Bulk upsert completed', { count: saved.length });
      return saved.map((s) => this.parseSubjectJsonFields(s));
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedSubject[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for subjects
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    return result;
  }

  /**
   * Clear all subjects
   * @param options - Repository options
   */
  async clearAllSubjects(options?: RepositoryOptions): Promise<void> {
    const repo = this.getRepository(options?.manager);
    await repo.clear();

    // Invalidate all cache
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('All subjects cleared');
  }

  /**
   * Clear subjects by grade
   * @param grade - Grade level to clear
   * @param options - Repository options
   */
  async clearSubjectsByGrade(grade: number, options?: RepositoryOptions): Promise<void> {
    const repo = this.getRepository(options?.manager);
    await repo
      .createQueryBuilder()
      .delete()
      .from(Subject)
      .where('grade = :grade', { grade })
      .execute();

    // Invalidate all cache
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Cleared subjects for grade', { grade });
  }

  /**
   * Bulk delete subjects by IDs with transaction
   * @param ids - Array of subject IDs to delete
   * @param options - Repository options
   * @returns Number of deleted subjects
   */
  async bulkDeleteSubjects(ids: number[], options?: RepositoryOptions): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    logger.info('Starting bulk delete of subjects', { count: ids.length });

    const operation = async (manager: EntityManager): Promise<number> => {
      const repo = manager.getRepository(Subject);
      const result = await repo.delete(ids);
      return result.affected ?? 0;
    };

    let deleted: number;
    if (options?.manager) {
      deleted = await operation(options.manager);
    } else {
      deleted = await this.withTransaction(operation);
    }

    // Invalidate all cache
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Bulk delete completed', { deleted });
    return deleted;
  }

  /**
   * Count total subjects
   * @param options - Repository options
   * @returns Total count
   */
  async countSubjects(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }
}
