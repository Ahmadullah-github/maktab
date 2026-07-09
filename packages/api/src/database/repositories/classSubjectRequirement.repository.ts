import { DataSource, EntityTarget } from 'typeorm';
import { ClassSubjectRequirement } from '../../entity/ClassSubjectRequirement';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

export interface ClassSubjectRequirementInput {
  classId: number;
  subjectId: number;
  requiredPeriodsPerWeek: number;
  allowSplitAssignment?: boolean;
}

export class ClassSubjectRequirementRepository extends BaseRepository<ClassSubjectRequirement> {
  protected readonly entityClass: EntityTarget<ClassSubjectRequirement> = ClassSubjectRequirement;
  protected readonly cachePrefix = 'class-subject-requirement';

  private static instance: ClassSubjectRequirementRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): ClassSubjectRequirementRepository {
    if (!ClassSubjectRequirementRepository.instance) {
      ClassSubjectRequirementRepository.instance = new ClassSubjectRequirementRepository(
        dataSource,
        cacheManager ?? CacheManager.getInstance()
      );
    }

    return ClassSubjectRequirementRepository.instance;
  }

  static resetInstance(): void {
    ClassSubjectRequirementRepository.instance = null;
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
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.updatedAt = new Date();

      const saved = await repo.save(existing);
      if (!options?.skipCache) {
        this.invalidateAllCache();
      }
      return saved;
    }

    const entity = repo.create({
      classId: input.classId,
      subjectId: input.subjectId,
      requiredPeriodsPerWeek: input.requiredPeriodsPerWeek,
      allowSplitAssignment: input.allowSplitAssignment ?? false,
    });

    const saved = await repo.save(entity);
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }
    return saved;
  }
}
