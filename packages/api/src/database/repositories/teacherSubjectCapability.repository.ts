import { DataSource, EntityTarget } from 'typeorm';
import {
  TeacherCapabilityLevel,
  TeacherSubjectCapability,
} from '../../entity/TeacherSubjectCapability';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

export interface TeacherSubjectCapabilityInput {
  teacherId: number;
  subjectId: number;
  capabilityLevel: TeacherCapabilityLevel;
}

export class TeacherSubjectCapabilityRepository extends BaseRepository<TeacherSubjectCapability> {
  protected readonly entityClass: EntityTarget<TeacherSubjectCapability> =
    TeacherSubjectCapability;
  protected readonly cachePrefix = 'teacher-subject-capability';

  private static instance: TeacherSubjectCapabilityRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  static getInstance(
    dataSource: DataSource,
    cacheManager?: CacheManager
  ): TeacherSubjectCapabilityRepository {
    if (!TeacherSubjectCapabilityRepository.instance) {
      TeacherSubjectCapabilityRepository.instance = new TeacherSubjectCapabilityRepository(
        dataSource,
        cacheManager ?? CacheManager.getInstance()
      );
    }

    return TeacherSubjectCapabilityRepository.instance;
  }

  static resetInstance(): void {
    TeacherSubjectCapabilityRepository.instance = null;
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
      if (!options?.skipCache) {
        this.invalidateAllCache();
      }
      return saved;
    }

    const entity = repo.create(input);
    const saved = await repo.save(entity);
    if (!options?.skipCache) {
      this.invalidateAllCache();
    }
    return saved;
  }
}
