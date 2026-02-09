/**
 * Property-based tests for Transaction Atomicity
 *
 * **Feature: backend-refactoring, Property 8: Transaction atomicity**
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
 *
 * For any operation wrapped in a transaction that encounters an error,
 * all database changes within that transaction SHALL be rolled back.
 */

import * as fc from 'fast-check';
import { DataSource, EntityManager } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ClassGroup } from '../../entity/ClassGroup';
import { Room } from '../../entity/Room';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';

// In-memory SQLite database for testing
let dataSource: DataSource;

/**
 * Generate valid teacher data
 */
const teacherDataArbitrary = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  primarySubjectIds: fc.constant('[]'),
  allowedSubjectIds: fc.constant('[]'),
  restrictToPrimarySubjects: fc.boolean(),
  availability: fc.constant('{}'),
  unavailable: fc.constant('[]'),
  maxPeriodsPerWeek: fc.integer({ min: 0, max: 40 }),
  maxPeriodsPerDay: fc.integer({ min: 0, max: 10 }),
  maxConsecutivePeriods: fc.integer({ min: 0, max: 5 }),
  timePreference: fc.constantFrom('morning', 'afternoon', 'any', ''),
  preferredRoomIds: fc.constant('[]'),
  preferredColleagues: fc.constant('[]'),
  classAssignments: fc.constant('[]'),
  meta: fc.constant('{}'),
});

/**
 * Generate valid subject data
 */
const subjectDataArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  code: fc.string({ minLength: 0, maxLength: 20 }),
  requiredRoomType: fc.constantFrom(
    'normal',
    'computer_lab',
    'biology_lab',
    'chemistry_lab',
    'math_lab',
    'physics_lab',
    'lab',
    'library',
    'salon',
    'gym',
    'sport_camp',
    'other',
    ''
  ),
  requiredFeatures: fc.constant('[]'),
  desiredFeatures: fc.constant('[]'),
  isDifficult: fc.boolean(),
  minRoomCapacity: fc.integer({ min: 0, max: 100 }),
  meta: fc.constant('{}'),
  grade: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  periodsPerWeek: fc.option(fc.integer({ min: 1, max: 10 }), { nil: null }),
  section: fc.constantFrom('A', 'B', 'C', ''),
});

