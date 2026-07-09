/**
 * Property-based tests for SchoolConfig Repository
 * 
 * **Feature: solver-afghanistan-features, Property 2: Configuration Persistence**
 * **Validates: Requirements 1.4, 4.5, 5.3, 7.1**
 * 
 * For any configuration change (Ramadan settings, low-resource mode, day configuration,
 * or any SchoolConfig field), saving the configuration SHALL persist all values to the
 * database AND loading SHALL restore the exact same values.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { SchoolConfig } from '../../../entity/SchoolConfig';
import { SchoolConfigRepository } from '../schoolConfig.repository';
import { CacheManager } from '../../cache/cacheManager';

// In-memory SQLite database for testing
let dataSource: DataSource;
let schoolConfigRepository: SchoolConfigRepository;
let cacheManager: CacheManager;

/**
 * Generate valid days of week array
 */
const validDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const daysOfWeekArbitrary = fc.shuffledSubarray(validDays, { minLength: 1, maxLength: 7 });

/**
 * Generate valid ministry validation mode
 */
const ministryValidationModeArbitrary = fc.constantFrom('warn', 'strict', 'off');

/**
 * Generate valid break period config
 */
const breakPeriodConfigArbitrary = fc.array(
  fc.record({
    afterPeriod: fc.integer({ min: 1, max: 12 }),
    duration: fc.integer({ min: 5, max: 60 }),
  }),
  { minLength: 0, maxLength: 5 }
);

/**
 * Generate valid periods per day map
 */
const periodsPerDayMapArbitrary = fc.option(
  fc.dictionary(
    fc.constantFrom(...validDays),
    fc.integer({ min: 1, max: 12 })
  ),
  { nil: null }
);


/**
 * Generate valid SchoolConfig input for testing
 */
const schoolConfigArbitrary = fc.record({
  ramadanModeEnabled: fc.boolean(),
  ramadanPeriodDuration: fc.integer({ min: 1, max: 120 }),
  ramadanBreakConfigJson: fc.option(
    breakPeriodConfigArbitrary.map(config => JSON.stringify(config)),
    { nil: null }
  ),
  enableMinistryValidation: fc.boolean(),
  ministryValidationMode: ministryValidationModeArbitrary,
  customCurriculumMode: fc.boolean(),
  lowResourceMode: fc.boolean(),
  daysOfWeekJson: daysOfWeekArbitrary.map(days => JSON.stringify(days)),
  periodsPerDayMapJson: periodsPerDayMapArbitrary.map(map => map ? JSON.stringify(map) : null),
  defaultPeriodsPerDay: fc.integer({ min: 1, max: 12 }),
});

