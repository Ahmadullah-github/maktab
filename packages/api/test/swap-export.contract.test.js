const assert = require('node:assert/strict');
const test = require('node:test');

const { exportRequestSchema } = require('../dist/src/schemas/export.schema');
const { applyLessonMovesToPayload } = require('../dist/src/routes/swap.routes');
const { swapRequestSchema } = require('../dist/src/schemas/swap.schema');
const {
  repairLegacyLessonFixedness,
} = require('../dist/src/schemas/timetable.schema');
const { CacheManager } = require('../dist/src/database/cache/cacheManager');
const { BaseRepository } = require('../dist/src/database/repositories/base.repository');
const { SwapConstraintCache } = require('../dist/src/services/SwapConstraintCache');

const displaySettings = {
  showSubjectName: true,
  showTeacherName: true,
  showRoomName: true,
  cellSize: 'normal',
  fontSize: 'md',
  colorBy: 'none',
};

test('current export requires an explicit target', () => {
  const result = exportRequestSchema.safeParse({
    scheduleId: 1,
    scope: 'current',
    targetType: 'class',
    displaySettings,
  });

  assert.equal(result.success, false);
});

test('batch export scope must match its target type', () => {
  const result = exportRequestSchema.safeParse({
    scheduleId: 1,
    scope: 'all-classes',
    targetType: 'teacher',
    displaySettings,
  });

  assert.equal(result.success, false);
});

test('swap persistence fails closed when a validated move cannot be matched', () => {
  const payload = {
    schedule: [
      {
        classId: 'c1',
        subjectId: 's1',
        teacherIds: ['t1'],
        day: 'Saturday',
        periodIndex: 0,
      },
    ],
  };

  assert.throws(
    () =>
      applyLessonMovesToPayload(payload, [
        {
          classId: 'missing-class',
          subjectId: 's1',
          teacherId: 't1',
          teacherIds: ['t1'],
          roomId: null,
          fromDay: 'Saturday',
          fromPeriod: 0,
          toDay: 'Saturday',
          toPeriod: 1,
          isFixed: false,
        },
      ]),
    /could not be applied atomically/
  );
});

test('swap validation requires a revision-bound current draft', () => {
  const result = swapRequestSchema.safeParse({
    timetableId: 1,
    sourceSlot: { classId: 'c1', day: 'Saturday', period: 0 },
    targetSlot: { classId: 'c1', day: 'Saturday', period: 1 },
  });

  assert.equal(result.success, false);
});

test('swap validation rejects lessons without an assigned teacher', () => {
  const result = swapRequestSchema.safeParse({
    timetableId: 1,
    expectedRevision: 1,
    draftLessons: [
      {
        classId: 'c1',
        subjectId: 's1',
        teacherIds: [],
        roomId: null,
        day: 'Saturday',
        periodIndex: 0,
      },
    ],
    sourceSlot: { classId: 'c1', day: 'Saturday', period: 0 },
    targetSlot: { classId: 'c1', day: 'Saturday', period: 1 },
  });

  assert.equal(result.success, false);
});

test('resource repository mutations invalidate derived swap constraints', () => {
  class TestRepository extends BaseRepository {
    entityClass = Object;
    cachePrefix = 'test-resource';

    invalidateForTest() {
      this.invalidateCache(1);
    }
  }

  const cacheManager = new CacheManager({
    defaultConfig: { maxSize: 10, ttlMs: 60_000 },
  });
  const swapCache = new SwapConstraintCache(cacheManager);
  swapCache.set(1, {
    teachers: [],
    subjects: [],
    rooms: [],
    classes: [],
    timetableData: {
      lessons: [],
      periodsPerDay: {},
      daysOfWeek: [],
      revision: 1,
      allowConsecutivePeriodsForSameSubject: true,
    },
    cachedAt: new Date(),
  });

  assert.ok(swapCache.get(1));
  new TestRepository({}, cacheManager).invalidateForTest();
  assert.equal(swapCache.get(1), undefined);
});

test('legacy all-locked solver output is repaired without unlocking v2 fixed lessons', () => {
  const legacy = repairLegacyLessonFixedness({
    schedule: [{ classId: 'c1', isFixed: true }],
    metadata: {},
  });
  assert.equal(legacy.schedule[0].isFixed, false);
  assert.equal(legacy.metadata.lessonFixednessVersion, 2);

  const current = repairLegacyLessonFixedness({
    schedule: [{ classId: 'c1', isFixed: true }],
    metadata: { lessonFixednessVersion: 2, fixedLessonCount: 1 },
  });
  assert.equal(current.schedule[0].isFixed, true);
});

test('swap persistence matches the full lesson identity before moving', () => {
  const payload = {
    schedule: [
      {
        classId: 'c1',
        subjectId: 's1',
        teacherIds: ['t1', 't2'],
        roomId: 'r1',
        isFixed: false,
        day: 'Saturday',
        periodIndex: 0,
      },
    ],
  };

  assert.throws(
    () =>
      applyLessonMovesToPayload(payload, [
        {
          classId: 'c1',
          subjectId: 's1',
          teacherId: 't1',
          teacherIds: ['t1'],
          roomId: 'r1',
          isFixed: false,
          fromDay: 'Saturday',
          fromPeriod: 0,
          toDay: 'Saturday',
          toPeriod: 1,
        },
      ]),
    /could not be applied atomically/
  );
});
