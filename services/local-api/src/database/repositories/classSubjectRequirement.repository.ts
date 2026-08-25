import { DataSource, EntityTarget } from 'typeorm';
import {
  ClassSubjectRequirement,
  RequirementPeriodMode,
} from '../../entity/ClassSubjectRequirement';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';

export interface ClassSubjectRequirementInput {
  classId: number;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  allowSplitAssignment?: boolean;
  periodMode?: RequirementPeriodMode;
}

export class ClassSubjectRequirementRepository extends BaseRepository<ClassSubjectRequirement> {
  protected readonly entityClass: EntityTarget<ClassSubjectRequirement> = ClassSubjectRequirement;
  protected readonly cachePrefix = 'class-subject-requirement';

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): ClassSubjectRequirementRepository {
    return getDataSourceScopedInstance(
      dataSource,
      ClassSubjectRequirementRepository,
      () =>
        new ClassSubjectRequirementRepository(
          dataSource,
          cacheManager ?? CacheManager.getInstance()
        )
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(ClassSubjectRequirementRepository);
  }

  async getActiveByClassAndSubject(
    classId: number,
    subjectId: number,
    options?: RepositoryOptions
  ): Promise<ClassSubjectRequirement | null> {
    return this.getRepository(options?.manager).findOne({
      where: { classId, subjectId, isDeleted: false },
    });
  }

  async getActiveByClass(
    classId: number,
    options?: RepositoryOptions
  ): Promise<ClassSubjectRequirement[]> {
    return this.getRepository(options?.manager).find({
      where: { classId, isDeleted: false },
      order: { subjectId: 'ASC' },
    });
  }

  async upsertRequirement(
    input: ClassSubjectRequirementInput,
    options?: RepositoryOptions
  ): Promise<ClassSubjectRequirement> {
    const repo = this.getRepository(options?.manager);
    const existing = await repo.findOne({
      where: { classId: input.classId, subjectId: input.subjectId },
    });

    if (existing) {
      existing.requiredPeriodsPerWeek = input.requiredPeriodsPerWeek;
      existing.allowSplitAssignment = input.allowSplitAssignment ?? false;
      existing.periodMode = input.periodMode ?? existing.periodMode ?? 'inherited';
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.updatedAt = new Date();

      const saved = await repo.save(existing);
      if (this.shouldUseCache(options)) {
        this.invalidateAllCache();
      }
      return saved;
    }

    const entity = repo.create({
      classId: input.classId,
      subjectId: input.subjectId,
      requiredPeriodsPerWeek: input.requiredPeriodsPerWeek,
      allowSplitAssignment: input.allowSplitAssignment ?? false,
      periodMode: input.periodMode ?? 'inherited',
    });

    const saved = await repo.save(entity);
    if (this.shouldUseCache(options)) {
      this.invalidateAllCache();
    }
    return saved;
  }
}
