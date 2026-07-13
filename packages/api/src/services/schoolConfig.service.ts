import { Between, DataSource, EntityManager, FindOptionsWhere, IsNull } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { SchoolConfigRepository } from '../database/repositories/schoolConfig.repository';
import { runCommittedTransaction } from '../database/transaction';
import { ClassGroup } from '../entity/ClassGroup';
import { SchoolConfig } from '../entity/SchoolConfig';
import type {
  GeneralSchoolConfigUpdate,
  GradeCategory,
  PeriodStructureUpdate,
  SchoolConfigDto,
  SchoolWeekDay,
} from '../types/schoolConfig.types';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';

export class ConfigRevisionConflictError extends Error {
  readonly code = 'CONFIG_REVISION_CONFLICT';

  constructor(
    readonly expectedRevision: number,
    readonly actualRevision: number
  ) {
    super(`School configuration changed from revision ${expectedRevision} to ${actualRevision}`);
  }
}

export class GradeBandInUseError extends Error {
  readonly code = 'GRADE_BAND_IN_USE';

  constructor(
    readonly band: 'primary' | 'middle' | 'high',
    readonly classCount: number,
    readonly sampleClasses: Array<{ id: number; name: string; grade: number | null }>
  ) {
    super(`Cannot disable ${band}; ${classCount} active class(es) still use that grade band`);
  }
}

const GRADE_BANDS = {
  primary: { field: 'enablePrimary', range: [1, 6] },
  middle: { field: 'enableMiddle', range: [7, 9] },
  high: { field: 'enableHigh', range: [10, 12] },
} as const;

export class SchoolConfigService {
  private readonly repository: SchoolConfigRepository;
  private readonly cacheManager: CacheManager;

  private constructor(
    private readonly dataSource: DataSource,
    cacheManager?: CacheManager
  ) {
    this.cacheManager = cacheManager ?? CacheManager.getInstance();
    this.repository = SchoolConfigRepository.getInstance(dataSource, this.cacheManager);
  }

  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SchoolConfigService {
    return getDataSourceScopedInstance(
      dataSource,
      SchoolConfigService,
      () => new SchoolConfigService(dataSource, cacheManager)
    );
  }

  static resetInstance(): void {
    clearDataSourceScopedInstances(SchoolConfigService);
  }

  async getConfig(schoolId: number | null = null): Promise<SchoolConfigDto> {
    return this.toDto(await this.repository.getOrCreate(schoolId));
  }

