/**
 * Subject Service for business logic operations
 * @module services/subject
 *
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to SubjectService class
 */

import { DataSource } from 'typeorm';
import {
  SubjectRepository,
  SubjectInput,
  ParsedSubject,
  SubjectIdentityConflictError,
  normalizeSubjectInput,
} from '../database/repositories/subject.repository';
import { CacheManager } from '../database/cache/cacheManager';
import { runCommittedTransaction } from '../database/transaction';
import { PaginationParams, PaginatedResponse, ServiceResult } from '../types/common.types';
import { SubjectReferenceCleanupService } from './subjectReferenceCleanup.service';
import { logger } from '../utils/logger';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import { SWAP_CONSTRAINT_CACHE_PREFIX } from './SwapConstraintCache';
import { RoomTypeRepository } from '../database/repositories/roomType.repository';
import { TimetableRepository } from '../database/repositories/timetable.repository';
import {
  SchoolScopeConflictError,
  assertOperationalWriteScope,
} from '../utils/schoolScopeGuard';
import {
  CurriculumConflictError,
  SchoolCurriculumOrchestrator,
} from './schoolCurriculumOrchestrator.service';

/**
 * SubjectService handles all business logic for Subject operations
 */
export class SubjectService {
  private dataSource: DataSource;
  private subjectRepository: SubjectRepository;
  private subjectReferenceCleanupService: SubjectReferenceCleanupService;
  private roomTypeRepository: RoomTypeRepository;
  private timetableRepository: TimetableRepository;
  private readonly cacheManager: CacheManager;
  private readonly curriculumOrchestrator: SchoolCurriculumOrchestrator;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.subjectRepository = SubjectRepository.getInstance(dataSource, this.cacheManager);
    this.roomTypeRepository = RoomTypeRepository.getInstance(dataSource, this.cacheManager);
    this.timetableRepository = TimetableRepository.getInstance(dataSource, this.cacheManager);
    this.subjectReferenceCleanupService = SubjectReferenceCleanupService.getInstance(
      dataSource,
      this.cacheManager
    );
    this.curriculumOrchestrator = SchoolCurriculumOrchestrator.getInstance(
      dataSource,
      this.cacheManager
    );
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SubjectService {
    return getDataSourceScopedInstance(
      dataSource,
      SubjectService,
      () => new SubjectService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(SubjectService);
  }

  private async validateRoomType(value: string | null | undefined): Promise<string | null> {
    if (!value) return null;
    return (await this.roomTypeRepository.findActiveByValue(value))
      ? null
      : `Active room type "${value}" does not exist`;
  }

  private validateCustomClassification(
    isCustom: boolean,
    customCategory: string | null
  ): string | null {
    if (isCustom && !customCategory) {
      return 'Custom subjects require a customCategory';
    }
    if (!isCustom && customCategory) {
      return 'Non-custom subjects cannot have a customCategory';
    }
    return null;
  }

  private scopeFailure(error: Error): ServiceResult<never> | null {
    return error instanceof SchoolScopeConflictError
      ? { success: false, error: error.message, statusCode: 409, code: error.code, details: error.details }
      : null;
  }

  private identityFailure(error: Error): ServiceResult<never> | null {
    return error instanceof SubjectIdentityConflictError || /UNIQUE constraint failed/i.test(error.message)
      ? {
          success: false,
          error: error.message,
          statusCode: 409,
          code: 'SUBJECT_IDENTITY_CONFLICT',
        }
      : null;
  }

  private curriculumFailure(error: Error): ServiceResult<never> | null {
    return error instanceof CurriculumConflictError
      ? {
          success: false,
          error: error.message,
          statusCode: 409,
          code: error.code,
          details: error.details,
        }
      : null;
  }

  async create(input: SubjectInput): Promise<ServiceResult<ParsedSubject>> {
    try {
      const normalized = normalizeSubjectInput(input);
      if (!normalized.name) {
        return { success: false, error: 'Subject name is required' };
      }
      const customClassificationError = this.validateCustomClassification(
        normalized.isCustom ?? false,
        normalized.customCategory ?? null
      );
      if (customClassificationError) {
        return { success: false, error: customClassificationError, statusCode: 400 };
      }

      const roomTypeError = await this.validateRoomType(normalized.requiredRoomType);
      if (roomTypeError) return { success: false, error: roomTypeError, statusCode: 409 };
      await assertOperationalWriteScope(this.dataSource, [
        { entity: 'subject', schoolId: normalized.schoolId ?? null },
      ]);

      if (normalized.grade !== null && normalized.grade !== undefined && normalized.periodsPerWeek) {
        const subject = await this.curriculumOrchestrator.createFromSubject({
          schoolId: normalized.schoolId,
          name: normalized.name,
          code: normalized.code,
          grade: normalized.grade,
          periodsPerWeek: normalized.periodsPerWeek,
          isDifficult: normalized.isDifficult,
          requiredRoomType: normalized.requiredRoomType,
          section: normalized.section,
          requiredFeatures: normalized.requiredFeatures,
          desiredFeatures: normalized.desiredFeatures,
          minRoomCapacity: normalized.minRoomCapacity,
          meta: normalized.meta,
        });
        if (!subject) throw new Error('Curriculum subject was not materialized');
        this.invalidateSwapConstraints();
        return { success: true, data: subject };
      }

      const subject = await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager) => {
          const { byName, byCode } = await this.subjectRepository.findIdentityMatch(normalized, {
            manager,
            skipCache: true,
          });
          if (byName || byCode) {
            throw new SubjectIdentityConflictError(
              `Subject name or code already exists for grade ${normalized.grade ?? 'unspecified'}`
            );
          }
          const saved = await this.subjectRepository.saveSubject(normalized, {
            manager,
            skipCache: true,
          });
          await this.timetableRepository.markStaleForSchool(
            saved.schoolId,
            `Subject ${saved.id} was created`,
            { manager, skipCache: true }
          );
          return saved;
        }
      );
      this.invalidateSwapConstraints();
      logger.info('SubjectService: Created subject', { id: subject.id, name: subject.name });
      return { success: true, data: subject };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to create subject', error);
      return (
        this.scopeFailure(error) ??
        this.curriculumFailure(error) ??
        this.identityFailure(error) ?? { success: false, error: error.message }
      );
    }
  }

  async update(id: number, input: Partial<SubjectInput>): Promise<ServiceResult<ParsedSubject>> {
    try {
      if (input.name !== undefined && input.name.trim() === '') {
        return { success: false, error: 'Subject name cannot be empty' };
      }

      const existing = await this.subjectRepository.getSubject(id);
      if (!existing) {
        return { success: false, error: `Subject with ID ${id} not found` };
      }
      const customClassificationError = this.validateCustomClassification(
        input.isCustom ?? existing.isCustom,
        input.customCategory === undefined ? existing.customCategory : input.customCategory
      );
      if (customClassificationError) {
        return { success: false, error: customClassificationError, statusCode: 400 };
      }

      const roomTypeError = await this.validateRoomType(input.requiredRoomType);
      if (roomTypeError) return { success: false, error: roomTypeError, statusCode: 409 };
      await assertOperationalWriteScope(this.dataSource, [
        {
          entity: 'subject',
          id,
          schoolId: input.schoolId === undefined ? existing.schoolId : input.schoolId,
        },
      ]);

      if (existing.curriculumItemId) {
        if (
          (input.schoolId !== undefined && input.schoolId !== existing.schoolId) ||
          (input.isCustom !== undefined && input.isCustom !== existing.isCustom) ||
          (input.customCategory !== undefined && input.customCategory !== existing.customCategory)
        ) {
          return {
            success: false,
            error: 'Curriculum-linked subject scope and classification are controlled by School Curriculum.',
            statusCode: 409,
            code: 'CURRICULUM_BLOCKED',
          };
        }
        const subject = await this.curriculumOrchestrator.updateFromSubject(id, input);
        if (!subject) throw new Error(`Failed to update curriculum subject with ID ${id}`);
        this.invalidateSwapConstraints();
        return { success: true, data: subject };
      }

      const prospective = normalizeSubjectInput({
        name: input.name ?? existing.name,
        code: input.code ?? existing.code,
        schoolId: input.schoolId === undefined ? existing.schoolId : input.schoolId,
        grade: input.grade === undefined ? existing.grade : input.grade,
      });
      const subject = await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager) => {
          const { byName, byCode } = await this.subjectRepository.findIdentityMatch(prospective, {
            manager,
            skipCache: true,
          });
          if ((byName && byName.id !== id) || (byCode && byCode.id !== id)) {
            throw new SubjectIdentityConflictError(
              `Subject name or code already exists for grade ${prospective.grade ?? 'unspecified'}`
            );
          }
          const updated = await this.subjectRepository.updateSubject(id, input, {
            manager,
            skipCache: true,
          });
          if (updated) {
            const scopes = new Set([existing.schoolId, updated.schoolId]);
            for (const schoolId of scopes) {
              await this.timetableRepository.markStaleForSchool(
                schoolId,
                `Subject ${id} was updated`,
                { manager, skipCache: true }
              );
            }
          }
          return updated;
        }
      );
      if (!subject) {
        return { success: false, error: `Failed to update subject with ID ${id}` };
      }

      this.invalidateSwapConstraints();
      logger.info('SubjectService: Updated subject', { id });
      return { success: true, data: subject };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to update subject', error, { id });
      return (
        this.scopeFailure(error) ??
        this.curriculumFailure(error) ??
        this.identityFailure(error) ?? { success: false, error: error.message }
      );
    }
  }

  async delete(id: number): Promise<ServiceResult<boolean>> {
    try {
      const existing = await this.subjectRepository.getSubject(id);
      if (!existing) {
        return { success: false, error: `Subject with ID ${id} not found` };
      }

      if (existing.curriculumItemId) {
        await this.curriculumOrchestrator.deleteFromSubject(id);
        this.invalidateSwapConstraints();
        return { success: true, data: true };
      }

      await runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
        const deleted = await this.subjectRepository.deleteSubject(id, {
          manager,
          skipCache: true,
        });
        if (!deleted) {
          throw new Error(`Failed to delete subject with ID ${id}`);
        }

        await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences([id], manager);
        await this.timetableRepository.markStaleForSchool(
          existing.schoolId,
          `Subject ${id} was deleted`,
          { manager, skipCache: true }
        );
      });

      logger.info('SubjectService: Deleted subject', { id });
      this.invalidateSwapConstraints();
      return { success: true, data: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to delete subject', error, { id });
      return this.curriculumFailure(error) ?? { success: false, error: error.message };
    }
  }

  async findById(id: number): Promise<ServiceResult<ParsedSubject>> {
    try {
      const subject = await this.subjectRepository.getSubject(id);
      if (!subject) {
        return { success: false, error: `Subject with ID ${id} not found` };
      }
      return { success: true, data: subject };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find subject', error, { id });
      return { success: false, error: error.message };
    }
  }

  async findAll(
    pagination?: PaginationParams
  ): Promise<ServiceResult<PaginatedResponse<ParsedSubject>>> {
    try {
      const result = await this.subjectRepository.getAllSubjects(pagination);
      return { success: true, data: result };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find all subjects', error);
      return { success: false, error: error.message };
    }
  }

  async findAllUnpaginated(): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const subjects = await this.subjectRepository.getAllSubjectsUnpaginated();
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find all subjects', error);
      return { success: false, error: error.message };
    }
  }

  async findByGrade(grade: number): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const subjects = await this.subjectRepository.findByGrade(grade);
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find subjects by grade', error, { grade });
      return { success: false, error: error.message };
    }
  }

  async findBySection(section: string): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const subjects = await this.subjectRepository.findBySection(section);
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to find subjects by section', error, { section });
      return { success: false, error: error.message };
    }
  }

  async count(): Promise<ServiceResult<number>> {
    try {
      const count = await this.subjectRepository.countSubjects();
      return { success: true, data: count };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to count subjects', error);
      return { success: false, error: error.message };
    }
  }

  private invalidateSwapConstraints(): void {
    this.cacheManager.invalidatePrefix(SWAP_CONSTRAINT_CACHE_PREFIX);
  }
}
