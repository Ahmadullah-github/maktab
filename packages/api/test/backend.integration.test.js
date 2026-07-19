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

function assertCompleteMigrationLedger(database) {
  const { AppDataSource } = require('../dist/ormconfig');
  const expectedNames = AppDataSource.options.migrations
    .map((Migration) => new Migration().name || Migration.name)
    .sort();
  const actualNames = database
    .prepare('SELECT name FROM migrations ORDER BY name')
    .all()
    .map(({ name }) => name);
  assert.deepEqual(actualNames, expectedNames);
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

      const retiredTeacherLimitResponse = await apiRequest(server.baseUrl, '/teachers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Retired limits',
          staffCode: 'T-RETIRED-LIMITS',
          maxPeriodsPerDay: 4,
        }),
      });
      assert.equal(retiredTeacherLimitResponse.status, 400);

      const teacherResponse = await apiRequest(server.baseUrl, '/teachers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Preserved Teacher',
          staffCode: 'T-PRESERVED',
          unavailable: [{ day: 'Saturday', period: 1 }],
        }),
      });
      const teacherResponseText = await teacherResponse.text();
      assert.equal(teacherResponse.status, 201, teacherResponseText);
      assert.deepEqual(JSON.parse(teacherResponseText).unavailable, [
        { day: 'Saturday', period: 1 },
      ]);
      assert.equal(Object.hasOwn(JSON.parse(teacherResponseText), 'availability'), false);

      const invalidCalendarShrink = await apiRequest(
        server.baseUrl,
        '/config/school-config/periods',
        {
          method: 'PATCH',
          body: JSON.stringify({
            schoolId: null,
            revision: schoolConfig.revision,
            defaultPeriodsPerDay: 1,
            periodDuration: schoolConfig.periodDuration,
            dynamicPeriodsEnabled: true,
            periodsPerDayMap: Object.fromEntries(
              schoolConfig.daysOfWeek.map((day) => [day, 1])
            ),
            categoryPeriodsEnabled: false,
            categoryPeriodsMap: {},
            breakPeriods: [],
            breakPeriodsByDay: {},
            prayerBreaksEnabled: false,
            prayerBreaks: [],
          }),
        }
      );
      assert.equal(invalidCalendarShrink.status, 409);
      const calendarConflict = await invalidCalendarShrink.json();
      assert.equal(calendarConflict.code, 'AVAILABILITY_OUT_OF_BOUNDS');
      assert.deepEqual(calendarConflict.conflicts[0], {
        resourceType: 'teacher',
        resourceId: JSON.parse(teacherResponseText).id,
        resourceName: 'Preserved Teacher',
        day: 'Saturday',
        period: 1,
      });

      const teacherScheduleResponse = await apiRequest(server.baseUrl, '/timetables', {
        method: 'POST',
        body: JSON.stringify({ name: 'Teacher availability schedule', data: { schedule: [] } }),
      });
      assert.equal(teacherScheduleResponse.status, 201);
      const teacherSchedule = await teacherScheduleResponse.json();
      const availabilityUpdateResponse = await apiRequest(
        server.baseUrl,
        `/teachers/${JSON.parse(teacherResponseText).id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            unavailable: [
              { day: 'Saturday', period: 1 },
              { day: 'Saturday', period: 2 },
            ],
          }),
        }
      );
      assert.equal(availabilityUpdateResponse.status, 200);
      const staleTeacherSchedule = await (
        await apiRequest(server.baseUrl, `/timetables/${teacherSchedule.id}`)
      ).json();
      assert.equal(staleTeacherSchedule.isStale, true);
      assert.equal(staleTeacherSchedule.staleReason, 'Teacher constraints changed');

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
      assertCompleteMigrationLedger(database);
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
      assertCompleteMigrationLedger(database);
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

test('room contracts are dynamic, atomic, normalized, and recoverable', { timeout: 60_000 }, async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-rooms-'));
  const databasePath = path.join(temporaryDirectory, 'rooms.db');
  let server;

  try {
    server = await startServer(databasePath);

    const defaultsResponse = await apiRequest(server.baseUrl, '/room-types');
    assert.equal(defaultsResponse.status, 200);
    const defaults = await defaultsResponse.json();
    assert.equal(defaults.length, 12);
    assert.ok(defaults.every((roomType) => roomType.value && roomType.labelFa && roomType.labelEn));
    assert.equal(defaults.some((roomType) => roomType.value === ''), false);

    const monolingualType = await apiRequest(server.baseUrl, '/room-types', {
      method: 'POST',
      body: JSON.stringify({
        value: 'missing_english_label',
        labelFa: 'بدون برچسب انگلیسی',
        icon: 'Building',
      }),
    });
    assert.equal(monolingualType.status, 400);

    const preferenceProfileResponse = await apiRequest(
      server.baseUrl,
      '/config/optimization-preferences'
    );
    assert.equal(preferenceProfileResponse.status, 200);
    const preferenceProfile = await preferenceProfileResponse.json();
    const invalidPreferences = await apiRequest(
      server.baseUrl,
      '/config/optimization-preferences',
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...preferenceProfile,
          preferences: { ...preferenceProfile.preferences, preferClassHomeRoomWeight: 0.3 },
        }),
      }
    );
    assert.equal(invalidPreferences.status, 400);
    const baselineTimetableResponse = await apiRequest(server.baseUrl, '/timetables', {
      method: 'POST',
      body: JSON.stringify({ name: 'Preference baseline', data: { schedule: [] } }),
    });
    assert.equal(baselineTimetableResponse.status, 201);
    const baselineTimetable = await baselineTimetableResponse.json();
    const validPreferences = await apiRequest(
      server.baseUrl,
      '/config/optimization-preferences',
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...preferenceProfile,
          preferences: { ...preferenceProfile.preferences, preferClassHomeRoomWeight: 1 },
        }),
      }
    );
    assert.equal(validPreferences.status, 200, await validPreferences.clone().text());
    const savedPreferenceProfile = await validPreferences.json();
    assert.equal(savedPreferenceProfile.revision, preferenceProfile.revision + 1);
    const stalePreferenceWrite = await apiRequest(
      server.baseUrl,
      '/config/optimization-preferences',
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...preferenceProfile,
          preferences: { ...preferenceProfile.preferences, preferClassHomeRoomWeight: 0.5 },
        }),
      }
    );
    assert.equal(stalePreferenceWrite.status, 409);
    const noOpPreferenceWrite = await apiRequest(
      server.baseUrl,
      '/config/optimization-preferences',
      { method: 'PATCH', body: JSON.stringify(savedPreferenceProfile) }
    );
    assert.equal(noOpPreferenceWrite.status, 200);
    assert.equal((await noOpPreferenceWrite.json()).revision, savedPreferenceProfile.revision);
    const staleTimetableResponse = await apiRequest(
      server.baseUrl,
      `/timetables/${baselineTimetable.id}`
    );
    const staleTimetable = await staleTimetableResponse.json();
    assert.equal(staleTimetable.isStale, true);
    assert.equal(staleTimetable.staleReason, 'OPTIMIZATION_PREFERENCES_CHANGED');

    const typeResponse = await apiRequest(server.baseUrl, '/room-types', {
      method: 'POST',
      body: JSON.stringify({
        value: 'robotics_lab',
        labelFa: 'لابراتوار رباتیک',
        labelEn: 'Robotics Lab',
        icon: 'Beaker',
      }),
    });
    const typeText = await typeResponse.text();
    assert.equal(typeResponse.status, 201, typeText);
    const customType = JSON.parse(typeText);
    assert.ok(customType.sortOrder > Math.max(...defaults.map((roomType) => roomType.sortOrder)));

    const immutableUpdate = await apiRequest(server.baseUrl, `/room-types/${customType.id}`, {
      method: 'PUT',
      body: JSON.stringify({ value: 'renamed_slug' }),
    });
    assert.equal(immutableUpdate.status, 400);

    const createRoom = async (name) => {
      const response = await apiRequest(server.baseUrl, '/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name,
          capacity: 30,
          type: customType.value,
          features: [],
          unavailable: [],
        }),
      });
      const text = await response.text();
      assert.equal(response.status, 201, text);
      return JSON.parse(text);
    };

    const firstRoom = await createRoom('Robotics Hall');
    const secondRoom = await createRoom('Overflow Hall');

    const duplicateRoom = await apiRequest(server.baseUrl, '/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name: '  ROBOTICS HALL  ',
        capacity: 20,
        type: customType.value,
      }),
    });
    assert.equal(duplicateRoom.status, 409);
    assert.equal((await duplicateRoom.json()).code, 'ROOM_NAME_CONFLICT');

    const blockedTypeDelete = await apiRequest(
      server.baseUrl,
      `/room-types/${customType.id}`,
      { method: 'DELETE' }
    );
    assert.equal(blockedTypeDelete.status, 409);
    assert.equal((await blockedTypeDelete.json()).code, 'ROOM_TYPE_DELETE_BLOCKED');

    const classResponse = await apiRequest(server.baseUrl, '/classes', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Room-bound class',
        studentCount: 20,
        fixedRoomId: firstRoom.id,
        homeRoomId: firstRoom.id,
      }),
    });
    const classText = await classResponse.text();
    assert.equal(classResponse.status, 201, classText);
    const classGroup = JSON.parse(classText);

    const atomicDelete = await apiRequest(server.baseUrl, '/rooms/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids: [firstRoom.id, secondRoom.id] }),
    });
    assert.equal(atomicDelete.status, 409);
    assert.equal((await atomicDelete.json()).code, 'ROOM_DELETE_BLOCKED');
    assert.deepEqual(
      (await (await apiRequest(server.baseUrl, '/rooms')).json()).map((room) => room.id),
      [firstRoom.id, secondRoom.id]
    );

    const teacherResponse = await apiRequest(server.baseUrl, '/teachers', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Room-preferring teacher',
        staffCode: 'T-ROOM-PREF',
        preferredRoomIds: [secondRoom.id],
      }),
    });
    const teacherText = await teacherResponse.text();
    assert.equal(teacherResponse.status, 201, teacherText);
    const teacher = JSON.parse(teacherText);

    assert.equal(
      (await apiRequest(server.baseUrl, `/classes/${classGroup.id}`, { method: 'DELETE' })).status,
      204
    );
    assert.equal(
      (await apiRequest(server.baseUrl, `/rooms/${secondRoom.id}`, { method: 'DELETE' })).status,
      204
    );
    const cleanedTeacher = await (
      await apiRequest(server.baseUrl, `/teachers/${teacher.id}`)
    ).json();
    assert.deepEqual(cleanedTeacher.preferredRoomIds, []);

    const deletedRooms = await (await apiRequest(server.baseUrl, '/rooms/deleted')).json();
    assert.deepEqual(deletedRooms.map((room) => room.id), [secondRoom.id]);
    assert.equal(
      (await apiRequest(server.baseUrl, `/rooms/${secondRoom.id}/restore`, { method: 'POST' }))
        .status,
      200
    );

    const unrestrictedSubject = await apiRequest(server.baseUrl, '/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: 'No room restriction', requiredRoomType: '' }),
    });
    const unrestrictedText = await unrestrictedSubject.text();
    assert.equal(unrestrictedSubject.status, 201, unrestrictedText);
    assert.equal(JSON.parse(unrestrictedText).requiredRoomType, null);

    const mixedScopeWrite = await apiRequest(server.baseUrl, '/subjects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Wrong scope', schoolId: 42 }),
    });
    assert.equal(mixedScopeWrite.status, 409);
    assert.equal((await mixedScopeWrite.json()).code, 'SCHOOL_SCOPE_CONFLICT');
  } finally {
    if (server) await stopServer(server);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('room hardening migration preserves custom types and remediates active duplicates', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-room-migration-'));
  const databasePath = path.join(temporaryDirectory, 'legacy-rooms.db');
  let dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });

  try {
    await dataSource.initialize();
    // Rewind through any migrations newer than the room contract, then rewind
    // the room contract itself to create the legacy fixture it is meant to upgrade.
    while (true) {
      const [latest] = await dataSource.query(
        'SELECT name FROM migrations ORDER BY timestamp DESC, id DESC LIMIT 1'
      );
      assert.ok(latest, 'expected an applied migration to rewind');
      await dataSource.undoLastMigration();
      if (latest.name === 'HardenRoomContracts1784100000000') break;
    }
    await dataSource.destroy();

    let database = new Database(databasePath);
    database
      .prepare(
        `INSERT INTO room_type
         (value, label, icon, sortOrder, isSystem, isDeleted)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run('Robotics Legacy', 'رباتیک قدیمی', 'Beaker', 100, 0, 0);
    database
      .prepare(
        `INSERT INTO room
         (id, name, capacity, type, features, unavailable, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        100,
        'Legacy Hall',
        30,
        'Robotics Legacy',
        '[]',
        JSON.stringify(JSON.stringify([{ day: 0, period: 1 }])),
        '{}'
      );
    database
      .prepare(
        `INSERT INTO room
         (id, name, capacity, type, features, unavailable, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(101, ' legacy hall ', 30, 'Robotics Legacy', '[]', '[]', '{}');
    database
      .prepare(
        `INSERT INTO class_group
         (name, studentCount, fixedRoomId, subjectRequirements)
         VALUES (?, ?, ?, ?)`
      )
      .run('Legacy Class', 20, 101, '[]');
    database
      .prepare(
        `INSERT INTO teacher
         (fullName, primarySubjectIds, availability, maxPeriodsPerWeek, preferredRoomIds)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('Legacy Teacher', '[]', '{}', 30, JSON.stringify([101]));
    database
      .prepare(
        `INSERT INTO subject
         (name, requiredRoomType, requiredFeatures, desiredFeatures, meta)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run('Legacy Subject', '', '[]', '[]', '{}');
    database.close();

    dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });
    await dataSource.initialize();
    await dataSource.destroy();

    database = new Database(databasePath);
    const rooms = database
      .prepare(
        'SELECT id, name, normalizedName, type, unavailable, isDeleted FROM room ORDER BY id'
      )
      .all();
    assert.deepEqual(
      rooms.map((room) => ({
        id: room.id,
        name: room.name,
        normalizedName: room.normalizedName,
        type: room.type,
        unavailable: JSON.parse(room.unavailable),
        isDeleted: room.isDeleted,
      })),
      [
        {
          id: 100,
          name: 'Legacy Hall',
          normalizedName: 'legacy hall',
          type: 'robotics_legacy',
          unavailable: [{ day: 'Saturday', period: 1 }],
          isDeleted: 0,
        },
        {
          id: 101,
          name: 'legacy hall',
          normalizedName: 'legacy hall',
          type: 'robotics_legacy',
          unavailable: [],
          isDeleted: 1,
        },
      ]
    );
    assert.equal(
      database.prepare('SELECT fixedRoomId FROM class_group').get().fixedRoomId,
      100
    );
    assert.deepEqual(
      JSON.parse(database.prepare('SELECT preferredRoomIds FROM teacher').get().preferredRoomIds),
      [100]
    );
    assert.equal(
      database.prepare('SELECT requiredRoomType FROM subject').get().requiredRoomType,
      null
    );
    assert.equal(
      database.prepare('SELECT labelEn FROM room_type WHERE value = ?').get('robotics_legacy')
        .labelEn,
      'رباتیک قدیمی'
    );
    assert.throws(
      () =>
        database
          .prepare(
            `INSERT INTO room
             (name, normalizedName, capacity, type, features, unavailable, meta)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run('LEGACY HALL', 'legacy hall', 10, 'normal', '[]', '[]', '{}'),
      /UNIQUE constraint failed/
    );
    assert.deepEqual(database.pragma('foreign_key_check'), []);
    database.close();
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

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

    assert.equal(
      (await firstService.create({ fullName: 'First database', staffCode: 'T-FIRST' })).success,
      true
    );
    assert.equal(
      (await secondService.create({ fullName: 'Second database', staffCode: 'T-SECOND' })).success,
      true
    );

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

test('teacher commands are atomic and hard delete removes live references', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { Subject } = require('../dist/src/entity/Subject');
  const { Timetable } = require('../dist/src/entity/Timetable');
  const { TeacherService } = require('../dist/src/services/teacher.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-teachers-'));
  const dataSource = new DataSource({
    ...AppDataSource.options,
    database: path.join(temporaryDirectory, 'teachers.db'),
  });
  const cache = new CacheManager();

  try {
    await dataSource.initialize();
    const teacherService = TeacherService.getInstance(dataSource, cache);

    const rolledBack = await teacherService.bulkImport([
      { fullName: 'Valid first row', staffCode: 'T-BATCH-1' },
      {
        fullName: 'Invalid second row',
        staffCode: 'T-BATCH-2',
        primarySubjectIds: [999_999],
      },
    ]);
    assert.equal(rolledBack.success, false);
    assert.equal((await dataSource.query('SELECT COUNT(*) AS count FROM teacher'))[0].count, 0);

    const first = await teacherService.create({
      fullName: 'Duplicate Display Name',
      staffCode: ' t-one ',
      maxPeriodsPerWeek: 0,
    });
    const second = await teacherService.create({
      fullName: 'Duplicate Display Name',
      staffCode: 'T-TWO',
      maxPeriodsPerWeek: 20,
    });
    assert.equal(first.success, true);
    assert.equal(second.success, true);
    assert.equal(first.data.staffCode, 'T-ONE');
    assert.equal(first.data.maxPeriodsPerWeek, 0);

    const duplicateCode = await teacherService.create({
      fullName: 'Another person',
      staffCode: 't-one',
    });
    assert.equal(duplicateCode.success, false);
    assert.equal(duplicateCode.statusCode, 409);

    const subject = await dataSource.getRepository(Subject).save(
      dataSource.getRepository(Subject).create({
        name: 'Teacher Contract Subject',
        code: 'TCS-1',
        periodsPerWeek: 3,
      })
    );
    const updatedSecond = await teacherService.update(second.data.id, {
      primarySubjectIds: [subject.id],
    });
    assert.equal(updatedSecond.success, true);
    assert.equal(
      (await dataSource.query('SELECT COUNT(*) AS count FROM teacher_subject_capability'))[0]
        .count,
      1
    );

    const updatedFirst = await teacherService.update(first.data.id, {
      preferredColleagues: [second.data.id],
    });
    assert.equal(updatedFirst.success, true);

    await dataSource.getRepository(Timetable).save(
      dataSource.getRepository(Timetable).create({
        name: 'Saved schedule',
        description: '',
        data: '{}',
      })
    );

    const deleted = await teacherService.delete(second.data.id);
    assert.equal(deleted.success, true);
    assert.equal((await teacherService.findById(second.data.id)).success, false);
    assert.deepEqual((await teacherService.findById(first.data.id)).data.preferredColleagues, []);
    assert.equal(
      (await dataSource.query('SELECT COUNT(*) AS count FROM teacher_subject_capability'))[0]
        .count,
      0
    );
    const [timetable] = await dataSource.query(
      'SELECT isStale, staleReason FROM timetable WHERE name = ?',
      ['Saved schedule']
    );
    assert.equal(timetable.isStale, 1);
    assert.equal(timetable.staleReason, 'Teacher deleted');
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('teacher calendar validation respects category-specific period capacity', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { SchoolConfigService } = require('../dist/src/services/schoolConfig.service');
  const { TeacherService } = require('../dist/src/services/teacher.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-teacher-calendar-'));
  const dataSource = new DataSource({
    ...AppDataSource.options,
    database: path.join(temporaryDirectory, 'teacher-calendar.db'),
  });
  const cache = new CacheManager();

  try {
    await dataSource.initialize();
    const configService = SchoolConfigService.getInstance(dataSource, cache);
    let config = await configService.getConfig();
    config = await configService.updateGeneral(
      generalConfigPayload(config, {
        enablePrimary: false,
        enableMiddle: true,
        enableHigh: true,
      })
    );
    await configService.updatePeriods({
      schoolId: null,
      revision: config.revision,
      defaultPeriodsPerDay: 6,
      periodDuration: 40,
      dynamicPeriodsEnabled: true,
      periodsPerDayMap: {
        Saturday: 6,
        Sunday: 6,
        Monday: 6,
        Tuesday: 6,
        Wednesday: 6,
        Thursday: 2,
      },
      categoryPeriodsEnabled: true,
      categoryPeriodsMap: {
        Middle: {
          Saturday: 6,
          Sunday: 6,
          Monday: 6,
          Tuesday: 6,
          Wednesday: 6,
          Thursday: 2,
        },
        High: {
          Saturday: 6,
          Sunday: 6,
          Monday: 6,
          Tuesday: 6,
          Wednesday: 6,
          Thursday: 4,
        },
      },
      breakPeriods: [],
      breakPeriodsByDay: {},
      prayerBreaksEnabled: false,
      prayerBreaks: [],
    });

    const teacherService = TeacherService.getInstance(dataSource, cache);
    const accepted = await teacherService.bulkImport([
      {
        fullName: 'Category Capacity Teacher',
        staffCode: 'T-CATEGORY-34',
        maxPeriodsPerWeek: 34,
        maxPeriodsPerDay: 6,
      },
    ]);
    assert.equal(accepted.success, true, accepted.error);

    const rejected = await teacherService.bulkImport([
      {
        fullName: 'Over Capacity Teacher',
        staffCode: 'T-CATEGORY-35',
        maxPeriodsPerWeek: 35,
        maxPeriodsPerDay: 6,
      },
    ]);
    assert.equal(rejected.success, false);
    assert.match(rejected.error, /school calendar \(34\)/);
    assert.equal((await dataSource.query('SELECT COUNT(*) AS count FROM teacher'))[0].count, 1);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('managed assignment migration backfills valid legacy teacher mirrors', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { ClassGroup } = require('../dist/src/entity/ClassGroup');
  const { Subject } = require('../dist/src/entity/Subject');
  const { Teacher } = require('../dist/src/entity/Teacher');
  const {
    auditAssignmentStorageConsistency,
  } = require('../dist/src/services/assignmentConsistency.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-assignment-upgrade-'));
  const databasePath = path.join(temporaryDirectory, 'upgrade.db');
  let dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });

  try {
    await dataSource.initialize();
    // Rewind the canonical command migration and the backfill migration itself.
    // This fixture intentionally starts immediately before the backfill it verifies.
    while (true) {
      const [latest] = await dataSource.query(
        'SELECT name FROM migrations ORDER BY timestamp DESC, id DESC LIMIT 1'
      );
      assert.ok(latest, 'expected an applied migration to rewind');
      await dataSource.undoLastMigration();
      if (latest.name === 'BackfillCanonicalAssignments1784500000000') break;
    }

    const subject = await dataSource.getRepository(Subject).save(
      dataSource.getRepository(Subject).create({
        name: 'Legacy Mathematics',
        code: 'LEG-MATH',
        periodsPerWeek: 3,
      })
    );
    const classGroup = await dataSource.getRepository(ClassGroup).save(
      dataSource.getRepository(ClassGroup).create({
        name: 'Legacy Grade 7',
        studentCount: 25,
        subjectRequirements: JSON.stringify([
          { subjectId: subject.id, periodsPerWeek: 3, teacherId: null },
        ]),
      })
    );
    const teacher = await dataSource.getRepository(Teacher).save(
      dataSource.getRepository(Teacher).create({
        fullName: 'Legacy Teacher',
        staffCode: 'LEG-T-1',
        employmentType: 'full_time',
        primarySubjectIds: JSON.stringify([subject.id]),
        allowedSubjectIds: '[]',
        restrictToPrimarySubjects: true,
        availability: '{}',
        unavailable: '[]',
        maxPeriodsPerWeek: 20,
        maxPeriodsPerDay: 5,
        maxConsecutivePeriods: 2,
        timePreference: 'any',
        preferredRoomIds: '[]',
        preferredColleagues: '[]',
        classAssignments: JSON.stringify([
          { subjectId: subject.id, classIds: [classGroup.id] },
        ]),
        meta: '{}',
      })
    );
    await dataSource.destroy();

    dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });
    await dataSource.initialize();

    const [requirement] = await dataSource.query(
      'SELECT id, required_periods_per_week FROM class_subject_requirement WHERE class_id = ? AND subject_id = ?',
      [classGroup.id, subject.id]
    );
    assert.equal(requirement.required_periods_per_week, 3);
    const [capability] = await dataSource.query(
      'SELECT capability_level FROM teacher_subject_capability WHERE teacher_id = ? AND subject_id = ?',
      [teacher.id, subject.id]
    );
    assert.equal(capability.capability_level, 'primary');
    const [assignment] = await dataSource.query(
      'SELECT teacher_id, assigned_periods_per_week, is_fixed, source FROM teaching_assignment WHERE class_subject_requirement_id = ?',
      [requirement.id]
    );
    assert.deepEqual(
      {
        teacherId: assignment.teacher_id,
        periods: assignment.assigned_periods_per_week,
        isFixed: assignment.is_fixed,
        source: assignment.source,
      },
      { teacherId: teacher.id, periods: 3, isFixed: 1, source: 'migration' }
    );

    const audit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(audit.isConsistent, true);

    await dataSource.query('UPDATE teacher SET classAssignments = ?', ['[]']);
    await dataSource.destroy();
    await assert.rejects(startServer(databasePath), /Assignment semantic integrity check failed/);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('canonical assignment batches are atomic, versioned, policy checked, and stale schedules', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { Subject } = require('../dist/src/entity/Subject');
  const { Timetable } = require('../dist/src/entity/Timetable');
  const { ClassSubjectRequirement } = require('../dist/src/entity/ClassSubjectRequirement');
  const { TeachingAssignment } = require('../dist/src/entity/TeachingAssignment');
  const { TeacherService } = require('../dist/src/services/teacher.service');
  const { ClassService } = require('../dist/src/services/class.service');
  const { RequirementService } = require('../dist/src/services/requirement.service');
  const { TeacherCapabilityService } = require('../dist/src/services/teacherCapability.service');
  const { SchoolConfigService } = require('../dist/src/services/schoolConfig.service');
  const { AssignmentCommandService } = require('../dist/src/services/assignmentCommand.service');
  const {
    auditAssignmentStorageConsistency,
  } = require('../dist/src/services/assignmentConsistency.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-assignment-batch-'));
  const dataSource = new DataSource({
    ...AppDataSource.options,
    database: path.join(temporaryDirectory, 'assignments.db'),
  });
  const cache = new CacheManager();

  try {
    await dataSource.initialize();
    const subject = await dataSource.getRepository(Subject).save(
      dataSource.getRepository(Subject).create({
        name: 'Canonical Mathematics',
        code: 'CAN-MATH',
        periodsPerWeek: 5,
      })
    );
    const teacherService = TeacherService.getInstance(dataSource, cache);
    const firstTeacher = await teacherService.create({
      fullName: 'Primary Mathematics Teacher',
      staffCode: 'CAN-T-1',
      primarySubjectIds: [subject.id],
      maxPeriodsPerWeek: 30,
    });
    const secondTeacher = await teacherService.create({
      fullName: 'Allowed Mathematics Teacher',
      staffCode: 'CAN-T-2',
      maxPeriodsPerWeek: 30,
    });
    assert.equal(firstTeacher.success, true);
    assert.equal(secondTeacher.success, true);

    const classService = ClassService.getInstance(dataSource, cache);
    const classResult = await classService.create({
      name: 'Grade 7-A',
      grade: 7,
      classTeacherId: firstTeacher.data.id,
      subjectRequirements: [{ subjectId: subject.id, periodsPerWeek: 5 }],
    });
    assert.equal(classResult.success, true);
    await RequirementService.getInstance(dataSource, cache).syncClassRequirements(
      classResult.data.id,
      [{ subjectId: subject.id, periodsPerWeek: 5, allowSplitAssignment: true }]
    );
    let requirement = await dataSource.getRepository(ClassSubjectRequirement).findOneByOrFail({
      classId: classResult.data.id,
      subjectId: subject.id,
      isDeleted: false,
    });
    const initialVersion = requirement.assignmentVersion;
    await dataSource.getRepository(Timetable).save(
      dataSource.getRepository(Timetable).create({ name: 'Assignment schedule', data: '{}' })
    );

    const command = AssignmentCommandService.getInstance(dataSource, cache);
    const partial = await command.applyBatch([{
      requirementId: requirement.id,
      expectedVersion: requirement.assignmentVersion,
      allocations: [{ teacherId: firstTeacher.data.id, periodsPerWeek: 2 }],
    }]);
    assert.equal(partial.success, true);
    assert.equal(partial.data.isValid, true);
    requirement = await dataSource.getRepository(ClassSubjectRequirement).findOneByOrFail({ id: requirement.id });
    assert.equal(requirement.assignmentVersion, initialVersion + 1);
    assert.equal((await dataSource.getRepository(Timetable).findOneByOrFail({ name: 'Assignment schedule' })).isStale, true);
    let storageAudit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(storageAudit.isConsistent, true, JSON.stringify(storageAudit.issues));
    assert.equal(
      (await dataSource.query(
        'SELECT COUNT(*) AS count FROM teacher_class_subject_assignment WHERE isDeleted = 0'
      ))[0].count,
      1
    );

    const incompatible = await command.applyBatch([{
      requirementId: requirement.id,
      expectedVersion: initialVersion + 1,
      allocations: [
        { teacherId: firstTeacher.data.id, periodsPerWeek: 2 },
        { teacherId: secondTeacher.data.id, periodsPerWeek: 3 },
      ],
    }]);
    assert.equal(incompatible.data.isValid, false);
    assert.equal(incompatible.data.conflicts[0].type, 'subject_incompatible');
    assert.equal((await dataSource.getRepository(TeachingAssignment).countBy({ isDeleted: false })), 1);

    const staleWithPrimaryGrant = await command.applyBatch(
      [{
        requirementId: requirement.id,
        expectedVersion: initialVersion,
        allocations: [
          { teacherId: firstTeacher.data.id, periodsPerWeek: 2 },
          { teacherId: secondTeacher.data.id, periodsPerWeek: 3 },
        ],
      }],
      [{ teacherId: secondTeacher.data.id, subjectId: subject.id }]
    );
    assert.equal(staleWithPrimaryGrant.data.isValid, false);
    assert.equal(
      staleWithPrimaryGrant.data.conflicts.some((conflict) => conflict.type === 'stale_assignment'),
      true
    );
    assert.equal(
      (await dataSource.query(
        'SELECT COUNT(*) AS count FROM teacher_subject_capability WHERE teacher_id = ? AND subject_id = ? AND is_deleted = 0',
        [secondTeacher.data.id, subject.id]
      ))[0].count,
      0,
      'a rejected assignment must not persist its primary capability grant'
    );

    const schoolConfig = await SchoolConfigService.getInstance(dataSource, cache).getConfig(null);
    const unavailable = schoolConfig.daysOfWeek.flatMap((day) => {
      const periods = schoolConfig.dynamicPeriodsEnabled
        ? (schoolConfig.periodsPerDayMap[day] ?? schoolConfig.defaultPeriodsPerDay)
        : schoolConfig.defaultPeriodsPerDay;
      return Array.from({ length: periods }, (_, period) => ({ day, period }));
    });
    const unavailableTeacher = await teacherService.create({
      fullName: 'Unavailable Mathematics Teacher',
      staffCode: 'CAN-T-UNAVAILABLE',
      maxPeriodsPerWeek: 30,
      unavailable,
    });
    assert.equal(unavailableTeacher.success, true);
    const availabilityConflict = await command.applyBatch(
      [{
        requirementId: requirement.id,
        expectedVersion: initialVersion + 1,
        allocations: [
          { teacherId: firstTeacher.data.id, periodsPerWeek: 2 },
          { teacherId: unavailableTeacher.data.id, periodsPerWeek: 3 },
        ],
      }],
      [{ teacherId: unavailableTeacher.data.id, subjectId: subject.id }]
    );
    assert.equal(availabilityConflict.data.isValid, false);
    assert.equal(
      availabilityConflict.data.conflicts.some(
        (conflict) => conflict.type === 'workload_exceeded' &&
          conflict.affectedEntities.teacherId === unavailableTeacher.data.id
      ),
      true
    );
    assert.equal(
      (await dataSource.query(
        'SELECT COUNT(*) AS count FROM teacher_subject_capability WHERE teacher_id = ? AND subject_id = ? AND is_deleted = 0',
        [unavailableTeacher.data.id, subject.id]
      ))[0].count,
      0,
      'an availability conflict must roll back its primary capability grant'
    );

    await TeacherCapabilityService.getInstance(dataSource, cache).ensureCapability(
      secondTeacher.data.id,
      subject.id,
      'allowed'
    );
    const completed = await command.assignTeacher(
      secondTeacher.data.id,
      subject.id,
      [classResult.data.id],
      3,
      [{ classId: classResult.data.id, periodsPerWeek: 3 }],
      false,
      true
    );
    assert.equal(completed.data.success, true);
    const [promotedCapability] = await dataSource.query(
      'SELECT capability_level FROM teacher_subject_capability WHERE teacher_id = ? AND subject_id = ? AND is_deleted = 0',
      [secondTeacher.data.id, subject.id]
    );
    assert.equal(promotedCapability.capability_level, 'primary');
    requirement = await dataSource.getRepository(ClassSubjectRequirement).findOneByOrFail({ id: requirement.id });
    assert.equal(requirement.assignmentVersion, initialVersion + 2);

    const idempotent = await command.applyBatch([{
      requirementId: requirement.id,
      expectedVersion: initialVersion + 1,
      allocations: [
        { teacherId: firstTeacher.data.id, periodsPerWeek: 2 },
        { teacherId: secondTeacher.data.id, periodsPerWeek: 3 },
      ],
    }]);
    assert.equal(idempotent.data.isValid, true);
    assert.equal(idempotent.data.requirements[0].changed, false);
    assert.equal(
      (await dataSource.getRepository(ClassSubjectRequirement).findOneByOrFail({ id: requirement.id })).assignmentVersion,
      initialVersion + 2
    );
    storageAudit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(storageAudit.isConsistent, true, JSON.stringify(storageAudit.issues));
    assert.equal(
      (await dataSource.query(
        'SELECT COUNT(*) AS count FROM teacher_class_subject_assignment WHERE isDeleted = 0'
      ))[0].count,
      2
    );

    const overrideTeacher = await teacherService.create({
      fullName: 'Teacher Drawer Override',
      staffCode: 'CAN-T-OVERRIDE',
      maxPeriodsPerWeek: 30,
    });
    assert.equal(overrideTeacher.success, true);
    await TeacherCapabilityService.getInstance(dataSource, cache).ensureCapability(
      overrideTeacher.data.id,
      subject.id,
      'allowed'
    );
    const override = await command.applyBatch([{
      requirementId: requirement.id,
      expectedVersion: initialVersion + 2,
      allocations: [{ teacherId: overrideTeacher.data.id, periodsPerWeek: 5 }],
    }]);
    assert.equal(override.data.isValid, true);
    assert.deepEqual(
      await dataSource.query(
        `SELECT teacher_id AS teacherId, assigned_periods_per_week AS periods
         FROM teaching_assignment
         WHERE class_subject_requirement_id = ? AND is_deleted = 0`,
        [requirement.id]
      ),
      [{ teacherId: overrideTeacher.data.id, periods: 5 }],
      'a confirmed override must atomically replace every prior teacher allocation'
    );
    const [overrideCapability] = await dataSource.query(
      `SELECT capability_level AS capabilityLevel
       FROM teacher_subject_capability
       WHERE teacher_id = ? AND subject_id = ? AND is_deleted = 0`,
      [overrideTeacher.data.id, subject.id]
    );
    assert.equal(
      overrideCapability.capabilityLevel,
      'allowed',
      'teacher-drawer assignment must preserve allowed capability semantics'
    );
    storageAudit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(storageAudit.isConsistent, true, JSON.stringify(storageAudit.issues));

    const deletedSecondTeacher = await teacherService.delete(secondTeacher.data.id);
    assert.equal(deletedSecondTeacher.success, true);
    storageAudit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(storageAudit.isConsistent, true, JSON.stringify(storageAudit.issues));

    const alphaTeacher = await teacherService.create({
      fullName: 'Alpha General Teacher',
      staffCode: 'CAN-T-ALPHA',
      maxPeriodsPerWeek: 30,
    });
    const alphaClass = await classService.create({
      name: 'Grade 2-A',
      grade: 2,
      singleTeacherMode: false,
      classTeacherId: alphaTeacher.data.id,
      subjectRequirements: [{ subjectId: subject.id, periodsPerWeek: 5 }],
    });
    assert.equal(alphaClass.success, true);
    assert.equal(alphaClass.data.singleTeacherMode, true);
    const [alphaAssignment] = await dataSource.query(
      `SELECT ta.teacher_id AS teacherId, ta.assigned_periods_per_week AS periods, ta.source
       FROM teaching_assignment ta
       JOIN class_subject_requirement requirement
         ON requirement.id = ta.class_subject_requirement_id
       WHERE requirement.class_id = ? AND ta.is_deleted = 0`,
      [alphaClass.data.id]
    );
    assert.deepEqual(alphaAssignment, {
      teacherId: alphaTeacher.data.id,
      periods: 5,
      source: 'single_teacher',
    });
    storageAudit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(storageAudit.isConsistent, true, JSON.stringify(storageAudit.issues));

    const alphaDraft = await classService.update(alphaClass.data.id, { classTeacherId: null });
    assert.equal(alphaDraft.success, true);
    assert.equal(
      (await dataSource.query(
        `SELECT COUNT(*) AS count
         FROM teaching_assignment assignment
         INNER JOIN class_subject_requirement requirement
           ON requirement.id = assignment.class_subject_requirement_id
         WHERE requirement.class_id = ? AND assignment.is_deleted = 0`,
        [alphaClass.data.id]
      ))[0].count,
      0
    );
    storageAudit = await auditAssignmentStorageConsistency(dataSource);
    assert.equal(storageAudit.isConsistent, true, JSON.stringify(storageAudit.issues));
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
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
      staffCode: 'T-AVAILABILITY',
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
    assert.deepEqual(solverInput.teachers[0].availability.Saturday, [true, true, true, true, true]);
    assert.deepEqual(solverInput.teachers[0].availability.Sunday, [true, true, true, true, true]);
    assert.deepEqual(solverInput.teachers[0].unavailable, [{ day: 'Saturday', periods: [1, 3] }]);
    assert.equal(solverInput.preferences.preferClassHomeRoomWeight, 2);
    assert.equal(solverInput.preferences.respectSubjectDesiredFeaturesWeight, 0.5);
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
      database.exec('DROP TRIGGER IF EXISTS "TR_school_config_periods_insert"');
      database.exec('DROP TRIGGER IF EXISTS "TR_school_config_periods_update"');
      database.exec('DROP INDEX IF EXISTS "UQ_school_config_default"');
      database.exec('ALTER TABLE school_config DROP COLUMN prayerBreaksEnabled');
      database.exec('ALTER TABLE school_config DROP COLUMN revision');
      database.exec(
        `ALTER TABLE teacher ADD COLUMN availability text NOT NULL DEFAULT '{}'`
      );
      database.exec(
        'CREATE UNIQUE INDEX "UQ_school_config_default" ON "school_config" ((1)) WHERE "schoolId" IS NULL'
      );
      database
        .prepare('DELETE FROM migrations WHERE name = ?')
        .run('RepairSchoolConfigFlow1783900000000');
      database
        .prepare('DELETE FROM migrations WHERE name = ?')
        .run('HardenPeriodConfiguration1784000000000');
      database
        .prepare('DELETE FROM migrations WHERE name = ?')
        .run('SimplifyTeacherAvailability1784800000000');
      database
        .prepare(
          `UPDATE school_config
            SET daysOfWeekJson = ?, periodsPerDayMapJson = ?, prayerBreaksJson = ?,
                dynamicPeriodsEnabled = 1
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
          (fullName, staffCode, employmentType, timePreference, primarySubjectIds,
           availability, unavailable, maxPeriodsPerWeek, preferredRoomIds, classAssignments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'Legacy Teacher',
          'T-LEGACY-REPAIR',
          'full_time',
          'any',
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
          `INSERT INTO room
           (name, normalizedName, capacity, type, features, unavailable, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          'Legacy Room',
          'legacy room',
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
        .prepare('SELECT unavailable, preferredRoomIds, classAssignments FROM teacher')
        .get();
      assert.deepEqual(JSON.parse(repairedTeacher.unavailable), [{ day: 'Saturday', period: 1 }]);
      assert.deepEqual(JSON.parse(repairedTeacher.preferredRoomIds), []);
      assert.deepEqual(JSON.parse(repairedTeacher.classAssignments), []);

      const repairedRoom = database.prepare('SELECT features, unavailable, meta FROM room').get();
      assert.deepEqual(JSON.parse(repairedRoom.features), ['board']);
      assert.deepEqual(JSON.parse(repairedRoom.unavailable), [{ day: 'Sunday', period: 2 }]);
      assert.deepEqual(JSON.parse(repairedRoom.meta), { floor: 1 });
      assertCompleteMigrationLedger(database);
      assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
      database.close();
    } finally {
      if (server) await stopServer(server);
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  }
);

test('period contract utilities enforce category authority and generated bounds', () => {
  const {
    buildCanonicalPeriodConfiguration,
    findGeneratedPeriodBoundsIssues,
  } = require('../dist/src/utils/periodConfiguration');
  const { calculateAvailableClassPeriods } = require('../dist/src/services/analysisGeneration.service');
  const { periodStructureUpdateSchema } = require('../dist/src/schemas/config.schema');
  const contract = JSON.parse(
    fs.readFileSync(
      path.resolve(apiRoot, '..', '..', 'test', 'fixtures', 'period-configuration.contract.json'),
      'utf8'
    )
  );

  const canonical = buildCanonicalPeriodConfiguration(contract.config);
  assert.deepEqual(canonical.periodsPerDayMap, contract.expected.solverGrid);
  assert.deepEqual(
    canonical.categoryPeriodsPerDayMap['Alpha-Primary'],
    contract.expected.alphaPrimary
  );

  const issues = findGeneratedPeriodBoundsIssues(
    {
      schedule: [
        {
          classId: 'alpha',
          day: 'Saturday',
          periodIndex: 2,
          periodsThisDay: 2,
        },
      ],
    },
    {
      config: {
        daysOfWeek: contract.config.daysOfWeek,
        periodsPerDayMap: canonical.periodsPerDayMap,
        categoryPeriodsPerDayMap: canonical.categoryPeriodsPerDayMap,
      },
      classes: [{ id: 'alpha', category: 'Alpha-Primary' }],
    }
  );
  assert.equal(issues.length, 1);
  assert.equal(issues[0].reason, 'OUT_OF_BOUNDS');
  assert.equal(
    findGeneratedPeriodBoundsIssues({}, {
      config: {
        daysOfWeek: contract.config.daysOfWeek,
        periodsPerDayMap: canonical.periodsPerDayMap,
        categoryPeriodsPerDayMap: canonical.categoryPeriodsPerDayMap,
      },
      classes: [],
    })[0].reason,
    'INVALID_SCHEDULE'
  );

  const availablePeriods = calculateAvailableClassPeriods(
    {
      metadata: {
        classes: [
          { classId: 'alpha', category: 'Alpha-Primary' },
          { classId: 'high', category: 'High' },
        ],
        periodConfiguration: {
          periodsPerDayMap: canonical.periodsPerDayMap,
          categoryPeriodsPerDayMap: canonical.categoryPeriodsPerDayMap,
        },
      },
    },
    ['alpha', 'high']
  );
  assert.equal(availablePeriods, contract.expected.availablePeriodsForAlphaAndHigh);

  const normalizedDisabled = periodStructureUpdateSchema.parse({
    schoolId: null,
    revision: 1,
    defaultPeriodsPerDay: 6,
    periodDuration: 45,
    dynamicPeriodsEnabled: false,
    periodsPerDayMap: { Saturday: 99 },
    categoryPeriodsEnabled: false,
    categoryPeriodsMap: { High: { Saturday: 99 } },
    breakPeriods: [],
    breakPeriodsByDay: {},
    prayerBreaksEnabled: false,
    prayerBreaks: [{ name: '', time: 'bad', duration: 1 }],
  });
  assert.deepEqual(normalizedDisabled.periodsPerDayMap, {});
  assert.deepEqual(normalizedDisabled.categoryPeriodsMap, {});
  assert.deepEqual(normalizedDisabled.prayerBreaks, []);
});

test('school config storage rejects corrupt reads and invalid SQLite writes', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { SchoolConfigService } = require('../dist/src/services/schoolConfig.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-config-guards-'));
  const databasePath = path.join(temporaryDirectory, 'guards.db');
  let dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });

  try {
    await dataSource.initialize();
    const configService = SchoolConfigService.getInstance(dataSource, new CacheManager());
    let config = await configService.getConfig();
    config = await configService.updateGeneral(
      generalConfigPayload(config, { enableMiddle: false })
    );
    config = await configService.updatePeriods({
      schoolId: null,
      revision: config.revision,
      defaultPeriodsPerDay: 6,
      periodDuration: 45,
      dynamicPeriodsEnabled: false,
      periodsPerDayMap: {},
      categoryPeriodsEnabled: true,
      categoryPeriodsMap: {
        'Alpha-Primary': { Saturday: 2, Sunday: 2, Monday: 2, Tuesday: 2, Wednesday: 2, Thursday: 2 },
        'Beta-Primary': { Saturday: 2, Sunday: 2, Monday: 2, Tuesday: 2, Wednesday: 2, Thursday: 2 },
        High: { Saturday: 5, Sunday: 5, Monday: 5, Tuesday: 5, Wednesday: 5, Thursday: 5 },
      },
      breakPeriods: [{ afterPeriod: 4, duration: 10 }],
      breakPeriodsByDay: {},
      prayerBreaksEnabled: false,
      prayerBreaks: [],
    });
    config = await configService.updateGeneral(
      generalConfigPayload(config, { enableHigh: false })
    );
    assert.deepEqual(config.breakPeriods, []);
    await dataSource.destroy();

    const database = new Database(databasePath);
    assert.throws(
      () => database.prepare('UPDATE school_config SET periodDuration = 1').run(),
      /invalid school_config scalar period configuration/
    );
    assert.throws(
      () => database.prepare("UPDATE school_config SET timezone = 'Etc/Unknown'").run(),
      /invalid school_config scalar period configuration/
    );
    assert.throws(
      () =>
        database
          .prepare('UPDATE school_config SET breakPeriods = ?')
          .run(
            JSON.stringify([
              { afterPeriod: 2, duration: 10 },
              { afterPeriod: 2, duration: 30 },
            ])
          ),
      /invalid school_config break shape/
    );
    database.exec('DROP TRIGGER "TR_school_config_periods_update"');
    database.prepare('UPDATE school_config SET periodsPerDayMapJson = ?').run('{not-json');
    database.close();

    dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });
    await dataSource.initialize();
    await assert.rejects(
      SchoolConfigService.getInstance(dataSource, new CacheManager()).getConfig(),
      (error) => error?.code === 'SCHOOL_CONFIG_CORRUPT'
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('period hardening migration aborts a valid legacy scalar mismatch', async () => {
  require('reflect-metadata');
  const { DataSource } = require('typeorm');
  const { AppDataSource } = require('../dist/ormconfig');
  const { CacheManager } = require('../dist/src/database/cache/cacheManager');
  const { SchoolConfigService } = require('../dist/src/services/schoolConfig.service');

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-config-conflict-'));
  const databasePath = path.join(temporaryDirectory, 'conflict.db');
  let dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });

  try {
    await dataSource.initialize();
    await SchoolConfigService.getInstance(dataSource, new CacheManager()).getConfig();
    await dataSource.destroy();

    const database = new Database(databasePath);
    database.exec('DROP TRIGGER "TR_school_config_periods_insert"');
    database.exec('DROP TRIGGER "TR_school_config_periods_update"');
    database
      .prepare('DELETE FROM migrations WHERE name = ?')
      .run('HardenPeriodConfiguration1784000000000');
    database.prepare('UPDATE school_config SET periodsPerDay = 5, defaultPeriodsPerDay = 6').run();
    database.close();

    dataSource = new DataSource({ ...AppDataSource.options, database: databasePath });
    await assert.rejects(
      dataSource.initialize(),
      /period migration conflict for row 1: periodsPerDay=5, defaultPeriodsPerDay=6/
    );
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
