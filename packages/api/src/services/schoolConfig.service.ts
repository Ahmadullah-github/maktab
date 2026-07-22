import { Between, DataSource, EntityManager, FindOptionsWhere, IsNull } from 'typeorm';
import { CacheManager } from '../database/cache/cacheManager';
import { SchoolConfigRepository } from '../database/repositories/schoolConfig.repository';
import { TimetableRepository } from '../database/repositories/timetable.repository';
import { runCommittedTransaction } from '../database/transaction';
import { ClassGroup } from '../entity/ClassGroup';
import { Room } from '../entity/Room';
import { SchoolConfig, type BreakPeriodConfig } from '../entity/SchoolConfig';
import { Teacher } from '../entity/Teacher';
import { normalizeUnavailableSlots } from '../utils/teacherContracts';
import {
  DEFAULT_OPTIMIZATION_PREFERENCES,
  optimizationPreferencesSchema,
  type OptimizationPreferencesInput,
} from '../schemas/config.schema';
import {
  readStoredSchoolConfig,
  SchoolConfigCorruptError,
  schoolConfigDtoSchema,
} from '../schemas/schoolConfigStorage.schema';
import type {
  GeneralSchoolConfigUpdate,
  GradeCategory,
  PeriodStructureUpdate,
  OptimizationPreferencesDto,
  OptimizationPreferencesUpdate,
  SchoolConfigDto,
  SchoolWeekDay,
} from '../types/schoolConfig.types';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../utils/dataSourceScope';
import {
  buildCanonicalPeriodConfiguration,
  getEnabledGradeCategories,
} from '../utils/periodConfiguration';

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

export interface AvailabilityBoundsConflict {
  resourceType: 'teacher' | 'room';
  resourceId: number;
  resourceName: string;
  day: string;
  period: number;
}

export class AvailabilityOutOfBoundsError extends Error {
  readonly code = 'AVAILABILITY_OUT_OF_BOUNDS';

  constructor(readonly conflicts: AvailabilityBoundsConflict[]) {
    super(`School calendar change would invalidate ${conflicts.length} availability slot(s)`);
  }
}

const GRADE_BANDS = {
  primary: { field: 'enablePrimary', range: [1, 6] },
  middle: { field: 'enableMiddle', range: [7, 9] },
  high: { field: 'enableHigh', range: [10, 12] },
} as const;