describe('SchoolConfig Repository Property Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [SchoolConfig],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
    cacheManager = new CacheManager();
    schoolConfigRepository = new SchoolConfigRepository(dataSource, cacheManager);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear all configs before each test
    await dataSource.getRepository(SchoolConfig).clear();
    cacheManager.clear();
    SchoolConfigRepository.resetInstance();
    schoolConfigRepository = new SchoolConfigRepository(dataSource, cacheManager);
  });

  /**
   * **Feature: solver-afghanistan-features, Property 2: Configuration Persistence**
   * **Validates: Requirements 1.4, 4.5, 5.3, 7.1**
   * 
   * For any configuration change, saving the configuration SHALL persist all values
   * to the database AND loading SHALL restore the exact same values.
   */
  it('Property 2: Configuration round-trip preserves all values', async () => {
    await fc.assert(
      fc.asyncProperty(
        schoolConfigArbitrary,
        async (configInput) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create initial config
          const created = await schoolConfigRepository.getOrCreate(null);
          
          // Update with test values
          const updated = await schoolConfigRepository.updateConfig(created.id, configInput);

          // Clear cache to force database read
          cacheManager.clear();

          // Load config from database
          const loaded = await schoolConfigRepository.getOrCreate(null);

          // Verify all fields match
          expect(loaded.ramadanModeEnabled).toBe(configInput.ramadanModeEnabled);
          expect(loaded.ramadanPeriodDuration).toBe(configInput.ramadanPeriodDuration);
          expect(loaded.ramadanBreakConfigJson).toBe(configInput.ramadanBreakConfigJson);
          expect(loaded.enableMinistryValidation).toBe(configInput.enableMinistryValidation);
          expect(loaded.ministryValidationMode).toBe(configInput.ministryValidationMode);
          expect(loaded.customCurriculumMode).toBe(configInput.customCurriculumMode);
          expect(loaded.lowResourceMode).toBe(configInput.lowResourceMode);
          expect(loaded.daysOfWeekJson).toBe(configInput.daysOfWeekJson);
          expect(loaded.periodsPerDayMapJson).toBe(configInput.periodsPerDayMapJson);
          expect(loaded.defaultPeriodsPerDay).toBe(configInput.defaultPeriodsPerDay);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 2: Configuration Persistence**
   * **Validates: Requirements 1.4, 7.1**
   * 
   * Ramadan settings should persist correctly through save/load cycle.
   */
  it('Property 2: Ramadan settings persist correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.integer({ min: 1, max: 120 }),
        breakPeriodConfigArbitrary,
        async (enabled, duration, breakConfig) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create and update config
          const created = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(created.id, {
            ramadanModeEnabled: enabled,
            ramadanPeriodDuration: duration,
            ramadanBreakConfigJson: JSON.stringify(breakConfig),
          });

          // Clear cache and reload
          cacheManager.clear();
          const loaded = await schoolConfigRepository.getOrCreate(null);

          // Verify Ramadan settings
          expect(loaded.ramadanModeEnabled).toBe(enabled);
          expect(loaded.ramadanPeriodDuration).toBe(duration);
          expect(loaded.ramadanBreakConfig).toEqual(breakConfig);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 2: Configuration Persistence**
   * **Validates: Requirements 4.5, 7.1**
   * 
   * Low-resource mode setting should persist correctly.
   */
  it('Property 2: Low-resource mode persists correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (lowResourceMode) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create and update config
          const created = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(created.id, { lowResourceMode });

          // Clear cache and reload
          cacheManager.clear();
          const loaded = await schoolConfigRepository.getOrCreate(null);

          // Verify low-resource mode
          expect(loaded.lowResourceMode).toBe(lowResourceMode);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 2: Configuration Persistence**
   * **Validates: Requirements 5.3, 7.1**
   * 
   * Day configuration should persist correctly through save/load cycle.
   */
  it('Property 2: Day configuration persists correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        daysOfWeekArbitrary,
        periodsPerDayMapArbitrary,
        fc.integer({ min: 1, max: 12 }),
        async (daysOfWeek, periodsPerDayMap, defaultPeriodsPerDay) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create and update config
          const created = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(created.id, {
            daysOfWeekJson: JSON.stringify(daysOfWeek),
            periodsPerDayMapJson: periodsPerDayMap ? JSON.stringify(periodsPerDayMap) : null,
            defaultPeriodsPerDay,
          });

          // Clear cache and reload
          cacheManager.clear();
          const loaded = await schoolConfigRepository.getOrCreate(null);

          // Verify day configuration
          expect(loaded.daysOfWeek).toEqual(daysOfWeek);
          expect(loaded.periodsPerDayMap).toEqual(periodsPerDayMap);
          expect(loaded.defaultPeriodsPerDay).toBe(defaultPeriodsPerDay);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 2: Configuration Persistence**
   * **Validates: Requirements 7.1**
   * 
   * Solver-compatible format should contain all persisted values.
   */
  it('Property 2: Solver format contains all persisted values', async () => {
    await fc.assert(
      fc.asyncProperty(
        schoolConfigArbitrary,
        async (configInput) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create and update config
          const created = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(created.id, configInput);

          // Clear cache and get solver format
          cacheManager.clear();
          const solverConfig = await schoolConfigRepository.getForSolver(null);

          // Verify solver format contains correct values
          expect(solverConfig.ramadanModeEnabled).toBe(configInput.ramadanModeEnabled);
          expect(solverConfig.ramadanPeriodDuration).toBe(configInput.ramadanPeriodDuration);
          expect(solverConfig.enableMinistryValidation).toBe(configInput.enableMinistryValidation);
          expect(solverConfig.ministryValidationMode).toBe(configInput.ministryValidationMode);
          expect(solverConfig.customCurriculumMode).toBe(configInput.customCurriculumMode);
          expect(solverConfig.lowResourceMode).toBe(configInput.lowResourceMode);
          expect(solverConfig.defaultPeriodsPerDay).toBe(configInput.defaultPeriodsPerDay);

          // Verify JSON fields are parsed correctly
          if (configInput.ramadanBreakConfigJson) {
            expect(solverConfig.ramadanBreakConfig).toEqual(JSON.parse(configInput.ramadanBreakConfigJson));
          }
          expect(solverConfig.daysOfWeek).toEqual(JSON.parse(configInput.daysOfWeekJson));
          if (configInput.periodsPerDayMapJson) {
            expect(solverConfig.periodsPerDayMap).toEqual(JSON.parse(configInput.periodsPerDayMapJson));
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Solver format preserves shared and per-day break configuration', async () => {
    const created = await schoolConfigRepository.getOrCreate(null);

    await schoolConfigRepository.updateConfig(created.id, {
      daysOfWeekJson: JSON.stringify(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']),
      defaultPeriodsPerDay: 8,
      breakPeriods: JSON.stringify([
        { afterPeriod: 2, duration: 15 },
        { afterPeriod: 4, duration: 20 },
      ]),
      breakPeriodsByDayJson: JSON.stringify({
        Thursday: [{ afterPeriod: 1, duration: 10 }],
      }),
    });

    cacheManager.clear();
    const solverConfig = await schoolConfigRepository.getForSolver(null);

    expect(solverConfig.breakPeriods).toEqual([
      { afterPeriod: 2, duration: 15 },
      { afterPeriod: 4, duration: 20 },
    ]);
    expect(solverConfig.breakPeriodsByDay).toEqual({
      Thursday: [{ afterPeriod: 1, duration: 10 }],
    });
  });

  it('Property 2: Rejects per-day breaks outside the effective day range', async () => {
    const created = await schoolConfigRepository.getOrCreate(null);

    await expect(
      schoolConfigRepository.updateConfig(created.id, {
        daysOfWeekJson: JSON.stringify(['Saturday', 'Thursday']),
        defaultPeriodsPerDay: 8,
        dynamicPeriodsEnabled: true,
        periodsPerDayMapJson: JSON.stringify({
          Thursday: 2,
        }),
        breakPeriodsByDayJson: JSON.stringify({
          Thursday: [{ afterPeriod: 2, duration: 10 }],
        }),
      })
    ).rejects.toThrow(/Invalid school config/);
  });
});


/**
 * Property-based tests for SchoolConfig Loading and Validation
 * 
 * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
 * **Validates: Requirements 7.2, 7.3, 7.4**
 * 
 * For any application startup, the system SHALL load the saved SchoolConfig if it exists,
 * create one with defaults if it doesn't exist, AND validate that all required fields have valid values.
 */
describe('SchoolConfig Loading and Validation Property Tests', () => {
  beforeAll(async () => {
    // Ensure database is initialized
    if (!dataSource?.isInitialized) {
      dataSource = new DataSource({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: [SchoolConfig],
        synchronize: true,
        logging: false,
      });
      await dataSource.initialize();
    }
    cacheManager = new CacheManager();
    schoolConfigRepository = new SchoolConfigRepository(dataSource, cacheManager);
  });

  beforeEach(async () => {
    // Clear all configs before each test
    await dataSource.getRepository(SchoolConfig).clear();
    cacheManager.clear();
    SchoolConfigRepository.resetInstance();
    schoolConfigRepository = new SchoolConfigRepository(dataSource, cacheManager);
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.3**
   * 
   * When no SchoolConfig exists, the system SHALL create one with default values.
   */
  it('Property 10: Creates config with defaults when none exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
        async (schoolId) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Verify no config exists
          const count = await dataSource.getRepository(SchoolConfig).count();
          expect(count).toBe(0);

          // Get or create config
          const config = await schoolConfigRepository.getOrCreate(schoolId);

          // Verify config was created
          expect(config).toBeDefined();
          expect(config.id).toBeGreaterThan(0);

          // Verify default values
          expect(config.ramadanModeEnabled).toBe(false);
          expect(config.ramadanPeriodDuration).toBe(35);
          expect(config.enableMinistryValidation).toBe(false);
          expect(config.ministryValidationMode).toBe('warn');
          expect(config.customCurriculumMode).toBe(false);
          expect(config.lowResourceMode).toBe(false);
          expect(config.defaultPeriodsPerDay).toBe(7);

          // Verify default days of week (Afghan school week)
          const daysOfWeek = config.daysOfWeek;
          expect(daysOfWeek).toContain('Saturday');
          expect(daysOfWeek).toContain('Thursday');
          expect(daysOfWeek).not.toContain('Friday');

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.2**
   * 
   * When SchoolConfig exists, the system SHALL load the saved config.
   */
  it('Property 10: Loads existing config when it exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        schoolConfigArbitrary,
        async (configInput) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create initial config
          const created = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(created.id, configInput);

          // Clear cache to force database read
          cacheManager.clear();

          // Load config again
          const loaded = await schoolConfigRepository.getOrCreate(null);

          // Verify it's the same config (same ID)
          expect(loaded.id).toBe(created.id);

          // Verify values match what was saved
          expect(loaded.ramadanModeEnabled).toBe(configInput.ramadanModeEnabled);
          expect(loaded.ramadanPeriodDuration).toBe(configInput.ramadanPeriodDuration);
          expect(loaded.enableMinistryValidation).toBe(configInput.enableMinistryValidation);
          expect(loaded.ministryValidationMode).toBe(configInput.ministryValidationMode);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.4**
   * 
   * Validation SHALL detect invalid ministryValidationMode values.
   */
  it('Property 10: Validation detects invalid ministryValidationMode', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !['warn', 'strict', 'off'].includes(s)),
        async (invalidMode) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create config with invalid mode
          const config = await schoolConfigRepository.getOrCreate(null);
          config.ministryValidationMode = invalidMode;

          // Validate
          const errors = schoolConfigRepository.validateConfig(config);

          // Should have validation error
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some(e => e.includes('ministryValidationMode'))).toBe(true);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.4**
   * 
   * Validation SHALL detect invalid ramadanPeriodDuration values.
   */
  it('Property 10: Validation detects invalid ramadanPeriodDuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.integer({ min: -1000, max: 0 }),
          fc.integer({ min: 121, max: 1000 })
        ),
        async (invalidDuration) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create config with invalid duration
          const config = await schoolConfigRepository.getOrCreate(null);
          config.ramadanPeriodDuration = invalidDuration;

          // Validate
          const errors = schoolConfigRepository.validateConfig(config);

          // Should have validation error
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some(e => e.includes('ramadanPeriodDuration'))).toBe(true);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.4**
   * 
   * Validation SHALL detect invalid defaultPeriodsPerDay values.
   */
  it('Property 10: Validation detects invalid defaultPeriodsPerDay', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.integer({ min: -1000, max: 0 }),
          fc.integer({ min: 13, max: 1000 })
        ),
        async (invalidPeriods) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create config with invalid periods
          const config = await schoolConfigRepository.getOrCreate(null);
          config.defaultPeriodsPerDay = invalidPeriods;

          // Validate
          const errors = schoolConfigRepository.validateConfig(config);

          // Should have validation error
          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some(e => e.includes('defaultPeriodsPerDay'))).toBe(true);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.4**
   * 
   * Valid configurations SHALL pass validation with no errors.
   */
  it('Property 10: Valid configurations pass validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        schoolConfigArbitrary,
        async (configInput) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create config with valid values
          const config = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(config.id, configInput);

          // Clear cache and reload
          cacheManager.clear();
          const loaded = await schoolConfigRepository.getOrCreate(null);

          // Validate
          const errors = schoolConfigRepository.validateConfig(loaded);

          // Should have no validation errors
          expect(errors).toEqual([]);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: solver-afghanistan-features, Property 10: SchoolConfig Loading and Validation**
   * **Validates: Requirements 7.2, 7.4**
   * 
   * getWithValidation SHALL return both config and validation errors.
   */
  it('Property 10: getWithValidation returns config and errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        schoolConfigArbitrary,
        async (configInput) => {
          // Clear before test
          await dataSource.getRepository(SchoolConfig).clear();
          cacheManager.clear();

          // Create config
          const created = await schoolConfigRepository.getOrCreate(null);
          await schoolConfigRepository.updateConfig(created.id, configInput);

          // Clear cache
          cacheManager.clear();

          // Get with validation
          const { config, errors } = await schoolConfigRepository.getWithValidation(null);

          // Should return config
          expect(config).toBeDefined();
          expect(config.id).toBe(created.id);

          // Errors should be an array (empty for valid config)
          expect(Array.isArray(errors)).toBe(true);

          // For valid input, errors should be empty
          expect(errors).toEqual([]);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
