/**
 * Class Repository for ClassGroup entity data access operations
 * @module database/repositories/class
 *
 * Requirements: 1.4
 * - Dedicated classRepository.ts file containing only ClassGroup-related database operations
 */

import { DataSource, EntityManager, EntityTarget } from 'typeorm';
import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT } from '../../constants';
import { ClassGroup } from '../../entity/ClassGroup';
import { PaginatedResponse, PaginationParams } from '../../types/common.types';
import { safeJsonParse, safeJsonStringify } from '../../utils/jsonTransformer';
import { logger } from '../../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';
import {
  AssignmentCompatibilityService,
  DerivedClassRequirementCompatibility,
} from '../../services/assignmentCompatibility.service';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

/**
 * Subject requirement structure
 */
export interface SubjectRequirement {
  subjectId: number;
  periodsPerWeek: number;
  /** @deprecated Embedded assignment mirror. Use canonical assignment rows instead. */
  teacherId?: number | null;
}

/**
 * ClassGroup data transfer object for input
 */
export interface ClassInput {
  name: string;
  schoolId?: number | null;
  academicYearId?: number | null;
  displayName?: string;
  section?: string;
  grade?: number | null;
  sectionIndex?: string;
  studentCount?: number;
  fixedRoomId?: number | null;
  singleTeacherMode?: boolean;
  /** Homeroom or supervisor only. This is not subject assignment truth. */
  classTeacherId?: number | null;
  /** Compatibility field for requirement input. Embedded teacherId is deprecated. */
  subjectRequirements?: Record<string, unknown> | SubjectRequirement[];
  meta?: Record<string, unknown>;
}

/**
 * ClassGroup with parsed JSON fields (plain object, not entity)
 */
export interface ParsedClass {
  id: number;
  schoolId: number | null;
  academicYearId: number | null;
  name: string;
  displayName: string;
  section: string;
  grade: number | null;
  sectionIndex: string;
  studentCount: number;
  fixedRoomId: number | null;
  singleTeacherMode: boolean;
  /** Homeroom or supervisor only. This is not subject assignment truth. */
  classTeacherId: number | null;
  /** Compatibility view during cutover. Embedded teacherId is deprecated. */
  subjectRequirements: SubjectRequirement[];
  meta: Record<string, unknown>;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Class Repository
 *
 * Handles all ClassGroup-related database operations with:
 * - JSON field parsing/stringifying
 * - Caching via CacheManager
 * - Bulk operations with batch processing
 * - Transaction support
 * - findByName, findByFixedRoomId for lookups
 */
export class ClassRepository extends BaseRepository<ClassGroup> {
  protected readonly entityClass: EntityTarget<ClassGroup> = ClassGroup;
  protected readonly cachePrefix: string = 'class';

  private readonly assignmentCompatibilityService: AssignmentCompatibilityService;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
    this.assignmentCompatibilityService = new AssignmentCompatibilityService(dataSource);
  }

  /**
   * Get singleton instance of ClassRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): ClassRepository {
    return getDataSourceScopedInstance(
      dataSource,
      ClassRepository,
      () => new ClassRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(ClassRepository);
  }

  // =========================================================================
  // JSON Field Helpers
  // =========================================================================

  /**
   * Parse JSON fields in a ClassGroup entity
   * @param classGroup - ClassGroup entity with JSON string fields
   * @returns ClassGroup with parsed JSON fields as plain object
   */
  private parseClassJsonFields(
    classGroup: ClassGroup,
    compatibilityRequirements?: DerivedClassRequirementCompatibility[]
  ): ParsedClass {
    return {
      id: classGroup.id,
      schoolId: classGroup.schoolId,
      academicYearId: classGroup.academicYearId,
      name: classGroup.name,
      displayName: classGroup.displayName,
      section: classGroup.section,
      grade: classGroup.grade,
      sectionIndex: classGroup.sectionIndex,
      studentCount: classGroup.studentCount,
      fixedRoomId: classGroup.fixedRoomId,
      singleTeacherMode: classGroup.singleTeacherMode,
      classTeacherId: classGroup.classTeacherId,
      subjectRequirements:
        compatibilityRequirements ??
        safeJsonParse<SubjectRequirement[]>(classGroup.subjectRequirements, []),
      meta: safeJsonParse<Record<string, unknown>>(classGroup.meta, {}),
      isDeleted: classGroup.isDeleted,
      deletedAt: classGroup.deletedAt,
      createdAt: classGroup.createdAt,
      updatedAt: classGroup.updatedAt,
    };
  }

