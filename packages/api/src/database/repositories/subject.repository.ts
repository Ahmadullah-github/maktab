/**
 * Subject Repository for Subject entity data access operations
 * @module database/repositories/subject
 *
 * Requirements: 1.2
 * - Dedicated subjectRepository.ts file containing only Subject-related database operations
 */

import { Brackets, DataSource, EntityManager, EntityTarget, Repository } from 'typeorm';
import { Subject } from '../../entity/Subject';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import { PaginationParams, PaginatedResponse } from '../../types/common.types';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';

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
  requiredRoomType?: string | null;
  requiredFeatures?: string[];
  desiredFeatures?: string[];
  isDifficult?: boolean;
  minRoomCapacity?: number;
  meta?: Record<string, unknown>;
  isCustom?: boolean;
  customCategory?: string | null;
}

export interface SubjectIdentityMatch {
  byName: Subject | null;
  byCode: Subject | null;
}

export class SubjectIdentityConflictError extends Error {
  readonly code = 'SUBJECT_IDENTITY_CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'SubjectIdentityConflictError';
  }
}

export function normalizeSubjectText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function normalizeSubjectCode(value: string | null | undefined): string {
  return normalizeSubjectText(value ?? '');
}

export function normalizeSubjectFeatureTags(values: string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  return [...new Set(values.map((value) => normalizeSubjectText(value).toLowerCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function normalizeSubjectInput(input: SubjectInput): SubjectInput {
  return {
    ...input,
    name: normalizeSubjectText(input.name),
    code: normalizeSubjectCode(input.code),
    requiredRoomType: input.requiredRoomType?.trim().toLowerCase() || null,
    requiredFeatures: normalizeSubjectFeatureTags(input.requiredFeatures),
    desiredFeatures: normalizeSubjectFeatureTags(input.desiredFeatures),
  };
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
  requiredRoomType: string | null;
  requiredFeatures: string[];
  desiredFeatures: string[];
  isDifficult: boolean;
  minRoomCapacity: number;
  meta: Record<string, unknown>;
  isCustom: boolean;
  customCategory: string | null;
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

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of SubjectRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SubjectRepository {
    return getDataSourceScopedInstance(
      dataSource,
      SubjectRepository,
      () => new SubjectRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(SubjectRepository);
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
      isCustom: subject.isCustom,
      customCategory: subject.customCategory,
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
    const normalized = normalizeSubjectInput(input);
    const grade = typeof normalized.grade === 'number' && !isNaN(normalized.grade) ? normalized.grade : null;
    const periodsPerWeek =
      typeof normalized.periodsPerWeek === 'number' && !isNaN(normalized.periodsPerWeek)
        ? normalized.periodsPerWeek
        : null;
    const minRoomCapacity =
      typeof normalized.minRoomCapacity === 'number' && !isNaN(normalized.minRoomCapacity)
        ? normalized.minRoomCapacity
        : 0;

    return {
      name: normalized.name,
      code: normalized.code ?? '',
      schoolId: normalized.schoolId ?? null,
      grade,
      periodsPerWeek,
      section: normalized.section ?? '',
      requiredRoomType: normalized.requiredRoomType ?? null,
      requiredFeatures: safeJsonStringify(normalized.requiredFeatures ?? [], '[]'),
      desiredFeatures: safeJsonStringify(normalized.desiredFeatures ?? [], '[]'),
      isDifficult: normalized.isDifficult ?? false,
      minRoomCapacity,
      meta: safeJsonStringify(normalized.meta ?? {}, '{}'),
      isCustom: normalized.isCustom ?? false,
      customCategory: normalized.customCategory ?? null,
    };
  }

  private applyImportFields(subject: Subject, input: SubjectInput): Subject {
    const normalized = normalizeSubjectInput(input);
    subject.name = normalized.name;
    subject.code = normalized.code ?? '';
    subject.grade = normalized.grade ?? null;
    subject.periodsPerWeek = normalized.periodsPerWeek ?? null;
    subject.section = normalized.section ?? '';
    subject.isDifficult = normalized.isDifficult ?? false;

    // Null/omitted room types mean that the curriculum has no opinion. Preserve an
    // existing explicit room policy such as "normal" or a specialist laboratory.
    if (normalized.requiredRoomType) subject.requiredRoomType = normalized.requiredRoomType;
    if (normalized.requiredFeatures !== undefined) {
      subject.requiredFeatures = safeJsonStringify(normalized.requiredFeatures, '[]');
    }
    if (normalized.desiredFeatures !== undefined) {
      subject.desiredFeatures = safeJsonStringify(normalized.desiredFeatures, '[]');
    }
    if (normalized.minRoomCapacity !== undefined) {
      subject.minRoomCapacity = normalized.minRoomCapacity;
    }
    if (normalized.meta !== undefined) {
      subject.meta = safeJsonStringify(
        { ...safeJsonParse<Record<string, unknown>>(subject.meta, {}), ...normalized.meta },
        '{}'
      );
    }
    if (normalized.isCustom !== undefined) subject.isCustom = normalized.isCustom;
    if (normalized.customCategory !== undefined) {
      subject.customCategory = normalized.customCategory;
    }
    return subject;
  }

  private identityQuery(
    repo: Repository<Subject>,
    input: Pick<SubjectInput, 'schoolId' | 'grade' | 'name' | 'code'>
  ) {
    const name = normalizeSubjectText(input.name);
    const code = normalizeSubjectCode(input.code);
    const query = repo
      .createQueryBuilder('subject')
      .where('subject.isDeleted = 0')
      .andWhere(input.schoolId == null ? 'subject.schoolId IS NULL' : 'subject.schoolId = :schoolId', {
        schoolId: input.schoolId,
      })
      .andWhere(input.grade == null ? 'subject.grade IS NULL' : 'subject.grade = :grade', {
        grade: input.grade,
      })
      .andWhere(
        new Brackets((where) => {
          where.where('LOWER(TRIM(subject.name)) = LOWER(:name)', { name });
          if (code) where.orWhere('LOWER(TRIM(subject.code)) = LOWER(:code)', { code });
        })
      );
    return { query, name, code };
  }

  async findIdentityMatch(
    input: Pick<SubjectInput, 'schoolId' | 'grade' | 'name' | 'code'>,
    options?: RepositoryOptions
  ): Promise<SubjectIdentityMatch> {
    const repo = this.getRepository(options?.manager);
    const { query, name, code } = this.identityQuery(repo, input);
    const matches = await query.getMany();
    return {
      byName:
        matches.find((subject) => normalizeSubjectText(subject.name).localeCompare(name, undefined, { sensitivity: 'accent' }) === 0) ??
        null,
      byCode: code
        ? matches.find(
            (subject) =>
              normalizeSubjectCode(subject.code).localeCompare(code, undefined, { sensitivity: 'accent' }) === 0
          ) ?? null
        : null,
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
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<ParsedSubject>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved subject from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const subject = await repo.findOne({ where: { id, isDeleted: false } });

    if (!subject) {
      logger.debug('Subject not found', { id });
      return null;
    }

    const parsed = this.parseSubjectJsonFields(subject);

    // Cache the parsed result
    if (this.shouldUseCache(options)) {
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
      where: { isDeleted: false },
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
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<ParsedSubject[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all subjects from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({ where: { isDeleted: false }, order: { id: 'ASC' } });

    const parsedSubjects = subjects.map((s) => this.parseSubjectJsonFields(s));

    // Cache the result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedSubjects);
      logger.debug('Retrieved all subjects from database and cached', {
        count: parsedSubjects.length,
      });
    }

    return parsedSubjects;
  }

  /** Create a subject. This method never updates an existing identity. */
  async saveSubject(input: SubjectInput, options?: RepositoryOptions): Promise<ParsedSubject> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();
    const subject = repo.create(this.stringifySubjectJsonFields(input));
    subject.isDeleted = false;
    subject.deletedAt = null;
    subject.createdAt = now;
    subject.updatedAt = now;

    const saved = await repo.save(subject);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      this.invalidateCache(saved.id);
    }

    logger.info('Created subject', { id: saved.id, name: saved.name });
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
    const subject = await repo.findOne({ where: { id, isDeleted: false } });

    if (!subject) {
      logger.debug('Subject not found for update', { id });
      return null;
    }

    // Apply updates with JSON stringification
    if (input.name !== undefined) subject.name = normalizeSubjectText(input.name);
    if (input.code !== undefined) subject.code = normalizeSubjectCode(input.code);
    if (input.schoolId !== undefined) subject.schoolId = input.schoolId ?? null;
    if (input.grade !== undefined) {
      subject.grade = typeof input.grade === 'number' && !isNaN(input.grade) ? input.grade : null;
    }
    if (input.periodsPerWeek !== undefined) {
      subject.periodsPerWeek =
        typeof input.periodsPerWeek === 'number' && !isNaN(input.periodsPerWeek)
          ? input.periodsPerWeek
          : null;
    }
    if (input.section !== undefined) subject.section = input.section;
    if (input.requiredRoomType !== undefined) {
      subject.requiredRoomType = input.requiredRoomType?.trim().toLowerCase() || null;
    }
    if (input.requiredFeatures !== undefined) {
      subject.requiredFeatures = safeJsonStringify(
        normalizeSubjectFeatureTags(input.requiredFeatures),
        '[]'
      );
    }
    if (input.desiredFeatures !== undefined) {
      subject.desiredFeatures = safeJsonStringify(
        normalizeSubjectFeatureTags(input.desiredFeatures),
        '[]'
      );
    }
    if (input.isDifficult !== undefined) subject.isDifficult = input.isDifficult;
    if (input.minRoomCapacity !== undefined) {
      subject.minRoomCapacity =
        typeof input.minRoomCapacity === 'number' && !isNaN(input.minRoomCapacity)
          ? input.minRoomCapacity
          : 0;
    }
    if (input.meta !== undefined) {
      subject.meta = safeJsonStringify(input.meta, '{}');
    }
    if (input.isCustom !== undefined) subject.isCustom = input.isCustom;
    if (input.customCategory !== undefined) subject.customCategory = input.customCategory;

    subject.updatedAt = new Date();
    const updated = await repo.save(subject);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
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
    const match = await this.findIdentityMatch(
      { schoolId: null, grade, name, code: '' },
      options
    );
    const subject = match.byName;

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
    const match = await this.findIdentityMatch(
      { schoolId: null, grade, name: '__code_lookup__', code },
      options
    );
    const subject = match.byCode;

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
  async findByGrade(grade: number, options?: RepositoryOptions): Promise<ParsedSubject[]> {
    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({
      where: { grade, isDeleted: false },
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
  async findBySchoolId(schoolId: number, options?: RepositoryOptions): Promise<ParsedSubject[]> {
    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({
      where: { schoolId, isDeleted: false },
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
  async findBySection(section: string, options?: RepositoryOptions): Promise<ParsedSubject[]> {
    const repo = this.getRepository(options?.manager);
    const subjects = await repo.find({
      where: { section, isDeleted: false },
      order: { id: 'ASC' },
    });

    return subjects.map((s) => this.parseSubjectJsonFields(s));
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Import/upsert subjects atomically. Existing rows retain fields that are not
   * explicitly owned by the import payload.
   */
  async bulkUpsert(
    subjectsData: SubjectInput[],
    options?: RepositoryOptions
  ): Promise<ParsedSubject[]> {
    if (subjectsData.length === 0) {
      return [];
    }

    const normalizedInputs = subjectsData.map(normalizeSubjectInput);
    const names = new Set<string>();
    const codes = new Set<string>();
    for (const input of normalizedInputs) {
      const scope = `${input.schoolId ?? 'null'}:${input.grade ?? 'null'}`;
      const nameKey = `${scope}:${input.name.toLocaleLowerCase()}`;
      const codeKey = input.code ? `${scope}:${input.code.toLocaleLowerCase()}` : '';
      if (names.has(nameKey) || (codeKey && codes.has(codeKey))) {
        throw new SubjectIdentityConflictError(
          `Duplicate subject identity in import payload for grade ${input.grade ?? 'unspecified'}: ${input.name}`
        );
      }
      names.add(nameKey);
      if (codeKey) codes.add(codeKey);
    }

    logger.info('Starting safe bulk upsert of subjects', { count: normalizedInputs.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedSubject[]> => {
      const repo = manager.getRepository(Subject);
      const saved: Subject[] = [];

      for (const input of normalizedInputs) {
        const { byName, byCode } = await this.findIdentityMatch(input, {
          manager,
          skipCache: true,
        });
        if (byName && byCode && byName.id !== byCode.id) {
          throw new SubjectIdentityConflictError(
            `Subject name "${input.name}" and code "${input.code}" identify different rows`
          );
        }

        let subject = byName ?? byCode;
        if (subject) {
          this.applyImportFields(subject, input);
        } else {
          subject = repo.create(this.stringifySubjectJsonFields(input));
          subject.createdAt = new Date();
          subject.isDeleted = false;
          subject.deletedAt = null;
        }
        subject.updatedAt = new Date();
        saved.push(await repo.save(subject));
      }

      logger.info('Safe bulk upsert completed', { count: saved.length });
      return saved.map((subject) => this.parseSubjectJsonFields(subject));
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedSubject[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for subjects
    if (this.shouldUseCache(options)) {
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
    if (this.shouldUseCache(options)) {
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
    if (this.shouldUseCache(options)) {
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
    if (this.shouldUseCache(options)) {
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
    return repo.count({ where: { isDeleted: false } });
  }
}
