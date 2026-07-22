import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import {
  CurriculumConfig,
  type GradeCurriculumData,
  type SchoolCurriculumSubjectData,
} from '../../entity/CurriculumConfig';
import {
  createDefaultCurriculumConfig,
  curriculumToSolverFormat,
  getAllGrades,
  getEffectiveCurriculum,
  type SchoolCurriculumConfig,
} from '../../curriculum';
import { clearDataSourceScopedInstances, getDataSourceScopedInstance } from '../../utils/dataSourceScope';
import { CacheManager } from '../cache/cacheManager';

const CACHE_PREFIX = 'curriculum_config';

export class CurriculumRevisionConflictError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`Curriculum changed since preview (expected revision ${expected}, current ${actual})`);
    this.name = 'CurriculumRevisionConflictError';
  }
}

export class CurriculumConfigRepository {
  private readonly repo: Repository<CurriculumConfig>;

  private constructor(ds: DataSource, private readonly cache: CacheManager) {
    this.repo = ds.getRepository(CurriculumConfig);
  }

  static getInstance(ds: DataSource, cache = CacheManager.getInstance()): CurriculumConfigRepository {
    return getDataSourceScopedInstance(ds, CurriculumConfigRepository, () => new CurriculumConfigRepository(ds, cache));
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(CurriculumConfigRepository);
  }

  private key(schoolId: number | null, grade?: number): string {
    return grade === undefined ? `${schoolId ?? 'default'}:all` : `${schoolId ?? 'default'}:${grade}`;
  }

  private where(grade: number | undefined, schoolId: number | null) {
    return {
      ...(grade === undefined ? {} : { grade }),
      schoolId: schoolId === null ? IsNull() : schoolId,
      isDeleted: false,
    };
  }

  async getForGrade(grade: number, schoolId: number | null = null, manager?: EntityManager) {
    const cached = manager ? undefined : this.cache.get<CurriculumConfig>(CACHE_PREFIX, this.key(schoolId, grade));
    if (cached) return cached;
    const result = await (manager?.getRepository(CurriculumConfig) ?? this.repo).findOne({ where: this.where(grade, schoolId) });
    if (result && !manager) this.cache.set(CACHE_PREFIX, this.key(schoolId, grade), result);
    return result;
  }

  async getAllForSchool(schoolId: number | null = null, manager?: EntityManager) {
    const cached = manager ? undefined : this.cache.get<CurriculumConfig[]>(CACHE_PREFIX, this.key(schoolId));
    if (cached) return cached;
    const result = await (manager?.getRepository(CurriculumConfig) ?? this.repo).find({
      where: this.where(undefined, schoolId),
      order: { grade: 'ASC' },
    });
    if (!manager) this.cache.set(CACHE_PREFIX, this.key(schoolId), result);
    return result;
  }

  async getSchoolCurriculumConfig(schoolId: number | null = null, manager?: EntityManager): Promise<SchoolCurriculumConfig> {
    const configs = await this.getAllForSchool(schoolId, manager);
    if (configs.length === 0) return createDefaultCurriculumConfig(schoolId);
    const byGrade = new Map(configs.map((config) => [config.grade, config]));
    return {
      schoolId,
      revision: Math.max(...configs.map((config) => config.revision), 0),
      gradeConfigs: getAllGrades().map((grade) =>
        byGrade.get(grade)?.toGradeCurriculumData() ?? { grade, revision: 0, subjects: [] }
      ),
    };
  }

  async saveForGrade(
    grade: number,
    data: Pick<GradeCurriculumData, 'subjects'>,
    schoolId: number | null = null,
    manager?: EntityManager,
    expectedRevision?: number
  ): Promise<CurriculumConfig> {
    const repository = manager?.getRepository(CurriculumConfig) ?? this.repo;
    let config = await repository.findOne({ where: this.where(grade, schoolId) });
    const currentRevision = config?.revision ?? 0;
    if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
      throw new CurriculumRevisionConflictError(expectedRevision, currentRevision);
    }
    if (!config) config = repository.create({ grade, schoolId, revision: 0 });
    config.subjects = data.subjects;
    config.revision = currentRevision + 1;
    config.updatedAt = new Date();
    const saved = await repository.save(config);
    if (!manager) this.invalidate(schoolId, grade);
    return saved;
  }

  async bulkSave(
    gradeConfigs: Array<Pick<GradeCurriculumData, 'grade' | 'subjects' | 'revision'>>,
    schoolId: number | null = null,
    manager?: EntityManager
  ) {
    const saved: CurriculumConfig[] = [];
    for (const gradeConfig of gradeConfigs) {
      saved.push(await this.saveForGrade(gradeConfig.grade, gradeConfig, schoolId, manager, gradeConfig.revision));
    }
    if (!manager) this.cache.delete(CACHE_PREFIX, this.key(schoolId));
    return saved;
  }

  async replaceSubjectForGrade(
    grade: number,
    transform: (subjects: SchoolCurriculumSubjectData[]) => SchoolCurriculumSubjectData[],
    schoolId: number | null,
    manager: EntityManager
  ) {
    const config = await this.getForGrade(grade, schoolId, manager);
    return this.saveForGrade(grade, { subjects: transform(config?.subjects ?? []) }, schoolId, manager, config?.revision ?? 0);
  }

  async getEffectiveSubjectsForGrade(grade: number, schoolId: number | null = null, manager?: EntityManager) {
    const config = await this.getForGrade(grade, schoolId, manager);
    return getEffectiveCurriculum(grade, config?.toGradeCurriculumData());
  }

  async getForSolver(schoolId: number | null = null) {
    return curriculumToSolverFormat(await this.getSchoolCurriculumConfig(schoolId));
  }

  invalidate(schoolId: number | null, grade?: number): void {
    if (grade !== undefined) this.cache.delete(CACHE_PREFIX, this.key(schoolId, grade));
    this.cache.delete(CACHE_PREFIX, this.key(schoolId));
  }
}
