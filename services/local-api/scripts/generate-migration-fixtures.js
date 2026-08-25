'use strict';

require('reflect-metadata');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const Database = require('better-sqlite3');
const { DataSource } = require('typeorm');
const { MIGRATION_REGISTRY } = require('../dist/src/database/migrationRegistry');
const {
  logicalFingerprint,
  sha256Buffer,
} = require('../test/helpers/migration-fixtures');

const outputDirectory = path.resolve(__dirname, '../test/fixtures/migrations');

function seedBaseline(databasePath) {
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.transaction(() => {
    database.prepare("INSERT INTO school_config (id, schoolName) VALUES (1, 'Fixture School')").run();
    database.prepare(
      "INSERT INTO room (id, name, capacity, type, features, unavailable, meta) VALUES (1, 'Fixture Room', 30, 'classroom', '[]', '[]', '{}')"
    ).run();
    database.prepare(
      "INSERT INTO subject (id, name, code, grade, periodsPerWeek, requiredFeatures, desiredFeatures, isDeleted) VALUES (1, 'Fixture Subject', 'FX-1', 7, 3, '[]', '[]', 0)"
    ).run();
    database.prepare(
      `INSERT INTO teacher (
        id, fullName, primarySubjectIds, allowedSubjectIds, restrictToPrimarySubjects,
        availability, unavailable, maxPeriodsPerWeek, maxPeriodsPerDay,
        maxConsecutivePeriods, timePreference, preferredRoomIds,
        preferredColleagues, classAssignments, meta, isDeleted
      ) VALUES (1, 'Fixture Teacher', '[1]', '[]', 1, '{}', '[]', 24, 6, 3,
                'any', '[1]', '[]', '[{"subjectId":1,"classIds":[1]}]', '{}', 0)`
    ).run();
    database.prepare(
      `INSERT INTO class_group (
        id, name, displayName, section, grade, sectionIndex, studentCount,
        fixedRoomId, singleTeacherMode, classTeacherId, subjectRequirements, meta, isDeleted
      ) VALUES (1, 'Fixture Class', '7-A', 'MIDDLE', 7, 'A', 24, 1, 0, NULL,
                '[{"subjectId":1,"periodsPerWeek":3,"teacherId":1}]', '{}', 0)`
    ).run();
    database.prepare(
      `INSERT INTO teacher_class_subject_assignment
       (id, teacherId, classId, subjectId, periodsPerWeek, isFixed, isDeleted)
       VALUES (1, 1, 1, 1, 3, 1, 0)`
    ).run();
    database.prepare(
      `INSERT INTO timetable (id, name, description, data, revision, isDeleted)
       VALUES (1, 'Fixture Timetable', 'synthetic', '{"schedule":[],"meta":{"fixture":true}}', 1, 0)`
    ).run();
    database.prepare(
      `INSERT INTO curriculum_config
       (id, grade, useMinistryDefaults, overridesJson, customSubjectsJson, isDeleted)
       VALUES (1, 7, 0, '[{"subjectId":1,"periodsPerWeek":3}]', '[]', 0)`
    ).run();
    database.prepare(
      "INSERT INTO subject (id, name, code, grade, periodsPerWeek, isDeleted, deletedAt) VALUES (2, 'Archived Subject', 'FX-OLD', 7, 1, 1, CURRENT_TIMESTAMP)"
    ).run();
  })();
  database.close();
}

async function migrate(databasePath, throughOrdinal) {
  const source = new DataSource({
    type: 'better-sqlite3',
    database: databasePath,
    migrationsRun: true,
    migrationsTransactionMode: 'all',
    entities: [],
    migrations: MIGRATION_REGISTRY.slice(0, throughOrdinal).map((entry) => entry.migration),
    logging: false,
    prepareDatabase: (database) => {
      database.pragma('foreign_keys = ON');
      database.pragma('journal_mode = WAL');
    },
  });
  await source.initialize();
  await source.destroy();
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-fixtures-'));
  const databasePath = path.join(temporaryDirectory, 'fixture.db');
  try {
    await migrate(databasePath, 1);
    seedBaseline(databasePath);
    for (const migration of MIGRATION_REGISTRY.slice(0, 21)) {
      await migrate(databasePath, migration.ordinal);
      const databaseBytes = fs.readFileSync(databasePath);
      const compressed = zlib.gzipSync(databaseBytes, { level: 9, mtime: 0 });
      const stem = `${String(migration.ordinal).padStart(2, '0')}-${migration.name}`;
      fs.writeFileSync(path.join(outputDirectory, `${stem}.db.gz`), compressed);
      fs.writeFileSync(
        path.join(outputDirectory, `${stem}.manifest.json`),
        `${JSON.stringify({
          format: 1,
          migration: { id: migration.id, name: migration.name, ordinal: migration.ordinal },
          databaseSha256: sha256Buffer(databaseBytes),
          compressedSha256: sha256Buffer(compressed),
          semanticFingerprint: logicalFingerprint(databasePath),
        }, null, 2)}\n`
      );
    }
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
