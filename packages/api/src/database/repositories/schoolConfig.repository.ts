/**
 * SchoolConfig Repository for Afghanistan-specific configuration data access operations
 * @module database/repositories/schoolConfig
 *
 * Requirements: 5.1, 5.2, 5.6, 7.1, 7.2, 7.3
 * - getOrCreate(schoolId) method that returns existing config or creates with defaults
 * - update(id, updates) method for partial updates
 * - getForSolver(schoolId) method that returns config in solver-compatible format
 * - Support for new school settings and period structure fields
 */

import { DataSource, EntityTarget, FindOptionsWhere, IsNull } from 'typeorm';
import {
  BreakPeriodConfig,
  BreakPeriodsByDayConfig,
  PrayerBreakConfig,
  SchoolConfig,
} from '../../entity/SchoolConfig';
import { logger } from '../../utils/logger';
import { readStoredSchoolConfig } from '../../schemas/schoolConfigStorage.schema';
import {
  clearDataSourceScopedInstances,
  getDataSourceScopedInstance,
} from '../../utils/dataSourceScope';
import { buildCanonicalPeriodConfiguration } from '../../utils/periodConfiguration';
import { CacheManager } from '../cache/cacheManager';
import { BaseRepository, RepositoryOptions } from './base.repository';

/**
 * Solver-compatible configuration input format
 * This format is passed to the Python solver
 *
 * Requirements: 5.2, 5.6
 * - Includes new period configuration fields for solver
 */
export interface SolverConfigInput {
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;

  // Resource settings
  lowResourceMode: boolean;

  // Day configuration
  daysOfWeek: string[];
  periodsPerDayMap: Record<string, number> | null;
  defaultPeriodsPerDay: number;

  // School settings (Requirements: 5.1)
  schoolStartTime: string;
  timezone: string;

  // Period structure settings (Requirements: 5.2, 5.6)
  periodDuration: number;
  dynamicPeriodsEnabled: boolean;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap: Record<string, Record<string, number>> | null;
  breakPeriods: BreakPeriodConfig[];
  breakPeriodsByDay: BreakPeriodsByDayConfig | null;
  prayerBreaks: PrayerBreakConfig[] | null;
}

/**
 * Default Afghan school configuration values
 * Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.6
 * - Includes defaults for new school settings and period structure fields
 */
export const DEFAULT_SCHOOL_CONFIG = {
  revision: 1,
  // Resource settings
  lowResourceMode: false,

  // Day configuration
  daysOfWeekJson: JSON.stringify([
    'Saturday',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
  ]),
  periodsPerDayMapJson: '{}',
  defaultPeriodsPerDay: 7,

  // School settings (Requirements: 5.1)
  schoolStartTime: '07:30',
  timezone: 'Asia/Kabul',
  shiftMode: 'single',
  shiftsConfigJson: null,

  // Period structure settings (Requirements: 5.2, 5.6)
  periodDuration: 45,
  dynamicPeriodsEnabled: false,
  categoryPeriodsEnabled: false,
  categoryPeriodsMapJson: '{}',
  breakPeriodsByDayJson: '{}',
  prayerBreaksJson: '[]',
  prayerBreaksEnabled: false,
};

const VALID_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

function parseBreakPeriods(value: unknown): BreakPeriodConfig[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value as BreakPeriodConfig[];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as BreakPeriodConfig[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function parseBreakPeriodsByDay(value: unknown): BreakPeriodsByDayConfig | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as BreakPeriodsByDayConfig)
        : null;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as BreakPeriodsByDayConfig;
  }

  return null;
}

function normalizeBreakPeriods(breaks: BreakPeriodConfig[]): BreakPeriodConfig[] {
  const deduped = new Map<number, number>();

  for (const breakConfig of breaks) {
    if (!breakConfig || typeof breakConfig.afterPeriod !== 'number') {
      continue;
    }

    if (typeof breakConfig.duration !== 'number' || breakConfig.duration <= 0) {
      continue;
    }

    if (!deduped.has(breakConfig.afterPeriod)) {
      deduped.set(breakConfig.afterPeriod, breakConfig.duration);
    }
  }

  return Array.from(deduped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([afterPeriod, duration]) => ({ afterPeriod, duration }));
}

