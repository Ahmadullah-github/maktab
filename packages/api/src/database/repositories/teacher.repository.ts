/**
 * Teacher Repository for Teacher entity data access operations
 * @module database/repositories/teacher
 *
 * Requirements: 1.1
 * - Dedicated teacherRepository.ts file containing only Teacher-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { Teacher } from '../../entity/Teacher';
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
import {
  AssignmentCompatibilityService,
  DerivedTeacherCompatibility,
} from '../../services/assignmentCompatibility.service';
import type { TeacherEmploymentType, TeacherTimePreference } from '../../utils/teacherContracts';
import {
  normalizeTeacherName,
  normalizeTeacherStaffCode,
  normalizeUnavailableSlots,
} from '../../utils/teacherContracts';

/**
 * Teacher data transfer object for input
 */
export interface TeacherInput {
  fullName: string;
  staffCode: string;
  employmentType?: TeacherEmploymentType;
  schoolId?: number | null;
  /** @deprecated Compatibility mirror. Canonical capability rows will replace this field. */
  primarySubjectIds?: number[];
  /** @deprecated Compatibility mirror. Canonical capability rows will replace this field. */
  allowedSubjectIds?: number[];
  restrictToPrimarySubjects?: boolean;
  availability?: Record<string, unknown>;
  unavailable?: Array<{ day: string; period: number }>;
  maxPeriodsPerWeek?: number;
  maxPeriodsPerDay?: number;
  maxConsecutivePeriods?: number;
  timePreference?: TeacherTimePreference;
  preferredRoomIds?: number[];
  preferredColleagues?: number[];
  /** @deprecated Legacy assignment mirror. Use canonical assignment commands instead. */
  classAssignments?: Array<{ subjectId: string; classIds: string[] }>;
  meta?: Record<string, unknown>;
}

/**
 * Teacher with parsed JSON fields (plain object, not entity)
 */
export interface ParsedTeacher {
  id: number;
  schoolId: number | null;
  fullName: string;
  staffCode: string;
  employmentType: TeacherEmploymentType;
  /** @deprecated Compatibility mirror. Canonical capability rows will replace this field. */
  primarySubjectIds: number[];
  /** @deprecated Compatibility mirror. Canonical capability rows will replace this field. */
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  availability: Record<string, unknown>;
  unavailable: Array<{ day: string; period: number }>;
  maxPeriodsPerWeek: number;
  maxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  timePreference: TeacherTimePreference;
  preferredRoomIds: number[];
  preferredColleagues: number[];
  /** @deprecated Legacy assignment mirror. Use canonical assignment projections instead. */
  classAssignments: Array<{ subjectId: string; classIds: string[] }>;
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Teacher Repository
 *
 * Handles all Teacher-related database operations with:
 * - JSON field parsing/stringifying
 * - Caching via CacheManager
 * - Bulk import with batch operations
 * - Transaction support
 */
export class TeacherRepository extends BaseRepository<Teacher> {
  protected readonly entityClass: EntityTarget<Teacher> = Teacher;
  protected readonly cachePrefix: string = 'teacher';

  private readonly assignmentCompatibilityService: AssignmentCompatibilityService;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
    this.assignmentCompatibilityService = new AssignmentCompatibilityService(dataSource);
  }

  /**
   * Get singleton instance of TeacherRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): TeacherRepository {
    return getDataSourceScopedInstance(
      dataSource,
      TeacherRepository,
      () => new TeacherRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(TeacherRepository);
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON fields in a Teacher entity
   * @param teacher - Teacher entity with JSON string fields
   * @returns Teacher with parsed JSON fields as plain object
   */
  private parseTeacherJsonFields(
    teacher: Teacher,
    compatibility?: DerivedTeacherCompatibility
  ): ParsedTeacher {
    return {
      id: teacher.id,
      schoolId: teacher.schoolId,
      fullName: teacher.fullName,
      staffCode: teacher.staffCode,
      employmentType: teacher.employmentType,
      primarySubjectIds:
        compatibility?.primarySubjectIds ?? safeJsonParse<number[]>(teacher.primarySubjectIds, []),
      allowedSubjectIds:
        compatibility?.allowedSubjectIds ?? safeJsonParse<number[]>(teacher.allowedSubjectIds, []),
      restrictToPrimarySubjects: teacher.restrictToPrimarySubjects,
      availability: safeJsonParse<Record<string, unknown>>(teacher.availability, {}),
      unavailable: normalizeUnavailableSlots(safeJsonParse<unknown[]>(teacher.unavailable, [])),
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
      maxPeriodsPerDay: teacher.maxPeriodsPerDay,
      maxConsecutivePeriods: teacher.maxConsecutivePeriods,
      timePreference: (teacher.timePreference || 'any') as TeacherTimePreference,
      preferredRoomIds: safeJsonParse<number[]>(teacher.preferredRoomIds, []),
      preferredColleagues: safeJsonParse<number[]>(teacher.preferredColleagues, []),
      classAssignments:
        compatibility?.classAssignments ??
        safeJsonParse<Array<{ subjectId: string; classIds: string[] }>>(
          teacher.classAssignments,
          []
        ),
      meta: safeJsonParse<Record<string, unknown>>(teacher.meta, {}),
      isDeleted: teacher.isDeleted,
      deletedAt: teacher.deletedAt,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt,
    };
  }