function clampBreaksToBoundary(
  breaks: readonly BreakPeriodConfig[],
  maximumPeriods: number
): BreakPeriodConfig[] {
  const seen = new Set<number>();
  return breaks.filter((entry) => {
    if (
      !Number.isInteger(entry.afterPeriod) ||
      entry.afterPeriod < 1 ||
      entry.afterPeriod >= maximumPeriods ||
      seen.has(entry.afterPeriod)
    ) {
      return false;
    }
    seen.add(entry.afterPeriod);
    return true;
  });
}

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
      const stored = readStoredSchoolConfig(existing);

      const enabledCategories = getEnabledGradeCategories(input);
      const activeDays = input.daysOfWeek;
      const periodsPerDayMap = existing.dynamicPeriodsEnabled
        ? Object.fromEntries(
            activeDays.map((day) => [
              day,
              stored.periodsPerDayMap[day] ?? existing.defaultPeriodsPerDay,
            ])
          )
        : {};
      const categoryPeriodsMap = existing.categoryPeriodsEnabled
        ? Object.fromEntries(
            enabledCategories.map((category) => [
              category,
              Object.fromEntries(
                activeDays.map((day) => [
                  day,
                  stored.categoryPeriodsMap[category]?.[day] ?? existing.defaultPeriodsPerDay,
                ])
              ),
            ])
          )
        : {};
      const canonicalPeriods = buildCanonicalPeriodConfiguration({
        ...input,
        defaultPeriodsPerDay: existing.defaultPeriodsPerDay,
        dynamicPeriodsEnabled: existing.dynamicPeriodsEnabled,
        periodsPerDayMap,
        categoryPeriodsEnabled: existing.categoryPeriodsEnabled,
        categoryPeriodsMap,
      });
      const maximumSharedPeriods = Math.max(...Object.values(canonicalPeriods.periodsPerDayMap));
      await this.assertAvailabilityFitsCalendar(
        schoolId,
        input.daysOfWeek,
        canonicalPeriods.periodsPerDayMap,
        manager
      );
      const breakPeriods = clampBreaksToBoundary(stored.breakPeriods, maximumSharedPeriods);
      const breakPeriodsByDay = Object.fromEntries(
        activeDays.flatMap((day) =>
          Object.prototype.hasOwnProperty.call(stored.breakPeriodsByDay, day)
            ? [
                [
                  day,
                  clampBreaksToBoundary(
                    stored.breakPeriodsByDay[day] ?? [],
                    canonicalPeriods.periodsPerDayMap[day]
                  ),
                ],
              ]
            : []
        )
      );

      const updated = await this.repository.updateConfig(
        existing.id,
        {
          revision: existing.revision + 1,
          ...(input.schoolName !== undefined ? { schoolName: input.schoolName } : {}),
          enablePrimary: input.enablePrimary,
          enableMiddle: input.enableMiddle,
          enableHigh: input.enableHigh,
          daysOfWeekJson: JSON.stringify(input.daysOfWeek),
          daysPerWeek: input.daysOfWeek.length,
          periodsPerDayMapJson: JSON.stringify(periodsPerDayMap),
          categoryPeriodsMapJson: JSON.stringify(categoryPeriodsMap),
          breakPeriods: JSON.stringify(breakPeriods),
          breakPeriodsByDayJson: JSON.stringify(breakPeriodsByDay),
          schoolStartTime: input.schoolStartTime,
          timezone: input.timezone,
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
      const enabledCategories: GradeCategory[] = getEnabledGradeCategories(existing);
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
      const canonicalPeriods = buildCanonicalPeriodConfiguration({
        ...existing,
        daysOfWeek: activeDays,
        defaultPeriodsPerDay: input.defaultPeriodsPerDay,
        dynamicPeriodsEnabled: input.dynamicPeriodsEnabled,
        periodsPerDayMap,
        categoryPeriodsEnabled: input.categoryPeriodsEnabled,
        categoryPeriodsMap,
      });
      await this.assertAvailabilityFitsCalendar(
        schoolId,
        activeDays,
        canonicalPeriods.periodsPerDayMap,
        manager
      );
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
            input.prayerBreaksEnabled
              ? [...input.prayerBreaks].sort((left, right) => left.time.localeCompare(right.time))
              : []
          ),
        },
        { manager, skipCache: true }
      );
      return this.toDto(updated);
    });
  }

  async getOptimizationPreferences(
    schoolId: number | null = null
  ): Promise<OptimizationPreferencesDto> {
    const config = await this.repository.getOrCreate(schoolId);
    return {
      schoolId: config.schoolId,
      revision: config.revision,
      preferences: this.readOptimizationPreferences(config),
    };
  }

  async updateOptimizationPreferences(
    input: OptimizationPreferencesUpdate
  ): Promise<OptimizationPreferencesDto> {
    const schoolId = input.schoolId ?? null;
    return runCommittedTransaction(this.dataSource, this.cacheManager, async (manager) => {
      const existing = await this.repository.getOrCreate(schoolId, { manager, skipCache: true });
      this.assertRevision(existing, input.revision);
      const current = this.readOptimizationPreferences(existing);
      const next = optimizationPreferencesSchema.parse(input.preferences);

      if (JSON.stringify(current) === JSON.stringify(next)) {
        return { schoolId: existing.schoolId, revision: existing.revision, preferences: current };
      }

      const updated = await this.repository.updateConfig(
        existing.id,
        {
          revision: existing.revision + 1,
          optimizationPreferencesJson: JSON.stringify(next),
        },
        { manager, skipCache: true }
      );
      await TimetableRepository.getInstance(this.dataSource, this.cacheManager).markStaleForSchool(
        schoolId,
        'OPTIMIZATION_PREFERENCES_CHANGED',
        { manager, skipCache: true }
      );
      return {
        schoolId: updated.schoolId,
        revision: updated.revision,
        preferences: next,
      };
    });
  }

  toDto(config: SchoolConfig): SchoolConfigDto {
    const stored = readStoredSchoolConfig(config);
    const dto = {
      id: config.id,
      schoolId: config.schoolId,
      revision: config.revision,
      schoolName: config.schoolName,
      enablePrimary: config.enablePrimary,
      enableMiddle: config.enableMiddle,
      enableHigh: config.enableHigh,
      daysOfWeek: stored.daysOfWeek,
      daysPerWeek: stored.daysOfWeek.length,
      schoolStartTime: config.schoolStartTime,
      timezone: config.timezone,
      autoPopulateCurriculum: config.autoPopulateCurriculum,
      lowResourceMode: config.lowResourceMode,
      defaultPeriodsPerDay: config.defaultPeriodsPerDay,
      periodDuration: config.periodDuration,
      dynamicPeriodsEnabled: config.dynamicPeriodsEnabled,
      periodsPerDayMap: stored.periodsPerDayMap,
      categoryPeriodsEnabled: config.categoryPeriodsEnabled,
      categoryPeriodsMap: stored.categoryPeriodsMap,
      breakPeriods: stored.breakPeriods,
      breakPeriodsByDay: stored.breakPeriodsByDay,
      prayerBreaksEnabled: config.prayerBreaksEnabled,
      prayerBreaks: config.prayerBreaksEnabled ? stored.prayerBreaks : [],
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };
    return schoolConfigDtoSchema.parse(dto) as SchoolConfigDto;
  }

  private assertRevision(config: SchoolConfig, expectedRevision: number): void {
    if (config.revision !== expectedRevision) {
      throw new ConfigRevisionConflictError(expectedRevision, config.revision);
    }
  }

  private readOptimizationPreferences(config: SchoolConfig): OptimizationPreferencesInput {
    if (!config.optimizationPreferencesJson) {
      return { ...DEFAULT_OPTIMIZATION_PREFERENCES };
    }
    try {
      return optimizationPreferencesSchema.parse(JSON.parse(config.optimizationPreferencesJson));
    } catch (error) {
      throw new SchoolConfigCorruptError(
        config.id,
        'optimizationPreferencesJson',
        error instanceof Error ? error.message : String(error)
      );
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

  private async assertAvailabilityFitsCalendar(
    schoolId: number | null,
    daysOfWeek: readonly string[],
    periodsPerDayMap: Record<string, number>,
    manager: EntityManager
  ): Promise<void> {
    const schoolWhere = schoolId === null ? IsNull() : schoolId;
    const [teachers, rooms] = await Promise.all([
      manager.getRepository(Teacher).find({
        where: { schoolId: schoolWhere, isDeleted: false },
        select: { id: true, fullName: true, unavailable: true },
      }),
      manager.getRepository(Room).find({
        where: { schoolId: schoolWhere, isDeleted: false },
        select: { id: true, name: true, unavailable: true },
      }),
    ]);
    const activeDays = new Map(daysOfWeek.map((day) => [day.toLowerCase(), day]));
    const conflicts: AvailabilityBoundsConflict[] = [];

    const collect = (
      resourceType: AvailabilityBoundsConflict['resourceType'],
      resourceId: number,
      resourceName: string,
      raw: string | null
    ) => {
      let parsed: unknown[] = [];
      try {
        const value: unknown = JSON.parse(raw || '[]');
        if (Array.isArray(value)) parsed = value;
      } catch {
        return;
      }
      for (const slot of normalizeUnavailableSlots(parsed)) {
        const canonicalDay = activeDays.get(slot.day.toLowerCase());
        if (!canonicalDay || slot.period >= (periodsPerDayMap[canonicalDay] ?? 0)) {
          conflicts.push({
            resourceType,
            resourceId,
            resourceName,
            day: slot.day,
            period: slot.period,
          });
        }
      }
    };

    teachers.forEach((teacher) =>
      collect('teacher', teacher.id, teacher.fullName, teacher.unavailable)
    );
    rooms.forEach((room) => collect('room', room.id, room.name, room.unavailable));

    if (conflicts.length > 0) throw new AvailabilityOutOfBoundsError(conflicts);
  }
}
