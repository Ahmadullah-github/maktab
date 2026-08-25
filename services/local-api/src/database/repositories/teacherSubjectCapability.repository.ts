import { DataSource, EntityTarget } from 'typeorm';
import {
  TeacherCapabilityLevel,
  TeacherSubjectCapability,
} from '../../entity/TeacherSubjectCapability';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';

export interface TeacherSubjectCapabilityInput {
  teacherId: number;
  subjectId: number;
  capabilityLevel: TeacherCapabilityLevel;
}

export class TeacherSubjectCapabilityRepository extends BaseRepository<TeacherSubjectCapability> {
  protected readonly entityClass: EntityTarget<TeacherSubjectCapability> = TeacherSubjectCapability;
  protected readonly cachePrefix = 'teacher-subject-capability';

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): TeacherSubjectCapabilityRepository {
    return getDataSourceScopedInstance(
      dataSource,
      TeacherSubjectCapabilityRepository,
      () =>
        new TeacherSubjectCapabilityRepository(
          dataSource,
          cacheManager ?? CacheManager.getInstance()
        )
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(TeacherSubjectCapabilityRepository);
  }

  async getActiveByTeacher(
    teacherId: number,
    options?: RepositoryOptions
  ): Promise<TeacherSubjectCapability[]> {
    return this.getRepository(options?.manager).find({
      where: { teacherId, isDeleted: false },
      order: { subjectId: 'ASC' },
    });
  }

  async upsertCapability(
    input: TeacherSubjectCapabilityInput,
    options?: RepositoryOptions
  ): Promise<TeacherSubjectCapability> {
    const repo = this.getRepository(options?.manager);
    const existing = await repo.findOne({
      where: { teacherId: input.teacherId, subjectId: input.subjectId },
    });

    if (existing) {
      existing.capabilityLevel = input.capabilityLevel;
      existing.isDeleted = false;
      existing.deletedAt = null;
      existing.updatedAt = new Date();

      const saved = await repo.save(existing);
      if (this.shouldUseCache(options)) {
        this.invalidateAllCache();
      }
      return saved;
    }

    const entity = repo.create(input);
    const saved = await repo.save(entity);
    if (this.shouldUseCache(options)) {
      this.invalidateAllCache();
    }
    return saved;
  }
}
