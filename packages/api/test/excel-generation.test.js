const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');

const { ExcelGenerationService } = require('../dist/src/services/excelGeneration.service');
const {
  ExportErrorHandler,
  ExportErrorType,
} = require('../dist/src/services/exportError.service');

const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const pixelPng =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function createTimetable(periodCount = 6) {
  const periodTimelineByDay = Object.fromEntries(
    days.map((day, dayIndex) => [
      day,
      Array.from({ length: periodCount }, (_, periodIndex) => ({
        periodIndex,
        startTime:
          day === 'Wednesday' && periodIndex === 0
            ? '08:10'
            : `${String(8 + periodIndex).padStart(2, '0')}:00`,
        endTime:
          day === 'Wednesday' && periodIndex === 0
            ? '08:50'
            : `${String(8 + periodIndex).padStart(2, '0')}:40`,
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
      periodsPerDayMap: Object.fromEntries(
        days.map((day) => [day, day === 'Thursday' ? Math.max(periodCount - 1, 1) : periodCount])
      ),
      totalPeriodsPerWeek: days.length * periodCount - 1,
      hasVariablePeriods: true,
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
            kind: 'regular',
            name: 'Lunch',
            startTime: '11:40',
            endTime: '12:00',
            duration: 20,
            afterPeriod: 4,
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
  logoBase64: pixelPng,
  logoMimeType: 'image/png',
  ministryLogoBase64: pixelPng,
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
    branding,
    ...overrides,
  };
}

async function generateWorkbook(options) {
  const buffer = await new ExcelGenerationService().generateExcel(options);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return { buffer, workbook };
}

function allCellValues(worksheet) {
  const values = [];
  worksheet.eachRow((row) =>
    row.eachCell({ includeEmpty: true }, (cell) => values.push(cell.value == null ? '' : String(cell.value)))
  );
  return values;
}

test('Excel export is editable, bilingual, portable, and arranged as days by periods', async () => {
  const { buffer, workbook } = await generateWorkbook(createOptions());
  assert.ok(buffer.length > 1000);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Guide - راهنما', '7-B']);

  const guide = workbook.worksheets[0];
  const guideText = allCellValues(guide).join('\n');
  assert.match(guideText, /This workbook is editable/);
  assert.match(guideText, /این فایل در برنامه‌های صفحه‌گسترده قابل ویرایش است/);
  assert.match(guideText, /not imported back into Maktab/);
  assert.match(guideText, /دوباره به سیستم مکتب وارد نمی‌شود/);
  assert.equal(guide.sheetProtection, undefined);

  const sheet = workbook.worksheets[1];
  assert.equal(sheet.views[0].rightToLeft, false);
  assert.equal(sheet.views[0].state, 'frozen');
  assert.equal(sheet.pageSetup.paperSize, 9);
  assert.equal(sheet.pageSetup.orientation, 'landscape');
  assert.equal(sheet.pageSetup.fitToWidth, 1);
  assert.equal(sheet.pageSetup.fitToHeight, 1);
  assert.match(sheet.pageSetup.printArea, /^A1:G\d+$/);
  assert.equal(sheet.sheetProtection, undefined);

  assert.equal(sheet.getCell('A7').value, 'Day');
  assert.equal(sheet.getCell('A1').value, '');
  assert.equal(sheet.getCell('G1').value, '');
  assert.match(sheet.getCell('B7').value, /^Period 1/);
  assert.equal(sheet.getCell('A8').value, 'Saturday');
  assert.equal(sheet.getCell('A13').value, 'Thursday');
  assert.equal(sheet.getCell('G13').value, '—');

  const classCell = sheet.getCell('B8');
  assert.equal(classCell.value, '08:00–08:40\nMathematics\nAhmad, Mariam');
  assert.doesNotMatch(classCell.value, /Room 4/);
  assert.equal(classCell.protection.locked, false);
  assert.match(String(sheet.getCell('A5').value), /Class: 7-B/);
  assert.match(String(sheet.getCell('E5').value), /Class teacher: _+/);
  assert.match(String(sheet.getCell('A6').value), /Kabul, Afghanistan/);
  assert.match(String(sheet.getCell('A6').value), /school\.example/);

  const sheetText = allCellValues(sheet).join('\n');
  assert.match(sheetText, /Lunch: 11:40–12:00/);
  assert.match(sheetText, /Prayer break: 12:40–13:00/);
  assert.doesNotMatch(sheetText, /10:40–11:00/);

  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow((row) =>
      row.eachCell({ includeEmpty: true }, (cell) => {
        assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
      })
    );
  }
  assert.equal(workbook.model.media.length, 2, 'images are registered once per workbook');
});

test('teacher exports prioritize the class and retain optional room data', async () => {
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
  const { workbook } = await generateWorkbook(teacherOptions);
  const sheet = workbook.worksheets[1];
  assert.equal(sheet.getCell('A5').value, 'Teacher: Ahmad');
  assert.equal(sheet.getCell('B8').value, '08:00–08:40\n7-B\nMathematics\nRoom 4');
  assert.doesNotMatch(sheet.getCell('B8').value, /Ahmad|Mariam/);
});

test('Persian exports use RTL sheets, Persian labels, and remain editable', async () => {
  const { workbook } = await generateWorkbook(createOptions({ language: 'fa' }));
  const sheet = workbook.worksheets[1];
  assert.equal(sheet.views[0].rightToLeft, true);
  assert.equal(sheet.getCell('A7').value, 'روز');
  assert.equal(sheet.getCell('A8').value, 'شنبه');
  assert.match(String(sheet.getCell('A4').value), /برنامه درسی هفتگی صنف/);
  assert.match(String(sheet.getCell('A6').value), /هجری قمری محاسبه‌شده/);
  assert.equal(sheet.sheetProtection, undefined);
});

test('workbooks cap the printable schedule grid at twelve periods and keep sheet names valid', async () => {
  const schedules = [
    {
      ...createOptions().schedules[0],
      name: 'Guide - راهنما',
      timetableData: createTimetable(14),
    },
    {
      ...createOptions().schedules[0],
      id: 2,
      targetId: 'class-2',
      name: 'Guide - راهنما',
      timetableData: createTimetable(14),
    },
  ];
  const { workbook } = await generateWorkbook(createOptions({ schedules }));
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    'Guide - راهنما',
    'Guide - راهنما (1)',
    'Guide - راهنما (2)',
  ]);
  assert.equal(workbook.worksheets[1].columnCount, 13);
  assert.match(workbook.worksheets[1].pageSetup.printArea, /^A1:M\d+$/);
});

test('typed export errors provide localized, safe API responses and stable statuses', async () => {
  const service = new ExcelGenerationService();
  await assert.rejects(
    service.generateExcel(createOptions({ schedules: [] })),
    (error) => error.type === ExportErrorType.VALIDATION && error.retryable === false
  );

  const writeError = ExportErrorHandler.fileWriteError(new Error('denied'), '/secret/export.xlsx');
  assert.deepEqual(writeError.toJSON('fa'), {
    error: ExportErrorType.FILE_WRITE,
    message: 'خطا در ذخیره فایل',
    retryable: true,
  });
  assert.equal(ExportErrorHandler.getHttpStatus(writeError), 500);
  assert.equal(
    ExportErrorHandler.getHttpStatus(ExportErrorHandler.scheduleNotFoundError(44)),
    404
  );
  assert.equal(ExportErrorHandler.getHttpStatus(ExportErrorHandler.networkTimeoutError()), 504);
  assert.equal(ExportErrorHandler.getHttpStatus(ExportErrorHandler.cancelledError()), 409);
});
