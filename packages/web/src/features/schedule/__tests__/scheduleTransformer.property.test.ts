/**
 * Property-based tests for schedule transformer
 * **Feature: schedule-phase1, Property 3: Transformer Round-Trip Consistency**
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { DayOfWeek, type NormalizedSchedule, type TimetableApiResponse } from '../types';
import { normalizeSchedule, serializeSchedule } from '../utils/scheduleTransformer';

// Generator for valid DayOfWeek
const dayOfWeekArb = fc.constantFrom(...Object.values(DayOfWeek));

// Generator for non-empty string IDs
const idArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0);

// Generator for ScheduledLesson
const scheduledLessonArb = fc.record({
  day: dayOfWeekArb,
  periodIndex: fc.integer({ min: 0, max: 7 }),
  classId: idArb,
  className: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  subjectId: idArb,
  subjectName: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  teacherIds: fc.array(idArb, { minLength: 1, maxLength: 3 }),
  teacherNames: fc.option(fc.array(fc.string({ maxLength: 50 }), { minLength: 1, maxLength: 3 }), {
    nil: null,
  }),
  roomId: fc.option(idArb, { nil: null }),
  roomName: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  isFixed: fc.boolean(),
  periodsThisDay: fc.option(fc.integer({ min: 1, max: 8 }), { nil: null }),
});

// Generator for ClassMetadata
const classMetadataArb = fc.record({
  classId: idArb,
  className: fc.string({ minLength: 1, maxLength: 50 }),
  gradeLevel: fc.option(fc.integer({ min: 1, max: 12 }), { nil: null }),
  category: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
  categoryDari: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
  studentCount: fc.integer({ min: 0, max: 100 }),
  singleTeacherMode: fc.boolean(),
  classTeacherId: fc.option(idArb, { nil: null }),
  classTeacherName: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  classTeacherSubjects: fc.option(fc.array(idArb, { minLength: 0, maxLength: 5 }), { nil: null }),
});

// Generator for SubjectMetadata
const subjectMetadataArb = fc.record({
  subjectId: idArb,
  subjectName: fc.string({ minLength: 1, maxLength: 50 }),
  isCustom: fc.boolean(),
  customCategory: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
  customCategoryDari: fc.option(fc.string({ maxLength: 30 }), { nil: null }),
});

// Generator for TeacherMetadata
const teacherMetadataArb = fc.record({
  teacherId: idArb,
  teacherName: fc.string({ minLength: 1, maxLength: 50 }),
  primarySubjects: fc.array(idArb, { minLength: 0, maxLength: 5 }),
  maxPeriodsPerWeek: fc.integer({ min: 0, max: 40 }),
  classTeacherOf: fc.array(idArb, { minLength: 0, maxLength: 3 }),
});

// Generator for PeriodConfiguration
const periodConfigurationArb = fc.record({
  periodsPerDayMap: fc.dictionary(dayOfWeekArb, fc.integer({ min: 1, max: 8 })),
  totalPeriodsPerWeek: fc.integer({ min: 0, max: 56 }),
  daysOfWeek: fc.array(dayOfWeekArb, { minLength: 1, maxLength: 7 }),
  hasVariablePeriods: fc.boolean(),
});

// Generator for SolutionMetadata
const solutionMetadataArb = fc.record({
  classes: fc.array(classMetadataArb, { minLength: 0, maxLength: 10 }),
  subjects: fc.array(subjectMetadataArb, { minLength: 0, maxLength: 10 }),
  teachers: fc.array(teacherMetadataArb, { minLength: 0, maxLength: 10 }),
  periodConfiguration: fc.option(periodConfigurationArb, { nil: null }),
});

// Generator for SolutionStatistics
const solutionStatisticsArb = fc.record({
  totalClasses: fc.integer({ min: 0, max: 100 }),
  singleTeacherClasses: fc.integer({ min: 0, max: 100 }),
  multiTeacherClasses: fc.integer({ min: 0, max: 100 }),
  totalSubjects: fc.integer({ min: 0, max: 50 }),
  customSubjects: fc.integer({ min: 0, max: 50 }),
  standardSubjects: fc.integer({ min: 0, max: 50 }),
  totalTeachers: fc.integer({ min: 0, max: 100 }),
  totalRooms: fc.integer({ min: 0, max: 50 }),
  categoryCounts: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: 0, max: 50 })
  ),
  customSubjectsByCategory: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: 0, max: 50 })
  ),
  totalLessons: fc.integer({ min: 0, max: 1000 }),
  periodsPerWeek: fc.integer({ min: 0, max: 56 }),
  solveTimeSeconds: fc.option(fc.float({ min: 0, max: 300, noNaN: true }), { nil: null }),
  strategy: fc.option(fc.constantFrom('fast', 'balanced', 'thorough'), { nil: null }),
  numConstraintsApplied: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  qualityScore: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
});

// Generator for NormalizedSchedule
const normalizedScheduleArb: fc.Arbitrary<NormalizedSchedule> = fc.record({
  lessons: fc.array(scheduledLessonArb, { minLength: 0, maxLength: 50 }),
  metadata: fc.option(solutionMetadataArb, { nil: null }),
  statistics: fc.option(solutionStatisticsArb, { nil: null }),
});

/**
 * Helper to compare two NormalizedSchedule objects for equivalence
 */