  async updateGeneral(input: GeneralSchoolConfigUpdate): Promise<SchoolConfigDto> {
    const schoolId = input.schoolId ?? null;
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const existing = await this.repository.getOrCreate(schoolId, { manager, skipCache: true });
      this.assertRevision(existing, input.revision);
      await this.assertGradeBandsCanBeDisabled(existing, input, manager);

      const updated = await this.repository.updateConfig(
        existing.id,
        {
          revision: existing.revision + 1,
          schoolName: input.schoolName,
          enablePrimary: input.enablePrimary,
          enableMiddle: input.enableMiddle,
          enableHigh: input.enableHigh,
          daysOfWeekJson: JSON.stringify(input.daysOfWeek),
          daysPerWeek: input.daysOfWeek.length,
          schoolStartTime: input.schoolStartTime,
          timezone: input.timezone,
          ramadanModeEnabled: input.ramadanModeEnabled,
          ramadanPeriodDuration: input.ramadanPeriodDuration,
          enableMinistryValidation: input.enableMinistryValidation,
          ministryValidationMode: input.ministryValidationMode,
          customCurriculumMode: input.customCurriculumMode,
          lowResourceMode: input.lowResourceMode,
        },
        { manager, skipCache: true }
      );
      return this.toDto(updated);
    });
  }

  async updatePeriods(input: PeriodStructureUpdate): Promise<SchoolConfigDto> {
    const schoolId = input.schoolId ?? null;
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const existing = await this.repository.getOrCreate(schoolId, { manager, skipCache: true });
      this.assertRevision(existing, input.revision);

      const activeDays = existing.daysOfWeek as SchoolWeekDay[];
      const periodsPerDayMap = input.dynamicPeriodsEnabled
        ? Object.fromEntries(
            activeDays.map((day) => [
              day,
              input.periodsPerDayMap[day] ?? input.defaultPeriodsPerDay,
            ])
          )
        : {};
      const enabledCategories: GradeCategory[] = [
        ...(existing.enablePrimary ? (['Alpha-Primary', 'Beta-Primary'] as const) : []),
        ...(existing.enableMiddle ? (['Middle'] as const) : []),
        ...(existing.enableHigh ? (['High'] as const) : []),
      ];
      const categoryPeriodsMap = input.categoryPeriodsEnabled
        ? Object.fromEntries(
            enabledCategories.map((category) => [
              category,
              Object.fromEntries(
                activeDays.map((day) => [
                  day,
                  input.categoryPeriodsMap[category]?.[day] ?? input.defaultPeriodsPerDay,
                ])
              ),
            ])
          )
        : {};
      const breakPeriodsByDay = Object.fromEntries(
        activeDays.flatMap((day) =>
          Object.prototype.hasOwnProperty.call(input.breakPeriodsByDay, day)
            ? [[day, input.breakPeriodsByDay[day] ?? []]]
            : []
        )
      );

      const updated = await this.repository.updateConfig(
        existing.id,
        {
          revision: existing.revision + 1,
          periodsPerDay: input.defaultPeriodsPerDay,
          defaultPeriodsPerDay: input.defaultPeriodsPerDay,
          periodDuration: input.periodDuration,
          dynamicPeriodsEnabled: input.dynamicPeriodsEnabled,
          periodsPerDayMapJson: JSON.stringify(periodsPerDayMap),
          categoryPeriodsEnabled: input.categoryPeriodsEnabled,
          categoryPeriodsMapJson: JSON.stringify(categoryPeriodsMap),
          breakPeriods: JSON.stringify(input.breakPeriods),
          breakPeriodsByDayJson: JSON.stringify(breakPeriodsByDay),
          prayerBreaksEnabled: input.prayerBreaksEnabled,
          prayerBreaksJson: JSON.stringify(
            [...input.prayerBreaks].sort((left, right) => left.time.localeCompare(right.time))
          ),
        },
        { manager, skipCache: true }
      );
      return this.toDto(updated);
    });
  }

  toDto(config: SchoolConfig): SchoolConfigDto {
    return {
      id: config.id,
      schoolId: config.schoolId,
      revision: config.revision,
      schoolName: config.schoolName,
      enablePrimary: config.enablePrimary,
      enableMiddle: config.enableMiddle,
      enableHigh: config.enableHigh,
      daysOfWeek: config.daysOfWeek as SchoolWeekDay[],
      daysPerWeek: config.daysOfWeek.length,
      schoolStartTime: config.schoolStartTime,
      timezone: config.timezone,
      ramadanModeEnabled: config.ramadanModeEnabled,
      ramadanPeriodDuration: config.ramadanPeriodDuration,
      enableMinistryValidation: config.enableMinistryValidation,
      ministryValidationMode:
        config.ministryValidationMode as SchoolConfigDto['ministryValidationMode'],
      customCurriculumMode: config.customCurriculumMode,
      autoPopulateCurriculum: config.autoPopulateCurriculum,
      lowResourceMode: config.lowResourceMode,
      defaultPeriodsPerDay: config.defaultPeriodsPerDay,
      periodDuration: config.periodDuration,
      dynamicPeriodsEnabled: config.dynamicPeriodsEnabled,
      periodsPerDayMap: config.periodsPerDayMap ?? {},
      categoryPeriodsEnabled: config.categoryPeriodsEnabled,
      categoryPeriodsMap: config.categoryPeriodsMap ?? {},
      breakPeriods: this.parseArray(config.breakPeriods),
      breakPeriodsByDay: config.breakPeriodsByDay ?? {},
      prayerBreaksEnabled: config.prayerBreaksEnabled,
      prayerBreaks: config.prayerBreaks ?? [],
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
  }

  private assertRevision(config: SchoolConfig, expectedRevision: number): void {
    if (config.revision !== expectedRevision) {
      throw new ConfigRevisionConflictError(expectedRevision, config.revision);
    }
  }

  private async assertGradeBandsCanBeDisabled(
    existing: SchoolConfig,
    input: GeneralSchoolConfigUpdate,
    manager: EntityManager
  ): Promise<void> {
    const repository = manager.getRepository(ClassGroup);

    for (const [band, definition] of Object.entries(GRADE_BANDS) as Array<
      [keyof typeof GRADE_BANDS, (typeof GRADE_BANDS)[keyof typeof GRADE_BANDS]]
    >) {
      if (!existing[definition.field] || input[definition.field]) continue;

      const [minimum, maximum] = definition.range;
      const where: FindOptionsWhere<ClassGroup> = {
        schoolId: existing.schoolId === null ? IsNull() : existing.schoolId,
        grade: Between(minimum, maximum),
        isDeleted: false,
      };
      const [classCount, sample] = await Promise.all([
        repository.count({ where }),
        repository.find({
          where,
          select: { id: true, name: true, grade: true },
          order: { grade: 'ASC', name: 'ASC' },
          take: 5,
        }),
      ]);
      if (classCount > 0) {
        throw new GradeBandInUseError(
          band,
          classCount,
          sample.map(({ id, name, grade }) => ({ id, name, grade }))
        );
      }
    }
  }

  private parseArray<T>(value: string | null): T[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
