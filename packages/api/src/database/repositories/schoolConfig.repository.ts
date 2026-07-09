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

import { DataSource, EntityTarget } from 'typeorm';
import {
  BreakPeriodConfig,
  BreakPeriodsByDayConfig,
  PrayerBreakConfig,
  SchoolConfig,
  ShiftConfig,
} from '../../entity/SchoolConfig';
import { logger } from '../../utils/logger';
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
  // Ramadan settings
  ramadanModeEnabled: boolean;
  ramadanPeriodDuration: number;
  ramadanBreakConfig: BreakPeriodConfig[] | null;

  // Ministry validation settings
  enableMinistryValidation: boolean;
  ministryValidationMode: string;
  customCurriculumMode: boolean;

  // Resource settings
  lowResourceMode: boolean;

  // Day configuration
  daysOfWeek: string[];
  periodsPerDayMap: Record<string, number> | null;
  defaultPeriodsPerDay: number;

  // School settings (Requirements: 5.1)
  schoolStartTime: string;
  timezone: string;
  shiftMode: string;
  shiftsConfig: ShiftConfig | null;

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
  // Ramadan settings
  ramadanModeEnabled: false,
  ramadanPeriodDuration: 35,
  ramadanBreakConfigJson: null,

  // Ministry validation settings
  enableMinistryValidation: false,
  ministryValidationMode: 'warn',
  customCurriculumMode: false,

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
  periodsPerDayMapJson: null,
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
  categoryPeriodsMapJson: null,
  breakPeriodsByDayJson: null,
  prayerBreaksJson: null,
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

    deduped.set(breakConfig.afterPeriod, breakConfig.duration);
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

  private static instance: SchoolConfigRepository | null = null;

  constructor(dataSource: DataSource, cacheManager: CacheManager) {
    super(dataSource, cacheManager);
  }

  /**
   * Get singleton instance of SchoolConfigRepository
   * @param dataSource - TypeORM DataSource
   * @param cacheManager - CacheManager instance
   */
  static getInstance(dataSource: DataSource, cacheManager?: CacheManager): SchoolConfigRepository {
    if (!SchoolConfigRepository.instance) {
      const cache = cacheManager ?? CacheManager.getInstance();
      SchoolConfigRepository.instance = new SchoolConfigRepository(dataSource, cache);
    }
    return SchoolConfigRepository.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    SchoolConfigRepository.instance = null;
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
    if (!options?.skipCache) {
      const cached = this.cacheManager.get<SchoolConfig>(this.cachePrefix, cacheKey);
      if (cached !== undefined) {
        logger.debug('Retrieved school config from cache', { schoolId });
        return cached;
      }
    }

    const repo = this.getRepository(options?.manager);

    // Try to find existing config
    let config = await repo.findOne({
      where: { schoolId: schoolId as any },
    });

    if (!config) {
      // Create new config with defaults
      logger.info('Creating new school config with defaults', { schoolId });
      config = repo.create({
        schoolId,
        ...DEFAULT_SCHOOL_CONFIG,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      config = await repo.save(config);
    }

    // Cache the result
    if (!options?.skipCache) {
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

    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.breakPeriods !== undefined) {
      normalizedUpdates.breakPeriods = JSON.stringify(
        normalizeBreakPeriods(parseBreakPeriods(normalizedUpdates.breakPeriods))
      ) as unknown as string;
    }

    if ((normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDay?: unknown }).breakPeriodsByDay !== undefined) {
      const breakPeriodsByDay = parseBreakPeriodsByDay(
        (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDay?: unknown }).breakPeriodsByDay
      );
      (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDay?: unknown }).breakPeriodsByDay =
        breakPeriodsByDay;
    }

    if ((normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDayJson?: unknown }).breakPeriodsByDayJson !== undefined) {
      const breakPeriodsByDay = parseBreakPeriodsByDay(
        (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDayJson?: unknown }).breakPeriodsByDayJson
      );
      (normalizedUpdates as Partial<SchoolConfig> & { breakPeriodsByDayJson?: unknown }).breakPeriodsByDayJson =
        breakPeriodsByDay ? JSON.stringify(breakPeriodsByDay) : null;
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
        : null;

    const validationErrors = this.validateConfig(merged);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid school config: ${validationErrors.join('; ')}`);
    }

    const saved = await repo.save(merged);

    // Invalidate cache
    if (!options?.skipCache) {
      const cacheKey = this.getSchoolCacheKey(existing.schoolId);
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
    return {
      // Ramadan settings
      ramadanModeEnabled: config.ramadanModeEnabled,
      ramadanPeriodDuration: config.ramadanPeriodDuration,
      ramadanBreakConfig: config.ramadanBreakConfig,

      // Ministry validation settings
      enableMinistryValidation: config.enableMinistryValidation,
      ministryValidationMode: config.ministryValidationMode,
      customCurriculumMode: config.customCurriculumMode,

      // Resource settings
      lowResourceMode: config.lowResourceMode,

      // Day configuration
      daysOfWeek: config.daysOfWeek,
      periodsPerDayMap: config.periodsPerDayMap,
      defaultPeriodsPerDay: config.defaultPeriodsPerDay,

      // School settings (Requirements: 5.1)
      schoolStartTime: config.schoolStartTime,
      timezone: config.timezone,
      shiftMode: config.shiftMode,
      shiftsConfig: config.shiftsConfig,

      // Period structure settings (Requirements: 5.2, 5.6)
      periodDuration: config.periodDuration,
      dynamicPeriodsEnabled: config.dynamicPeriodsEnabled,
      categoryPeriodsEnabled: config.categoryPeriodsEnabled,
      categoryPeriodsMap: config.categoryPeriodsMap,
      breakPeriods: normalizeBreakPeriods(parseBreakPeriods(config.breakPeriods)),
      breakPeriodsByDay: this.sanitizeBreakPeriodsByDay(config),
      prayerBreaks: config.prayerBreaks,
    };
  }

  private getEffectivePeriodsForDay(config: SchoolConfig, day: string): number {
    if (config.categoryPeriodsEnabled && config.categoryPeriodsMap) {
      let maxPeriods = 0;
      for (const dayMap of Object.values(config.categoryPeriodsMap)) {
        const periods = dayMap?.[day];
        if (typeof periods === 'number' && periods > maxPeriods) {
          maxPeriods = periods;
        }
      }

      if (maxPeriods > 0) {
        return maxPeriods;
      }
    }

    if (config.dynamicPeriodsEnabled && config.periodsPerDayMap?.[day] !== undefined) {
      return config.periodsPerDayMap[day];
    }

    return config.defaultPeriodsPerDay;
  }

  private getSharedBreakMaxPeriods(config: SchoolConfig): number {
    return config.daysOfWeek.reduce((maxPeriods, day) => {
      return Math.max(maxPeriods, this.getEffectivePeriodsForDay(config, day));
    }, config.defaultPeriodsPerDay);
  }

  private sanitizeBreakPeriodsByDay(config: SchoolConfig): BreakPeriodsByDayConfig {
    const rawBreaksByDay = parseBreakPeriodsByDay(config.breakPeriodsByDay ?? config.breakPeriodsByDayJson);
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

    // Validate ministryValidationMode
    const validModes = ['warn', 'strict', 'off'];
    if (!validModes.includes(config.ministryValidationMode)) {
      errors.push(
        `Invalid ministryValidationMode: ${config.ministryValidationMode}. Must be one of: ${validModes.join(', ')}`
      );
    }

    // Validate ramadanPeriodDuration
    if (config.ramadanPeriodDuration < 1 || config.ramadanPeriodDuration > 120) {
      errors.push(
        `Invalid ramadanPeriodDuration: ${config.ramadanPeriodDuration}. Must be between 1 and 120 minutes`
      );
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

    // Validate shiftMode
    const validShiftModes = ['single', 'multi'];
    if (!validShiftModes.includes(config.shiftMode)) {
      errors.push(
        `Invalid shiftMode: ${config.shiftMode}. Must be one of: ${validShiftModes.join(', ')}`
      );
    }

    // Validate shiftsConfig if multi-shift mode is enabled
    if (config.shiftMode === 'multi') {
      const shiftsConfig = config.shiftsConfig;
      if (!shiftsConfig) {
        errors.push('shiftsConfig is required when shiftMode is "multi"');
      } else {
        // Validate morning shift times
        if (!shiftsConfig.morning || !timeRegex.test(shiftsConfig.morning.start)) {
          errors.push('Invalid morning shift start time');
        }
        if (!shiftsConfig.morning || !timeRegex.test(shiftsConfig.morning.end)) {
          errors.push('Invalid morning shift end time');
        }
        // Validate afternoon shift times
        if (!shiftsConfig.afternoon || !timeRegex.test(shiftsConfig.afternoon.start)) {
          errors.push('Invalid afternoon shift start time');
        }
        if (!shiftsConfig.afternoon || !timeRegex.test(shiftsConfig.afternoon.end)) {
          errors.push('Invalid afternoon shift end time');
        }
      }
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
      if (!Number.isInteger(breakConfig.duration) || breakConfig.duration < 5 || breakConfig.duration > 60) {
        errors.push(`Shared break duration ${breakConfig.duration} must be between 5 and 60 minutes`);
      }
    }

    const breakPeriodsByDay = parseBreakPeriodsByDay(config.breakPeriodsByDay ?? config.breakPeriodsByDayJson);
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
            errors.push(`Invalid breakPeriodsByDay[${day}] afterPeriod: ${breakConfig.afterPeriod}`);
          }
          if (breakConfig.afterPeriod >= dayMaxPeriods) {
            errors.push(
              `breakPeriodsByDay[${day}] afterPeriod ${breakConfig.afterPeriod} must be less than ${dayMaxPeriods}`
            );
          }
          if (!Number.isInteger(breakConfig.duration) || breakConfig.duration < 5 || breakConfig.duration > 60) {
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
    }

    return errors;
  }

  /**
   * Get config with validation
   * Requirements: 7.2, 7.4
   *
   * @param schoolId - School ID (null for default/singleton)
   * @param options - Repository options
   * @returns Object with config and validation errors
   */
  async getWithValidation(
    schoolId: number | null = null,
    options?: RepositoryOptions
  ): Promise<{ config: SchoolConfig; errors: string[] }> {
    const config = await this.getOrCreate(schoolId, options);
    const errors = this.validateConfig(config);
    return { config, errors };
  }
}
