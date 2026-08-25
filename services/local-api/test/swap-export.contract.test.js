const assert = require('node:assert/strict');
const test = require('node:test');

const { exportRequestSchema } = require('../dist/src/schemas/export.schema');
const { applyLessonMovesToPayload } = require('../dist/src/routes/swap.routes');

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
        },
      ]),
    /could not be applied atomically/
  );
});
