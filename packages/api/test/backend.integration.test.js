const assert = require('node:assert/strict');
const { fork, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');

const apiRoot = path.resolve(__dirname, '..');
const serverEntry = path.join(apiRoot, 'dist', 'server.js');
const resetEntry = path.join(apiRoot, 'dist', 'scripts', 'reset-database.js');

function waitForExit(child) {
  return new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
}

async function startServer(databasePath) {
  const child = fork(serverEntry, [], {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_PATH: databasePath,
      HOST: '127.0.0.1',
      PORT: '0',
      CORS_ORIGINS: 'http://localhost:5173',
      LOG_LEVEL: 'error',
    },
    silent: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`API startup timed out:\n${output}`));
    }, 30_000);

    child.on('message', (message) => {
      if (message?.type === 'api-ready') {
        clearTimeout(timeout);
        resolve(message);
      } else if (message?.type === 'api-error') {
        clearTimeout(timeout);
        reject(new Error(`API startup failed: ${message.message}\n${output}`));
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`API exited before readiness (${code}):\n${output}`));
    });
  });

  return {
    baseUrl: `http://${ready.host}:${ready.port}/api`,
    child,
    output: () => output,
  };
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  const exited = waitForExit(server.child);
  server.child.kill('SIGTERM');
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`API shutdown timed out:\n${server.output()}`)), 10_000)
  );
  await Promise.race([exited, timeout]);
}

async function apiRequest(baseUrl, endpoint, options = {}) {
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
}