/**
 * SchoolConfig Repository
 *
 * Handles SchoolConfig database operations with:
 * - Singleton pattern per schoolId
 * - Solver-compatible format conversion
 * - Caching via CacheManager
 */
export class SchoolConfigRepository extends BaseRepository<SchoolConfig> {
  protected readonly entityClass: EntityTarget<SchoolConfig> = SchoolConfig;
  protected readonly cachePrefix: string = 'schoolConfig';

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of SchoolConfigRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SchoolConfigRepository {
    return getDataSourceScopedInstance(
      dataSource,
      SchoolConfigRepository,
      () => new SchoolConfigRepository(dataSource, cacheManager ?? CacheManager.getInstance())
    );
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    clearDataSourceScopedInstances(SchoolConfigRepository);
  }

  /**
   * Generate cache key for a school config
   * @param schoolId - School ID (null for default/singleton)
   */
  private getSchoolCacheKey(schoolId: number | null): string {
    return `schoolConfig:${schoolId ?? 'default'}`;
  }

  // =========================================================================
  // Core Operations (Requirements: 7.1, 7.2, 7.3)
  // =========================================================================

  /**
   * Get existing config or create with defaults
   * Requirements: 7.1, 7.3
   *
   * @param schoolId - School ID (null for default/singleton)
   * @param options - Repository options
   * @returns SchoolConfig entity
   */
  async getOrCreate(
    schoolId: number | null = null,
    options?: RepositoryOptions
  ): Promise<SchoolConfig> {
    const cacheKey = this.getSchoolCacheKey(schoolId);

    // Check cache first
    if (this.shouldUseCache(options)) {
      const cached = this.cacheManager.get<SchoolConfig>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        readStoredSchoolConfig(cached);
        logger.debug('Retrieved school config from cache', { schoolId });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);

    // Try to find existing config
    const where = {
      schoolId: schoolId === null ? IsNull() : schoolId,
    } as FindOptionsWhere<SchoolConfig>;
    let config = await repo.findOne({ where });

    if (!config) {
      // Create new config with defaults
      logger.info('Creating new school config with defaults', { schoolId });
      config = repo.create({
        schoolId,
        ...DEFAULT_SCHOOL_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      try {
        config = await repo.save(config);
      } catch (error) {
        // The database unique index arbitrates concurrent get-or-create requests.
        const concurrentlyCreated = await repo.findOne({ where });
        if (!concurrentlyCreated) throw error;
        config = concurrentlyCreated;
      }
    }

    readStoredSchoolConfig(config);

    // Cache the result
    if (this.shouldUseCache(options)) {
      this.cacheManager.set(this.cachePrefix, cacheKey, config);
      logger.debug('Retrieved school config from database and cached', { schoolId });
    }

    return config;
  }

  /**
   * Update school config with partial updates
   * Requirements: 7.1
   *
   * @param id - Config ID
   * @param updates - Partial updates to apply
   * @param options - Repository options
   * @returns Updated SchoolConfig entity
   */
  async updateConfig(
    id: number,
    updates: Partial<SchoolConfig>,
    options?: RepositoryOptions
  ): Promise<SchoolConfig> {
    const repo = this.getRepository(options?.manager);

    // Find existing config
    const existing = await repo.findOne({ where: { id } });
    if (!existing) {
      throw new Error(`SchoolConfig with id ${id} not found`);
    }
    readStoredSchoolConfig(existing);

    const originalSchoolId = existing.schoolId;
    const normalizedUpdates = { ...updates };
    delete normalizedUpdates.id;
    delete normalizedUpdates.schoolId;
    delete normalizedUpdates.createdAt;
    if (normalizedUpdates.breakPeriods !== undefined) {
      normalizedUpdates.breakPeriods = JSON.stringify(
        normalizeBreakPeriods(parseBreakPeriods(normalizedUpdates.breakPeriods))
      ) as unknown as string;
    }

    if (
      (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDay?: unknown })
        .breakPeriodsByDay !== undefined
    ) {
      const breakPeriodsByDay = parseBreakPeriodsByDay(
        (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDay?: unknown })
          .breakPeriodsByDay
      );
      (
        normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDay?: unknown }
      ).breakPeriodsByDay = breakPeriodsByDay;
    }