  /**
   * Stringify JSON fields for storage
   * @param input - Teacher input data
   * @returns Partial Teacher with stringified JSON fields
   */
  private stringifyTeacherJsonFields(input: TeacherInput): Partial<Teacher> {
    return {
      fullName: normalizeTeacherName(input.fullName),
      staffCode: normalizeTeacherStaffCode(input.staffCode),
      employmentType: input.employmentType ?? 'full_time',
      schoolId: input.schoolId ?? null,
      primarySubjectIds: safeJsonStringify(input.primarySubjectIds ?? [], '[]'),
      allowedSubjectIds: safeJsonStringify(input.allowedSubjectIds ?? [], '[]'),
      restrictToPrimarySubjects: input.restrictToPrimarySubjects ?? true,
      availability: safeJsonStringify(input.availability ?? {}, '{}'),
      unavailable: safeJsonStringify(normalizeUnavailableSlots(input.unavailable ?? []), '[]'),
      maxPeriodsPerWeek: input.maxPeriodsPerWeek ?? 0,
      maxPeriodsPerDay: input.maxPeriodsPerDay ?? 0,
      maxConsecutivePeriods: input.maxConsecutivePeriods ?? 0,
      timePreference: input.timePreference ?? 'any',
      preferredRoomIds: safeJsonStringify(input.preferredRoomIds ?? [], '[]'),
      preferredColleagues: safeJsonStringify(input.preferredColleagues ?? [], '[]'),
      classAssignments: safeJsonStringify(input.classAssignments ?? [], '[]'),
      meta: safeJsonStringify(input.meta ?? {}, '{}'),
    };
  }

  // =========================================================================
  // CRUD Operations with JSON Parsing
  // =========================================================================

  /**
   * Get a teacher by ID with parsed JSON fields
   * @param id - Teacher ID
   * @param options - Repository options
   * @returns Parsed teacher or null
   */
  async getTeacher(id: number, options?: RepositoryOptions): Promise<ParsedTeacher | null> {
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<ParsedTeacher>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved teacher from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const teacher = await repo.findOne({ where: { id, isDeleted: false } });

    if (!teacher) {
      logger.debug('Teacher not found', { id });
      return null;
    }

    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility([id], {
        manager: options?.manager,
      });
    const parsed = this.parseTeacherJsonFields(teacher, compatibilityByTeacherId.get(id));

    // Cache the parsed result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved teacher from database and cached', { id });
    }