  /**
   * Stringify JSON fields for storage
   * @param input - ClassGroup input data
   * @returns Partial ClassGroup with stringified JSON fields
   */
  private stringifyClassJsonFields(input: ClassInput): Partial<ClassGroup> {
    const studentCount =
      typeof input.studentCount === 'number' && !isNaN(input.studentCount) ? input.studentCount : 0;
    const grade = typeof input.grade === 'number' && !isNaN(input.grade) ? input.grade : null;

    return {
      name: input.name,
      schoolId: input.schoolId ?? null,
      academicYearId: input.academicYearId ?? null,
      displayName: input.displayName || input.name,
      section: input.section ?? '',
      grade,
      sectionIndex: input.sectionIndex ?? '',
      studentCount,
      fixedRoomId:
        input.fixedRoomId != null && input.fixedRoomId !== ('' as any) ? input.fixedRoomId : null,
      singleTeacherMode: input.singleTeacherMode === true,
      classTeacherId:
        input.classTeacherId != null && input.classTeacherId !== ('' as any)
          ? input.classTeacherId
          : null,
      subjectRequirements: safeJsonStringify(input.subjectRequirements ?? [], '[]'),
      meta: safeJsonStringify(input.meta ?? {}, '{}'),
    };
  }

  // =========================================================================
  // CRUD Operations with JSON Parsing
  // =========================================================================

  /**
   * Get a class by ID with parsed JSON fields
   * @param id - Class ID
   * @param options - Repository options
   * @returns Parsed class or null
   */
  async getClass(id: number, options?: RepositoryOptions): Promise<ParsedClass | null> {
    const cacheKey = this.getCacheKey(id);

    // Check cache first
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<ParsedClass>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved class from cache', { id });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const classGroup = await repo.findOne({ where: { id } });

    if (!classGroup) {
      logger.debug('Class not found', { id });
      return null;
    }

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility([id], {
        manager: options?.manager,
      });
    const parsed = this.parseClassJsonFields(classGroup, compatibilityByClassId.get(id));

    // Cache the parsed result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsed);
      logger.debug('Retrieved class from database and cached', { id });
    }

