/**
 * TeacherClassSubjectAssignment Repository
 * @module database/repositories/teacherClassSubjectAssignment
 *
 * Handles data access for multi-teacher subject assignments.
 * Supports partial period assignments (e.g., Teacher A teaches 1 of 2 History periods).
 */

import { DataSource, EntityManager, EntityTarget, In } from 'typeorm';
import { TeacherClassSubjectAssignment } from '../../entity/TeacherClassSubjectAssignment';
import { logger } from '../../utils/logger';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

/**
 * Input for creating/updating an assignment
 */
export interface TeacherClassSubjectAssignmentInput {
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
  isFixed?: boolean;
  schoolId?: number | null;
}

/**
 * Summary of assignments for a class-subject pair
 */
export interface AssignmentSummary {
  classId: number;
  subjectId: number;
  totalAssignedPeriods: number;
  assignments: Array<{
    id: number;
    teacherId: number;
    periodsPerWeek: number;
    isFixed: boolean;
  }>;
}

/**
 * TeacherClassSubjectAssignment Repository
 */
export class TeacherClassSubjectAssignmentRepository extends BaseRepository<TeacherClassSubjectAssignment> {
  protected readonly entityClass: EntityTarget<TeacherClassSubjectAssignment> =
    TeacherClassSubjectAssignment;
  protected readonly cachePrefix: string = 'teacher-class-subject-assignment';

  private static instance: TeacherClassSubjectAssignmentRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance
   */
  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): TeacherClassSubjectAssignmentRepository {
    if (!TeacherClassSubjectAssignmentRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      TeacherClassSubjectAssignmentRepository.instance =
        new TeacherClassSubjectAssignmentRepository(dataSource, cache);
    }
    return TeacherClassSubjectAssignmentRepository.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    TeacherClassSubjectAssignmentRepository.instance = null;
  }

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  /**
   * Create a new assignment
   */
  async createAssignment(
    input: TeacherClassSubjectAssignmentInput,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    const assignment = new TeacherClassSubjectAssignment();
    assignment.teacherId = input.teacherId;
    assignment.classId = input.classId;
    assignment.subjectId = input.subjectId;
    assignment.periodsPerWeek = input.periodsPerWeek;
    assignment.isFixed = input.isFixed ?? true;
    assignment.schoolId = input.schoolId ?? null;
    assignment.createdAt = now;
    assignment.updatedAt = now;

    const saved = await repo.save(assignment);

    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Created teacher-class-subject assignment', {
      id: saved.id,
      teacherId: saved.teacherId,
      classId: saved.classId,
      subjectId: saved.subjectId,
      periodsPerWeek: saved.periodsPerWeek,
    });

    return saved;
  }

  /**
   * Update an existing assignment
   */
  async updateAssignment(
    id: number,
    input: Partial<TeacherClassSubjectAssignmentInput>,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment | null> {
    const repo = this.getRepository(options?.manager);
    const assignment = await repo.findOne({ where: { id, isDeleted: false } });

    if (!assignment) {
      logger.debug('Assignment not found for update', { id });
      return null;
    }

    if (input.teacherId !== undefined) assignment.teacherId = input.teacherId;
    if (input.classId !== undefined) assignment.classId = input.classId;
    if (input.subjectId !== undefined) assignment.subjectId = input.subjectId;
    if (input.periodsPerWeek !== undefined) assignment.periodsPerWeek = input.periodsPerWeek;
    if (input.isFixed !== undefined) assignment.isFixed = input.isFixed;
    if (input.schoolId !== undefined) assignment.schoolId = input.schoolId ?? null;

    assignment.updatedAt = new Date();
    const updated = await repo.save(assignment);

    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Updated teacher-class-subject assignment', { id });
    return updated;
  }

  /**
   * Soft delete an assignment
   */
  async deleteAssignment(id: number, options?: RepositoryOptions): Promise<boolean> {
    const repo = this.getRepository(options?.manager);
    const assignment = await repo.findOne({ where: { id, isDeleted: false } });

    if (!assignment) {
      return false;
    }

    assignment.isDeleted = true;
    assignment.deletedAt = new Date();
    assignment.updatedAt = new Date();
    await repo.save(assignment);

    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Soft deleted teacher-class-subject assignment', { id });
    return true;
  }

  /**
   * Upsert an assignment - create if not exists, update if exists
   * This handles the unique constraint (teacherId, classId, subjectId) safely
   * Uses try-catch with unique constraint handling for atomic operation
   */
  async upsertAssignment(
    input: TeacherClassSubjectAssignmentInput,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment> {
    const repo = this.getRepository(options?.manager);
    const now = new Date();

    // First, try to find existing record (including soft-deleted)
    let existing = await repo.findOne({
      where: {
        teacherId: input.teacherId,
        classId: input.classId,
        subjectId: input.subjectId,
      },
    });

    if (existing) {
      // Update existing record (reactivate if soft-deleted)
      existing.periodsPerWeek = input.periodsPerWeek;
      existing.isFixed = input.isFixed ?? true;
      existing.schoolId = input.schoolId ?? null;
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.updatedAt = now;

      const updated = await repo.save(existing);

      if (!options?.skipCache) {
        this.invalidateAllCache();
      }

      logger.info('Upserted teacher-class-subject assignment (updated existing)', {
        id: updated.id,
        teacherId: updated.teacherId,
        classId: updated.classId,
        subjectId: updated.subjectId,
      });

      return updated;
    }

    // Try to create new record, handle race condition with unique constraint
    try {
      const assignment = new TeacherClassSubjectAssignment();
      assignment.teacherId = input.teacherId;
      assignment.classId = input.classId;
      assignment.subjectId = input.subjectId;
      assignment.periodsPerWeek = input.periodsPerWeek;
      assignment.isFixed = input.isFixed ?? true;
      assignment.schoolId = input.schoolId ?? null;
      assignment.createdAt = now;
      assignment.updatedAt = now;

      const saved = await repo.save(assignment);

      if (!options?.skipCache) {
        this.invalidateAllCache();
      }

      logger.info('Upserted teacher-class-subject assignment (created new)', {
        id: saved.id,
        teacherId: saved.teacherId,
        classId: saved.classId,
        subjectId: saved.subjectId,
      });

      return saved;
    } catch (error: unknown) {
      // Handle unique constraint violation (race condition - another request created it)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        logger.info('Upsert race condition detected, fetching existing record', {
          teacherId: input.teacherId,
          classId: input.classId,
          subjectId: input.subjectId,
        });

        // Fetch the record that was created by the other request
        existing = await repo.findOne({
          where: {
            teacherId: input.teacherId,
            classId: input.classId,
            subjectId: input.subjectId,
          },
        });

        if (existing) {
          // Update it with our values
          existing.periodsPerWeek = input.periodsPerWeek;
          existing.isFixed = input.isFixed ?? true;
          existing.schoolId = input.schoolId ?? null;
          existing.isDeleted = false;
          existing.deletedAt = null;
          existing.updatedAt = now;

          const updated = await repo.save(existing);

          if (!options?.skipCache) {
            this.invalidateAllCache();
          }

          logger.info('Upserted teacher-class-subject assignment (updated after race)', {
            id: updated.id,
          });

          return updated;
        }
      }

      // Re-throw if it's not a unique constraint error
      throw error;
    }
  }

  // =========================================================================
  // Query Methods
  // =========================================================================

  /**
   * Get assignment by ID
   */
  async getAssignment(
    id: number,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment | null> {
    const repo = this.getRepository(options?.manager);
    return repo.findOne({ where: { id, isDeleted: false } });
  }

  /**
   * Get all assignments (non-deleted)
   */
  async getAllAssignments(options?: RepositoryOptions): Promise<TeacherClassSubjectAssignment[]> {
    const repo = this.getRepository(options?.manager);
    return repo.find({
      where: { isDeleted: false },
      order: { classId: 'ASC', subjectId: 'ASC', teacherId: 'ASC' },
    });
  }

  /**
   * Find assignments by class and subject
   */
  async findByClassAndSubject(
    classId: number,
    subjectId: number,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment[]> {
    const repo = this.getRepository(options?.manager);
    return repo.find({
      where: { classId, subjectId, isDeleted: false },
      order: { teacherId: 'ASC' },
    });
  }

  /**
   * Find assignments by teacher
   */
  async findByTeacher(
    teacherId: number,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment[]> {
    const repo = this.getRepository(options?.manager);
    return repo.find({
      where: { teacherId, isDeleted: false },
      order: { classId: 'ASC', subjectId: 'ASC' },
    });
  }

  /**
   * Find assignments by class
   */
  async findByClass(
    classId: number,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment[]> {
    const repo = this.getRepository(options?.manager);
    return repo.find({
      where: { classId, isDeleted: false },
      order: { subjectId: 'ASC', teacherId: 'ASC' },
    });
  }

  /**
   * Find assignments by subject
   */
  async findBySubject(
    subjectId: number,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment[]> {
    const repo = this.getRepository(options?.manager);
    return repo.find({
      where: { subjectId, isDeleted: false },
      order: { classId: 'ASC', teacherId: 'ASC' },
    });
  }

  /**
   * Check if a specific assignment exists (teacher-class-subject combo)
   */
  async findExisting(
    teacherId: number,
    classId: number,
    subjectId: number,
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment | null> {
    const repo = this.getRepository(options?.manager);
    return repo.findOne({
      where: { teacherId, classId, subjectId, isDeleted: false },
    });
  }

  // =========================================================================
  // Summary & Validation
  // =========================================================================

  /**
   * Get assignment summary for a class-subject pair
   * Shows total assigned periods and breakdown by teacher
   */
  async getAssignmentSummary(
    classId: number,
    subjectId: number,
    options?: RepositoryOptions
  ): Promise<AssignmentSummary> {
    const assignments = await this.findByClassAndSubject(classId, subjectId, options);

    const totalAssignedPeriods = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);

    return {
      classId,
      subjectId,
      totalAssignedPeriods,
      assignments: assignments.map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        periodsPerWeek: a.periodsPerWeek,
        isFixed: a.isFixed,
      })),
    };
  }

  /**
   * Get total periods assigned to a teacher
   */
  async getTeacherTotalPeriods(teacherId: number, options?: RepositoryOptions): Promise<number> {
    const assignments = await this.findByTeacher(teacherId, options);
    return assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
  }

  /**
   * Validate that total assigned periods don't exceed class requirement
   * Returns remaining periods available for assignment
   */
  async validateAssignment(
    classId: number,
    subjectId: number,
    requiredPeriods: number,
    excludeAssignmentId?: number,
    options?: RepositoryOptions
  ): Promise<{ valid: boolean; remainingPeriods: number; message?: string }> {
    const assignments = await this.findByClassAndSubject(classId, subjectId, options);

    // Exclude the assignment being updated (if any)
    const relevantAssignments = excludeAssignmentId
      ? assignments.filter((a) => a.id !== excludeAssignmentId)
      : assignments;

    const totalAssigned = relevantAssignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);

    const remainingPeriods = requiredPeriods - totalAssigned;

    if (remainingPeriods < 0) {
      return {
        valid: false,
        remainingPeriods: 0,
        message: `Over-assigned by ${Math.abs(remainingPeriods)} periods`,
      };
    }

    return {
      valid: true,
      remainingPeriods,
    };
  }

  // =========================================================================
  // Bulk Operations
  // =========================================================================

  /**
   * Bulk create assignments
   */
  async bulkCreate(
    inputs: TeacherClassSubjectAssignmentInput[],
    options?: RepositoryOptions
  ): Promise<TeacherClassSubjectAssignment[]> {
    if (inputs.length === 0) return [];

    const operation = async (manager: EntityManager): Promise<TeacherClassSubjectAssignment[]> => {
      const repo = manager.getRepository(TeacherClassSubjectAssignment);
      const now = new Date();

      const assignments = inputs.map((input) => {
        const assignment = new TeacherClassSubjectAssignment();
        assignment.teacherId = input.teacherId;
        assignment.classId = input.classId;
        assignment.subjectId = input.subjectId;
        assignment.periodsPerWeek = input.periodsPerWeek;
        assignment.isFixed = input.isFixed ?? true;
        assignment.schoolId = input.schoolId ?? null;
        assignment.createdAt = now;
        assignment.updatedAt = now;
        return assignment;
      });

      return repo.save(assignments);
    };

    let result: TeacherClassSubjectAssignment[];
    if (options?.manager) {
      result = await operation(options.manager);
    } else {
      result = await this.withTransaction(operation);
    }

    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Bulk created teacher-class-subject assignments', {
      count: result.length,
    });

    return result;
  }

  /**
   * Delete all assignments for a class-subject pair
   */
  async deleteByClassAndSubject(
    classId: number,
    subjectId: number,
    options?: RepositoryOptions
  ): Promise<number> {
    const assignments = await this.findByClassAndSubject(classId, subjectId, options);
    const now = new Date();

    const repo = this.getRepository(options?.manager);
    for (const assignment of assignments) {
      assignment.isDeleted = true;
      assignment.deletedAt = now;
      assignment.updatedAt = now;
    }

    await repo.save(assignments);

    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Deleted assignments for class-subject', {
      classId,
      subjectId,
      count: assignments.length,
    });

    return assignments.length;
  }

  /**
   * Soft delete all assignments for a set of subject IDs
   */
  async deleteBySubjectIds(
    subjectIds: number[],
    options?: RepositoryOptions
  ): Promise<number> {
    if (subjectIds.length === 0) {
      return 0;
    }

    const repo = this.getRepository(options?.manager);
    const assignments = await repo.find({
      where: {
        subjectId: In(subjectIds),
        isDeleted: false,
      },
    });

    if (assignments.length === 0) {
      return 0;
    }

    const now = new Date();
    for (const assignment of assignments) {
      assignment.isDeleted = true;
      assignment.deletedAt = now;
      assignment.updatedAt = now;
    }

    await repo.save(assignments);

    if (!options?.skipCache) {
      this.invalidateAllCache();
    }

    logger.info('Deleted assignments for subject IDs', {
      subjectIds,
      count: assignments.length,
    });

    return assignments.length;
  }
}
