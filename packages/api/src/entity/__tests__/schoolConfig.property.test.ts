/**
 * Property-based tests for SchoolConfig entity
 *
 * **Feature: school-settings-periods, Property 9: Form Population from API**
 * **Validates: Requirements 11.4**
 */

import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SchoolConfig } from '../SchoolConfig';

// In-memory SQLite database for testing
let dataSource: DataSource;

/**
 * Generate valid day names
 */
const validDays = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const dayArbitrary = fc.constantFrom(...validDays);

/**
 * Generate valid days of week array (at least 1 day, no duplicates)
 */
const daysOfWeekArbitrary = fc
  .uniqueArray(dayArbitrary, { minLength: 1, maxLength: 7 })
  .filter((days) => days.length > 0);

/**
 * Generate valid time in HH:mm format
 */
const timeArbitrary = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);

/**
 * Generate valid timezone
 */
const timezoneArbitrary = fc.constantFrom('Asia/Kabul', 'Asia/Tehran', 'Asia/Dubai', 'UTC');

/**
 * Generate valid shift mode
 */
const shiftModeArbitrary = fc.constantFrom('single', 'multi');

/**
 * Generate valid period count (1-12)
 */
const periodCountArbitrary = fc.integer({ min: 1, max: 12 });

/**
 * Generate valid period duration (15-120 minutes)
 */
const periodDurationArbitrary = fc.integer({ min: 15, max: 120 });

/**
 * Generate valid grade categories
 */
const gradeCategories = ['Alpha-Primary', 'Beta-Primary', 'Middle', 'High'];
const gradeCategoryArbitrary = fc.constantFrom(...gradeCategories);

/**
 * Generate valid ministry validation mode
 */
const ministryValidationModeArbitrary = fc.constantFrom('warn', 'strict', 'off');

/**
 * Generate valid break period config
 */
const breakPeriodConfigArbitrary = fc.record({
  afterPeriod: fc.integer({ min: 1, max: 12 }),
  duration: fc.integer({ min: 5, max: 60 }),
});

/**
 * Generate valid prayer break config
 */
const prayerBreakConfigArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  time: timeArbitrary,
  duration: fc.integer({ min: 5, max: 60 }),
});

/**
 * Generate valid shift config
 */
const shiftConfigArbitrary = fc.record({
  morning: fc.record({
    start: timeArbitrary,
    end: timeArbitrary,
  }),
  afternoon: fc.record({
    start: timeArbitrary,
    end: timeArbitrary,
  }),
});

/**
 * Generate periods per day map based on days of week
 */
const periodsPerDayMapArbitrary = (days: string[]) =>
  fc.record(
    Object.fromEntries(days.map((day) => [day, periodCountArbitrary])) as Record<
      string,
      fc.Arbitrary<number>
    >
  );

/**
 * Generate category periods map based on days of week
 */
const categoryPeriodsMapArbitrary = (days: string[]) =>
  fc.record(
    Object.fromEntries(
      gradeCategories.map((category) => [category, periodsPerDayMapArbitrary(days)])
    ) as Record<string, fc.Arbitrary<Record<string, number>>>
  );

/**
 * Generate complete SchoolConfig input data for school settings fields
 */
const schoolSettingsArbitrary = fc.record({
  daysOfWeek: daysOfWeekArbitrary,
  schoolStartTime: timeArbitrary,
  timezone: timezoneArbitrary,
  shiftMode: shiftModeArbitrary,
});

/**
 * Generate complete SchoolConfig input data for period structure fields
 */
const periodStructureArbitrary = fc.record({
  defaultPeriodsPerDay: periodCountArbitrary,
  periodDuration: periodDurationArbitrary,
  dynamicPeriodsEnabled: fc.boolean(),
  categoryPeriodsEnabled: fc.boolean(),
});