    if (
      (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDayJson?: unknown })
        .breakPeriodsByDayJson !== undefined
    ) {
      const breakPeriodsByDay = parseBreakPeriodsByDay(
        (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDayJson?: unknown })
          .breakPeriodsByDayJson
      );
      (
        normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDayJson?: unknown }
      ).breakPeriodsByDayJson = breakPeriodsByDay ? JSON.stringify(breakPeriodsByDay) : null;
    }

    // Apply updates
    const merged = repo.merge(existing, {
      ...normalizedUpdates,
      updatedAt: new Date(),
    });

    const sanitizedBreakOverrides = this.sanitizeBreakPeriodsByDay(merged);
    merged.breakPeriodsByDayJson =
      Object.keys(sanitizedBreakOverrides).length > 0
        ? JSON.stringify(sanitizedBreakOverrides)
        : '{}';

    const validationErrors = this.validateConfig(merged);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid school config: ${validationErrors.join('; ')}`);
    }
    readStoredSchoolConfig(merged);

    const saved = await repo.save(merged);

    // Invalidate cache
    if (this.shouldUseCache(options)) {
      const cacheKey = this.getSchoolCacheKey(originalSchoolId);
      this.cacheManager.delete(this.cachePrefix, cacheKey);
      this.invalidateCache(id);
    }

    logger.info('Updated school config', { id, schoolId: existing.schoolId });
    return saved;
  }

  /**
   * Get config in solver-compatible format
   * Requirements: 7.2
   *
   * @param schoolId - School ID (null for default/singleton)
   * @param options - Repository options
   * @returns SolverConfigInput format
   */
  async getForSolver(
    schoolId: number | null = null,
    options?: RepositoryOptions
  ): Promise<SolverConfigInput> {
    const config = await this.getOrCreate(schoolId, options);
    return this.toSolverInput(config);
  }

  /**
   * Convert SchoolConfig entity to solver-compatible format
   * Requirements: 5.2, 5.6
   * @param config - SchoolConfig entity
   * @returns SolverConfigInput format
   */
  private toSolverInput(config: SchoolConfig): SolverConfigInput {
    const stored = readStoredSchoolConfig(config);
    return {
      enablePrimary: config.enablePrimary,
      enableMiddle: config.enableMiddle,
      enableHigh: config.enableHigh,

      // Resource settings
      lowResourceMode: config.lowResourceMode,

      // Day configuration
      daysOfWeek: stored.daysOfWeek,
      periodsPerDayMap: stored.periodsPerDayMap,
      defaultPeriodsPerDay: config.defaultPeriodsPerDay,

      // School settings (Requirements: 5.1)
      schoolStartTime: config.schoolStartTime,
      timezone: config.timezone,

      // Period structure settings (Requirements: 5.2, 5.6)
      periodDuration: config.periodDuration,
      dynamicPeriodsEnabled: config.dynamicPeriodsEnabled,
      categoryPeriodsEnabled: config.categoryPeriodsEnabled,
      categoryPeriodsMap: stored.categoryPeriodsMap,
      breakPeriods: stored.breakPeriods,
      breakPeriodsByDay: this.sanitizeBreakPeriodsByDay(config),
      prayerBreaks: config.prayerBreaksEnabled ? stored.prayerBreaks : [],
    };
  }

  private getEffectivePeriodsForDay(config: SchoolConfig, day: string): number {
    return buildCanonicalPeriodConfiguration({
      ...config,
      daysOfWeek: config.daysOfWeek,
      periodsPerDayMap: config.periodsPerDayMap,
      categoryPeriodsMap: config.categoryPeriodsMap,
    }).periodsPerDayMap[day];
  }

  private getSharedBreakMaxPeriods(config: SchoolConfig): number {
    const maximum = config.daysOfWeek.reduce((maxPeriods, day) => {
      return Math.max(maxPeriods, this.getEffectivePeriodsForDay(config, day));
    }, 0);
    return maximum || config.defaultPeriodsPerDay;
  }

  private sanitizeBreakPeriodsByDay(config: SchoolConfig): BreakPeriodsByDayConfig {
    const rawBreaksByDay = parseBreakPeriodsByDay(
      config.breakPeriodsByDay ?? config.breakPeriodsByDayJson
    );
    const activeDays = new Set(config.daysOfWeek);

    if (!rawBreaksByDay) {
      return {};
    }

    const sanitized: BreakPeriodsByDayConfig = {};
    for (const [day, breaks] of Object.entries(rawBreaksByDay)) {
      if (!activeDays.has(day)) {
        continue;
      }

      sanitized[day] = normalizeBreakPeriods(Array.isArray(breaks) ? breaks : []);
    }

    return sanitized;
  }

  // =========================================================================
  // Validation (Requirements: 5.1, 5.2, 7.4)
  // =========================================================================

  /**
   * Validate that all required fields have valid values
   * Requirements: 5.1, 5.2, 7.4
   *
   * @param config - SchoolConfig to validate
   * @returns Array of validation error messages (empty if valid)
   */
  validateConfig(config: SchoolConfig): string[] {
    const errors: string[] = [];

    if (!Number.isInteger(config.revision) || config.revision < 1) {
      errors.push(`Invalid revision: ${config.revision}. Must be a positive integer`);
    }

    if (!config.enablePrimary && !config.enableMiddle && !config.enableHigh) {
      errors.push('At least one grade band must remain enabled');
    }

    // Validate defaultPeriodsPerDay
    if (config.defaultPeriodsPerDay < 1 || config.defaultPeriodsPerDay > 12) {
      errors.push(
        `Invalid defaultPeriodsPerDay: ${config.defaultPeriodsPerDay}. Must be between 1 and 12`
      );
    }

    // Validate daysOfWeek
    const daysOfWeek = config.daysOfWeek;
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      errors.push('daysOfWeek must be a non-empty array');
    } else {
      for (const day of daysOfWeek) {
        if (!VALID_DAYS.includes(day as (typeof VALID_DAYS)[number])) {
          errors.push(
            `Invalid day in daysOfWeek: ${day}. Must be one of: ${VALID_DAYS.join(', ')}`
          );
        }
      }
    }

    // Validate periodsPerDayMap if provided
    const periodsPerDayMap = config.periodsPerDayMap;
    if (periodsPerDayMap !== null) {
      for (const [day, periods] of Object.entries(periodsPerDayMap)) {
        if (!VALID_DAYS.includes(day as (typeof VALID_DAYS)[number])) {
          errors.push(`Invalid day in periodsPerDayMap: ${day}`);
        }
        if (typeof periods !== 'number' || periods < 1 || periods > 12) {
          errors.push(`Invalid periods for ${day}: ${periods}. Must be between 1 and 12`);
        }
      }
    }

    // Validate schoolStartTime format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(config.schoolStartTime)) {
      errors.push(
        `Invalid schoolStartTime: ${config.schoolStartTime}. Must be in HH:mm format (e.g., 07:30)`
      );
    }

    // Validate timezone
    if (!config.timezone || config.timezone.trim() === '') {
      errors.push('timezone is required');
    }
    const validTimezones = ['Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'Asia/Karachi'];
    if (!validTimezones.includes(config.timezone)) {
      errors.push(`Invalid timezone: ${config.timezone}`);
    }

    // Validate periodDuration (Requirements: 5.2)
    if (config.periodDuration < 15 || config.periodDuration > 120) {
      errors.push(
        `Invalid periodDuration: ${config.periodDuration}. Must be between 15 and 120 minutes`
      );
    }

    // Validate categoryPeriodsMap if category-based periods is enabled
    if (config.categoryPeriodsEnabled) {
      const categoryPeriodsMap = config.categoryPeriodsMap;
      if (!categoryPeriodsMap) {
        errors.push('categoryPeriodsMap is required when categoryPeriodsEnabled is true');
      } else {
        const validCategories = ['Alpha-Primary', 'Beta-Primary', 'Middle', 'High'];
        for (const [category, dayMap] of Object.entries(categoryPeriodsMap)) {
          if (!validCategories.includes(category)) {
            errors.push(`Invalid category in categoryPeriodsMap: ${category}`);
          }
          if (dayMap && typeof dayMap === 'object') {
            for (const [day, periods] of Object.entries(dayMap)) {
              if (!VALID_DAYS.includes(day as (typeof VALID_DAYS)[number])) {
                errors.push(`Invalid day in categoryPeriodsMap[${category}]: ${day}`);
              }
              if (typeof periods !== 'number' || periods < 1 || periods > 12) {
                errors.push(
                  `Invalid periods for ${category}/${day}: ${periods}. Must be between 1 and 12`
                );
              }
            }
          }
        }
      }
    }

    const sharedBreaks = parseBreakPeriods(config.breakPeriods);
    const normalizedSharedBreaks = normalizeBreakPeriods(sharedBreaks);
    if (sharedBreaks.length !== normalizedSharedBreaks.length) {
      errors.push('breakPeriods contains duplicate or invalid entries');
    }

    const sharedMaxPeriods = this.getSharedBreakMaxPeriods(config);
    for (const breakConfig of normalizedSharedBreaks) {
      if (!Number.isInteger(breakConfig.afterPeriod) || breakConfig.afterPeriod < 1) {
        errors.push(`Invalid shared break afterPeriod: ${breakConfig.afterPeriod}`);
      }
      if (breakConfig.afterPeriod >= sharedMaxPeriods) {
        errors.push(
          `Shared break afterPeriod ${breakConfig.afterPeriod} must be less than ${sharedMaxPeriods}`
        );
      }
      if (
        !Number.isInteger(breakConfig.duration) ||
        breakConfig.duration < 5 ||
        breakConfig.duration > 60
      ) {
        errors.push(
          `Shared break duration ${breakConfig.duration} must be between 5 and 60 minutes`
        );
      }
    }

    const breakPeriodsByDay = parseBreakPeriodsByDay(
      config.breakPeriodsByDay ?? config.breakPeriodsByDayJson
    );
    if (breakPeriodsByDay) {
      const activeDays = new Set(config.daysOfWeek);
      for (const [day, breaks] of Object.entries(breakPeriodsByDay)) {
        if (!activeDays.has(day)) {
          errors.push(`Inactive day '${day}' cannot define break overrides`);
          continue;
        }

        const normalizedBreaks = normalizeBreakPeriods(Array.isArray(breaks) ? breaks : []);
        if ((Array.isArray(breaks) ? breaks.length : 0) !== normalizedBreaks.length) {
          errors.push(`breakPeriodsByDay[${day}] contains duplicate or invalid entries`);
        }

        const dayMaxPeriods = this.getEffectivePeriodsForDay(config, day);
        for (const breakConfig of normalizedBreaks) {
          if (!Number.isInteger(breakConfig.afterPeriod) || breakConfig.afterPeriod < 1) {
            errors.push(
              `Invalid breakPeriodsByDay[${day}] afterPeriod: ${breakConfig.afterPeriod}`
            );
          }
          if (breakConfig.afterPeriod >= dayMaxPeriods) {
            errors.push(
              `breakPeriodsByDay[${day}] afterPeriod ${breakConfig.afterPeriod} must be less than ${dayMaxPeriods}`
            );
          }
          if (
            !Number.isInteger(breakConfig.duration) ||
            breakConfig.duration < 5 ||
            breakConfig.duration > 60
          ) {
            errors.push(
              `breakPeriodsByDay[${day}] duration ${breakConfig.duration} must be between 5 and 60 minutes`
            );
          }
        }
      }
    }

    // Validate prayerBreaks if provided
    const prayerBreaks = config.prayerBreaks;
    if (prayerBreaks !== null && Array.isArray(prayerBreaks)) {
      for (let i = 0; i < prayerBreaks.length; i++) {
        const pb = prayerBreaks[i];
        if (!pb.name || pb.name.trim() === '') {
          errors.push(`Prayer break ${i + 1}: name is required`);
        }
        if (!timeRegex.test(pb.time)) {
          errors.push(`Prayer break ${i + 1}: invalid time format. Must be HH:mm`);
        }
        if (typeof pb.duration !== 'number' || pb.duration < 5 || pb.duration > 60) {
          errors.push(`Prayer break ${i + 1}: duration must be between 5 and 60 minutes`);
        }
      }

      const sorted = prayerBreaks
        .map((prayerBreak) => ({
          prayerBreak,
          start: this.timeToMinutes(prayerBreak.time),
          end: this.timeToMinutes(prayerBreak.time) + prayerBreak.duration,
        }))
        .sort((left, right) => left.start - right.start);
      for (let index = 1; index < sorted.length; index += 1) {
        if (sorted[index].start < sorted[index - 1].end) {
          errors.push(
            `Prayer breaks "${sorted[index - 1].prayerBreak.name}" and "${sorted[index].prayerBreak.name}" overlap`
          );
        }
      }
    }

    return errors;
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
