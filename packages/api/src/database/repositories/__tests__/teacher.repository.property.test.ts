/**
 * Property-based tests for Teacher Repository bulk operations
 * 
 * **Feature: backend-refactoring, Property 1: Bulk operations use batch database calls**
 * **Feature: backend-refactoring, Property 2: Bulk operations are atomic**
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DataSource } from 'typeorm';
import { Teacher } from '../../../entity/Teacher';
import { TeacherRepository, TeacherInput } from '../teacher.repository';
import { CacheManager } from '../../cache/cacheManager';

// In-memory SQLite database for testing
let dataSource: DataSource;
let teacherRepository: TeacherRepository;
let cacheManager: CacheManager;

/**
 * Generate valid teacher input data
 */
const teacherInputArbitrary = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  schoolId: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: null }),
  primarySubjectIds: fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 10 }),
  allowedSubjectIds: fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 10 }),
  restrictToPrimarySubjects: fc.boolean(),
  availability: fc.constant({}),
  unavailable: fc.array(fc.string(), { maxLength: 5 }),
  maxPeriodsPerWeek: fc.integer({ min: 0, max: 40 }),
  maxPeriodsPerDay: fc.integer({ min: 0, max: 10 }),
  maxConsecutivePeriods: fc.integer({ min: 0, max: 5 }),
  timePreference: fc.constantFrom('morning', 'afternoon', 'any', ''),
  preferredRoomIds: fc.array(fc.integer({ min: 1, max: 50 }), { maxLength: 5 }),
  preferredColleagues: fc.array(fc.integer({ min: 1, max: 50 }), { maxLength: 5 }),
  classAssignments: fc.array(
    fc.record({
      subjectId: fc.string({ minLength: 1, maxLength: 10 }),
      classIds: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }),
    }),
    { maxLength: 5 }
  ),
  meta: fc.constant({}),
});

/**
 * Generate array of unique teacher inputs (unique by fullName)
 */
const uniqueTeacherInputsArbitrary = (minLength: number, maxLength: number) =>
  fc.array(teacherInputArbitrary, { minLength, maxLength })
    .map(teachers => {
      // Make names unique by appending index
      return teachers.map((t, i) => ({
        ...t,
        fullName: `${t.fullName}_${i}_${Date.now()}`,
      }));
    });

