/**
 * CurriculumConfig Repository - Handles school-specific curriculum configurations
 */
import { DataSource, EntityManager, Repository, IsNull } from 'typeorm';
import { CurriculumConfig, GradeCurriculumData } from '../../entity/CurriculumConfig';
import { CacheManager } from '../cache/cacheManager';
import { SchoolCurriculumConfig, getEffectiveCurriculum, validateCurriculumConfig, curriculumToSolverFormat, createDefaultCurriculumConfig, getAllGrades, CurriculumValidationResult } from '../../curriculum';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';

const CP = 'curriculum_config';

export class CurriculumConfigRepository {
  private repo: Repository<CurriculumConfig>;
  private cm: CacheManager;

  private constructor(ds: DataSource, cache: CacheManager) {
    this.repo = ds.getRepository(CurriculumConfig);
    this.cm = cache;
  }

  static getInstance(ds: DataSource, cache: CacheManager): CurriculumConfigRepository {
    return getDataSourceScopedInstance(
      ds,
      CurriculumConfigRepository,
      () => new CurriculumConfigRepository(ds, cache)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(CurriculumConfigRepository);
  }

  private ck(sid: number | null, g?: number): string {
    return g !== undefined ? `${sid ?? 'd'}:g${g}` : `${sid ?? 'd'}:all`;
  }

  async getForGrade(g: number, sid: number | null = null, manager?: EntityManager): Promise<CurriculumConfig | null> {
    const k = this.ck(sid, g);
    const c = manager ? undefined : this.cm.get<CurriculumConfig>(CP, k);
    if (c) return c;
    const w = sid === null ? { grade: g, schoolId: IsNull(), isDeleted: false } : { grade: g, schoolId: sid, isDeleted: false };
    const r = await (manager?.getRepository(CurriculumConfig) ?? this.repo).findOne({ where: w });
    if (r && !manager) this.cm.set(CP, k, r);
    return r;
  }

  async getAllForSchool(sid: number | null = null, manager?: EntityManager): Promise<CurriculumConfig[]> {
    const k = this.ck(sid);
    const c = manager ? undefined : this.cm.get<CurriculumConfig[]>(CP, k);
    if (c) return c;
    const w = sid === null ? { schoolId: IsNull(), isDeleted: false } : { schoolId: sid, isDeleted: false };
    const r = await (manager?.getRepository(CurriculumConfig) ?? this.repo).find({ where: w, order: { grade: 'ASC' } });
    if (!manager) this.cm.set(CP, k, r);
    return r;
  }


  async getSchoolCurriculumConfig(sid: number | null = null): Promise<SchoolCurriculumConfig> {
    const cfgs = await this.getAllForSchool(sid);
    if (cfgs.length === 0) return createDefaultCurriculumConfig(sid);
    const gc: GradeCurriculumData[] = getAllGrades().map((g: number) => {
      const f = cfgs.find((x: CurriculumConfig) => x.grade === g);
      return f?.toGradeCurriculumData() ?? { grade: g, overrides: [], customSubjects: [] };
    });
    return { schoolId: sid, useMinistryDefaults: cfgs.every((c: CurriculumConfig) => c.useMinistryDefaults), gradeConfigs: gc };
  }

  async saveForGrade(g: number, d: Partial<GradeCurriculumData>, sid: number | null = null, manager?: EntityManager): Promise<CurriculumConfig> {
    const repository = manager?.getRepository(CurriculumConfig) ?? this.repo;
    const w = sid === null ? { grade: g, schoolId: IsNull(), isDeleted: false } : { grade: g, schoolId: sid, isDeleted: false };
    let cfg = await repository.findOne({ where: w });
    if (!cfg) cfg = repository.create({ grade: g, schoolId: sid, useMinistryDefaults: true });
    if (d.overrides !== undefined) cfg.overrides = d.overrides;
    if (d.customSubjects !== undefined) cfg.customSubjects = d.customSubjects;
    cfg.updatedAt = new Date();
    const s = await repository.save(cfg);
    if (!manager) {
      this.cm.delete(CP, this.ck(sid, g));
      this.cm.delete(CP, this.ck(sid));
    }
    return s;
  }

  async bulkSave(gcs: GradeCurriculumData[], sid: number | null = null, manager?: EntityManager): Promise<CurriculumConfig[]> {
    const res: CurriculumConfig[] = [];
    for (const gc of gcs) res.push(await this.saveForGrade(gc.grade, gc, sid, manager));
    if (!manager) this.cm.delete(CP, this.ck(sid));
    return res;
  }

  async resetToDefaults(g: number, sid: number | null = null, manager?: EntityManager): Promise<CurriculumConfig> {
    return this.saveForGrade(g, { overrides: [], customSubjects: [] }, sid, manager);
  }

  async resetAllToDefaults(sid: number | null = null, manager?: EntityManager): Promise<void> {
    const w = sid === null ? { schoolId: IsNull(), isDeleted: false } : { schoolId: sid, isDeleted: false };
    await (manager?.getRepository(CurriculumConfig) ?? this.repo).update(w, { overridesJson: '[]', customSubjectsJson: '[]', useMinistryDefaults: true, updatedAt: new Date() });
    if (!manager) this.cm.delete(CP, this.ck(sid));
  }

  async validateConfig(sid: number | null = null, strict: boolean = false): Promise<CurriculumValidationResult> {
    return validateCurriculumConfig(await this.getSchoolCurriculumConfig(sid), strict);
  }

  async getForSolver(sid: number | null = null): Promise<Record<string, unknown>> {
    return curriculumToSolverFormat(await this.getSchoolCurriculumConfig(sid));
  }

  async getEffectiveSubjectsForGrade(g: number, sid: number | null = null, manager?: EntityManager): Promise<unknown[]> {
    const cfg = await this.getForGrade(g, sid, manager);
    return getEffectiveCurriculum(g, cfg?.toGradeCurriculumData());
  }
}