function runNode(entry, args, databasePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entry, ...args], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_PATH: databasePath, LOG_LEVEL: 'error' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.once('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

function generalConfigPayload(config, overrides = {}) {
  return {
    schoolId: config.schoolId,
    revision: config.revision,
    schoolName: config.schoolName,
    enablePrimary: config.enablePrimary,
    enableMiddle: config.enableMiddle,
    enableHigh: config.enableHigh,
    daysOfWeek: config.daysOfWeek,
    schoolStartTime: config.schoolStartTime,
    timezone: config.timezone,
    ramadanModeEnabled: config.ramadanModeEnabled,
    ramadanPeriodDuration: config.ramadanPeriodDuration,
    enableMinistryValidation: config.enableMinistryValidation,
    ministryValidationMode: config.ministryValidationMode,
    customCurriculumMode: config.customCurriculumMode,
    lowResourceMode: config.lowResourceMode,
    ...overrides,
  };
}

test(
  'managed SQLite lifecycle, API boundaries, adoption, and reset',
  { timeout: 90_000 },
  async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-api-'));
    const databasePath = path.join(temporaryDirectory, 'timetable.db');
    let server;

    try {
      server = await startServer(databasePath);

      const health = await apiRequest(server.baseUrl, '/health');
      assert.equal(health.status, 200);

      const allowedCors = await apiRequest(server.baseUrl, '/health', {
        headers: { origin: 'http://localhost:5173' },
      });
      assert.equal(allowedCors.status, 200);
      assert.equal(allowedCors.headers.get('access-control-allow-origin'), 'http://localhost:5173');

      const blockedCors = await apiRequest(server.baseUrl, '/health', {
        headers: { origin: 'https://untrusted.example' },
      });
      assert.equal(blockedCors.status, 403);

      const schoolConfigResponse = await apiRequest(server.baseUrl, '/config/school-config');
      assert.equal(schoolConfigResponse.status, 200);
      let schoolConfig = await schoolConfigResponse.json();
      assert.equal(schoolConfig.revision, 1);
      assert.deepEqual(schoolConfig.daysOfWeek, [
        'Saturday',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
      ]);
      assert.deepEqual(schoolConfig.periodsPerDayMap, {});
      assert.deepEqual(schoolConfig.breakPeriodsByDay, {});

      const duplicateConfigWrite = await apiRequest(server.baseUrl, '/config/school-config', {
        method: 'POST',
        body: JSON.stringify({ value: { legacy: true } }),
      });
      assert.equal(duplicateConfigWrite.status, 405);

      const periodUpdateResponse = await apiRequest(
        server.baseUrl,
        '/config/school-config/periods',
        {
          method: 'PATCH',
          body: JSON.stringify({
            schoolId: null,
            revision: schoolConfig.revision,
            defaultPeriodsPerDay: 8,
            periodDuration: 50,
            dynamicPeriodsEnabled: true,
            periodsPerDayMap: { Saturday: 6 },
            categoryPeriodsEnabled: true,
            categoryPeriodsMap: {},
            breakPeriods: [{ afterPeriod: 3, duration: 15 }],
            breakPeriodsByDay: { Sunday: [] },
            prayerBreaksEnabled: true,
            prayerBreaks: [{ name: 'Dhuhr', time: '12:00', duration: 10 }],
          }),
        }
      );
      const periodUpdateText = await periodUpdateResponse.text();
      assert.equal(periodUpdateResponse.status, 200, periodUpdateText);
      schoolConfig = JSON.parse(periodUpdateText);
      assert.equal(schoolConfig.revision, 2);
      assert.equal(schoolConfig.periodsPerDayMap.Saturday, 6);
      assert.equal(schoolConfig.periodsPerDayMap.Sunday, 8);
      assert.equal(schoolConfig.categoryPeriodsMap['Alpha-Primary'].Saturday, 8);
      assert.deepEqual(schoolConfig.breakPeriodsByDay.Sunday, []);

      const staleConfigUpdate = await apiRequest(server.baseUrl, '/config/school-config/general', {
        method: 'PATCH',
        body: JSON.stringify(generalConfigPayload(schoolConfig, { revision: 1 })),
      });
      assert.equal(staleConfigUpdate.status, 409);
      assert.equal((await staleConfigUpdate.json()).code, 'CONFIG_REVISION_CONFLICT');

      const generalUpdateResponse = await apiRequest(
        server.baseUrl,
        '/config/school-config/general',
        {
          method: 'PATCH',
          body: JSON.stringify(
            generalConfigPayload(schoolConfig, {
              schoolName: 'Lifecycle School',
              ramadanModeEnabled: true,
              ramadanPeriodDuration: 30,
              enableMinistryValidation: true,
              ministryValidationMode: 'strict',
              customCurriculumMode: true,
              lowResourceMode: true,
            })
          ),
        }
      );
      const generalUpdateText = await generalUpdateResponse.text();
      assert.equal(generalUpdateResponse.status, 200, generalUpdateText);
      schoolConfig = JSON.parse(generalUpdateText);
      assert.equal(schoolConfig.revision, 3);
      assert.equal(schoolConfig.schoolName, 'Lifecycle School');
      assert.equal(schoolConfig.customCurriculumMode, true);

      assert.equal((await apiRequest(server.baseUrl, '/teachers/12abc')).status, 400);
      assert.equal(
        (
          await apiRequest(server.baseUrl, '/timetables', {
            method: 'POST',
            body: JSON.stringify({ name: 'Missing data' }),
          })
        ).status,
        400
      );
      assert.equal((await apiRequest(server.baseUrl, '/reset', { method: 'POST' })).status, 404);
      assert.equal(
        (await apiRequest(server.baseUrl, '/assignments/cleanup-duplicates', { method: 'POST' }))
          .status,
        404
      );

      const invalidTeacherResponse = await apiRequest(server.baseUrl, '/teachers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Invalid numeric weekday',
          unavailable: [{ day: 0, period: 1 }],
        }),
      });
      assert.equal(invalidTeacherResponse.status, 400);

      const teacherResponse = await apiRequest(server.baseUrl, '/teachers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Preserved Teacher',
          availability: { Saturday: [true, false, true] },
          unavailable: [{ day: 'Saturday', period: 1 }],
        }),
      });
      const teacherResponseText = await teacherResponse.text();
      assert.equal(teacherResponse.status, 201, teacherResponseText);
      assert.deepEqual(JSON.parse(teacherResponseText).unavailable, [
        { day: 'Saturday', period: 1 },
      ]);

      const subjectResponse = await apiRequest(server.baseUrl, '/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Temporary Subject', grade: 5, periodsPerWeek: 3 }),
      });
      assert.equal(subjectResponse.status, 201, await subjectResponse.text());
      const subject = await (await apiRequest(server.baseUrl, '/subjects')).json();

      const classResponse = await apiRequest(server.baseUrl, '/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Grade 5 A',
          grade: 5,
          subjectRequirements: JSON.stringify([
            { subjectId: subject[0].id, periodsPerWeek: 3, teacherId: null },
          ]),
        }),
      });
      const classResponseText = await classResponse.text();
      assert.equal(classResponse.status, 201, classResponseText);
      assert.equal(JSON.parse(classResponseText).subjectRequirements.length, 1);

      const roomResponse = await apiRequest(server.baseUrl, '/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Room 1',
          capacity: 30,
          type: 'normal',
          features: JSON.stringify(['projector']),
          unavailable: [{ day: 'Sunday', period: 2 }],
        }),
      });
      const roomResponseText = await roomResponse.text();
      assert.equal(roomResponse.status, 201, roomResponseText);
      assert.deepEqual(JSON.parse(roomResponseText).features, ['projector']);
      assert.deepEqual(JSON.parse(roomResponseText).unavailable, [{ day: 'Sunday', period: 2 }]);

      const gradeBandConflict = await apiRequest(server.baseUrl, '/config/school-config/general', {
        method: 'PATCH',
        body: JSON.stringify(generalConfigPayload(schoolConfig, { enablePrimary: false })),
      });
      assert.equal(gradeBandConflict.status, 409);
      const gradeBandConflictBody = await gradeBandConflict.json();
      assert.equal(gradeBandConflictBody.code, 'GRADE_BAND_IN_USE');
      assert.equal(gradeBandConflictBody.band, 'primary');
      assert.equal(gradeBandConflictBody.classCount, 1);

      const audit = await apiRequest(server.baseUrl, '/assignments/audit');
      assert.equal(audit.status, 200);
      assert.equal((await audit.json()).isConsistent, true);

      await stopServer(server);
      server = undefined;

      let database = new Database(databasePath);
      assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
      assert.deepEqual(database.pragma('foreign_key_check'), []);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM migrations').get().count, 8);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM teacher').get().count, 1);
      assert.equal(
        database.prepare('SELECT COUNT(*) AS count FROM class_subject_requirement').get().count,
        1
      );
      assert.ok(database.pragma('foreign_key_list(class_subject_requirement)').length >= 2);
      const storedConfig = database
        .prepare(
          'SELECT revision, schoolName, daysOfWeekJson, periodsPerDayMapJson, breakPeriodsByDayJson FROM school_config WHERE schoolId IS NULL'
        )
        .get();
      assert.equal(storedConfig.revision, 3);
      assert.equal(storedConfig.schoolName, 'Lifecycle School');
      assert.equal(JSON.parse(storedConfig.periodsPerDayMapJson).Sunday, 8);
      assert.deepEqual(JSON.parse(storedConfig.breakPeriodsByDayJson).Sunday, []);

      // Simulate a synchronized pre-migration database: complete schema and data, no migration ledger.
      database.exec('DROP TABLE migrations');
      database.close();

      server = await startServer(databasePath);
      await stopServer(server);
      server = undefined;

      database = new Database(databasePath);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM migrations').get().count, 8);
      assert.equal(
        database.prepare('SELECT fullName FROM teacher WHERE id = 1').get().fullName,
        'Preserved Teacher'
      );
      database.close();
      assert.ok(
        fs.readdirSync(temporaryDirectory).some((name) => name.startsWith('timetable.db.backup-')),
        'existing database should be backed up before migration adoption'
      );

      const refusedReset = await runNode(resetEntry, [], databasePath);
      assert.notEqual(refusedReset.code, 0);
      assert.match(refusedReset.stderr, /Reset refused/);

      const completedReset = await runNode(
        resetEntry,
        ['--confirm', 'RESET_ALL_DATA'],
        databasePath
      );
      assert.equal(completedReset.code, 0, completedReset.stderr);

      database = new Database(databasePath);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM teacher').get().count, 1);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM subject').get().count, 0);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM timetable').get().count, 0);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM class_group').get().count, 0);
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM room').get().count, 0);
      assert.equal(
        database.prepare('SELECT COUNT(*) AS count FROM class_subject_requirement').get().count,
        0
      );
      assert.equal(
        database.prepare('SELECT classAssignments FROM teacher WHERE id = 1').get()
          .classAssignments,
        '[]'
      );
      assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
      assert.deepEqual(database.pragma('foreign_key_check'), []);
      database.close();
      assert.ok(
        fs
          .readdirSync(temporaryDirectory)
          .some((name) => name.startsWith('timetable.db.reset-backup-')),
        'reset should create a recoverable backup'
      );
    } finally {
      if (server) await stopServer(server);
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
);