    return parsed;
  }

  /**
   * Get all classes with pagination and parsed JSON fields
   * @param pagination - Pagination parameters
   * @param options - Repository options
   * @returns Paginated response with parsed classes
   */
  async getAllClasses(
    pagination?: PaginationParams,
    options?: RepositoryOptions
  ): Promise<PaginatedResponse<ParsedClass>> {
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_LIMIT;
    const skip = (page - 1) * limit;

    const repo = this.getRepository(options?.manager);

    const [classes, total] = await repo.findAndCount({
      skip,
      take: limit,
      order: { id: 'ASC' },
    });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    const parsedClasses = classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );

    return {
      data: parsedClasses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all classes without pagination (for backward compatibility)
   * @param options - Repository options
   * @returns Array of parsed classes
   */
  async getAllClassesUnpaginated(options?: RepositoryOptions): Promise<ParsedClass[]> {
    const cacheKey = this.getAllCacheKey();

    // Check cache first
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<ParsedClass[]>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved all classes from cache');
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);
    const classes = await repo.find({ order: { id: 'ASC' } });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    const parsedClasses = classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );

    // Cache the result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, parsedClasses);
      logger.debug('Retrieved all classes from database and cached', {
        count: parsedClasses.length,
      });
    }

    return parsedClasses;
  }

  /**
   * Save a new class or update existing (upsert by name)
   * @param input - Class input data
   * @param options - Repository options
   * @returns Saved class with parsed JSON fields
   */
  async saveClass(input: ClassInput, options?: RepositoryOptions): Promise<ParsedClass> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    // Check for existing class by name (upsert logic)
    let classGroup = await repo.findOne({ where: { name: input.name } });

    if (!classGroup) {
      classGroup = new ClassGroup();
      classGroup.createdAt = now;
      logger.debug('Creating new class', { name: input.name });
    } else {
      logger.debug('Updating existing class', { name: input.name, id: classGroup.id });
    }

    // Apply stringified JSON fields
    const stringified = this.stringifyClassJsonFields(input);
    Object.assign(classGroup, stringified);
    classGroup.updatedAt = now;

    const saved = await repo.save(classGroup);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      this.invalidateCache(saved.id);
    }

    logger.info('Saved class', { id: saved.id, name: saved.name });
    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility([saved.id], {
        manager: options?.manager,
      });
    return this.parseClassJsonFields(saved, compatibilityByClassId.get(saved.id));
  }

  /**
   * Update an existing class by ID
   * @param id - Class ID
   * @param input - Partial class input data
   * @param options - Repository options
   * @returns Updated class or null if not found
   */
  async updateClass(
    id: number,
    input: Partial<ClassInput>,
    options?: RepositoryOptions
  ): Promise<ParsedClass | null> {
    const repo = this.getRepository(options?.manager);
    const classGroup = await repo.findOne({ where: { id } });

    if (!classGroup) {
      logger.debug('Class not found for update', { id });
      return null;
    }

    // Apply updates with JSON stringification
    if (input.name !== undefined) classGroup.name = input.name;
    if (input.schoolId !== undefined) classGroup.schoolId = input.schoolId ?? null;
    if (input.academicYearId !== undefined)
      classGroup.academicYearId = input.academicYearId ?? null;
    if (input.displayName !== undefined)
      classGroup.displayName = input.displayName || classGroup.name;
    if (input.section !== undefined) classGroup.section = input.section;
    if (input.grade !== undefined) {
      classGroup.grade =
        typeof input.grade === 'number' && !isNaN(input.grade) ? input.grade : classGroup.grade;
    }
    if (input.sectionIndex !== undefined) classGroup.sectionIndex = input.sectionIndex;
    if (input.studentCount !== undefined) {
      classGroup.studentCount =
        typeof input.studentCount === 'number' && !isNaN(input.studentCount)
          ? input.studentCount
          : 0;
    }
    if (input.fixedRoomId !== undefined) {
      classGroup.fixedRoomId =
        input.fixedRoomId != null && input.fixedRoomId !== ('' as any) ? input.fixedRoomId : null;
    }
    if (input.singleTeacherMode !== undefined) {
      classGroup.singleTeacherMode = input.singleTeacherMode === true;
    }
    if (input.classTeacherId !== undefined) {
      classGroup.classTeacherId =
        input.classTeacherId != null && input.classTeacherId !== ('' as any)
          ? input.classTeacherId
          : null;
    }
    if (input.subjectRequirements !== undefined) {
      classGroup.subjectRequirements = safeJsonStringify(input.subjectRequirements, '{}');
    }
    if (input.meta !== undefined) {
      classGroup.meta = safeJsonStringify(input.meta, '{}');
    }

    classGroup.updatedAt = new Date();
    const updated = await repo.save(classGroup);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      this.invalidateCache(id);
    }

    logger.info('Updated class', { id });
    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility([id], {
        manager: options?.manager,
      });
    return this.parseClassJsonFields(updated, compatibilityByClassId.get(id));
  }

  /**
   * Delete a class by ID
   * @param id - Class ID
   * @param options - Repository options
   * @returns true if deleted, false if not found
   */
  async deleteClass(id: number, options?: RepositoryOptions): Promise<boolean> {
    const result = await super.delete(id, options);
    if (result) {
      logger.info('Deleted class', { id });
    }
    return result;
  }

  // =========================================================================
  // Custom Query Methods
  // =========================================================================

  /**
   * Find a class by name
   * Requirements: 1.4 - Implement findByName for upsert lookups
   * @param name - Class name
   * @param options - Repository options
   * @returns Parsed class or null
   */
  async findByName(name: string, options?: RepositoryOptions): Promise<ParsedClass | null> {
    const repo = this.getRepository(options?.manager);
    const classGroup = await repo.findOne({ where: { name } });

    if (!classGroup) {
      return null;
    }

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility([classGroup.id], {
        manager: options?.manager,
      });
    return this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id));
  }

  /**
   * Find classes by fixed room ID
   * Requirements: 1.4 - Implement findByFixedRoomId method
   * @param fixedRoomId - Room ID that classes are locked to
   * @param options - Repository options
   * @returns Array of parsed classes
   */
  async findByFixedRoomId(
    fixedRoomId: number,
    options?: RepositoryOptions
  ): Promise<ParsedClass[]> {
    const repo = this.getRepository(options?.manager);
    const classes = await repo.find({
      where: { fixedRoomId },
      order: { id: 'ASC' },
    });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    return classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );
  }

  /**
   * Find classes by school ID
   * @param schoolId - School ID
   * @param options - Repository options
   * @returns Array of parsed classes
   */
  async findBySchoolId(schoolId: number, options?: RepositoryOptions): Promise<ParsedClass[]> {
    const repo = this.getRepository(options?.manager);
    const classes = await repo.find({
      where: { schoolId },
      order: { id: 'ASC' },
    });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    return classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );
  }

  /**
   * Find classes by grade
   * @param grade - Grade level (1-12)
   * @param options - Repository options
   * @returns Array of parsed classes
   */
  async findByGrade(grade: number, options?: RepositoryOptions): Promise<ParsedClass[]> {
    const repo = this.getRepository(options?.manager);
    const classes = await repo.find({
      where: { grade },
      order: { id: 'ASC' },
    });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    return classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );
  }

  /**
   * Find classes by section (PRIMARY, MIDDLE, HIGH)
   * @param section - Section type
   * @param options - Repository options
   * @returns Array of parsed classes
   */
  async findBySection(section: string, options?: RepositoryOptions): Promise<ParsedClass[]> {
    const repo = this.getRepository(options?.manager);
    const classes = await repo.find({
      where: { section },
      order: { id: 'ASC' },
    });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    return classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );
  }

  /**
   * Find classes in single teacher mode
   * @param options - Repository options
   * @returns Array of parsed classes
   */
  async findSingleTeacherModeClasses(options?: RepositoryOptions): Promise<ParsedClass[]> {
    const repo = this.getRepository(options?.manager);
    const classes = await repo.find({
      where: { singleTeacherMode: true },
      order: { id: 'ASC' },
    });

    const compatibilityByClassId =
      await this.assignmentCompatibilityService.getClassRequirementCompatibility(
        classes.map((classGroup) => classGroup.id),
        { manager: options?.manager }
      );
    return classes.map((classGroup) =>
      this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
    );
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Bulk import classes with batch database operations
   * @param classesData - Array of class input data
   * @param options - Repository options
   * @returns Array of saved classes with parsed JSON fields
   */
  async bulkImport(classesData: ClassInput[], options?: RepositoryOptions): Promise<ParsedClass[]> {
    if (classesData.length === 0) {
      return [];
    }

    logger.info('Starting bulk import of classes', { count: classesData.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedClass[]> => {
      const repo = manager.getRepository(ClassGroup);
      const now = new Date();

      // Prepare all class entities
      const classEntities: ClassGroup[] = classesData.map((input) => {
        const classGroup = new ClassGroup();
        const stringified = this.stringifyClassJsonFields(input);
        Object.assign(classGroup, stringified);
        classGroup.createdAt = now;
        classGroup.updatedAt = now;
        return classGroup;
      });

      // Batch save all classes in a single operation
      const saved = await repo.save(classEntities);

      logger.info('Bulk import completed', { count: saved.length });
      const compatibilityByClassId =
        await this.assignmentCompatibilityService.getClassRequirementCompatibility(
          saved.map((classGroup) => classGroup.id),
          { manager }
        );
      return saved.map((classGroup) =>
        this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
      );
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedClass[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for classes
    if (this.shouldUseCache(options)) {
      this.invalidateAllCache();
    }

    return result;
  }

  /**
   * Bulk upsert classes with batch database operations
   * @param classesData - Array of class input data
   * @param options - Repository options
   * @returns Array of saved classes with parsed JSON fields
   */
  async bulkUpsert(classesData: ClassInput[], options?: RepositoryOptions): Promise<ParsedClass[]> {
    if (classesData.length === 0) {
      return [];
    }

    logger.info('Starting bulk upsert of classes', { count: classesData.length });

    // Use transaction for atomicity
    const operation = async (manager: EntityManager): Promise<ParsedClass[]> => {
      const repo = manager.getRepository(ClassGroup);
      const now = new Date();
      const results: ClassGroup[] = [];

      // Process classes - need to check for existing ones for upsert
      for (const input of classesData) {
        let classGroup = await repo.findOne({ where: { name: input.name } });

        if (!classGroup) {
          classGroup = new ClassGroup();
          classGroup.createdAt = now;
        }

        // Apply stringified JSON fields
        const stringified = this.stringifyClassJsonFields(input);
        Object.assign(classGroup, stringified);
        classGroup.updatedAt = now;

        results.push(classGroup);
      }

      // Batch save all classes
      const saved = await repo.save(results);

      logger.info('Bulk upsert completed', { count: saved.length });
      const compatibilityByClassId =
        await this.assignmentCompatibilityService.getClassRequirementCompatibility(
          saved.map((classGroup) => classGroup.id),
          { manager }
        );
      return saved.map((classGroup) =>
        this.parseClassJsonFields(classGroup, compatibilityByClassId.get(classGroup.id))
      );
    };

    // If manager is provided, use it directly; otherwise wrap in transaction
    let result: ParsedClass[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    // Invalidate all cache for classes
    if (this.shouldUseCache(options)) {
      this.invalidateAllCache();
    }

    return result;
  }

  /**
   * Bulk delete classes by IDs with transaction
   * @param ids - Array of class IDs to delete
   * @param options - Repository options
   * @returns Number of deleted classes
   */
  async bulkDeleteClasses(ids: number[], options?: RepositoryOptions): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    logger.info('Starting bulk delete of classes', { count: ids.length });

    const operation = async (manager: EntityManager): Promise<number> => {
      const repo = manager.getRepository(ClassGroup);
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
   * Count total classes
   * @param options - Repository options
   * @returns Total count
   */
  async countClasses(options?: RepositoryOptions): Promise<number> {
    const repo = this.getRepository(options?.manager);
    return repo.count();
  }
}
