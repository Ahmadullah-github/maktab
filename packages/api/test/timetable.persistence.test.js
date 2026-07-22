const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateGeneratedTimetable,
} = require('../dist/src/services/generatedTimetableValidation.service.js');

function solverInput() {
  return {
    config: {
      daysOfWeek: ['Saturday'],
      periodsPerDay: 2,
      periodsPerDayMap: { Saturday: 2 },
    },
    teachers: [
      { id: 't1', maxPeriodsPerWeek: 2, availability: { Saturday: [true, true] }, unavailable: [] },
    ],
    subjects: [{ id: 's1' }],
    classes: [
      { id: 'c1', studentCount: 10, subjectRequirements: { s1: { periodsPerWeek: 1 } } },
    ],
    rooms: [{ id: 'r1', type: 'normal', capacity: 20, unavailable: [] }],
    fixedTeacherAssignments: [
      { teacherId: 't1', classId: 'c1', subjectId: 's1', periodsPerWeek: 1 },
    ],
  };
}

test('generated timetable validation accepts a canonical valid payload', () => {
  const issues = validateGeneratedTimetable(
    {
      schedule: [
        {
          day: 'Saturday',
          periodIndex: 0,
          classId: 'c1',
          subjectId: 's1',
          teacherIds: ['t1'],
          roomId: 'r1',
        },
      ],
    },
    solverInput()
  );
  assert.deepEqual(issues, []);
});

test('generated timetable validation rejects collisions and count drift', () => {
  const lesson = {
    day: 'Saturday',
    periodIndex: 0,
    classId: 'c1',
    subjectId: 's1',
    teacherIds: ['t1'],
    roomId: 'r1',
  };
  const codes = validateGeneratedTimetable({ schedule: [lesson, lesson] }, solverInput()).map(
    (issue) => issue.code
  );
  assert.ok(codes.includes('CLASS_COLLISION'));
  assert.ok(codes.includes('TEACHER_COLLISION'));
  assert.ok(codes.includes('ROOM_COLLISION'));
  assert.ok(codes.includes('REQUIREMENT_COUNT_MISMATCH'));
  assert.ok(codes.includes('TEACHER_ASSIGNMENT_MISMATCH'));
});

test('fixed room overrides room availability, type, and capacity validation', () => {
  const input = solverInput();
  input.classes[0].fixedRoomId = 'r1';
  input.classes[0].studentCount = 100;
  input.subjects[0] = {
    id: 's1',
    requiredRoomType: 'laboratory',
    minRoomCapacity: 100,
  };
  input.rooms[0] = {
    id: 'r1',
    type: 'normal',
    capacity: 1,
    unavailable: [{ day: 'Saturday', periods: [0] }],
  };

  const codes = validateGeneratedTimetable(
    {
      schedule: [
        {
          day: 'Saturday',
          periodIndex: 0,
          classId: 'c1',
          subjectId: 's1',
          teacherIds: ['t1'],
          roomId: 'r1',
        },
      ],
    },
    input
  ).map((issue) => issue.code);

  assert.deepEqual(codes, []);
});

test('non-fixed classes retain room validation', () => {
  const input = solverInput();
  input.classes[0].studentCount = 100;
  input.subjects[0] = {
    id: 's1',
    requiredRoomType: 'laboratory',
    minRoomCapacity: 100,
  };
  input.rooms[0] = {
    id: 'r1',
    type: 'normal',
    capacity: 1,
    unavailable: [{ day: 'Saturday', periods: [0] }],
  };

  const codes = validateGeneratedTimetable(
    {
      schedule: [
        {
          day: 'Saturday',
          periodIndex: 0,
          classId: 'c1',
          subjectId: 's1',
          teacherIds: ['t1'],
          roomId: 'r1',
        },
      ],
    },
    input
  ).map((issue) => issue.code);

  assert.ok(codes.includes('ROOM_UNAVAILABLE'));
  assert.ok(codes.includes('ROOM_TYPE_MISMATCH'));
  assert.ok(codes.includes('ROOM_CAPACITY'));
});

test('fixed room still requires the exact assigned room', () => {
  const input = solverInput();
  input.classes[0].fixedRoomId = 'r1';
  input.rooms.push({ id: 'r2', type: 'normal', capacity: 20, unavailable: [] });

  const codes = validateGeneratedTimetable(
    {
      schedule: [
        {
          day: 'Saturday',
          periodIndex: 0,
          classId: 'c1',
          subjectId: 's1',
          teacherIds: ['t1'],
          roomId: 'r2',
        },
      ],
    },
    input
  ).map((issue) => issue.code);

  assert.ok(codes.includes('FIXED_ROOM_MISMATCH'));
});
