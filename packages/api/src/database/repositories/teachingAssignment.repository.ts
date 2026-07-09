import { DataSource, EntityTarget } from 'typeorm';
import {
  TeachingAssignment,
  TeachingAssignmentSource,
} from '../../entity/TeachingAssignment';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

export interface TeachingAssignmentInput {
  classSubjectRequirementId: number;
  teacherId: number;
  assignedPeriodsPerWeek: number;
  isFixed?: boolean;
  source?: TeachingAssignmentSource;
}

export class TeachingAssignmentRepository extends BaseRepository<TeachingAssignment> {
  protected readonly entityClass: EntityTarget<TeachingAssignment> = TeachingAssignment;
  protected readonly cachePrefix = 'teaching-assignment';

  private static instance: TeachingAssignmentRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): TeachingAssignmentRepository {
    if (!TeachingAssignmentRepository.instance) {
      TeachingAssignmentRepository.instance = new TeachingAssignmentRepository(
        dataSource,
        cacheManager ?? CacheManager.getInstance()
      );
    }

    return TeachingAssignmentRepository.instance;
  }

  static resetInstance(): void {
    TeachingAssignmentRepository.instance = null;
  }

  async getActiveByRequirement(
    classSubjectRequirementId: number,
    options?: RepositoryOptions
  ): Promise<TeachingAssignment[]> {
    return this.getRepository(options?.manager).find({
      where: { classSubjectRequirementId, isDeleted: false },
      order: { teacherId: 'ASC' },
    });
  }

  async upsertAssignment(
    input: TeachingAssignmentInput,
    options?: RepositoryOptions
  ): Promise<TeachingAssignment> {
    const repo = this.getRepository(options?.manager);
    const existing = await repo.findOne({
      where: {
        classSubjectRequirementId: input.classSubjectRequirementId,
        teacherId: input.teacherId,
      },
    });

    if (existing) {
      existing.assignedPeriodsPerWeek = input.assignedPeriodsPerWeek;
      existing.isFixed = input.isFixed ?? true;
      existing.source = input.source ?? 'manual';
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
      classSubjectRequirementId: input.classSubjectRequirementId,
      teacherId: input.teacherId,
      assignedPeriodsPerWeek: input.assignedPeriodsPerWeek,
      isFixed: input.isFixed ?? true,
      source: input.source ?? 'manual',
    });

    const saved = await repo.save(entity);
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }
    return saved;
  }
}