test('services and caches are isolated per DataSource and transaction outcome', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { TeacherRepository } = require('../dist/src/database/repositories/teacher.repository');
  const { runCommittedTransaction } = require('../dist/src/database/transaction');
  const { TeacherService } = require('../dist/src/services/teacher.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-scope-'));
  const firstDataSource = new DataSource({
    ...AppDataSource.options,
    database: path.join(temporaryDirectory, 'first.db'),
  });
  const secondDataSource = new DataSource({
    ...AppDataSource.options,
    database: path.join(temporaryDirectory, 'second.db'),
  });
  const firstCache = new CacheManager();
  const secondCache = new CacheManager();

  try {
    await Promise.all([firstDataSource.initialize(), secondDataSource.initialize()]);
    const firstService = TeacherService.getInstance(firstDataSource, firstCache);
    const secondService = TeacherService.getInstance(secondDataSource, secondCache);
    assert.notEqual(firstService, secondService);

    assert.equal((await firstService.create({ fullName: 'First database' })).success, true);
    assert.equal((await secondService.create({ fullName: 'Second database' })).success, true);

    const firstRepository = TeacherRepository.getInstance(firstDataSource, firstCache);
    assert.equal((await firstRepository.getTeacher(1)).fullName, 'First database');

    await assert.rejects(
      firstDataSource.transaction(async (manager) => {
        await firstRepository.updateTeacher(1, { fullName: 'Must roll back' }, { manager });
        throw new Error('rollback');
      }),
      /rollback/
    );
    assert.equal((await firstRepository.getTeacher(1)).fullName, 'First database');

    await runCommittedTransaction(firstDataSource, firstCache, async (manager) => {
      await firstRepository.updateTeacher(1, { fullName: 'Committed name' }, { manager });
    });
    assert.equal((await firstRepository.getTeacher(1)).fullName, 'Committed name');
    assert.equal((await secondService.findById(1)).data.fullName, 'Second database');
  } finally {
    if (firstDataSource.isInitialized) await firstDataSource.destroy();
    if (secondDataSource.isInitialized) await secondDataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('school configuration reaches solver input without dormant settings leaking through', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { SchoolConfigService } = require('../dist/src/services/schoolConfig.service');
  const {
    SolverDataTransformerService,
  } = require('../dist/src/services/solverDataTransformer.service');
  const { TeacherService } = require('../dist/src/services/teacher.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-solver-config-'));
  const dataSource = new DataSource({
    ...AppDataSource.options,
    database: path.join(temporaryDirectory, 'solver.db'),
  });
  const cache = new CacheManager();

  try {
    await dataSource.initialize();
    const configService = SchoolConfigService.getInstance(dataSource, cache);
    let config = await configService.getConfig();
    config = await configService.updateGeneral(
      generalConfigPayload(config, {
        daysOfWeek: ['Saturday', 'Sunday'],
        ramadanModeEnabled: true,
        ramadanPeriodDuration: 30,
        enableMinistryValidation: true,
        ministryValidationMode: 'strict',
        customCurriculumMode: true,
        lowResourceMode: true,
      })
    );
    config = await configService.updatePeriods({
      schoolId: null,
      revision: config.revision,
      defaultPeriodsPerDay: 5,
      periodDuration: 40,
      dynamicPeriodsEnabled: false,
      periodsPerDayMap: { Saturday: 2 },
      categoryPeriodsEnabled: false,
      categoryPeriodsMap: { High: { Saturday: 3 } },
      breakPeriods: [{ afterPeriod: 1, duration: 10 }],
      breakPeriodsByDay: { Sunday: [] },
      prayerBreaksEnabled: true,
      prayerBreaks: [{ name: 'Dhuhr', time: '12:00', duration: 10 }],
    });
    assert.deepEqual(config.periodsPerDayMap, {});
    assert.deepEqual(config.categoryPeriodsMap, {});

    await assert.rejects(
      configService.updatePeriods({
        schoolId: null,
        revision: config.revision,
        defaultPeriodsPerDay: 5,
        periodDuration: 40,
        dynamicPeriodsEnabled: false,
        periodsPerDayMap: {},
        categoryPeriodsEnabled: true,
        categoryPeriodsMap: {
          'Alpha-Primary': { Saturday: 3, Sunday: 3 },
          'Beta-Primary': { Saturday: 3, Sunday: 3 },
          Middle: { Saturday: 3, Sunday: 3 },
          High: { Saturday: 3, Sunday: 3 },
        },
        breakPeriods: [{ afterPeriod: 4, duration: 10 }],
        breakPeriodsByDay: {},
        prayerBreaksEnabled: false,
        prayerBreaks: [],
      }),
      /must be less than 3/
    );

    const teacherService = TeacherService.getInstance(dataSource, cache);
    const teacherResult = await teacherService.create({
      fullName: 'Availability Teacher',
      availability: {
        Saturday: [false, true],
        Sunday: [true, false],
      },
      unavailable: [
        { day: 'Saturday', period: 1 },
        { day: 'Saturday', period: 3 },
      ],
    });
    assert.equal(teacherResult.success, true);

    const transformer = SolverDataTransformerService.getInstance(dataSource, cache);
    const solverInput = await transformer.transformToSolverInput();
    assert.deepEqual(solverInput.config.daysOfWeek, ['Saturday', 'Sunday']);
    assert.deepEqual(solverInput.config.periodsPerDayMap, { Saturday: 5, Sunday: 5 });
    assert.equal(solverInput.config.categoryPeriodsPerDayMap, undefined);
    assert.equal(solverInput.config.ramadanModeEnabled, true);
    assert.equal(solverInput.config.ramadanPeriodDuration, 30);
    assert.equal(solverInput.config.enableMinistryValidation, true);
    assert.equal(solverInput.config.ministryValidationMode, 'strict');
    assert.equal(solverInput.config.customCurriculumMode, true);
    assert.equal(solverInput.config.lowResourceMode, true);
    assert.deepEqual(solverInput.config.breakPeriodsByDay.Sunday, []);
    assert.deepEqual(solverInput.teachers[0].availability.Saturday, [false, true]);
    assert.deepEqual(solverInput.teachers[0].unavailable, [{ day: 'Saturday', periods: [1, 3] }]);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('display timing applies regular and prayer intervals without creating solver slots', () => {
  const {
    buildScheduleTiming,
    enrichGeneratedScheduleTiming,
  } = require('../dist/src/services/scheduleTiming.service');
  const {
    getBreakIntervals,
    getPeriodTimeRange,
    normalizeTimetableForExport,
  } = require('../dist/src/services/exportTimetableNormalizer');

  const config = {
    id: 1,
    schoolId: null,
    revision: 1,
    schoolName: null,
    enablePrimary: true,
    enableMiddle: true,
    enableHigh: true,
    daysOfWeek: ['Saturday', 'Sunday'],
    daysPerWeek: 2,
    schoolStartTime: '07:30',
    timezone: 'Asia/Kabul',
    ramadanModeEnabled: false,
    ramadanPeriodDuration: 30,
    enableMinistryValidation: false,
    ministryValidationMode: 'off',
    customCurriculumMode: false,
    autoPopulateCurriculum: true,
    lowResourceMode: false,
    defaultPeriodsPerDay: 3,
    periodDuration: 45,
    dynamicPeriodsEnabled: false,
    periodsPerDayMap: {},
    categoryPeriodsEnabled: false,
    categoryPeriodsMap: {},
    breakPeriods: [{ afterPeriod: 1, duration: 10 }],
    breakPeriodsByDay: { Sunday: [] },
    prayerBreaksEnabled: true,
    prayerBreaks: [{ name: 'Dhuhr', time: '09:00', duration: 20 }],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };

  const timing = buildScheduleTiming(config);
  assert.deepEqual(timing.periodTimelineByDay.Saturday, [
    { periodIndex: 0, startTime: '07:30', endTime: '08:15' },
    { periodIndex: 1, startTime: '09:20', endTime: '10:05' },
    { periodIndex: 2, startTime: '10:05', endTime: '10:50' },
  ]);
  assert.deepEqual(
    timing.breakIntervalsByDay.Saturday.filter((interval) => interval.kind === 'regular'),
    [
      {
        kind: 'regular',
        startTime: '08:15',
        endTime: '08:25',
        duration: 10,
        afterPeriod: 1,
      },
    ]
  );
  assert.deepEqual(
    timing.breakIntervalsByDay.Sunday.filter((interval) => interval.kind === 'regular'),
    []
  );

  const solverData = {
    lessons: [{ day: 'Saturday', periodIndex: 0 }],
    metadata: { periodConfiguration: { periodsPerDayMap: { Saturday: 3, Sunday: 3 } } },
  };
  const enriched = enrichGeneratedScheduleTiming(solverData, config);
  assert.equal(enriched.lessons.length, 1);
  assert.deepEqual(enriched.metadata.periodConfiguration.periodsPerDayMap, {
    Saturday: 3,
    Sunday: 3,
  });
  assert.equal(enriched.metadata.periodConfiguration.periodTimelineByDay.Saturday.length, 3);

  const exportData = normalizeTimetableForExport(enriched);
  assert.deepEqual(getPeriodTimeRange(exportData, 'Saturday', 1), {
    startTime: '09:20',
    endTime: '10:05',
  });
  assert.equal(getBreakIntervals(exportData, 'Saturday').length, 2);

  const malformedExportData = normalizeTimetableForExport({
    lessons: [],
    metadata: {
      periodConfiguration: {
        periodTimelineByDay: { Saturday: 'not-an-array' },
        breakIntervalsByDay: { Saturday: [{ kind: 'regular', duration: 'invalid' }] },
      },
    },
  });
  assert.equal(getPeriodTimeRange(malformedExportData, 'Saturday', 0), null);
  assert.deepEqual(getBreakIntervals(malformedExportData, 'Saturday'), []);
});

test(
  'repair migration normalizes legacy JSON and numeric weekday slots',
  { timeout: 60_000 },
  async () => {
    const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-config-repair-'));
    const databasePath = path.join(temporaryDirectory, 'legacy.db');
    let server;

    try {
      server = await startServer(databasePath);
      assert.equal((await apiRequest(server.baseUrl, '/config/school-config')).status, 200);
      await stopServer(server);
      server = undefined;

      let database = new Database(databasePath);
      database.exec('DROP INDEX IF EXISTS "UQ_school_config_default"');
      database.exec('ALTER TABLE school_config DROP COLUMN prayerBreaksEnabled');
      database.exec('ALTER TABLE school_config DROP COLUMN revision');
      database.exec(
        'CREATE UNIQUE INDEX "UQ_school_config_default" ON "school_config" ((1)) WHERE "schoolId" IS NULL'
      );
      database
        .prepare('DELETE FROM migrations WHERE name = ?')
        .run('RepairSchoolConfigFlow1783900000000');
      database
        .prepare(
          `UPDATE school_config
            SET daysOfWeekJson = ?, periodsPerDayMapJson = ?, prayerBreaksJson = ?
          WHERE schoolId IS NULL`
        )
        .run(
          JSON.stringify(JSON.stringify(['Saturday', 'Sunday'])),
          JSON.stringify(JSON.stringify({ Saturday: 4, Sunday: 5 })),
          JSON.stringify([{ name: 'Dhuhr', time: '12:00', duration: 10 }])
        );
      database
        .prepare(
          `INSERT INTO teacher
          (fullName, primarySubjectIds, availability, unavailable, maxPeriodsPerWeek,
           preferredRoomIds, classAssignments)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'Legacy Teacher',
          '[]',
          JSON.stringify([
            [false, true],
            [true, false],
          ]),
          JSON.stringify(JSON.stringify([{ day: 0, period: 1 }])),
          30,
          JSON.stringify(JSON.stringify([])),
          JSON.stringify(JSON.stringify([]))
        );
      database
        .prepare(
          'INSERT INTO room (name, capacity, type, features, unavailable, meta) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          'Legacy Room',
          20,
          'normal',
          JSON.stringify(JSON.stringify(['board'])),
          JSON.stringify(JSON.stringify([{ day: 1, period: 2 }])),
          JSON.stringify(JSON.stringify({ floor: 1 }))
        );
      database.close();

      server = await startServer(databasePath);
      await stopServer(server);
      server = undefined;

      database = new Database(databasePath);
      const repairedConfig = database
        .prepare(
          'SELECT revision, prayerBreaksEnabled, daysOfWeekJson, periodsPerDayMapJson FROM school_config WHERE schoolId IS NULL'
        )
        .get();
      assert.equal(repairedConfig.revision, 1);
      assert.equal(repairedConfig.prayerBreaksEnabled, 1);
      assert.deepEqual(JSON.parse(repairedConfig.daysOfWeekJson), ['Saturday', 'Sunday']);
      assert.deepEqual(JSON.parse(repairedConfig.periodsPerDayMapJson), {
        Saturday: 4,
        Sunday: 5,
      });

      const repairedTeacher = database
        .prepare(
          'SELECT availability, unavailable, preferredRoomIds, classAssignments FROM teacher'
        )
        .get();
      assert.deepEqual(JSON.parse(repairedTeacher.availability), {
        Saturday: [false, true],
        Sunday: [true, false],
      });
      assert.deepEqual(JSON.parse(repairedTeacher.unavailable), [{ day: 'Saturday', period: 1 }]);
      assert.deepEqual(JSON.parse(repairedTeacher.preferredRoomIds), []);
      assert.deepEqual(JSON.parse(repairedTeacher.classAssignments), []);

      const repairedRoom = database.prepare('SELECT features, unavailable, meta FROM room').get();
      assert.deepEqual(JSON.parse(repairedRoom.features), ['board']);
      assert.deepEqual(JSON.parse(repairedRoom.unavailable), [{ day: 'Sunday', period: 2 }]);
      assert.deepEqual(JSON.parse(repairedRoom.meta), { floor: 1 });
      assert.equal(database.prepare('SELECT COUNT(*) AS count FROM migrations').get().count, 8);
      assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
      database.close();
    } finally {
      if (server) await stopServer(server);
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
);