function areSchedulesEquivalent(a: NormalizedSchedule, b: NormalizedSchedule): boolean {
  // Compare lessons count
  if (a.lessons.length !== b.lessons.length) {
    return false;
  }

  // Compare each lesson
  for (let i = 0; i < a.lessons.length; i++) {
    const lessonA = a.lessons[i];
    const lessonB = b.lessons[i];

    if (
      lessonA.day !== lessonB.day ||
      lessonA.periodIndex !== lessonB.periodIndex ||
      lessonA.classId !== lessonB.classId ||
      lessonA.className !== lessonB.className ||
      lessonA.subjectId !== lessonB.subjectId ||
      lessonA.subjectName !== lessonB.subjectName ||
      lessonA.roomId !== lessonB.roomId ||
      lessonA.roomName !== lessonB.roomName ||
      lessonA.isFixed !== lessonB.isFixed ||
      lessonA.periodsThisDay !== lessonB.periodsThisDay
    ) {
      return false;
    }

    // Compare teacherIds arrays
    if (lessonA.teacherIds.length !== lessonB.teacherIds.length) {
      return false;
    }
    for (let j = 0; j < lessonA.teacherIds.length; j++) {
      if (lessonA.teacherIds[j] !== lessonB.teacherIds[j]) {
        return false;
      }
    }

    // Compare teacherNames arrays
    if (lessonA.teacherNames === null && lessonB.teacherNames !== null) return false;
    if (lessonA.teacherNames !== null && lessonB.teacherNames === null) return false;
    if (lessonA.teacherNames !== null && lessonB.teacherNames !== null) {
      if (lessonA.teacherNames.length !== lessonB.teacherNames.length) return false;
      for (let j = 0; j < lessonA.teacherNames.length; j++) {
        if (lessonA.teacherNames[j] !== lessonB.teacherNames[j]) return false;
      }
    }
  }

  // Compare metadata presence
  if ((a.metadata === null) !== (b.metadata === null)) {
    return false;
  }

  if (a.metadata !== null && b.metadata !== null) {
    // Compare classes count
    if (a.metadata.classes.length !== b.metadata.classes.length) return false;
    // Compare subjects count
    if (a.metadata.subjects.length !== b.metadata.subjects.length) return false;
    // Compare teachers count
    if (a.metadata.teachers.length !== b.metadata.teachers.length) return false;
    // Compare periodConfiguration presence
    if ((a.metadata.periodConfiguration === null) !== (b.metadata.periodConfiguration === null)) {
      return false;
    }
  }

  // Compare statistics presence
  if ((a.statistics === null) !== (b.statistics === null)) {
    return false;
  }

  if (a.statistics !== null && b.statistics !== null) {
    // Compare key statistics fields
    if (
      a.statistics.totalClasses !== b.statistics.totalClasses ||
      a.statistics.totalSubjects !== b.statistics.totalSubjects ||
      a.statistics.totalTeachers !== b.statistics.totalTeachers ||
      a.statistics.totalLessons !== b.statistics.totalLessons
    ) {
      return false;
    }
  }

  return true;
}

describe('Schedule Transformer Property Tests', () => {
  /**
   * **Feature: schedule-phase1, Property 3: Transformer Round-Trip Consistency**
   * **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
   *
   * For any valid NormalizedSchedule object, serializing it to JSON (as stored in
   * API response data field) and then calling normalizeSchedule SHALL produce an
   * equivalent NormalizedSchedule with:
   * - Same number of lessons with matching field values
   * - Equivalent metadata structure (classes, subjects, teachers, periodConfiguration)
   * - Equivalent statistics values
   */
  it('Property 3: Serialize then normalize produces equivalent data', () => {
    fc.assert(
      fc.property(normalizedScheduleArb, (originalSchedule) => {
        // Serialize the schedule to JSON (as stored in API data field)
        const serialized = serializeSchedule(originalSchedule);

        // Create a mock API response
        const apiResponse: TimetableApiResponse = {
          id: 1,
          name: 'Test Schedule',
          description: 'Test',
          data: serialized,
          schoolId: null,
          academicYearId: null,
          termId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Normalize the API response
        const normalizedSchedule = normalizeSchedule(apiResponse);

        // Verify equivalence
        expect(areSchedulesEquivalent(originalSchedule, normalizedSchedule)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
