/**
 * Subject Service for business logic operations
 * @module services/subject
 *
 * Requirements: 3.2
 * - Route handler SHALL delegate business logic to SubjectService class
 */

import { DataSource, EntityManager } from 'typeorm';
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
import { CurriculumConfigRepository } from '../database/repositories/curriculum.repository';
import { CurriculumMaterializationService } from './curriculumMaterialization.service';
import {
  SchoolScopeConflictError,
  assertOperationalWriteScope,
} from '../utils/schoolScopeGuard';

/**
 * SubjectService handles all business logic for Subject operations
 */
export class SubjectService {
  private dataSource: DataSource;
  private subjectRepository: SubjectRepository;
  private subjectReferenceCleanupService: SubjectReferenceCleanupService;
  private roomTypeRepository: RoomTypeRepository;
  private timetableRepository: TimetableRepository;
  private curriculumRepository: CurriculumConfigRepository;
  private curriculumMaterializer: CurriculumMaterializationService;
  private readonly cacheManager: CacheManager;

  private constructor(dataSource: DataSource, cacheManager?: CacheManager) {
    this.dataSource = dataSource;
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.subjectRepository = SubjectRepository.getInstance(dataSource, this.cacheManager);
    this.roomTypeRepository = RoomTypeRepository.getInstance(dataSource, this.cacheManager);
    this.timetableRepository = TimetableRepository.getInstance(dataSource, this.cacheManager);
    this.curriculumRepository = CurriculumConfigRepository.getInstance(dataSource, this.cacheManager);
    this.curriculumMaterializer = CurriculumMaterializationService.getInstance(dataSource, this.cacheManager);
    this.subjectReferenceCleanupService = SubjectReferenceCleanupService.getInstance(
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

  private curriculumItemId(subject: ParsedSubject): string {
    return typeof subject.meta.curriculumItemId === 'string'
      ? subject.meta.curriculumItemId
      : `subject-${subject.id}`;
  }

  private async removeFromCurriculum(subject: ParsedSubject, manager: EntityManager): Promise<void> {
    if (!subject.grade) return;
    const config = await this.curriculumRepository.getForGrade(subject.grade, subject.schoolId, manager);
    if (!config) return;
    const itemId = this.curriculumItemId(subject);
    const code = subject.code.normalize('NFKC').trim().toLocaleLowerCase();
    const subjects = config.subjects.filter((entry) =>
      entry.itemId !== itemId && entry.code.normalize('NFKC').trim().toLocaleLowerCase() !== code
    );
    if (subjects.length !== config.subjects.length) {
      await this.curriculumRepository.saveForGrade(subject.grade, { subjects }, subject.schoolId, manager, config.revision);
    }
  }

  private async upsertIntoCurriculum(
    subject: ParsedSubject,
    manager: EntityManager,
    previous?: ParsedSubject,
    materialize = true
  ): Promise<void> {
    if (previous && (previous.grade !== subject.grade || previous.schoolId !== subject.schoolId)) {
      await this.removeFromCurriculum(previous, manager);
    }
    if (!subject.grade || !subject.periodsPerWeek || subject.periodsPerWeek < 1) return;
    const config = await this.curriculumRepository.getForGrade(subject.grade, subject.schoolId, manager);
    const subjects = [...(config?.subjects ?? [])];
    const itemId = this.curriculumItemId(previous ?? subject);
    const entry = {
      itemId,
      name: subject.name,
      nameEn: typeof subject.meta.nameEn === 'string' ? subject.meta.nameEn : undefined,
      code: subject.code,
      periodsPerWeek: subject.periodsPerWeek,
      isDifficult: subject.isDifficult,
      requiredRoomType: subject.requiredRoomType ?? undefined,
    };
    const index = subjects.findIndex((candidate) => candidate.itemId === itemId);
    if (index >= 0) subjects[index] = entry;
    else subjects.push(entry);
    await this.curriculumRepository.saveForGrade(subject.grade, { subjects }, subject.schoolId, manager, config?.revision ?? 0);
    if (materialize) {
      await this.curriculumMaterializer.materializeGrades([subject.grade], subject.schoolId, { manager });
    }
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
          await this.upsertIntoCurriculum(saved, manager);
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
            await this.upsertIntoCurriculum(updated, manager, existing);
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

      await runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
        await this.removeFromCurriculum(existing, manager);
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
      return { success: false, error: error.message };
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

  async bulkUpsert(subjectsData: SubjectInput[]): Promise<ServiceResult<ParsedSubject[]>> {
    try {
      const invalidSubjects = subjectsData.filter((s) => !s.name || s.name.trim() === '');
      if (invalidSubjects.length > 0) {
        return { success: false, error: `${invalidSubjects.length} subject(s) have empty names` };
      }
      for (const subject of subjectsData) {
        const roomTypeError = await this.validateRoomType(subject.requiredRoomType);
        if (roomTypeError) return { success: false, error: roomTypeError, statusCode: 409 };
      }
      await assertOperationalWriteScope(
        this.dataSource,
        subjectsData.map((subject) => ({ entity: 'subject', schoolId: subject.schoolId ?? null }))
      );

      const subjects = await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager) => {
          const saved = await this.subjectRepository.bulkUpsert(
            subjectsData.map(normalizeSubjectInput),
            { manager, skipCache: true }
          );
          const affectedGrades = new Map<string, { schoolId: number | null; grades: Set<number> }>();
          for (const subject of saved) {
            await this.upsertIntoCurriculum(subject, manager, undefined, false);
            if (subject.grade && subject.periodsPerWeek) {
              const key = String(subject.schoolId ?? 'default');
              const scope = affectedGrades.get(key) ?? { schoolId: subject.schoolId, grades: new Set<number>() };
              scope.grades.add(subject.grade);
              affectedGrades.set(key, scope);
            }
          }
          for (const scope of affectedGrades.values()) {
            await this.curriculumMaterializer.materializeGrades([...scope.grades], scope.schoolId, { manager });
          }
          for (const schoolId of new Set(saved.map((subject) => subject.schoolId))) {
            await this.timetableRepository.markStaleForSchool(
              schoolId,
              'Subjects were imported or synchronized',
              { manager, skipCache: true }
            );
          }
          return saved;
        }
      );
      this.invalidateSwapConstraints();
      logger.info('SubjectService: Bulk upserted subjects', { count: subjects.length });
      return { success: true, data: subjects };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to bulk upsert subjects', error);
      return (
        this.scopeFailure(error) ??
        this.identityFailure(error) ?? { success: false, error: error.message }
      );
    }
  }

  async bulkDelete(ids: number[]): Promise<ServiceResult<number>> {
    try {
      if (ids.length === 0) {
        return { success: true, data: 0 };
      }

      const existingSubjects = (
        await Promise.all(ids.map((id) => this.subjectRepository.getSubject(id)))
      ).filter((subject): subject is ParsedSubject => subject !== null);

      const deleted = await runCommittedTransaction(
        this.dataSource,
        this.cacheManager,
        async (manager) => {
          for (const subject of existingSubjects) {
            await this.removeFromCurriculum(subject, manager);
          }
          const deletedCount = await this.subjectRepository.bulkDeleteSubjects(ids, {
            manager,
            skipCache: true,
          });
          await this.subjectReferenceCleanupService.cleanupDeletedSubjectReferences(ids, manager);
          for (const schoolId of new Set(existingSubjects.map((subject) => subject.schoolId))) {
            await this.timetableRepository.markStaleForSchool(
              schoolId,
              'Subjects were deleted',
              { manager, skipCache: true }
            );
          }
          return deletedCount;
        }
      );

      logger.info('SubjectService: Bulk deleted subjects', { count: deleted });
      if (deleted > 0) this.invalidateSwapConstraints();
      return { success: true, data: deleted };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('SubjectService: Failed to bulk delete subjects', error);
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