describe('SchoolConfig Entity Property Tests', () => {
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
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear all school configs before each test
    await dataSource.getRepository(SchoolConfig).clear();
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any field in the configuration form, when the API returns a saved value
   * for that field, the form SHALL display that exact value (accounting for type
   * conversion where necessary).
   */
  it('Property 9: Form population from API preserves all school settings fields', async () => {
    await fc.assert(
      fc.asyncProperty(schoolSettingsArbitrary, async (input) => {
        const repository = dataSource.getRepository(SchoolConfig);

        // Create and save school config with school settings
        const config = repository.create({
          schoolId: null,
          daysOfWeekJson: JSON.stringify(input.daysOfWeek),
          schoolStartTime: input.schoolStartTime,
          timezone: input.timezone,
          shiftMode: input.shiftMode,
        });

        const saved = await repository.save(config);
        expect(saved.id).toBeGreaterThan(0);

        // Retrieve the config (simulating API response)
        const retrieved = await repository.findOne({ where: { id: saved.id } });
        expect(retrieved).not.toBeNull();

        // Verify all school settings fields are preserved for form population
        // Using the getter for daysOfWeek which parses JSON
        expect(retrieved!.daysOfWeek).toEqual(input.daysOfWeek);
        expect(retrieved!.schoolStartTime).toBe(input.schoolStartTime);
        expect(retrieved!.timezone).toBe(input.timezone);
        expect(retrieved!.shiftMode).toBe(input.shiftMode);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any period structure configuration, when the API returns saved values,
   * the form SHALL display those exact values.
   */
  it('Property 9: Form population from API preserves all period structure fields', async () => {
    await fc.assert(
      fc.asyncProperty(periodStructureArbitrary, async (input) => {
        const repository = dataSource.getRepository(SchoolConfig);

        // Create and save school config with period structure settings
        const config = repository.create({
          schoolId: null,
          defaultPeriodsPerDay: input.defaultPeriodsPerDay,
          periodDuration: input.periodDuration,
          dynamicPeriodsEnabled: input.dynamicPeriodsEnabled,
          categoryPeriodsEnabled: input.categoryPeriodsEnabled,
        });

        const saved = await repository.save(config);
        expect(saved.id).toBeGreaterThan(0);

        // Retrieve the config (simulating API response)
        const retrieved = await repository.findOne({ where: { id: saved.id } });
        expect(retrieved).not.toBeNull();

        // Verify all period structure fields are preserved for form population
        expect(retrieved!.defaultPeriodsPerDay).toBe(input.defaultPeriodsPerDay);
        expect(retrieved!.periodDuration).toBe(input.periodDuration);
        expect(retrieved!.dynamicPeriodsEnabled).toBe(input.dynamicPeriodsEnabled);
        expect(retrieved!.categoryPeriodsEnabled).toBe(input.categoryPeriodsEnabled);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any dynamic periods configuration (periodsPerDayMap), when the API returns
   * saved values, the form SHALL display those exact values.
   */
  it('Property 9: Form population from API preserves periodsPerDayMap', async () => {
    await fc.assert(
      fc.asyncProperty(daysOfWeekArbitrary, async (days) => {
        // Generate a periods map for the given days
        const periodsMap: Record<string, number> = {};
        for (const day of days) {
          periodsMap[day] = Math.floor(Math.random() * 12) + 1; // 1-12
        }

        const repository = dataSource.getRepository(SchoolConfig);

        // Create and save school config with periods per day map
        const config = repository.create({
          schoolId: null,
          dynamicPeriodsEnabled: true,
          periodsPerDayMapJson: JSON.stringify(periodsMap),
        });

        const saved = await repository.save(config);
        expect(saved.id).toBeGreaterThan(0);

        // Retrieve the config (simulating API response)
        const retrieved = await repository.findOne({ where: { id: saved.id } });
        expect(retrieved).not.toBeNull();

        // Verify periodsPerDayMap is preserved using the getter
        expect(retrieved!.periodsPerDayMap).toEqual(periodsMap);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any category-based periods configuration (categoryPeriodsMap), when the API
   * returns saved values, the form SHALL display those exact values.
   */
  it('Property 9: Form population from API preserves categoryPeriodsMap', async () => {
    await fc.assert(
      fc.asyncProperty(daysOfWeekArbitrary, async (days) => {
        // Generate a category periods map for the given days
        const categoryMap: Record<string, Record<string, number>> = {};
        for (const category of gradeCategories) {
          categoryMap[category] = {};
          for (const day of days) {
            categoryMap[category][day] = Math.floor(Math.random() * 12) + 1; // 1-12
          }
        }

        const repository = dataSource.getRepository(SchoolConfig);

        // Create and save school config with category periods map
        const config = repository.create({
          schoolId: null,
          categoryPeriodsEnabled: true,
          categoryPeriodsMapJson: JSON.stringify(categoryMap),
        });

        const saved = await repository.save(config);
        expect(saved.id).toBeGreaterThan(0);

        // Retrieve the config (simulating API response)
        const retrieved = await repository.findOne({ where: { id: saved.id } });
        expect(retrieved).not.toBeNull();

        // Verify categoryPeriodsMap is preserved using the getter
        expect(retrieved!.categoryPeriodsMap).toEqual(categoryMap);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any shift configuration (shiftsConfig), when the API returns saved values,
   * the form SHALL display those exact values.
   */
  it('Property 9: Form population from API preserves shiftsConfig', async () => {
    await fc.assert(
      fc.asyncProperty(shiftConfigArbitrary, async (shiftsConfig) => {
        const repository = dataSource.getRepository(SchoolConfig);

        // Create and save school config with shift configuration
        const config = repository.create({
          schoolId: null,
          shiftMode: 'multi',
          shiftsConfigJson: JSON.stringify(shiftsConfig),
        });

        const saved = await repository.save(config);
        expect(saved.id).toBeGreaterThan(0);

        // Retrieve the config (simulating API response)
        const retrieved = await repository.findOne({ where: { id: saved.id } });
        expect(retrieved).not.toBeNull();

        // Verify shiftsConfig is preserved using the getter
        expect(retrieved!.shiftsConfig).toEqual(shiftsConfig);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any break periods configuration, when the API returns saved values,
   * the form SHALL display those exact values.
   */
  it('Property 9: Form population from API preserves break periods', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(breakPeriodConfigArbitrary, { minLength: 0, maxLength: 5 }),
        async (breakPeriods) => {
          const repository = dataSource.getRepository(SchoolConfig);

          // Create and save school config with break periods
          const config = repository.create({
            schoolId: null,
            breakPeriods: JSON.stringify(breakPeriods),
          });

          const saved = await repository.save(config);
          expect(saved.id).toBeGreaterThan(0);

          // Retrieve the config (simulating API response)
          const retrieved = await repository.findOne({ where: { id: saved.id } });
          expect(retrieved).not.toBeNull();

          // Verify break periods are preserved (stored as JSON string)
          expect(JSON.parse(retrieved!.breakPeriods)).toEqual(breakPeriods);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any prayer breaks configuration, when the API returns saved values,
   * the form SHALL display those exact values.
   */
  it('Property 9: Form population from API preserves prayer breaks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(prayerBreakConfigArbitrary, { minLength: 0, maxLength: 5 }),
        async (prayerBreaks) => {
          const repository = dataSource.getRepository(SchoolConfig);

          // Create and save school config with prayer breaks
          const config = repository.create({
            schoolId: null,
            prayerBreaksJson: JSON.stringify(prayerBreaks),
          });

          const saved = await repository.save(config);
          expect(saved.id).toBeGreaterThan(0);

          // Retrieve the config (simulating API response)
          const retrieved = await repository.findOne({ where: { id: saved.id } });
          expect(retrieved).not.toBeNull();

          // Verify prayer breaks are preserved using the getter
          expect(retrieved!.prayerBreaks).toEqual(prayerBreaks);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: school-settings-periods, Property 9: Form Population from API**
   * **Validates: Requirements 11.4**
   *
   * For any complete configuration with all fields populated, when the API returns
   * saved values, the form SHALL display all exact values.
   */
  it('Property 9: Form population from API preserves complete configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        schoolSettingsArbitrary,
        periodStructureArbitrary,
        fc.array(breakPeriodConfigArbitrary, { minLength: 0, maxLength: 3 }),
        fc.array(prayerBreakConfigArbitrary, { minLength: 0, maxLength: 3 }),
        async (schoolSettings, periodStructure, breakPeriods, prayerBreaks) => {
          const repository = dataSource.getRepository(SchoolConfig);

          // Generate periods per day map for the days
          const periodsMap: Record<string, number> = {};
          for (const day of schoolSettings.daysOfWeek) {
            periodsMap[day] = Math.floor(Math.random() * 12) + 1;
          }

          // Generate category periods map
          const categoryMap: Record<string, Record<string, number>> = {};
          for (const category of gradeCategories) {
            categoryMap[category] = {};
            for (const day of schoolSettings.daysOfWeek) {
              categoryMap[category][day] = Math.floor(Math.random() * 12) + 1;
            }
          }

          // Create and save complete school config
          const config = repository.create({
            schoolId: null,
            // School settings
            daysOfWeekJson: JSON.stringify(schoolSettings.daysOfWeek),
            schoolStartTime: schoolSettings.schoolStartTime,
            timezone: schoolSettings.timezone,
            shiftMode: schoolSettings.shiftMode,
            // Period structure
            defaultPeriodsPerDay: periodStructure.defaultPeriodsPerDay,
            periodDuration: periodStructure.periodDuration,
            dynamicPeriodsEnabled: periodStructure.dynamicPeriodsEnabled,
            categoryPeriodsEnabled: periodStructure.categoryPeriodsEnabled,
            periodsPerDayMapJson: JSON.stringify(periodsMap),
            categoryPeriodsMapJson: JSON.stringify(categoryMap),
            // Breaks
            breakPeriods: JSON.stringify(breakPeriods),
            prayerBreaksJson: JSON.stringify(prayerBreaks),
          });

          const saved = await repository.save(config);
          expect(saved.id).toBeGreaterThan(0);

          // Retrieve the config (simulating API response)
          const retrieved = await repository.findOne({ where: { id: saved.id } });
          expect(retrieved).not.toBeNull();

          // Verify all fields are preserved for form population
          // School settings
          expect(retrieved!.daysOfWeek).toEqual(schoolSettings.daysOfWeek);
          expect(retrieved!.schoolStartTime).toBe(schoolSettings.schoolStartTime);
          expect(retrieved!.timezone).toBe(schoolSettings.timezone);
          expect(retrieved!.shiftMode).toBe(schoolSettings.shiftMode);

          // Period structure
          expect(retrieved!.defaultPeriodsPerDay).toBe(periodStructure.defaultPeriodsPerDay);
          expect(retrieved!.periodDuration).toBe(periodStructure.periodDuration);
          expect(retrieved!.dynamicPeriodsEnabled).toBe(periodStructure.dynamicPeriodsEnabled);
          expect(retrieved!.categoryPeriodsEnabled).toBe(periodStructure.categoryPeriodsEnabled);
          expect(retrieved!.periodsPerDayMap).toEqual(periodsMap);
          expect(retrieved!.categoryPeriodsMap).toEqual(categoryMap);

          // Breaks
          expect(JSON.parse(retrieved!.breakPeriods)).toEqual(breakPeriods);
          expect(retrieved!.prayerBreaks).toEqual(prayerBreaks);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