    return parsed;
  }

  /**
   * Get all teachers with pagination and parsed JSON fields
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with parsed teachers
   */
  async getAllTeachers(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedTeacher>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);

    const [teachers, total] = await repo.findAndCount({
      skip,
      take: limit,
      where: { isDeleted: false },
      order: { id: 'ASC' },
    });

    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility(
        teachers.map((teacher) => teacher.id),
        { manager: options?.manager }
      );
    const parsedTeachers = teachers.map((teacher) =>
      this.parseTeacherJsonFields(teacher, compatibilityByTeacherId.get(teacher.id))
    );

    return {
      data: parsedTeachers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all teachers without pagination (for backward compatibility)
   * @param options - Repository options
   * @returns Array of parsed teachers
   */
  async getAllTeachersUnpaginated(options?: RepositoryOptions): Promise<ParsedTeacher[]> {
    const cacheKey = this.getAllCacheKey();

    // Check cache first
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<ParsedTeacher[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all teachers from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const teachers = await repo.find({ where: { isDeleted: false }, order: { id: 'ASC' } });

    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility(
        teachers.map((teacher) => teacher.id),
        { manager: options?.manager }
      );
    const parsedTeachers = teachers.map((teacher) =>
      this.parseTeacherJsonFields(teacher, compatibilityByTeacherId.get(teacher.id))
    );

    // Cache the result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedTeachers);
      logger.debug('Retrieved all teachers from database and cached', {
        count: parsedTeachers.length,
      });
    }

    return parsedTeachers;
  }

  /**
   * Save a new teacher or update existing (upsert by name)
   * @param input - Teacher input data
   * @param options - Repository options
   * @returns Saved teacher with parsed JSON fields
   */
  async saveTeacher(input: TeacherInput, options?: RepositoryOptions): Promise<ParsedTeacher> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    const teacher = new Teacher();
    teacher.createdAt = now;
    logger.debug('Creating teacher', { staffCode: input.staffCode });

    // Apply stringified JSON fields
    const stringified = this.stringifyTeacherJsonFields(input);
    Object.assign(teacher, stringified);
    teacher.updatedAt = now;

    const saved = await repo.save(teacher);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      this.invalidateCache(saved.id);
    }

    logger.info('Saved teacher', { id: saved.id, fullName: saved.fullName });
    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility([saved.id], {
        manager: options?.manager,
      });
    return this.parseTeacherJsonFields(saved, compatibilityByTeacherId.get(saved.id));
  }

  /**
   * Update an existing teacher by ID
   * @param id - Teacher ID
   * @param input - Partial teacher input data
   * @param options - Repository options
   * @returns Updated teacher or null if not found
   */
  async updateTeacher(
    id: number,
    input: Partial<TeacherInput>,
    options?: RepositoryOptions
  ): Promise<ParsedTeacher | null> {
    const repo = this.getRepository(options?.manager);
    const teacher = await repo.findOne({ where: { id, isDeleted: false } });

    if (!teacher) {
      logger.debug('Teacher not found for update', { id });
      return null;
    }

    // Apply updates with JSON stringification
    if (input.fullName !== undefined) teacher.fullName = normalizeTeacherName(input.fullName);
    if (input.staffCode !== undefined) teacher.staffCode = normalizeTeacherStaffCode(input.staffCode);
    if (input.employmentType !== undefined) teacher.employmentType = input.employmentType;
    if (input.schoolId !== undefined) teacher.schoolId = input.schoolId ?? null;
    if (input.primarySubjectIds !== undefined) {
      teacher.primarySubjectIds = safeJsonStringify(input.primarySubjectIds, '[]');
    }
    if (input.allowedSubjectIds !== undefined) {
      teacher.allowedSubjectIds = safeJsonStringify(input.allowedSubjectIds, '[]');
    }
    if (input.restrictToPrimarySubjects !== undefined) {
      teacher.restrictToPrimarySubjects = input.restrictToPrimarySubjects;
    }
    if (input.availability !== undefined) {
      teacher.availability = safeJsonStringify(input.availability, '{}');
    }
    if (input.unavailable !== undefined) {
      teacher.unavailable = safeJsonStringify(normalizeUnavailableSlots(input.unavailable), '[]');
    }
    if (input.maxPeriodsPerWeek !== undefined) {
      teacher.maxPeriodsPerWeek = input.maxPeriodsPerWeek;
    }
    if (input.maxPeriodsPerDay !== undefined) {
      teacher.maxPeriodsPerDay = input.maxPeriodsPerDay;
    }
    if (input.maxConsecutivePeriods !== undefined) {
      teacher.maxConsecutivePeriods = input.maxConsecutivePeriods;
    }
    if (input.timePreference !== undefined) {
      teacher.timePreference = input.timePreference;
    }
    if (input.preferredRoomIds !== undefined) {
      teacher.preferredRoomIds = safeJsonStringify(input.preferredRoomIds, '[]');
    }
    if (input.preferredColleagues !== undefined) {
      teacher.preferredColleagues = safeJsonStringify(input.preferredColleagues, '[]');
    }
    if (input.classAssignments !== undefined) {
      teacher.classAssignments = safeJsonStringify(input.classAssignments, '[]');
    }
    if (input.meta !== undefined) {
      teacher.meta = safeJsonStringify(input.meta, '{}');
    }

    teacher.updatedAt = new Date();
    const updated = await repo.save(teacher);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      this.invalidateCache(id);
    }

    logger.info('Updated teacher', { id });
    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility([id], {
        manager: options?.manager,
      });
    return this.parseTeacherJsonFields(updated, compatibilityByTeacherId.get(id));
  }

  /**
   * Delete a teacher by ID
   * @param id - Teacher ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteTeacher(id: number, options?: RepositoryOptions): Promise<boolean> {
    const result = await super.delete(id, options);
    if (result) {
      logger.info('Deleted teacher', { id });
    }
    return result;
  }

  // =========================================================================
  // Custom Query Methods
  // =========================================================================

  /**
   * Find a teacher by full name
   * Requirements: 1.1 - Implement findByName for upsert lookups
   * @param fullName - Teacher's full name
   * @param options - Repository options
   * @returns Parsed teacher or null
   */
  async findByName(fullName: string, options?: RepositoryOptions): Promise<ParsedTeacher | null> {
    const repo = this.getRepository(options?.manager);
    const teacher = await repo.findOne({ where: { fullName, isDeleted: false } });

    if (!teacher) {
      return null;
    }

    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility([teacher.id], {
        manager: options?.manager,
      });
    return this.parseTeacherJsonFields(teacher, compatibilityByTeacherId.get(teacher.id));
  }

  async findByStaffCode(
    staffCode: string,
    schoolId: number | null,
    options?: RepositoryOptions
  ): Promise<ParsedTeacher | null> {
    const normalized = normalizeTeacherStaffCode(staffCode);
    const repo = this.getRepository(options?.manager);
    const rows = await repo
      .createQueryBuilder('teacher')
      .where('teacher.isDeleted = 0')
      .andWhere('LOWER(TRIM(teacher.staffCode)) = LOWER(:staffCode)', { staffCode: normalized })
      .andWhere(
        schoolId === null ? 'teacher.schoolId IS NULL' : 'teacher.schoolId = :schoolId',
        schoolId === null ? {} : { schoolId }
      )
      .getMany();
    const teacher = rows[0];
    if (!teacher) return null;
    const compatibility = await this.assignmentCompatibilityService.getTeacherCompatibility(
      [teacher.id],
      { manager: options?.manager }
    );
    return this.parseTeacherJsonFields(teacher, compatibility.get(teacher.id));
  }

  /**
   * Find teachers by school ID
   * @param schoolId - School ID
   * @param options - Repository options
   * @returns Array of parsed teachers
   */
  async findBySchoolId(schoolId: number, options?: RepositoryOptions): Promise<ParsedTeacher[]> {
    const repo = this.getRepository(options?.manager);
    const teachers = await repo.find({
      where: { schoolId, isDeleted: false },
      order: { id: 'ASC' },
    });

    const compatibilityByTeacherId =
      await this.assignmentCompatibilityService.getTeacherCompatibility(
        teachers.map((teacher) => teacher.id),
        { manager: options?.manager }
      );
    return teachers.map((teacher) =>
      this.parseTeacherJsonFields(teacher, compatibilityByTeacherId.get(teacher.id))
    );
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Bulk import teachers with batch database operations
   * Requirements: 5.1, 5.3
   * - Use batch database operations instead of individual saves
   * - Wrap operations in a database transaction for atomicity
   *
   * @param teachersData - Array of teacher input data
   * @param options - Repository options
   * @returns Array of saved teachers with parsed JSON fields
   */
  async bulkImport(
    teachersData: TeacherInput[],
    options?: RepositoryOptions
  ): Promise<ParsedTeacher[]> {
    if (teachersData.length === 0) {
      return [];
    }

    logger.info('Starting bulk import of teachers', { count: teachersData.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedTeacher[]> => {
      const repo = manager.getRepository(Teacher);
      const now = new Date();

      // Prepare all teacher entities
      const teacherEntities: Teacher[] = teachersData.map((input) => {
        const teacher = new Teacher();
        const stringified = this.stringifyTeacherJsonFields(input);
        Object.assign(teacher, stringified);
        teacher.createdAt = now;
        teacher.updatedAt = now;
        return teacher;
      });

      // Batch save all teachers in a single operation
      const saved = await repo.save(teacherEntities);

      logger.info('Bulk import completed', { count: saved.length });
      const compatibilityByTeacherId =
        await this.assignmentCompatibilityService.getTeacherCompatibility(
          saved.map((teacher) => teacher.id),
          { manager }
        );
      return saved.map((teacher) =>
        this.parseTeacherJsonFields(teacher, compatibilityByTeacherId.get(teacher.id))
      );
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedTeacher[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for teachers
    if (this.shouldUseCache(options)) {
      this.invalidateAllCache();
    }

    return result;
  }

  /**
   * Bulk delete teachers by IDs with transaction
   * @param ids - Array of teacher IDs to delete
   * @param options - Repository options
   * @returns Number of deleted teachers
   */
  async bulkDeleteTeachers(ids: number[], options?: RepositoryOptions): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    logger.info('Starting bulk delete of teachers', { count: ids.length });

    const operation = async (manager: EntityManager): Promise<number> => {
      const repo = manager.getRepository(Teacher);
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
   * Count total teachers
   * @param options - Repository options
   * @returns Total count
   */
  async countTeachers(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }
}