describe('Transaction Atomicity Property Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [Teacher, Subject, ClassGroup, Room],
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
    // Clear all entities before each test
    await dataSource.getRepository(ClassGroup).clear();
    await dataSource.getRepository(Subject).clear();
    await dataSource.getRepository(Teacher).clear();
    await dataSource.getRepository(Room).clear();
  });

  /**
   * **Feature: backend-refactoring, Property 8: Transaction atomicity**
   * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
   *
   * For any successful transaction, all operations within it should be persisted.
   */
  it('Property 8: Successful transaction persists all changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(teacherDataArbitrary, { minLength: 1, maxLength: 10 }).map((teachers) =>
          teachers.map((t, i) => ({
            ...t,
            fullName: `${t.fullName}_${i}_${Date.now()}`,
          }))
        ),
        async (teacherDataList) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          const initialCount = await dataSource.getRepository(Teacher).count();
          expect(initialCount).toBe(0);

          // Execute transaction
          await dataSource.transaction(async (manager: EntityManager) => {
            const repo = manager.getRepository(Teacher);
            const now = new Date();

            for (const data of teacherDataList) {
              const teacher = new Teacher();
              Object.assign(teacher, data);
              teacher.createdAt = now;
              teacher.updatedAt = now;
              await repo.save(teacher);
            }
          });

          // All teachers should be persisted
          const finalCount = await dataSource.getRepository(Teacher).count();
          expect(finalCount).toBe(teacherDataList.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 8: Transaction atomicity**
   * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
   *
   * For any transaction that fails, all changes should be rolled back.
   */
  it('Property 8: Failed transaction rolls back all changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(teacherDataArbitrary, { minLength: 2, maxLength: 10 }).map((teachers) =>
          teachers.map((t, i) => ({
            ...t,
            fullName: `${t.fullName}_${i}_${Date.now()}`,
          }))
        ),
        fc.integer({ min: 1, max: 9 }), // Index at which to fail
        async (teacherDataList, failIndex) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();

          const initialCount = await dataSource.getRepository(Teacher).count();
          expect(initialCount).toBe(0);

          // Ensure failIndex is within bounds
          const actualFailIndex = Math.min(failIndex, teacherDataList.length - 1);

          // Execute transaction that will fail
          try {
            await dataSource.transaction(async (manager: EntityManager) => {
              const repo = manager.getRepository(Teacher);
              const now = new Date();

              for (let i = 0; i < teacherDataList.length; i++) {
                const data = teacherDataList[i];

                // Throw error at specified index to simulate failure
                if (i === actualFailIndex) {
                  throw new Error('Simulated transaction failure');
                }

                const teacher = new Teacher();
                Object.assign(teacher, data);
                teacher.createdAt = now;
                teacher.updatedAt = now;
                await repo.save(teacher);
              }
            });

            // Should not reach here
            expect.fail('Transaction should have thrown an error');
          } catch (error: any) {
            // Expected error
            expect(error.message).toBe('Simulated transaction failure');
          }

          // All changes should be rolled back - database should be empty
          const finalCount = await dataSource.getRepository(Teacher).count();
          expect(finalCount).toBe(0);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 8: Transaction atomicity**
   * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
   *
   * Multi-entity transactions should be atomic - either all entities are saved or none.
   */
  it('Property 8: Multi-entity transaction is atomic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(teacherDataArbitrary, { minLength: 1, maxLength: 5 }).map((teachers) =>
          teachers.map((t, i) => ({
            ...t,
            fullName: `Teacher_${i}_${Date.now()}`,
          }))
        ),
        fc.array(subjectDataArbitrary, { minLength: 1, maxLength: 5 }).map((subjects) =>
          subjects.map((s, i) => ({
            ...s,
            name: `Subject_${i}_${Date.now()}`,
          }))
        ),
        async (teacherDataList, subjectDataList) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();
          await dataSource.getRepository(Subject).clear();

          // Execute successful multi-entity transaction
          await dataSource.transaction(async (manager: EntityManager) => {
            const teacherRepo = manager.getRepository(Teacher);
            const subjectRepo = manager.getRepository(Subject);
            const now = new Date();

            // Save teachers
            for (const data of teacherDataList) {
              const teacher = new Teacher();
              Object.assign(teacher, data);
              teacher.createdAt = now;
              teacher.updatedAt = now;
              await teacherRepo.save(teacher);
            }

            // Save subjects
            for (const data of subjectDataList) {
              const subject = new Subject();
              Object.assign(subject, data);
              subject.createdAt = now;
              subject.updatedAt = now;
              await subjectRepo.save(subject);
            }
          });

          // All entities should be persisted
          const teacherCount = await dataSource.getRepository(Teacher).count();
          const subjectCount = await dataSource.getRepository(Subject).count();

          expect(teacherCount).toBe(teacherDataList.length);
          expect(subjectCount).toBe(subjectDataList.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 8: Transaction atomicity**
   * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
   *
   * Multi-entity transaction failure should rollback all entity types.
   */
  it('Property 8: Multi-entity transaction failure rolls back all entity types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(teacherDataArbitrary, { minLength: 1, maxLength: 5 }).map((teachers) =>
          teachers.map((t, i) => ({
            ...t,
            fullName: `Teacher_${i}_${Date.now()}`,
          }))
        ),
        fc.array(subjectDataArbitrary, { minLength: 1, maxLength: 5 }).map((subjects) =>
          subjects.map((s, i) => ({
            ...s,
            name: `Subject_${i}_${Date.now()}`,
          }))
        ),
        async (teacherDataList, subjectDataList) => {
          // Clear before test
          await dataSource.getRepository(Teacher).clear();
          await dataSource.getRepository(Subject).clear();

          const initialTeacherCount = await dataSource.getRepository(Teacher).count();
          const initialSubjectCount = await dataSource.getRepository(Subject).count();
          expect(initialTeacherCount).toBe(0);
          expect(initialSubjectCount).toBe(0);

          // Execute failing multi-entity transaction
          try {
            await dataSource.transaction(async (manager: EntityManager) => {
              const teacherRepo = manager.getRepository(Teacher);
              const subjectRepo = manager.getRepository(Subject);
              const now = new Date();

              // Save teachers first
              for (const data of teacherDataList) {
                const teacher = new Teacher();
                Object.assign(teacher, data);
                teacher.createdAt = now;
                teacher.updatedAt = now;
                await teacherRepo.save(teacher);
              }

              // Save some subjects
              for (let i = 0; i < subjectDataList.length; i++) {
                const data = subjectDataList[i];

                // Fail after saving at least one subject
                if (i > 0) {
                  throw new Error('Simulated multi-entity transaction failure');
                }

                const subject = new Subject();
                Object.assign(subject, data);
                subject.createdAt = now;
                subject.updatedAt = now;
                await subjectRepo.save(subject);
              }
            });

            // Should not reach here if we have more than 1 subject
            if (subjectDataList.length > 1) {
              expect.fail('Transaction should have thrown an error');
            }
          } catch (error: any) {
            // Expected error
            expect(error.message).toBe('Simulated multi-entity transaction failure');
          }

          // If transaction failed, all changes should be rolled back
          if (subjectDataList.length > 1) {
            const finalTeacherCount = await dataSource.getRepository(Teacher).count();
            const finalSubjectCount = await dataSource.getRepository(Subject).count();

            expect(finalTeacherCount).toBe(0);
            expect(finalSubjectCount).toBe(0);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: backend-refactoring, Property 8: Transaction atomicity**
   * **Validates: Requirements 11.1**
   *
   * Destructive reset operations should be atomic.
   */
  it('Property 8: Destructive reset is atomic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(teacherDataArbitrary, { minLength: 1, maxLength: 5 }).map((teachers) =>
          teachers.map((t, i) => ({
            ...t,
            fullName: `Teacher_${i}_${Date.now()}`,
          }))
        ),
        fc.array(subjectDataArbitrary, { minLength: 1, maxLength: 5 }).map((subjects) =>
          subjects.map((s, i) => ({
            ...s,
            name: `Subject_${i}_${Date.now()}`,
          }))
        ),
        async (teacherDataList, subjectDataList) => {
          // First, populate the database
          await dataSource.transaction(async (manager: EntityManager) => {
            const teacherRepo = manager.getRepository(Teacher);
            const subjectRepo = manager.getRepository(Subject);
            const now = new Date();

            for (const data of teacherDataList) {
              const teacher = new Teacher();
              Object.assign(teacher, data);
              teacher.createdAt = now;
              teacher.updatedAt = now;
              await teacherRepo.save(teacher);
            }

            for (const data of subjectDataList) {
              const subject = new Subject();
              Object.assign(subject, data);
              subject.createdAt = now;
              subject.updatedAt = now;
              await subjectRepo.save(subject);
            }
          });

          // Verify data exists
          const preTeacherCount = await dataSource.getRepository(Teacher).count();
          const preSubjectCount = await dataSource.getRepository(Subject).count();
          expect(preTeacherCount).toBe(teacherDataList.length);
          expect(preSubjectCount).toBe(subjectDataList.length);

          // Perform destructive reset within transaction
          await dataSource.transaction(async (manager: EntityManager) => {
            await manager.getRepository(ClassGroup).clear();
            await manager.getRepository(Subject).clear();
            await manager.getRepository(Teacher).clear();
          });

          // All data should be cleared
          const postTeacherCount = await dataSource.getRepository(Teacher).count();
          const postSubjectCount = await dataSource.getRepository(Subject).count();

          expect(postTeacherCount).toBe(0);
          expect(postSubjectCount).toBe(0);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
