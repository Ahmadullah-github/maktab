const assert = require('node:assert/strict');
const test = require('node:test');

const { PDFGenerationService } = require('../dist/src/services/pdfGeneration.service');

const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function createTimetable(periodCount = 6) {
  const periodTimelineByDay = Object.fromEntries(
    days.map((day) => [
      day,
      Array.from({ length: periodCount }, (_, periodIndex) => ({
        periodIndex,
        startTime: `${String(8 + periodIndex).padStart(2, '0')}:00`,
        endTime: `${String(8 + periodIndex).padStart(2, '0')}:40`,
      })),
    ])
  );

  return {
    lessons: [
      {
        day: 'Saturday',
        periodIndex: 0,
        classId: 'class-1',
        className: '7-B',
        subjectId: 'subject-1',
        subjectName: 'Mathematics',
        teacherIds: ['teacher-1', 'teacher-2'],
        teacherNames: ['Ahmad', 'Mariam'],
        roomId: 'room-1',
        roomName: 'Room 4',
        isFixed: false,
        periodsThisDay: periodCount,
      },
    ],
    periodConfiguration: {
      daysOfWeek: days,
      periodsPerDayMap: Object.fromEntries(days.map((day) => [day, periodCount])),
      totalPeriodsPerWeek: days.length * periodCount,
      hasVariablePeriods: false,
      periodTimelineByDay,
      breakIntervalsByDay: {
        Saturday: [
          {
            kind: 'regular',
            startTime: '10:40',
            endTime: '11:00',
            duration: 20,
            afterPeriod: 3,
          },
          {
            kind: 'prayer',
            name: 'Prayer break',
            startTime: '12:40',
            endTime: '13:00',
            duration: 20,
            afterPeriod: 5,
          },
        ],
      },
    },
  };
}

const branding = {
  schoolName: 'Example & School',
  generatedAt: '2026-07-22T08:00:00.000Z',
  address: 'Kabul, Afghanistan',
  website: 'school.example',
  ministryLogoBase64: 'iVBORw0KGgo=',
  ministryLogoMimeType: 'image/png',
};

const displaySettings = {
  showSubjectName: true,
  showTeacherName: true,
  showRoomName: false,
  cellSize: 'normal',
  fontSize: 'md',
  colorBy: 'none',
};

function createOptions(overrides = {}) {
  return {
    schedules: [
      {
        id: 1,
        name: '7-B',
        type: 'class',
        targetId: 'class-1',
        classTeacherName: null,
        timetableData: createTimetable(),
      },
    ],
    language: 'en',
    displaySettings,
    includeAnalysis: false,
    branding,
    ...overrides,
  };
}

test('formal schedule HTML uses a branded landscape day-by-period layout', async () => {
  const service = new PDFGenerationService();
  const html = await service.generateHTML(createOptions());

  assert.match(html, /@page \{ size: A4 landscape; margin: 0; \}/);
  assert.match(html, /Example &amp; School/);
  assert.match(html, /data:image\/png;base64,iVBORw0KGgo=/);
  assert.match(html, /WEEKLY CLASS TIMETABLE/);
  assert.match(html, /Class teacher:<\/span><span class="blank-value"/);
  assert.ok(html.indexOf('class="day-column"') < html.indexOf('Period 1'));
  assert.match(html, /Ahmad, Mariam/);
  assert.doesNotMatch(html, /Room 4/);
  assert.match(html, /Prayer break: 12:40–13:00/);
  assert.doesNotMatch(html, /10:40–11:00/);
  assert.match(html, /Kabul, Afghanistan · school\.example/);
  assert.match(html, /Page 1 of 1/);
});

test('teacher timetables prioritize class names and show teacher identity in the metadata', async () => {
  const service = new PDFGenerationService();
  const teacherOptions = createOptions({
    displaySettings: { ...displaySettings, showRoomName: true },
    schedules: [
      {
        id: 2,
        name: 'Ahmad',
        type: 'teacher',
        targetId: 'teacher-1',
        timetableData: createTimetable(),
      },
    ],
  });
  const html = await service.generateHTML(teacherOptions);

  assert.match(html, /WEEKLY TEACHER TIMETABLE/);
  assert.match(html, /class="metadata-strip teacher-metadata"/);
  assert.match(html, /Teacher:<\/span><span class="metadata-value" dir="auto">Ahmad/);
  assert.doesNotMatch(html, /Schedule type: Teacher timetable/);
  assert.match(html, /class="class-name lesson-primary" dir="auto">7-B/);
  assert.match(html, /class="subject-name lesson-secondary" dir="auto">Mathematics/);
  assert.ok(html.indexOf('class="class-name lesson-primary"') < html.indexOf('class="subject-name lesson-secondary"'));
  assert.match(html, /class="room-name" dir="auto">Room 4/);
  assert.doesNotMatch(html, /class="teacher-name">Ahmad/);

  const dariHtml = await service.generateHTML({ ...teacherOptions, language: 'fa' });
  assert.match(dariHtml, /نام استاد:<\/span><span class="metadata-value" dir="auto">Ahmad/);
  assert.doesNotMatch(dariHtml, /نوع برنامه/);
});

test('more than ten periods split into continuation pages and analysis stays opt-in', () => {
  const service = new PDFGenerationService();
  const schedules = [
    { ...createOptions().schedules[0], timetableData: createTimetable(12) },
    { ...createOptions().schedules[0], id: 2, targetId: 'class-2', name: '8-A' },
  ];

  assert.equal(service.getExpectedPageCount(createOptions({ schedules })), 3);
  assert.equal(
    service.getExpectedPageCount(
      createOptions({
        schedules,
        includeAnalysis: true,
        analysisSummary: {
          totalClasses: 2,
          totalTeachers: 2,
          totalSubjects: 1,
          totalRooms: 1,
          utilizationRate: 0.75,
          conflictCount: 0,
          generatedAt: branding.generatedAt,
        },
      })
    ),
    4
  );
});

test('PDF export fails clearly when the mandatory Ministry logo is unavailable', async () => {
  const service = new PDFGenerationService();
  await assert.rejects(
    service.generateHTML(
      createOptions({ branding: { ...branding, ministryLogoBase64: undefined } })
    ),
    /Ministry of Education logo is required/
  );
});