describe('Teacher Repository Property Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Teacher],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
    cacheManager = new CacheManager();
    teacherRepository = new TeacherRepository(dataSource, cacheManager);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear all teachers before each test
    await dataSource.getRepository(Teacher).clear();
    cacheManager.clear();
  });


  /**
   * **Feature: backend-refactoring, Property 1: Bulk operations use batch database calls**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * For any bulk import of N entities (where N > 1), all entities should be saved
   * in a single batch operation. We verify this by checking that all entities
   * are saved and the count matches the input.
   */
  it('Property 1: Bulk import saves all entities in batch', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueTeacherInputsArbitrary(1, 20),
        async (teacherInputs) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          // Perform bulk import
          const savedTeachers = await teacherRepository.bulkImport(teacherInputs);

          // All teachers should be saved
          expect(savedTeachers.length).toBe(teacherInputs.length);

          // Verify all teachers exist in database
          const dbCount = await dataSource.getRepository(Teacher).count();
          expect(dbCount).toBe(teacherInputs.length);

          // Verify each teacher has correct data
          for (let i = 0; i < teacherInputs.length; i++) {
            const input = teacherInputs[i];
            const saved = savedTeachers.find(t => t.fullName === input.fullName);
            expect(saved).toBeDefined();
            expect(saved!.fullName).toBe(input.fullName);
            expect(saved!.maxPeriodsPerWeek).toBe(input.maxPeriodsPerWeek);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 1: Bulk operations use batch database calls**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * Bulk import should be more efficient than individual saves.
   * All entities should have the same createdAt timestamp (within tolerance),
   * indicating they were saved in a single batch.
   */
  it('Property 1: Bulk import creates entities with same timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueTeacherInputsArbitrary(2, 15),
        async (teacherInputs) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          // Perform bulk import
          const savedTeachers = await teacherRepository.bulkImport(teacherInputs);

          if (savedTeachers.length < 2) return true;

          // All teachers should have the same createdAt timestamp
          // (within a small tolerance for processing time)
          const timestamps = savedTeachers.map(t => t.createdAt.getTime());
          const minTime = Math.min(...timestamps);
          const maxTime = Math.max(...timestamps);

          // All timestamps should be within 1 second of each other
          // (batch operation should be nearly instantaneous)
          expect(maxTime - minTime).toBeLessThan(1000);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 2: Bulk operations are atomic**
   * **Validates: Requirements 5.3, 5.4**
   * 
   * For any bulk operation that completes successfully, all entities should
   * be persisted. If the operation fails, no entities should be persisted.
   */
  it('Property 2: Successful bulk import persists all entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueTeacherInputsArbitrary(1, 20),
        async (teacherInputs) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          const initialCount = await dataSource.getRepository(Teacher).count();
          expect(initialCount).toBe(0);

          // Perform bulk import
          const savedTeachers = await teacherRepository.bulkImport(teacherInputs);

          // All teachers should be persisted
          const finalCount = await dataSource.getRepository(Teacher).count();
          expect(finalCount).toBe(teacherInputs.length);
          expect(savedTeachers.length).toBe(teacherInputs.length);

          // Each saved teacher should have a valid ID
          for (const teacher of savedTeachers) {
            expect(teacher.id).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 2: Bulk operations are atomic**
   * **Validates: Requirements 5.3, 5.4**
   * 
   * Empty bulk import should return empty array without errors.
   */
  it('Property 2: Empty bulk import returns empty array', async () => {
    const result = await teacherRepository.bulkImport([]);
    expect(result).toEqual([]);
    
    const count = await dataSource.getRepository(Teacher).count();
    expect(count).toBe(0);
  });

  /**
   * **Feature: backend-refactoring, Property 2: Bulk operations are atomic**
   * **Validates: Requirements 5.3, 5.4**
   * 
   * Bulk delete should remove all specified entities atomically.
   */
  it('Property 2: Bulk delete removes all specified entities', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueTeacherInputsArbitrary(3, 15),
        fc.integer({ min: 1, max: 14 }),
        async (teacherInputs, deleteCount) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          // First, bulk import teachers
          const savedTeachers = await teacherRepository.bulkImport(teacherInputs);
          
          // Determine how many to delete (at most all of them)
          const actualDeleteCount = Math.min(deleteCount, savedTeachers.length);
          const idsToDelete = savedTeachers.slice(0, actualDeleteCount).map(t => t.id);

          // Perform bulk delete
          const deletedCount = await teacherRepository.bulkDeleteTeachers(idsToDelete);

          // Verify correct number deleted
          expect(deletedCount).toBe(actualDeleteCount);

          // Verify remaining count
          const remainingCount = await dataSource.getRepository(Teacher).count();
          expect(remainingCount).toBe(savedTeachers.length - actualDeleteCount);

          // Verify deleted teachers are gone
          for (const id of idsToDelete) {
            const found = await dataSource.getRepository(Teacher).findOne({ where: { id } });
            expect(found).toBeNull();
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 2: Bulk operations are atomic**
   * **Validates: Requirements 5.3, 5.4**
   * 
   * Bulk delete with empty array should not affect database.
   */
  it('Property 2: Empty bulk delete returns zero', async () => {
    // First add some teachers
    await teacherRepository.bulkImport([
      { fullName: 'Test Teacher 1' },
      { fullName: 'Test Teacher 2' },
    ]);

    const initialCount = await dataSource.getRepository(Teacher).count();
    expect(initialCount).toBe(2);

    // Bulk delete with empty array
    const deletedCount = await teacherRepository.bulkDeleteTeachers([]);
    expect(deletedCount).toBe(0);

    // Count should be unchanged
    const finalCount = await dataSource.getRepository(Teacher).count();
    expect(finalCount).toBe(2);
  });

  /**
   * **Feature: backend-refactoring, Property 1: Bulk operations use batch database calls**
   * **Validates: Requirements 5.1, 5.2**
   * 
   * Bulk import should correctly handle JSON fields.
   */
  it('Property 1: Bulk import correctly handles JSON fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueTeacherInputsArbitrary(1, 10),
        async (teacherInputs) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          // Perform bulk import
          const savedTeachers = await teacherRepository.bulkImport(teacherInputs);

          // Verify JSON fields are correctly parsed
          for (let i = 0; i < teacherInputs.length; i++) {
            const input = teacherInputs[i];
            const saved = savedTeachers.find(t => t.fullName === input.fullName);
            
            expect(saved).toBeDefined();
            expect(Array.isArray(saved!.primarySubjectIds)).toBe(true);
            expect(Array.isArray(saved!.allowedSubjectIds)).toBe(true);
            expect(typeof saved!.availability).toBe('object');
            expect(Array.isArray(saved!.unavailable)).toBe(true);
            expect(Array.isArray(saved!.preferredRoomIds)).toBe(true);
            expect(Array.isArray(saved!.preferredColleagues)).toBe(true);
            expect(Array.isArray(saved!.classAssignments)).toBe(true);
            expect(typeof saved!.meta).toBe('object');
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
